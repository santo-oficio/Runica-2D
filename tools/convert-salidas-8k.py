"""
Regenera las salidas a 7680x7680 PNG opaco (SIN transparencias).

- salida.png: se aplanan las transparencias sobre negro (el arte original
  estaba sobre fondo negro) y se guarda opaco.
- cofre_*.webp: se suben a 8K con Real-ESRGAN x4plus + Lanczos y se
  guardan como PNG opaco. El webp original se mueve a assets/old salidas/.

Uso:
  .sam-venv/Scripts/python.exe tools/convert-salidas-8k.py
"""

import cv2
import numpy as np
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA_DIR = os.path.join(ROOT, "assets", "salida")
OLD_DIR = os.path.join(ROOT, "assets", "old salidas")

TARGET = 7680


def flatten_alpha_over_black(bgra):
    """Compone el RGBA sobre negro: resultado opaco (sin canal alfa)."""
    b, g, r, a = cv2.split(bgra)
    af = a.astype(np.float32) / 255.0
    b = (b * af).astype(np.uint8)
    g = (g * af).astype(np.uint8)
    r = (r * af).astype(np.uint8)
    return cv2.merge([b, g, r])


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
        for fname in sorted(os.listdir(folder)):
            ext = os.path.splitext(fname)[1].lower()
            if ext not in (".png", ".jpg", ".jpeg", ".webp"):
                continue
            fpath = os.path.join(folder, fname)
            print(os.path.relpath(fpath), flush=True)

            if fname.lower().endswith(".png") and fname.lower().startswith("salida"):
                # Aplanar transparencias sobre negro (opaco)
                img = cv2.imread(fpath, cv2.IMREAD_UNCHANGED)
                if img is None:
                    print("  [ERROR] no se pudo leer")
                    continue
                if img.ndim == 3 and img.shape[2] == 4:
                    img = flatten_alpha_over_black(img)
                else:
                    img = img[:, :, :3]
                h, w = img.shape[:2]
                if (w, h) != (TARGET, TARGET):
                    img = cv2.resize(img, (TARGET, TARGET), interpolation=cv2.INTER_LANCZOS4)
                cv2.imwrite(fpath, img, [cv2.IMWRITE_PNG_COMPRESSION, 6])
                size_mb = os.path.getsize(fpath) / (1024 * 1024)
                print(f"  salida.png opaca: {w}x{h} -> {TARGET}x{TARGET} ({size_mb:.1f} MB)")
            else:
                # cofre u otra imagen: Real-ESRGAN 4x -> 7680 PNG opaco
                if upsampler is None:
                    upsampler = build_upsampler()
                img = cv2.imread(fpath, cv2.IMREAD_COLOR)
                if img is None:
                    print("  [ERROR] no se pudo leer")
                    continue
                h, w = img.shape[:2]
                out, _ = upsampler.enhance(img, outscale=4)
                final = cv2.resize(out, (TARGET, TARGET), interpolation=cv2.INTER_LANCZOS4)
                base = os.path.splitext(fname)[0]
                out_path = os.path.join(folder, base + ".png")
                cv2.imwrite(out_path, final, [cv2.IMWRITE_PNG_COMPRESSION, 6])
                size_mb = os.path.getsize(out_path) / (1024 * 1024)
                old_sub = os.path.join(OLD_DIR, sub)
                os.makedirs(old_sub, exist_ok=True)
                shutil.move(fpath, os.path.join(old_sub, fname))
                print(f"  {base}.png: {w}x{h} -> {TARGET}x{TARGET} ({size_mb:.1f} MB) | webp -> old salidas/{sub}/")

    print("\nDone.")


if __name__ == "__main__":
    main()
