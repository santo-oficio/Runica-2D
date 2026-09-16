import pytesseract
import os

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
from PIL import Image

BASE = r'C:\Proyectos personales\Runika 2D\assets\backgrounds'
WORLDS = ['AGUA', 'MAZMORRA', 'ESPACIO', 'FUEGO', 'HIELO', 'INFRAMUNDO', 'TIERRA', 'VIENTO']

# Board: x=0.297962, y=0.259115, w=0.403343, h=0.609375
# Text is "above the panel border" - scan a thin strip just above board top

for world in WORLDS:
    path = os.path.join(BASE, world, 'bg_01.png')
    img = Image.open(path)
    w, h = img.size
    board_top = int(0.259115 * h)
    board_left = int(0.297962 * w)
    board_right = int((0.297962 + 0.403343) * w)
    
    # Thin strip: 300px above board top to 50px below, full board width
    y1 = max(0, board_top - 300)
    y2 = board_top + 50
    x1 = max(0, board_left - 100)
    x2 = min(w, board_right + 100)
    
    crop = img.crop((x1, y1, x2, y2))
    # Upscale 3x for better OCR
    crop_big = crop.resize((crop.width * 3, crop.height * 3), Image.LANCZOS)
    
    # PSM 7 = single line of text, PSM 8 = single word
    for psm in [7, 8, 11, 3]:
        text = pytesseract.image_to_string(crop_big, config=f'--psm {psm}').strip()
        if text and any(c.isalpha() for c in text):
            print(f'{world} PSM={psm}: {text!r} (strip y={y1}-{y2} x={x1}-{x2})')
            break
    else:
        print(f'{world}: (no text detected)')
