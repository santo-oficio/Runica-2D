---
name: board-detect
description: Detectar y calibrar el tablero 8x6 de un fondo con MobileSAM y la demo visual.
---

# Detección y calibración de tableros

Los fondos de este proyecto (`assets/backgrounds/<MUNDO>/bg_01.png`) ya tienen
el tablero **8×6 dibujado**. Este skill cubre cómo localizarlo y calibrarlo.

## 1. Detectar con MobileSAM (referencia, no fiable para todos los mundos)

```bash
.sam-venv\Scripts\python.exe background/sam-detect.py \
  assets/backgrounds/<MUNDO>/bg_01.png <MUNDO> \
  assets/backgrounds/<MUNDO>/board-detection.json
```

- Usa el checkpoint `models/mobile_sam.pt` (~40MB).
- Prueba ~270 cajas candidatas y elige la mejor máscara por aspecto **8:6**,
  rectangularidad y fuerza del grid interno.
- Escribe `board-detection.json` con `boardArea` normalizado (0.0–1.0).
- ⚠️ MobileSAM da resultados inconsistentes entre mundos. La calibración fiable
  es **manual** (sección 2).

## 2. Calibrar con la demo visual (método recomendado)

```bash
npx tsx demo-server.ts
```

Abrir http://localhost:3000 y calibrar cada mundo. Cada mundo guarda **dos áreas**
en su `board-detection.json`:

- `boardArea` — tablero para losas/obstáculos/trampas.
- `avatarArea` — tablero para avatar/enemigos/meta (independiente del anterior).

Controles:

| Tecla | Acción |
|---|---|
| **Arrastrar ratón** | Definir el tablero del modo activo (esquina sup-izq → inf-der) |
| **Flechas** | Mover todo el conjunto (Shift = paso fino) |
| **+ / −** | Agrandar / reducir el conjunto |
| **G** | Guardar el área del modo activo, solo ese mundo |
| **A** | Alternar modo AVATAR / LOSAS |
| **Espacio** | Cambiar de mundo |
| **L** | Mostrar/ocultar rejilla |

Las coordenadas se guardan normalizadas respecto a la **imagen visible**
(descontando el letterbox de `object-fit: contain`).

## 3. Informe de casillas (solo lectura)

```bash
npx tsx tools/detect-cells.ts [MUNDO]
```

## Datos clave

- Tablero fijo: **8 columnas × 6 filas**.
- Fondos en `bg_01.png` a **7680×4320 (8K)**. MAZMORRA, ESPACIO y HIELO
  fueron reescalados desde resoluciones menores, por lo que su calidad real es
  inferior. Los antiguos están en `bg_01_old.png`.
- No recortar ni modificar las imágenes; solo se guarda metadatos JSON.
