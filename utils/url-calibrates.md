# URLs de calibración

Servidor: `npx tsx server.ts` → base `http://localhost:3000`

## Tablero (por mundo)

| URL | Qué calibra | Datos |
|---|---|---|
| http://localhost:3000/calibrate-board-sprites.html | Sprites: avatar / enemigos / boss / trampas / salidas / obstáculos (teclas 1-6) + áreas del tablero (modo TABLERO) | `assets/backgrounds/<M>/sprites.json`, `board-detection.json` |
| http://localhost:3000/calibrate-board-texts.html | 6 textos del tablero: turno, nº turno, óptimo, nº óptimo, info, oro (dinámicos i18n; la fuente se auto-ajusta al área) | `assets/backgrounds/<M>/text-areas.json` |
| http://localhost:3000/calibrate-areas.html | Áreas del tablero: `boardArea` (losas) y `avatarArea` (avatar/enemigos/meta) — calibrador original | `assets/backgrounds/<M>/board-detection.json` |

## Submundos (por mundo)

| URL | Qué calibra | Datos |
|---|---|---|
| http://localhost:3000/calibrate-submundos.html | Posición del avatar en los 12 niveles + tamaño por cada uno de los 8 avatares | `assets/submundos/<M>/avatar-positions.json` |
| http://localhost:3000/calibrate-submundos-text.html | 3 textos del submundo: nombre del mundo, "Nivel X/12" y oro (dinámicos i18n) | `assets/submundos/<M>/text-areas.json` |

## Instrucciones

| URL | Qué calibra | Datos |
|---|---|---|
| http://localhost:3000/calibrate-instructions.html | Área del pergamino de texto (preview i18n real) + botón atrás redondo `{cx,cy,r}` (tecla B; el botón es solo el área, el dibujo está en la imagen) | `assets/instrucciones/instructions-areas.json` |

## Créditos

| URL | Qué calibra | Datos |
|---|---|---|
| http://localhost:3000/calibrate-creditos.html | Texto título + texto créditos (previews i18n, fuente auto-ajustada) + botón atrás redondo `{cx,cy,r}` (tecla B) | `assets/creditos/creditos-areas.json` |

## Modal (común)

| URL | Qué calibra | Datos |
|---|---|---|
| http://localhost:3000/calibrate-modal.html | Textos del modal: `title` (**polígono** siguiendo el arco del cartel — el texto se previsualiza curvado sobre la circunferencia ajustada), `content`, `buttonLeft`, `buttonRight` (rectángulos). Mismas teclas que el resto de calibradores | `assets/comunes/modal-areas.json` |
| http://localhost:3000/calibrate-modal.html?which=reintentar | Modal de derrota (`modal-reintentar.webp`): `title` (polígono), `content`, `buttonCenter`, `buttonCenterBorder` (un solo botón) | `assets/comunes/modal-reintentar-areas.json` |
| http://localhost:3000/calibrate-config.html | Pantalla de configuración: `soundText`/`soundCheck`, `musicText`/`musicCheck`, `langText` (rectángulos) + `langLeft`/`langRight`/`back` (**polígonos**) | `assets/configuracion/config-areas.json` |

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
| http://localhost:3000/calibrate-mapamundi-text.html | Textos del mapamundi: oro (preview dorado, fuente auto-ajustada) | `assets/mapamundi/text-areas.json` |

## Losas / rejilla (antiguos)

| URL | Qué calibra | Datos |
|---|---|---|
| http://localhost:3000/calibrate-losas.html | Losas del tablero | `assets/backgrounds/<M>/losas.json` |
| http://localhost:3000/calibrate-cells.html | Celdas | `assets/backgrounds/<M>/` |
| http://localhost:3000/calibrate-grid.html | Esquinas de la rejilla | `assets/backgrounds/<M>/grid-corners.json` |

## Pantallas del juego (no calibran)

| URL | Qué hace |
|---|---|
| http://localhost:3000/game.html | Modo práctica: pantalla al azar del tier 1. Con `?world=X&level=N` = modo real (isla del submundo, guarda progreso/oro en bbdd) |
| http://localhost:3000/menu.html | Menú principal |
| http://localhost:3000/seleccion-personaje.html | Selección de personaje |
| http://localhost:3000/instructions.html | Pantalla de instrucciones (usa el área calibrada) |
| http://localhost:3000/creditos.html | Pantalla de créditos (usa `creditos-areas.json`) |
| http://localhost:3000/submundo.html | Submundo (usa avatar-positions + text-areas) |
| http://localhost:3000/ajustes.html | Pantalla de configuración real (usa `config-areas.json`); guarda `db/settings.json` vía `/api/settings` — sonido, música e idioma se aplican a todo el juego |
| http://localhost:3000/fin.html | Cinemática del final del juego: boss final cae → tablero se desmorona → mapamundi con los 8 mundos derrumbándose en cadena → final épico (letras pop, monedas, fuegos artificiales). Usa `load-avatar-positions` + `fin-areas.json` |
| http://localhost:3000/calibrate-fin.html | Fin del juego: **círculos** sobre cada mundo del mapa (el aura irregular se genera sola vía `auraPoints`) + rectángulos hero/boss en la escena del tablero | `assets/comunes/fin-areas.json` |
| http://localhost:3000/demo-mapa-victoria.html | Demo de victoria sin jugar — "mapa": `mapamundi.html?demo=<M>` finge el mundo conquistado (B/N + avatar encima) + celebración (anillos/chispas/rótulo vía `runika-world-done`); "tablero": `game.html?demo=win` auto-gana una pantalla de práctica y muestra monedas + modal; "boss": `game.html?demo=winboss` misma victoria con celebración de guardián; "boss final": `game.html?demo=winfinal` idem pero Continuar navega a `fin.html` (cinemática final). Nada escribe en la bbdd | (no guarda datos) |
| http://localhost:3000/demo-musica.html | Demo de música por submundo — selector de mundo carga `submundo.html?world=<M>` en iframe (cada submundo suena con `assets/music/<M>/submundo.mp3`, fallback `mistery.mp3`); "Volver al mapamundi" carga `mapamundi.html` para comprobar que retoma el tema principal. Respeta `settings.music`. No escribe en la bbdd | (no guarda datos) |
| http://localhost:3000/demo-boss-run.html | Demo de partida real a boss de mundo — `game.html?world=<M>&level=11&demo=bossrun` en iframe: modo real completo (boss sprites, HUD, modal derrota/victoria, celebración, fanfarria `worldWin`) pero pantalla de `practice-screen?tier=14` y sin `level-complete`; Continuar va a `mapamundi.html?demo=<M>` (celebración + B/N). No escribe en la bbdd | (no guarda datos) |
