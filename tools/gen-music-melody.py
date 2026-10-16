#!/usr/bin/env python
"""Pieza nueva a partir de una melodía existente (musicgen-melody).

Uso:
    .sam-venv\\Scripts\\python.exe tools/gen-music-melody.py <melodia> <segundos> <salida.wav> "prompt"

Genera una pieza NUEVA condicionada por la melodía de <melodia>
(chromagrama) + descripción de texto, y empala el audio original al
principio con un crossfade — el resultado empieza con la pista real y
continúa con material nuevo sobre el mismo tema.

- Modelo: facebook/musicgen-melody (~4 GB, se descarga la primera vez).
- Salida: .wav 32 kHz = melodia original + pieza generada tras ella.
"""
import argparse
import sys
import time
from pathlib import Path

import torch
import torchaudio


def main() -> int:
    p = argparse.ArgumentParser(description="Pieza nueva sobre una melodía (musicgen-melody)")
    p.add_argument("input", help="pista con la melodía (mp3/wav)")
    p.add_argument("seconds", type=float, help="duración de la parte generada")
    p.add_argument("output", help=".wav de salida")
    p.add_argument("prompt", help="descripción del estilo (inglés)")
    p.add_argument("--keep-sec", type=float, default=0,
                   help="segundos del original que se conservan al inicio (0 = toda)")
    p.add_argument("--xfade", type=float, default=1.5,
                   help="crossfade original→generado en segundos")
    p.add_argument("--model", default="facebook/musicgen-melody")
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--top-k", type=int, default=250)
    p.add_argument("--temperature", type=float, default=1.0)
    p.add_argument("--cfg-coef", type=float, default=3.0)
    args = p.parse_args()

    if args.seed is not None:
        torch.manual_seed(args.seed)

    from audiocraft.models import MusicGen
    from audiocraft.data.audio import audio_read

    t0 = time.time()
    print(f"[melody] cargando {args.model} ...")
    model = MusicGen.get_pretrained(args.model)
    sr = model.sample_rate

    wav, in_sr = audio_read(args.input)
    if wav.dim() == 1:
        wav = wav[None, None]
    elif wav.dim() == 2:
        wav = wav[None]
    keep = int((args.keep_sec or wav.shape[-1] / in_sr) * in_sr)

    model.set_generation_params(
        duration=args.seconds,
        top_k=args.top_k,
        temperature=args.temperature,
        cfg_coef=args.cfg_coef,
    )
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[melody] generando {args.seconds:.0f}s sobre la melodía en {device} ...")
    gen = model.generate_with_chroma(
        [args.prompt], wav[0], in_sr, progress=True).cpu()

    # Empalme: original verbatim → pieza generada (misma melodía)
    x = int(args.xfade * sr)
    head = torchaudio.functional.resample(wav[0][:, :keep], in_sr, sr)
    if head.shape[0] != gen.shape[1]:
        head = head.repeat(gen.shape[1], 1) if head.shape[0] == 1 else head.mean(0, keepdim=True)
    fo = torch.linspace(1.0, 0.0, x).unsqueeze(0)
    fi = 1.0 - fo
    mix = head[:, -x:] * fo + gen[0][:, :x] * fi
    final = torch.cat([head[:, :-x], mix, gen[0][:, x:]], dim=-1)

    dst = Path(args.output)
    dst.parent.mkdir(parents=True, exist_ok=True)
    torchaudio.save(str(dst), final, sr)
    print(f"[melody] OK -> {dst}  ({final.shape[-1] / sr:.1f}s totales, "
          f"{time.time() - t0:.0f}s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
