"""
Model factory. We use ConvNeXt-V2 Large pretrained on ImageNet-22k
as the backbone. Two heads:
  1. Binary occupancy (primary task)
  2. Body type classification (auxiliary, masked when unknown)

ConvNeXt-V2 Large: ~198M params, top-1 ImageNet 87.3% (22k→1k ft).
Picked as the best accuracy/VRAM tradeoff that fits training on 3070
(8GB) with fp16 + img_size=384 + batch_size=8-16.

If VRAM is tight, set cfg.model.name = "convnext_base.fb_in22k_ft_in1k"
or drop img_size to 224.
"""
import torch
import torch.nn as nn
import timm


class OccupancyModel(nn.Module):
    def __init__(self, backbone_name, num_body_classes, pretrained=True, drop_path=0.2):
        super().__init__()
        self.backbone = timm.create_model(
            backbone_name,
            pretrained=pretrained,
            num_classes=0,      # remove classifier; we use our own heads
            global_pool="avg",
            drop_path_rate=drop_path,
        )
        feat_dim = self.backbone.num_features

        # Small dropout + linear heads — gives best generalization
        self.dropout = nn.Dropout(0.1)
        self.head_occ = nn.Linear(feat_dim, 1)          # logit for occupancy
        self.head_body = nn.Linear(feat_dim, num_body_classes)

    def forward(self, x):
        f = self.backbone(x)
        f = self.dropout(f)
        return {
            "occ_logit": self.head_occ(f).squeeze(-1),  # (B,)
            "body_logits": self.head_body(f),           # (B, num_classes)
            "features": f,
        }


def build_model(cfg, num_body_classes):
    return OccupancyModel(
        backbone_name=cfg["model"]["name"],
        num_body_classes=num_body_classes,
        pretrained=cfg["model"].get("pretrained", True),
        drop_path=cfg["model"].get("drop_path", 0.2),
    )
