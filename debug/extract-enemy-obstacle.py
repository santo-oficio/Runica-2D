import os
import cv2
import numpy as np
import torch
from mobile_sam import sam_model_registry, SamAutomaticMaskGenerator

os.makedirs("debug/extract", exist_ok=True)

for src, label in [("assets/enemys/enemy_agua.jpg", "enemy"), ("assets/obstaculos/coral.jpg", "obstacle")]:
    img_bgr = cv2.imread(src)
    img = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    h, w = img.shape[:2]
    print(f"\n=== {src} ({w}x{h}) ===")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    sam = sam_model_registry["vit_t"]("models/mobile_sam.pt")
    sam.to(device)
    mask_generator = SamAutomaticMaskGenerator(sam)
    masks = mask_generator.generate(img)

    candidates = [m for m in masks if 2000 < m["area"] < 300000]
    candidates.sort(key=lambda m: -m["area"])

    print(f"  {len(candidates)} candidatos:")
    for i, m in enumerate(candidates[:10]):
        x, y, bw, bh = m["bbox"]
        print(f"    [{i}] x={int(x)} y={int(y)} w={int(bw)} h={int(bh)} area={m['area']}")

    # Guardar overlay con los mejores candidatos
    vis = img_bgr.copy()
    for i, m in enumerate(candidates[:6]):
        x, y, bw, bh = [int(v) for v in m["bbox"]]
        cv2.rectangle(vis, (x, y), (x+bw, y+bh), (0, 255, 0), 3)
        cv2.putText(vis, str(i), (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0,255,0), 3)
    out = f"debug/extract/{label}_overlay.png"
    cv2.imwrite(out, vis)
    print(f"  -> {out}")

    # Recortar los 4 mejores candidatos individuales
    for i, m in enumerate(candidates[:4]):
        mask = m["segmentation"].astype(np.uint8) * 255
        x, y, bw, bh = [int(v) for v in m["bbox"]]
        crop = img_bgr[y:y+bh, x:x+bw]
        crop_mask = mask[y:y+bh, x:x+bw]
        rgba = cv2.cvtColor(crop, cv2.COLOR_BGR2BGRA)
        rgba[:, :, 3] = crop_mask
        out = f"debug/extract/{label}_{i}.png"
        cv2.imwrite(out, rgba)
        print(f"    -> {out} ({bw}x{bh})")

print("\nRevisa debug/extract/")
