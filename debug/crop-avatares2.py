import os
import cv2
import numpy as np
import torch
from mobile_sam import sam_model_registry, SamPredictor

os.makedirs("debug/crops2", exist_ok=True)

img_bgr = cv2.imread("avatares.jpg")
img = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
h, w = img.shape[:2]
print(f"Imagen: {w}x{h}")

device = "cuda" if torch.cuda.is_available() else "cpu"
sam = sam_model_registry["vit_t"]("models/mobile_sam.pt")
sam.to(device)
predictor = SamPredictor(sam)
predictor.set_image(img)

# Posiciones inferidas de la cuadricula 3x3 (centros)
# Confirmadas: top-left(493,242) top-middle(696,242) bottom-left(493,572) bottom-middle(696,572)
centers = [
    (493, 242), (696, 242), (899, 242),   # fila superior
    (493, 360), (696, 360), (899, 360),   # fila central
    (493, 572), (696, 572), (899, 572),   # fila inferior
]

for i, (cx, cy) in enumerate(centers):
    input_point = np.array([[cx, cy]])
    input_label = np.array([1])
    masks, scores, _ = predictor.predict(
        point_coords=input_point,
        point_labels=input_label,
        multimask_output=True,
    )

    # Elegir la mascara con mayor score que no sea la imagen completa
    best = None
    for j, m in enumerate(masks):
        area = m.sum()
        fill = area / (w * h)
        if fill > 0.5:
            continue
        ys, xs = np.where(m)
        x1, x2 = xs.min(), xs.max()
        y1, y2 = ys.min(), ys.max()
        bw, bh = x2 - x1, y2 - y1
        if best is None or scores[j] > best["score"]:
            best = {"mask": m, "score": float(scores[j]), "x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2), "bw": int(bw), "bh": int(bh)}

    if best is None:
        print(f"  [{i}] centro=({cx},{cy}): sin mascara")
        continue

    b = best
    print(f"  [{i}] centro=({cx},{cy}): bbox=({b['x1']},{b['y1']},{b['x2']},{b['y2']}) w={b['bw']} h={b['bh']} score={b['score']:.2f}")

    # Recortar
    mask = b["mask"].astype(np.uint8) * 255
    crop = img_bgr[b["y1"]:b["y2"]+1, b["x1"]:b["x2"]+1]
    crop_mask = mask[b["y1"]:b["y2"]+1, b["x1"]:b["x2"]+1]

    rgba = cv2.cvtColor(crop, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = crop_mask

    ch, cw = rgba.shape[:2]
    side = max(ch, cw)
    square = np.zeros((side, side, 4), dtype=np.uint8)
    ox = (side - cw) // 2
    oy = (side - ch) // 2
    square[oy:oy+ch, ox:ox+cw] = rgba

    out = f"debug/crops2/avatar_{i:02d}.png"
    cv2.imwrite(out, square)
    print(f"    -> {out} ({cw}x{ch})")

print("\nRevisa debug/crops2/")
