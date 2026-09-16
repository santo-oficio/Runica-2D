import pytesseract
import os

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
from PIL import Image

BASE = r'C:\Proyectos personales\Runika 2D\assets\backgrounds'
WORLDS = ['AGUA', 'MAZMORRA', 'ESPACIO', 'FUEGO', 'HIELO', 'INFRAMUNDO', 'TIERRA', 'VIENTO']

for world in WORLDS:
    path = os.path.join(BASE, world, 'bg_01.png')
    img = Image.open(path)
    w, h = img.size
    top = img.crop((0, 0, w, int(h * 0.12)))
    data = pytesseract.image_to_data(top, output_type=pytesseract.Output.DICT)
    print(f'\n=== {world} ({w}x{h}) ===')
    for i in range(len(data['text'])):
        t = data['text'][i].strip()
        if t:
            print(f'  text={t!r} x={data["left"][i]} y={data["top"][i]} w={data["width"][i]} h={data["height"][i]} conf={data["conf"][i]}')
