# victory.mp3 a partir de la fanfarria original de 15.6s (old/victory.mp3).
# La frase se repite como ostinato épico: cada vuelta acaba con su propio
# decaimiento (12-15.6s) que respira antes de la siguiente. Arco dinámico
# suave para que no sea monocorde + fundido final.
import torchaudio, torch

wav, sr = torchaudio.load('assets/music/old/victory.mp3')
DUR = wav.shape[-1] / sr
print(f'origen {DUR:.1f}s @ {sr}Hz')

def seg(a, b):
    return wav[:, int(a * sr):int(b * sr)]

def splice(a, b, x):
    n = int(x * sr)
    fo = torch.linspace(1.0, 0.0, n).unsqueeze(0)
    fi = 1.0 - fo
    return torch.cat([a[:, :-n], a[:, -n:] * fo + b[:, :n] * fi, b[:, n:]], 1)

frase = seg(0.4, DUR)          # 15.2s — frase completa sin el pickup inicial
LOOPS = 9
# Arco: 3 vueltas fuertes, 3 contenidas (-1.8dB), 3 de vuelta al clímax
gain = [1.0, 1.0, 1.0, 0.81, 0.81, 0.81, 1.0, 1.0, 1.0]

out = wav.clone()
for i in range(LOOPS):
    out = splice(out, frase * gain[i], 0.9)

# Fundido final generoso sobre el decaimiento de la última frase
fade_n = int(4.0 * sr)
out[:, -fade_n:] *= torch.linspace(1.0, 0.0, fade_n).unsqueeze(0)

print(f'{out.shape[-1] / sr:.1f}s totales')
torchaudio.save('.tmp_chk/victory-fanfare.wav', out, sr)
