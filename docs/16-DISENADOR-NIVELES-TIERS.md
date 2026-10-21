# Diseñador de Niveles — 15 Tiers de Dificultad

> Documento de referencia del sistema de generación de pantallas.
> Rediseño completo (pipeline: candidato → solver BFS → pruning estricto
> → compleción de mínimos → alargamiento/recorte → validación → dedupe
> por simetrías). Todo el código vive en
> `generator/generate-screens.ts`.

## 1. Visión general

- Tablero fijo **8×6** (48 casillas).
- Objetivo: **100.000 puzzles únicos por tier** en `db/screens-tier-N.json`.
  En tiers donde el espacio válido es menor se generan todos los que
  existen y se informa del número real — nunca se rellena con duplicados.
- La partida empieza en el **tier 6** (`FIRST_TIER` en `db/db.ts`) y la
  curva llega progresivamente hasta el **15**, pero
  se generan bancos para todos los tiers 1-15.
- El tier 15 coincide con el techo de la curva y también es el del boss
  final (última isla de MAZMORRA, `mapTierFor`).

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

- Escala progresiva por debajo del 7: par 4–6 (T1), 5–7 (T2), 6–8 (T3),
  7–9 (T4), 8–10 (T5), 10–14 (T6).
- **Desde el tier 7, el par mínimo es 12** (rango 12–16 y creciente).
- Ningún puzzle se resuelve por el **camino directo** (mínimo real =
  distancia BFS del tablero vacío) ni en **un único movimiento**.

### Enemigos

- **Máximo 2 enemigos** por pantalla en todo el juego (el 3 solo está
  permitido en bosses desde dificultad ~10-11 si fuese imprescindible;
  actualmente no se usa — el boss final va con 2).
- Con 2 enemigos: distancia Manhattan **≥ 4** entre ellos, colocados para
  cubrir tramos distintos del camino (bias táctico hacia el tramo final
  / guardia de la salida — un enemigo lejos de la ruta atrapa casi
  siempre porque es 2× más rápido y produce ruido irresoluble).

### Elementos (obstáculos, trampas, llaves…)

- **Todo elemento es imprescindible**: al quitarlo, el puzzle deja de ser
  resoluble o cambia su mínimo real. El pruning lo verifica elemento a
  elemento; la validación lo re-verifica al final.
- **Mínimo 2 obstáculos desde el tier 4** — y también deben ser
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
| 1    | 1        | 0–2        | 0       | 4–7          | 2         | —         |
| 2    | 1        | 0–2        | 0–1     | 5–7          | 3         | —         |
| 3    | 1        | 1–2        | 0–1     | 6–8          | 4         | —         |
| 4    | 1        | 2–3        | 0–1     | 7–9          | 4         | —         |
| 5    | 1        | 2–3        | 1       | 8–10         | 4         | —         |
| 6    | 2        | 2–4        | 1–2     | 10–14        | 4         | 4         |
| 7    | 2        | 4–8        | 2–4     | 12–16        | 3         | 4         |
| 8    | 2        | 4–9        | 2–4     | 13–18        | 3         | 4         |
| 9    | 2        | 5–9        | 2–5     | 14–19        | 3         | 4         |
| 10   | 2        | 5–10       | 2–5     | 15–20        | 3         | 4         |
| 11   | 2        | 5–10       | 3–6     | 16–21        | 3         | 4         |
| 12   | 2        | 5–11       | 3–6     | 17–22        | 3         | 4         |
| 13   | 2        | 5–11       | 3–7     | 18–24        | 3         | 4         |
| 14   | 2        | 5–12       | 3–7     | 19–25        | 3         | 4         |
| 15 * | 2        | 5–8        | 4–6     | 18–26        | 3         | 4         |

\* Tier 15 = boss final. Los máximos de obstáculos/trampas en tiers ≥7
son altos a propósito: son el techo que `lengthenTo` puede usar para
construir los pars largos; solo sobreviven los elementos necesarios.

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
# Banco completo (100k/tier donde exista)
npx tsx generator/generate-screens.ts

# Un tier concreto
npx tsx generator/generate-screens.ts --tier=7 --count=100000

# Paralelo por workers (seeds disjuntas + dedupe global en el merge)
npx tsx generator/generate-screens.ts --workers=8

# Lote de prueba con estadísticas (no escribe en db/)
npx tsx generator/generate-screens.ts --test --count=150
```

- El **tier 1 se enumera exhaustivamente** (~9,5M combinaciones, jugador
  a distancia ≤ parMax−1 × enemigo × subconjuntos de obstáculos en el
  corredor jugador↔salida): su espacio válido completo es de
  **~258 puzzles únicos** (dato medido; los de par ≤5 no existen porque
  un enemigo necesario ya fuerza mínimos más largos).
- Estadísticas del lote de prueba (12000 intentos/tier): éxito ~0,1–1%
  según tier; el mayor descarte es `unprunable` (candidatos
  irresolubles: el enemigo es 2× más rápido y atrapa en tablero
  abierto) seguido de `min_elements_unreachable` (no se puede
  re-insertar un elemento necesario).
- Estimación: ~250–700ms por pantalla aceptada según tier →
  100k/tier ≈ 7–20h con 1 worker, ~1–2,5h con 8 workers.

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
