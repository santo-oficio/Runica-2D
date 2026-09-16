import os
import cv2
import numpy as np
import torch
from mobile_sam import sam_model_registry, SamPredictor

os.makedirs("debug/crops2", exist_ok=True)

img_bgr = cv2.imread("avatares.jpg")
img = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

device = "cuda" if torch.cuda.is_available() else "cpu"
sam = sam_model_registry["vit_t"]("models/mobile_sam.pt")
sam.to(device)
predictor = SamPredictor(sam)
predictor.set_image(img)

# Box prompts ajustados para los 2 avatares que faltan
# medio-central: esperado ~(626,328,757,477)
# medio-derecho: esperado ~(803,328,949,477)
boxes = [
    ("medio-central", (620, 320, 770, 490)),
    ("medio-derecho", (795, 320, 960, 490)),
]

for name, (x1, y1, x2, y2) in boxes:
    box = np.array([[x1, y1, x2, y2]])
    masks, scores, _ = predictor.predict(box=box, multimask_output=True)

    print(f"{name}: box=({x1},{y1},{x2},{y2})")
    best = None
    for j, m in enumerate(masks):
        ys, xs = np.where(m)
        if len(xs) == 0:
            continue
        area = m.sum()
        fill = area / ((x2-x1)*(y2-y1))
        bx1, bx2 = xs.min(), xs.max()
        by1, by2 = ys.min(), ys.max()
        bw, bh = bx2 - bx1, by2 - by1
        print(f"  mask[{j}] score={scores[j]:.2f} fill={fill:.2f} bbox=({bx1},{by1},{bx2},{by2}) w={bw} h={bh}")
        if fill > 0.9:
            continue
        if best is None or scores[j] > best["score"]:
            best = {"mask": m, "score": float(scores[j]), "x1": int(bx1), "y1": int(by1), "x2": int(bx2), "y2": int(by2)}

    if best:
        mask = best["mask"].astype(np.uint8) * 255
        crop = img_bgr[best["y1"]:best["y2"]+1, best["x1"]:best["x2"]+1]
        crop_mask = mask[best["y1"]:best["y2"]+1, best["x1"]:best["x2"]+1]
        rgba = cv2.cvtColor(crop, cv2.COLOR_BGR2BGRA)
        rgba[:, :, 3] = crop_mask
        ch, cw = rgba.shape[:2]
        side = max(ch, cw)
        square = np.zeros((side, side, 4), dtype=np.uint8)
        ox = (side - cw) // 2
        oy = (side - ch) // 2
        square[oy:oy+ch, ox:ox+cw] = rgba
        out = f"debug/crops2/{name}.png"
        cv2.imwrite(out, square)
        print(f"  -> {out} ({cw}x{ch})")
