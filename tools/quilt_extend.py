# Extiende una imagen por los laterales sintetizando fondo con "quilting"
# (Efros-Freeman lite): parches del propio arte elegidos por bordes que casan,
# sin espejar ni inventar contenido. El original queda intacto en el centro.
#
# Uso: python tools/quilt_extend.py <src> <dst> [--ratio 2.35] [--patch 256]
#       [--overlap 96] [--cands 40] [--excl-top 0.13] [--seed 7]
#
# --excl-top: fracción superior excluida del pool de parches (la barra del HUD
#             no debe colarse en el cielo).

import argparse
import numpy as np
import cv2
from PIL import Image


def build_pool(img, patch, excl_top, n=6000, seed=0):
    """Posiciones de parches candidatos: el 35% más suave (fondo, no islas)."""
    H, W = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float32)
    sob = cv2.Sobel(gray, cv2.CV_32F, 1, 0) ** 2 + cv2.Sobel(gray, cv2.CV_32F, 0, 1) ** 2
    cell = patch // 4
    gh, gw = H // cell, W // cell
    grid = sob[: gh * cell, : gw * cell].reshape(gh, cell, gw, cell).mean(axis=(1, 3))
    rng = np.random.default_rng(seed)
    y0 = int(H * excl_top)
    cand = []
    while len(cand) < n:
        y = int(rng.integers(y0, H - patch))
        x = int(rng.integers(0, W - patch))
        s = float(grid[y // cell : y // cell + 4, x // cell : x // cell + 4].mean())
        cand.append((s, y, x))
    cand.sort(key=lambda t: t[0])
    keep = max(400, int(len(cand) * 0.35))
    return np.array([(y, x) for _, y, x in cand[:keep]], dtype=np.int64)


def quilt_strip(img, edge, E, patch, ov, pool, rng, cands):
    """Sintetiza una tira H×E cuyo lado izquierdo casa con `edge` (banda
    H×~200 del borde real contra el que se pega la tira)."""
    H = img.shape[0]
    step = patch - ov
    f = img.astype(np.float32)
    out = np.zeros((H, E, 3), dtype=np.float32)
    ramp = np.linspace(0, 1, ov + 2)[1:-1].astype(np.float32)

    for y in range(0, H, step):
        ph = min(patch, H - y)
        for x in range(0, E, step):
            pw = min(patch, E - x)
            left_nb = edge[y : y + ph, -ov:] if x == 0 else out[y : y + ph, x - ov : x]
            top_nb = out[y - ov : y, x : x + pw] if y > 0 else None

            best, best_e = None, 1e18
            for _ in range(cands):
                py, px = pool[rng.integers(len(pool))]
                e = np.abs(f[py : py + ph, px : px + ov] - left_nb).mean()
                if top_nb is not None:
                    e += np.abs(f[py : py + ov, px : px + pw] - top_nb).mean()
                if e < best_e:
                    best_e, best = e, (py, px)
            py, px = best
            p = f[py : py + ph, px : px + pw]

            w = np.ones((ph, pw), dtype=np.float32)
            if x > 0:
                w[:, : min(ov, pw)] *= ramp[None, : min(ov, pw)]
            if y > 0:
                k = min(ov, ph)
                w[:k] = np.minimum(w[:k], ramp[:k, None])
            out[y : y + ph, x : x + pw] = (
                out[y : y + ph, x : x + pw] * (1 - w[..., None]) + p * w[..., None]
            )
    return out


def tone_match(ext, edge, fade_px):
    """Continúa el tono del borde real: por fila, acerca la media de cada canal
    de la tira hacia la del borde, fundiendo con la distancia a la costura."""
    mu = edge.mean(axis=1)                      # H×3
    ext_mu = ext[:, :200].mean(axis=1)          # H×3
    delta = (mu - ext_mu)[:, None, :]           # H×1×3
    w = np.clip(1.0 - np.arange(ext.shape[1]) / max(fade_px, 1), 0, 1)
    return np.clip(ext + delta * w[None, :, None], 0, 255)


def extend(img, E, patch, ov, pool, rng, cands):
    """Devuelve (izquierda, derecha): dos tiras H×E cuyos bordes internos
    casan con los bordes izq./der. de `img`."""
    f = img.astype(np.float32)
    right = quilt_strip(img, f[:, -200:], E, patch, ov, pool, rng, cands)
    right = tone_match(right, f[:, -160:], int(E * 0.65))
    fl = img[:, ::-1]
    left_f = quilt_strip(fl, fl.astype(np.float32)[:, -200:], E, patch, ov, pool, rng, cands)
    left = left_f[:, ::-1]
    left = tone_match(left[:, ::-1], f[:, :160], int(E * 0.65))[:, ::-1]
    return left, right


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--ratio", type=float, default=2.35)
    ap.add_argument("--patch", type=int, default=256)
    ap.add_argument("--overlap", type=int, default=96)
    ap.add_argument("--cands", type=int, default=40)
    ap.add_argument("--excl-top", type=float, default=0.13)
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()

    img = np.asarray(Image.open(a.src).convert("RGB"), dtype=np.uint8)
    H, W = img.shape[:2]
    TW = int(round(H * a.ratio / 2) * 2)
    E = (TW - W) // 2
    print(f"{a.src}: {W}x{H} -> {TW}x{H} (ext {E}px/lado)", flush=True)

    pool = build_pool(img, a.patch, a.excl_top, seed=a.seed)
    rng = np.random.default_rng(a.seed + 1)
    left, right = extend(img, E, a.patch, a.overlap, pool, rng, a.cands)

    f = img.astype(np.float32)
    out = np.zeros((H, TW, 3), dtype=np.float32)
    out[:, E : E + W] = f
    out[:, :E] = left
    out[:, E + W :] = right
    s = min(120, E)
    t = np.linspace(1.0, 0.0, s)[None, :, None]
    out[:, E + W - s : E + W] = f[:, W - s :] * t + right[:, :s] * (1 - t)
    t = np.linspace(0.0, 1.0, s)[None, :, None]
    out[:, E : E + s] = left[:, E - s :] * (1 - t) + f[:, :s] * t

    Image.fromarray(out.astype(np.uint8)).save(a.dst, quality=88)
    print("guardado", a.dst)


if __name__ == "__main__":
    main()
