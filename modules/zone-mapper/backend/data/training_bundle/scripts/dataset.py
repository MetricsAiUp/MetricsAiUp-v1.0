"""
PyTorch Dataset + DataLoader factory for zone occupancy training.
Shared by train.py, evaluate.py, predict.py.
"""
import json
from pathlib import Path

import torch
from torch.utils.data import Dataset, DataLoader
from PIL import Image
import numpy as np


class ZoneDataset(Dataset):
    """
    Reads a JSONL split and returns (image_tensor, labels_dict).

    labels_dict = { "occupied": 0|1 (float),
                    "body": int (class idx) or -1 (unknown) }
    """
    def __init__(self, split_path, dataset_root, transform=None, body_classes=None):
        self.split_path = Path(split_path)
        self.dataset_root = Path(dataset_root)
        self.transform = transform
        self.body_classes = body_classes or []
        self.body_idx = {b: i for i, b in enumerate(self.body_classes)}

        self.items = []
        with self.split_path.open() as f:
            for line in f:
                line = line.strip()
                if line:
                    self.items.append(json.loads(line))

    def __len__(self):
        return len(self.items)

    def __getitem__(self, i):
        it = self.items[i]
        img_path = self.dataset_root / it["image"]
        img = Image.open(img_path).convert("RGB")
        if self.transform is not None:
            img = self.transform(img)

        occ = 1.0 if it["occupied"] else 0.0
        body = it.get("body")
        body_idx = self.body_idx.get(body, -1) if body else -1

        return img, {
            "occupied": torch.tensor(occ, dtype=torch.float32),
            "body": torch.tensor(body_idx, dtype=torch.long),
            "zone": it.get("zone", ""),
        }


def make_transforms(img_size, train):
    """Albumentations-free transforms using torchvision v2."""
    import torchvision.transforms.v2 as T
    if train:
        return T.Compose([
            T.PILToTensor(),
            T.RandomResizedCrop(img_size, scale=(0.85, 1.0), ratio=(0.9, 1.1), antialias=True),
            T.RandomHorizontalFlip(p=0.5),
            T.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.15, hue=0.03),
            T.RandomAutocontrast(p=0.15),
            T.ToDtype(torch.float32, scale=True),
            T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
    return T.Compose([
        T.PILToTensor(),
        T.Resize(int(img_size * 1.14), antialias=True),
        T.CenterCrop(img_size),
        T.ToDtype(torch.float32, scale=True),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])


def make_loaders(cfg, body_classes):
    dataset_root = Path(cfg["dataset_root"])
    splits_root = Path(cfg["splits_root"])

    train_ds = ZoneDataset(splits_root / "train.jsonl", dataset_root,
                           transform=make_transforms(cfg["img_size"], train=True),
                           body_classes=body_classes)
    val_ds = ZoneDataset(splits_root / "val.jsonl", dataset_root,
                         transform=make_transforms(cfg["img_size"], train=False),
                         body_classes=body_classes)
    test_ds = ZoneDataset(splits_root / "test.jsonl", dataset_root,
                          transform=make_transforms(cfg["img_size"], train=False),
                          body_classes=body_classes)

    # Balanced sampler for train — equal probability occupied/free per batch.
    # Helps on the imbalanced zones (Своб. 04, 07, 05, 03).
    occ_labels = np.array([1 if it["occupied"] else 0 for it in train_ds.items])
    weights = np.where(occ_labels == 1,
                       1.0 / max(occ_labels.sum(), 1),
                       1.0 / max((1 - occ_labels).sum(), 1))
    sampler = torch.utils.data.WeightedRandomSampler(
        weights=torch.from_numpy(weights).double(),
        num_samples=len(train_ds),
        replacement=True,
    )

    train_loader = DataLoader(
        train_ds, batch_size=cfg["batch_size"], sampler=sampler,
        num_workers=cfg["num_workers"], pin_memory=True, persistent_workers=True, drop_last=True,
    )
    val_loader = DataLoader(
        val_ds, batch_size=cfg["batch_size_eval"], shuffle=False,
        num_workers=cfg["num_workers"], pin_memory=True, persistent_workers=True,
    )
    test_loader = DataLoader(
        test_ds, batch_size=cfg["batch_size_eval"], shuffle=False,
        num_workers=cfg["num_workers"], pin_memory=True, persistent_workers=True,
    )
    return train_loader, val_loader, test_loader, (train_ds, val_ds, test_ds)
