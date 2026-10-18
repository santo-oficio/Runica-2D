# Runika 2D

Juego de puzle determinista por turnos en rejilla. TypeScript puro + Vitest, Node ≥ 20, ESM.

## Comandos

```bash
npm run typecheck   # tsc --noEmit (strict + noUncheckedIndexedAccess)
npm test            # vitest (300 tests, 13 archivos)
npx tsx server.ts  # juego y calibradores en http://localhost:3000
npm run app         # Electron en modo dev (ventana fullscreen)
npm run dist        # genera release/Runika 2D Setup <ver>.exe (NSIS)
```

## App de escritorio (Electron)

- `electron-app/main.mjs` (ESM, proceso principal): elige un **puerto libre**,
  pone `RUNIKA_ROOT` (raíz de la app), `RUNIKA_DB_DIR`
  (`%APPDATA%/runika-2d/db` — writable) y `RUNIKA_PORT`, importa
  `electron-app/server.mjs` (bundle esbuild de `server.ts`), espera a que
  responda y abre `BrowserWindow` fullscreen con retry de `did-fail-load`.
- El servidor dentro de Electron corre **in-process** (sin node/tsx externo).
- Empaquetado con electron-builder (`build` en `package.json`), target NSIS
  per-user (sin admin), `asar: false`, acceso directo en escritorio y menú.
  `npm run build:server` regenera el bundle antes de empaquetar.
- Variables de entorno del servidor: `RUNIKA_ROOT` (raíz de assets/páginas),
  `RUNIKA_DB_DIR` (player.json + settings.json escritibles),
  `RUNIKA_BANK_DIR` (bancos `screens-tier-*.json` — por defecto ROOT/db) y
  `RUNIKA_PORT`. En dev sin variables todo sigue igual.
- El instalador excluye `db/player.json`, `db/settings.json` y `db/old` —
  instalación limpia sin partida previa.

## App de TV Samsung (Tizen, `.wgt`)

El juego corre **autónomo en la TV** (sin PC): las APIs del servidor se
simulan en cliente.

- `web/api-shim.js` — interceptor de `fetch` activo solo en TV
  (`window.tizen`, UA Tizen, `file:` o `localStorage['runika.tizen']='1'`
  para pruebas). Mapea `/api/*` → localStorage (settings/savegame),
  JSONs empaquetados (`load-*`, `manifest`, `detections`, `sprite-assets`)
  y `window.RunikaDB`/`RunikaSolver`. En localhost queda inerte.
- `web/webdb.js` — port de `db/db.ts` (progreso, sticky assignments,
  level-screen/complete) con bancos por fetch y persistencia localStorage.
- `web/solver.bundle.js` — solver compilado a navegador (`npm run
  build:solver`, esbuild IIFE + stubs de builtins en `web/node-stub.mjs`).
- `web/tizen.js` — mando: Back(10009)→Escape, registro de teclas, salir
  en el menú, puente IME para el nombre del jugador.
- `npm run wgt` → `tools/build-tizen.mjs` genera `webdist/` (~315 MB:
  páginas runtime + assets + i18n + `db/screens-tier-*.json` + web/ +
  `config.xml` + `index.html` + `icon.png`).
- Empaquetado/firma: `tizen package -t wgt -s <perfil> -- webdist`
  (requiere Tizen Studio + certificado Samsung). Instalación: TV en
  Developer Mode con la IP del PC → `sdb connect <ip>` + `tizen install`.

## App Android (Cordova, `.apk`)

`android-app/` es el proyecto Cordova (misma app autónoma que la TV).

- `npm run apk` → genera `webdist` + `android-app/www` (con `cordova.js`
  inyectado). `web/api-shim.js` se activa con `window.cordova` y
  `web/tizen.js` también pone el puente de Android: `backbutton`→Escape,
  swipe→flechas y pulsación larga→Escape. El tap actúa sobre el control
  tocado con los eventos pointer/click reales (todos los controles llevan
  `cursor:pointer` y handlers propios — NO mandar Enter sintético: dobla
  acciones). Una página puede definir `window.touchTapMove(x,y)` para
  interpretar taps "en vacío" (game.html mueve hacia la casilla tocada,
  submundo.html entra/mueve por isla). En Android NO se crea el <input>
  IME oculto (solo Tizen): la máquina de escribir de
  `seleccion-personaje.html` ya es táctil y el teclado del sistema solo
  taparía la interfaz. Se inyecta CSS `touch-action:none` +
  sin tap-highlight/selección para que los swipes lleguen a touchend.
