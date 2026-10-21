"""
Genera las manchas (masks) de islas bloqueadas del submundo con MobileSAM.

Uso:
    python .sam-venv\\Scripts\\python.exe tools/sam-island-masks.py <MUNDO> [<MUNDO> ...]

Para cada isla (posición calibrada del avatar = pies sobre la isla) se pide a
SAM la silueta que contiene el punto + un punto algo más abajo (la roca). Con
la máscara resultante se cubre con discos máximos inscritos (greedy sobre el
distance transform) y se escribe `masks` en avatar-positions.json:

    "masks": { "0": [{"x":..,"y":..,"r":..}, ...], ... }

x,y,r normalizados a la imagen (r = fracción del ANCHO).
"""

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np
import torch

from mobile_sam import SamPredictor, sam_model_registry


WORLDS = ["ESPACIO", "AGUA", "TIERRA", "FUEGO", "HIELO", "VIENTO", "INFRAMUNDO", "MAZMORRA"]


def load_model(checkpoint: str):
    sam = sam_model_registry["vit_t"](checkpoint=checkpoint)
    sam = sam.to(device="cuda" if torch.cuda.is_available() else "cpu")
    return SamPredictor(sam)


def find_map(world_dir: Path) -> Path | None:
    for f in sorted(world_dir.glob("*.16x9.webp")):
        if "ext" not in f.name:
            return f
    return None


IDEAL_AREA = 0.055  # una isla "típica" ocupa ~5% de la imagen


def FALLBACK(px, py, w, h):
    """3 discos apilados: estructura + superficie + roca — cubre islas altas."""
    return [
        {"x": round(px / w, 4), "y": round((py - 0.16 * h) / h, 4), "r": 0.09},
        {"x": round(px / w, 4), "y": round((py - 0.06 * h) / h, 4), "r": 0.115},
        {"x": round(px / w, 4), "y": round((py + 0.05 * h) / h, 4), "r": 0.095},
    ]


def pick_mask(masks, scores, w, h, px, py):
    """Elige la máscara que contiene el punto y cuyo tamaño más se acerca a
    una isla (~5% de imagen). Rechaza cielo/mar y fragmentos diminutos."""
    best, best_cost = None, 1e9
    for m, sc in zip(masks, scores):
        if not m[py, px]:
            continue
        area = m.sum() / (w * h)
        if not (0.008 <= area <= 0.20):
            continue
        ys, xs = np.where(m)
        bw, bh = xs.max() - xs.min(), ys.max() - ys.min()
        if bw < 0.03 * w or bh < 0.03 * h:
            continue
        cost = abs(area - IDEAL_AREA) - sc * 0.01
        if cost < best_cost:
            best, best_cost = m, cost
    return best


def island_box(w, h, px, py):
    """Caja esperada de la isla: el avatar está en la superficie — la isla
    sube ~0.26h por encima de los pies y cuelga ~0.10h por debajo."""
    return (max(0, int(px - 0.15 * w)), max(0, int(py - 0.26 * h)),
            min(w, int(px + 0.15 * w)), min(h, int(py + 0.10 * h)))


def island_mask(predictor, w, h, px, py):
    """Silueta de la isla bajo el punto de pies: point prompts, luego box.
    El resultado se recorta a la caja esperada para no colar mar/cielo."""
    x1, y1, x2, y2 = island_box(w, h, px, py)
    clip = np.zeros((h, w), bool)
    clip[y1:y2, x1:x2] = True
    tries = [
        dict(point_coords=np.array([[px, py], [px, min(h - 1, py + 0.05 * h)]]),
             point_labels=np.array([1, 1])),
        dict(point_coords=np.array([[px, py]]), point_labels=np.array([1])),
    ]
    for kw in tries:
        masks, scores, _ = predictor.predict(multimask_output=True, **kw)
        m = pick_mask(masks, scores, w, h, px, py)
        if m is not None:
            m = m & clip
            if m.sum() / (w * h) >= 0.008:
                return m
            return None
    # Box prompt alrededor de la isla esperada (pies = borde inferior)
    box = np.array([x1, y1, x2, y2])
    masks, scores, _ = predictor.predict(box=box, multimask_output=True)
    m = pick_mask(masks, scores, w, h, px, py)
    return None if m is None else (m & clip)


