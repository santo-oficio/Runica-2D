"""Genera versiones "display" (ligeras, para pantalla) de assets pesados.

Uso:
    .sam-venv\\Scripts\\python.exe tools/convert-display-assets.py

Los masters 8K (PNG) se quedan para los calibradores. Las pantallas de juego
usan los .webp reducidos: decodificacion mil veces mas rapida y mucha menos
RAM, por lo que el preload puede mantenerlas decodificadas siempre.

Actualmente genera:
  assets/avatars/avatar_*.png -> assets/avatars/display/*.webp (2048px, q90)
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "avatars"
DST = SRC / "display"
MAX_SIDE = 2048
QUALITY = 90


def main() -> None:
    DST.mkdir(exist_ok=True)
    for src in sorted(SRC.glob("avatar_*.png")):
        out = DST / (src.stem + ".webp")
        im = Image.open(src)
        im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        im.save(out, "WEBP", quality=QUALITY, method=6)
        kb = out.stat().st_size // 1024
        print(f"{src.name}: {im.size[0]}x{im.size[1]} -> {out.name} ({kb} KB)")


if __name__ == "__main__":
    main()
