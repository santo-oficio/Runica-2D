# URLs de calibración

Servidor: `npx tsx demo-server.ts` → base `http://localhost:3000`

## Tablero (por mundo)

| URL | Qué calibra | Datos |
|---|---|---|
| http://localhost:3000/calibrate-board-sprites.html | Sprites: avatar / enemigos / boss / trampas / salidas / obstáculos (teclas 1-6) + áreas del tablero (modo TABLERO) | `assets/backgrounds/<M>/sprites.json`, `board-detection.json` |
| http://localhost:3000/calibrate-board-texts.html | 6 textos del tablero: turno, nº turno, óptimo, nº óptimo, info, oro (dinámicos i18n; la fuente se auto-ajusta al área) | `assets/backgrounds/<M>/text-areas.json` |
| http://localhost:3000/demo.html | Áreas del tablero: `boardArea` (losas) y `avatarArea` (avatar/enemigos/meta) — calibrador original | `assets/backgrounds/<M>/board-detection.json` |

## Submundos (por mundo)

| URL | Qué calibra | Datos |
|---|---|---|
| http://localhost:3000/calibrate-submundos.html | Posición del avatar en los 12 niveles + tamaño por cada uno de los 8 avatares | `assets/submundos/<M>/avatar-positions.json` |
| http://localhost:3000/calibrate-submundos-text.html | 3 textos del submundo: nombre del mundo, "Nivel X/12" y oro (dinámicos i18n) | `assets/submundos/<M>/text-areas.json` |

## Instrucciones

| URL | Qué calibra | Datos |
|---|---|---|
| http://localhost:3000/calibrate-instructions.html | Área del pergamino de texto (preview i18n real) + botón atrás redondo `{cx,cy,r}` (tecla B; el botón es solo el área, el dibujo está en la imagen) | `assets/instrucciones/instructions-areas.json` |

## Menú principal

| URL | Qué calibra | Datos |
|---|---|---|
| http://localhost:3000/calibrate-menu.html | Botones/áreas del menú principal | `assets/menu principal/menu-buttons.json` |
| http://localhost:3000/calibrate-menu-poly.html | Polígonos del menú | `assets/menu principal/` |
| http://localhost:3000/calibrate-menu-standalone.html | Menú (versión standalone) | `assets/menu principal/` |
| http://localhost:3000/calibrate-text.html | Áreas de texto del menú | `assets/menu principal/menu-texto.json` |

## Selección de personaje

| URL | Qué calibra | Datos |
|---|---|---|
| http://localhost:3000/calibrate-selection-avatars.html | Avatares / cuadros / bordes / cuerpo completo | `assets/menu principal/character-positions.json` |
| http://localhost:3000/calibrate-selection-buttons.html | Teclas y flechas de la pantalla de nombre | `assets/menu principal/selection-buttons.json` |
| http://localhost:3000/calibrate-selection-name.html | Zona del nombre | `assets/menu principal/selection-name-area.json` |
| http://localhost:3000/calibrate-selection-global.html | Ajuste global de la pantalla de selección | `assets/menu principal/` |

## Mapamundi

| URL | Qué calibra | Datos |
|---|---|---|
| http://localhost:3000/calibrate-mapamundi.html | Áreas/botones del mapamundi | `assets/mapamundi/menu-buttons.json`, `menu-texto.json` |
| http://localhost:3000/calibrate-paths.html | Caminos entre mundos | `assets/mapamundi/world-paths.json` |

## Losas / rejilla (antiguos)

| URL | Qué calibra | Datos |
|---|---|---|
| http://localhost:3000/calibrate-losas.html | Losas del tablero | `assets/backgrounds/<M>/losas.json` |
| http://localhost:3000/calibrate-cells.html | Celdas | `assets/backgrounds/<M>/` |
| http://localhost:3000/calibrate-grid.html | Esquinas de la rejilla | `assets/backgrounds/<M>/grid-corners.json` |

## Demos (no calibran, pero sirven para comprobar)

| URL | Qué hace |
|---|---|
| http://localhost:3000/demo-play.html | Demo jugable: pantalla al azar del tier 1 |
| http://localhost:3000/demo-menu.html | Menú principal |
| http://localhost:3000/demo-seleccion-personaje.html | Selección de personaje |
| http://localhost:3000/instructions.html | Pantalla de instrucciones (usa el área calibrada) |
| http://localhost:3000/submundo.html | Submundo (usa avatar-positions + text-areas) |
