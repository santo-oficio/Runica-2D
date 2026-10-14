# 🎮 Funcionamiento del juego — estado definitivo

> Documento de referencia del flujo completo de Runika 2D tal como está
> implementado. El flujo real es el que se describe aquí; los `calibrate-*` son
> herramientas de desarrollo.

## 1. Arranque (`menu.html` = punto de entrada)

1. `GET /api/settings` → si no existe `db/settings.json`, defaults
   `{sound:true, music:true, lang:'es'}`.
2. `GET /api/i18n` → archivo del idioma activo (o `?lang=` explícito).
3. Pantalla de carga estilo *Return to Monkey Island*: `GET /api/assets-manifest`
   precarga **todos** los assets de `assets/` (imágenes, sonidos, música;
   excluye `old */`). Las imágenes del hot path se decodifican con
   `Image.decode()` y quedan retenidas en `AssetsCache`.
4. `AssetsCache.startMusic()`: música en bucle si `settings.music` y hay track.
   La posición se conserva en `localStorage` **por pista** — no se corta entre
   pantallas. Pistas por contexto (`AssetsCache.MUSIC`): `main` = mapamundi y
   menús (`The_Captain_s_Last_Map.mp3`), `world` = dentro de un mundo
   (`mistery.mp3`, submundo + tablero), `worldWin` = victoria de un mundo no
   final (`victory_mundo.mp3`, sigue sonando en el mapamundi vía
   `runika-music-override` en sessionStorage), `fin` = cinemática final tras
   derrotar al boss (`victory.mp3`). `setMusicTrack()` cambia de pista y cada
   una retoma su posición al volver. Intentar entrar a un mundo completado o
   bloqueado suena `choque.wav` (denegación).
5. `GET /api/savegame` → `{exists, player}`. Sin partida empezada
   (`player.started !== true`), **Continuar** está deshabilitado y se salta en
   la navegación.

## 2. Nueva partida / Continuar

- **Nueva partida** → `seleccion-personaje.html` → modal de confirmación
  (`assets/comunes/modal.webp` + `modal-areas.json`) → `POST /api/new-game
  {name, avatar}` (`started:true`, progreso reseteado) → `mapamundi.html`.
- **Continuar** → `mapamundi.html` restaurando todo lo persistido en
  `db/player.json`.

## 3. Persistencia (`db/player.json` → `db/db.ts`)

| Campo | Significado |
|---|---|
| `started` | la partida existe |
| `playerName`, `avatarIndex` | identidad fija hasta nueva partida |
| `gold` | oro acumulado |
| `lastWorld` | último mundo seleccionado en el mapamundi |
| `worldProgress.<M>.last` | última isla jugada del mundo (completada o no) |
| `worldProgress.<M>.completed` | islas completadas del mundo |
| `gameLevel` | nivel de juego actual = **tier 4..14** por pantallas superadas (`tierForCompleted`); la última isla de MAZMORRA usa el **tier 15** exclusivo (`FINAL_TIER`) |
| `currentWorld`, `currentSubLevel`, `totalStagesCompleted` | modelo lineal legacy (1..15) |

APIs de progreso: `/api/map-position`, `/api/level-position`,
`/api/level-complete` (POST) · `/api/player`, `/api/stats`, `/api/progress`,
`/api/level-screen` (GET).

## 4. Mapamundi (`mapamundi.html`)

- 8 mundos: ESPACIO, AGUA, TIERRA, FUEGO, HIELO, VIENTO, INFRAMUNDO, MAZMORRA.
- El avatar (`player.avatarIndex`, fijo) se posiciona en `lastWorld`.
- **MAZMORRA** (centro): bloqueado hasta completar los otros 7 mundos.
- Mundo completado (sus 12 islas hechas) → blanco y negro y rechaza la entrada.
- Oro en el área calibrada `gold` de `assets/mapamundi/text-areas.json`.

## 5. Submundo (`submundo.html?world=X`)

