"""
Detector de tableros con MobileSAM usando box prompts.

Uso:
    python .sam-venv\Scripts\python.exe background/sam-detect.py \
        <input_image> <world> <output_json>

Prueba una rejilla de cajas candidatas en el centro de la imagen,
pasa cada una como box prompt a SAM, y elige la máscara que mejor
encaje un tablero de 6×5.
"""

import argparse
import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np
import torch

from mobile_sam import SamPredictor, sam_model_registry


def load_model(checkpoint: str):
    model_type = "vit_t"
    sam = sam_model_registry[model_type](checkpoint=checkpoint)
    sam = sam.to(device="cuda" if torch.cuda.is_available() else "cpu")
    return SamPredictor(sam)


def mask_rectangularity(mask: np.ndarray) -> float:
    """Devuelve 1 si la máscara es un rectángulo perfecto, menor si es irregular."""
    ys, xs = np.where(mask)
    if len(xs) < 10:
        return 0
    x1, x2 = xs.min(), xs.max()
    y1, y2 = ys.min(), ys.max()
    bbox_area = (x2 - x1) * (y2 - y1)
    mask_area = mask.sum()
    if bbox_area == 0:
        return 0
    return float(mask_area / bbox_area)


def grid_score(image: np.ndarray, mask: np.ndarray, cols: int, rows: int) -> float:
    """Comprueba qué tan fuerte es el patrón de grid 6×5 dentro de la máscara."""
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return 0
    x1, x2 = int(xs.min()), int(xs.max())
    y1, y2 = int(ys.min()), int(ys.max())
    bw = x2 - x1
    bh = y2 - y1
    if bw < 40 or bh < 40:
        return 0

    # Recortar interior
    crop = image[y1:y2, x1:x2]
    if crop.size == 0:
        return 0
    gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)

    # Buscar bordes internos con Sobel
    sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    mag = np.sqrt(sobelx**2 + sobely**2)

    cell_w = bw / cols
    cell_h = bh / rows
    if cell_w < 4 or cell_h < 4:
        return 0

    score = 0.0
    # Líneas verticales internas
    for c in range(1, cols):
        x = round(c * cell_w)
        x = max(0, min(x, mag.shape[1] - 1))
        score += mag[:, x].mean()
    # Líneas horizontales internas
    for r in range(1, rows):
        y = round(r * cell_h)
        y = max(0, min(y, mag.shape[0] - 1))
        score += mag[y, :].mean()

    return float(score)


def generate_boxes(w: int, h: int, cols: int = 6, rows: int = 6):
    """Genera cajas candidatas centradas con diferentes tamaños."""
    boxes = []
    for height_pct in [0.45, 0.5, 0.55, 0.6, 0.65, 0.7]:
        for width_pct in [0.35, 0.4, 0.45, 0.5, 0.55]:
            for y_off in [-0.05, 0, 0.05]:
                for x_off in [-0.05, 0, 0.05]:
                    bh = int(h * height_pct)
                    bw = int(bh * cols / rows)
                    if bw > w or bh > h:
                        continue
                    cx = w / 2 + w * x_off
                    cy = h / 2 + h * y_off
                    x1 = int(cx - bw / 2)
                    y1 = int(cy - bh / 2)
                    x2 = x1 + bw
                    y2 = y1 + bh
                    x1 = max(0, min(x1, w - 1))
                    y1 = max(0, min(y1, h - 1))
                    x2 = min(w, x2)
                    y2 = min(h, y2)
                    boxes.append((x1, y1, x2, y2))
    return boxes


def best_board_mask(predictor, image: np.ndarray, cols: int, rows: int):
    h, w = image.shape[:2]
    predictor.set_image(image)

    boxes = generate_boxes(w, h, cols, rows)
    print(f"Probando {len(boxes)} cajas candidatas...", file=sys.stderr)

    best = None
    for (x1, y1, x2, y2) in boxes:
        box = np.array([[x1, y1, x2, y2]])
        masks, _, _ = predictor.predict(
            box=box,
            multimask_output=True,
        )
        for mask in masks:
            ys, xs = np.where(mask)
            if len(xs) == 0:
                continue
            mx1, mx2 = int(xs.min()), int(xs.max())
            my1, my2 = int(ys.min()), int(ys.max())
            mw = mx2 - mx1
            mh = my2 - my1
            if mw < 40 or mh < 40:
                continue

            ar = mw / mh if mh > 0 else 0
            ar_score = max(0, 1 - abs(ar - cols / rows))
            rect = mask_rectangularity(mask)
            grid = grid_score(image, mask, cols, rows)

            # Puntuación combinada
            score = (
                ar_score * 1000 +
                rect * 1000 +
                grid * 10
            )

            if best is None or score > best["score"]:
                best = {
                    "x1": mx1,
                    "y1": my1,
                    "x2": mx2,
                    "y2": my2,
                    "bw": mw,
                    "bh": mh,
                    "score": score,
                    "ar_score": ar_score,
                    "rect": rect,
                    "grid": grid,
                }

    return best


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("image", help="Ruta de la imagen de fondo")
    parser.add_argument("world", help="Nombre del mundo")
    parser.add_argument("output", help="Ruta del JSON de salida")
    parser.add_argument("--model", default="models/mobile_sam.pt", help="Checkpoint de MobileSAM")
    parser.add_argument("--cols", type=int, default=6, help="Columnas del tablero")
    parser.add_argument("--rows", type=int, default=5, help="Filas del tablero")
    args = parser.parse_args()

    if not Path(args.model).exists():
        print(f"Modelo no encontrado: {args.model}", file=sys.stderr)
        sys.exit(1)

    image = cv2.imread(args.image)
    if image is None:
        print(f"No se pudo cargar la imagen: {args.image}", file=sys.stderr)
        sys.exit(1)
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    print(f"[{args.world}] Cargando MobileSAM...", file=sys.stderr)
    predictor = load_model(args.model)

    print(f"[{args.world}] Segmentando tablero...", file=sys.stderr)
    best = best_board_mask(predictor, image, args.cols, args.rows)

    if best is None:
        print("No se encontró un tablero", file=sys.stderr)
        sys.exit(1)

    h, w = image.shape[:2]
    board_area = {
        "x": best["x1"] / w,
        "y": best["y1"] / h,
        "width": best["bw"] / w,
        "height": best["bh"] / h,
    }
    cell_w = best["bw"] / args.cols
    cell_h = best["bh"] / args.rows

    result = {
        "world": args.world,
        "image": args.image,
        "width": w,
        "height": h,
        "boardArea": board_area,
        "boardSize": [args.cols, args.rows],
        "cellSize": (cell_w + cell_h) / 2,
        "arScore": best["ar_score"],
        "rectangularity": best["rect"],
        "gridScore": best["grid"],
        "totalScore": best["score"],
    }

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    print(json.dumps(result))


if __name__ == "__main__":
    main()
