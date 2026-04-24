#!/usr/bin/env python3
"""
Prepare train/val/test splits from Claude-annotated dataset.

Steps:
 1. Scan labels/*.json
 2. Filter out test zones (Подьемник 1/2/3, Прочие работы, Стоянка, Пост непонятный с мордой)
 3. Filter out LOW confidence samples (optional)
 4. Normalize vehicleBody to canonical classes (ru/en → single taxonomy)
 5. Chronological split: train = first 80%, val = next 10%, test = last 10%
    (Validates generalization to "future" time — the real production scenario.)

Output: splits/{train,val,test}.jsonl with lines:
    { "image": "images/xxx.jpg", "occupied": true|false, "body": "sedan"|null,
      "zone": "...", "ts": "...", "confidence": "HIGH" }
"""
import argparse
import json
import os
import sys
from pathlib import Path
from collections import Counter, defaultdict

# Zones to exclude — these are "test" zones (Тестовая ремзона) that shouldn't
# be part of training data per product decision (2026-04-21).
EXCLUDED_ZONES = {
    "Подьемник 1",
    "Подьемник 2",
    "Подьемник 3",
    "Прочие работы",
    "Стоянка",
    "Пост непонятный с мордой",
    # Older zone naming that also belongs to test room
    "Пост 04",
    "Свободная зона 03",  # NB: keep "Свободная зона 03 — ожидание/ремонт"
}

# Canonical body taxonomy — 10 classes (keeping "unknown" as -1 / null)
BODY_CANONICAL = [
    "sedan", "hatchback", "suv", "wagon", "van",
    "pickup", "truck", "minibus", "coupe", "cabriolet",
]

# Mapping from raw strings (ru/en, any case, free form) → canonical
BODY_MAP = {
    # sedan
    "sedan": "sedan", "седан": "sedan", "saloon": "sedan",
    "седан или хэтчбек": "sedan",  # ambiguous but sedan more likely on lifts
    # hatchback
    "hatchback": "hatchback", "хэтчбек": "hatchback", "хетчбек": "hatchback",
    # SUV / crossover / off-road
    "suv": "suv", "внедорожник": "suv", "кроссовер": "suv",
    "внедорожник/кроссовер": "suv", "crossover": "suv", "off-road": "suv",
    "универсал повышенной проходимости": "suv",
    # wagon (estate)
    "wagon": "wagon", "универсал": "wagon", "estate": "wagon",
    # van / minivan
    "van": "van", "фургон": "van", "минивэн": "van", "minivan": "van",
    "mpv": "van",
    # pickup
    "pickup": "pickup", "пикап": "pickup",
    # truck
    "truck": "truck", "грузовик": "truck", "грузовой": "truck",
    "lorry": "truck",
    # minibus
    "minibus": "minibus", "микроавтобус": "minibus", "маршрутка": "minibus",
    # coupe
    "coupe": "coupe", "купе": "coupe",
    # cabriolet
    "cabriolet": "cabriolet", "кабриолет": "cabriolet", "convertible": "cabriolet",
}


def normalize_body(raw):
    if raw is None:
        return None
    s = str(raw).strip().lower()
    if not s or s in ("none", "null", "unknown", "неизвестно", "не видно", "н/д"):
        return None
    # Exact match
    if s in BODY_MAP:
        return BODY_MAP[s]
    # Substring match (covers "sedan/хэтчбек" etc.)
    for key, canonical in BODY_MAP.items():
        if key in s:
            return canonical
    return None  # unmappable → null