- 12 islas por mundo (rejilla serpiente 4×3, posiciones calibradas en
  `assets/submundos/<M>/avatar-positions.json`).
- **Progreso secuencial a fuego**: solo se puede entrar a la isla N si la
  N-1 está completada. Intentos bloqueados → rebote + choque.
- Isla completada → blanco y negro; isla bloqueada → oscurecida.
- `Enter` en isla disponible → `POST /api/level-position` →
  `game.html?world=X&level=N` (la pantallita real).

## 6. Pantallita / tablero (`game.html?world=X&level=N`)

- `GET /api/level-screen?world&level` → pantalla **sticky** del tier
  correspondiente (`mapTierFor`: misma pantalla hasta completar la isla;
  excepción — `world=MAZMORRA&level=11` siempre usa el **tier 15**, el banco
  exclusivo del boss final `db/screens-tier-15.json`).
- El **nivel de juego** mostrado es el **tier por progreso** (1..14; 15 en el boss final):
  niveles 1–3 de 3 pantallas, luego `floor((c-9) × 11 / 87) + 4` — depende
  del contador global, no de la isla/mundo (los mundos se juegan libremente).
- Textos en áreas calibradas (`text-areas.json` del mundo): `turn`/`nTurn`
  (turno actual), `optimal`/`nOptimal` (movimientos mínimos del solver),
  `info` = `board.level` "Nivel X", `gold` = oro (moneda + número,
  alineado a la derecha).
- Enemigos: imágenes de `assets/enemys/display/<M>/`; **bosses solo en la
  isla final** (índice 11) desde `assets/bosses/display/<M>/`.
- Victoria → `POST /api/level-complete` (oro = `max(10, minMoves×5 − turnos)`)
  → overlay con **"Pulsa para continuar"** (`instructions.continue`) →
  Enter/Espacio/R/click:
  - Isla final (índice 11) → `mapamundi.html` (el mundo queda completado:
    gris y bloqueado).
  - Resto de islas → `submundo.html?world=X`.
- Derrota → sacudida de pantalla + flash rojo + reintenta la misma pantalla.
- Sin `?world=` → modo práctica aleatorio (no persiste; solo desarrollo).

### Sonidos comunes (`assets/sounds/comun/`)

| Acción | Sonido |
|---|---|
| Hover sobre botón/opción | `hover.wav` |
| Navegar opciones con flechas | `move.wav` |
| Pulsar botón (no "atrás") | `press.wav` |
| Botón atrás / Escape | `back.wav` |
| Colisión/bloqueo (rebote) | `choque.wav` |
| Pisar trampa | `trampa.wav` |
| Victoria | `victoria.wav` |
| Derrota | `derrota.wav` |
| Derrumbe (boss de mundo) | `derrumbe.mp3` |
| Derrumbe último mundo (fin) | `derrumbe_final.mp3` |
| Teclear nombre (selección) | `pulsacion maquina escribir.mp3` |
| Orbe de mundo restaurado (fin, tono ascendente por `playbackRate`) | `orbe.wav` |
| Moneda cayendo/llegando al contador | `moneda.wav` |

Todos se sirven por `AssetsCache.playSound` y respetan el toggle de sonido de
los ajustes. `game.html`/`game.html` los usan como elementos `Audio`
directos (modo offline de la cache). Los rumbles largos (derrumbes) se
reproducen con fundido de salida (`playFading`/`sndFading`) para no cortar
en seco bajo el modal o la escena siguiente.

## 7. Reglas "a fuego" activas

- Todo texto visible desde `i18n/*.json` (es/en/fr/de/it). Cero literales.
- Fuente única: ChelseaMarket (`assets/fonts/fonts.css`). Nada externo.
- Runtime solo `.webp`; masters PNG en `assets/old */`.
- Tablero 8×6 fijo; motor/solver determinista; enemigos siempre se mueven
  (2 pasos, CHASE); máx. 3 enemigos; trampa aturde 3 turnos.