- Build: `cd android-app && npx cordova build android [--release]`
  con `JAVA_HOME`=JBR de Android Studio, `ANDROID_HOME`=%LOCALAPPDATA%
  `\Android\Sdk` y Gradle 8.14.2 en PATH (`C:\Users\jquin\gradle`).
- Salida: `platforms/android/app/build/outputs/apk/{debug,release}/`.
  Release se firma con `android-app/runika.keystore` (NO committeado —
  credenciales en `release-signing.properties`, también ignorado).
- Icono: calavera (`android-res/` generado con PIL desde
  `assets/comunes/calavera.webp` — icono clásico + adaptativo).
- `config.xml`: landscape, fullscreen, minSdk 24, target 36,
  id `com.runika2d.game`.

## Modo práctica (`game.html`)

`http://localhost:3000/game.html` — modo práctica que elige una pantalla
**al azar** del tier 3 (endpoint `/api/practice-screen?tier=N`) en cada recarga y un
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

**REGLA GLOBAL — espacio de coordenadas**: TODA coordenada calibrada
(posiciones, áreas de texto, polígonos, círculos, tamaños) vive en el espacio
de la **imagen original** (0–1 sobre el bitmap), nunca sobre el viewport ni el
rect del `<img>` (que incluye las barras del letterbox). Toda página y todo
calibrador calcula el rect visible de la imagen con `naturalWidth/naturalHeight`
+ `min(w/iw, h/ih)` (ej.: `imageRect()` en `mapamundi.html`,
`visibleImageRect()` en `game.html`/`calibrate-areas.html`). Si se modifica una
imagen (recorte, regeneración, cambio de ratio), hay que recalcular sus
coordenadas partiendo de la imagen original.

**Letterbox cinemático**: cualquier imagen que no coincida con el ratio del
viewport deja bandas. Se rellenan con `<img id="fillbg">` — copia del mismo
fondo con `object-fit: cover` + `blur(45px) brightness(.42)` + `scale(1.15)`,
detrás de `#bg` (z-index 0/1). Nunca estirar ni recortar el arte principal.

**Pantallas 3:2 a 16:9 — dos estrategias**:

- **Submundos → variantes `.pano.webp` 2.35:1** (10152×4320), generadas
  por `tools/pano_build.py` en dos fases:
  1. **Squeeze vertical content-aware** (7680×5120 → 7680×4320 = 16:9
     exacto): cada fila recibe escala según su energía de borde — el HUD
     y las islas quedan ~1:1 y el cielo vacío entre islas se comprime
     hasta ~45%. Toda la composición cabe en 16:9 sin recortar ni
     inventar nada. `squeeze_rows()` devuelve `pos[r]` (fila de salida
     de cada fila original) para remapear coordenadas.
  2. **Extensión lateral** con quilting min-cut (`tools/quilt_extend.py`)
     hasta 2.35:1 — solo visible en pantallas más anchas que 16:9; a
     16:9 el viewport muestra EXACTAMENTE el arte comprimido.
  Coordenadas en espacio del lienzo .pano comprimido: x remapeada
  `(x*7680+1236)/10152`, y remapeada por fila con `pos` — aplicado por
  `tools/remap-coords-squeeze.py` (UNA sola ejecución). `getImgRect()`
  usa `Math.max` con `top = er.top`; los pies del avatar se clampean al
  viewport (`avatarBaseTop`).
- **Textos del submundo — `anchorX`**: en `text-areas.json` un área puede
  llevar `"anchorX": "viewLeft"|"viewRight"`: entonces `x` y `w` pasan a ser
  fracciones del **ancho visible del viewport** (no de la imagen) y `x` mide
  el margen desde ese borde — el HUD se pega a los lados visibles del pano
  (el `gold` usa `viewRight` con `x≈0.015`). Sin `anchorX`, `x`/`w` son
  fracciones de imagen como siempre (`y`/`h` siempre lo son). El
  `worldName` se calibra centrado bajo la calavera de su arco decorativo.
- **Menú, selección, configuración y mapamundi → `.169.webp` quilt+bruma**:
  esas pantallas tienen contenido pegado a los bordes (el cartel del título,
  islas del mapa) que el cover cortaría. La variante `.169.webp` extiende los
  laterales con `tools/quilt_extend.py --ratio 1.7778` (quilting Efros-Freeman
  sobre el master 3:2, parches nítidos con min-cut) + bruma progresiva en la
  tira extendida (el ~40% interior nítido, luego desenfoque+alta luz que crece
  hacia el borde — profundidad de campo, nunca objetos reflejados). Mismas
  dimensiones 9102×5120/1820×1024 y mismo centro original → coordenadas 16:9
  remapeadas, intactas en el centro. Los masters 3:2 viven en `assets/**/old/`
  (excluidos del manifest, webdist y el instalador Electron).
  DESCARTADO: `tools/edge_extend_16x9.py` (espejo) — duplicaba islas y
  objetos reconocibles a los lados; NO volver a usarlo para estos fondos.
