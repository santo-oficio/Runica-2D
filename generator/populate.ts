/**
 * Población de entidades (docs/03-GENERADOR-NIVELES.md §2).
 *
 * Una vez generado el grid del arquetipo, el generador coloca:
 *  - jugador (P): único, en una celda transitable.
 *  - objetivo (G): único, en una celda transitable, con distancia mínima
 *    al jugador y camino topológico posible (pre-filtro).
 *  - enemigos (E): nº según la franja de dificultad, a distancia mínima
 *    del jugador, sin solaparse.
 *  - obstáculos (X): opcionales, en celdas transitables, sin bloquear el
 *    100% de los caminos (lo confirma el solver completo).
 *  - puertas (D) y llaves (K): opcionales, en niveles avanzados.
 *
 * Reglas:
 *  - distancia mínima (en casillas, Manhattan) entre jugador y cada enemigo.
 *  - distancia mínima entre jugador y objetivo.
 *  - al menos un camino topológico entre jugador y objetivo (pre-filtro).
 *  - ninguna entidad se solapa con otra ni con paredes.
 */

import type { CellPos, Enemy, EnemyPattern, WorldConfig } from "../schemas/types.js";
import type { Rng } from "./rng.js";
import { hasPath, manhattan } from "./topology.js";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Entidades colocadas en el tablero (antes de serializar a LevelMap). */
export interface PlacedEntities {
  readonly player: CellPos;
  readonly goal: CellPos;
  readonly enemies: readonly Enemy[];
  readonly obstacles: readonly CellPos[];
  readonly keys: readonly CellPos[];
  readonly doors: readonly CellPos[];
}

/** Opciones de población. */
export interface PopulateOptions {
  /** Distancia Manhattan mínima entre jugador y objetivo. */
  readonly minPlayerGoalDistance: number;
  /** Distancia Manhattan mínima entre jugador y cada enemigo. */
  readonly minPlayerEnemyDistance: number;
  /** Número de enemigos a colocar. */
  readonly enemyCount: number;
  /** Patrones de enemigos permitidos (se elige aleatoriamente). */
  readonly enemyPatterns: readonly EnemyPattern[];
  /** Número de obstáculos a colocar (0 para ninguno). */
  readonly obstacleCount: number;
  /** Número de puertas a colocar (0 para ninguna). */
  readonly doorCount: number;
  /** Número de llaves a colocar (0 para ninguna). */
  readonly keyCount: number;
  /** Máximo de intentos antes de rendirse al colocar una entidad. */
  readonly maxPlacementAttempts: number;
}

export const DEFAULT_POPULATE_OPTIONS: PopulateOptions = {
  minPlayerGoalDistance: 4,
  minPlayerEnemyDistance: 3,
  enemyCount: 1,
  enemyPatterns: ["PERSECUCION_SIMPLE", "PATRULLA_FIJA", "ALEATORIO_ACOTADO"],
  obstacleCount: 0,
  doorCount: 0,
  keyCount: 0,
  maxPlacementAttempts: 200,
};

// ---------------------------------------------------------------------------
// Colocación
// ---------------------------------------------------------------------------

/**
 * Coloca entidades en el grid. Modifica el grid in-place escribiendo los
 * chars de cada entidad (`P`, `G`, `E`, `X`, `D`, `K`).
 *
 * Devuelve las posiciones colocadas o lanza si no encuentra colocación
 * válida tras `maxPlacementAttempts` intentos para alguna entidad crítica
 * (jugador, objetivo).
 */
