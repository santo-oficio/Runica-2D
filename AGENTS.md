# Runika 2D

Juego de puzle determinista por turnos en rejilla. TypeScript puro + Vitest, Node ≥ 20, ESM.

## Comandos

```bash
npm run typecheck   # tsc --noEmit (strict + noUncheckedIndexedAccess)
npm test            # vitest (300 tests, 13 archivos)
npx tsx server.ts  # juego y calibradores en http://localhost:3000
```

## Modo práctica (`game.html`)

`http://localhost:3000/game.html` — modo práctica que elige una pantalla
**al azar** del tier 4 (endpoint `/api/practice-screen?tier=N`) en cada recarga y un
mundo al azar. **No guarda nada en la bbdd** (solo lectura).

Controles: `Flechas/WASD` mover · `R` otra pantalla · `Espacio` cambiar mundo ·
`Enter` cambiar avatar.

## Generación de música local (MusicGen)

```bash
.sam-venv\Scripts\python.exe tools/gen-music.py "prompt en inglés" [segundos] [salida.wav]
```

- **MusicGen** (Meta `audiocraft` 1.3.0) instalado en `.sam-venv` — modelo
  `facebook/musicgen-small` (~3.3 GB en `~/.cache/huggingface`), corre en la
  RTX 3060 por CUDA. Primera ejecución descarga el modelo.
- Ejemplo submundo:
  `tools/gen-music.py "caribbean pirate adventure music, steel drums, marimba, acoustic guitar, cheerful, loop-friendly" 20 assets/music/<MUNDO>/submundo.wav`
- Salida WAV 32 kHz; convertir a mp3/ogg con ffmpeg antes de usarla como
  `submundo.mp3` (o renombrar/referenciar `.wav` — el navegador lo soporta).
- Flags: `--seed` (reproducible), `--model`, `--cfg-coef` (fuerza del prompt),
  `--top-k/--top-p/--temperature`.
- Nota entorno: audiocraft se instaló `--no-deps` para no romper torch
  2.1.2+cu121; `av` quedó en v18 (la pin 11.0.0 no tiene wheel win/py311);
  transformers fijado a 4.49.0 (5.x exige torch≥2.5). NO actualizar esos
  paquetes sin probar `import torch` + `MusicGen.get_pretrained` después.

## Detección de tableros

```bash
# Detectar tablero de un mundo (escribe board-detection.json)
.sam-venv\Scripts\python.exe background/sam-detect.py assets/backgrounds/<MUNDO>/bg_01.webp <MUNDO> assets/backgrounds/<MUNDO>/board-detection.json

# Informe de casillas (solo lectura)
npx tsx tools/detect-cells.ts [MUNDO]
```

- Modelo: `models/mobile_sam.pt` (MobileSAM TinyViT, ~40MB).
- Entorno Python: `.sam-venv` (torch 2.1.2+cu121, opencv 4.8, numpy 1.26).
- Tablero fijo: **8 columnas × 6 filas** (48 casillas). No se generan tableros nuevos al azar.
- La calibración es **manual por mundo** (no se usa SAM automático de forma fiable):
  abrir `calibrate-areas.html`, arrastrar el ratón sobre el tablero y pulsar `G`.

## Calibración manual (`calibrate-areas.html`)

`npx tsx server.ts` → http://localhost:3000. Cada mundo guarda **dos áreas**
normalizadas en su `board-detection.json`:

- `boardArea` — tablero para **losas/obstáculos/trampas**.
- `avatarArea` — tablero para **avatar/enemigos/meta** (puede diferir del anterior).

Controles en `calibrate-areas.html`:

| Tecla | Acción |
|---|---|
| **Arrastrar ratón** | Definir el tablero del modo activo (esquina sup-izq → inf-der) |
| **Flechas** | Mover todo el conjunto (Shift = paso fino) |
| **+ / −** | Agrandar / reducir el conjunto |
| **G** | Guardar el área del modo activo, solo ese mundo |
| **A** | Alternar modo AVATAR (guarda `avatarArea`) / LOSAS (guarda `boardArea`) |
| **Espacio** | Cambiar de mundo |
| **L** | Mostrar/ocultar rejilla |

Las coordenadas se guardan normalizadas respecto a la **imagen visible** (se
descuenta el letterbox de `object-fit: contain`).

## Calibración de sprites y textos del tablero

