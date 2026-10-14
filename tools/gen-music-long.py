#!/usr/bin/env python
"""Pista larga y coherente con MusicGen por secciones encadenadas.

Cada sección continúa el audio de la anterior (generate_continuation), con
su propio prompt — así la pieza tiene estructura (intro → subida → clímax →
final) sin la deriva de una sola pasada larga. Opcionalmente arranca de un
audio semilla (p. ej. la fanfarria original) para conservar su tema.

Uso:
    .sam-venv\\Scripts\\python.exe tools/gen-music-long.py salida.wav \\
        --seed-audio assets/music/old/victory.mp3 --sections secciones.txt

secciones.txt: una línea por sección, "segundos|prompt".
"""
import argparse
import sys
import time
from pathlib import Path

import torch
import torchaudio


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("output")
    p.add_argument("--sections", required=True, help="archivo 'segundos|prompt' por línea")
    p.add_argument("--seed-audio", default=None, help="audio con el que arranca la pieza")
    p.add_argument("--context", type=float, default=10.0, help="segundos de contexto para continuar")
    p.add_argument("--model", default="facebook/musicgen-small")
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--cfg-coef", type=float, default=3.5)
    args = p.parse_args()
    if args.seed is not None:
        torch.manual_seed(args.seed)

    sections = []
    for line in Path(args.sections).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        secs, prompt = line.split("|", 1)
        sections.append((float(secs), prompt.strip()))

    from audiocraft.models import MusicGen
    t0 = time.time()
    model = MusicGen.get_pretrained(args.model)
    sr = model.sample_rate
    ctx_n = int(args.context * sr)

    if args.seed_audio:
        wav, in_sr = torchaudio.load(args.seed_audio)
        wav = wav.mean(0, keepdim=True)  # el modelo es mono
        if in_sr != sr:
            wav = torchaudio.functional.resample(wav, in_sr, sr)
        full = wav
    else:
        model.set_generation_params(duration=sections[0][0], cfg_coef=args.cfg_coef, top_k=250)
        full = model.generate([sections[0][1]])[0].cpu()
        sections = sections[1:]
        print(f"[long] seccion inicial {full.shape[-1] / sr:.0f}s", flush=True)

    for i, (secs, prompt) in enumerate(sections, 1):
        ctx = full[..., -ctx_n:]
        model.set_generation_params(duration=args.context + secs, cfg_coef=args.cfg_coef, top_k=250)
        out = model.generate_continuation(ctx.unsqueeze(0).to(model.device), sr, [prompt])[0].cpu()
        full = torch.cat([full, out[..., ctx.shape[-1]:]], dim=-1)
        print(f"[long] seccion {i}/{len(sections)} -> total {full.shape[-1] / sr:.0f}s ({time.time() - t0:.0f}s)", flush=True)

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    torchaudio.save(args.output, full, sr)
    print(f"[long] OK -> {args.output} ({full.shape[-1] / sr:.0f}s, {time.time() - t0:.0f}s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
