/**
 * Reglas del motor de juego (docs/05-REGLAS-MOTOR-JUEGO.md).
 *
 * API mínima determinista, ejecutable en modo headless (sin gráficos) para
 * que el solver la reutilice literalmente (Fase 4, regla de oro del
 * proyecto: "lo que se valida es lo que se juega").
 *
 * Funciones:
 *  - isValidMove(state, pos, direction): valida colisiones, límites,
 *    paredes, obstáculos, puertas (con llave).
 *  - playerMove(state, direction): mueve al jugador si es válido, recoge
 *    llaves, abre puertas.
 *  - enemyMove(state, enemyIndex): aplica el patrón de movimiento del
 *    enemigo (patrulla, persecución simple, aleatorio acotado, vigilancia).
 *  - canEnemyReachPlayer(state, enemyIndex): BFS de amenaza.
 *  - isLevelSolved(state): condición de victoria.
 *  - isLevelFailed(state): condición de derrota.
 *  - playTurn(state, direction): bucle de turno completo (input → player →
 *    objetos → enemigos → colisión → victoria/derrota).
 */

import type { CellPos } from "../schemas/types.js";
import { createRng, type Rng } from "../generator/rng.js";
import {
  type Direction,
  type GameState,
  type MoveResult,
  DIRECTION_DELTA,
} from "./state.js";

// ---------------------------------------------------------------------------
// Helpers de celda
// ---------------------------------------------------------------------------

/** Char en una posición del grid, o undefined si fuera de bounds. */
function cellAt(state: GameState, col: number, row: number): string | undefined {
  if (row < 0 || row >= state.height || col < 0 || col >= state.width) return undefined;
  return state.grid[row]![col];
}

/** true si hay un enemigo en la posición dada. */
function enemyAt(state: GameState, col: number, row: number): boolean {
  return state.enemies.some((e) => e.pos[0] === col && e.pos[1] === row);
}

// ---------------------------------------------------------------------------
// IsValidMove (doc 05 §2)
// ---------------------------------------------------------------------------

/**
 * Valida si el jugador en `pos` puede moverse en `direction`.
 * Comprueba: límites del tablero, paredes, obstáculos, puertas (con llave),
 * y que la celda destino no esté ocupada por un enemigo (el jugador no se
 * mueve onto un enemigo; es el enemigo quien captura al jugador).
 */
export function isValidMove(
  state: GameState,
  pos: CellPos,
  direction: Direction,
): { valid: boolean; reason: string | null; target: CellPos } {
  const [dc, dr] = DIRECTION_DELTA[direction];
  const target: CellPos = [pos[0] + dc, pos[1] + dr];

  // Límites
  if (target[0] < 0 || target[0] >= state.width || target[1] < 0 || target[1] >= state.height) {
    return { valid: false, reason: "fuera de límites", target };
  }

  const ch = cellAt(state, target[0], target[1]);
  if (ch === undefined) return { valid: false, reason: "celda indefinida", target };

  // Pared
  if (ch === "#") return { valid: false, reason: "pared", target };
  // Obstáculo
  if (ch === "X") return { valid: false, reason: "obstáculo", target };
  // Trampa: el jugador PUEDE entrar (no le bloquea)
  // Puerta cerrada
  if (ch === "D" && !state.doorsOpen.some(([c, r]) => c === target[0] && r === target[1])) {
    return { valid: false, reason: "puerta cerrada (falta llave)", target };
  }
  // Enemigo en la celda destino (el jugador no se mueve onto un enemigo)
  if (enemyAt(state, target[0], target[1])) {
    return { valid: false, reason: "enemigo en la celda destino", target };
  }

  return { valid: true, reason: null, target };
}

// ---------------------------------------------------------------------------
// Player.Move (doc 05 §2, §3)
// ---------------------------------------------------------------------------

/**
 * Mueve al jugador en `direction` si es válido. Recoge llaves y abre
 * puertas automáticamente al entrar en su celda.
 *
 * Mutación in-place del `state`. Devuelve `MoveResult`.
 * Si el movimiento no es válido, no muta nada.
 */