Todo es **data-driven por mundo**: cada calibración vive en un JSON dentro de
`assets/backgrounds/<MUNDO>/` o `assets/submundos/<MUNDO>/` y el juego la consume
dinámicamente. Coordenadas normalizadas 0–1 respecto a la imagen.

| Calibrador | Datos que guarda |
|---|---|
| `calibrate-board-sprites.html` | `assets/backgrounds/<M>/sprites.json` + `board-detection.json` |
| `calibrate-board-texts.html` | `assets/backgrounds/<M>/text-areas.json` |
| `calibrate-submundos.html` | `assets/submundos/<M>/avatar-positions.json` |
| `calibrate-submundos-text.html` | `assets/submundos/<M>/text-areas.json` |
| `calibrate-instructions.html` | `assets/instrucciones/instructions-areas.json` |
| `calibrate-creditos.html` | `assets/creditos/creditos-areas.json` (título + créditos + botón atrás circular) |
| `calibrate-mapamundi-text.html` | `assets/mapamundi/text-areas.json` |
| `calibrate-modal.html` | `assets/comunes/modal-areas.json` (`title` = polígono sobre el arco del cartel + `content`/`buttonLeft`/`buttonRight` rectángulos) |
| `calibrate-config.html` | `assets/configuracion/config-areas.json` (textos/casillas sonido+música rectángulos; flechas idioma y atrás = polígonos) |
| `calibrate-fin.html` | `assets/comunes/fin-areas.json` — fin del juego: **círculos** `{cx,cy,r}` por mundo (el aura irregular la genera `AssetsCache.auraPoints` de forma determinista) + rectángulos `hero`/`boss` del tablero final |

### `calibrate-board-sprites.html` — sprites + áreas

Calibración **independiente por mundo, tipo e instancia**:
`sprites.json` = `{ world, global:{offsetX,offsetY,scale}, avatar[8], enemy[],
boss[], trap[], exit[], obstacle[] }`, cada entrada `{size, offsetX, offsetY}`
(size = fracción de casilla; offset = fracción de casilla desde el centro).

- Tipos: `1` avatar · `2` enemy · `3` boss · `4` trap · `5` exit · `6` obstacle.
  Trampas y obstáculos usan `boardArea`; el resto `avatarArea`.
- `M` cicla modos **Sprite → GLOBAL → TABLERO**. GLOBAL mueve/escala todos los
  tipos juntos; TABLERO edita `boardArea`/`avatarArea` (arrastrar, `A` alterna,
  `Q/E` ancho, `+/-` alto, rueda tamaño).
- `[`/`]` instancia · `+/-` tamaño · flechas mover (Shift fino) · `Tab` mundo ·
  `G` guardar · `C` cargar.
- API: `/api/board-sprites-assets`, `/api/save-board-sprites`,
  `/api/load-board-sprites`, `/api/save-calibration` (áreas).
- Carpetas especiales: trampas `VIENTO`→`AIRE`; obstáculos usan `<MUNDO>` directo.

### `calibrate-board-texts.html` — 5 textos del tablero

`text-areas.json` = `{ world, areas:{ turn, nTurn, optimal, nOptimal, info, gold } }`,
cada área `{x,y,w,h}` normalizada. Los textos son **dinámicos desde i18n**
(`board.turn`, `board.optimal`, `board.info`); los números son valores de juego.

- Arrastrar define el área · `Tab` cambia de texto · `Espacio` siguiente mundo ·
  flechas mover (Shift fino) · `+/-` tamaño · `S` copia tamaño · `G`/`C` por mundo.
- `Q`/`E` solo ancho · `Z`/`X` solo alto · `,`/`.` tamaño de texto relativo
  (se guarda como `fontScale` por área; igual en los calibradores de textos de
  submundo, mapamundi y créditos; las pantallas lo aplican al renderizar).
- API: `/api/save-board-text-areas`, `/api/load-board-text-areas`.

### `calibrate-submundos.html` — avatar por nivel

`avatar-positions.json` = `{ world, positions:{"0".."11"}:{x,y}, avatarSize,
avatars[8]:{size} }` — posición del avatar en cada uno de los 12 niveles
(rejilla serpiente 4×3) y tamaño independiente por cada uno de los 8 avatares.

- API: `/api/save-subworld-positions`, `/api/load-subworld-positions`.
- Al guardar avanza nivel → avatar → mundo automáticamente.

