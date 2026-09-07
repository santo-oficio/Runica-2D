---
name: grido-workflow
description: Comandos y arquitectura del proyecto Grido (typecheck, tests, demo, mundos).
---

# Grido — flujo de trabajo del proyecto

Juego de puzle determinista. TypeScript puro + Vitest, Node ≥ 20, ESM.

## Comandos

```bash
npm run typecheck   # tsc --noEmit (strict + noUncheckedIndexedAccess)
npm test            # vitest (300 tests, 13 archivos)
npx tsx demo-server.ts  # demo visual en http://localhost:3000
```

## Arquitectura

- `engine/` — motor de reglas determinista (`playTurn`, `isLevelSolved`, etc.).
- `generator/` — generación procedural por seed.
- `solver/` — validador (10 chequeos) + BFS solver que reutiliza el motor.
- `worlds/` — WorldConfigs, banco de niveles, renderizado ASCII.
- `background/` — detección de tableros con MobileSAM (`sam-detect.py`).
- `layout/` — cálculo de rejilla y screen layout.
- `schemas/` — tipos y validadores JSON.
- `assets/backgrounds/` — imágenes + `board-detection.json` por mundo.

## Mundos (8)

ESPACIO, AGUA, TIERRA, FUEGO, HIELO, VIENTO, INFRAMUNDO, CASTILLO_FINAL.

## Reglas clave

- El solver reutiliza LITERALMENTE el motor de reglas (no hay lógica duplicada).
- Añadir un mundo = solo datos (WorldConfig + BackgroundTemplates).
- Tablero fijo 6×5; `allowedBoardSizes` = `[[6,5]]`.
- ESM imports usan `.js` en TypeScript source.