export function playerMove(state: GameState, direction: Direction): MoveResult {
  if (state.solved || state.failed) {
    return { moved: false, reason: "partida finalizada", pickedKey: null, openedDoor: null };
  }

  // Abrir puertas adyacentes con llaves ANTES de validar el movimiento.
  // Así el jugador puede cruzar una puerta en el mismo turno que la abre
  // si ya estaba adyacente con llave.
  const openedDoor = openAdjacentDoors(state);

  const check = isValidMove(state, state.player, direction);
  if (!check.valid) {
    return { moved: false, reason: check.reason, pickedKey: null, openedDoor };
  }
  const target = check.target;
  const ch = cellAt(state, target[0], target[1])!;

  let pickedKey: CellPos | null = null;

  // Recoger llave
  if (ch === "K") {
    pickedKey = target;
    state.keysCollected.push(target);
    // Quitar la llave del grid
    state.grid[target[1]] = replaceChar(state.grid[target[1]]!, target[0], ".");
  }

  // Mover jugador
  state.player = target;

  // Trampa: quien la pisa queda aturdido 3 turnos (jugador o enemigo).
  if (ch === "T") {
    state.playerStunnedTurns = 3;
  }

  return { moved: true, reason: null, pickedKey, openedDoor };
}

/**
 * Abre automáticamente las puertas adyacentes al jugador si tiene llaves.
 * Cada llave abre una puerta (se consume). Devuelve la puerta abierta o null.
 */
function openAdjacentDoors(state: GameState): CellPos | null {
  if (state.keysCollected.length === 0) return null;
  const [pc, pr] = state.player;
  const adjacents: CellPos[] = [
    [pc + 1, pr], [pc - 1, pr], [pc, pr + 1], [pc, pr - 1],
  ];
  for (const [c, r] of adjacents) {
    if (cellAt(state, c, r) === "D" && !state.doorsOpen.some(([dc, dr]) => dc === c && dr === r)) {
      // Abrir esta puerta (consume una llave del inventario)
      state.doorsOpen.push([c, r]);
      state.grid[r] = replaceChar(state.grid[r]!, c, ".");
      // Consumir una llave (la última recogida)
      state.keysCollected.pop();
      return [c, r]; // Una puerta por turno
    }
  }
  return null;
}

function replaceChar(s: string, index: number, ch: string): string {
  return s.slice(0, index) + ch + s.slice(index + 1);
}

// ---------------------------------------------------------------------------
// Enemy.Move (doc 05 §4) — 4 patrones
// ---------------------------------------------------------------------------

/**
 * Mueve un enemigo según su patrón. Mutación in-place del `state`.
 * No mueve onto el jugador directamente (la colisión se detecta después).
 */
export function enemyMove(state: GameState, enemyIndex: number, rng: Rng = createRng(0)): void {
  const enemy = state.enemies[enemyIndex];
  if (!enemy) return;
  switch (enemy.pattern) {
    case "PATRULLA_FIJA":
      movePatrol(state, enemyIndex);
      break;
    case "PERSECUCION_SIMPLE":
      moveChase(state, enemyIndex);
      break;
    case "ALEATORIO_ACOTADO":
      moveRandom(state, enemyIndex, rng);
      break;
    case "VIGILANCIA_ZONA":
      // No se mueve.
      break;
  }
}

/** Patrulla una ruta fija (si existe). */
function movePatrol(state: GameState, idx: number): void {
  const enemy = state.enemies[idx]!;
  const route = enemy.patrolRoute;
  if (!route || route.length === 0) return; // sin ruta, no se mueve
  const nextStep = (enemy.step + 1) % route.length;
  const nextPos = route[nextStep]!;
  // Solo se mueve si la celda es transitable
  if (isWalkableForEnemy(state, nextPos[0], nextPos[1], idx)) {
    enemy.pos = nextPos;
    enemy.step = nextStep;
  }
}

/** Persecución simple: un paso hacia el jugador, preferencia horizontal primero (regla Wappo).
 *  Si no puede avanzar directamente hacia el jugador, NO se mueve.
 *  Esto es intencional: el jugador explota la estupidez del enemigo. */
function moveChase(state: GameState, idx: number): void {
  const enemy = state.enemies[idx]!;
  const [ec, er] = enemy.pos;
  const [pc, pr] = state.player;
  const dx = Math.sign(pc - ec);
  const dy = Math.sign(pr - er);
  // Wappo: siempre intenta horizontal primero, luego vertical
  const candidates: CellPos[] = [];
  if (dx !== 0) candidates.push([ec + dx, er]);
  if (dy !== 0) candidates.push([ec, er + dy]);
  for (const c of candidates) {
    if (isWalkableForEnemy(state, c[0], c[1], idx)) {
      enemy.pos = c;
      return;
    }
  }
  // Si no puede avanzar hacia el jugador, no se mueve.
}