### `calibrate-submundos-text.html` — textos de submundo

`text-areas.json` = `{ world, areas:{ worldName, level, gold } }` — nombre del mundo
(`submundo.title`) y `Nivel X/12` (`submundo.level`), dinámicos desde i18n.

- API: `/api/save-subworld-text-areas`, `/api/load-subworld-text-areas`.

### `calibrate-mapamundi-text.html` — textos del mapamundi

`assets/mapamundi/text-areas.json` = `{ areas:{ gold:{x,y,w,h} } }` — texto en
oro sobre `mapamundi.webp` (ej. contador de tesoros). Una sola imagen, sin
selector de mundo. La fuente se auto-ajusta al área para no cortar letras.

- API: `/api/save-mapamundi-text-areas`, `/api/load-mapamundi-text-areas`.

**Regla del texto oro (`gold`)**: en TODAS las pantallas (tablero, submundo,
mapamundi…) el texto `gold` se alinea **a la derecha** dentro de su área,
pegado al borde derecho con un margen de ~20px (1% del ancho de la imagen
visible) para que no choque con el borde.
A la **izquierda** del texto va el icono `assets/comunes/monedas.webp` (8K
RGBA): altura igual a la del área `gold`, casi pegado al texto (gap ~12% de
la altura). Como el texto es dinámico (0 → N), el conjunto icono+texto se
mueve junto: el icono siempre queda a la izquierda del número. Las previews
de los calibradores ya muestran esta composición y el juego debe
renderizarla igual.

## Flujo del menú y partida guardada (bbdd)

- `menu.html` es el **punto de entrada** del juego. **Nueva partida** lleva
  a `seleccion-personaje.html`; **Continuar** lleva a `mapamundi.html` y se
  muestra **deshabilitado** (y se salta en la navegación por flechas) si no hay
  partida empezada (GET `/api/savegame` → `{exists, player}`). `menu.html`
  replica el mismo comportamiento.
- La bbdd del jugador es `db/player.json` (módulo `db/db.ts`). `PlayerState`
  tiene `started?: boolean`, `playerName?`, `avatarIndex?`; el estado solo
  existe como partida real si `started === true`.
- En la selección, **Atrás** vuelve al menú y **Adelante** llama a
  `POST /api/new-game {name, avatar}` (resetea progreso, `started:true`) y va a
  `mapamundi.html`.
- **Ajustes** lleva a `ajustes.html` (usa `assets/configuracion/config-areas.json`).
  Los ajustes globales viven en `db/settings.json` (`{sound, music, lang}`) y se
  leen/escriben con `GET`/`POST /api/settings`. `GET /api/i18n` (sin idioma)
  devuelve el archivo del idioma activo guardado en settings; todas las
  pantallas lo usan en el arranque. `assets-cache.js` expone
  `loadSettings`/`setSetting`/`isSoundEnabled`/`isMusicEnabled` y `playSound`
  respeta el flag `sound` global. Los cambios en la pantalla de configuración
  se persisten al instante y afectan a todo el juego.

## Flujo de arranque y progreso por mapa

- **Arranque**: `menu.html` muestra la pantalla de carga (estilo aventura
  clásica: marco grabado, título oro con contorno, barra chunky). Precarga
  **todos** los assets listados por `GET /api/assets-manifest` (el servidor
  escanea `assets/` excluyendo `old */`); solo se decodifican en memoria los
  del hot path (menú, config, modal, display/) — los fondos/submundos 8K se
  cachean como blob y se decodifican al entrar. Tras la carga, el primer gesto
  del usuario desbloquea el audio y arranca la música si `settings.music`.
