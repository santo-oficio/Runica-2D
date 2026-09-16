import pytesseract
import os

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
from PIL import Image, ImageEnhance

BASE = r'C:\Proyectos personales\Runika 2D\assets\backgrounds'
WORLDS = ['AGUA', 'MAZMORRA', 'ESPACIO', 'FUEGO', 'HIELO', 'INFRAMUNDO', 'TIERRA', 'VIENTO']

# Board area: x=0.297962, y=0.259115, w=0.403343, h=0.609375
# "Arriba del panel" = justo encima o en el borde superior del panel
# Vamos a escanear una banda alrededor del borde superior del panel

for world in WORLDS:
    path = os.path.join(BASE, world, 'bg_01.png')
    img = Image.open(path)
    w, h = img.size
    
    # Board top edge is at y = 0.259115 * h
    board_top = int(0.259115 * h)
    board_left = int(0.297962 * w)
    board_right = int((0.297962 + 0.403343) * w)
    
    # Scan a band from 50px above board top to 100px below
    y1 = max(0, board_top - 200)
    y2 = min(h, board_top + 200)
    x1 = max(0, board_left - 200)
    x2 = min(w, board_right + 200)
    
    crop = img.crop((x1, y1, x2, y2))
    
    # Try with upscaling for better OCR
    crop_big = crop.resize((crop.width * 2, crop.height * 2), Image.LANCZOS)
    enhancer = ImageEnhance.Contrast(crop_big)
    crop_enhanced = enhancer.enhance(2.0)
    
    # Try multiple PSM modes
    for psm in [3, 6, 7, 8, 11]:
        data = pytesseract.image_to_data(crop_enhanced, config=f'--psm {psm}', output_type=pytesseract.Output.DICT)
        texts = []
        for i in range(len(data['text'])):
            t = data['text'][i].strip()
            if t and len(t) > 1:
                texts.append(t)
        if texts:
            print(f'\n=== {world} PSM={psm} (band y={y1}-{y2}, x={x1}-{x2}) ===')
            for i in range(len(data['text'])):
                t = data['text'][i].strip()
                if t:
                    abs_x = x1 + data['left'][i] // 2
                    abs_y = y1 + data['top'][i] // 2
                    print(f'  text={t!r} abs_x={abs_x} abs_y={abs_y} w={data["width"][i]//2} h={data["height"][i]//2} conf={data["conf"][i]}')
            break  # Only show first PSM that finds text
