"""
Regenera las nuevas salidas a 7680x7680 PNG con fondo transparente.

- Quita el fondo blanco (componentes casi blancos conectados al borde)
  y suaviza el alfa.
- Calidad extrema: Real-ESRGAN x4plus sobre el RGB + Lanczos sobre el
  canal alfa por separado.
- Mueve las salidas anteriores (cofre_*.png) y los nuevos origenes a
  assets/old salidas/<MUNDO>/.

Uso:
  .sam-venv/Scripts/python.exe tools/convert-salidas-transparente.py
"""

import cv2
import numpy as np
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA_DIR = os.path.join(ROOT, "assets", "salida")
OLD_DIR = os.path.join(ROOT, "assets", "old salidas")

TARGET = 7680
TOLERANCE = 26  # distancia por canal al blanco (255)


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


def build_upsampler():
    from basicsr.archs.rrdbnet_arch import RRDBNet
    from realesrgan import RealESRGANer
    weights = os.path.join(
        ROOT, ".sam-venv", "Lib", "site-packages", "weights", "RealESRGAN_x4plus.pth"
    )
    model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
    return RealESRGANer(
        scale=4, model_path=weights, model=model,
        tile=256, tile_pad=10, pre_pad=0, half=True, gpu_id=0,
    )


def main():
    upsampler = None
    for sub in sorted(os.listdir(SALIDA_DIR)):
        folder = os.path.join(SALIDA_DIR, sub)
        if not os.path.isdir(folder):
            continue
        # 1) Mover las salidas anteriores (cofre_*.png 8K) a old
        for fname in list(os.listdir(folder)):
            if fname.startswith("cofre_") and fname.lower().endswith(".png"):
                old_sub = os.path.join(OLD_DIR, sub)
                os.makedirs(old_sub, exist_ok=True)
                shutil.move(os.path.join(folder, fname), os.path.join(old_sub, fname))
                print(f"  movido a old: {sub}/{fname}")
        # 2) Regenerar las nuevas con fondo transparente
        for fname in sorted(os.listdir(folder)):
            ext = os.path.splitext(fname)[1].lower()
            if ext not in (".png", ".jpg", ".jpeg", ".webp"):
                continue
            fpath = os.path.join(folder, fname)
            print(os.path.relpath(fpath), flush=True)
            img = cv2.imread(fpath, cv2.IMREAD_UNCHANGED)
            if img is None:
                print("  [ERROR] no se pudo leer")
                continue
            h, w = img.shape[:2]
            if img.ndim == 3 and img.shape[2] == 4:
                bgr = img[:, :, :3]
                alpha = img[:, :, 3]
            else:
                bgr = img
                bg = background_mask(bgr)
                alpha = np.where(bg > 0, 0, 255).astype(np.uint8)
                alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
            if upsampler is None:
                upsampler = build_upsampler()
            out, _ = upsampler.enhance(bgr, outscale=4)
            rgb = cv2.resize(out, (TARGET, TARGET), interpolation=cv2.INTER_LANCZOS4)
            a = cv2.resize(alpha, (TARGET, TARGET), interpolation=cv2.INTER_LANCZOS4)
            bgra = cv2.merge([rgb, a])
            base = os.path.splitext(fname)[0]
            out_path = os.path.join(folder, base + ".png")
            cv2.imwrite(out_path, bgra, [cv2.IMWRITE_PNG_COMPRESSION, 6])
            old_sub = os.path.join(OLD_DIR, sub)
            os.makedirs(old_sub, exist_ok=True)
            shutil.move(fpath, os.path.join(old_sub, fname))
            size_mb = os.path.getsize(out_path) / (1024 * 1024)
            print(f"  {base}.png: {w}x{h} -> {TARGET}x{TARGET} transparente ({size_mb:.1f} MB) | origen -> old salidas/{sub}/")

    print("\nDone.")


if __name__ == "__main__":
    main()
