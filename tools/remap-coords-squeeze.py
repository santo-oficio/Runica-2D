# Remapea las coordenadas calibradas de los submundos del lienzo
# .pano 12032×5120 al nuevo lienzo .pano comprimido 10152×4320:
#
#   x:  un-pano viejo -> espacio original -> nuevo pano
#       x' = ((x*12032 - 2176) + 1236) / 10152
#   w:  w' = w * 12032 / 10152
#   y:  y' = pos(y*5120) / 4320        (mapa de squeeze, por fila)
#   h:  h' = (pos((y+h)*5120) - pos(y*5120)) / 4320
#   avatarSize: *= 12032/10152  (fracción de ancho de imagen)
#   anchorX (viewLeft/viewRight): intacto — son fracciones de viewport.
#
# UNA SOLA EJECUCIÓN — re-ejecutar duplicaría el desplazamiento.

import json
import numpy as np
import glob
import os

OLD_W, OLD_SIDE = 12032, 2176
NEW_W, NEW_SIDE = 10152, 1236
OLD_H, NEW_H = 5120.0, 4320.0


def ymap(pos, y):
    return float(np.interp(y * OLD_H, np.arange(len(pos)), pos) / NEW_H)


def remap_file(path, pos):
    d = json.load(open(path, encoding="utf-8"))

    def ry(y):
        return ymap(pos, y)

    if "positions" in d:  # avatar-positions.json
        for k, p in d["positions"].items():
            x_orig = (p["x"] * OLD_W - OLD_SIDE) / 7680
            p["x"] = round((x_orig * 7680 + NEW_SIDE) / NEW_W, 6)
            p["y"] = round(ry(p["y"]), 6)
        if "avatarSize" in d:
            d["avatarSize"] = round(d["avatarSize"] * OLD_W / NEW_W, 6)
        for e in d.get("avatars", []):
            if e and "size" in e:
                e["size"] = round(e["size"] * OLD_W / NEW_W, 6)
    elif "areas" in d:  # text-areas.json
        for name, a in d["areas"].items():
            if not a.get("anchorX"):
                x_orig = (a["x"] * OLD_W - OLD_SIDE) / 7680
                a["x"] = round((x_orig * 7680 + NEW_SIDE) / NEW_W, 6)
                a["w"] = round(a["w"] * OLD_W / NEW_W, 6)
            y0, h0 = a["y"], a["h"]
            a["y"] = round(ry(y0), 6)
            a["h"] = round(ry(y0 + h0) - a["y"], 6)
    json.dump(d, open(path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print("remap", path)


for f in sorted(glob.glob("assets/submundos/*/*.json")):
    base = os.path.basename(os.path.dirname(f))
    pano = glob.glob(os.path.join(os.path.dirname(f), "*.pano.webp"))
    if not pano:
        continue
    pos = np.load(os.path.join(".tmp_chk", "sqpos-" + os.path.basename(pano[0]) + ".npy"))
    remap_file(f, pos)
print("done")