- **Música global**: `AssetsCache.startMusic()` reproduce la pista del
  manifiesto en loop y guarda la posición en `localStorage` (`runika-music-pos`)
  para retomarla entre pantallas — la música no se corta al navegar.
  Las pistas de `ONESHOT_MUSIC` (mapa pista→relevo) no repiten ni en loop:
  `worldWin` (fanfarria de boss de mundo) acaba yendo a `MUSIC.main`.
  `fin` (victoria.mp3 de la cinemática final) va en **loop**: suena desde
  la explosión del boss hasta los créditos, que ponen `MUSIC.main`.
  Los jingles `victoria.mp3`/`derrota.mp3` van por `playMusicSting`
  (pausan el loop, suenan una sola vez, retoman el loop donde quedó).
  Pistas por contexto en `MUSIC` (`assets-cache.js`): `main` (menús/mapamundi),
  `worldWin`, `fin`, y **una por submundo** en `MUSIC.worlds`
  (`assets/music/<MUNDO>/submundo.mp3` — `submundo.html` la activa con
  `musicForWorld(world)`, que cae a `mistery.mp3` si el mundo no tiene la suya).
  **Jingles**: `MUSIC.victoria` / `MUSIC.derrota` (`assets/music/*.mp3`) suenan
  con `playMusicSting(url)` — pausan el loop, suenan una vez y lo retoman al
  terminar; los usa `game.html` al ganar/perder (la victoria de boss de mundo
  usa `worldWin` en su lugar). Respetan el ajuste `music`, no `sound`.
- **Progreso por mapa** (PlayerState): `gold`, `lastWorld` (último mundo del
  mapamundi) y `worldProgress` = `{MUNDO: {last, completed[]}}` con 12 islas por
  mundo (`MAP_LEVELS_PER_WORLD`). Endpoints: `POST /api/map-position`,
  `POST /api/level-position`, `POST /api/level-complete {world, level, gold,
  screenId}`, `GET /api/level-screen?world&level` (pantalla sticky por isla;
  al re-entrar a una isla **completada** siempre sale el MISMO puzzle que se
  completó ahí — se busca en su tier original aunque el tier global suba).
  **Re-jugar una isla completada no suma oro** — `completeLevel` solo lo añade
  la primera vez (`isNew`), y el tablero ni siquiera muestra monedas si la
  isla ya estaba completada. **Debug**: `T` en el tablero muestra/oculta el tier de dificultad actual.
- **Mapamundi**: el avatar siempre es `player.avatarIndex` (el elegido al crear
  la partida — nunca cambia). Se restaura `lastWorld` al entrar y se guarda al
  avanzar. Un mundo con las 12 islas completadas se muestra en blanco y negro
  (div `.world-fx.done` = copia del fondo con `background-size:contain` +
  `filter: grayscale` + `mask-image` radial con el aura calibrada; **jamás
  `<img>` + mask + filter**: rasteriza vacío si la imagen aún no está
  decodificada y nunca se repinta) y no se puede volver a entrar. **MAZMORRA**
  (centro del mapa) permanece bloqueado y oscurecido hasta completar los otros
  7 mundos.
  Posición/tamaño del avatar por mundo: `avatars[M][avatarIndex]` de
  `assets/mapamundi/avatar-positions.json` (indexado por avatar del jugador).
  `mapamundi.html?demo=<MUNDO>` finge ese mundo conquistado (B/N + avatar
  encima, sin escribir nada) — lo usa `demo-mapa-victoria.html`, que también
  muestra `game.html?demo=win` (victoria real: monedas + modal, sin bbdd) y
  `?demo=winboss` (celebración de boss: destello + anillos + chispas + título
  `map.worldDone` en el modal).
- **Submundo**: el avatar aparece en la última isla jugada (completada o no) y
  el oro se muestra en el área `gold` calibrada (alineado a la derecha + icono
  `comunes/monedas.webp`). Las islas siguen la misma estrategia visual que los
  mundos: completada → blanco y negro (`island-fx done`), bloqueada → oscura
  (`island-fx locked`). **Progreso secuencial**: solo se puede ir a la isla N
  si la N-1 está completada — el movimiento y el Enter a islas bloqueadas
  rebotan. `Enter` en una isla desbloqueada guarda la posición y entra a
  `game.html?world=X&level=N` (modo real: pantalla sticky, avatar fijo,
  `Esc` vuelve). **Victoria**: las monedas vuelan del cofre al contador de
  oro y luego sale el **modal** (`assets/comunes/modal.webp` +
  `modal-areas.json`): botón **rojo (izq) = Reiniciar** — revierte el oro
  ganado y re-juega el MISMO puzzle (la isla no se confirma) — y botón
  **verde (der) = Continuar** — `POST /api/level-complete` y al submundo.
  El `level-complete` solo se envía al pulsar Continuar.
- **Bosses**: los sprites de `assets/bosses/<M>/` solo se usan en la **última
  isla** (índice 11) de cada submundo; el resto de islas usan siempre imágenes
  de `assets/enemys/<M>/`.
