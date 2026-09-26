"""Genera versiones "display" (ligeras, para pantalla) de assets pesados.

Uso:
    .sam-venv\\Scripts\\python.exe tools/convert-display-assets.py

Los masters 8K (PNG) se quedan para los calibradores. Las pantallas de juego
usan los .webp reducidos: decodificacion mil veces mas rapida y mucha menos
RAM, por lo que el preload puede mantenerlas decodificadas siempre (regla a
fuego en AGENTS.md: las imagenes del hot path nunca usan masters 8K).

Genera:
  assets/{,old }avatars/avatar_*.png   -> assets/avatars/display/*.webp   (2048px)
  assets/{,old }<cat>/<W>/*.png        -> assets/<cat>/display/<W>/*.webp (1024px)
    con cat = enemys, trampas, obstaculos, salida, bosses

Los masters PNG viven en assets/old <cat>/ (archivados); los PNG que lleguen
nuevos a assets/<cat>/ tambien se leen (luego png-to-webp-archive.py los
archiva y genera el .webp de master).
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
QUALITY = 90

# (directorio base, tamano maximo, solo raiz sin subcarpetas de mundo)
JOBS = [
    ("avatars", 2048, False),
    ("enemys", 1024, True),
    ("trampas", 1024, True),
    ("obstaculos", 1024, True),
    ("salida", 1024, True),
    ("bosses", 1024, True),
]


def convert(src: Path, out: Path, max_side: int) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(src)
    im.thumbnail((max_side, max_side), Image.LANCZOS)
    im.save(out, "WEBP", quality=QUALITY, method=6)
    kb = out.stat().st_size // 1024
    print(f"{src.relative_to(ROOT)} -> {out.relative_to(ROOT)} ({im.size[0]}x{im.size[1]}, {kb} KB)")


def main() -> None:
    for name, max_side, by_world in JOBS:
        base = ROOT / "assets" / name
        if not base.exists():
            continue
        # masters archivados en assets/old <cat>/ + posibles PNG nuevos en assets/<cat>/
        bases = [ROOT / "assets" / ("old " + name), base]
        if by_world:
            for b in bases:
                if not b.exists():
                    continue
                for world_dir in sorted(p for p in b.iterdir() if p.is_dir() and p.name != "display"):
                    for src in sorted(world_dir.glob("*.png")):
                        convert(src, base / "display" / world_dir.name / (src.stem + ".webp"), max_side)
        else:
            for b in bases:
                for src in sorted(b.glob("*.png")):
                    convert(src, base / "display" / (src.stem + ".webp"), max_side)


if __name__ == "__main__":
    main()
