import os
from PIL import Image

BASE = r'C:\Proyectos personales\Runika 2D\assets\backgrounds'
OUT = r'C:\Proyectos personales\Runika 2D\debug\crops'
os.makedirs(OUT, exist_ok=True)

WORLDS = ['AGUA', 'MAZMORRA', 'ESPACIO', 'FUEGO', 'HIELO', 'INFRAMUNDO', 'TIERRA', 'VIENTO']

# Board: x=0.297962, y=0.259115, w=0.403343, h=0.609375
# Crop a wide band: from top of image to 15% down, full width
# This should capture any text above the panel

for world in WORLDS:
    path = os.path.join(BASE, world, 'bg_01.png')
    img = Image.open(path)
    w, h = img.size
    
    # Top 15% of image, full width
    crop = img.crop((0, 0, w, int(h * 0.15)))
    # Resize down to manageable size for display
    crop_small = crop.resize((1920, int(crop.height * 1920 / crop.width)), Image.LANCZOS)
    out_path = os.path.join(OUT, f'{world}_top.png')
    crop_small.save(out_path, 'PNG')
    print(f'{world}: {crop.size} -> {crop_small.size} -> {out_path}')

print('\nDone!')