/** Aleatorio acotado: se mueve a una celda transitable adyacente al azar. */
function moveRandom(state: GameState, idx: number, rng: Rng): void {
  const enemy = state.enemies[idx]!;
  const [ec, er] = enemy.pos;
  const candidates: CellPos[] = [
    [ec + 1, er], [ec - 1, er], [ec, er + 1], [ec, er - 1],
  ];
  const options = candidates.filter(([c, r]) => isWalkableForEnemy(state, c, r, idx));
  if (options.length === 0) return;
  enemy.pos = rng.pick(options);
}

/** true si la celda es transitable para un enemigo (suelo, objetivo, trampa, o celda del jugador = captura).
 *  Los enemigos SÍ pueden solaparse entre sí durante el movimiento (cuando
 *  el movimiento los obliga a ello), pero nunca al empezar un nivel. */
function isWalkableForEnemy(state: GameState, col: number, row: number, _selfIdx: number): boolean {
  if (row < 0 || row >= state.height || col < 0 || col >= state.width) return false;
  // El enemigo puede moverse onto el jugador (eso es la captura).
  if (col === state.player[0] && row === state.player[1]) return true;
  const ch = cellAt(state, col, row);
  // "P" y "E" son marcadores de posición inicial (suelo real tras moverse la entidad).
  if (ch !== "." && ch !== "G" && ch !== "T" && ch !== "P" && ch !== "E") return false;
  // Los enemigos pueden solaparse entre sí: no bloqueamos el movimiento
  // hacia celdas ocupadas por otros enemigos. El solapamiento solo ocurre
  // dinámicamente, nunca en la posición inicial (lo garantiza el generador).
  return true;
}

// ---------------------------------------------------------------------------
// CanEnemyReachPlayer (doc 05 §2) — BFS de amenaza
// ---------------------------------------------------------------------------

/**
 * BFS: ¿puede el enemigo alcanzar al jugador moviéndose por celdas
 * transitables (suelo)? Devuelve la distancia en pasos o `Infinity`.
 *
 * Usado por el solver para medir amenaza y por el validador (check
 * `noAbsurdSituations`).
 */
export function canEnemyReachPlayer(
  state: GameState,
  enemyIndex: number,
): number {
  const enemy = state.enemies[enemyIndex];
  if (!enemy) return Infinity;
  const start = enemy.pos;
  const goal = state.player;
  if (start[0] === goal[0] && start[1] === goal[1]) return 0;

  const visited = new Set<string>();
  const key = (c: number, r: number) => `${c},${r}`;
  const queue: Array<[number, number, number]> = [[start[0], start[1], 0]];
  visited.add(key(start[0], start[1]));

  while (queue.length > 0) {
    const [c, r, d] = queue.shift()!;
    if (c === goal[0] && r === goal[1]) return d;
    const neighbors: Array<[number, number]> = [
      [c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1],
    ];
    for (const [nc, nr] of neighbors) {
      const k = key(nc, nr);
      if (visited.has(k)) continue;
      // El enemigo puede pasar por suelo y por la celda del jugador
      const ch = cellAt(state, nc, nr);
      const isGoalCell = nc === goal[0] && nr === goal[1];
      if (ch === "." || ch === "G" || isGoalCell) {
        visited.add(k);
        queue.push([nc, nr, d + 1]);
      }
    }
  }
  return Infinity;
}

// ---------------------------------------------------------------------------
// IsLevelSolved / IsLevelFailed (doc 05 §5)
// ---------------------------------------------------------------------------

/**
 * Condición de victoria: el jugador está en la celda objetivo `G`.
 * (Requisitos previos como llaves/puertas ya se manejan en playerMove.)
 */
export function isLevelSolved(state: GameState): boolean {
  return state.player[0] === state.goal[0] && state.player[1] === state.goal[1];
}

/**
 * Condición de derrota: algún enemigo está en la misma celda que el jugador.
 */
export function isLevelFailed(state: GameState): boolean {
  return state.enemies.some(
    (e) => e.pos[0] === state.player[0] && e.pos[1] === state.player[1],
  );
}

// ---------------------------------------------------------------------------
// Bucle de turno (doc 05 §3)
// ---------------------------------------------------------------------------

