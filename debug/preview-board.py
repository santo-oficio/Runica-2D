"""Dibuja la rejilla 8x6 sobre la imagen y guarda una vista previa reducida."""
import json
import sys
import cv2

world = sys.argv[1] if len(sys.argv) > 1 else "AGUA"
det_path = f"assets/backgrounds/{world}/board-detection.json"
img_path = f"assets/backgrounds/{world}/bg_01.png"

det = json.load(open(det_path, encoding="utf-8"))
img = cv2.imread(img_path)
h, w = img.shape[:2]
ba = det["boardArea"]
cols, rows = det["boardSize"]

x1 = int(ba["x"] * w)
y1 = int(ba["y"] * h)
x2 = int((ba["x"] + ba["width"]) * w)
y2 = int((ba["y"] + ba["height"]) * h)

# Rectángulo exterior
cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 6)
# Líneas de rejilla
for c in range(1, cols):
    x = int(x1 + (x2 - x1) * c / cols)
    cv2.line(img, (x, y1), (x, y2), (0, 200, 255), 3)
for r in range(1, rows):
    y = int(y1 + (y2 - y1) * r / rows)
    cv2.line(img, (x1, y), (x2, y), (0, 200, 255), 3)

# Reducir para vista previa
scale = 1024 / w
small = cv2.resize(img, (1024, int(h * scale)))
out = f"debug/preview-{world}.png"
cv2.imwrite(out, small)
print(f"{world}: boardArea={ba} size={det['boardSize']} -> {out}")
