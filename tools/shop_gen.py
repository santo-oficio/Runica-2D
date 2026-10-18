# Genera los assets de la tienda con SD 1.5 inpainting local (modelo cargado
# UNA sola vez para todo el lote — en la 3060 6GB re-cargar cuesta ~2 min).
#
# Modos:
#   interior  → text2img full-frame 1024x576 → 1920x1080 por mundo
#               (assets/tienda/<MUNDO>/tienda.webp) con tendero pintado en escena
#   island    → inpaint de una isla flotante con puesto en el .pano.webp del
#               mundo, en las coords de assets/submundos/<MUNDO>/shop.json
#
# Uso:
#   .sam-venv/Scripts/python.exe tools/shop_gen.py interior [MUNDO...]
#   .sam-venv/Scripts/python.exe tools/shop_gen.py island [MUNDO...]
import sys
import json
import numpy as np
import torch
from pathlib import Path
from PIL import Image, ImageFilter
from diffusers import StableDiffusionInpaintPipeline

MODEL = "stable-diffusion-v1-5/stable-diffusion-inpainting"
NEG = ("text, watermark, signature, blurry, distorted, ugly, low quality, "
       "photorealistic, photo, people crowd, ui, interface")

# Prompts del interior: estilo recreativa D&D años 90 — mostrador con tendero
# a la izquierda y hueco a la derecha donde va el panel de objetos.
INTERIOR = {
    "ESPACIO": "cozy space station shop interior, alien merchant behind wooden counter on the left, shelves with glowing artifacts, starfield window, striped awning, lanterns, warm light, fantasy cartoon game illustration, 90s arcade game style, painterly",
    "AGUA": "underwater grotto shop interior, mermaid merchant behind coral counter on the left, shelves with pearls and seashells, bioluminescent jars, bubbling water light, fantasy cartoon game illustration, 90s arcade game style, painterly",
    "TIERRA": "hollow tree shop interior, druid merchant behind root counter on the left, wooden shelves with potions and mushrooms, fireflies, moss, warm candlelight, fantasy cartoon game illustration, 90s arcade game style, painterly",
    "FUEGO": "volcanic forge shop interior, blacksmith merchant behind anvil counter on the left, racks of metal wares, lava glow through cracks, embers in the air, fantasy cartoon game illustration, 90s arcade game style, painterly",
    "HIELO": "ice cave shop interior, fur-clad merchant behind frozen counter on the left, shelves with glowing crystals, icicles, cold blue light with warm brazier, fantasy cartoon game illustration, 90s arcade game style, painterly",
    "VIENTO": "sky bazaar tent shop interior, hooded wind merchant behind counter on the left, fluttering banners, floating trinkets, open sky with clouds behind, fantasy cartoon game illustration, 90s arcade game style, painterly",
    "INFRAMUNDO": "underworld cavern shop interior, hooded shadow merchant behind obsidian counter on the left, shelves with green potions and bones, eerie green glow, fantasy cartoon game illustration, 90s arcade game style, painterly",
    "MAZMORRA": "dungeon shop interior, gruff keeper behind stone counter on the left, torches, iron wares and chains on shelves, barrels, warm torchlight, fantasy cartoon game illustration, 90s arcade game style, painterly",
}

# Prompts de tendero: sobre fondo blanco plano — SD1.5 obedece "isolated on
# white" mejor que chroma green, y el blanco se keyea por flood-fill.
KEEPER = {
    "ESPACIO": "one single alien shopkeeper, big black eyes, teal skin, dark robes, standing alone full body facing viewer, plain solid white background, no other objects, flat cartoon style, video game character art",
    "AGUA": "friendly mermaid shopkeeper character, coral hair, seashell jewelry, smiling, standing full body, centered, single character isolated on plain solid white background, flat cartoon style, video game character art",
    "TIERRA": "friendly druid shopkeeper character, leaf robes, wooden staff, beard with flowers, smiling, standing full body, centered, single character isolated on plain solid white background, flat cartoon style, video game character art",
    "FUEGO": "friendly dwarf blacksmith shopkeeper character, forge apron, braided beard, smiling, standing full body, centered, single character isolated on plain solid white background, flat cartoon style, video game character art",
    "HIELO": "friendly eskimo shopkeeper character, fur parka, goggles on head, smiling, standing full body, centered, single character isolated on plain solid white background, flat cartoon style, video game character art",
    "VIENTO": "friendly hooded wind merchant character, flowing scarves, goggles, smiling, standing full body, centered, single character isolated on plain solid white background, flat cartoon style, video game character art",
    "INFRAMUNDO": "friendly shadow shopkeeper character, hooded cloak, glowing green eyes, smiling, standing full body, centered, single character isolated on plain solid white background, flat cartoon style, video game character art",
    "MAZMORRA": "friendly gruff dungeon keeper character, leather apron, key ring on belt, smiling, standing full body, centered, single character isolated on plain solid white background, flat cartoon style, video game character art",
}

