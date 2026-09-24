"""
Regenera los obstáculos a 7680x7680 PNG con transparencia (RGBA).

- Los obstáculos editados (~1600x1600) se suben a 8K con
  Real-ESRGAN x4plus sobre el RGB + Lanczos sobre el canal alfa.
- El PNG de origen se copia a assets/old obstaculos/<MUNDO>/ antes de
  sobrescribirlo en su sitio (mismo nombre).
- Si un obstáculo ya está en 7680x7680, se omite.

Uso:
  .sam-venv/Scripts/python.exe tools/convert-obstaculos-8k.py [MUNDO ...]

Sin argumentos procesa los obstáculos que no estén aún en 7680x7680.
"""

import cv2
import numpy as np
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OBS_DIR = os.path.join(ROOT, "assets", "obstaculos")
OLD_DIR = os.path.join(ROOT, "assets", "old obstaculos")

TARGET = 7680


def build_upsampler():
    """Construye RealESRGANer con el modelo x4plus (fp16, GPU)."""
    from basicsr.archs.rrdbnet_arch import RRDBNet
    from realesrgan import RealESRGANer

    weights = os.path.join(
        ROOT, ".sam-venv", "Lib", "site-packages", "weights", "RealESRGAN_x4plus.pth"
    )
    if not os.path.isfile(weights):
        import realesrgan
        weights = os.path.join(
            os.path.dirname(realesrgan.__file__), "..", "weights", "RealESRGAN_x4plus.pth"
        )
        weights = os.path.abspath(weights)

    if not os.path.isfile(weights):
        raise FileNotFoundError("No se encontró RealESRGAN_x4plus.pth: " + weights)

    model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
    return RealESRGANer(
        scale=4,
        model_path=weights,
        model=model,
        tile=256,
        tile_pad=10,
        pre_pad=0,
        half=True,  # fp16: menos VRAM y más rápido
        gpu_id=0,
    )


def process_file(fpath, world, upsampler):
    img = cv2.imread(fpath, cv2.IMREAD_UNCHANGED)
    if img is None:
        print(f"  [ERROR] {world}: no se pudo leer")
        return

    h, w = img.shape[:2]
    if (w, h) == (TARGET, TARGET):
        print(f"  [SKIP] {world}/{os.path.basename(fpath)}: ya está en {TARGET}x{TARGET}")
        return

    print(f"  {world}/{os.path.basename(fpath)}: {w}x{h} -> {TARGET}x{TARGET}", flush=True)

    if img.ndim == 3 and img.shape[2] == 4:
        bgr = img[:, :, :3]
        alpha = img[:, :, 3]
    else:
        bgr = img
        alpha = np.full((h, w), 255, dtype=np.uint8)

    # 1) Real-ESRGAN 4x sobre el RGB
    out, _ = upsampler.enhance(bgr, outscale=4)
    rgb = cv2.resize(out, (TARGET, TARGET), interpolation=cv2.INTER_LANCZOS4)

    # 2) Lanczos sobre el canal alfa por separado
    a = cv2.resize(alpha, (TARGET, TARGET), interpolation=cv2.INTER_LANCZOS4)

    bgra = cv2.merge([rgb, a])

    # Guardar el origen en old obstaculos/ antes de sobrescribir
    old_sub = os.path.join(OLD_DIR, world)
    os.makedirs(old_sub, exist_ok=True)
    shutil.copy2(fpath, os.path.join(old_sub, os.path.basename(fpath)))

    cv2.imwrite(fpath, bgra, [cv2.IMWRITE_PNG_COMPRESSION, 6])
    size_mb = os.path.getsize(fpath) / (1024 * 1024)
    print(f"      OK ({size_mb:.1f} MB) | origen -> old obstaculos/{world}/")


def main():
    worlds = sys.argv[1:]
    if not worlds:
        worlds = sorted(
            d for d in os.listdir(OBS_DIR)
            if os.path.isdir(os.path.join(OBS_DIR, d))
        )

    upsampler = build_upsampler()
    for world in worlds:
        folder = os.path.join(OBS_DIR, world)
        if not os.path.isdir(folder):
            print(f"[ERROR] sin carpeta: {world}")
            continue
        for fname in sorted(os.listdir(folder)):
            if not fname.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                continue
            process_file(os.path.join(folder, fname), world, upsampler)

    print("\nDone.")


if __name__ == "__main__":
    main()
