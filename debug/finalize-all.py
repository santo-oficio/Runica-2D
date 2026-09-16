import os
import cv2
import numpy as np
import torch
from mobile_sam import sam_model_registry, SamPredictor

OUT_DIR = "assets/avatars"
os.makedirs(OUT_DIR, exist_ok=True)

img_bgr = cv2.imread("avatares.jpg")
img = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

device = "cuda" if torch.cuda.is_available() else "cpu"
sam = sam_model_registry["vit_t"]("models/mobile_sam.pt")
sam.to(device)
predictor = SamPredictor(sam)
predictor.set_image(img)

# 9 avatares con sus boxes ajustadas (fila, columna -> nombre)
# Formato: (nombre, x1, y1, x2, y2)
boxes = [
    ("avatar_00", 448, 155, 540, 330),   # top-left
    ("avatar_01", 622, 152, 765, 332),   # top-middle
    ("avatar_02", 799, 169, 954, 327),   # top-right
    ("avatar_03", 454, 323, 540, 481),   # middle-left
    ("avatar_04", 620, 322, 775, 484),   # middle-middle
    ("avatar_05", 802, 326, 957, 481),   # middle-right
    ("avatar_06", 436, 481, 549, 666),   # bottom-left
    ("avatar_07", 635, 477, 763, 666),   # bottom-middle
    ("avatar_08", 807, 502, 953, 665),   # bottom-right
]

TARGET = 128
results = []

for name, x1, y1, x2, y2 in boxes:
    box = np.array([[x1, y1, x2, y2]])
    masks, scores, _ = predictor.predict(box=box, multimask_output=True)

    # Elegir mascara con mejor score y tamano razonable
    best = None
    for j, m in enumerate(masks):
        ys, xs = np.where(m)
        if len(xs) == 0:
            continue
        bx1, bx2 = int(xs.min()), int(xs.max())
        by1, by2 = int(ys.min()), int(ys.max())
        bw, bh = bx2 - bx1, by2 - by1
        area = m.sum()
        fill = area / ((x2-x1)*(y2-y1))
        if fill > 0.85:
            continue
        if bw < 40 or bh < 40:
            continue
        # penalizar bboxes demasiado anchos (posible fusion con vecino)
        score = scores[j] - max(0, (bw - 160) * 0.002)
        if best is None or score > best["score"]:
            best = {"mask": m, "score": float(score), "x1": bx1, "y1": by1, "x2": bx2, "y2": by2, "bw": bw, "bh": bh}

    if best is None:
        print(f"{name}: sin mascara valida")
        continue

    mask = best["mask"].astype(np.uint8) * 255
    crop = img_bgr[best["y1"]:best["y2"]+1, best["x1"]:best["x2"]+1]
    crop_mask = mask[best["y1"]:best["y2"]+1, best["x1"]:best["x2"]+1]

    rgba = cv2.cvtColor(crop, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = crop_mask

    # Cuadrado con padding transparente
    ch, cw = rgba.shape[:2]
    side = max(ch, cw)
    square = np.zeros((side, side, 4), dtype=np.uint8)
    ox = (side - cw) // 2
    oy = (side - ch) // 2
    square[oy:oy+ch, ox:ox+cw] = rgba

    # Reescalar a 128px (compatible con pantallas)
    resized = cv2.resize(square, (TARGET, TARGET), interpolation=cv2.INTER_AREA)

    out = f"{OUT_DIR}/{name}.png"
    cv2.imwrite(out, resized)
    results.append(resized)
    print(f"{name}: bbox=({best['x1']},{best['y1']},{best['x2']},{best['y2']}) {best['bw']}x{best['bh']} -> {TARGET}x{TARGET}")

# Hoja de contacto
cols = 3
rows = 3
sheet = np.zeros((TARGET*rows + 40*(rows+1), TARGET*cols + 40*(cols+1), 4), dtype=np.uint8)
for i, sq in enumerate(results):
    r = i // cols
    c = i % cols
    x0 = 40 + c*(TARGET+40)
    y0 = 40 + r*(TARGET+40)
    sheet[y0:y0+TARGET, x0:x0+TARGET] = sq
cv2.imwrite("debug/avatares-sheet-final.png", sheet)
print(f"\n{len(results)} avatares finales en {OUT_DIR}/")
print("Hoja de contacto: debug/avatares-sheet-final.png")