- **Nivel de juego (tier)** en el tablero: en modo real el HUD dev se oculta y
  se pintan las áreas calibradas de `assets/backgrounds/<M>/text-areas.json`:
  `turn`/`nTurn`, `optimal`/`nOptimal`, `info` = dos líneas en modo real:
  `player.playerName` (grande, dorado) sobre `board.levelOf` ("Nivel {0} de
  {1}" → **isla** `level+1` **de** `FINAL_ISLAND_IDX+1`, más pequeño, bloque
  centrado con márgenes iguales); en modo práctica solo `board.level` con el
  tier en una línea), y `gold`. El tier se persiste en `player.gameLevel` (`db/db.ts`,
  `tierForCompleted(totalStagesCompleted)`). Funcionamiento completo:
  `docs/18-FUNCIONAMIENTO-JUEGO.md`.

## Selección de personaje (pantalla + calibradores)

- Pantalla: `http://localhost:3000/seleccion-personaje.html`.
- Calibradores: `calibrate-selection-avatars.html` (avatares / cuadros / bordes / cuerpo completo), `calibrate-selection-buttons.html` (teclas + flechas), `calibrate-selection-name.html` (zona del nombre).
- Datos (todo es **data-driven**, el juego los consume dinámicamente):
  - `assets/menu principal/character-positions.json` — `polygons` (clip), `borderPolygons` (marco), `avatarTransforms` (thumb en cuadro), `fullBodyAreas` (**por avatar**; `fullBodyArea` es legacy/fallback). Los 4 arrays tienen siempre 8 entradas.
  - `assets/menu principal/selection-buttons.json` — 29 polígonos (A–Z, Borrar, Atrás, Adelante).
  - `assets/menu principal/selection-name-area.json` — rectángulo del nombre.
- Coordenadas normalizadas 0–1 en espacio **`image-content`** (se descuenta el letterbox del `object-fit: contain`, ratio 3:2). Nunca contra el viewport.
- API: `/api/load-character-positions`, `/api/save-character-positions`, `/api/load-selection-buttons`, `/api/save-selection-buttons`, `/api/load-selection-name`, `/api/save-selection-name`. El servidor resuelve la raíz desde `server.ts`, no `process.cwd()`.
- Al guardar se reemplaza **solo la entrada del índice editado** — nunca se envían los otros 7 desde memoria.
- Avatares: `assets/avatars/avatar_0N.webp` 7680×7680 RGBA (masters) + `thumbs/` 512×512 + `display/` 2048×2048 webp (los que usa el cuerpo completo en pantalla; regenerar con `tools/convert-display-assets.py`). Cache-busting `?v=avatars-N` / `?v=display-N` (incrementar al regenerar). Para calidad extrema: Real-ESRGAN x4plus en `.sam-venv`.
- Navegación y bordes: ver `docs/17-PANTALLA-SELECCION-PERSONAJE.md` (orden lineal, filas con memoria entre bloques, excepción Borrar R/S/T/Z→T, borde irregular feTurbulence, click=dorado fuerte / hover=suave, cuerpo completo por hover real).

## Mundos

ESPACIO, AGUA, TIERRA, FUEGO, HIELO, VIENTO, INFRAMUNDO, MAZMORRA.

Fondos en `assets/backgrounds/<MUNDO>/bg_01.webp`. Todos están a
**7680×4320 (8K)**. Nota: MAZMORRA,
ESPACIO y HIELO fueron reescalados desde resoluciones menores (1672×941 o
1024×576), así que su calidad real es inferior a la de los 8K nativos.

### Regla a fuego — assets: WebP en runtime, PNG masters en `old/`

- **Ningún código/HTML referencia `.png`**: todo lo que carga la app es
  `.webp` (q92) junto a donde estaba el PNG, mismo nombre de archivo.
- Los masters PNG están archivados en `assets/old <categoria>/<...>`
  (misma estructura de subcarpetas, mismo nombre). Ej:
  `assets/backgrounds/ESPACIO/bg_01.png` → `assets/old backgrounds/ESPACIO/bg_01.png`.
- Al llegar una imagen nueva (PNG a `assets/<cat>/`):
  `tools/png-to-webp-archive.py --apply` genera el `.webp` in-situ y mueve
  el PNG a `old <cat>/`. Después `tools/convert-display-assets.py`
  regenera los derivados `display/` (lee masters de `old/` y de la
  carpeta viva).
