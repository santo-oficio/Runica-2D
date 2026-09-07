---
name: board-detect
description: Detectar y calibrar el tablero 6x5 de un fondo con MobileSAM y la demo visual.
---

# Detección y calibración de tableros

Los fondos de este proyecto (`assets/backgrounds/<MUNDO>/bg_01.jpg`) ya tienen
el tablero **6×5 dibujado**. Este skill cubre cómo localizarlo y calibrarlo.

## 1. Detectar con MobileSAM

```bash
.sam-venv\Scripts\python.exe background/sam-detect.py \
  assets/backgrounds/<MUNDO>/bg_01.jpg <MUNDO> \
  assets/backgrounds/<MUNDO>/board-detection.json
```

- Usa el checkpoint `models/mobile_sam.pt` (~40MB).
- Prueba ~270 cajas candidatas y elige la mejor máscara por aspecto 6:5,
  rectangularidad y fuerza del grid interno.
- Escribe `board-detection.json` con `boardArea` normalizado (0.0–1.0).

## 2. Calibrar con la demo visual

```bash
npx tsx demo-server.ts
```

Abrir http://localhost:3000 y calibrar:

- `Flechas/WASD` — mover el selector de casilla.
- `Shift + Flechas` — mover la rejilla (ajuste fino).
- `Ctrl + Flechas` — escalar la rejilla.
- `C` — formulario para píxeles exactos (left/top/width/height).
- `G` — guardar el ajuste.
- `Espacio` — cambiar de mundo.

## 3. Informe de casillas (solo lectura)

```bash
npx tsx tools/detect-cells.ts [MUNDO]
```

## Datos clave

- Imagen: 1376×768 px.
- Tablero fijo: 6 columnas × 5 filas.
- Los 8 mundos comparten la `boardArea` calibrada:
  `{ "x": 0.297962, "y": 0.259115, "width": 0.403343, "height": 0.609375 }`.
- No recortar ni modificar las imágenes; solo se guarda metadatos JSON.
