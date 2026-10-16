#!/usr/bin/env python
"""Extiende una pista existente con MusicGen (continuación, sin repetir).

Uso:
    .sam-venv\\Scripts\\python.exe tools/gen-music-extend.py <entrada> <segundos_extra> <salida.wav> "prompt"

Ejemplo:
    .sam-venv\\Scripts\\python.exe tools/gen-music-extend.py \\
        assets/music/victory.mp3 110 .tmp_chk/victory-ext.wav \\
        "epic orchestral adventure fanfare, triumphant symphonic theme"

- Toma los últimos --prompt-sec segundos del audio como contexto (máx ~30
  s, la ventana de MusicGen) y genera continuación nueva.
- El empalme original→continuación se hace con un crossfade corto en la
  zona donde ambos audios se solapan (MusicGen re-codifica el prompt con
  EnCodec), así que el punto de unión queda escondido en audio casi
  idéntico.
- Salida: .wav a 32 kHz = original completo + continuación.
"""
import argparse
import sys
import time
from pathlib import Path

import torch
import torchaudio


def main() -> int:
    p = argparse.ArgumentParser(description="Extiende música con MusicGen")
    p.add_argument("input", help="pista origen (mp3/wav)")
    p.add_argument("extra", type=float, help="segundos nuevos a generar")
    p.add_argument("output", help=".wav de salida (original + continuación)")
    p.add_argument("prompt", help="descripción del estilo (inglés)")
    p.add_argument("--prompt-sec", type=float, default=25.0,
                   help="segundos del final usados como contexto (máx 30)")
    p.add_argument("--xfade", type=float, default=2.0,
                   help="crossfade en segundos en el punto de unión")
    p.add_argument("--model", default="facebook/musicgen-small")
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
    print(f"[extend] cargando {args.model} ...")
    model = MusicGen.get_pretrained(args.model)
    sr = model.sample_rate

    prompt_sec = min(args.prompt_sec, model.max_duration - 1.0)
    wav, in_sr = audio_read(args.input)
    if wav.dim() == 1:
        wav = wav[None, None]
    elif wav.dim() == 2:
        wav = wav[None]  # [C, T] -> [B=1, C, T]
    total_in = wav.shape[-1] / in_sr
    prompt = wav[:, :, int((total_in - prompt_sec) * in_sr):]
    print(f"[extend] entrada {total_in:.1f}s @ {in_sr} Hz; "
          f"prompt = últimos {prompt_sec:.1f}s; +{args.extra:.0f}s nuevos")

    model.set_generation_params(
        duration=prompt_sec + args.extra,
        top_k=args.top_k,
        temperature=args.temperature,
        cfg_coef=args.cfg_coef,
    )
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[extend] generando continuación en {device} ...")
    out = model.generate_continuation(
        prompt, in_sr, descriptions=[args.prompt], progress=True)
    out = out.cpu()

    # Empalme: out[0:prompt] ≈ re-codificación EnCodec del prompt, así que se
    # descarta; se hace crossfade del final real → inicio de lo generado.
    p_samples = int(prompt_sec * sr)
    x_samples = min(int(args.xfade * sr), p_samples)
    original = torchaudio.functional.resample(wav[0], in_sr, sr)
    # Igualar canales: EnCodec del modelo sale estéreo, el origen puede ser mono
    if original.shape[0] != out.shape[1]:
        if original.shape[0] == 1:
            original = original.repeat(out.shape[1], 1)
        else:
            original = original.mean(dim=0, keepdim=True)
    new_part = out[0][:, p_samples:]
    tail_a = original[:, -x_samples:]
    tail_b = out[0][:, p_samples - x_samples:p_samples]
    fade_out = torch.linspace(1.0, 0.0, x_samples)
    fade_in = 1.0 - fade_out
    mix = tail_a * fade_out + tail_b * fade_in
    final = torch.cat([original[:, :-x_samples], mix, new_part], dim=-1)

    dst = Path(args.output)
    dst.parent.mkdir(parents=True, exist_ok=True)
    torchaudio.save(str(dst), final, sr)
    print(f"[extend] OK -> {dst}  ({final.shape[-1] / sr:.1f}s totales, "
          f"{time.time() - t0:.0f}s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
