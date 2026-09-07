/**
 * Tipos del motor de reglas (docs/05-REGLAS-MOTOR-JUEGO.md).
 *
 * El motor es determinista y programado explícitamente. Ejecuta la partida
 * en tiempo real, pero está diseñado para poder ejecutarse "headless" (sin
 * gráficos) y que el solver lo reutilice literalmente (Fase 4).
 *
 * Estado headless serializable: `GameState` captura todo lo necesario para
 * reanudar/verificar una partida (posiciones de jugador y enemigos, llaves
 * recogidas, puertas abiertas, turno actual). Dos estados idénticos
 * producen evoluciones idénticas.
 */

import type { CellPos, EnemyPattern, LevelMap } from "../schemas/types.js";

// ---------------------------------------------------------------------------
// Direcciones
// ---------------------------------------------------------------------------

/** Las 4 direcciones cardinales (sin diagonales, como Wappo clásico). */
export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

export const ALL_DIRECTIONS: readonly Direction[] = ["UP", "DOWN", "LEFT", "RIGHT"];

/** Desplazamiento (dc, dr) que aplica cada dirección. */
export const DIRECTION_DELTA: Record<Direction, readonly [number, number]> = {
  UP: [0, -1],
  DOWN: [0, 1],
  LEFT: [-1, 0],
  RIGHT: [1, 0],
};

// ---------------------------------------------------------------------------
// Estado del enemigo en runtime
// ---------------------------------------------------------------------------

/**
 * Estado runtime de un enemigo. Inmutable excepto por `pos` y `step`.
 *  - `pos`: posición actual [col, row].
 *  - `pattern`: patrón de movimiento (fijo desde el LevelMap).
 *  - `patrolRoute`: ruta de patrulla fija (solo para PATRULLA_FIJA).
 *  - `step`: índice actual en la ruta de patrulla.
 */
export interface EnemyState {
  pos: CellPos;
  pattern: EnemyPattern;
  patrolRoute?: readonly CellPos[];
  step: number;
}

// ---------------------------------------------------------------------------
// Estado global del juego (headless, serializable)
// ---------------------------------------------------------------------------

/**
 * Estado completo de una partida, serializable y determinista.
 * Dos `GameState` idénticos evolucionan idénticamente.
 */
export interface GameState {
  readonly levelId: number;
  /** Grid del tablero (puede mutar al abrir puertas: `D` → `.`). */
  grid: string[];
  readonly width: number;
  readonly height: number;
  /** Posición actual del jugador [col, row]. */
  player: CellPos;
  /** Posición del objetivo [col, row]. */
  readonly goal: CellPos;
  /** Estados runtime de los enemigos. */
  enemies: EnemyState[];
  /** Llaves recogidas (posiciones originales). */
  keysCollected: CellPos[];
  /** Puertas abiertas (posiciones originales). */
  doorsOpen: CellPos[];
  /** Turno actual (incrementa en cada ciclo completo). */
  turn: number;
  /** true si el nivel está resuelto (jugador en G con requisitos). */
  solved: boolean;
  /** true si el nivel está fallido (colisión con enemigo, etc.). */
  failed: boolean;
  /** Motivo del fallo si `failed` es true. */
  failureReason: string | null;
}

// ---------------------------------------------------------------------------
// Resultado de un movimiento
// ---------------------------------------------------------------------------

/** Resultado de intentar un movimiento del jugador. */
export interface MoveResult {
  /** true si el movimiento se aplicó. */
  moved: boolean;
  /** Motivo si no se aplicó. */
  reason: string | null;
  /** Si se recogió una llave en este movimiento. */
  pickedKey: CellPos | null;
  /** Si se abrió una puerta en este movimiento. */
  openedDoor: CellPos | null;
}

// ---------------------------------------------------------------------------
// Construcción del estado inicial desde un LevelMap
// ---------------------------------------------------------------------------

/**
 * Construye el `GameState` inicial a partir de un `LevelMap`.
 * El estado es headless: no depende de gráficos ni de audio.
 */
export function createInitialState(level: LevelMap): GameState {
  const grid = [...level.grid];
  const enemies: EnemyState[] = level.enemies.map((e) => ({
    pos: e.pos,
    pattern: e.pattern,
    step: 0,
  }));
  return {
    levelId: level.levelId,
    grid,
    width: level.width,
    height: level.height,
    player: level.player,
    goal: level.goal,
    enemies,
    keysCollected: [],
    doorsOpen: [],
    turn: 0,
    solved: false,
    failed: false,
    failureReason: null,
  };
}

// ---------------------------------------------------------------------------
// Snapshot / clonación (para el solver: BFS sobre estados)
// ---------------------------------------------------------------------------

/**
 * Clona un `GameState` de forma profunda. El solver necesita esto para
 * explorar ramas del espacio de estados sin mutar el estado original.
 */
export function cloneState(state: GameState): GameState {
  return {
    levelId: state.levelId,
    grid: [...state.grid],
    width: state.width,
    height: state.height,
    player: state.player,
    goal: state.goal,
    enemies: state.enemies.map((e) => ({
      pos: e.pos,
      pattern: e.pattern,
      patrolRoute: e.patrolRoute,
      step: e.step,
    })),
    keysCollected: [...state.keysCollected],
    doorsOpen: [...state.doorsOpen],
    turn: state.turn,
    solved: state.solved,
    failed: state.failed,
    failureReason: state.failureReason,
  };
}

/**
 * Clave canónica de un estado para el solver (poda de estados repetidos).
 * Dos estados con la misma clave son equivalentes para la búsqueda.
 */
export function stateKey(state: GameState): string {
  const p = `${state.player[0]},${state.player[1]}`;
  const e = state.enemies.map((en) => `${en.pos[0]},${en.pos[1]},${en.step}`).join("|");
  const k = state.keysCollected.map((c) => `${c[0]},${c[1]}`).join("|");
  const d = state.doorsOpen.map((c) => `${c[0]},${c[1]}`).join("|");
  const g = state.grid.join("");
  return `${p}|${e}|${k}|${d}|${g}`;
}