- `tools/remap-coords-16x9.py` — el remapeo x'=(x*W0+side)/W1 se aplicó UNA
  vez a los JSON de esas 4 pantallas + `assets/comunes/fin-areas.json`
  (auras sobre el mapamundi). NO re-ejecutar: duplicaría el desplazamiento.
- Créditos, instrucciones y fondos de tablero ya son 16:9 nativos; los modales
  (`modal.webp`, `modal-reintentar.webp`) viven en un marco 3:2 — no tocar.
- Descartado: outpainting con SD (laterales que desentonan con el arte) y
  letterbox difuminado (`#fillbg` solo queda donde la variante `.169` no
  cubre el ratio).

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
| `calibrate-tienda.html` | `assets/tienda/<M>/areas.json` — zonas del interior: `title`/`gold`/`bubble`/`slotNicon`/`slotNtext`/`slotNsel` (N=1..3; `sel` = **polígono**) |

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

## Tienda (isla extra por submundo)

Cada submundo puede tener una **isla tienda** — un nodo extra fuera de la
serpiente 4×3 que cuelga de una isla normal y no cuenta como nivel.

- `assets/submundos/<MUNDO>/shop.json` — `{world, unlockAfter, from, dir, pos:{x,y}}`:
  la tienda cuelga de la isla `from` en la dirección `dir` y se desbloquea al
  completar `unlockAfter` niveles (p. ej. `3` = tras el nivel 3). `pos` es la
  posición del avatar sobre la isla tienda (espacio .pano, 0-1).
- `submundo.html`: `loadShop()` la carga; desde la isla `from`, la dirección
  `dir` mueve el avatar a la tienda (rebotando si está bloqueada — máscara
  `island-fx locked` como las islas). `INV[dir]` devuelve a la isla. Enter en
  la tienda navega a `shop.html?world=X`. El HUD central muestra
  `shop.title` en vez de "Nivel X/12".
