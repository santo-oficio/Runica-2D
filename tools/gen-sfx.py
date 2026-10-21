#!/usr/bin/env python
"""Genera SFX locales con AudioGen (Meta audiocraft) para Runika 2D.

Uso:
    .sam-venv\\Scripts\\python.exe tools\\gen-sfx.py "prompt" segundos salida.wav

- Modelo: facebook/audiogen-medium (~1.5 GB, se descarga a
  ~/.cache/huggingface la primera vez). Usa GPU si hay CUDA.
- AudioGen genera EFECTOS (no música). Duración máx ~10s.
"""
import argparse
import sys
import time
from pathlib import Path


def main() -> int:
    p = argparse.ArgumentParser(description="AudioGen local para Runika 2D")
    p.add_argument("prompt")
    p.add_argument("seconds", type=float)
    p.add_argument("output")
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--model", default="facebook/audiogen-medium")
    args = p.parse_args()

    import torch
    import torchaudio
    from audiocraft.models import AudioGen
    from audiocraft.data.audio import audio_write

    if args.seed is not None:
        torch.manual_seed(args.seed)

    t0 = time.time()
    print(f"[gen-sfx] cargando {args.model} ...")
    model = AudioGen.get_pretrained(args.model)
    model.set_generation_params(duration=args.seconds)

    print(f"[gen-sfx] generando {args.seconds:.1f}s: {args.prompt!r}")
    wav = model.generate([args.prompt])[0].cpu()
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    audio_write(str(out.with_suffix('')), wav, model.sample_rate,
                strategy='loudness', loudness_headroom_db=6)
    print(f"[gen-sfx] {out.with_suffix('.wav')} en {time.time() - t0:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
