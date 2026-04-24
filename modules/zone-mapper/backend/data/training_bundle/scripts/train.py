#!/usr/bin/env python3
"""
Train occupancy + body classifier on prepared splits.

Usage:
    python scripts/train.py --config configs/convnextv2_large.yaml

Output checkpoints land in ./checkpoints/<run_name>/.
The best val-F1 checkpoint is saved as best.pt.
"""
import argparse
import json
import math
import os
import time
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F
import yaml
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR

from dataset import make_loaders
from model import build_model


def load_cfg(path):
    with open(path) as f:
        return yaml.safe_load(f)


def masked_body_loss(logits, targets, smoothing=0.05):
    """Cross-entropy on body head, masking out unknown (-1) samples."""
    mask = targets >= 0
    if mask.sum() == 0:
        return torch.tensor(0.0, device=logits.device)
    return F.cross_entropy(logits[mask], targets[mask], label_smoothing=smoothing)


@torch.no_grad()
def evaluate(model, loader, device, body_classes):
    model.eval()
    correct_occ = 0
    total = 0
    tp = fp = tn = fn = 0
    body_correct = body_total = 0
    probs_all = []
    labels_all = []

    for imgs, labels in loader:
        imgs = imgs.to(device, non_blocking=True)
        occ = labels["occupied"].to(device, non_blocking=True)
        body = labels["body"].to(device, non_blocking=True)

        out = model(imgs)
        prob = torch.sigmoid(out["occ_logit"])
        pred = (prob >= 0.5).float()

        correct_occ += (pred == occ).sum().item()
        total += occ.numel()
        tp += ((pred == 1) & (occ == 1)).sum().item()
        fp += ((pred == 1) & (occ == 0)).sum().item()
        tn += ((pred == 0) & (occ == 0)).sum().item()
        fn += ((pred == 0) & (occ == 1)).sum().item()

        if body_classes:
            mask = body >= 0
            if mask.any():
                pred_body = out["body_logits"].argmax(dim=-1)
                body_correct += (pred_body[mask] == body[mask]).sum().item()
                body_total += mask.sum().item()

        probs_all.extend(prob.cpu().tolist())
        labels_all.extend(occ.cpu().tolist())

    acc = correct_occ / max(total, 1)
    prec = tp / max(tp + fp, 1)
    rec = tp / max(tp + fn, 1)
    f1 = 2 * prec * rec / max(prec + rec, 1e-9)
    body_acc = body_correct / max(body_total, 1) if body_classes else 0.0
    return {
        "acc": acc, "prec": prec, "rec": rec, "f1": f1,
        "body_acc": body_acc,
        "tp": tp, "fp": fp, "tn": tn, "fn": fn,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--resume", default=None, help="Path to checkpoint to resume from.")
    args = ap.parse_args()

    cfg = load_cfg(args.config)
    bundle_root = Path(__file__).resolve().parent.parent
    if not os.path.isabs(cfg["dataset_root"]):
        cfg["dataset_root"] = str(bundle_root / cfg["dataset_root"])
    if not os.path.isabs(cfg["splits_root"]):
        cfg["splits_root"] = str(bundle_root / cfg["splits_root"])

    # Body classes
    body_classes_path = Path(cfg["splits_root"]) / "body_classes.json"
    with body_classes_path.open() as f:
        body_classes = json.load(f)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}, backbone: {cfg['model']['name']}, img_size: {cfg['img_size']}")
    if device.type == "cuda":
        print(f"  GPU: {torch.cuda.get_device_name(0)}  VRAM: "
              f"{torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

    train_loader, val_loader, test_loader, _ = make_loaders(cfg, body_classes)
    print(f"Train batches: {len(train_loader)}, Val: {len(val_loader)}, Test: {len(test_loader)}")

    model = build_model(cfg, num_body_classes=len(body_classes)).to(device)
    if cfg.get("compile", False) and hasattr(torch, "compile"):
        model = torch.compile(model)

    # Two-phase learning rate: backbone lower, heads higher
    lr_backbone = cfg["optim"]["lr_backbone"]
    lr_head = cfg["optim"]["lr_head"]
    wd = cfg["optim"]["weight_decay"]
    backbone_params, head_params = [], []
    for n, p in model.named_parameters():
        if not p.requires_grad:
            continue
        if "head_" in n:
            head_params.append(p)
        else:
            backbone_params.append(p)
    optim = AdamW([
        {"params": backbone_params, "lr": lr_backbone},
        {"params": head_params, "lr": lr_head},
    ], weight_decay=wd)

    total_steps = cfg["epochs"] * len(train_loader)
    warmup_steps = int(0.05 * total_steps)
    scheduler = CosineAnnealingLR(optim, T_max=total_steps - warmup_steps)

    scaler = torch.amp.GradScaler("cuda", enabled=cfg.get("amp", True) and device.type == "cuda")
    occ_loss_fn = nn.BCEWithLogitsLoss()
    body_loss_weight = cfg.get("body_loss_weight", 0.3)

    # Checkpoint dir
    run_name = cfg.get("run_name") or f"{cfg['model']['name']}_{cfg['img_size']}px"
    ckpt_dir = bundle_root / "checkpoints" / run_name
    ckpt_dir.mkdir(parents=True, exist_ok=True)
    with (ckpt_dir / "config.yaml").open("w") as f:
        yaml.safe_dump(cfg, f, allow_unicode=True)

    start_epoch = 0
    best_f1 = 0.0
    if args.resume:
        ck = torch.load(args.resume, map_location=device)
        model.load_state_dict(ck["model"])
        optim.load_state_dict(ck["optim"])
        scheduler.load_state_dict(ck["sched"])
        scaler.load_state_dict(ck["scaler"])
        start_epoch = ck["epoch"] + 1
        best_f1 = ck.get("best_f1", 0.0)
        print(f"Resumed from {args.resume} @ epoch {start_epoch}, best_f1={best_f1:.4f}")

    step = start_epoch * len(train_loader)
    for epoch in range(start_epoch, cfg["epochs"]):
        model.train()
        t0 = time.time()
        running_loss, running_occ, running_body = 0.0, 0.0, 0.0
        seen = 0

        for batch_idx, (imgs, labels) in enumerate(train_loader):
            imgs = imgs.to(device, non_blocking=True)
            occ = labels["occupied"].to(device, non_blocking=True)
            body = labels["body"].to(device, non_blocking=True)

            # Warmup
            if step < warmup_steps:
                f = step / max(warmup_steps, 1)
                for i, g in enumerate(optim.param_groups):
                    g["lr"] = (lr_backbone if i == 0 else lr_head) * f

            optim.zero_grad(set_to_none=True)
            with torch.amp.autocast("cuda", enabled=cfg.get("amp", True) and device.type == "cuda",
                                    dtype=torch.float16):
                out = model(imgs)
                loss_occ = occ_loss_fn(out["occ_logit"], occ)
                loss_body = masked_body_loss(out["body_logits"], body)
                loss = loss_occ + body_loss_weight * loss_body

            scaler.scale(loss).backward()
            scaler.unscale_(optim)
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            scaler.step(optim)
            scaler.update()
            if step >= warmup_steps:
                scheduler.step()
            step += 1

            running_loss += loss.item() * imgs.size(0)
            running_occ += loss_occ.item() * imgs.size(0)
            running_body += loss_body.item() * imgs.size(0)
            seen += imgs.size(0)

            if batch_idx % cfg.get("log_interval", 50) == 0:
                print(f"ep {epoch:03d}/{cfg['epochs']}  step {batch_idx:04d}/{len(train_loader)}  "
                      f"loss {running_loss/seen:.4f}  occ {running_occ/seen:.4f}  "
                      f"body {running_body/seen:.4f}  "
                      f"lr {optim.param_groups[0]['lr']:.2e}/{optim.param_groups[1]['lr']:.2e}")

        val = evaluate(model, val_loader, device, body_classes)
        dt = time.time() - t0
        print(f"\n[epoch {epoch}] train_loss {running_loss/seen:.4f}  "
              f"val_acc {val['acc']:.4f}  val_f1 {val['f1']:.4f}  "
              f"val_prec {val['prec']:.4f}  val_rec {val['rec']:.4f}  "
              f"body_acc {val['body_acc']:.4f}  ({dt:.0f}s)\n")

        # Save checkpoints
        ck = {
            "epoch": epoch, "model": (model._orig_mod.state_dict()
                                       if hasattr(model, "_orig_mod") else model.state_dict()),
            "optim": optim.state_dict(), "sched": scheduler.state_dict(),
            "scaler": scaler.state_dict(), "best_f1": best_f1, "val": val,
            "body_classes": body_classes, "cfg": cfg,
        }
        torch.save(ck, ckpt_dir / "last.pt")
        if val["f1"] > best_f1:
            best_f1 = val["f1"]
            ck["best_f1"] = best_f1
            torch.save(ck, ckpt_dir / "best.pt")
            print(f"  → new best F1 {best_f1:.4f}, saved best.pt")

    # Final test eval with best checkpoint
    print("\n=== Final test evaluation (best.pt) ===")
    best = torch.load(ckpt_dir / "best.pt", map_location=device)
    state = best["model"]
    if hasattr(model, "_orig_mod"):
        model._orig_mod.load_state_dict(state)
    else:
        model.load_state_dict(state)
    test = evaluate(model, test_loader, device, body_classes)
    print(f"TEST  acc={test['acc']:.4f}  f1={test['f1']:.4f}  "
          f"prec={test['prec']:.4f}  rec={test['rec']:.4f}  body_acc={test['body_acc']:.4f}")
    print(f"       TP={test['tp']}  FP={test['fp']}  TN={test['tn']}  FN={test['fn']}")
    with (ckpt_dir / "test_results.json").open("w") as f:
        json.dump(test, f, indent=2)


if __name__ == "__main__":
    main()
