"""Batch: outpainting 3:2 -> 16:9 de todos los fondos 3:2 de pantalla completa.

Genera <fichero>.169.webp junto al original y una hoja de contacto en
.tmp_chk/outpaint-review.png para revisar antes de sustituir.

Uso: .sam-venv/Scripts/python.exe tools/outpaint-batch.py [N]  (N = solo esa imagen)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from outpaint_16x9 import outpaint

JOBS = [
    ("assets/submundos/ESPACIO/submundo-espacio.webp",
     "starry deep space nebula with asteroids and floating rock islands, cartoon digital painting, dark blue and purple cosmic sky"),
    ("assets/submundos/AGUA/submundo agua.webp",
     "bright tropical ocean with floating islands, turquoise water, waterfalls, sunny sky, cartoon digital painting"),
    ("assets/submundos/TIERRA/submundo tierra.webp",
     "lush green jungle floating islands, vines, mossy rocks, warm sunlight, cartoon digital painting"),
    ("assets/submundos/FUEGO/submundo fuego.webp",
     "volcanic inferno landscape, lava rivers, embers, dark rocky cliffs, orange glow, cartoon digital painting"),
    ("assets/submundos/HIELO/submundo hielo.webp",
     "arctic frozen landscape, icebergs, snow, aurora borealis sky, cartoon digital painting"),
    ("assets/submundos/VIENTO/submundo viento.webp",
     "sky full of clouds and floating islands, wind swirls, bright daylight, cartoon digital painting"),
    ("assets/submundos/INFRAMUNDO/submundo inframundo.webp",
     "dark underworld cavern, glowing lava, bones, ominous shadows, cartoon digital painting"),
    ("assets/submundos/MAZMORRA/submundo mazmorra.webp",
     "dark medieval dungeon interior, stone walls, torches, treasure, cartoon digital painting"),
    ("assets/menu principal/menu principal.webp",
     "tropical pirate beach paradise, turquoise ocean, palm trees, cliffs, sunny cartoon digital painting"),
    ("assets/menu principal/seleccion_personaje.webp",
     "tropical pirate beach paradise, turquoise ocean, palm trees, cliffs, sunny cartoon digital painting"),
    ("assets/configuracion/configuracion.webp",
     "warm pirate tavern scene, wooden textures, parchment, lantern light, cartoon digital painting"),
    ("assets/mapamundi/mapamundi.webp",
     "bright blue sky with fluffy clouds and floating islands seen from above, cartoon digital painting"),
]

if __name__ == "__main__":
    only = int(sys.argv[1]) if len(sys.argv) > 1 else None
    for i, (src, prompt) in enumerate(JOBS):
        if only is not None and i != only:
            continue
        base, ext = os.path.splitext(src)
        dst = base + ".169" + ext
        # los masters 3:2 viven en old/ tras la primera generación
        old_src = os.path.join(os.path.dirname(src), "old", os.path.basename(src))
        if not os.path.exists(src) and os.path.exists(old_src):
            src = old_src
        if os.path.exists(dst):
            print("ya existe, salto:", dst)
            continue
        print(f"=== [{i+1}/{len(JOBS)}] {src}")
        outpaint(src, dst, prompt)
    print("HECHO")
