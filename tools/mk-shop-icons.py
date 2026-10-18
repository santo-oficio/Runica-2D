# Iconos de tienda al estilo de pista.webp: orbe dorado con glifo oscuro.
from PIL import Image, ImageDraw, ImageFilter
import math

DARK = (52, 30, 12, 255)

def base():
    im = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    # halo dorado exterior
    glow = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([110, 110, 402, 402], fill=(255, 190, 80, 210))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(55)))
    # orbe: centro crema -> borde ambar (circulos concentricos)
    d = ImageDraw.Draw(im)
    for r in range(155, 0, -1):
        t = r / 155
        col = (int(255 - 45 * t), int(238 - 95 * t), int(195 - 140 * t), 255)
        d.ellipse([256 - r, 256 - r, 256 + r, 256 + r], fill=col)
    # brillo especular arriba-izquierda
    spec = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    ImageDraw.Draw(spec).ellipse([165, 140, 300, 215], fill=(255, 255, 255, 95))
    im.alpha_composite(spec.filter(ImageFilter.GaussianBlur(16)))
    # rayos exteriores
    d = ImageDraw.Draw(im)
    for k in range(8):
        a = math.radians(k * 45 + 12)
        x0, y0 = 256 + math.cos(a) * 196, 256 + math.sin(a) * 196
        x1, y1 = 256 + math.cos(a) * 232, 256 + math.sin(a) * 232
        d.line([x0, y0, x1, y1], fill=(235, 175, 70, 255), width=16)
    return im, ImageDraw.Draw(im)

def arc_arrow():
    im, d = base()
    # arco casi completo (flecha antihoraria), punta al inicio
    a0, a1 = 205, 540  # grados PIL (y hacia abajo, sentido horario)
    d.arc([155, 155, 357, 357], start=a0, end=a1, fill=DARK, width=26)
    t = math.radians(a0)
    px, py = 256 + 101 * math.cos(t), 256 + 101 * math.sin(t)
    # tangente en el inicio (direccion de angulo decreciente = antihorario)
    tx, ty = math.sin(t), -math.cos(t)
    nx, ny = -ty, tx
    tip = (px + tx * 42, py + ty * 42)
    d.polygon([tip, (px + nx * 30, py + ny * 30), (px - nx * 30, py - ny * 30)], fill=DARK)
    # anillos superior/inferior tipo runa (como el ojo de pista)
    d.arc([155, 155, 357, 357], start=300, end=350, fill=DARK, width=26)
    return im

def midas():
    im, d = base()
    # estrella de 4 puntas (brillo de oro)
    cx, cy, L, S = 256, 256, 118, 34
    pts = []
    for k in range(4):
        a = math.radians(k * 90 - 90)
        pts.append((cx + math.cos(a) * L, cy + math.sin(a) * L))
        a2 = a + math.radians(45)
        pts.append((cx + math.cos(a2) * S, cy + math.sin(a2) * S))
    d.polygon(pts, fill=DARK)
    d.ellipse([cx - 20, cy - 20, cx + 20, cy + 20], fill=(255, 236, 190, 255))
    # destellos pequenos
    for a in (35, 145, 235, 315):
        r = math.radians(a)
        sx, sy = cx + math.cos(r) * 150, cy + math.sin(r) * 150
        d.ellipse([sx - 9, sy - 9, sx + 9, sy + 9], fill=DARK)
    return im

arc_arrow().save('assets/tienda/iconos/deshacer.webp', quality=90)
midas().save('assets/tienda/iconos/midas.webp', quality=90)
print('iconos ok')

def escarcha():
    im, d = base()
    cx, cy = 256, 256
    # copo de nieve: 6 brazos con puntas en V
    for k in range(6):
        a = math.radians(k * 60 - 90)
        x1, y1 = cx + math.cos(a) * 115, cy + math.sin(a) * 115
        d.line([cx, cy, x1, y1], fill=DARK, width=22)
        for sgn in (-1, 1):
            ta = a + sgn * math.radians(38)
            bx, by = cx + math.cos(a) * 78, cy + math.sin(a) * 78
            d.line([bx, by, bx + math.cos(ta) * 30, by + math.sin(ta) * 30], fill=DARK, width=14)
    d.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], fill=(255, 236, 190, 255))
    return im

escarcha().save('assets/tienda/iconos/escarcha.webp', quality=90)
print('escarcha ok')