- `tools/upscale-8k.py <imagen> [WxH]` sigue generando masters PNG (luego
  se archivan con el script anterior).

## Arquitectura

- `engine/` — motor de reglas determinista (playTurn, isLevelSolved, etc.).
- `generator/` — generación procedural de niveles por seed (15 tiers de dificultad; el 15 es exclusivo del boss final).
- `solver/` — validador (32 tests) + BFS solver que reutiliza el motor.
- `worlds/` — WorldConfigs, banco de niveles, renderizado ASCII.
- `background/` — detección de tableros con SAM (Python).
- `layout/` — cálculo de rejilla y screen layout.
- `schemas/` — tipos y validadores JSON.
- `assets/backgrounds/` — imágenes de fondo + `board-detection.json`.

## Reglas clave

- **Reglas del juego original**: ver `docs/11-REGLAS-JUEGO-ORIGINAL.md` (reglas a fuego).
- El solver reutiliza LITERALMENTE el motor de reglas (no hay lógica duplicada).
- Añadir un mundo = solo datos (WorldConfig + BackgroundTemplates).
- Las imágenes de fondo no se recortan ni modifican.
- ESM imports usan `.js` en TypeScript source.
- **A fuego — registrar URLs nuevas**: cada pantalla o calibrador nuevo debe
  añadirse a `utils/url-calibrates.md` (en su sección, con qué calibra/hace y
  el JSON donde guarda los datos). Nunca crear una pantalla sin registrarla.
- **Colisión con obstáculos**: el avatar no puede entrar en una casilla ocupada por un obstáculo. Al intentar moverse hacia un obstáculo, el avatar rebota visualmente (efecto rebote) y suena el sonido de choque común (`assets/sounds/comun/choque.wav`). El movimiento se cancela — el avatar se queda en su casilla actual.
- **Movimiento ortogonal**: el avatar solo se mueve en 4 direcciones (arriba, abajo, izquierda, derecha). Está prohibido moverse en diagonal.
- **Choque en bordes**: al intentar salir del tablero, el avatar rebota y suena el sonido de choque común, igual que con los obstáculos.
- **A fuego — sin solapamiento**: al comenzar un nivel, ninguna casilla puede tener más de un item (jugador, enemigo, obstáculo, trampa, llave o meta, cada uno en su celda).
- **A fuego — sin dificultad absurda**: un nivel fácil no es un nivel vacío. La dificultad baja se consigue con menos elementos y patrones simples, nunca con elementos irrelevantes o desconectados del reto.
- **Trampa (`T`)**: aturde 3 turnos a quien la pisa (jugador o enemigo), de forma individual por entidad.
- **Máximo 3 enemigos** en cualquier pantalla.
- **A fuego — los enemigos SIEMPRE se mueven**: no existen enemigos estáticos ni
  "de vigilancia" que se queden quietos. Todo enemigo persigue al jugador
  (`CHASE` / `PERSECUCION_SIMPLE`), 2 pasos por turno, horizontal primero. Un
  enemigo solo deja de moverse temporalmente si queda aturdido por una trampa
  (3 turnos). El patrón `VIGILANCIA`/`VIGILANCIA_ZONA` está prohibido.
- **A fuego — obstáculos visuales por mundo**: en `assets/obstaculos/<MUNDO>/` hay imágenes de obstáculos propias de cada mundo. Al colocar obstáculos en una pantalla:
  - Las **posiciones** vienen determinadas por el nivel generado (el motor/solver decide dónde van); nunca se inventan posiciones.
  - La **imagen** de cada obstáculo se elige al azar de entre las disponibles del mundo actual.
  - Si solo hay una imagen, se usa esa.
  - Si hay varias y hay que poner varios obstáculos, se intenta **no repetir** imagen mientras sea posible (sin reemplazo). Si hacen falta más obstáculos que imágenes disponibles, se repite lo necesario.
  - **No es obligatorio mostrar todas** las imágenes del mundo en cada pantalla; basta con las que el nivel genere.
  - Si un mundo no tiene carpeta de obstáculos, se usa una imagen de marcador (placeholder) y se documenta el faltante.
  - Mapeo de carpetas especiales: `VIENTO` → `assets/obstaculos/AIRE/`.
