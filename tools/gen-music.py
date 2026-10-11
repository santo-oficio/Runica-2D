#!/usr/bin/env python
"""Genera música local con MusicGen (Meta audiocraft) para Runika 2D.

Uso:
    .sam-venv\\Scripts\\python.exe tools/gen-music.py "prompt" [segundos] [salida]

Ejemplo:
    .sam-venv\\Scripts\\python.exe tools/gen-music.py \\
        "caribbean pirate tavern music, steel drums, accordion, cheerful" \\
        20 assets/music/TIERRA/submundo.wav

- Modelo por defecto: facebook/musicgen-small (~3.3 GB, se descarga a
  ~/.cache/huggingface la primera vez). Usa GPU si hay CUDA.
- Salida: .wav (32 kHz mono/stereo). Convertir a mp3/ogg con:
    ffmpeg -i in.wav -b:a 192k out.mp3
- La generación no es determinista por defecto; fijar --seed para
  reproducir.
"""
import argparse
import sys
import time
from pathlib import Path

import torch
import torchaudio


def main() -> int:
    p = argparse.ArgumentParser(description="MusicGen local para Runika 2D")
    p.add_argument("prompt", help="descripción de la música (en inglés funciona mejor)")
    p.add_argument("seconds", type=float, nargs="?", default=20.0,
                   help="duración en segundos (máx ~30 por pasada; defecto 20)")
    p.add_argument("output", nargs="?", default="musicgen-out.wav",
                   help="ruta del .wav de salida")
    p.add_argument("--model", default="facebook/musicgen-small",
                   help="checkpoint HF (small|medium|large o 'melody')")
    p.add_argument("--seed", type=int, default=None, help="semilla para reproducir")
    p.add_argument("--top-k", type=int, default=250)
    p.add_argument("--top-p", type=float, default=0.0)
    p.add_argument("--temperature", type=float, default=1.0)
    p.add_argument("--cfg-coef", type=float, default=3.0,
                   help="fuerza del prompt (mayor = más literal)")
    args = p.parse_args()

    if args.seed is not None:
        torch.manual_seed(args.seed)

    t0 = time.time()
    print(f"[gen-music] cargando {args.model} ...")
    from audiocraft.models import MusicGen

    model = MusicGen.get_pretrained(args.model)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.set_generation_params(
        duration=args.seconds,
        top_k=args.top_k,
        top_p=args.top_p,
        temperature=args.temperature,
        cfg_coef=args.cfg_coef,
    )
    print(f"[gen-music] generando {args.seconds:.0f}s en {device} ...")
    wav = model.generate([args.prompt])  # (B, C, T)

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    audio = wav[0].cpu()
    torchaudio.save(str(out), audio, model.sample_rate)
    print(f"[gen-music] OK -> {out} ({time.time() - t0:.0f}s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
