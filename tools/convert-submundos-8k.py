"""
Regenera las imágenes de submundos a 7680x5120 (8K, 3:2) SIN recortar.

Pipeline de calidad extrema:
  1. Real-ESRGAN x4plus (GPU, fp16, por tiles) -> escala 4x.
  2. Lanczos (INTER_LANCZOS4) hasta el tamaño objetivo exacto.

- No recorta la imagen: se conserva la relación de aspecto original (3:2).
- Los fondos de submundos son 3:2, así que el objetivo es 7680x5120
  (mismo tamaño que `submundo viento.png`, que ya está en 8K).
- Si una imagen ya está en el tamaño objetivo, se omite.

Uso:
  .sam-venv/Scripts/python.exe tools/convert-submundos-8k.py [MUNDO ...]

Sin argumentos procesa los mundos cuyas imágenes no estén aún en 7680x5120.
"""

import cv2
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUB_DIR = os.path.join(ROOT, "assets", "submundos")

TARGET_W = 7680
TARGET_H = 5120

# Nombre de archivo por mundo (la imagen editada actual).
WORLD_FILES = {
    "ESPACIO": "submundo-espacio.png",
    "AGUA": "submundo agua.png",
    "TIERRA": "submundo tierra.png",
    "FUEGO": "submundo fuego.png",
    "HIELO": "submundo hielo.png",
    "VIENTO": "submundo viento.png",
    "INFRAMUNDO": "submundo inframundo.png",
    "MAZMORRA": "submundo mazmorra.png",
}


def build_upsampler():
    """Construye RealESRGANer con el modelo x4plus (fp16, GPU)."""
    from basicsr.archs.rrdbnet_arch import RRDBNet
    from realesrgan import RealESRGANer

    weights = os.path.join(
        ROOT, ".sam-venv", "Lib", "site-packages", "weights", "RealESRGAN_x4plus.pth"
    )
    if not os.path.isfile(weights):
        # Fallback por si el entorno está instalado en otra ruta.
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


def process_file(world, fname, upsampler):
    fpath = os.path.join(SUB_DIR, world, fname)
    if not os.path.isfile(fpath):
        print(f"  [SKIP] {world}/{fname}: no existe")
        return

    img = cv2.imread(fpath, cv2.IMREAD_COLOR)
    if img is None:
        print(f"  [ERROR] {world}/{fname}: no se pudo leer")
        return

    h, w = img.shape[:2]
    if (w, h) == (TARGET_W, TARGET_H):
        print(f"  [SKIP] {world}/{fname}: ya está en {TARGET_W}x{TARGET_H}")
        return

    print(f"  {world}/{fname}: {w}x{h} -> {TARGET_W}x{TARGET_H}", flush=True)

    # 1) Real-ESRGAN 4x
    out, _ = upsampler.enhance(img, outscale=4)

    # 2) Lanczos hasta el tamaño objetivo exacto (sin recortar)
    final = cv2.resize(out, (TARGET_W, TARGET_H), interpolation=cv2.INTER_LANCZOS4)

    out_path = os.path.join(SUB_DIR, world, fname)
    cv2.imwrite(out_path, final, [cv2.IMWRITE_PNG_COMPRESSION, 6])

    size_mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f"      OK ({size_mb:.1f} MB)")


def main():
    worlds = sys.argv[1:]
    if not worlds:
        worlds = list(WORLD_FILES.keys())

    upsampler = build_upsampler()
    for world in worlds:
        if world not in WORLD_FILES:
            print(f"[ERROR] mundo desconocido: {world}")
            continue
        process_file(world, WORLD_FILES[world], upsampler)

    print("\nDone.")


if __name__ == "__main__":
    main()
