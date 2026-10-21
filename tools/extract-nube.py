"""Extrae la nube de Downloads (blanca sobre gris claro + sombra suelta).
Segmenta por luminancia, conserva el componente interior mayor (la nube),
rellena huecos y genera alpha solido con borde suave (la nube es opaca:
las facetas grises son sombreado, no translucidez). Salida recortada.
"""
import numpy as np
import cv2
from PIL import Image

SRC = r"C:\Users\jquin\Downloads\nube.jpg"
DST = r"assets\bonus\nube.webp"

img = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float32)
lum = img.mean(axis=2)
mask = (lum > 208).astype(np.uint8)

# Componente mayor que no toca el borde = la nube (descarta fondo y sombra)
n, lab, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
H, W = mask.shape
best, best_area = 0, 0
for i in range(1, n):
    x, y, w, h, area = stats[i]
    if x == 0 or y == 0 or x + w >= W or y + h >= H:
        continue
    if area > best_area:
        best, best_area = i, area
cloud = (lab == best).astype(np.uint8)

# Rellena huecos interiores (facetas grises bajo el umbral)
ff = cloud.copy()
cv2.floodFill(ff, None, (0, 0), 2)
cloud[ff == 0] = 1

# Alpha solido con borde suave: distancia al contorno -> rampa de ~7px
dist = cv2.distanceTransform(cloud, cv2.DIST_L2, 5)
alpha = np.clip(dist / 7.0, 0, 1)
alpha = cv2.GaussianBlur(alpha, (0, 0), 1.0)
a8 = (alpha * 255).astype(np.uint8)

# Recorte al contenido con margen
ys, xs = np.where(a8 > 10)
pad = 10
y0, y1 = max(0, ys.min() - pad), min(H, ys.max() + pad)
x0, x1 = max(0, xs.min() - pad), min(W, xs.max() + pad)
out = np.dstack([img, a8[..., None]]).astype(np.uint8)[y0:y1, x0:x1]
Image.fromarray(out, "RGBA").save(DST, "WEBP", quality=92, method=6)
print("guardado", DST, (x1 - x0, y1 - y0))