export function populateEntities(
  grid: string[][],
  rng: Rng,
  opts: PopulateOptions = DEFAULT_POPULATE_OPTIONS,
): PlacedEntities {
  const floors = listFloorCells(grid);
  if (floors.length < 2) {
    throw new Error(`no hay suficientes celdas transitables (${floors.length}) para colocar entidades`);
  }

  // --- Jugador ---
  const player = pickPlayer(floors, rng);
  markCell(grid, player, "P");
  const remaining = floors.filter((c) => !(c[0] === player[0] && c[1] === player[1]));

  // --- Objetivo ---
  const goal = pickGoal(grid, remaining, player, rng, opts);
  markCell(grid, goal, "G");
  let available = remaining.filter((c) => !(c[0] === goal[0] && c[1] === goal[1]));

  // --- Enemigos ---
  const enemies: Enemy[] = [];
  for (let i = 0; i < opts.enemyCount; i++) {
    const placed = placeAtDistance(available, player, opts.minPlayerEnemyDistance, rng);
    if (placed) {
      enemies.push({ pos: placed, pattern: rng.pick(opts.enemyPatterns) });
      markCell(grid, placed, "E");
      available = available.filter((c) => !(c[0] === placed[0] && c[1] === placed[1]));
    }
  }

  // --- Obstáculos ---
  const obstacles: CellPos[] = [];
  for (let i = 0; i < opts.obstacleCount; i++) {
    const placed = placeAny(available, rng);
    if (placed) {
      markCell(grid, placed, "X");
      obstacles.push(placed);
      available = available.filter((c) => !(c[0] === placed[0] && c[1] === placed[1]));
    }
  }

  // --- Puertas ---
  const doors: CellPos[] = [];
  for (let i = 0; i < opts.doorCount; i++) {
    const placed = placeAny(available, rng);
    if (placed) {
      markCell(grid, placed, "D");
      doors.push(placed);
      available = available.filter((c) => !(c[0] === placed[0] && c[1] === placed[1]));
    }
  }

  // --- Llaves ---
  const keys: CellPos[] = [];
  for (let i = 0; i < opts.keyCount; i++) {
    const placed = placeAny(available, rng);
    if (placed) {
      markCell(grid, placed, "K");
      keys.push(placed);
      available = available.filter((c) => !(c[0] === placed[0] && c[1] === placed[1]));
    }
  }

  return { player, goal, enemies, obstacles, keys, doors };
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function listFloorCells(grid: string[][]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r]!.length; c++) {
      if (grid[r]![c] === ".") out.push([c, r]);
    }
  }
  return out;
}

function markCell(grid: string[][], pos: CellPos, ch: string): void {
  grid[pos[1]]![pos[0]] = ch;
}

function pickPlayer(floors: Array<[number, number]>, rng: Rng): CellPos {
  return rng.pick(floors);
}

function pickGoal(
  grid: string[][],
  candidates: Array<[number, number]>,
  player: CellPos,
  rng: Rng,
  opts: PopulateOptions,
): CellPos {
  const shuffled = rng.shuffle([...candidates]);
  for (const cand of shuffled) {
    if (manhattan(player, cand) < opts.minPlayerGoalDistance) continue;
    // Pre-filtro topológico: debe existir un camino jugador→objetivo.
    if (!hasPath(grid.map((r) => r.join("")), player, cand)) continue;
    return cand;
  }
  // Si no encontramos uno ideal, relajamos la distancia mínima pero
  // mantenemos el pre-filtro topológico (camino obligatorio).
  for (const cand of shuffled) {
    if (hasPath(grid.map((r) => r.join("")), player, cand)) return cand;
  }
  throw new Error("no se encontró colocación válida para el objetivo con camino al jugador");
}

function placeAtDistance(
  candidates: Array<[number, number]>,
  ref: CellPos,
  minDist: number,
  rng: Rng,
): CellPos | null {
  const shuffled = rng.shuffle([...candidates]);
  for (const cand of shuffled) {
    if (manhattan(ref, cand) < minDist) continue;
    return cand;
  }
  // Relajar distancia si no encontramos.
  return shuffled[0] ?? null;
}

function placeAny(
  candidates: Array<[number, number]>,
  rng: Rng,
): CellPos | null {
  if (candidates.length === 0) return null;
  return rng.pick(candidates);
}

// ---------------------------------------------------------------------------
// Derivar opciones de población desde WorldConfig + nº de nivel
// ---------------------------------------------------------------------------

/**
 * Deriva las opciones de población desde el `WorldConfig` y el número de
 * nivel (para elegir la franja de dificultad).
 *
 * Usa la tabla `difficultyTable` del mundo para decidir `enemyCount`.
 * Las demás opciones usan defaults razonables escalados por estrellas.
 */
export function optionsFromWorld(
  world: WorldConfig,
  levelNumber: number,
): PopulateOptions {
  const band = world.difficultyTable.find((b) => levelNumber >= b.range[0] && levelNumber <= b.range[1])
    ?? world.difficultyTable[world.difficultyTable.length - 1]!;
  const stars = band.stars;
  return {
    ...DEFAULT_POPULATE_OPTIONS,
    enemyCount: Math.min(band.maxEnemies, Math.max(1, Math.floor(stars / 2) + 1)),
    obstacleCount: stars >= 2 ? Math.min(4, stars - 1) : 0,
    doorCount: stars >= 4 ? 1 : 0,
    keyCount: stars >= 4 ? 1 : 0,
    minPlayerGoalDistance: 3 + stars,
    minPlayerEnemyDistance: 2 + Math.floor(stars / 2),
  };
}