def cover_discs(mask, w, h, max_discs=4):
    """Discos máximos inscritos (greedy) que cubren ~92% de la silueta.
    Los discos posteriores se descartan si son diminutos (restos)."""
    cur = mask.copy().astype(np.uint8)
    total = int(mask.sum())
    discs = []
    first_maxv = None
    for _ in range(max_discs):
        dt = cv2.distanceTransform(cur, cv2.DIST_L2, 5)
        _, maxv, _, maxloc = cv2.minMaxLoc(dt)
        if maxv < 10:
            break
        cx, cy = maxloc
        if first_maxv is None:
            first_maxv = maxv
        elif maxv < first_maxv * 0.30:
            break  # resto diminuto → no pinta motas sueltas
        else:
            # debe seguir pegado al núcleo: antorchas/puentes/rocas sueltas
            # generan orbes flotantes si el disco sale lejos del principal
            gap = ((cx - discs[0][0]) ** 2 + (cy - discs[0][1]) ** 2) ** 0.5
            if gap > discs[0][2] * 1.35 + maxv:
                break
        # crece para que el borde suave del gradiente cubra, con tope
        r = min(maxv * 1.28, 0.16 * w)
        discs.append((cx, cy, r))
        yy, xx = np.ogrid[:h, :w]
        cur[((xx - cx) ** 2 + (yy - cy) ** 2) <= r * r] = 0
        if cur.sum() < total * 0.08:
            break
    return discs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("worlds", nargs="*", default=WORLDS)
    ap.add_argument("--model", default="models/mobile_sam.pt")
    ap.add_argument("--debug-dir", default=".tmp_chk/island-seg")
    args = ap.parse_args()

    predictor = load_model(args.model)
    dbg = Path(args.debug_dir)
    dbg.mkdir(parents=True, exist_ok=True)

    for world in args.worlds:
        wdir = Path("assets/submundos") / world
        img_path = find_map(wdir)
        pos_path = wdir / "avatar-positions.json"
        if not img_path or not pos_path.exists():
            print(f"[{world}] falta mapa o avatar-positions.json", file=sys.stderr)
            continue
        data = json.loads(pos_path.read_text(encoding="utf-8"))
        positions = data.get("positions") or {}
        image = cv2.imread(str(img_path))
        if image is None:
            print(f"[{world}] no se pudo leer {img_path}", file=sys.stderr)
            continue
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        h, w = image.shape[:2]
        predictor.set_image(image)

        overlay = image.copy()
        masks_out = {}
        for i in range(12):
            pos = positions.get(str(i)) or positions.get(i)
            if not pos:
                continue
            px, py = int(pos["x"] * w), int(pos["y"] * h)
            px = max(0, min(w - 1, px)); py = max(0, min(h - 1, py))
            m = island_mask(predictor, w, h, px, py)
            if m is None:
                print(f"  [{world}] isla {i}: sin máscara SAM → fallback", file=sys.stderr)
                masks_out[str(i)] = FALLBACK(px, py, w, h)
                continue
            # Solo componentes grandes: fragmentos sueltos (cadenas,
            # resplandores, puentes) generaban motas oscuras flotando.
            n, lab, stats, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 8)
            if n > 2:
                big = stats[1:, cv2.CC_STAT_AREA].max()
                keep = np.isin(lab, 1 + np.where(stats[1:, cv2.CC_STAT_AREA] >= big * 0.18)[0])
                m = keep
            discs = cover_discs(m, w, h)
            # SAM encontró solo un fragmento (roca bajo la isla, una torre):
            # el disco principal diminuto no cubre la isla → fallback
            if not discs or discs[0][2] < 0.055 * w:
                print(f"  [{world}] isla {i}: SAM fragmentario → fallback", file=sys.stderr)
                discs = None
            if discs is None:
                masks_out[str(i)] = FALLBACK(px, py, w, h)
                for b in masks_out[str(i)]:
                    cv2.circle(overlay, (int(b["x"] * w), int(b["y"] * h)),
                               int(b["r"] * w), (255, 0, 255), 2)
                continue
            masks_out[str(i)] = [
                {"x": round(cx / w, 4), "y": round(cy / h, 4), "r": round(r / w, 4)}
                for (cx, cy, r) in discs
            ]
            color = (0, 255, 0) if i == 0 else (255, 128, 0)
            overlay[m] = (overlay[m] * 0.45 + np.array(color) * 0.55).astype(np.uint8)
            for (cx, cy, r) in discs:
                cv2.circle(overlay, (int(cx), int(cy)), int(r), (0, 0, 255), 3)
            print(f"  [{world}] isla {i}: {len(discs)} discos, área {m.sum() / (w * h):.3f}")

        if masks_out:
            data["masks"] = masks_out
            pos_path.write_text(
                json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
            )
            print(f"[{world}] masks escritas ({len(masks_out)} islas)")
        cv2.imwrite(str(dbg / f"seg-{world}.png"), cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))


if __name__ == "__main__":
    main()
