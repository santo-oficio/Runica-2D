# Extiende una imagen por los laterales sintetizando fondo con "quilting"
# (Efros-Freeman): parches del propio arte elegidos por bordes que casan y
# costuras por el camino de error mínimo (min-cut) — los parches quedan
# nítidos, sin desenfoque por mezcla alfa. El original queda intacto salvo
# una franja fina de costura errante junto a cada borde.
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


def mincut_v(err):
    """Costura vertical (camino de arriba abajo) de error mínimo sobre una
    superficie err (h×w). Devuelve la columna de corte por fila."""
    h, w = err.shape
    cost = err.copy()
    for i in range(1, h):
        prev = cost[i - 1]
        cost[i] += np.minimum(prev, np.minimum(np.roll(prev, 1), np.roll(prev, -1)))
    seam = np.zeros(h, dtype=np.int64)
    seam[-1] = int(np.argmin(cost[-1]))
    for i in range(h - 2, -1, -1):
        j = seam[i + 1]
        lo, hi = max(0, j - 1), min(w, j + 2)
        seam[i] = lo + int(np.argmin(cost[i, lo:hi]))
    return seam


def quilt_strip(img, edge, E, patch, ov, pool, rng, cands):
    """Sintetiza una tira H×E cuyo lado izquierdo casa con `edge` (banda
    H×~200 del borde real). Las uniones internas se cortan por el camino
    de error mínimo — sin desenfoque."""
    H = img.shape[0]
    step = patch - ov
    f = img.astype(np.float32)
    out = np.zeros((H, E, 3), dtype=np.float32)

    for y in range(0, H, step):
        ph = min(patch, H - y)
        for x in range(0, E, step):
            pw = min(patch, E - x)
            kw = min(ov, E - x)
            left_nb = edge[y : y + ph, -kw:] if x == 0 else out[y : y + ph, x : x + kw]
            top_nb = out[y - ov : y, x : x + pw] if y > 0 else None

            best, best_e = None, 1e18
            for _ in range(cands):
                py, px = pool[rng.integers(len(pool))]
                e = np.abs(f[py : py + ph, px : px + kw] - left_nb).mean()
                if top_nb is not None:
                    e += np.abs(f[py : py + ov, px : px + pw] - top_nb).mean()
                if e < best_e:
                    best_e, best = e, (py, px)
            py, px = best
            p = f[py : py + ph, px : px + pw]

            if x == 0 and y == 0:
                out[y : y + ph, x : x + pw] = p
                continue

            mask = np.zeros((ph, pw), dtype=bool)
            # Costura izquierda: corta dentro del solape [x, x+ov)
            if x > 0:
                err = ((p[:, :kw] - out[y : y + ph, x : x + kw]) ** 2).sum(axis=2)
                seam = mincut_v(err)
                for i in range(ph):
                    mask[i, seam[i] :] = True
            else:
                mask[:] = True  # x==0: pega directo, la costura va en el ensamblado
            # Costura superior: corta dentro del solape [y, y+ov)
            if y > 0:
                k = min(ov, ph)
                err = ((p[:k, :] - out[y : y + k, x : x + pw]) ** 2).sum(axis=2)
                seam = mincut_v(err.T)
                top_mask = np.zeros((k, pw), dtype=bool)
                for j in range(pw):
                    top_mask[seam[j] :, j] = True
                mask[:k] &= top_mask
            out[y : y + ph, x : x + pw] = np.where(
                mask[..., None], p, out[y : y + ph, x : x + pw]
            )
    return out


def tone_match(ext, edge, fade_px):
    """Rebase de baja frecuencia: la tira conserva su alta frecuencia (textura,
    estrellas — nítida) pero su degradado pasa a ser la continuación suave del
    borde real. Cerca de la costura el tono es el del borde; a lo lejos
    sobrevive la variación propia de la síntesis."""
    sigma = max(40, fade_px // 4)
    low = cv2.GaussianBlur(ext, (0, 0), sigma)          # H×E×3 baja frecuencia
    mu = cv2.GaussianBlur(edge, (0, 0), sigma).mean(axis=1)  # H×3 por fila
    t = np.clip(np.arange(ext.shape[1]) / max(fade_px, 1), 0, 1)[None, :, None]
    low_target = (1 - t) * mu[:, None, :] + t * low
    return np.clip(ext - low + low_target, 0, 255)


def extend(img, E, patch, ov, pool, rng, cands):
    """Devuelve (izquierda, derecha): tiras H×(E+2·ov) que solapan `ov` con
    el borde real para cortar la costura por min-cut en el ensamblado."""
    f = img.astype(np.float32)
    W = img.shape[1]
    right = quilt_strip(img, f[:, -200:], E + 2 * ov, patch, ov, pool, rng, cands)
    right = tone_match(right, f[:, -160:], int(E * 0.65))
    fl = img[:, ::-1]
    left_f = quilt_strip(fl, fl.astype(np.float32)[:, -200:], E + 2 * ov, patch, ov, pool, rng, cands)
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
    ov = a.overlap
    print(f"{a.src}: {W}x{H} -> {TW}x{H} (ext {E}px/lado)", flush=True)

    pool = build_pool(img, a.patch, a.excl_top, seed=a.seed)
    rng = np.random.default_rng(a.seed + 1)
    left, right = extend(img, E, a.patch, a.overlap, pool, rng, a.cands)

    f = img.astype(np.float32)
    out = np.zeros((H, TW, 3), dtype=np.float32)
    out[:, E : E + W] = f

    # Costura derecha: la tira se pega en x0=E+W-2ov y solapa 2ov con el
    # original; el min-cut recorre ese solape (a la izquierda el original,
    # a la derecha la tira).
    x0 = E + W - 2 * ov
    out[:, x0 : x0 + right.shape[1]] = right
    err = ((right[:, : 2 * ov] - f[:, W - 2 * ov :]) ** 2).sum(axis=2)
    seam = mincut_v(err)
    for i in range(H):
        c = x0 + seam[i]
        out[i, x0:c] = f[i, W - 2 * ov : W - 2 * ov + seam[i]]
        out[i, c:] = right[i, seam[i] :]
    # Costura izquierda: la tira ocupa [0, E+2ov) solapando sus últimas 2ov
    # con las primeras del original; el min-cut recorre ese solape.
    out[:, : E + 2 * ov] = left
    err = ((left[:, E : E + 2 * ov] - f[:, : 2 * ov]) ** 2).sum(axis=2)
    seam = mincut_v(err)
    for i in range(H):
        c = E + seam[i]
        out[i, c : E + 2 * ov] = f[i, seam[i] : 2 * ov]

    Image.fromarray(out.astype(np.uint8)).save(a.dst, quality=88)
    print("guardado", a.dst)


if __name__ == "__main__":
    main()
