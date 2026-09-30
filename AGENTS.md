# Runika 2D — Wappo Infinito

Juego de puzle determinista inspirado en Wappo. TypeScript puro + Vitest, Node ≥ 20, ESM.

## Comandos

```bash
npm run typecheck   # tsc --noEmit (strict + noUncheckedIndexedAccess)
npm test            # vitest (300 tests, 13 archivos)
npx tsx demo-server.ts  # demo visual + demo jugable en http://localhost:3000
```

## Demo jugable (`demo-play.html`)

`http://localhost:3000/demo-play.html` — demo jugable que elige una pantalla
**al azar** del tier 1 (endpoint `/api/demo-screen?tier=1`) en cada recarga y un
mundo al azar. **No guarda nada en la bbdd** (solo lectura).

Controles: `Flechas/WASD` mover · `R` otra pantalla · `Espacio` cambiar mundo ·
`Enter` cambiar avatar.

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
  abrir `demo.html`, arrastrar el ratón sobre el tablero y pulsar `G`.

## Calibración manual (`demo.html`)

`npx tsx demo-server.ts` → http://localhost:3000. Cada mundo guarda **dos áreas**
normalizadas en su `board-detection.json`:

- `boardArea` — tablero para **losas/obstáculos/trampas**.
- `avatarArea` — tablero para **avatar/enemigos/meta** (puede diferir del anterior).

Controles en `demo.html`:

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
dejando un margen (~6% del ancho del área) para que no choque con el borde.
A la **izquierda** del texto va el icono `assets/comunes/monedas.webp` (8K
RGBA): altura igual a la del área `gold`, casi pegado al texto (gap ~12% de
la altura). Como el texto es dinámico (0 → N), el conjunto icono+texto se
mueve junto: el icono siempre queda a la izquierda del número. Las previews
de los calibradores ya muestran esta composición y el juego debe
renderizarla igual.

## Flujo del menú y partida guardada (bbdd)

- `demo-menu.html` es el **punto de entrada** del juego. **Nueva partida** lleva
  a `demo-seleccion-personaje.html`; **Continuar** lleva a `mapamundi.html` y se
  muestra **deshabilitado** (y se salta en la navegación por flechas) si no hay
  partida empezada (GET `/api/savegame` → `{exists, player}`). `menu.html`
  replica el mismo comportamiento.
- La bbdd del jugador es `db/player.json` (módulo `db/db.ts`). `PlayerState`
  tiene `started?: boolean`, `playerName?`, `avatarIndex?`; el estado solo
  existe como partida real si `started === true`.
- En la selección, **Atrás** vuelve al menú y **Adelante** llama a
  `POST /api/new-game {name, avatar}` (resetea progreso, `started:true`) y va a
  `mapamundi.html`.
- **Ajustes** lleva a `demo-config.html` (usa `assets/configuracion/config-areas.json`).
  Los ajustes globales viven en `db/settings.json` (`{sound, music, lang}`) y se
  leen/escriben con `GET`/`POST /api/settings`. `GET /api/i18n` (sin idioma)
  devuelve el archivo del idioma activo guardado en settings; todas las
  pantallas lo usan en el arranque. `assets-cache.js` expone
  `loadSettings`/`setSetting`/`isSoundEnabled`/`isMusicEnabled` y `playSound`
  respeta el flag `sound` global. Los cambios en la pantalla de configuración
  se persisten al instante y afectan a todo el juego.

## Flujo de arranque y progreso por mapa

- **Arranque**: `demo-menu.html` muestra la pantalla de carga (estilo aventura
  clásica: marco grabado, título oro con contorno, barra chunky). Precarga
  **todos** los assets listados por `GET /api/assets-manifest` (el servidor
  escanea `assets/` excluyendo `old */`); solo se decodifican en memoria los
  del hot path (menú, config, modal, display/) — los fondos/submundos 8K se
  cachean como blob y se decodifican al entrar. Tras la carga, el primer gesto
  del usuario desbloquea el audio y arranca la música si `settings.music`.
- **Música global**: `AssetsCache.startMusic()` reproduce la pista del
  manifiesto en loop y guarda la posición en `localStorage` (`runika-music-pos`)
  para retomarla entre pantallas — la música no se corta al navegar.
