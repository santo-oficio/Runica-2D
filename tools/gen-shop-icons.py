# Iconos de tienda con SD 1.5 (text2img via inpainting, fondo blanco +
# chroma-key flood-fill — mismo pipeline que shop_gen.py).
#   .sam-venv\Scripts\python.exe tools\gen-shop-icons.py [item...] [--seed N]
import sys
from pathlib import Path
import numpy as np
import cv2
from PIL import Image
import torch

sys.path.insert(0, str(Path(__file__).parent))
from shop_gen import pipe, chroma_key  # noqa: E402

STYLE = ("single object centered on plain solid white background, "
         "low poly 3d style, flat shaded faceted geometry, bold angular "
         "shapes, cartoon game item icon, video game asset")
NEG = ("text, watermark, signature, blurry, distorted, ugly, low quality, "
       "photorealistic, photo, people, hands, crowd, ui, interface, "
       "frame, border, card, ornate frame, pattern, background details, "
       "skull, face, particles, sparkles")

ITEMS = {
    "pista": "antique brass compass, glowing golden needle, " + STYLE,
    "deshacer": "golden hourglass, sand timer with glowing blue sand, " + STYLE,
    "midas": "golden king crown with red gems, " + STYLE,
}


def largest_cc(img):
    """Deja solo el objeto mayor del alpha (quita motas sueltas)."""
    a = np.asarray(img).copy()
    n, lbl = cv2.connectedComponents((a[..., 3] > 32).astype(np.uint8))
    if n <= 2:
        return img
    sizes = [(lbl == i).sum() for i in range(1, n)]
    keep = 1 + int(np.argmax(sizes))
    a[..., 3] = np.where(lbl == keep, a[..., 3], 0)
    return Image.fromarray(a, "RGBA")


def gen(item_id, seed=31):
    out_dir = Path("assets/tienda/iconos")
    (out_dir / "old").mkdir(parents=True, exist_ok=True)
    p = pipe()
    dummy = Image.new("RGB", (512, 512), (255, 255, 255))
    mask = Image.new("L", (512, 512), 255)
    img = p(prompt=ITEMS[item_id], negative_prompt=NEG,
            image=dummy, mask_image=mask,
            num_inference_steps=28, guidance_scale=7.5,
            generator=torch.Generator("cuda").manual_seed(seed),
            width=512, height=512).images[0]
    img.save(out_dir / "old" / f"{item_id}-src.png")
    img = largest_cc(chroma_key(img))
    img.save(out_dir / f"{item_id}.webp", "WEBP", quality=92, method=6)
    print("icon", item_id, "->", img.size)


if __name__ == "__main__":
    seed = 31
    if "--seed" in sys.argv:
        i = sys.argv.index("--seed")
        seed = int(sys.argv[i + 1])
    ids = [a for a in sys.argv[1:] if not a.startswith("--") and a != str(seed)]
    for item in (ids or list(ITEMS)):
        gen(item, seed)
