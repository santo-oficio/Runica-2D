import os
import cv2
import numpy as np
import torch
from mobile_sam import sam_model_registry, SamAutomaticMaskGenerator

OUT_DIR = "assets/avatars"
os.makedirs(OUT_DIR, exist_ok=True)

img_bgr = cv2.imread("avatares.jpg")
img = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
h, w = img.shape[:2]

device = "cuda" if torch.cuda.is_available() else "cpu"
sam = sam_model_registry["vit_t"]("models/mobile_sam.pt")
sam.to(device)

mask_generator = SamAutomaticMaskGenerator(sam)
masks = mask_generator.generate(img)

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

selected = []
for m in candidates:
    if all(iou(m, s) < 0.3 for s in selected):
        selected.append(m)
    if len(selected) >= 9:
        break

# Ordenar por posicion (fila, columna) para nombres estables
selected.sort(key=lambda m: (m["bbox"][1], m["bbox"][0]))

squares = []
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

    # Reescalar a un tamano estandar de 128px (compatible con pantallas)
    target = 128
    square_resized = cv2.resize(square, (target, target), interpolation=cv2.INTER_AREA)

    out = f"{OUT_DIR}/avatar_{i:02d}.png"
    cv2.imwrite(out, square_resized)
    squares.append(square_resized)
    print(f"  avatar_{i:02d}.png  ({cw}x{ch} -> {target}x{target})")

# Hoja de contacto (contact sheet) para verificacion
cols = 3
rows = 3
sheet = np.zeros((128*rows + 40*(rows+1), 128*cols + 40*(cols+1), 4), dtype=np.uint8)
for i, sq in enumerate(squares):
    r = i // cols
    c = i % cols
    x0 = 40 + c*(128+40)
    y0 = 40 + r*(128+40)
    sheet[y0:y0+128, x0:x0+128] = sq
cv2.imwrite("debug/avatares-sheet.png", sheet)
print("\nHoja de contacto: debug/avatares-sheet.png")
print(f"Avatares finales en {OUT_DIR}/")
