"""
Sube cualquier imagen a un tamaño objetivo a calidad extrema SIN recortar.

Pipeline (mismo que convert-backgrounds-8k.py / convert-submundos-8k.py):
  1. Real-ESRGAN x4plus (GPU, fp16, por tiles) -> escala 4x sobre el RGB.
  2. Lanczos (INTER_LANCZOS4) hasta el tamaño objetivo exacto.
  3. Si la imagen tiene canal alfa, se reescala por separado con Lanczos.

Uso:
  .sam-venv/Scripts/python.exe tools/upscale-8k.py <imagen> [WxH]

Si no se indica tamaño, el objetivo es 7680x4320.
Ejemplos:
  .sam-venv/Scripts/python.exe tools/upscale-8k.py assets/instrucciones/instrucciones.png
  .sam-venv/Scripts/python.exe tools/upscale-8k.py assets/foo/bar.png 7680x7680
"""

import cv2
import numpy as np
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


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


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    fpath = sys.argv[1]
    target_w, target_h = 7680, 4320
    if len(sys.argv) > 2:
        tw, th = sys.argv[2].lower().split("x")
        target_w, target_h = int(tw), int(th)

    if not os.path.isfile(fpath):
        print(f"[ERROR] no existe: {fpath}")
        sys.exit(1)

    img = cv2.imread(fpath, cv2.IMREAD_UNCHANGED)
    if img is None:
        print(f"[ERROR] no se pudo leer: {fpath}")
        sys.exit(1)

    h, w = img.shape[:2]
    if (w, h) == (target_w, target_h):
        print(f"[SKIP] ya está en {target_w}x{target_h}")
        return

    print(f"{fpath}: {w}x{h} -> {target_w}x{target_h}", flush=True)

    if img.ndim == 3 and img.shape[2] == 4:
        bgr, alpha = img[:, :, :3], img[:, :, 3]
    else:
        bgr, alpha = img[:, :, :3] if img.ndim == 3 else img, None

    upsampler = build_upsampler()
    out, _ = upsampler.enhance(bgr, outscale=4)
    rgb = cv2.resize(out, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)

    if alpha is not None:
        a = cv2.resize(alpha, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)
        final = cv2.merge([rgb, a])
    else:
        final = rgb

    cv2.imwrite(fpath, final, [cv2.IMWRITE_PNG_COMPRESSION, 6])
    size_mb = os.path.getsize(fpath) / (1024 * 1024)
    print(f"      OK ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
