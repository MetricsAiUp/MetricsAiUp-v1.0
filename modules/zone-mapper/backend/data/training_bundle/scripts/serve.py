#!/usr/bin/env python3
"""
FastAPI inference server — drop-in replacement for Claude Vision
in the zone-mapper backend.

POST /analyze   body=JPEG bytes, optional ?threshold=0.5
    → { "occupied": bool, "occupancy_prob": float,
        "body": "sedan|...|null", "body_prob": float,
        "processing_ms": int }

POST /analyze_batch  body=JSON { "images": ["<base64>", ...] }
    → { "results": [...] }

GET /health  → { "ok": true, "model": "<name>", "img_size": 384 }

Run:
    python scripts/serve.py --ckpt checkpoints/<run>/best.pt --port 8000
"""
import argparse
import base64
import io
import time
from contextlib import asynccontextmanager

import torch
from PIL import Image

try:
    from fastapi import FastAPI, Request, HTTPException
    from fastapi.responses import JSONResponse
    import uvicorn
except ImportError:
    raise SystemExit("Install FastAPI: pip install fastapi uvicorn")

from dataset import make_transforms
from model import build_model


STATE = {}


def load(ckpt_path, device):
    ck = torch.load(ckpt_path, map_location=device, weights_only=False)
    cfg = ck["cfg"]
    body_classes = ck["body_classes"]
    model = build_model(cfg, num_body_classes=len(body_classes)).to(device)
    model.load_state_dict(ck["model"])
    model.eval()
    if device.type == "cuda":
        model = model.half()  # fp16 inference, faster on 3070
    transform = make_transforms(cfg["img_size"], train=False)
    return model, transform, body_classes, cfg


@torch.inference_mode()
def infer_one(img_bytes, threshold=0.5):
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    x = STATE["transform"](img).unsqueeze(0).to(STATE["device"])
    if STATE["device"].type == "cuda":
        x = x.half()
    out = STATE["model"](x)
    prob = torch.sigmoid(out["occ_logit"].float()).item()
    body_probs = torch.softmax(out["body_logits"].float(), dim=-1).squeeze(0)
    body_idx = int(body_probs.argmax().item())
    return {
        "occupied": bool(prob >= threshold),
        "occupancy_prob": round(prob, 4),
        "body": STATE["body_classes"][body_idx] if STATE["body_classes"] else None,
        "body_prob": round(float(body_probs[body_idx].item()), 4),
    }


@asynccontextmanager
async def lifespan(app):
    # Warmup
    if STATE["device"].type == "cuda":
        dummy = torch.zeros(1, 3, STATE["img_size"], STATE["img_size"],
                            device=STATE["device"], dtype=torch.float16)
        with torch.inference_mode():
            STATE["model"](dummy)
        print("[serve] Warmup complete.")
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health():
    return {
        "ok": True,
        "model": STATE["cfg"]["model"]["name"],
        "img_size": STATE["img_size"],
        "device": str(STATE["device"]),
        "body_classes": STATE["body_classes"],
    }


@app.post("/analyze")
async def analyze(request: Request, threshold: float = 0.5):
    body = await request.body()
    if not body:
        raise HTTPException(400, "empty body")
    t0 = time.time()
    try:
        result = infer_one(body, threshold=threshold)
    except Exception as e:
        raise HTTPException(400, f"bad image: {e}")
    result["processing_ms"] = int((time.time() - t0) * 1000)
    return result


@app.post("/analyze_batch")
async def analyze_batch(request: Request, threshold: float = 0.5):
    payload = await request.json()
    imgs_b64 = payload.get("images", [])
    if not imgs_b64:
        raise HTTPException(400, "no images")
    t0 = time.time()
    results = []
    for b64 in imgs_b64:
        try:
            img_bytes = base64.b64decode(b64)
            results.append(infer_one(img_bytes, threshold=threshold))
        except Exception as e:
            results.append({"error": str(e)})
    return {
        "results": results,
        "processing_ms": int((time.time() - t0) * 1000),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True)
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=8000)
    args = ap.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[serve] loading {args.ckpt} on {device}")
    model, transform, body_classes, cfg = load(args.ckpt, device)
    STATE.update({
        "model": model,
        "transform": transform,
        "body_classes": body_classes,
        "cfg": cfg,
        "device": device,
        "img_size": cfg["img_size"],
    })
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
