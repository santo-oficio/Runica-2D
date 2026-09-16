"""
Convierte las imágenes de submundos a PNG 7680x4320 (8K) sin pérdida.

- Recorta a 16:9 centrado (para mantener la relación del target)
- Escala con INTER_LANCZOS4 (máxima calidad de interpolación tradicional)
- Guarda como PNG sin compresión con pérdida
"""

import cv2
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUB_DIR = os.path.join(ROOT, "assets", "submundos")

TARGET_W = 7680
TARGET_H = 4320
TARGET_RATIO = TARGET_W / TARGET_H  # 16:9 ≈ 1.778

WORLDS = ["AGUA", "ESPACIO", "FUEGO", "HIELO", "INFRAMUNDO", "MAZMORRA", "TIERRA", "VIENTO"]

for world in WORLDS:
    world_dir = os.path.join(SUB_DIR, world)
    if not os.path.isdir(world_dir):
        print(f"  [SKIP] {world}: carpeta no encontrada")
        continue

    files = [f for f in os.listdir(world_dir) if f.lower().endswith((".jpg", ".jpeg", ".png", ".bmp", ".webp"))]
    if not files:
        print(f"  [SKIP] {world}: sin imágenes")
        continue

    for fname in files:
        fpath = os.path.join(world_dir, fname)
        img = cv2.imread(fpath, cv2.IMREAD_COLOR)
        if img is None:
            print(f"  [ERROR] {world}/{fname}: no se pudo leer")
            continue

        h, w = img.shape[:2]
        src_ratio = w / h

        # Recortar a 16:9 centrado
        if src_ratio > TARGET_RATIO:
            # Más ancho que 16:9 → recortar laterales
            new_w = int(h * TARGET_RATIO)
            x0 = (w - new_w) // 2
            img = img[:, x0:x0 + new_w]
        elif src_ratio < TARGET_RATIO:
            # Más alto que 16:9 → recortar arriba/abajo
            new_h = int(w / TARGET_RATIO)
            y0 = (h - new_h) // 2
            img = img[y0:y0 + new_h, :]

        h, w = img.shape[:2]
        print(f"  {world}/{fname}: {w}x{h} -> {TARGET_W}x{TARGET_H}", end=" ... ", flush=True)

        # Escalar con Lanczos (máxima calidad)
        img_8k = cv2.resize(img, (TARGET_W, TARGET_H), interpolation=cv2.INTER_LANCZOS4)

        # Guardar como PNG
        base = os.path.splitext(fname)[0]
        out_path = os.path.join(world_dir, f"{base}.png")
        cv2.imwrite(out_path, img_8k, [cv2.IMWRITE_PNG_COMPRESSION, 6])

        size_mb = os.path.getsize(out_path) / (1024 * 1024)
        print(f"OK ({size_mb:.1f} MB)")

        # Borrar el original si era JPG y el PNG es distinto
        if fname.lower().endswith((".jpg", ".jpeg")) and os.path.abspath(fpath) != os.path.abspath(out_path):
            os.remove(fpath)
            print(f"         borrado original: {fname}")

print("\nDone.")
