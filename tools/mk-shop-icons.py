# Iconos de tienda: orbe dorado con glifo oscuro, uno por item.
#   pista    = ojo (revela el movimiento optimo)
#   deshacer = flecha circular (rebobina el turno)
#   midas    = corona del rey Midas (dobla el oro de la pantalla)
from PIL import Image, ImageDraw, ImageFilter
import math

DARK = (52, 30, 12, 255)
CREAM = (255, 236, 190, 255)


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


def pista():
    im, d = base()
    cx, cy = 256, 256
    # almendra del ojo: interseccion de dos circulos (centros arriba/abajo)
    R, c = 172, 122
    half_w = math.sqrt(R * R - c * c)
    pts = []
    for i in range(41):  # arco inferior del circulo superior (45..135 deg)
        a = math.radians(45 + i * (90 / 40))
        pts.append((cx + R * math.cos(a), cy - c + R * math.sin(a)))
    for i in range(41):  # arco superior del circulo inferior (225..315 deg)
        a = math.radians(225 + i * (90 / 40))
        pts.append((cx + R * math.cos(a), cy + c + R * math.sin(a)))
    d.polygon(pts, fill=DARK)
    # iris y pupila (crema sobre glifo oscuro)
    d.ellipse([cx - 46, cy - 46, cx + 46, cy + 46], fill=CREAM)
    d.ellipse([cx - 20, cy - 20, cx + 20, cy + 20], fill=DARK)
    d.ellipse([cx - 34, cy - 34, cx - 22, cy - 22], fill=CREAM)
    return im


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
    cx, cy = 256, 262
    # corona: banda + tres puntas en zigzag
    d.rectangle([cx - 95, cy + 35, cx + 95, cy + 78], fill=DARK)
    d.polygon([(cx - 95, cy + 35), (cx - 80, cy - 38), (cx - 48, cy + 2),
               (cx, cy - 50), (cx + 48, cy + 2), (cx + 80, cy - 38),
               (cx + 95, cy + 35)], fill=DARK)
    # joyas en las puntas y en la banda
    for jx, jy, jr in [(cx - 80, cy - 44, 11), (cx, cy - 56, 12), (cx + 80, cy - 44, 11)]:
        d.ellipse([jx - jr, jy - jr, jx + jr, jy + jr], fill=DARK)
        d.ellipse([jx - jr + 4, jy - jr + 4, jx + jr - 4, jy + jr - 4], fill=CREAM)
    for jx in (cx - 48, cx, cx + 48):
        d.ellipse([jx - 10, cy + 46, jx + 10, cy + 66], fill=CREAM)
    return im


pista().save('assets/tienda/iconos/pista.webp', quality=90)
arc_arrow().save('assets/tienda/iconos/deshacer.webp', quality=90)
midas().save('assets/tienda/iconos/midas.webp', quality=90)
print('iconos ok')