/**
 * Ejecuta un turno completo del juego (reglas Wappo originales):
 *  1. Input del jugador → playerMove(direction)
 *     - Si el jugador está aturdido (trampa), el input se ignora pero el turno avanza.
 *  2. ¿Jugador en salida? → VICTORIA (antes de que se mueva el enemigo)
 *  3. El enemigo hace 2 pasos hacia el jugador (Wappo: 2 casillas/turno)
 *     - Tras cada paso, comprueba colisión → DERROTA
 *     - Si una entidad (jugador o enemigo) cae en trampa (T), queda aturdida 3 turnos.
 *  4. ¿Jugador en salida? → VICTORIA (recheck tras movimiento enemigo)
 *  5. Si ni victoria ni derrota → turno++
 *
 * Mutación in-place del `state`. Devuelve el estado actualizado para
 * encadenar. El `rng` se usa para enemigos aleatorios (debe ser determinista
 * para el solver).
 */
export function playTurn(
  state: GameState,
  direction: Direction,
  rng: Rng = createRng(0),
): GameState {
  if (state.solved || state.failed) return state;

  // 1. Player move — si no se puede mover (pared/obstáculo/límites),
  //    NO cuenta como movimiento: el turno no avanza, los enemigos no se mueven.
  //    Excepción: si el jugador está aturdido (trampa), el input se ignora pero
  //    el turno SÍ avanza (los enemigos se mueven con normalidad).
  if (state.playerStunnedTurns > 0) {
    state.playerStunnedTurns -= 1;
  } else {
    const result = playerMove(state, direction);
    if (!result.moved) {
      return state;
    }
  }

  // 2. Check victoria inmediata (jugador en G, antes de que se mueva el enemigo)
  if (isLevelSolved(state)) {
    state.solved = true;
    return state;
  }

  // 3. Enemy moves — cada enemigo hace 2 sub-pasos (regla Wappo).
  //    Procesamos un enemigo a la vez (ambos sub-pasos) para que el orden
  //    coincida con el simulador de referencia (wappo_simulator.py):
  //    enemigo 0 hace sub-paso 0 + sub-paso 1, luego enemigo 1, etc.
  for (let i = 0; i < state.enemies.length; i++) {
    // Aturdimiento: decrementar 1 vez por turno y saltar todo el turno
    // (ambos sub-pasos). Esto da 3 turnos completos de inmovilización,
    // no 3 sub-pasos (= 1.5 turnos) como antes.
    if ((state.enemyStunnedTurns[i] ?? 0) > 0) {
      state.enemyStunnedTurns[i] = (state.enemyStunnedTurns[i] ?? 0) - 1;
      continue; // aturdido: salta los 2 sub-pasos de este turno
    }
    for (let step = 0; step < 2; step++) {
      const before = state.enemies[i]!.pos;
      enemyMove(state, i, rng);

      // Check derrota tras cada sub-paso (colisión jugador-enemigo)
      // Va antes del trap check: si el enemigo captura al jugador
      // pisando simultáneamente una trampa, la captura tiene prioridad.
      if (isLevelFailed(state)) {
        state.failed = true;
        state.failureReason = "colisión con enemigo";
        return state;
      }

      // Solo aturde al ENTRAR en una trampa (si realmente se movió a ella).
      // Un enemigo atascado sobre una trampa no se re-atarde.
      const after = state.enemies[i]!.pos;
      if (before[0] !== after[0] || before[1] !== after[1]) {
        const ch = cellAt(state, after[0], after[1]);
        if (ch === "T") {
          state.enemyStunnedTurns[i] = 3;
          break; // pisó trampa: para de moverse este turno
        }
      }
    }
  }

  // 4. Check victoria (tras movimiento de enemigos)
  if (isLevelSolved(state)) {
    state.solved = true;
    return state;
  }

  // 5. Turno++
  state.turn++;
  return state;
}

// ---------------------------------------------------------------------------
// Reproducir una secuencia de movimientos (para el test end-to-end de Fase 5)
// ---------------------------------------------------------------------------

/**
 * Reproduce una secuencia de direcciones como una partida real.
 * Devuelve el estado final. Mutación in-place del `state` inicial.
 */
export function replayMoves(
  state: GameState,
  moves: readonly Direction[],
  rng: Rng = createRng(0),
): GameState {
  for (const dir of moves) {
    playTurn(state, dir, rng);
    if (state.solved || state.failed) break;
  }
  return state;
}