# Prompts de la isla tienda por mundo (misma estética del submundo)
ISLAND = {
    "ESPACIO": "small floating space rock island, tiny wooden shop hut with round door and warm glowing windows, striped awning, crates, lantern, flat cartoon style, video game map illustration, dark blue space",
    "AGUA": "small floating sea rock island, tiny wooden beach shop hut with palm roof, striped awning, crates, lantern, flat cartoon style, video game map illustration, blue ocean",
    "TIERRA": "small floating grass island, tiny wooden shop hut with moss roof, striped awning, crates, lantern, flat cartoon style, video game map illustration, green jungle sky",
    "FUEGO": "small floating volcanic rock island, tiny obsidian shop hut with glowing door, striped awning, crates, lantern, flat cartoon style, video game map illustration, ember sky",
    "HIELO": "small floating ice island, tiny wooden shop hut with snow roof, striped awning, crates, lantern, flat cartoon style, video game map illustration, icy sky",
    "VIENTO": "small floating cloud island, tiny wooden shop hut with flag, striped awning, crates, lantern, flat cartoon style, video game map illustration, cloudy sky",
    "INFRAMUNDO": "small floating dark rock island, tiny obsidian shop hut with green glowing door, striped awning, crates, lantern, flat cartoon style, video game map illustration, green underworld",
    "MAZMORRA": "small floating stone island, tiny dungeon shop hut with iron door and torches, striped awning, crates, lantern, flat cartoon style, video game map illustration, dark cave",
}

_pipe = None

def pipe():
    global _pipe
    if _pipe is None:
        _pipe = StableDiffusionInpaintPipeline.from_pretrained(
            MODEL, torch_dtype=torch.float16, variant="fp16",
            safety_checker=None, requires_safety_checker=False)
        _pipe = _pipe.to("cuda")
        _pipe.enable_attention_slicing()
    return _pipe


def gen_interior(world, seed=11):
    out_dir = Path("assets/tienda") / world
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / "tienda.webp"
    p = pipe()
    # text2img vía inpainting con máscara totalmente blanca
    dummy = Image.new("RGB", (1024, 576), (10, 8, 6))
    mask = Image.new("L", (1024, 576), 255)
    img = p(prompt=INTERIOR[world], negative_prompt=NEG,
            image=dummy, mask_image=mask,
            num_inference_steps=28, guidance_scale=7.5,
            generator=torch.Generator("cuda").manual_seed(seed),
            width=1024, height=576).images[0]
    img = img.resize((1920, 1080), Image.LANCZOS)
    img.save(out, "WEBP", quality=90, method=6)
    print("interior", world, "->", out)


def gen_island(world, seed=7, w=700, h=540, only=None):
    sj = Path("assets/submundos") / world / "shop.json"
    meta = json.loads(sj.read_text(encoding="utf-8"))
    nodes = meta.get("nodes") or [meta]
    for i, node in enumerate(nodes):
        if only is not None and i != only:
            continue
        gen_island_at(world, node["pos"], seed + i * 5, w, h)


