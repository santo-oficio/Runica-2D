import os
import cv2
import numpy as np
import torch
from mobile_sam import sam_model_registry, SamPredictor

os.makedirs("debug/fix", exist_ok=True)
OUT_DIR = "assets/avatars"
os.makedirs(OUT_DIR, exist_ok=True)

img_bgr = cv2.imread("avatares.jpg")
img = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

device = "cuda" if torch.cuda.is_available() else "cpu"
sam = sam_model_registry["vit_t"]("models/mobile_sam.pt")
sam.to(device)
predictor = SamPredictor(sam)
predictor.set_image(img)

TARGET = 128

def save_avatar(mask, x1, y1, x2, y2, name):
    mask_u8 = (mask.astype(np.uint8)) * 255
    crop = img_bgr[y1:y2+1, x1:x2+1]
    crop_mask = mask_u8[y1:y2+1, x1:x2+1]
    rgba = cv2.cvtColor(crop, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = crop_mask
    ch, cw = rgba.shape[:2]
    side = max(ch, cw)
    square = np.zeros((side, side, 4), dtype=np.uint8)
    ox = (side - cw) // 2
    oy = (side - ch) // 2
    square[oy:oy+ch, ox:ox+cw] = rgba
    resized = cv2.resize(square, (TARGET, TARGET), interpolation=cv2.INTER_AREA)
    out = f"{OUT_DIR}/{name}.png"
    cv2.imwrite(out, resized)
    # tambien version sin escalar para diagnostico
    cv2.imwrite(f"debug/fix/{name}_full.png", square)
    print(f"  {name}: bbox=({x1},{y1},{x2},{y2}) {x2-x1+1}x{y2-y1+1} -> {TARGET}x{TARGET}")
    return resized

def pick_best(masks, scores, box):
    x1, y1, x2, y2 = box
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
        if fill > 0.85:
            continue
        if bw < 40 or bh < 40:
            continue
        score = scores[j] - max(0, (bw - 160) * 0.002)
        if best is None or score > best["score"]:
            best = {"mask": m, "score": float(score), "j": j, "x1": bx1, "y1": by1, "x2": bx2, "y2": by2}
    return best

# === Avatares sin problemas (regenerar igual) ===
stable_boxes = [
    ("avatar_00", 448, 155, 540, 330),
    ("avatar_01", 622, 152, 765, 332),
    ("avatar_05", 802, 326, 957, 481),
    ("avatar_06", 436, 481, 549, 666),
    ("avatar_07", 635, 477, 763, 666),
    ("avatar_08", 807, 502, 953, 665),
]

results = []
for name, x1, y1, x2, y2 in stable_boxes:
    box = np.array([[x1, y1, x2, y2]])
    masks, scores, _ = predictor.predict(box=box, multimask_output=True)
    best = pick_best(masks, scores, (x1, y1, x2, y2))
    if best is None:
        print(f"{name}: sin mascara")
        continue
    r = save_avatar(best["mask"], best["x1"], best["y1"], best["x2"], best["y2"], name)
    results.append(r)

# === Avatar 02: probar box + punto central ===
print("\n--- Avatar 02 (box + punto) ---")
box02 = (799, 169, 954, 327)
candidates_02 = []
# solo box
masks, scores, _ = predictor.predict(box=np.array([[box02[0], box02[1], box02[2], box02[3]]]), multimask_output=True)
best = pick_best(masks, scores, box02)
if best:
    candidates_02.append(("box_only", best))
# box + punto central
cx, cy = (box02[0]+box02[2])//2, (box02[1]+box02[3])//2
masks, scores, _ = predictor.predict(
    point_coords=np.array([[cx, cy]]),
    point_labels=np.array([1]),
    box=np.array([[box02[0], box02[1], box02[2], box02[3]]]),
    multimask_output=True,
)
best = pick_best(masks, scores, box02)
if best:
    candidates_02.append(("box+point", best))
# box + 2 puntos (cabeza y cuerpo)
masks, scores, _ = predictor.predict(
    point_coords=np.array([[(box02[0]+box02[2])//2, box02[1]+30], [(box02[0]+box02[2])//2, box02[3]-30]]),
    point_labels=np.array([1, 1]),
    box=np.array([[box02[0], box02[1], box02[2], box02[3]]]),
    multimask_output=True,
)
best = pick_best(masks, scores, box02)
if best:
    candidates_02.append(("box+2pts", best))

for label, b in candidates_02:
    print(f"  {label}: mask[{b['j']}] score={b['score']:.3f} bbox=({b['x1']},{b['y1']},{b['x2']},{b['y2']}) {b['x2']-b['x1']}x{b['y2']-b['y1']}")
    save_avatar(b["mask"], b["x1"], b["y1"], b["x2"], b["y2"], f"avatar_02_{label}")
# usar box+2pts como principal
best02 = candidates_02[-1][1] if candidates_02 else candidates_02[0][1]
r = save_avatar(best02["mask"], best02["x1"], best02["y1"], best02["x2"], best02["y2"], "avatar_02")
results.append(r)

# === Avatar 03: scores bajos, probar box + puntos ===
print("\n--- Avatar 03 (box + punto) ---")
box03 = (454, 323, 540, 481)
candidates_03 = []
masks, scores, _ = predictor.predict(box=np.array([[box03[0], box03[1], box03[2], box03[3]]]), multimask_output=True)
best = pick_best(masks, scores, box03)
if best:
    candidates_03.append(("box_only", best))
cx, cy = (box03[0]+box03[2])//2, (box03[1]+box03[3])//2
masks, scores, _ = predictor.predict(
    point_coords=np.array([[cx, cy]]),
    point_labels=np.array([1]),
    box=np.array([[box03[0], box03[1], box03[2], box03[3]]]),
    multimask_output=True,
)
best = pick_best(masks, scores, box03)
if best:
    candidates_03.append(("box+point", best))
masks, scores, _ = predictor.predict(
    point_coords=np.array([[(box03[0]+box03[2])//2, box03[1]+30], [(box03[0]+box03[2])//2, box03[3]-30]]),
    point_labels=np.array([1, 1]),
    box=np.array([[box03[0], box03[1], box03[2], box03[3]]]),
    multimask_output=True,
)
best = pick_best(masks, scores, box03)
if best:
    candidates_03.append(("box+2pts", best))

for label, b in candidates_03:
    print(f"  {label}: mask[{b['j']}] score={b['score']:.3f} bbox=({b['x1']},{b['y1']},{b['x2']},{b['y2']}) {b['x2']-b['x1']}x{b['y2']-b['y1']}")
    save_avatar(b["mask"], b["x1"], b["y1"], b["x2"], b["y2"], f"avatar_03_{label}")
best03 = candidates_03[-1][1] if candidates_03 else candidates_03[0][1]
r = save_avatar(best03["mask"], best03["x1"], best03["y1"], best03["x2"], best03["y2"], "avatar_03")
results.append(r)

# === Avatar 04: cuerpo recortado (SAM se detiene en y=480) ===
# Estrategia: box + puntos en la parte inferior para forzar segmentacion del cuerpo
print("\n--- Avatar 04 (box + puntos inferiores) ---")
box04 = (620, 322, 775, 484)
candidates_04 = []
# box ampliada + puntos en zona inferior
box04_big = (610, 320, 785, 500)
masks, scores, _ = predictor.predict(box=np.array([[box04_big[0], box04_big[1], box04_big[2], box04_big[3]]]), multimask_output=True)
best = pick_best(masks, scores, box04_big)
if best:
    candidates_04.append(("big_box", best))
# box + punto inferior
masks, scores, _ = predictor.predict(
    point_coords=np.array([[(box04_big[0]+box04_big[2])//2, box04_big[3]-20]]),
    point_labels=np.array([1]),
    box=np.array([[box04_big[0], box04_big[1], box04_big[2], box04_big[3]]]),
    multimask_output=True,
)
best = pick_best(masks, scores, box04_big)
if best:
    candidates_04.append(("box+low_pt", best))
# box + 3 puntos (cabeza, torso, piernas)
masks, scores, _ = predictor.predict(
    point_coords=np.array([
        [(box04_big[0]+box04_big[2])//2, box04_big[1]+25],
        [(box04_big[0]+box04_big[2])//2, (box04_big[1]+box04_big[3])//2],
        [(box04_big[0]+box04_big[2])//2, box04_big[3]-15],
    ]),
    point_labels=np.array([1, 1, 1]),
    box=np.array([[box04_big[0], box04_big[1], box04_big[2], box04_big[3]]]),
    multimask_output=True,
)
best = pick_best(masks, scores, box04_big)
if best:
    candidates_04.append(("box+3pts", best))

for label, b in candidates_04:
    print(f"  {label}: mask[{b['j']}] score={b['score']:.3f} bbox=({b['x1']},{b['y1']},{b['x2']},{b['y2']}) {b['x2']-b['x1']}x{b['y2']-b['y1']}")
    save_avatar(b["mask"], b["x1"], b["y1"], b["x2"], b["y2"], f"avatar_04_{label}")

# Estrategia adicional: tomar la mejor mascara y extenderla hacia abajo con dilatacion
# si la mascara no llega al final del cuerpo
print("\n--- Avatar 04 (extension de mascara) ---")
if candidates_04:
    # elegir la que mas se extiende hacia abajo
    best04 = max(candidates_04, key=lambda c: c[1]["y2"])
    b = best04[1]
    print(f"  Mejor: {best04[0]} y2={b['y2']}")
    # Si aun se corta antes de y=484, dilatar la mascara hacia abajo
    mask = b["mask"].copy()
    ys, xs = np.where(mask)
    y_max = int(ys.max())
    if y_max < 480:
        print(f"  Mascara se corta en y={y_max}, dilatando hacia abajo...")
        # dilatar la zona inferior de la mascara
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 25))
        mask_dil = cv2.dilate(mask.astype(np.uint8), kernel, iterations=2)
        # solo mantener la dilatacion en la zona inferior (debajo de y_max-10)
        mask_ext = mask.copy()
        mask_ext[y_max-10:, :] = mask_dil[y_max-10:, :] | mask[y_max-10:, :]
        # recortar al bbox original ampliado
        x1, y1 = int(xs.min()), int(ys.min())
        x2 = int(xs.max())
        y2 = min(500, mask_ext.shape[0]-1)
        ys2, xs2 = np.where(mask_ext[y1:y2+1, x1:x2+1])
        if len(ys2) > 0:
            r = save_avatar(mask_ext, x1, y1, x2, y2, "avatar_04")
            results.append(r)
        else:
            r = save_avatar(b["mask"], b["x1"], b["y1"], b["x2"], b["y2"], "avatar_04")
            results.append(r)
    else:
        r = save_avatar(b["mask"], b["x1"], b["y1"], b["x2"], b["y2"], "avatar_04")
        results.append(r)

# Reordenar resultados para la hoja de contacto
final_order = [None]*9
for i in range(9):
    name = f"avatar_{i:02d}"
    path = f"{OUT_DIR}/{name}.png"
    if os.path.exists(path):
        final_order[i] = cv2.imread(path, cv2.IMREAD_UNCHANGED)

# Hoja de contacto
cols, rows = 3, 3
sheet = np.zeros((TARGET*rows + 40*(rows+1), TARGET*cols + 40*(cols+1), 4), dtype=np.uint8)
for i, sq in enumerate(final_order):
    if sq is None:
        continue
    r = i // cols
    c = i % cols
    x0 = 40 + c*(TARGET+40)
    y0 = 40 + r*(TARGET+40)
    sheet[y0:y0+TARGET, x0:x0+TARGET] = sq
cv2.imwrite("debug/avatares-sheet-fixed.png", sheet)
print(f"\nHoja de contacto: debug/avatares-sheet-fixed.png")
print(f"Avatares en {OUT_DIR}/")
print("\nVariantes en debug/fix/ para comparar:")
print("  avatar_02_box_only.png, avatar_02_box+point.png, avatar_02_box+2pts.png")
print("  avatar_03_box_only.png, avatar_03_box+point.png, avatar_03_box+2pts.png")
print("  avatar_04_big_box.png, avatar_04_box+low_pt.png, avatar_04_box+3pts.png")