- **Progresión de dificultad**: 8 mundos × 12 islas = 96 pantallas, repartidas en los tiers **5..14** (la partida
  siempre empieza en el nivel 4) según el **nº de pantallas superadas** —
  `min(14, 4 + floor(c × 11 / 96))`, ~8-9 islas por tier. NO depende de la
  isla/mundo (los mundos se juegan en orden libre). Ver `docs/15-TABLA-CURVA-DIFICULTAD-96-JUEGOS.md`.
  **Excepción — boss final**: la última isla de MAZMORRA (`level=11`) usa el
  **tier 15**, exclusivo y fuera de la curva (`mapTierFor` en `db/db.ts`).
  Su banco es `db/screens-tier-15.json` (5.000 pantallas, 3 enemigos,
  4-6 obstáculos, 3-4 trampas, solución óptima 15-22 pasos).
- **A fuego — sin textos hardcodeados**: ningún texto visible al usuario puede estar
  escrito directamente en el código (HTML, TS, etc.). Todo texto debe venir de
  archivos de idioma en `i18n/` (`es.json`, `en.json`, `fr.json`, `de.json`,
  `it.json`). El sistema de i18n carga el archivo del idioma activo y expone
  una función `t("clave")` para resolver las traducciones. Si falta una clave en
  un idioma, se usa el español como fallback. Idiomas soportados: español (`es`),
  inglés (`en`), francés (`fr`), alemán (`de`), italiano (`it`).
- **A fuego — prohibido literales en HTML/UI**: ningún texto visible en
  pantallas HTML (menu, juego, instrucciones, creditos, etc.) puede estar
  escrito directamente en el HTML o JS. Todo texto debe obtenerse en tiempo de
  ejecucion desde los archivos de idioma (`i18n/<lang>.json`) mediante la
  funcion `t("clave")`. Los unicos literales permitidos son claves de i18n
  (ej: `data-i18n="menu.newGame"` o `t("menu.newGame")`), nunca el texto final
  en ningun idioma. Idiomas soportados: espanol (`es`), ingles (`en`), frances
  (`fr`), italiano (`it`), aleman (`de`).
- **A fuego — fuente del juego**: la fuente tipografica para TODO el texto del
  juego (menus, botones, instrucciones, creditos, HUD, etc.) es
  **Chelsea Market** (`'ChelseaMarket'`, archivo local
  `assets/fonts/ChelseaMarket-Regular-wc.ttf`, licencia OFL). Se declara con
  `@font-face` en `assets/fonts/fonts.css` — enlazar ese CSS en cada pantalla
  (`<link rel="stylesheet" href="/assets/fonts/fonts.css">`), nunca cargar
  fuentes desde Google Fonts ni otra red externa. No se usa MedievalSharp,
  Schoolbell, Georgia, Courier New ni ninguna otra fuente para texto visible
  (los HUD tecnicos de los calibradores si pueden ir en monospace).
- **A fuego — texto sobre pergamino**: cuando el fondo sea un pergamino claro
  (ej: pantalla de instrucciones, opciones), el texto debe ser oscuro
  (`#3a2810` / `#4a3018` / `#5a3a18`) para que se lea sobre el fondo claro.
  Nunca usar texto claro sobre pergamino claro.
- **A fuego — cache de assets antes de lanzar la app**: las imagenes (fondos 8K,
  obstaculos, avatares, enemigos, trampas, salida, mapamundi, menus) y los
  sonidos (movimiento, seleccion, choque, trampa, victoria, derrota, pergamino)
  son archivos pesados. Antes de mostrar la aplicacion al usuario, TODO debe
  estar precargado en cache (memoria del navegador / Cache API / Service Worker)
  para que la experiencia sea fluida, sin tirones ni tiempos de carga en medio
  del juego. El proceso de carga debe:
  1. Mostrar una pantalla de carga (loading) al iniciar.
  2. Precargar todas las imagenes y sonidos necesarios.
  3. Solo mostrar el menu / juego cuando todo este en cache.
  4. Usar Service Worker + Cache API para persistencia entre sesiones.
  5. En ejecucion, servir todo desde cache, nunca desde red en caliente.
  6. En ejecucion, servir todo desde cache, nunca desde red en caliente.
