# Extiende un submundo 3:2 a lienzo panoramico 2.35:1 (12032x5120) creando
# "un continuo" — contenido nuevo que parece parte del arte:
#   * cielo: tesela un parche de nubes limpio del propio mundo con espejos
#     alternos + solapado difuminado (las nubes blandas no se reconocen como
#     repeticion), re-coloreado por fila para seguir el gradiente vertical.
#   * sharditos: rocas/islas lejanas reales recortadas por silueta y sembradas
#     en la extension con escala, volteo y bruma atmosferica.
#   * grano sutil + atenuacion hacia el rim + crossfade al nucleo.
#
# Config por mundo en tools/sub-ext.json:
#   { "FUEGO": { "patch":[x0,y0,x1,y1], "shards":[[x0,y0,x1,y1],...],
#                "seed":N } }
#
# Uso: python tools/sub_extend.py MUNDO [--apply]  (sin --apply: solo preview)
import sys, json, pathlib
import numpy as np
import cv2
from PIL import Image

W, H, EXT = 7680, 5120, 2176          # core 3:2 + extension 2.35:1
OUT_W = W + EXT * 2                   # 12032

world = sys.argv[1]
apply = "--apply" in sys.argv
cfg = json.load(open("tools/sub-ext.json", encoding="utf-8"))[world]
base = cfg.get("src")
src_path = next(p for p in pathlib.Path(f"assets/submundos/{world}/old").glob("submundo*.webp")
                if base is None or base in p.name)
im = np.array(Image.open(src_path).convert("RGB")).astype(np.float32)
assert im.shape[0] == H and im.shape[1] == W, (im.shape, src_path)
rng = np.random.default_rng(cfg.get("seed", 7))

