# Genera el .pano.webp de un submundo en dos fases:
#
#   1) SQUEEZE vertical content-aware: 7680×5120 (3:2) -> 7680×4320 (16:9).
#      Cada fila recibe una escala s(r) según su contenido (bordes Sobel):
#      el HUD y las islas quedan a escala ~1 y el cielo vacío entre filas
#      de islas se comprime hasta ~45%. Toda la composición cabe en 16:9
#      sin recortar ni inventar nada.
#   2) EXTENSIÓN lateral con quilting min-cut (tools/quilt_extend.py)
#      hasta ratio 2.35 (~10152×4320) — solo se ve en pantallas más
#      anchas que 16:9; a 16:9 el viewport muestra exactamente el arte
#      original comprimido, ni un píxel sintético.
#
# Uso: python tools/pano_build.py <src.webp> <dst.pano.webp>
#      python tools/pano_build.py --batch   (los 8 submundos)

import argparse
import glob
import os
import subprocess
import sys
import numpy as np
import cv2
from PIL import Image

PY = os.path.join(".sam-venv", "Scripts", "python.exe")
SQ_H = 4320          # alto del lienzo 16:9 (7680 * 9 / 16)
PANO_RATIO = 2.35    # ratio final del .pano.webp


def squeeze_rows(img, ht=SQ_H, protect_top=0.15):
    """Devuelve (imagen_comprimida, pos): pos[r] = fila de salida donde
    cae la fila r del original (para remapear coordenadas)."""
    f = img.astype(np.float32)
    H = f.shape[0]
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float32)
    sob = cv2.Sobel(gray, cv2.CV_32F, 1, 0) ** 2 + cv2.Sobel(gray, cv2.CV_32F, 0, 1) ** 2
    thr = np.percentile(sob, 90)
    frac = (sob > thr).mean(axis=1)            # fracción de bordes por fila
    imp = np.clip(frac * 10.0, 0, 1)
    imp[: int(H * protect_top)] = 1.0          # barra del HUD intacta
    imp = cv2.GaussianBlur(imp.reshape(-1, 1), (0, 0), 40).ravel()
    imp = np.clip(imp, 0, 1)
    s_min = 0.42
    s = 1 - (1 - s_min) * (1 - imp)
    for _ in range(4):                         # converger a sum(s)=ht
        s *= ht / s.sum()
        s = np.clip(s, s_min, 1.0)
    s *= ht / s.sum()
    pos = np.cumsum(s)
    t = np.arange(ht) + 0.5
    i = np.clip(np.searchsorted(pos, t) - 1, 0, H - 1)
    prev = np.concatenate([[0.0], pos[:-1]])
    ft = np.clip((t - prev[i]) / np.maximum(s[i], 1e-6), 0, 1)[:, None, None]
    j = np.minimum(i + 1, H - 1)
    out = f[i] * (1 - ft) + f[j] * ft
    return out.astype(np.uint8), pos


def build(src, dst):
    img = np.asarray(Image.open(src).convert("RGB"), dtype=np.uint8)
    H, W = img.shape[:2]
    sq, pos = squeeze_rows(img, SQ_H)
    tmp = dst + ".sq.tmp.webp"
    Image.fromarray(sq).save(tmp, quality=92)
    r = subprocess.run(
        [PY, "tools/quilt_extend.py", tmp, dst,
         "--ratio", str(PANO_RATIO), "--excl-top", "0.18"],
        capture_output=True, text=True)
    os.remove(tmp)
    print(r.stdout.strip(), r.stderr.strip()[-300:] if r.returncode else "", flush=True)
    os.makedirs(".tmp_chk", exist_ok=True)
    np.save(os.path.join(".tmp_chk", "sqpos-" + os.path.basename(dst) + ".npy"), pos)
    return pos


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", nargs="?")
    ap.add_argument("dst", nargs="?")
    ap.add_argument("--batch", action="store_true")
    a = ap.parse_args()
    if a.batch:
        for src in sorted(glob.glob("assets/submundos/*/submundo*.webp")):
            if ".pano" in src or ".169" in src or "/old/" in src.replace("\\", "/"):
                continue
            print(">>>", src, flush=True)
            build(src, src.replace(".webp", ".pano.webp"))
    else:
        build(a.src, a.dst)


if __name__ == "__main__":
    main()
