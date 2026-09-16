import cv2
import numpy as np
import torch
from mobile_sam import sam_model_registry, SamAutomaticMaskGenerator

img = cv2.imread("avatares.jpg")
img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
h, w = img.shape[:2]
print(f"Imagen: {w}x{h}")

device = "cuda" if torch.cuda.is_available() else "cpu"
sam = sam_model_registry["vit_t"]("models/mobile_sam.pt")
sam.to(device)

mask_generator = SamAutomaticMaskGenerator(sam)
masks = mask_generator.generate(img)

print(f"\n{len(masks)} mascaras generadas")
# Filtrar por area y ordenar
masks = [m for m in masks if m["area"] > 1000]
masks.sort(key=lambda m: -m["area"])

for i, m in enumerate(masks[:40]):
    x, y, bw, bh = m["bbox"]
    print(f"  [{i}] x={x} y={y} w={bw} h={bh} area={m['area']} stability={m['predicted_iou']:.2f}")

# Dibujar
vis = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
for i, m in enumerate(masks[:40]):
    x, y, bw, bh = m["bbox"]
    cv2.rectangle(vis, (x, y), (x+bw, y+bh), (0, 255, 0), 2)
    cv2.putText(vis, str(i), (x, y-5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,255,0), 1)
cv2.imwrite("debug/avatares-sam.png", vis)
print("\nGuardado debug/avatares-sam.png")