gray = cv2.cvtColor(im.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
ee = np.abs(cv2.Sobel(gray, cv2.CV_32F, 1, 0)) + np.abs(cv2.Sobel(gray, cv2.CV_32F, 0, 1))

# ---------- 1. canvas de cielo: tesela espejo del parche ----------
px0, py0, px1, py1 = [int(v * W if i % 2 == 0 else v * H) for i, v in enumerate(cfg["patch"])]
patch = im[py0:py1, px0:px1]
# patch_clean: mediana fuerte borra objetos pequenos del parche (rocas,
# barcos lejanos, escaleras) dejando solo la textura de fondo.
if cfg.get("patch_clean", True):
    kc = int(min(patch.shape[0], patch.shape[1]) * 0.14) | 1
    patch = cv2.medianBlur(np.clip(patch, 0, 255).astype(np.uint8), kc).astype(np.float32)
ph, pw = patch.shape[:2]

def tile_patch(pw_, ph_, ow, oh):
    """Tesela el parche en (oh x ow) con espejos alternos, solapado ~45%
    y jitter por tile para romper la alineacion horizontal."""
    can = np.zeros((oh, ow, 3), np.float32)
    wgt = np.zeros((oh, ow), np.float32)
    stepx, stepy = int(pw_ * 0.55), int(ph_ * 0.55)
    j = 0
    for y0 in range(-ph_, oh + ph_, stepy):
        i = 0
        for x0 in range(-pw_, ow + pw_, stepx):
            jx = int(rng.integers(-stepx // 4, stepx // 4))
            jy = int(rng.integers(-stepy // 4, stepy // 4))
            x, y = x0 + jx, y0 + jy
            t = patch
            if i % 2: t = t[:, ::-1]
            if j % 2: t = t[::-1]
            ya, xa = max(0, y), max(0, x)
            yb, xb = min(oh, y + ph_), min(ow, x + pw_)
            if yb <= ya or xb <= xa:
                i += 1; continue
            ty0, tx0 = ya - y, xa - x
            th, tw = yb - ya, xb - xa
            wrow = np.interp(np.arange(th), [0, th * .4, th * .6, th - 1], [0, 1, 1, 0])
            wcol = np.interp(np.arange(tw), [0, tw * .4, tw * .6, tw - 1], [0, 1, 1, 0])
            wm = np.outer(wrow, wcol)
            can[ya:yb, xa:xb] += t[ty0:ty0 + th, tx0:tx0 + tw] * wm[:, :, None]
            wgt[ya:yb, xa:xb] += wm
            i += 1
        j += 1
    out = can / np.maximum(wgt, 1e-3)[:, :, None]
    # nubes blandas: un blur suave funde las costuras que queden
    return cv2.GaussianBlur(out, (0, 0), 9)

sky = tile_patch(pw, ph, EXT, H)

# ---------- 2. re-color por fila segun el cielo local del nucleo ----------
def row_sky(cols):
    strip = im[:, cols]
    strip_e = ee[:, cols]
    clean = strip_e < 16
    m = np.where(clean[:, :, None], strip, np.nan)
    s = np.nanmedian(m, axis=1)
    bad = np.isnan(s[:, 0]); ok = np.where(~bad)[0]
    for c in range(3):
        s[bad, c] = np.interp(np.where(bad)[0], ok, s[ok, c])
    return s

tgt_l = row_sky(slice(150, 620)); tgt_r = row_sky(slice(W - 620, W - 150))
# Descomposicion por frecuencias: el cielo de la extension = color real por
# fila del nucleo (baja frecuencia) + detalle de nubes del canvas teselado
# (alta frecuencia). Sin esto, el re-color por fila dejaba bandas.
sky_lf = cv2.GaussianBlur(sky, (0, 0), 150)
sky_hf = sky - sky_lf
# Modo flat (fondos casi lisos: oceano, cielo azul, niebla): base por fila +
# ondulacion de baja frecuencia para que no quede muerto.
lown = cv2.GaussianBlur(rng.normal(0, 1, (H, EXT)).astype(np.float32), (0, 0), 60)[:, :, None]
for s, tgt in [(0, tgt_l), (1, tgt_r)]:
    base = cv2.GaussianBlur(tgt.reshape(H, 1, 3), (1, 501), 0)
    if cfg.get("flat"):
        cv_ = np.repeat(base, EXT, axis=1) + lown * float(cfg.get("flat", 8))
    else:
        cv_ = np.repeat(base, EXT, axis=1) + sky_hf * 1.25
    if s == 0: sky_l = cv_
    else:      sky_r = cv_

# ---------- 2b. bandas estructurales (cordillera, etc.) ----------
# Tesela horizontal de una franja real del mundo dentro de su rango y,
# con feather vertical hacia el cielo.
def tile_row(p, ow, seedoff=0):
    r2 = np.random.default_rng(100 + seedoff)
    ph2, pw2 = p.shape[:2]
    can = np.zeros((ph2, ow, 3), np.float32)
    wgt = np.zeros((ph2, ow), np.float32)
    stepx = int(pw2 * 0.55)
    i = 0
    for x0 in range(-pw2, ow + pw2, stepx):
        x = x0 + int(r2.integers(-stepx // 4, stepx // 4))
        t = p if i % 2 == 0 else p[:, ::-1]
        xa, xb = max(0, x), min(ow, x + pw2)
        if xb <= xa:
            i += 1; continue
        tx0, tw = xa - x, xb - xa
        wcol = np.interp(np.arange(tw), [0, tw * .4, tw * .6, tw - 1], [0, 1, 1, 0])
        can[:, xa:xb] += t[:, tx0:tx0 + tw] * wcol[None, :, None]
        wgt[:, xa:xb] += wcol[None, :]
        i += 1
    return can / np.maximum(wgt, 1e-3)[:, :, None]

for bi, band in enumerate(cfg.get("bands", [])):
    by0, by1 = int(band["y0"] * H), int(band["y1"] * H)
    bx = [int(v * W if i % 2 == 0 else v * H) for i, v in enumerate(band["patch"])]
    bp = cv2.resize(im[bx[1]:bx[3], bx[0]:bx[2]], (bx[2] - bx[0], by1 - by0))
    for sd, cv_ in [(0, sky_l), (1, sky_r)]:
        t = tile_row(bp, EXT, seedoff=bi * 10 + sd)
        fh = min(180, (by1 - by0) // 3)
        al = np.ones((by1 - by0, 1))
        if by0 > 0: al[:fh, 0] = np.linspace(0, 1, fh)
        if by1 < H: al[-fh:, 0] = np.linspace(1, 0, fh)
        cv_[by0:by1] = cv_[by0:by1] * (1 - al[:, None, :]) + t * al[:, None, :]

# Continuo en el limite del nucleo: espejo difuminado de los ~150px del
# borde (irreconocible por el blur, pero continua color y textura)
K = 150
edge_l = cv2.GaussianBlur(im[:, :K][:, ::-1], (0, 0), 14)
edge_r = cv2.GaussianBlur(im[:, W - K:][:, ::-1], (0, 0), 14)
ew = np.linspace(0, 1, K)[None, :, None]            # 1 pegado al nucleo
sky_l[:, -K:] = sky_l[:, -K:] * (1 - ew) + edge_l * ew
sky_r[:, :K] = sky_r[:, :K] * (1 - ew[::-1]) + edge_r * ew[::-1]

# ---------- 3. sharditos: recorte por silueta + siembra ----------
def cut_shard(box):
    x0, y0, x1, y1 = [int(v * W if i % 2 == 0 else v * H) for i, v in enumerate(box)]
    c = im[y0:y1, x0:x1]
    ch, cw = c.shape[:2]
    border = np.concatenate([c[0].reshape(-1, 3), c[-1].reshape(-1, 3),
                             c[:, 0].reshape(-1, 3), c[:, -1].reshape(-1, 3)])
    skyc = np.median(border, axis=0)
    dev = np.abs(c - skyc).sum(2)
    a = (dev > 70).astype(np.uint8) * 255
    a = cv2.morphologyEx(a, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(a, 8)
    if n > 1:  # quedarse con el mayor componente
        i = 1 + int(np.argmax(st[1:, 4]))
        a = np.where(lab == i, 255, 0).astype(np.uint8)
    a = cv2.GaussianBlur(a.astype(np.float32) / 255, (0, 0), 6)
    # color del cielo local para fundir el halo
    return c, a, skyc

shards = [cut_shard(b) for b in cfg.get("shards", [])]

def place(dst, shard, cx, cy, scale, flip, fade, skyc):
    c, a, _ = shard
    ch, cw = c.shape[:2]
    nw, nh = int(cw * scale), int(ch * scale)
    c2 = cv2.resize(c, (nw, nh), interpolation=cv2.INTER_AREA)
    a2 = cv2.resize(a, (nw, nh), interpolation=cv2.INTER_AREA)
    if flip: c2, a2 = c2[:, ::-1], a2[:, ::-1]
    # bruma: fundir el shard hacia el color de cielo de su caja origen
    c2 = c2 * (1 - fade) + skyc[None, None, :] * fade
    x0, y0 = int(cx - nw / 2), int(cy - nh / 2)
    xa, ya = max(0, x0), max(0, y0)
    xb, yb = min(EXT, x0 + nw), min(H, y0 + nh)
    if xb <= xa or yb <= ya: return
    tx0, ty0 = xa - x0, ya - y0
    aa = a2[ty0:ty0 + yb - ya, tx0:tx0 + xb - xa][:, :, None]
    dst[ya:yb, xa:xb] = dst[ya:yb, xa:xb] * (1 - aa) + c2[ty0:ty0 + yb - ya, tx0:tx0 + xb - xa] * aa

for sd, cv_ in [(0, sky_l), (1, sky_r)]:
    n_spots = int(cfg.get("n_shards", 3))
    for k in range(n_spots):
        s = shards[int(rng.integers(0, len(shards)))] if shards else None
        if s is None: break
        cx = rng.uniform(0.15, 0.9) * EXT
        cy = rng.uniform(0.08, 0.8) * H
        # evitar caer justo en el limite del nucleo (los primeros ~250px)
        if sd == 0: cx = min(cx, EXT - 260 - rng.uniform(0, 0.3) * EXT)
        else:       cx = max(cx, 260 + rng.uniform(0, 0.3) * EXT)
        place(cv_, s, cx, cy, rng.uniform(0.8, 1.5), rng.random() < .5,
              rng.uniform(0.0, 0.15), s[2])

# ---------- 4. grano + rim + ensamblado ----------
out = np.zeros((H, OUT_W, 3), np.float32)
out[:, EXT:EXT + W] = im
for sd, cv_ in [(0, sky_l), (1, sky_r)]:
    dist = np.linspace(1, 0, EXT) if sd == 0 else np.linspace(0, 1, EXT)
    cv_ *= (1 - (1 - dist) * 0.16)[None, :, None]
    cv_ += rng.normal(0, 2.0, (H, EXT, 3)).astype(np.float32)
    x0 = 0 if sd == 0 else EXT + W
    out[:, x0:x0 + EXT] = cv_

res = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
res.crop((0, 0, EXT + 700, H)).resize((280, 760)).save(f".tmp_chk/ext-{world}-L.png")
res.crop((OUT_W - EXT - 700, 0, OUT_W, H)).resize((280, 760)).save(f".tmp_chk/ext-{world}-R.png")
res.resize((1400, int(1400 * H / OUT_W))).save(f".tmp_chk/ext-{world}-full.png")
dst = src_path.parent.parent / (src_path.stem + ".ext.webp")
if apply:
    res.save(dst, "WEBP", quality=93, method=6)
    print("applied ->", dst)
else:
    print("preview ->", f".tmp_chk/ext-{world}-*.png")