- `assets/tienda/items.json` — catálogo `{items:[{id,price,icon,uses}]}`.
- `shop.html` — interior estilo recreativa 90s: fondo
  `assets/tienda/<MUNDO>/tienda.webp` (master PNG en `old/tienda-src.png`).
  El arte lleva todo pintado: tendero único (mismo pirata "Barbarroja el
  Errante" en los 8 mundos), cartelón, placa de oro y 3 cofres vacíos.
  El overlay se posiciona en coordenadas de IMAGEN (`HUD` + `imgRect()`):
  título sobre el cartelón, oro dentro de la placa (SOLO el número — la
  moneda ya viene pintada; fondo fallback si el mundo no la trae, p. ej.
  VIENTO) y en cada cofre el icono y el texto del ítem en zonas separadas
  (`slotNicon` / `slotNtext`; el `.item-slot` cubre la unión de ambas).
  Bocadillo del tendero con el nombre como cabecera dentro de la misma
  caja (`shop.keeper.<MUNDO>`, `shop.welcome`). Teclas: ←→ elegir,
  Enter comprar, Esc volver.
  `?demo=1` = oro/inventario falsos sin tocar la bbdd.
- `calibrate-tienda.html` — calibra por mundo las zonas del arte: `title`
  (cartelón), `gold` (placa de oro, número sin icono), `bubble`
  (bocadillo), `slotNicon`/`slotNtext` N=1..3 (icono y texto de cada
  cofre por separado) y `slotNsel` (**polígono** — marco dorado de
  selección que abraza el trapecio del cofre; también es su hit area
  táctil, punto-en-polígono en `shop.html`; dibujar con clic×N + doble
  clic, `Z` quita punto, `Esc` cancela). Mismo set de teclas que el
  resto de calibradores (arrastrar,
  Tab, flechas, +/-, Q/E/Z/X, `,`/`.` fontScale, S copiar tamaño,
  Espacio mundo, G/C). Guarda `assets/tienda/<M>/areas.json` vía
  `POST /api/save-shop-areas`; `shop.html` lo carga con
  `GET /api/shop-areas?world=X` mezclando sobre los defaults `HUD`
  (cada zona puede llevar `fontScale` → tamaño de texto/iconos).
- API: `GET /api/load-shop?world=X`, `GET /api/shop-areas?world=X`,
  `POST /api/save-shop-areas?world=X`, `GET /api/shop-items`,
  `POST /api/buy-item {itemId}` (precio validado en servidor, nunca del
  cliente), `POST /api/consume-item {itemId}`. `web/api-shim.js` los mapea en
  TV/Android y `web/webdb.js` tiene `buyItem`/`consumeItem` equivalentes.
- `PlayerState.inventory` — `{itemId: usos}` persistente. **Máximo 1 por
  tipo** (`"max": 1` en `items.json`): el servidor y `webdb` rechazan la
  compra si ya lo llevas, y en `shop.html` el cofre sale `.disabled`
  (apagado) con `shop.already` en vez del contador.
- Ítems (catálogo en `assets/tienda/items.json`, precio en servidor):
  - `pista` (60) — tecla **H** o badge: `/api/hint` dibuja la flecha del
    movimiento óptimo.
  - `deshacer` (40) — tecla **U** o badge: rebobina el último turno
    (`undoStack`: jugador, enemigos, aturdimientos y contador).
  - `midas` (50) — tecla **M** o badge: se ARMA en la pantalla y duplica
    `winGoldEarned` al ganarla; si pierdes o reinicias, se pierde.
  - `escarcha` (80) — tecla **C** o badge: aturde a TODOS los enemigos 3
    turnos (`stunnedTurns=3`, la regla de la trampa sobre ellos).
  El ítem 4º no tiene cofre pintado: flota sobre el mostrador a la
  izquierda salvo que el mundo tenga `slot4icon`/`slot4text`/`slot4sel`
  calibrados en su `areas.json` (el calibrador los incluye).
  Los badges apilados (`#item-badges`, inf-der) muestran contador; el de
  midas brilla con `×2` mientras está armado. El tendero rota un
  agradecimiento (`shop.thanks.0..2`) tras cada compra.
- Iconos `assets/tienda/iconos/*.webp` — orbe dorado generado con PIL
  (`tools/mk-shop-icons.py`).
- `tools/shop_gen.py island <MUNDO>` — compone la isla tienda en el
  `.pano.webp` con inpainting SD en las coords de `shop.json`;
  `interior <MUNDO>` genera el fondo `tienda.webp`.

## Flujo del menú y partida guardada (bbdd)

- `menu.html` es el **punto de entrada** del juego. **Nueva partida** lleva
  a `seleccion-personaje.html`; **Continuar** lleva a `mapamundi.html` y se
  muestra **deshabilitado** (y se salta en la navegación por flechas) si no hay
  partida empezada (GET `/api/savegame` → `{exists, player}`). `menu.html`
  replica el mismo comportamiento.
- La bbdd del jugador es `db/player.json` (módulo `db/db.ts`). `PlayerState`
  tiene `started?: boolean`, `playerName?`, `avatarIndex?`; el estado solo
  existe como partida real si `started === true`.
- En la selección, **Adelante** exige avatar elegido Y nombre escrito: si
  falta algo sale el modal de reintentar (`modal-reintentar.webp` +
  `modal-reintentar-areas.json`, un botón centrado) con el motivo
  (`selection.needAvatar` / `needName` / `needBoth`). El nombre guardado es
  siempre el tecleado (ya no hay nombre por defecto del avatar).
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
  `fin` (`victory.mp3?v=134s`, ~2:14) va en **loop**: arranca desde 0 al empezar
  la batalla final y **continúa sin cortarse en `creditos.html`** (retoma
  la posición guardada — la secuencia final es "una sola película");
  `creditos.html` continúa la pista activa (`currentMusicTrack()`).
- **Batalla final** (`final-battle.js`, MAZMORRA isla 12): al llegar al
  tesoro NO hay modal ni cambio de página — la batalla ocurre sobre el
  tablero vivo de `game.html`, con héroe y guardián en sus casillas reales:
  oro que sale del cofre → el guardián absorbe a los demás enemigos →
  oleadas de orbes de fuego (el héroe esquiva casilla a casilla) → oro y 7
  orbes de los mundos al héroe → choque de rayos → explosión y el tablero se
  rompe al vacío → coronación (título con `playerName`, oro total contado,
  Continuar → `creditos.html`). ~70 s. La partida se guarda al empezar.
  Demo: `demo-boss-final.html` (`&autowin=1` = sin jugar el puzle).
  `fin.html` queda solo como página suelta, ya no forma parte del flujo.
- **Música larga por secciones**: `tools/gen-music-long.py salida.wav
  --sections secciones.txt [--seed-audio x.mp3]` encadena secciones de
  MusicGen por continuación (cada una con su prompt) — evita la deriva de
  una sola pasada larga. Así se hizo `victory.mp3` (semilla: la fanfarria
  original en `assets/music/old/victory.mp3`; la versión anterior de 2 min
  está en `assets/music/old/victory-120s-v1.mp3` y la de 121 s en
  `assets/music/old/victory-121s-v2.mp3`).
  `tools/gen-music-extend.py <pista> <seg_extra> <salida.wav> "prompt"`
  alarga una pista existente con material nuevo generado por MusicGen
  (continuación desde sus últimos 25 s + crossfade).
  `victory.mp3` actual (134 s): la **fanfarria original de 15,6 s**
  (`assets/music/old/victory.mp3`) verbatim al inicio + pieza nueva de
  ~2 min generada con `tools/gen-music-melody.py` (musicgen-melody
  condicionado por la melodía del original — requiere `demucs` en el
  venv, ya instalado). Versiones previas en `assets/music/old/`
  (`victory-120s-v1`, `-121s-v2`, `-211s-v3`, `-145s-v4`).
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
- Coordenadas normalizadas 0–1 en espacio **`image-content`** de la variante `.169.webp` 16:9 servida (se descuenta el letterbox del `object-fit: contain`). Nunca contra el viewport.
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
- **Progresión de dificultad**: 8 mundos × 12 islas = 96 pantallas, repartidas en los tiers **3..14** (la partida
  siempre empieza en el nivel 3) según el **nº de pantallas superadas** —
  `min(14, 3 + floor(c × 12 / 96))`, 8 islas por tier. NO depende de la
  isla/mundo (los mundos se juegan en orden libre). Ver `docs/15-TABLA-CURVA-DIFICULTAD-96-JUEGOS.md`.
  **Excepción — boss final**: la última isla de MAZMORRA (`level=11`) usa el
  **tier 15**, exclusivo y fuera de la curva (`mapTierFor` en `db/db.ts`).
  Su banco es `db/screens-tier-15.json`.
- **Generador de niveles** (`generator/generate-screens.ts`): rediseñado —
  máx. 2 enemigos (separación Manhattan ≥4 entre ellos, colocación táctica
  en el tramo final del camino), todo elemento imprescindible (quitarlo
  rompe o cambia el óptimo), "jugada óptima" = par = mínimo real +1/+2
  (bateable), par ≥12 desde tier 7, uso de tablero ≥35% desde tier 7,
  mín. 2 obstáculos desde tier 4, sin camino directo, dedupe por
  simetrías (espejo H/V + 180°), conteo de soluciones par/par−1/par−2.
  El tier 1 se enumera exhaustivamente (espacio completo ≈ 32 puzzles).
  Reglas completas: `docs/16-DISENADOR-NIVELES-TIERS.md`.
- **Consola de hacks** (`game.html`): `Tab` abre/cierra panel inferior
  semitransparente; comandos `help level complete next prev seed restart
  undo optimal turns hint solutions god speed debug clear`. Endpoints
  `/api/screen`, `/api/screen-nav`, `/api/solve-screen`, `/api/hint`.
- **A fuego — sin textos hardcodeados**: ningún texto visible al usuario puede estar
  escrito directamente en el código (HTML, TS, etc.). Todo texto debe venir de
  archivos de idioma en `i18n/` (`es.json`, `en.json`, `fr.json`, `de.json`,
  `it.json`, `ja.json`, `zh.json`, `ru.json`, `tr.json`, `pl.json`). El sistema
  de i18n carga el archivo del idioma activo y expone una función `t("clave")`
  para resolver las traducciones. Si falta una clave en un idioma, se usa el
  español como fallback. Idiomas soportados: español (`es`), inglés (`en`),
  francés (`fr`), alemán (`de`), italiano (`it`), japonés (`ja`), chino (`zh`),
  ruso (`ru`), turco (`tr`), polaco (`pl`). ChelseaMarket no cubre CJK ni
  cirílico: hay fuentes de apoyo OFL en `assets/fonts/` — `Yomogi` (ja),
  `MaShanZheng` (zh) y `Caveat` (ru) — que `assets-cache.js`/`applyLangFont`
  inserta en la pila solo cuando el idioma activo las necesita (los latinos
  siguen con ChelseaMarket). Las demos sin `assets-cache.js` caen a fuente
  del sistema.
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
