# Alarga victory.mp3 repitiendo secciones del propio audio con crossfades.
# Estructura: [0-103] + dev+build[35-105] + build[80-105] + [103-fin]
import torchaudio, torch

wav, sr = torchaudio.load('assets/music/old/victory-121s-v2.mp3')

def seg(a, b):
    return wav[:, int(a * sr):int(b * sr)]

def splice(a, b, x):
    n = int(x * sr)
    fo = torch.linspace(1.0, 0.0, n).unsqueeze(0)
    fi = 1.0 - fo
    return torch.cat([a[:, :-n], a[:, -n:] * fo + b[:, :n] * fi, b[:, n:]], 1)

out = splice(wav[:, :int(103 * sr)], seg(35, 105), 2.0)   # +70s (dev+build)
out = splice(out, seg(80, 105), 2.0)                     # +25s (build)
out = splice(out, wav[:, int(103 * sr):], 1.0)           # +18.3s (clímax+outro)

print(f'{out.shape[-1] / sr:.1f}s')
torchaudio.save('.tmp_chk/victory-stretched.wav', out, sr)
