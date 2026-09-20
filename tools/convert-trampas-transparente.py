"""
Convierte las trampas a PNG 1900x1900 con fondo transparente.

- JPG con fondo blanco: se elimina el fondo (componentes casi blancos que
  tocan el borde) y se suaviza el alfa.
- PNG que ya tienen canal alfa: solo se reescalan a 1900x1900.
- Los originales NO se borran: se mueven a assets/old trampas/<SUBCARPETA>/.

Uso:
  .sam-venv/Scripts/python.exe tools/convert-trampas-transparente.py
"""

import cv2
import numpy as np
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRAP_DIR = os.path.join(ROOT, "assets", "trampas")
OLD_DIR = os.path.join(ROOT, "assets", "old trampas")

TARGET = 1900
TOLERANCE = 26  # distancia por canal al blanco (255) para considerar fondo


def background_mask(bgr):
    """Máscara de fondo: componentes casi blancos que tocan el borde."""
    diff = np.max(np.abs(bgr.astype(np.int16) - 255), axis=2)
    near_white = (diff <= TOLERANCE).astype(np.uint8) * 255
    n, labels, stats, _ = cv2.connectedComponentsWithStats(near_white, connectivity=8)
    mask = np.zeros_like(near_white)
    for i in range(1, n):
        x, y, ww, hh, _area = stats[i]
        if x == 0 or y == 0 or x + ww >= near_white.shape[1] or y + hh >= near_white.shape[0]:
            mask[labels == i] = 255
    return mask


def process(fpath):
    sub = os.path.basename(os.path.dirname(fpath))  # AGUA, AIRE, TIERRA...
    img = cv2.imread(fpath, cv2.IMREAD_UNCHANGED)
    if img is None:
        print(f"  [ERROR] no se pudo leer: {fpath}")
        return
    h, w = img.shape[:2]
    has_alpha = img.ndim == 3 and img.shape[2] == 4

    if has_alpha:
        bgra = img
    else:
        bgr = img
        bg = background_mask(bgr)
        alpha = np.where(bg > 0, 0, 255).astype(np.uint8)
        alpha = cv2.GaussianBlur(alpha, (3, 3), 0)  # borde suave
        bgra = cv2.merge([bgr, alpha])

    out = cv2.resize(bgra, (TARGET, TARGET), interpolation=cv2.INTER_LANCZOS4)

    base = os.path.splitext(os.path.basename(fpath))[0]
    out_path = os.path.join(os.path.dirname(fpath), base + ".png")
    cv2.imwrite(out_path, out, [cv2.IMWRITE_PNG_COMPRESSION, 6])

    # Mover el original (sin borrar) a old trampas/<sub>/
    old_sub = os.path.join(OLD_DIR, sub)
    os.makedirs(old_sub, exist_ok=True)
    shutil.move(fpath, os.path.join(old_sub, os.path.basename(fpath)))

    a = out[:, :, 3]
    trans = float((a < 128).sum()) / (TARGET * TARGET) * 100
    opaque = float((a > 128).sum()) / (TARGET * TARGET) * 100
    print(f"  {os.path.relpath(out_path)}: {w}x{h} -> {TARGET}x{TARGET} | "
          f"opaco {opaque:.1f}% / transparente {trans:.1f}% | original -> old trampas/{sub}/")


def main():
    total = 0
    for root, _dirs, files in os.walk(TRAP_DIR):
        for fname in sorted(files):
            if not fname.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                continue
            fpath = os.path.join(root, fname)
            if "old trampas" in fpath:
                continue
            print(os.path.relpath(fpath))
            process(fpath)
            total += 1
    print(f"\nDone. {total} trampas convertidas a PNG 1900x1900 transparente.")


if __name__ == "__main__":
    main()