- **A fuego — imagenes del hot path (TODAS las pantallas)**: cualquier imagen
  que se pinte o cambie durante la interaccion (hover, seleccion, sprites del
  tablero, iconos) NUNCA usa los masters 8K y NUNCA se decodifica en caliente.
  En todas las pantallas (game, submundo, mapamundi, menus,
  seleccion de personaje, instrucciones y futuras):
  1. **Derivados display**: se usan versiones ligeras `.webp` generadas con
     `tools/convert-display-assets.py` (`assets/<cat>/display/`):
     avatares 2048px, sprites de tablero (enemys/trampas/obstaculos/salida/
     bosses) 1024px. Los masters PNG quedan archivados en `assets/old */`
     (ver regla de assets arriba). El servidor ya prefiere
     `display/<stem>.webp` en
     `/api/obstacles` y `/api/board-sprites-assets`.
  2. **decode() real**: tras `img.onload` hay que esperar `img.decode()`
     (o `createImageBitmap`) durante la precarga/pantalla de carga.
     `onload` solo garantiza bytes descargados; la decodificacion lazy es
     lo que produce el tiron en el primer pintado.
  3. **Referencias vivas**: guardar los `Image` decodificados en un `Map`
     (ej. `decodedImgs`, `AssetsCache.cache.decoded`). Sin referencia, el
     navegador evicta los datos decodificados bajo presion de memoria y el
     lag vuelve aunque la pantalla lleve mucho tiempo abierta.
  4. Los fondos a pantalla completa si usan el master 8K (es su resolucion
     nativa), pero se decodifican durante la carga igualmente.
- **A fuego — transiciones entre pantallas**: todos los cambios de pantalla
  (menu → instrucciones, menu → juego, juego → victoria/derrota, etc.) deben
  tener una transicion fluida, nunca un corte seco. Las transiciones deben:
  1. Fundido (fade out / fade in) o deslizamiento suave entre pantallas.
  2. Duracion entre 300-600ms, suficientemente rapido para no aburrir.
  3. Sonido de transicion si aplica.
  4. La pantalla anterior se desvanece mientras la nueva aparece.
  5. Usar CSS transitions/animations o un overlay de fundido negro/pergamino.
  6. Nunca mostrar un parpadeo en blanco ni carga brusca de contenido.
- **A fuego — movimiento lineal por submundos**: el avatar se mueve por los 12
  niveles de cada submundo de forma **lineal y secuencial** (1→2→3→...→12).
  Desde el nivel N solo se puede ir al N+1 o al N-1, nunca a otro nivel no
  adyacente. Aunque el movimiento es lineal, se usan las **4 direcciones**
  (arriba, abajo, izquierda, derecha) segun la disposicion fisica de las
  casillas en la rejilla en serpiente 4×3:
  ```
   8  9 10 11
   7  6  5  4
   0  1  2  3
  ```
  La direccion para avanzar de N a N+1 depende de la posicion relativa en la
  rejilla (ej: 3→4 es arriba, 4→5 es izquierda, 7→8 es arriba). La direccion
  para retroceder de N a N-1 es la **inversa de la direccion de llegada**
  (ej: 5→4 es derecha, 4→3 es abajo, 8→7 es abajo). Cualquier direccion que no
  corresponda al avance o retroceso produce rebote. El avatar siempre empieza
  en el nivel 1 al entrar a un submundo (salvo que haya progreso guardado).
- **A fuego — navegación de la pantalla de instrucciones**: en
  `instructions.html` el foco solo puede estar en el pergamino (área de texto
  con scroll) o en el botón atrás. El botón atrás es **solo el área clickeable**:
  el dibujo ya está pintado en `instrucciones.webp` (brújula dorada abajo-
  izquierda) y el botón HTML es invisible sobre ella (solo muestra un anillo
  dorado al tener foco/hover). Su posición es un círculo `{cx, cy, r}`
  calibrado en `instructions-areas.json`. Reglas:
  1. Al entrar, el foco está en el pergamino.
  2. Como el texto no cabe entero, ↓ hace scroll hacia abajo hasta el final.
  3. Al llegar al final del scroll, ↓ pasa el foco al botón atrás.
  4. ↑ desde el botón atrás devuelve el foco al pergamino **conservando la
     posición del scroll** donde estaba (nunca se reubica).
  5. Desde el pergamino NO se puede ir al botón atrás hasta llegar al final
     del scroll y pulsar ↓ otra vez.