def gen_island_at(world, pos, seed, w, h):
    cands = list((Path("assets/submundos") / world).glob("submundo*.pano.webp"))
    assert cands, f"sin pano para {world}"
    pano_path = cands[0]
    src = Image.open(pano_path).convert("RGB")
    W, H = src.size
    cx, cy = int(pos["x"] * W), int(pos["y"] * H)
    pad = 260
    x0, y0 = max(0, cx - w // 2 - pad), max(0, cy - h // 2 - pad)
    x1, y1 = min(W, cx + w // 2 + pad), min(H, cy + h // 2 + pad)
    crop = src.crop((x0, y0, x1, y1))
    cw, ch = crop.size
    tile = crop.resize((1024, 1024), Image.LANCZOS)

    ma = np.zeros((ch, cw), np.float32)
    yy, xx = np.mgrid[0:ch, 0:cw]
    icx, icy = cx - x0, cy - y0
    e = ((xx - icx) / (w / 2)) ** 2 + ((yy - icy) / (h / 2)) ** 2
    ma[e < 1.0] = 1.0
    mimg = Image.fromarray((ma * 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(24))
    mask = mimg.resize((1024, 1024), Image.BILINEAR)

    p = pipe()
    res = p(prompt=ISLAND[world], negative_prompt=NEG, image=tile,
            mask_image=mask, num_inference_steps=26, guidance_scale=7.5,
            generator=torch.Generator("cuda").manual_seed(seed),
            width=1024, height=1024).images[0]
    res = res.resize((cw, ch), Image.LANCZOS)
    base = np.asarray(crop).astype(np.float32)
    gen = np.asarray(res).astype(np.float32)
    a = (np.asarray(mimg, dtype=np.float32) / 255.0)[..., None]
    out = base * (1 - a) + gen * a
    src.paste(Image.fromarray(out.astype(np.uint8)), (x0, y0))
    src.save(pano_path, "WEBP", quality=92, method=6)
    print("island", world, "->", pano_path)


def chroma_key(img, tol=78, feather=1.2):
    """Fondo plano → alfa por flood-fill desde los bordes.

    Solo es transparente lo que se parece al fondo Y está conectado al borde:
    así los blancos interiores (ojos, reflejos) del personaje sobreviven."""
    import cv2
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    edge = np.concatenate([
        a[0:8].reshape(-1, 3), a[-8:].reshape(-1, 3),
        a[:, 0:8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    bg = np.median(edge, axis=0)
    dist = np.sqrt(((a - bg) ** 2).sum(axis=2))
    cand = (dist < tol).astype(np.uint8)
    n, lbl = cv2.connectedComponents(cand)
    edge_lbls = set(lbl[0]) | set(lbl[-1]) | set(lbl[:, 0]) | set(lbl[:, -1])
    edge_lbls.discard(0)
    bgmask = np.isin(lbl, list(edge_lbls))
    alpha = np.where(bgmask, 0, 255).astype(np.uint8)
    alpha = cv2.erode(alpha, np.ones((3, 3), np.uint8), iterations=1)
    alpha = cv2.GaussianBlur(alpha, (0, 0), feather)
    rgb = np.asarray(img.convert("RGB")).copy()
    out = np.dstack([rgb, alpha])
    ys, xs = np.where(alpha > 12)
    if len(ys):
        y0, y1 = max(0, ys.min() - 10), min(alpha.shape[0], ys.max() + 10)
        x0, x1 = max(0, xs.min() - 10), min(alpha.shape[1], xs.max() + 10)
        out = out[y0:y1, x0:x1]
    return Image.fromarray(out, "RGBA")


def gen_keeper(world, seed=21):
    out_dir = Path("assets/tienda") / world
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / "tendero.webp"
    p = pipe()
    dummy = Image.new("RGB", (640, 960), (255, 255, 255))
    mask = Image.new("L", (640, 960), 255)
    img = p(prompt=KEEPER[world],
            negative_prompt=NEG + ", two people, multiple characters, duplicate, crowd, siamese",
            image=dummy, mask_image=mask,
            num_inference_steps=28, guidance_scale=7.5,
            generator=torch.Generator("cuda").manual_seed(seed),
            width=640, height=960).images[0]
    img.save(Path(".tmp_chk") / f"keeper-raw-{world}.png")
    img = chroma_key(img)
    img.save(out, "WEBP", quality=92, method=6)
    print("keeper", world, "->", out, img.size)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "interior"
    seed = int(sys.argv[sys.argv.index("--seed") + 1]) if "--seed" in sys.argv else None
    node = int(sys.argv[sys.argv.index("--node") + 1]) if "--node" in sys.argv else None
    worlds = [a for i, a in enumerate(sys.argv[2:], 2)
              if not a.startswith("--") and sys.argv[i - 1] not in ("--seed", "--node")]
    worlds = worlds or list(INTERIOR.keys())
    for w in worlds:
        if mode == "interior":
            gen_interior(w)
        elif mode == "island":
            gen_island(w, seed=seed or 7, only=node)
        elif mode == "keeper":
            gen_keeper(w, seed=seed or 21)
