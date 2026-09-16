---
name: Runika 2D-workflow
description: Comandos y arquitectura del proyecto Runika 2D (typecheck, tests, demo, mundos).
---

# Runika 2D — flujo de trabajo del proyecto

Juego de puzle determinista. TypeScript puro + Vitest, Node ≥ 20, ESM.

## Comandos

```bash
npm run typecheck   # tsc --noEmit (strict + noUncheckedIndexedAccess)
npm test            # vitest (300 tests, 13 archivos)
npx tsx demo-server.ts  # demo visual + demo jugable en http://localhost:3000
```

## Demos

- `demo.html` — calibración manual de tableros (arrastrar ratón, `G` guardar).
- `demo-play.html` — demo jugable: pantalla al azar del tier 1 (`/api/demo-screen?tier=1`),
  mundo al azar, sin persistencia. Controles: `Flechas/WASD` mover, `R` otra
  pantalla, `Espacio` cambiar mundo, `Enter` cambiar avatar.

## Arquitectura

- `engine/` — motor de reglas determinista (`playTurn`, `isLevelSolved`, etc.).
- `generator/` — generación procedural por seed (14 tiers de dificultad).
- `solver/` — validador (32 tests) + BFS solver que reutiliza el motor.
- `worlds/` — WorldConfigs, banco de niveles, renderizado ASCII.
- `background/` — detección de tableros con MobileSAM (`sam-detect.py`).
- `layout/` — cálculo de rejilla y screen layout.
- `schemas/` — tipos y validadores JSON.
- `assets/backgrounds/` — imágenes + `board-detection.json` por mundo.

## Mundos (8)

ESPACIO, AGUA, TIERRA, FUEGO, HIELO, VIENTO, INFRAMUNDO, MAZMORRA.

## Reglas clave

- El solver reutiliza LITERALMENTE el motor de reglas (no hay lógica duplicada).
- Añadir un mundo = solo datos (WorldConfig + BackgroundTemplates).
- Tablero fijo **8×6** (8 columnas × 6 filas); `allowedBoardSizes` = `[[8,6]]`.
- **14 niveles de dificultad**; **32 tests** de validación; máximo **3 enemigos** por pantalla.
- ESM imports usan `.js` en TypeScript source.

## Reglas "a fuego"

- **Sin solapamiento inicial**: al comenzar un nivel, ninguna casilla puede
  tener más de un item (jugador, enemigo, obstáculo, trampa, llave o meta).
- **Sin dificultad absurda**: un nivel fácil no es un nivel vacío. La
  dificultad baja = menos elementos y patrones simples, nunca elementos
  irrelevantes o desconectados del reto.
- **Trampa (`T`)**: aturde 3 turnos a quien la pisa (jugador o enemigo), de
  forma individual por entidad.
- **A fuego — los enemigos SIEMPRE se mueven**: no hay enemigos estáticos ni de
  vigilancia. Todo enemigo persigue al jugador (`CHASE`), 2 pasos/turno,
  horizontal primero. Solo se detiene temporalmente si queda aturdido por una
  trampa (3 turnos). Patrón `VIGILANCIA`/`VIGILANCIA_ZONA` prohibido.
- **Obstáculo (`X`)**: bloquea el 100% de su casilla, igual que una pared.
- **Obstáculos visuales por mundo**: la imagen de cada obstáculo se elige al azar
  de `assets/obstaculos/<MUNDO>/` sin repetir mientras sea posible. Mapeo especial:
  `VIENTO`→`AIRE/`, `MAZMORRA`→`MAZMORRA/`.
- **Curva de dificultad**: 8 mundos × 15 subniveles = 120 juegos, 14 tiers,
  curva no lineal p=0.6. Ver `docs/15-TABLA-CURVA-DIFICULTAD-120-JUEGOS.md`.
