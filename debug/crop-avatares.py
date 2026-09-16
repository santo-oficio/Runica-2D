import os
import cv2
import numpy as np
import torch
from mobile_sam import sam_model_registry, SamAutomaticMaskGenerator

os.makedirs("debug/crops", exist_ok=True)

img_bgr = cv2.imread("avatares.jpg")
img = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
h, w = img.shape[:2]
print(f"Imagen: {w}x{h}")

device = "cuda" if torch.cuda.is_available() else "cpu"
sam = sam_model_registry["vit_t"]("models/mobile_sam.pt")
sam.to(device)

mask_generator = SamAutomaticMaskGenerator(sam)
masks = mask_generator.generate(img)

# Filtrar: quitar imagen completa y ruido
candidates = [m for m in masks if 1500 < m["area"] < 300000]
candidates.sort(key=lambda m: -m["area"])

def iou(a, b):
    ax1, ay1, aw, ah = a["bbox"]
    ax2, ay2 = ax1 + aw, ay1 + ah
    bx1, by1, bw, bh = b["bbox"]
    bx2, by2 = bx1 + bw, by1 + bh
    ix1 = max(ax1, bx1); iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2); iy2 = min(ay2, by2)
    iw = max(0, ix2 - ix1); ih = max(0, iy2 - iy1)
    inter = iw * ih
    union = aw*ah + bw*bh - inter
    return inter / union if union > 0 else 0

# Seleccion greedy sin solapamiento (deduplicar)
selected = []
for m in candidates:
    if all(iou(m, s) < 0.3 for s in selected):
        selected.append(m)
    if len(selected) >= 9:
        break

print(f"\n{len(selected)} avatares seleccionados:")
for i, m in enumerate(selected):
    x, y, bw, bh = m["bbox"]
    print(f"  [{i}] x={int(x)} y={int(y)} w={int(bw)} h={int(bh)} area={m['area']}")

# Recortar cada uno con transparencia y hacer cuadrado
for i, m in enumerate(selected):
    mask = m["segmentation"].astype(np.uint8) * 255
    x, y, bw, bh = m["bbox"]
    x, y, bw, bh = int(x), int(y), int(bw), int(bh)

    crop = img_bgr[y:y+bh, x:x+bw]
    crop_mask = mask[y:y+bh, x:x+bw]

    rgba = cv2.cvtColor(crop, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = crop_mask

    ch, cw = rgba.shape[:2]
    side = max(ch, cw)
    square = np.zeros((side, side, 4), dtype=np.uint8)
    ox = (side - cw) // 2
    oy = (side - ch) // 2
    square[oy:oy+ch, ox:ox+cw] = rgba

    out = f"debug/crops/avatar_{i:02d}.png"
    cv2.imwrite(out, square)
    print(f"  -> {out}  ({cw}x{ch} -> {side}x{side})")

print("\nRevisa debug/crops/")
