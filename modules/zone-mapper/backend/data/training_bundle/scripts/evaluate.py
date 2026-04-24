#!/usr/bin/env python3
"""
Evaluate a trained checkpoint. Reports overall metrics, per-zone breakdown,
and confusion matrix. Optimal threshold sweep included.

Usage:
    python scripts/evaluate.py --ckpt checkpoints/<run>/best.pt --split test
"""
import argparse
import json
from collections import defaultdict
from pathlib import Path

import torch
import yaml

from dataset import ZoneDataset, make_transforms
from model import build_model


@torch.no_grad()
def collect(model, loader, device):
    model.eval()
    probs, labels, bodies, body_preds, zones = [], [], [], [], []
    for imgs, targets in loader:
        imgs = imgs.to(device, non_blocking=True)
        out = model(imgs)
        prob = torch.sigmoid(out["occ_logit"]).cpu().tolist()
        probs.extend(prob)
        labels.extend(targets["occupied"].tolist())
        bodies.extend(targets["body"].tolist())
        body_preds.extend(out["body_logits"].argmax(-1).cpu().tolist())
        zones.extend(targets["zone"])
    return probs, labels, bodies, body_preds, zones


def metrics_at(probs, labels, thr):
    tp = fp = tn = fn = 0
    for p, y in zip(probs, labels):
        pred = 1 if p >= thr else 0
        if pred == 1 and y == 1: tp += 1
        elif pred == 1 and y == 0: fp += 1
        elif pred == 0 and y == 0: tn += 1
        else: fn += 1
    total = tp + fp + tn + fn
    acc = (tp + tn) / max(total, 1)
    prec = tp / max(tp + fp, 1)
    rec = tp / max(tp + fn, 1)
    f1 = 2 * prec * rec / max(prec + rec, 1e-9)
    return {"thr": thr, "acc": acc, "prec": prec, "rec": rec, "f1": f1,
            "tp": tp, "fp": fp, "tn": tn, "fn": fn}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True)
    ap.add_argument("--split", default="test", choices=["train", "val", "test"])
    ap.add_argument("--batch-size", type=int, default=16)
    ap.add_argument("--num-workers", type=int, default=4)
    ap.add_argument("--out", default=None, help="Output report JSON path.")
    args = ap.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    ck = torch.load(args.ckpt, map_location=device, weights_only=False)
    cfg = ck["cfg"]
    body_classes = ck["body_classes"]
    bundle_root = Path(__file__).resolve().parent.parent
    dataset_root = Path(cfg["dataset_root"])
    splits_root = Path(cfg["splits_root"])
    if not dataset_root.is_absolute():
        dataset_root = bundle_root / dataset_root
    if not splits_root.is_absolute():
        splits_root = bundle_root / splits_root

    model = build_model(cfg, num_body_classes=len(body_classes)).to(device)
    model.load_state_dict(ck["model"])

    ds = ZoneDataset(splits_root / f"{args.split}.jsonl", dataset_root,
                     transform=make_transforms(cfg["img_size"], train=False),
                     body_classes=body_classes)

    def zone_collate(batch):
        imgs = torch.stack([b[0] for b in batch])
        tgts = {
            "occupied": torch.stack([b[1]["occupied"] for b in batch]),
            "body": torch.stack([b[1]["body"] for b in batch]),
            "zone": [b[1]["zone"] for b in batch],
        }
        return imgs, tgts

    loader = torch.utils.data.DataLoader(ds, batch_size=args.batch_size, shuffle=False,
                                         num_workers=args.num_workers, collate_fn=zone_collate,
                                         pin_memory=True)
    probs, labels, bodies, body_preds, zones = collect(model, loader, device)

    # Threshold sweep
    print("=== Threshold sweep ===")
    best = None
    for thr in [round(x * 0.05, 2) for x in range(6, 16)]:
        m = metrics_at(probs, labels, thr)
        print(f"  thr={thr:.2f}  acc={m['acc']:.4f}  f1={m['f1']:.4f}  "
              f"prec={m['prec']:.4f}  rec={m['rec']:.4f}")
        if best is None or m["f1"] > best["f1"]:
            best = m
    print(f"\nBest @ thr={best['thr']}: {best}")

    # Per-zone breakdown @ best threshold
    print("\n=== Per-zone (@ best threshold) ===")
    by_zone = defaultdict(lambda: {"tp": 0, "fp": 0, "tn": 0, "fn": 0})
    for p, y, z in zip(probs, labels, zones):
        pred = 1 if p >= best["thr"] else 0
        k = "tp" if (pred == 1 and y == 1) else "fp" if pred == 1 else "tn" if y == 0 else "fn"
        by_zone[z][k] += 1

    zone_rep = {}
    print(f"  {'Zone':<45} {'n':>5} {'acc':>6} {'f1':>6} {'prec':>6} {'rec':>6}  TP/FP/TN/FN")
    for z, c in sorted(by_zone.items(), key=lambda x: -sum(x[1].values())):
        n = sum(c.values())
        acc = (c["tp"] + c["tn"]) / n if n else 0
        prec = c["tp"] / max(c["tp"] + c["fp"], 1)
        rec = c["tp"] / max(c["tp"] + c["fn"], 1)
        f1 = 2 * prec * rec / max(prec + rec, 1e-9)
        zone_rep[z] = {"n": n, "acc": acc, "f1": f1, "prec": prec, "rec": rec, **c}
        print(f"  {z[:45]:<45} {n:>5} {acc:>6.3f} {f1:>6.3f} {prec:>6.3f} {rec:>6.3f}  "
              f"{c['tp']}/{c['fp']}/{c['tn']}/{c['fn']}")

    # Body accuracy (masked on known)
    correct = total = 0
    for pred, truth in zip(body_preds, bodies):
        if truth < 0:
            continue
        total += 1
        if pred == truth:
            correct += 1
    body_acc = correct / max(total, 1)
    print(f"\nBody accuracy ({total} labeled): {body_acc:.4f}")

    if args.out:
        with open(args.out, "w") as f:
            json.dump({"overall": best, "per_zone": zone_rep, "body_acc": body_acc,
                       "split": args.split}, f, ensure_ascii=False, indent=2)
        print(f"Report saved to {args.out}")


if __name__ == "__main__":
    main()
