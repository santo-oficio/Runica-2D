"""Outpainting 3:2 -> 16:9 con SD 1.5 inpainting (local, RTX 3060).

Extiende solo los laterales: la imagen original queda intacta en el centro
y se genera contenido nuevo en los bordes izquierdo/derecho, en tiles de
512x768 con solape para evitar costuras verticales.

Uso:
  .sam-venv/Scripts/python.exe tools/outpaint_16x9.py <entrada> <salida> "prompt"
"""
import sys
import numpy as np
import torch
from PIL import Image, ImageFilter
from diffusers import StableDiffusionInpaintPipeline

MODEL = "stable-diffusion-v1-5/stable-diffusion-inpainting"
WORK_H = 1280
TW, TH = 512, 768        # tile de generación (ancho x alto)
NEG = "text, watermark, signature, border, frame, seam, blurry, distorted, ugly, low quality, deformed"

_pipe = None

def pipe():
    global _pipe
    if _pipe is None:
        _pipe = StableDiffusionInpaintPipeline.from_pretrained(
            MODEL, torch_dtype=torch.float16, variant="fp16", safety_checker=None,
            requires_safety_checker=False)
        _pipe = _pipe.to("cuda")
        _pipe.enable_attention_slicing()
    return _pipe

def _gen_side(p, canvas, box, prompt, seed):
    """Inpainta el trozo [x0,x1) del canvas: la parte enmascarada se genera."""
    x0, x1, m0, m1 = box        # crop y zona enmascarada dentro del crop
    tile = canvas.crop((x0, 0, x1, canvas.height)).resize((TW, TH), Image.LANCZOS)
    # máscara: blanco = generar
    ma = np.zeros((canvas.height, x1 - x0), np.uint8)
    ma[:, m0:m1] = 255
    edge = 40                     # feather hacia el contenido existente
    if m0 == 0:                   # borde izquierdo: feather a la derecha de la zona
        ma[:, m1:m1 + edge] = np.linspace(255, 0, edge)[None, :]
    else:                         # borde derecho: feather a la izquierda
        ma[:, m0 - edge:m0] = np.linspace(0, 255, edge)[None, :]
    mask = Image.fromarray(ma).resize((TW, TH), Image.BILINEAR)
    return p(prompt=prompt, negative_prompt=NEG, image=tile, mask_image=mask,
             num_inference_steps=25, guidance_scale=7.0,
             generator=torch.Generator("cuda").manual_seed(seed),
             width=TW, height=TH).images[0]

def outpaint(src_path, dst_path, prompt):
    src = Image.open(src_path).convert("RGB")
    W, H = src.size
    newW = round(H * 16 / 9 / 2) * 2
    side = (newW - W) // 2

    # --- canvas de trabajo ---
    ws = WORK_H / H
    cw, ch = round(newW * ws), WORK_H
    sW = round(W * ws)
    sS = (cw - sW) // 2
    canvas = Image.new("RGB", (cw, ch))
    canvas.paste(src.resize((sW, ch), Image.LANCZOS), (sS, 0))

    p = pipe()
    strips = []
    for i in range(2):           # 0 = izq, 1 = der
        if i == 0:
            rx0, rx1, nm0, nm1 = 0, 640, 0, sS          # región real del canvas
        else:
            rx0, rx1, nm0, nm1 = cw - 640, cw, cw - sS, cw
        # tiles verticales con solape de 128 px
        acc = np.zeros((ch, rx1 - rx0, 3), np.float32)
        wacc = np.zeros((ch, 1, 1), np.float32)
        tiles = [0]
        while tiles[-1] + TH < ch:
            tiles.append(tiles[-1] + TH - 128)
        for ty in tiles:
            y1 = min(ty + TH, ch)
            crop = canvas.crop((rx0, ty, rx1, y1)).resize((TW, TH), Image.LANCZOS)
            ma = np.zeros((y1 - ty, rx1 - rx0), np.uint8)
            ma[:, nm0 - rx0:nm1 - rx0] = 255
            edge = 160                  # feather amplio: el modelo disuelve hacia el original
            if i == 0:
                ma[:, nm1 - rx0:nm1 - rx0 + edge] = np.linspace(255, 0, edge)[None, :]
            else:
                ma[:, nm0 - rx0 - edge:nm0 - rx0] = np.linspace(0, 255, edge)[None, :]
            mask = Image.fromarray(ma).resize((TW, TH), Image.BILINEAR)
            res = p(prompt=prompt, negative_prompt=NEG, image=crop, mask_image=mask,
                    num_inference_steps=25, guidance_scale=7.0,
                    generator=torch.Generator("cuda").manual_seed(7000 + i * 100 + ty),
                    width=TW, height=TH).images[0]
            res = res.resize((rx1 - rx0, y1 - ty), Image.LANCZOS)
            a = np.asarray(res).astype(np.float32)
            wgt = np.ones((y1 - ty, 1), np.float32)
            fade = 64
            if ty > 0:
                wgt[:fade] = np.linspace(0, 1, fade)[:, None]
            if y1 < ch:
                wgt[-fade:] = np.linspace(1, 0, fade)[:, None]
            w3 = wgt[:, :, None]
            acc[ty:y1] += a * w3
            wacc[ty:y1] += w3
        acc /= np.maximum(wacc, 1e-6)
        region = Image.fromarray(acc.astype(np.uint8))
        # tira nueva + solape extra sobre el original (cubre todo el feather)
        extra = 200
        if i == 0:
            strips.append(region.crop((nm0 - rx0, 0, nm1 - rx0 + extra, ch)))
        else:
            strips.append(region.crop((nm0 - rx0 - extra, 0, nm1 - rx0, ch)))

    # --- composición a resolución nativa ---
    out = Image.new("RGB", (newW, H))
    out.paste(src, (side, 0))
    fade = round(200 / ws)         # crossfade sobre el original (~800px nativos)
    for i, x_dst in enumerate([0, newW - side - fade]):
        strip = strips[i].resize((side + fade, H), Image.LANCZOS)
        strip = strip.filter(ImageFilter.GaussianBlur(0.8))
        alpha = np.full((H, side + fade), 255, np.uint8)
        if i == 0:
            alpha[:, side:] = np.linspace(255, 0, fade).astype(np.uint8)[None, :]
        else:
            alpha[:, :fade] = np.linspace(0, 255, fade).astype(np.uint8)[None, :]
        out.paste(strip, (x_dst, 0), Image.fromarray(alpha))
    if dst_path.lower().endswith(".webp"):
        out.save(dst_path, "WEBP", quality=92, method=6)
    else:
        out.save(dst_path, quality=95)
    print(f"{src_path} -> {dst_path}  {W}x{H} -> {newW}x{H}", flush=True)

if __name__ == "__main__":
    outpaint(sys.argv[1], sys.argv[2], sys.argv[3])
