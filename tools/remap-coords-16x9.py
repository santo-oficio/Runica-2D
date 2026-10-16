"""Remapea coordenadas calibradas tras el outpainting 3:2 -> 16:9.

La imagen se extiende solo a los lados: el contenido original queda
centrado. Entonces, para una imagen W0xH que pasa a W1xH:

    x' = (x*W0 + side) / W1     (side = (W1-W0)/2)
    w' = w * W0/W1              (y cualquier fracción de ancho: size, etc.)
    y, h = sin cambio

Uso: .sam-venv/Scripts/python.exe tools/remap-coords-16x9.py
"""
import json
import os

IMG_W0 = {}   # imagen -> ancho original (antes del outpaint)

def transform_x(old_w, new_w):
    side = (new_w - old_w) / 2
    return lambda x: (x * old_w + side) / new_w

def scale_w(old_w, new_w):
    k = old_w / new_w
    return lambda w: w * k

def remap(node, fx, fw, in_poly=False):
    """fx: transforma coordenadas x (posición). fw: escala anchos (w, size, r)."""
    if isinstance(node, dict):
        for k, v in node.items():
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                if k in ("x", "cx"):
                    node[k] = round(fx(v), 6)
                elif k in ("w", "size", "r", "avatarSize"):
                    node[k] = round(fw(v), 6)
                else:
                    remap(v, fx, fw)
            else:
                remap(v, fx, fw, "poly" in k.lower())
    elif isinstance(node, list):
        if in_poly:
            for p in node:
                if isinstance(p, list) and len(p) >= 2:
                    if isinstance(p[0], (int, float)):
                        p[0] = round(fx(p[0]), 6)
                    else:
                        remap(p, fx, fw, True)   # lista de polígonos anidada
        else:
            for item in node:
                remap(item, fx, fw)

def remap_file(path, old_w, new_w):
    d = json.load(open(path, encoding="utf-8"))
    remap(d, transform_x(old_w, new_w), scale_w(old_w, new_w))
    json.dump(d, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("remap", path)

W169 = lambda h: round(h * 16 / 9 / 2) * 2   # ancho 16:9 par

if __name__ == "__main__":
    BIG = (7680, W169(5120))    # 7680x5120 -> 9102x5120
    MAPA = (1536, W169(1024))   # 1536x1024 -> 1820x1024

    # --- submundos (7680 -> 9102) ---
    for w in ["ESPACIO", "AGUA", "TIERRA", "FUEGO", "HIELO", "VIENTO",
              "INFRAMUNDO", "MAZMORRA"]:
        remap_file(f"assets/submundos/{w}/avatar-positions.json", *BIG)
        remap_file(f"assets/submundos/{w}/text-areas.json", *BIG)

    # --- menú principal y selección (7680 -> 9102) ---
    remap_file("assets/menu principal/menu-buttons.json", *BIG)
    remap_file("assets/menu principal/selection-buttons.json", *BIG)
    remap_file("assets/menu principal/selection-name-area.json", *BIG)
    remap_file("assets/menu principal/character-positions.json", *BIG)

    # --- configuración (7680 -> 9102) ---
    remap_file("assets/configuracion/config-areas.json", *BIG)

    # --- mapamundi (1536 -> 1820) ---
    remap_file("assets/mapamundi/avatar-positions.json", *MAPA)
    remap_file("assets/mapamundi/menu-buttons.json", *MAPA)
    remap_file("assets/mapamundi/menu-texto.json", *MAPA)
    remap_file("assets/mapamundi/text-areas.json", *MAPA)
    remap_file("assets/comunes/fin-areas.json", *MAPA)   # auras sobre el mapamundi

    print("OK")
