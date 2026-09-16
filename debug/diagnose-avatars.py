import os
import cv2
import numpy as np
import torch
from mobile_sam import sam_model_registry, SamPredictor

os.makedirs("debug/diag", exist_ok=True)

img_bgr = cv2.imread("avatares.jpg")
img = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

device = "cuda" if torch.cuda.is_available() else "cpu"
sam = sam_model_registry["vit_t"]("models/mobile_sam.pt")
sam.to(device)
predictor = SamPredictor(sam)
predictor.set_image(img)

# Cajas actuales de finalize-all.py
boxes = [
    ("avatar_00", 448, 155, 540, 330),
    ("avatar_01", 622, 152, 765, 332),
    ("avatar_02", 799, 169, 954, 327),
    ("avatar_03", 454, 323, 540, 481),
    ("avatar_04", 620, 322, 775, 484),
    ("avatar_05", 802, 326, 957, 481),
    ("avatar_06", 436, 481, 549, 666),
    ("avatar_07", 635, 477, 763, 666),
    ("avatar_08", 807, 502, 953, 665),
]

def run_box(name, x1, y1, x2, y2, save_overlay=True):
    box = np.array([[x1, y1, x2, y2]])
    masks, scores, _ = predictor.predict(box=box, multimask_output=True)
    print(f"\n{name} box=({x1},{y1},{x2},{y2}) {x2-x1}x{y2-y1}")
    best = None
    for j, m in enumerate(masks):
        ys, xs = np.where(m)
        if len(xs) == 0:
            continue
        bx1, bx2 = int(xs.min()), int(xs.max())
        by1, by2 = int(ys.min()), int(ys.max())
        bw, bh = bx2 - bx1, by2 - by1
        area = int(m.sum())
        fill = area / ((x2 - x1) * (y2 - y1))
        print(f"  mask[{j}] score={scores[j]:.3f} fill={fill:.2f} bbox=({bx1},{by1},{bx2},{by2}) {bw}x{bh} area={area}")
        if fill > 0.9:
            continue
        if bw < 40 or bh < 40:
            continue
        score = scores[j] - max(0, (bw - 160) * 0.002)
        if best is None or score > best["score"]:
            best = {"mask": m, "score": float(score), "j": j, "x1": bx1, "y1": by1, "x2": bx2, "y2": by2, "bw": bw, "bh": bh}

    if save_overlay and best is not None:
        vis = img_bgr.copy()
        # caja prompt en verde
        cv2.rectangle(vis, (x1, y1), (x2, y2), (0, 255, 0), 2)
        # mascara en rojo semitransparente
        mask_color = np.zeros_like(vis)
        mask_color[best["mask"]] = (0, 0, 255)
        vis = cv2.addWeighted(vis, 1.0, mask_color, 0.4, 0)
        # bbox mascara en azul
        cv2.rectangle(vis, (best["x1"], best["y1"]), (best["x2"], best["y2"]), (255, 0, 0), 2)
        cv2.putText(vis, name, (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
        out = f"debug/diag/{name}_overlay.png"
        cv2.imwrite(out, vis)
        print(f"  -> {out}  (verde=prompt, azul=mask bbox, rojo=mask)")
    return best

for name, x1, y1, x2, y2 in boxes:
    run_box(name, x1, y1, x2, y2)

print("\n=== Variaciones para avatar_04 (cuerpo recortado) ===")
# Probar cajas mas grandes hacia abajo y lados
variants_04 = [
    ("avatar_04_expand_down", 620, 322, 775, 510),
    ("avatar_04_expand_all", 610, 315, 785, 510),
    ("avatar_04_expand_wide", 605, 320, 785, 500),
]
for name, x1, y1, x2, y2 in variants_04:
    run_box(name, x1, y1, x2, y2)

print("\n=== Variaciones para avatar_02 ===")
variants_02 = [
    ("avatar_02_tighter", 805, 175, 950, 325),
    ("avatar_02_wider", 795, 160, 960, 335),
    ("avatar_02_lower", 800, 180, 955, 335),
]
for name, x1, y1, x2, y2 in variants_02:
    run_box(name, x1, y1, x2, y2)

print("\n=== Variaciones para avatar_03 ===")
variants_03 = [
    ("avatar_03_tighter", 458, 328, 538, 478),
    ("avatar_03_wider", 448, 318, 548, 488),
    ("avatar_03_lower", 454, 330, 542, 485),
]
for name, x1, y1, x2, y2 in variants_03:
    run_box(name, x1, y1, x2, y2)

print("\nDiagnóstico guardado en debug/diag/")
