"""Builds wide subworld art with the historical content-aware squeeze + quilt."""

import argparse
import glob
import os
import subprocess

import cv2
import numpy as np
from PIL import Image

PYTHON = os.path.join(".sam-venv", "Scripts", "python.exe")
OUTPUT_HEIGHT = 4320
RATIO = 2.35


def squeeze_rows(image, height=OUTPUT_HEIGHT, protect_top=0.15):
    pixels = image.astype(np.float32)
    original_height = pixels.shape[0]
    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY).astype(np.float32)
    edges = cv2.Sobel(gray, cv2.CV_32F, 1, 0) ** 2
    edges += cv2.Sobel(gray, cv2.CV_32F, 0, 1) ** 2
    threshold = np.percentile(edges, 90)
    importance = np.clip((edges > threshold).mean(axis=1) * 10.0, 0, 1)
    importance[: int(original_height * protect_top)] = 1.0
    importance = cv2.GaussianBlur(importance.reshape(-1, 1), (0, 0), 40).ravel()
    importance = np.clip(importance, 0, 1)

    scale = 1 - (1 - 0.42) * (1 - importance)
    for _ in range(4):
        scale *= height / scale.sum()
        scale = np.clip(scale, 0.42, 1.0)
    scale *= height / scale.sum()

    row_map = np.cumsum(scale)
    target_rows = np.arange(height) + 0.5
    source_rows = np.clip(np.searchsorted(row_map, target_rows) - 1, 0, original_height - 1)
    previous = np.concatenate([[0.0], row_map[:-1]])
    fraction = np.clip(
        (target_rows - previous[source_rows]) / np.maximum(scale[source_rows], 1e-6),
        0,
        1,
    )[:, None, None]
    next_rows = np.minimum(source_rows + 1, original_height - 1)
    squeezed = pixels[source_rows] * (1 - fraction) + pixels[next_rows] * fraction
    return squeezed.astype(np.uint8), row_map


def build(source, destination):
    image = np.asarray(Image.open(source).convert("RGB"), dtype=np.uint8)
    squeezed, row_map = squeeze_rows(image)
    temporary = destination + ".squeezed.tmp.webp"
    Image.fromarray(squeezed).save(temporary, quality=92)
    try:
        result = subprocess.run(
            [
                PYTHON,
                "tools/quilt_extend.py",
                temporary,
                destination,
                "--ratio",
                str(RATIO),
                "--excl-top",
                "0.18",
            ],
            check=False,
            text=True,
            capture_output=True,
        )
        if result.returncode:
            raise RuntimeError(result.stderr or result.stdout)
        print(result.stdout.strip(), flush=True)
    finally:
        if os.path.exists(temporary):
            os.remove(temporary)

    os.makedirs(".tmp_chk", exist_ok=True)
    np.save(os.path.join(".tmp_chk", "sqpos-" + os.path.basename(destination) + ".npy"), row_map)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("world", nargs="?")
    parser.add_argument("--batch", action="store_true")
    args = parser.parse_args()

    if args.batch:
        sources = sorted(glob.glob("assets/submundos/*/old/submundo*.webp"))
    elif args.world:
        sources = sorted(glob.glob(f"assets/submundos/{args.world}/old/submundo*.webp"))
    else:
        parser.error("provide a world name or --batch")

    if not sources:
        parser.error("no original subworld masters found")
    for source in sources:
        name = os.path.basename(source).replace(".webp", ".ext.webp")
        destination = os.path.join(os.path.dirname(os.path.dirname(source)), name)
        print(f">>> {source}", flush=True)
        build(source, destination)


if __name__ == "__main__":
    main()
