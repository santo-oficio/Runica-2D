# Diseñador de Niveles — Tiers 6-18 de Dificultad

> Documento de referencia del sistema de generación de pantallas.
> Rediseño completo (pipeline: candidato → solver BFS → pruning estricto
> → compleción de mínimos → alargamiento/recorte → validación → dedupe
> por simetrías). Todo el código vive en
> `generator/generate-screens.ts`.

## 1. Visión general

- Tablero fijo **8×6** (48 casillas).
- Objetivo: **25.000 puzzles únicos por tier** en `db/screens-tier-N.json`.
  En tiers donde el espacio válido es menor se generan todos los que
  existen y se informa del número real — nunca se rellena con duplicados.
- La partida empieza en el **tier 1** en la primera isla de cada mundo
  (`mapTierFor`: isla 0 → tier 1, isla 1 → tier 2) y la curva de progreso
  va del **tier 2** (`FIRST_TIER` en `db/db.ts`) al **18**. Los tiers 1-4
  llevan **un** cazador — solo se aceptan las pantallas en las que
  condiciona de verdad la ruta (`decorative_enemy`); el tier 5
  introduce el segundo cazador. (Medido: con 0 enemigos el espacio queda
  vacío — los obstáculos no canalizan sin perseguidor, candidate_null ~72%.)
- El tier 18 coincide con el techo de la curva y también es el del boss
  final (última isla de MAZMORRA, `mapTierFor`).
- **REGLA A FUEGO — separación avatar↔salida** (`MIN_PLAYER_EXIT_COLDIST`):
  `|col(jugador) − col(salida)| ≥ 6`. En un tablero de 8 columnas solo
  quedan las parejas 0↔6/7 y 1↔7 (y su espejo): la salida siempre está
  en el lado opuesto. Se exige al generar el candidato (`distPool`) y se
  re-verifica en `validateCandidate` (`exit_too_close`). Consecuencia:
  el mínimo real es ≥7 y el par ≥8 en cualquier pantalla.
- **REGLA A FUEGO #2 — ruta limpia, sin "adelante y atrás"**
  (`MAX_PATH_REVISITS`, `findCleanSolution`): toda pantalla debe admitir
  **alguna solución de ≤ par turnos** que re-entre en como mucho **3
  casillas** ya visitadas. Volver a pisar una casilla es el "voy adelante
  y atrás" para cebar/esquivar al cazador 2×; un rodeo estratégico no
  revisita nada y pisar una trampa espera 3 turnos sin moverse. Se exige
  en `validateCandidate` (`no_clean_route`) tras fijar el par. Medido:
  sin la regla, la ruta óptima del BFS revisitaba hasta ~15 casillas en
  tier 18 (¡la mitad del camino!); la regla es de *existencia* — el BFS
  puede devolver una ruta bailona aunque haya una limpia de igual par.

## 2. Conteo de turnos y "jugada óptima" (par)

- Los turnos cuentan desde **1**: el primer movimiento es el turno 1 y un
  óptimo de 12 significa victoria en el turno 12.
- `minMoves`/`par` (lo que muestra el juego como "jugada óptima") es el
  **mínimo real BFS + 1 o +2**: el puzzle siempre se puede resolver en
  `par − 1` o `par − 2`, así que el jugador puede "batir el óptimo".
- La regla de bateabilidad exige al menos una solución en `par−1` **o**
  `par−2`; si no existe ninguna, se descarta.
- Cada pantalla guarda `sols = [n(par), n(par−1), n(par−2)]` (conteo
  exacto acotado a 50) para el comando `solutions` de la consola.

## 3. Reglas de generación

### Longitud de solución por tier

- La curva jugable arranca en el tier 1 (par 8–9, bienvenida de mundo)
  y crece hasta el 18 (par 22–30). **Desde el tier 7, el par mínimo es
  12** (ver tabla).
- Ningún puzzle se resuelve por el **camino directo** (mínimo real =
  distancia BFS del tablero vacío) ni en **un único movimiento**.

### Enemigos

- **1 enemigo** en los tiers de entrada 1–4, **2 enemigos** en 5–16;
  **3 enemigos desde el tier 17** (máximo absoluto: 3).
- Con ≥2 enemigos: distancia Manhattan **≥ 4** entre todos, colocados
  para cubrir tramos distintos del camino (bias táctico hacia el tramo
  final / guardia de la salida — un enemigo lejos de la ruta atrapa
  casi siempre porque es 2× más rápido y produce ruido irresoluble).

### Elementos (obstáculos, trampas, llaves…)

- **Todo elemento es imprescindible**: al quitarlo, el puzzle deja de ser
  resoluble o cambia su mínimo real. El pruning lo verifica elemento a
  elemento; la validación lo re-verifica al final.
- **Mínimo 2 obstáculos en todos los tiers** — y también deben ser
  necesarios (los mínimos se completan en `ensureElements` probando
  celdas sueltas y parejas; una pareja puede ser necesaria aunque cada
  celda sola no lo sea).
- `lengthenTo`: si tras el pruning el óptimo queda por debajo del rango
  del tier, se añaden elementos que **alargan** la solución (necesarios
  por construcción). `trimTo` hace lo contrario (retira elementos por
  encima de los mínimos si el óptimo se pasa). Un bucle de
  estabilización re-poda si quedan redundantes.

### Uso del tablero (tier ≥ 7)

- Métrica: casillas del camino óptimo ∪ enemigos ∪ obstáculos ∪ trampas
  ∪ jugador ∪ salida, sobre las 48 celdas.
