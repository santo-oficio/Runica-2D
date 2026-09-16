"""Detecta el tablero 8x6 de los 8 mundos con MobileSAM (una sola carga de modelo)."""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
import torch

from mobile_sam import SamPredictor, sam_model_registry

WORLDS = ["ESPACIO", "AGUA", "TIERRA", "FUEGO", "HIELO", "VIENTO", "INFRAMUNDO", "MAZMORRA"]
COLS = 8
ROWS = 6


def load_model(checkpoint: str):
    sam = sam_model_registry["vit_t"](checkpoint=checkpoint)
    sam = sam.to(device="cuda" if torch.cuda.is_available() else "cpu")
    return SamPredictor(sam)


def mask_rectangularity(mask: np.ndarray) -> float:
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


def grid_score(image: np.ndarray, mask: np.ndarray) -> float:
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return 0
    x1, x2 = int(xs.min()), int(xs.max())
    y1, y2 = int(ys.min()), int(ys.max())
    bw = x2 - x1
    bh = y2 - y1
    if bw < 40 or bh < 40:
        return 0
    crop = image[y1:y2, x1:x2]
    if crop.size == 0:
        return 0
    gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
    sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    mag = np.sqrt(sobelx**2 + sobely**2)
    cell_w = bw / COLS
    cell_h = bh / ROWS
    score = 0.0
    for c in range(1, COLS):
        x = max(0, min(round(c * cell_w), mag.shape[1] - 1))
        score += mag[:, x].mean()
    for r in range(1, ROWS):
        y = max(0, min(round(r * cell_h), mag.shape[0] - 1))
        score += mag[y, :].mean()
    return float(score)


def generate_boxes(w: int, h: int):
    boxes = []
    for height_pct in [0.45, 0.5, 0.55, 0.6, 0.65, 0.7]:
        for width_pct in [0.4, 0.45, 0.5, 0.55, 0.6]:
            for y_off in [-0.05, 0, 0.05]:
                for x_off in [-0.05, 0, 0.05]:
                    bh = int(h * height_pct)
                    bw = int(bh * COLS / ROWS)
                    if bw > w or bh > h:
                        continue
                    cx = w / 2 + w * x_off
                    cy = h / 2 + h * y_off
                    x1 = max(0, min(int(cx - bw / 2), w - 1))
                    y1 = max(0, min(int(cy - bh / 2), h - 1))
                    x2 = min(w, x1 + bw)
                    y2 = min(h, y1 + bh)
                    boxes.append((x1, y1, x2, y2))
    return boxes


def detect(predictor, image, world):
    h, w = image.shape[:2]
    predictor.set_image(image)
    boxes = generate_boxes(w, h)
    best = None
    for (x1, y1, x2, y2) in boxes:
        box = np.array([[x1, y1, x2, y2]])
        masks, _, _ = predictor.predict(box=box, multimask_output=True)
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
            ar_score = max(0, 1 - abs(ar - COLS / ROWS))
            rect = mask_rectangularity(mask)
            grid = grid_score(image, mask)
            score = ar_score * 1000 + rect * 1000 + grid * 10
            if best is None or score > best["score"]:
                best = {
                    "x1": mx1, "y1": my1, "x2": mx2, "y2": my2,
                    "bw": mw, "bh": mh, "score": score,
                    "ar_score": ar_score, "rect": rect, "grid": grid,
                }
    if best is None:
        print(f"[{world}] no encontrado", file=sys.stderr)
        return None
    board_area = {
        "x": best["x1"] / w,
        "y": best["y1"] / h,
        "width": best["bw"] / w,
        "height": best["bh"] / h,
    }
    cell_w = best["bw"] / COLS
    cell_h = best["bh"] / ROWS
    result = {
        "world": world,
        "image": f"assets/backgrounds/{world}/bg_01.png",
        "width": w,
        "height": h,
        "boardArea": board_area,
        "boardSize": [COLS, ROWS],
        "cellSize": (cell_w + cell_h) / 2,
        "arScore": best["ar_score"],
        "rectangularity": best["rect"],
        "gridScore": best["grid"],
        "totalScore": best["score"],
    }
    out = Path(f"assets/backgrounds/{world}/board-detection.json")
    out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result))
    return result


def main():
    predictor = load_model("models/mobile_sam.pt")
    for world in WORLDS:
        img_path = f"assets/backgrounds/{world}/bg_01.png"
        image = cv2.imread(img_path)
        if image is None:
            print(f"[{world}] no se pudo cargar {img_path}", file=sys.stderr)
            continue
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        print(f"[{world}] segmentando...", file=sys.stderr)
        detect(predictor, image, world)


if __name__ == "__main__":
    main()
