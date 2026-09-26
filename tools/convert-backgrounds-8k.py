"""
Regenera los fondos bg_01.png a 7680x4320 (8K, 16:9) SIN recortar.

Pipeline de calidad extrema (mismo que convert-submundos-8k.py):
  1. Real-ESRGAN x4plus (GPU, fp16, por tiles) -> escala 4x.
  2. Lanczos (INTER_LANCZOS4) hasta el tamaño objetivo exacto.

- No recorta la imagen: se reescala al tamaño objetivo exacto.
- Si un fondo ya está en 7680x4320, se omite.

Uso:
  .sam-venv/Scripts/python.exe tools/convert-backgrounds-8k.py [MUNDO ...]

Sin argumentos procesa los fondos que no estén aún en 7680x4320.
"""

import cv2
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG_DIR = os.path.join(ROOT, "assets", "old backgrounds")

TARGET_W = 7680
TARGET_H = 4320


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


def process_file(world, upsampler):
    fpath = os.path.join(BG_DIR, world, "bg_01.png")
    if not os.path.isfile(fpath):
        print(f"  [SKIP] {world}/bg_01.png: no existe")
        return

    img = cv2.imread(fpath, cv2.IMREAD_COLOR)
    if img is None:
        print(f"  [ERROR] {world}/bg_01.png: no se pudo leer")
        return

    h, w = img.shape[:2]
    if (w, h) == (TARGET_W, TARGET_H):
        print(f"  [SKIP] {world}/bg_01.png: ya está en {TARGET_W}x{TARGET_H}")
        return

    print(f"  {world}/bg_01.png: {w}x{h} -> {TARGET_W}x{TARGET_H}", flush=True)

    # 1) Real-ESRGAN 4x
    out, _ = upsampler.enhance(img, outscale=4)

    # 2) Lanczos hasta el tamaño objetivo exacto (sin recortar)
    final = cv2.resize(out, (TARGET_W, TARGET_H), interpolation=cv2.INTER_LANCZOS4)

    cv2.imwrite(fpath, final, [cv2.IMWRITE_PNG_COMPRESSION, 6])

    size_mb = os.path.getsize(fpath) / (1024 * 1024)
    print(f"      OK ({size_mb:.1f} MB)")


def main():
    worlds = sys.argv[1:]
    if not worlds:
        worlds = sorted(
            d for d in os.listdir(BG_DIR)
            if os.path.isdir(os.path.join(BG_DIR, d))
        )

    upsampler = build_upsampler()
    for world in worlds:
        process_file(world, upsampler)

    print("\nDone.")


if __name__ == "__main__":
    main()
