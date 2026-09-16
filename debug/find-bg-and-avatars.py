import cv2
import numpy as np

img = cv2.imread("avatares.jpg")
h, w = img.shape[:2]
print(f"Imagen: {w}x{h}")

# Color de fondo desde las 4 esquinas y bordes
corners = [
    img[0, 0], img[0, w-1], img[h-1, 0], img[h-1, w-1],
    img[0, w//2], img[h//2, 0], img[h-1, w//2], img[h//2, w-1],
]
print("Colores en esquinas/bordes (BGR):")
for c in corners:
    print(f"  {c.tolist()}")

# Muestreo de una franja superior (probablemente fondo)
print("\nMuestras de una rejilla 10x10:")
for i in range(0, 10):
    row = []
    for j in range(0, 10):
        px = img[int(h*(i+0.5)/10), int(w*(j+0.5)/10)]
        row.append(f"({px[2]},{px[1]},{px[0]})")
    print("  " + " ".join(row))
