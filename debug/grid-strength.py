"""Mide la fuerza de la rejilla 8x6 en un boardArea candidato (coordenadas normalizadas)."""
import sys
import cv2
import numpy as np

def grid_strength(img_path, ba, cols=8, rows=6):
    img = cv2.imread(img_path)
    h, w = img.shape[:2]
    x1 = int(ba["x"] * w)
    y1 = int(ba["y"] * h)
    x2 = int((ba["x"] + ba["width"]) * w)
    y2 = int((ba["y"] + ba["height"]) * h)
    crop = img[y1:y2, x1:x2]
    if crop.size == 0:
        return 0.0
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    mag = np.sqrt(sobelx**2 + sobely**2)
    bw = x2 - x1
    bh = y2 - y1
    cell_w = bw / cols
    cell_h = bh / rows
    score = 0.0
    for c in range(1, cols):
        x = max(0, min(round(c * cell_w), mag.shape[1] - 1))
        score += float(mag[:, x].mean())
    for r in range(1, rows):
        y = max(0, min(round(r * cell_h), mag.shape[0] - 1))
        score += float(mag[y, :].mean())
    return score

world = sys.argv[1] if len(sys.argv) > 1 else "AGUA"
img = f"assets/backgrounds/{world}/bg_01.png"

candidates = {
    "determinista(8cols+2)": {"x": 0.2973054304029304, "y": 0.26367225, "width": 0.4098141391941391, "height": 0.539062},
    "SAM": None,
}

# leer el resultado SAM si existe
import json, os
det_path = f"assets/backgrounds/{world}/board-detection.json"
if os.path.exists(det_path):
    det = json.load(open(det_path, encoding="utf-8"))
    if det.get("boardSize") == [8, 6]:
        candidates["SAM"] = det["boardArea"]

for name, ba in candidates.items():
    if ba is None:
        continue
    s = grid_strength(img, ba)
    print(f"{world} {name}: strength={s:.1f}  area={ba}")
