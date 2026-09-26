# Convierte todos los PNG de assets/ a WebP (q92) junto al original y
# mueve los PNG masters a assets/old <categoria>/<...>. Los PNG que ya
# estan dentro de carpetas old* o display/ se ignoran.
import os
import shutil
import sys
from PIL import Image

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')
ASSETS = os.path.normpath(ASSETS)
QUALITY = 92


def old_path(png_path):
    """assets/<cat>/<rest>/x.png -> assets/old <cat>/<rest>/x.png"""
    rel = os.path.relpath(png_path, ASSETS)
    parts = rel.split(os.sep)
    return os.path.join(ASSETS, 'old ' + parts[0], *parts[1:])


def is_archived(path):
    rel = os.path.relpath(path, ASSETS)
    parts = rel.split(os.sep)
    return any(p.lower().startswith('old') for p in parts[:-1]) or 'display' in [p.lower() for p in parts[:-1]]


def main():
    dry = '--apply' not in sys.argv
    converted = moved = skipped = 0
    for root, dirs, files in os.walk(ASSETS):
        for f in sorted(files):
            if not f.lower().endswith('.png'):
                continue
            src = os.path.join(root, f)
            if is_archived(src):
                skipped += 1
                continue
            webp = os.path.splitext(src)[0] + '.webp'
            dst = old_path(src)
            print(('DRY ' if dry else '') + f'{os.path.relpath(src, ASSETS)} -> webp + old/' +
                  os.path.relpath(dst, ASSETS))
            if dry:
                converted += 1
                continue
            im = Image.open(src)
            has_alpha = im.mode in ('RGBA', 'LA', 'PA') or (im.mode == 'P' and 'transparency' in im.info)
            if im.mode == 'P':
                im = im.convert('RGBA' if has_alpha else 'RGB')
            elif im.mode not in ('RGB', 'RGBA'):
                im = im.convert('RGBA' if has_alpha else 'RGB')
            tmp = webp + '.tmp'
            im.save(tmp, 'WEBP', quality=QUALITY, method=4)
            os.replace(tmp, webp)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.move(src, dst)
            converted += 1
            moved += 1
    print(f'\nconvertidos={converted} movidos={moved} ignorados(old/display)={skipped} dry={dry}')


if __name__ == '__main__':
    main()