- **Umbral: ≥ 35%** (`MIN_BOARD_USE`). Los datos del lote de prueba
  muestran que es el punto viable: un 60–70% exigiría mínimos reales de
  ~25+ turnos con todo el tablero ocupado — casi imposible con las
  reglas de necesidad estrictas. Los puzzles reales del tier ≥7 quedan
  en 30–69% (los más densos llegan al 60%).

### Validación y dedupe

- El motor es **100% determinista** (sin azar en ejecución): una pasada
  del solver BFS demuestra resolubilidad explorando todo el espacio de
  estados — es más fuerte que simular 100 partidas.
- Dedupe por **simetrías**: espejo horizontal, espejo vertical y
  rotación 180° (el tablero no es cuadrado → no hay rotación de 90°).

### Tabla de tiers

| Tier | Enemigos | Obstáculos | Trampas | Par (óptimo) | Dist. E–P | Dist. E–E |
|------|----------|------------|---------|--------------|-----------|-----------|
| 1 †  | 1        | 2–3        | 0–1     | 8–9          | 4         | 0         |
| 2    | 1        | 2–3        | 1–2     | 8–11         | 4         | 0         |
| 3    | 1        | 2–3        | 1–1     | 9–11         | 3         | 0         |
| 4    | 1        | 2–4        | 1–2     | 9–12         | 3         | 0         |
| 5    | 2        | 2–4        | 1–2     | 9–13         | 4         | 4         |
| 6    | 2        | 2–4        | 1–2     | 10–14        | 4         | 4         |
| 7    | 2        | 4–8        | 2–4     | 12–18        | 3         | 4         |
| 8    | 2        | 4–9        | 2–4     | 13–19        | 3         | 4         |
| 9    | 2        | 5–9        | 2–5     | 14–20        | 3         | 4         |
| 10   | 2        | 5–10       | 2–5     | 15–21        | 3         | 4         |
| 11   | 2        | 5–10       | 3–6     | 16–22        | 3         | 4         |
| 12   | 2        | 5–11       | 3–6     | 17–23        | 3         | 4         |
| 13   | 2        | 5–11       | 3–7     | 18–25        | 3         | 4         |
| 14   | 2        | 5–12       | 3–7     | 19–26        | 3         | 4         |
| 15   | 2        | 5–12       | 4–7     | 20–27        | 3         | 4         |
| 16   | 2        | 6–13       | 4–8     | 21–28        | 3         | 4         |
| 17   | 3        | 6–13       | 4–8     | 22–30        | 3         | 4         |
| 18 * | 3        | 5–9        | 5–8     | 22–30        | 3         | 4         |

\* Tier 18 = boss final. † Tier 1 = bienvenida de mundo: la primera isla
de cada mundo la juega (`mapTierFor`) y la segunda el tier 2; el resto
sigue la curva de progreso 2→18. Los máximos de obstáculos/trampas en
tiers ≥7 son altos a propósito: son el techo que `lengthenTo` puede usar
para construir los pars largos; solo sobreviven los elementos necesarios.

## 4. Reglas del motor (idénticas a `engine/rules.ts`)

- **Jugador**: 1 casilla/turno, ortogonal. Si choca, el movimiento se
  cancela (no cuenta turno).
- **Enemigo CHASE**: 2 sub-pasos por turno, horizontal primero, luego
  vertical. Recalcula en cada sub-paso.
- **Obstáculo (X)**: bloquea a jugador y enemigos.
- **Trampa (T)**: aturde 3 turnos a quien la pisa.
- **Salida (G)**: victoria inmediata al llegar (antes del movimiento
  enemigo).
- **Contacto con enemigo**: derrota.
- **Sin solapamiento inicial** de entidades/elementos.

## 5. Generación

```bash
# Banco completo (25k/tier donde exista)
npx tsx generator/generate-screens.ts

# Un tier concreto
npx tsx generator/generate-screens.ts --tier=7 --count=25000

# Paralelo por workers (seeds disjuntas + dedupe global en el merge)
npx tsx generator/generate-screens.ts --workers=8

# Lote de prueba con estadísticas (no escribe en db/)
npx tsx generator/generate-screens.ts --test --count=150
```

- Estadísticas del lote de prueba con la regla de las 6 columnas
  (24000 intentos/tier): éxito ~0,4–0,7% según tier; el mayor descarte
  es `candidate_null` (~70%: salidas sin pareja válida a ≥6 columnas
  o sin hueco para enemigos útiles) seguido de
  `par_out_of_range` / `min_elements_unreachable`.
- Estimación: ~0,3–1,2s por pantalla aceptada según tier →
  25k/tier ≈ 2–8h con 1 worker, ~15–45min con 11 workers.

## 6. Consola de hacks (`game.html`)

- **Tab** abre/cierra una consola inferior semitransparente
  (`rgba(0,0,0,.78)` + `backdrop-filter`), fuente monoespaciada,
  historial con ↑/↓, foco automático; con la consola abierta las teclas
  no mueven al avatar.
- Comandos (mapa extensible `HACK_CMDS`): `help`, `level` / `level <n>`,
  `complete` (reinicia y reproduce la solución paso a paso),
  `next` / `prev` (banco), `seed <id>`, `restart`, `undo`, `optimal`,
  `turns`, `hint`, `solutions`, `god`, `speed <x>`, `debug` (overlay:
  separación entre enemigos, nº obstáculos+trampas, % de tablero usado),
  `clear`.
- Endpoints del servidor: `GET /api/screen`, `/api/screen-nav`,
  `/api/tier-size`, `/api/solve-screen`, `/api/hint`.

## 7. Animación de derrota

Al morir, el tablero hace su sacudida habitual y el modal de derrota
aparece con un **tembleque propio de ~500ms** (clase `.quake`), sin
bloquear el reintento y desactivado con `prefers-reduced-motion`.