def should_include(label, excluded_zones, min_confidence):
    zone = label.get("zone", "")
    if zone in excluded_zones:
        return False
    conf = label.get("confidence", "HIGH")
    if min_confidence == "HIGH" and conf != "HIGH":
        return False
    if min_confidence == "MEDIUM" and conf == "LOW":
        return False
    if label.get("occupied") not in (True, False):
        return False
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset-root", default=None,
                    help="Path to dataset folder (contains images/ and labels/). "
                         "Default: sibling 'dataset' next to bundle root.")
    ap.add_argument("--out", default=None, help="Output splits directory.")
    ap.add_argument("--train-frac", type=float, default=0.80)
    ap.add_argument("--val-frac", type=float, default=0.10)
    ap.add_argument("--min-confidence", default="MEDIUM",
                    choices=["HIGH", "MEDIUM", "LOW"],
                    help="Drop samples below this confidence (LOW means keep all).")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    bundle_root = Path(__file__).resolve().parent.parent
    dataset_root = Path(args.dataset_root) if args.dataset_root else (bundle_root / "dataset")
    out_dir = Path(args.out) if args.out else (bundle_root / "splits")

    if not dataset_root.exists():
        print(f"ERROR: dataset not found at {dataset_root}", file=sys.stderr)
        print("Pass --dataset-root or place dataset as sibling folder.", file=sys.stderr)
        sys.exit(1)

    labels_dir = dataset_root / "labels"
    images_dir = dataset_root / "images"
    if not labels_dir.exists() or not images_dir.exists():
        print(f"ERROR: expected {labels_dir} and {images_dir}", file=sys.stderr)
        sys.exit(1)

    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Scanning {labels_dir}...")
    samples = []
    skipped_missing_img = 0
    skipped_zone = 0
    skipped_conf = 0
    skipped_bad = 0

    for fp in labels_dir.iterdir():
        if not fp.name.endswith(".json"):
            continue
        try:
            with fp.open() as f:
                label = json.load(f)
        except Exception:
            skipped_bad += 1
            continue

        img_name = fp.stem + ".jpg"
        img_path = images_dir / img_name
        if not img_path.exists():
            skipped_missing_img += 1
            continue

        if label.get("zone") in EXCLUDED_ZONES:
            skipped_zone += 1
            continue

        if not should_include(label, EXCLUDED_ZONES, args.min_confidence):
            skipped_conf += 1
            continue

        ts = label.get("timestamp", "")
        body = normalize_body(label.get("vehicleBody"))
        samples.append({
            "image": f"images/{img_name}",
            "occupied": bool(label["occupied"]),
            "body": body,
            "zone": label.get("zone", ""),
            "ts": ts,
            "confidence": label.get("confidence", "HIGH"),
        })

    print(f"  Found:         {len(samples) + skipped_bad + skipped_missing_img + skipped_zone + skipped_conf}")
    print(f"  Kept:          {len(samples)}")
    print(f"  Skipped zone:  {skipped_zone}")
    print(f"  Skipped conf:  {skipped_conf}")
    print(f"  Missing img:   {skipped_missing_img}")
    print(f"  Bad json:      {skipped_bad}")

    # Chronological split — sort by timestamp
    samples.sort(key=lambda s: s["ts"])

    n = len(samples)
    n_train = int(n * args.train_frac)
    n_val = int(n * args.val_frac)

    splits = {
        "train": samples[:n_train],
        "val": samples[n_train:n_train + n_val],
        "test": samples[n_train + n_val:],
    }

    for name, items in splits.items():
        path = out_dir / f"{name}.jsonl"
        with path.open("w") as f:
            for it in items:
                f.write(json.dumps(it, ensure_ascii=False) + "\n")
        occ = sum(1 for it in items if it["occupied"])
        fre = len(items) - occ
        bodies = Counter(it["body"] for it in items)
        print(f"\n{name}.jsonl  n={len(items)}  occupied={occ} ({occ*100//max(len(items),1)}%)  free={fre}")
        if items:
            print(f"  ts: {items[0]['ts']}  →  {items[-1]['ts']}")
        print(f"  body coverage: {dict(bodies.most_common(5))}")

    # Also write body class index
    class_path = out_dir / "body_classes.json"
    with class_path.open("w") as f:
        json.dump(BODY_CANONICAL, f, indent=2)
    print(f"\nBody taxonomy saved to {class_path}")

    # Per-zone stats for eval
    zone_stats_path = out_dir / "zone_stats.json"
    zone_stats = defaultdict(lambda: {"train": 0, "val": 0, "test": 0,
                                       "train_occ": 0, "val_occ": 0, "test_occ": 0})
    for name, items in splits.items():
        for it in items:
            z = it["zone"]
            zone_stats[z][name] += 1
            if it["occupied"]:
                zone_stats[z][f"{name}_occ"] += 1
    with zone_stats_path.open("w") as f:
        json.dump(zone_stats, f, ensure_ascii=False, indent=2)
    print(f"Zone stats saved to {zone_stats_path}")


if __name__ == "__main__":
    main()
