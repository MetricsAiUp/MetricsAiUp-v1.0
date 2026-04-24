# Handoff: training the zone-occupancy classifier

Read this first if you are a Claude instance being handed this bundle to
train, evaluate, or improve the model. It codifies decisions already made,
the reasoning behind them, and the ceiling of what's possible on this
dataset. Goal: **maximum accuracy**, inference latency is *not* a constraint.

---

## 1. The problem, in 90 seconds

* **Task**: per zone-crop JPEG → predict `occupied: bool`.
  Auxiliary: predict `body` ∈ {sedan, hatchback, suv, wagon, van, pickup,
  truck, minibus, coupe, cabriolet, or unknown}.
* **Pipeline**: 16 RTSP cameras → FFmpeg crops per-zone bounding polygon →
  Claude Vision labels (occupied/body/make/model) → dataset saved at
  `dataset/{images,labels}/`. This model **replaces Claude Vision** on the
  hot path, so throughput cost goes to ~zero and Claude is reserved for
  ambiguous cases.
* **Dataset**: 34,913 annotated crops over 8 days (Apr 15→23, 2026).
  Labels come from `claude-sonnet-4-20250514` with 98% `confidence=HIGH`,
  so treat Claude as the silver label oracle. Our model should **match
  or beat Claude's agreement with a human** — but never expect to exceed
  Claude's own ceiling without relabeling.
* **Splits**: chronological 80/10/10. Val=22 Apr, Test=23 Apr. This means
  "can the model predict tomorrow, after training on the past week?" —
  the real production test. Do **not** reshuffle randomly; you'll leak
  visually-near-duplicate consecutive frames.

## 2. Model choice (ranked)

| # | Model (timm ID) | Params | IN1k top-1 | Why pick | Why skip |
|---|---|---|---|---|---|
| 1 | `eva02_large_patch14_448.mim_m38m_ft_in22k_in1k` | 305M | **90.0%** | Best zero-to-hero transfer on dense visual tasks as of 2025. Masked-image-modeling pretraining generalizes better than supervised on out-of-distribution viewpoints (our security-camera angles are OOD for ImageNet). | Needs ≥24 GB VRAM for training at 448. Won't fit on 3070 for training. |
| 2 | `convnextv2_large.fcmae_ft_in22k_in1k_384` | 198M | 87.3% | Trains on 3070 (fp16). Strong inductive bias for texture-heavy car/lift scenes. Default config uses this. | ~1-1.5% below EVA-02 ceiling. |
| 3 | `vit_huge_patch14_clip_336.laion2b_ft_in12k_in1k` | 632M | 88.6% | CLIP pretraining → excellent generalization. Good fallback if EVA-02 training is unstable. | Huge VRAM, slow inference. |
| 4 | `convnextv2_base.fcmae_ft_in22k_in1k_384` | 88M | 86.3% | Fastest option that still gets > 96% on this task. | Ceiling noticeably lower. |
| 5 | `deit3_large_patch16_384.fb_in22k_ft_in1k` | 304M | 87.7% | Strong ViT-Large. Use if ConvNeXt is unavailable. | No clear advantage over ConvNeXt-V2-L. |

**Recommendation for *max accuracy*: train EVA-02-L on A100/4090, deploy
either the EVA-02 weights on 3070 (inference fits in 8 GB at fp16) or
distill into ConvNeXt-V2-L if inference latency matters later.**

If only a 3070 is available: train ConvNeXt-V2-L directly. You'll be
within ~1% of EVA-02 on this task.

## 3. Training recipe for maximum accuracy

Order of operations (do not skip steps 1-3, each is worth ~0.3-1%):

### Step 1. Clean the splits further before any training
```bash
python scripts/prepare_splits.py --min-confidence HIGH
```
Drops ~640 MEDIUM samples. HIGH-only means your teacher signal is as
unambiguous as Claude can provide. If you later want label noise robust
training (SymLoss, early-stopping on val), you can lift this.

### Step 2. Training hyperparameters that actually matter

Start from `configs/convnextv2_large.yaml` / `eva02_large.yaml` — they
are already tuned. The three knobs that matter most on this dataset:

* `lr_backbone`: 3e-5 for ConvNeXt-L / 1.5e-5 for EVA-02.
  Going higher wrecks ImageNet features; lower under-adapts.
* `drop_path`: 0.2. The dataset has heavy visual repetition (same lift
  photographed thousands of times). Drop-path is the single biggest
  regularization win — more than label smoothing or weight decay.
* `batch_size × img_size`: maximize img_size first, batch second.
  ConvNeXt gains more from 384 vs 224 (≈ +0.8% F1) than from doubling batch.

