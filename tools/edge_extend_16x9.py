"""Extiende una imagen 3:2 a 16:9 reflejando los bordes (espejo).

Alternativa al outpainting con difusion: usa solo pixeles reales del borde,
reflejados en el eje del borde exterior. Invisible cuando el borde es fondo
plano (cielo, espacio, agua); simetria visible si hay objetos en el borde.

Uso: edge_extend_16x9.py <src> <dst> [side_px]
"""
import sys
from PIL import Image

def main():
    src, dst = sys.argv[1], sys.argv[2]
    im = Image.open(src).convert('RGB')
    W, H = im.size
    W1 = int(round(H * 16 / 9))
    side = (W1 - W) // 2
    if len(sys.argv) > 3:
        side = int(sys.argv[3])
        W1 = W + side * 2
    if side <= 0:
        im.save(dst); return
    out = Image.new('RGB', (W1, H))
    out.paste(im, (side, 0))
    # Banda espejo: las columnas [0..side-1] del borde, invertidas
    left = im.crop((0, 0, side, H)).transpose(Image.FLIP_LEFT_RIGHT)
    right = im.crop((W - side, 0, W, H)).transpose(Image.FLIP_LEFT_RIGHT)
    out.paste(left, (0, 0))
    out.paste(right, (side + W, 0))
    out.save(dst, quality=92)
    print(f'{src} -> {dst}  {W}x{H} +{side}px/lado = {W1}x{H}')

if __name__ == '__main__':
    main()
