# Grido — Wappo Infinito

Juego de puzle determinista inspirado en Wappo. TypeScript puro + Vitest, Node ≥ 20, ESM.

## Comandos

```bash
npm run typecheck   # tsc --noEmit (strict + noUncheckedIndexedAccess)
npm test            # vitest (300 tests, 13 archivos)
npx tsx demo-server.ts  # demo visual en http://localhost:3000
```

## Detección de tableros con MobileSAM

```bash
# Detectar tablero de un mundo (escribe board-detection.json)
.sam-venv\Scripts\python.exe background/sam-detect.py assets/backgrounds/<MUNDO>/bg_01.jpg <MUNDO> assets/backgrounds/<MUNDO>/board-detection.json

# Informe de casillas (solo lectura)
npx tsx tools/detect-cells.ts [MUNDO]
```

- Modelo: `models/mobile_sam.pt` (MobileSAM TinyViT, ~40MB).
- Entorno Python: `.sam-venv` (torch 2.1.2+cu121, opencv 4.8, numpy 1.26).
- Los 8 mundos comparten el mismo `boardArea` calibrado:
  `{ x: 0.297962, y: 0.259115, width: 0.403343, height: 0.609375 }`
- Tablero fijo: 6 columnas × 5 filas. No se generan tableros nuevos al azar.

## Mundos

ESPACIO, AGUA, TIERRA, FUEGO, HIELO, VIENTO, INFRAMUNDO, CASTILLO_FINAL.

Todos con imágenes de 1376×768px en `assets/backgrounds/<MUNDO>/bg_01.jpg`.

## Arquitectura

- `engine/` — motor de reglas determinista (playTurn, isLevelSolved, etc.).
- `generator/` — generación procedural de niveles por seed.
- `solver/` — validador (10 chequeos) + BFS solver que reutiliza el motor.
- `worlds/` — WorldConfigs, banco de niveles, renderizado ASCII.
- `background/` — detección de tableros con SAM (Python).
- `layout/` — cálculo de rejilla y screen layout.
- `schemas/` — tipos y validadores JSON.
- `assets/backgrounds/` — imágenes de fondo + `board-detection.json`.

## Reglas clave

- El solver reutiliza LITERALMENTE el motor de reglas (no hay lógica duplicada).
- Añadir un mundo = solo datos (WorldConfig + BackgroundTemplates).
- Las imágenes de fondo no se recortan ni modifican.
- ESM imports usan `.js` en TypeScript source.