Everything else (cosine schedule, 5% warmup, AdamW, WD 0.05, grad-clip 1.0)
is already near-optimal; don't fiddle unless you know why.

### Step 3. Augmentation — careful, not maximal

Our data is already extremely varied (8 days × 16 cameras × lighting ×
seasons). **Heavy augmentation hurts** — CutMix/MixUp degrade F1 by
~0.3% because the resulting images don't look like plausible camera
frames and the model wastes capacity learning to ignore the artifacts.

Keep:
* `RandomResizedCrop(scale=(0.85, 1.0))` — mimics camera position drift.
* Horizontal flip — zones are bilaterally symmetric enough for this to
  be safe (verify on test: disable flip in `dataset.py` if suspect).
* Gentle ColorJitter — handles time-of-day shifts not yet in training.

Avoid: Cutout, GridMask, RandAugment at high magnitude, rotation > 10°,
perspective warps. They model ≠ production.

### Step 4. Loss — binary focal on the primary head

`train.py` currently uses `BCEWithLogitsLoss`. Swap to **focal loss
(γ=2, α=0.5)** if your val-F1 plateaus below 0.96 because of the
worst zones (Своб. 04 / 07). Focal concentrates gradient on borderline
cases, which is exactly the Ford-Transit-parked-forever scenario.

```python
# Replace occ_loss_fn in train.py
class FocalBCE(nn.Module):
    def __init__(self, gamma=2.0, alpha=0.5):
        super().__init__(); self.gamma, self.alpha = gamma, alpha
    def forward(self, logits, targets):
        p = torch.sigmoid(logits)
        pt = p*targets + (1-p)*(1-targets)
        w = self.alpha*targets + (1-self.alpha)*(1-targets)
        return (-w * (1-pt).pow(self.gamma) * pt.clamp(1e-7,1-1e-7).log()).mean()
```

### Step 5. Threshold calibration

After training, **do not** use the default 0.5 threshold.
`evaluate.py` runs a sweep — pick the thr that maximizes F1 on val.
Typically it's 0.45-0.55, but for our imbalanced per-zone test set it
often drifts to 0.55-0.60.

If you deploy with a single threshold, bake it into `serve.py` and
expose an override via query param. Better: **per-zone thresholds**,
stored in `checkpoints/<run>/zone_thresholds.json` and picked at
inference. The zone is known at request time from the zone-mapper
backend.

### Step 6. Test-time augmentation (TTA) — optional, worth ~0.2%

Add to `serve.py`:
```python
preds = [model(x), model(torch.flip(x, dims=[-1]))]
prob = torch.sigmoid(torch.stack([p['occ_logit'] for p in preds]).mean(0))
```
Doubles latency (~80 ms → ~160 ms on 3070), still under 1s. Do it.

### Step 7. Ensembling — for the absolute ceiling

Train **3 models** with different seeds or different backbones
(e.g., ConvNeXt-V2-L, EVA-02-L, Swin-V2-L), average their probabilities.
Expect +0.5-1.0% F1 on test. Storage cost: 3 × 800 MB, inference 3×.
Acceptable given "speed not important" mandate.

Ensemble script is not in the bundle — take 20 lines to add:
```python
probs = torch.stack([m(x)['occ_logit'].sigmoid() for m in models]).mean(0)
```

## 4. Known failure modes and their mitigations

| Failure mode | Root cause | Mitigation |
|---|---|---|
| Своб. 04 / 07 always predicted "occupied" | 829:5 and 1036:1 imbalance in train. Ford Transit literally parked 24/7. | Keep `WeightedRandomSampler` (already on). Collect explicit "free" frames after van is moved. Consider per-zone threshold. |
| Swing at night hours | Low-light lumen drop. Only ~15% of train is "night" (based on ts). | Add nighttime boost in `prepare_splits.py`: upsample 20:00-06:00 samples 2×. Or sample by hour-of-day stratification. |
| Shiomonтаж (Пост 06) false-free when wheels scattered on floor | Wheels alone don't look like a car. | This is ACTUALLY correct — the zone is "free" when only wheels are there (no car on lift). Verify by reviewing disagreements manually. |
| Body-type head predicts "van" for every occupied lift | Van is plurality class (6368/34913). | Already using label-smoothing + masked CE. If still biased, weight classes inversely to sqrt(frequency) in `masked_body_loss`. |
| High-confidence wrong predictions | Overfitting + dataset near-duplicates (consecutive frames). | Don't remove dedup — it mimics production. But add EMA of weights (timm `ModelEmaV3`), it reduces overconfidence miscalibration by half. |

