#!/usr/bin/env python3
"""
Run inference on one image, a directory, or a glob pattern.

    python scripts/predict.py --ckpt checkpoints/<run>/best.pt --input path/to/img.jpg
    python scripts/predict.py --ckpt checkpoints/<run>/best.pt --input "/some/dir/*.jpg" --out results.jsonl
"""
import argparse
import glob
import json
import os
from pathlib import Path

import torch
from PIL import Image

from dataset import make_transforms
from model import build_model


def load_model(ckpt_path, device):
    ck = torch.load(ckpt_path, map_location=device, weights_only=False)
    cfg = ck["cfg"]
    body_classes = ck["body_classes"]
    model = build_model(cfg, num_body_classes=len(body_classes)).to(device)
    model.load_state_dict(ck["model"])
    model.eval()
    transform = make_transforms(cfg["img_size"], train=False)
    return model, transform, body_classes, cfg


@torch.no_grad()
def predict_image(model, transform, img_path, device, body_classes, threshold=0.5):
    img = Image.open(img_path).convert("RGB")
    x = transform(img).unsqueeze(0).to(device)
    out = model(x)
    prob = torch.sigmoid(out["occ_logit"]).item()
    body_probs = torch.softmax(out["body_logits"], dim=-1).squeeze(0)
    body_idx = int(body_probs.argmax().item())
    return {
        "image": str(img_path),
        "occupied": bool(prob >= threshold),
        "occupancy_prob": prob,
        "body": body_classes[body_idx] if body_classes else None,
        "body_prob": float(body_probs[body_idx].item()),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True)
    ap.add_argument("--input", required=True, help="File, dir, or glob.")
    ap.add_argument("--threshold", type=float, default=0.5)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model, transform, body_classes, cfg = load_model(args.ckpt, device)
    print(f"Loaded {cfg['model']['name']} @ {cfg['img_size']}px on {device}")

    # Expand input
    paths = []
    if os.path.isdir(args.input):
        paths = sorted(Path(args.input).glob("*.jpg")) + sorted(Path(args.input).glob("*.jpeg")) \
                + sorted(Path(args.input).glob("*.png"))
    elif any(c in args.input for c in "*?["):
        paths = [Path(p) for p in sorted(glob.glob(args.input))]
    else:
        paths = [Path(args.input)]

    results = []
    for p in paths:
        r = predict_image(model, transform, p, device, body_classes, args.threshold)
        results.append(r)
        print(f"{p.name}  occupied={r['occupied']} ({r['occupancy_prob']:.3f})  "
              f"body={r['body']} ({r['body_prob']:.3f})")

    if args.out:
        with open(args.out, "w") as f:
            for r in results:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"\nSaved {len(results)} results to {args.out}")


if __name__ == "__main__":
    main()