- **Progreso por mapa** (PlayerState): `gold`, `lastWorld` (último mundo del
  mapamundi) y `worldProgress` = `{MUNDO: {last, completed[]}}` con 12 islas por
  mundo (`MAP_LEVELS_PER_WORLD`). Endpoints: `POST /api/map-position`,
  `POST /api/level-position`, `POST /api/level-complete {world, level, gold,
  screenId}`, `GET /api/level-screen?world&level` (pantalla sticky por isla).
- **Mapamundi**: el avatar siempre es `player.avatarIndex` (el elegido al crear
  la partida — nunca cambia). Se restaura `lastWorld` al entrar y se guarda al
  avanzar. Un mundo con las 12 islas completadas se muestra en blanco y negro
  (`backdrop-filter: grayscale`) y no se puede volver a entrar. **MAZMORRA**
  (centro del mapa) permanece bloqueado y oscurecido hasta completar los otros
  7 mundos.
- **Submundo**: el avatar aparece en la última isla jugada (completada o no) y
  el oro se muestra en el área `gold` calibrada (alineado a la derecha + icono
  `comunes/monedas.webp`). Las islas siguen la misma estrategia visual que los
  mundos: completada → blanco y negro (`island-fx done`), bloqueada → oscura
  (`island-fx locked`). **Progreso secuencial**: solo se puede ir a la isla N
  si la N-1 está completada — el movimiento y el Enter a islas bloqueadas
  rebotan. `Enter` en una isla desbloqueada guarda la posición y entra a
  `demo-play.html?world=X&level=N` (modo real: pantalla sticky, avatar fijo,
  victoria → `POST /api/level-complete` y vuelta al submundo; `Esc` vuelve).
- **Bosses**: los sprites de `assets/bosses/<M>/` solo se usan en la **última
  isla** (índice 11) de cada submundo; el resto de islas usan siempre imágenes
  de `assets/enemys/<M>/`.

## Selección de personaje (demo + calibradores)

- Demo: `http://localhost:3000/demo-seleccion-personaje.html`.
- Calibradores: `calibrate-selection-avatars.html` (avatares / cuadros / bordes / cuerpo completo), `calibrate-selection-buttons.html` (teclas + flechas), `calibrate-selection-name.html` (zona del nombre).
- Datos (todo es **data-driven**, el juego los consume dinámicamente):
  - `assets/menu principal/character-positions.json` — `polygons` (clip), `borderPolygons` (marco), `avatarTransforms` (thumb en cuadro), `fullBodyAreas` (**por avatar**; `fullBodyArea` es legacy/fallback). Los 4 arrays tienen siempre 8 entradas.
  - `assets/menu principal/selection-buttons.json` — 29 polígonos (A–Z, Borrar, Atrás, Adelante).
  - `assets/menu principal/selection-name-area.json` — rectángulo del nombre.
- Coordenadas normalizadas 0–1 en espacio **`image-content`** (se descuenta el letterbox del `object-fit: contain`, ratio 3:2). Nunca contra el viewport.
- API: `/api/load-character-positions`, `/api/save-character-positions`, `/api/load-selection-buttons`, `/api/save-selection-buttons`, `/api/load-selection-name`, `/api/save-selection-name`. El servidor resuelve la raíz desde `demo-server.ts`, no `process.cwd()`.
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
- `generator/` — generación procedural de niveles por seed (14 tiers de dificultad).
- `solver/` — validador (32 tests) + BFS solver que reutiliza el motor.
- `worlds/` — WorldConfigs, banco de niveles, renderizado ASCII.
- `background/` — detección de tableros con SAM (Python).
- `layout/` — cálculo de rejilla y screen layout.
- `schemas/` — tipos y validadores JSON.
- `assets/backgrounds/` — imágenes de fondo + `board-detection.json`.

## Reglas clave

- **Reglas del Wappo original**: ver `docs/11-REGLAS-WAPPO-ORIGINAL.md` (reglas a fuego).
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
- **Curva de dificultad**: 8 mundos × 15 subniveles = 120 juegos, repartidos en 14 tiers con curva no lineal (p=0.6). Ver `docs/15-TABLA-CURVA-DIFICULTAD-120-JUEGOS.md`.
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
  En todas las pantallas (game, demo-play, submundo, mapamundi, menus,
  seleccion de personaje, instrucciones, demos y futuras):
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