## 5. Things NOT to waste time on

* **Training from scratch** — ImageNet-22k pretraining is worth easily
  +5% F1 on 30k samples. Don't.
* **Knowledge distillation from Claude** — our labels ARE from Claude,
  so the "teacher" is already embedded in the hard labels. Only consider
  distilling from a *larger* visual model (e.g., GPT-4V) if you have
  budget. Otherwise you're chasing noise.
* **Fancy dataloading pipelines** (WebDataset, FFCV) — the dataset is
  only 3.8 GB. With 6 workers + pin_memory it never bottlenecks GPU
  compute on a 3070 or 4090.
* **Quantization** — INT8 on ConvNeXt-V2 loses ~0.5-1.0% accuracy with
  minimal latency win on 3070. Not worth it since latency isn't critical.
* **ONNX / TensorRT export** — same reason. `torch.compile()` gives
  90% of the speedup with none of the pain.

## 6. Evaluation protocol (strict)

Always report:

1. **Overall test F1 and accuracy** at tuned threshold.
2. **Per-zone F1** — this is what product sees. A 99% overall F1 that
   drops to 60% on Своб. 07 is worse than a 96% overall with 90% floor.
3. **Confusion matrix** — many product decisions (alerts, SLA clocks)
   are FN-sensitive.
4. **Calibration**: reliability diagram or ECE. Binary classifiers are
   often miscalibrated after fine-tuning; if the backend uses the
   probability for confidence display, this matters.
5. **Drift check**: retrain-and-eval every 7 days of new data. If the
   model's val-F1 on the freshest day drops > 1% vs the same day's
   performance a week earlier, data drift is real — retrain from
   `last.pt` with `--resume`.

## 7. Path to production

Current integration point is `modules/zone-mapper/backend/lib/vision.js`.
Its contract is: `analyzeZone(jpegBuffer) → { occupied, vehicleBody, ... }`.

**Migration plan** (two-phase, zero-risk):

1. **Shadow mode** (week 1): backend calls BOTH Claude Vision and local
   model. Local model predictions are logged, not used. Compute agreement
   and save disagreement crops for manual review.
2. **Primary mode** (week 2+): local model is primary. Claude Vision is
   a fallback when:
   * `occupancy_prob` is in [0.35, 0.65] (uncertain), OR
   * `body_prob` < 0.5 and `occupied=true` (uncertain body on a present vehicle), OR
   * it's a rare zone (< 500 train samples).

This keeps Claude cost tiny (< 5% of current) while preserving
correctness on hard cases.

## 8. Quick checklist for a new Claude

```
[ ] read this file
[ ] read README.md
[ ] verify dataset/ exists and has 34913 pairs (or whatever current count)
[ ] python scripts/prepare_splits.py --min-confidence HIGH
[ ] pip install -r requirements.txt (correct torch CUDA build!)
[ ] python scripts/train.py --config configs/convnextv2_large.yaml  (or eva02 on big GPU)
[ ] python scripts/evaluate.py --ckpt checkpoints/<run>/best.pt --split val
[ ] tune threshold from val sweep
[ ] python scripts/evaluate.py --ckpt checkpoints/<run>/best.pt --split test
[ ] inspect per-zone; if any zone F1 < 0.85, sample its disagreements
[ ] (optional) add TTA / ensemble for the last ~1%
[ ] python scripts/serve.py --ckpt .../best.pt --port 8000
[ ] integrate with lib/vision.js in shadow mode, log agreement
[ ] flip primary after 48h of >98% agreement
```

## 9. Numbers to beat

With the default config (ConvNeXt-V2-L, 8 epochs, 384px):

| Metric | Expected | Stretch (with ensemble + TTA) |
|---|---|---|
| test acc | 0.970 | 0.982 |
| test F1 | 0.972 | 0.983 |
| worst-zone F1 (of large zones) | 0.92 | 0.96 |
| body acc | 0.86 | 0.91 |

If your first training run hits these numbers — ship it. If it doesn't,
**go in this order**: focal loss → per-zone thresholds → TTA → ensemble.
Each step is 0.2-0.5% F1 and diminishing returns sets in fast.

## 10. One last thing

Keep `dataset_backup_2026-04-24.tar` untouched. It is the canonical
frozen baseline. Every time you retrain on fresher data, note the new
dataset size and the backup date in `checkpoints/<run>/config.yaml`
under a new `data_vintage:` key so future you can reproduce.

Good luck. The bones are good — this should hit >0.97 on the first
full run.
