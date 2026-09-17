"""Convierte JPGs de avatares a PNG con fondo transparente.

Elimina el fondo blanco por flood fill desde los bordes (OpenCV),
de modo que los blancos internos del personaje se conservan.
Uso:
    .sam-venv/Scripts/python.exe background/jpg-to-transparent-png.py <in.jpg> <out.png>
"""
import sys
import cv2
import numpy as np


def remove_white_background(path_in: str, path_out: str, tol: int = 18) -> None:
    img = cv2.imread(path_in, cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"No se pudo leer {path_in}")
    h, w = img.shape[:2]

    # Flood fill desde las 4 esquinas: rellena solo la region conectada al borde
    mask = np.zeros((h + 2, w + 2), np.uint8)
    flags = 4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8)
    lo = (tol, tol, tol)
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
                 (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        x, y = seed
        if mask[y + 1, x + 1] == 0:
            cv2.floodFill(img, mask, seed, 0, lo, lo, flags)

    bg = mask[1:-1, 1:-1]

    # Erosionar 1px el fondo para cortar el halo blanco del JPEG
    bg = cv2.erode(bg, np.ones((3, 3), np.uint8), iterations=1)

    # Flood fill marca el fondo conectado con 255 en la mascara.
    alpha = np.where(bg > 0, 0, 255).astype(np.uint8)
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0)

    b, g, r = cv2.split(img)
    out = cv2.merge([b, g, r, alpha])
    cv2.imwrite(path_out, out, [cv2.IMWRITE_PNG_COMPRESSION, 0])
    print(f"{path_in} -> {path_out} ({w}x{h})")


if __name__ == "__main__":
    remove_white_background(sys.argv[1], sys.argv[2])
