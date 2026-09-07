/**
 * Checklist de validación (docs/04-SOLVER-VALIDADOR.md §1).
 *
 * Los 10 chequeos que TODO nivel debe pasar antes de aceptarse, como
 * funciones independientes y componibles, cada una con su propio test.
 *
 * Orden "fallar rápido": lo barato primero, lo caro al final.
 * Los chequeos 1–6 son geométricos/estructurales (baratos).
 * El chequeo 7 (solvable) es el más caro (BFS sobre espacio de estados).
 * Los chequeos 8–10 dependen del resultado del solver.
 */

import type {
  BackgroundTemplate,
  CellPos,
  LevelMap,
  WorldConfig,
} from "../schemas/types.js";
import { isTilingFullyResolved } from "../assets-resolver/auto-tiling.js";
import { hasPath } from "../generator/topology.js";
import { canEnemyReachPlayer, playTurn, isLevelSolved } from "../engine/rules.js";
import { createRng } from "../generator/rng.js";
import { ALL_DIRECTIONS, type Direction, type GameState, cloneState, createInitialState, stateKey } from "../engine/state.js";

// ---------------------------------------------------------------------------
// Tipos de resultado de cada chequeo
// ---------------------------------------------------------------------------

export interface CheckResult {
  readonly ok: boolean;
  readonly reason: string | null;
}

export interface ChecklistResult {
  readonly withinBoardArea: CheckResult;
  readonly gridAligned: CheckResult;
  readonly noDecorationOverlap: CheckResult;
  readonly tilingResolved: CheckResult;
  readonly entitiesFit: CheckResult;
  readonly noImpossiblePositions: CheckResult;
  readonly solvable: CheckResult;
  readonly difficultyInRange: CheckResult;
  readonly notTrivial: CheckResult;
  readonly noAbsurdSituations: CheckResult;
  /** true solo si TODOS los 10 chequeos pasan. */
  readonly allOk: boolean;
  /** Motivo del primer fallo (para diagnóstico rápido). */
  readonly firstFailure: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Char en una posición del grid, o undefined si fuera de bounds. */
function charAt(level: LevelMap, col: number, row: number): string | undefined {
  if (row < 0 || row >= level.height || col < 0 || col >= level.width) return undefined;
  return level.grid[row]?.[col];
}

/** true si la celda es transitable (suelo, jugador, enemigo, objetivo, llave, puerta). */
function isWalkableCell(ch: string | undefined): boolean {
  return ch === "." || ch === "P" || ch === "E" || ch === "G" || ch === "K" || ch === "D";
}

/** Lista todas las posiciones de entidades del nivel. */
function allEntityPositions(level: LevelMap): CellPos[] {
  return [
    level.player,
    level.goal,
    ...level.enemies.map((e) => e.pos),
    ...level.keys,
    ...level.doors,
  ];
}

// ---------------------------------------------------------------------------
// Chequeos geométricos (1–6) — baratos, fallar rápido
// ---------------------------------------------------------------------------

/**
 * §1 — Dentro del área permitida: ninguna celda del tablero ocupa
 * coordenadas de la zona protegida (decorativa) del fondo.
 *
 * Como el grid es lógico (no píxeles), se verifica que el tamaño del
 * tablero cabe en el `boardArea` del fondo con algún `allowedCellSize`,
 * a una resolución de referencia (1920x1080).
 */
export function checkWithinBoardArea(
  level: LevelMap,
  background: BackgroundTemplate,
  refWidth = 1920,
  refHeight = 1080,
): CheckResult {
  const boardPx = {
    width: background.boardArea.width * refWidth,
    height: background.boardArea.height * refHeight,
  };
  const fits = background.allowedCellSizes.some(
    (size) => level.width * size <= boardPx.width && level.height * size <= boardPx.height,
  );
  return fits
    ? { ok: true, reason: null }
    : { ok: false, reason: `tablero ${level.width}x${level.height} no cabe en boardArea (${boardPx.width.toFixed(0)}x${boardPx.height.toFixed(0)}px) con ningún allowedCellSize` };
}

/**
 * §2 — Perfectamente alineado: todas las celdas nacen de la rejilla.
 *
 * A nivel lógico, esto se cumple por construcción (el grid es una matriz
 * de `width` × `height`). Se verifica que todas las filas tienen la
 * longitud correcta.
 */
export function checkGridAligned(level: LevelMap): CheckResult {
  for (let r = 0; r < level.height; r++) {
    const row = level.grid[r];
    if (!row || row.length !== level.width) {
      return { ok: false, reason: `fila ${r} tiene longitud ${row?.length ?? "undefined"} != ${level.width}` };
    }
  }
  return { ok: true, reason: null };
}

/**
 * §3 — No invade decoración: ni siquiera con el margen de seguridad extra.
 *
 * Verifica que el `boardArea` del fondo tiene margen suficiente alrededor
 * (que no coincide con ninguna `decorativeArea` no extensible). Como el
 * grid es lógico y ya se verificó que cabe en `boardArea`, este chequeo
 * confirma que `boardArea` no se solapa con zonas decorativas no
 * extensibles.
 */
export function checkNoDecorationOverlap(
  _level: LevelMap,
  background: BackgroundTemplate,
): CheckResult {
  const decorative = background.decorativeAreas ?? [];
  const nonExtendable = decorative.filter((d) => !d.extendable);
  // boardArea no debe solaparse con ninguna decorativeArea no extensible.
  for (const d of nonExtendable) {
    const overlaps =
      background.boardArea.x < d.x + d.width &&
      background.boardArea.x + background.boardArea.width > d.x &&
      background.boardArea.y < d.y + d.height &&
      background.boardArea.y + background.boardArea.height > d.y;
    if (overlaps) {
      return { ok: false, reason: `boardArea se solapa con decorativeArea no extensible en (${d.x},${d.y})` };
    }
  }
  return { ok: true, reason: null };
}

/**
 * §4 — Casillas correctamente encajadas: el auto-tiling tiene un sprite
 * válido para cada combinación de vecinos.
 */
export function checkTilingResolved(level: LevelMap, world: WorldConfig): CheckResult {
  return isTilingFullyResolved(level, world)
    ? { ok: true, reason: null }
    : { ok: false, reason: "auto-tiling no pudo asignar sprite a alguna celda" };
}

/**
 * §5 — Todas las entidades caben: jugador, enemigos, obstáculos, puertas
 * están dentro de celdas jugables y no se solapan.
 */
export function checkEntitiesFit(level: LevelMap): CheckResult {
  const positions = allEntityPositions(level);
  // Dentro de bounds
  for (const [c, r] of positions) {
    if (c < 0 || c >= level.width || r < 0 || r >= level.height) {
      return { ok: false, reason: `entidad en (${c},${r}) fuera de bounds` };
    }
  }
  // No solapamiento
  const seen = new Set<string>();
  for (const [c, r] of positions) {
    const k = `${c},${r}`;
    if (seen.has(k)) return { ok: false, reason: `entidades solapadas en (${c},${r})` };
    seen.add(k);
  }
  // Entidades en celdas transitables (no en pared)
  for (const [c, r] of positions) {
    const ch = charAt(level, c, r);
    if (ch === "#") return { ok: false, reason: `entidad en (${c},${r}) sobre pared` };
  }
  return { ok: true, reason: null };
}

/**
 * §6 — No hay posiciones imposibles: p. ej. un objetivo completamente
 * rodeado de paredes sin ninguna celda adyacente transitable.
 */
export function checkNoImpossiblePositions(level: LevelMap): CheckResult {
  // Objetivo: debe tener al menos un vecino transitable o ser alcanzable.
  const [gc, gr] = level.goal;
  const goalNeighbors: Array<[number, number]> = [
    [gc + 1, gr], [gc - 1, gr], [gc, gr + 1], [gc, gr - 1],
  ];
  const goalHasWalkableNeighbor = goalNeighbors.some(([c, r]) => {
    const ch = charAt(level, c, r);
    return isWalkableCell(ch);
  });
  if (!goalHasWalkableNeighbor) {
    return { ok: false, reason: "objetivo rodeado de paredes (sin celda adyacente transitable)" };
  }
  // Jugador: debe tener al menos un vecino transitable.
  const [pc, pr] = level.player;
  const playerNeighbors: Array<[number, number]> = [
    [pc + 1, pr], [pc - 1, pr], [pc, pr + 1], [pc, pr - 1],
  ];
  const playerHasWalkableNeighbor = playerNeighbors.some(([c, r]) => {
    const ch = charAt(level, c, r);
    return isWalkableCell(ch);
  });
  if (!playerHasWalkableNeighbor) {
    return { ok: false, reason: "jugador rodeado de paredes (sin celda adyacente transitable)" };
  }
  // Camino topológico jugador→objetivo (pre-filtro barato).
  if (!hasPath(level.grid, level.player, level.goal)) {
    return { ok: false, reason: "no hay camino topológico entre jugador y objetivo" };
  }
  return { ok: true, reason: null };
}

// ---------------------------------------------------------------------------
// Chequeo 7 — Solvable (el más caro, BFS sobre espacio de estados)
// ---------------------------------------------------------------------------

/** Resultado del solver de resolubilidad. */
export interface SolverResult {
  readonly solvable: boolean;
  readonly minMoves: number;
  readonly solution: Direction[] | null;
  readonly reason: string | null;
  /** Número de estados explorados (para diagnóstico). */
  readonly statesExplored: number;
}

/** Opciones del solver. */
export interface SolverOptions {
  /** Profundidad máxima (número de movimientos). */
  readonly maxDepth: number;
  /** Máximo de estados a explorar (poda). */
  readonly maxStates: number;
}

export const DEFAULT_SOLVER_OPTIONS: SolverOptions = {
  maxDepth: 100,
  maxStates: 200_000,
};

/**
 * BFS sobre el espacio de estados del puzzle, reutilizando LITERALMENTE
 * `playTurn`, `isLevelSolved`, `isLevelFailed` y `cloneState` del motor
 * de reglas (regla de oro: lo que se valida es lo que se juega).
 *
 * Devuelve la solución más corta (BFS garantiza optimalidad) o null si
 * no se encuentra dentro de los límites.
 */
export function solveLevel(
  level: LevelMap,
  opts: SolverOptions = DEFAULT_SOLVER_OPTIONS,
): SolverResult {
  const initial = createInitialState(level);
  // Caso trivial: ya resuelto.
  if (isLevelSolved(initial)) {
    return { solvable: true, minMoves: 0, solution: [], reason: null, statesExplored: 1 };
  }

  // BFS: cola de (estado, movimientos hasta aquí).
  const visited = new Set<string>();
  visited.add(stateKeyOf(initial));
  const queue: Array<{ state: GameState; moves: Direction[] }> = [
    { state: initial, moves: [] },
  ];
  let statesExplored = 1;

  while (queue.length > 0) {
    if (statesExplored >= opts.maxStates) {
      return {
        solvable: false,
        minMoves: 0,
        solution: null,
        reason: `límite de estados (${opts.maxStates}) alcanzado sin solución`,
        statesExplored,
      };
    }
    const { state, moves } = queue.shift()!;

    if (moves.length >= opts.maxDepth) continue;

    // Probar las 4 direcciones.
    for (const dir of ALL_DIRECTIONS) {
      const next = cloneState(state);
      // RNG determinista para enemigos aleatorios (seed del nivel).
      const rng = createRng(level.seed + moves.length);
      playTurn(next, dir, rng);

      const newMoves = [...moves, dir];
      statesExplored++;

      if (next.solved) {
        return { solvable: true, minMoves: newMoves.length, solution: newMoves, reason: null, statesExplored };
      }
      if (next.failed) continue; // rama muerta

      const key = stateKeyOf(next);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ state: next, moves: newMoves });
    }
  }

  return {
    solvable: false,
    minMoves: 0,
    solution: null,
    reason: "no se encontró solución (BFS agotado)",
    statesExplored,
  };
}

/** Clave canónica de un estado (delega en stateKey del motor). */
function stateKeyOf(state: GameState): string {
  // Reutilizamos stateKey del motor para que solver y motor compartan
  // la misma noción de "estado equivalente".
  return stateKey(state);
}

/**
 * §7 — Tiene solución: existe al menos una secuencia de movimientos
 * válida que lleva de estado inicial a estado de victoria.
 */
export function checkSolvable(level: LevelMap, opts: SolverOptions = DEFAULT_SOLVER_OPTIONS): CheckResult & { solver: SolverResult } {
  const solver = solveLevel(level, opts);
  return {
    ok: solver.solvable,
    reason: solver.reason,
    solver,
  };
}

// ---------------------------------------------------------------------------
// Chequeos 8–10 — dependen del resultado del solver
// ---------------------------------------------------------------------------

/**
 * §8 — Dificultad adecuada: la solución mínima cae dentro del rango
 * esperado para la posición del nivel en la progresión.
 */
export function checkDifficultyInRange(
  solver: SolverResult,
  world: WorldConfig,
  levelNumber: number,
): CheckResult {
  const band = world.difficultyTable.find((b) => levelNumber >= b.range[0] && levelNumber <= b.range[1]);
  if (!band) return { ok: true, reason: null }; // sin franja definida, aceptar.
  // Rango orientativo de movimientos por estrellas (1–5).
  const minExpected = band.stars * 2;
  const maxExpected = band.stars * 20;
  if (!solver.solvable) return { ok: false, reason: "no se puede evaluar dificultad de nivel sin solución" };
  if (solver.minMoves < minExpected || solver.minMoves > maxExpected) {
    return {
      ok: false,
      reason: `minMoves ${solver.minMoves} fuera de rango [${minExpected},${maxExpected}] para estrellas ${band.stars}`,
    };
  }
  return { ok: true, reason: null };
}

/**
 * §9 — No es trivial: se descartan soluciones triviales (ej. resoluble en
 * 1 movimiento) salvo nivel tutorial.
 */
export function checkNotTrivial(solver: SolverResult, isTutorial = false): CheckResult {
  if (!solver.solvable) return { ok: true, reason: null }; // no trivial porque no se resuelve.
  if (solver.minMoves <= 1 && !isTutorial) {
    return { ok: false, reason: `solución trivial en ${solver.minMoves} movimiento(s)` };
  }
  return { ok: true, reason: null };
}

/**
 * §10 — No tiene situaciones absurdas: ej. un enemigo que nunca puede
 * alcanzar al jugador en ningún camino posible cuando la regla del mundo
 * requiere que sí pueda amenazarlo.
 */
export function checkNoAbsurdSituations(level: LevelMap): CheckResult {
  const state = createInitialState(level);
  // Si hay enemigos persecutorios, al menos uno debe poder alcanzar al
  // jugador (amenaza real). Si NINGUNO puede, es absurdo para esos patrones.
  const chasingEnemies = level.enemies.filter(
    (e) => e.pattern === "PERSECUCION_SIMPLE" || e.pattern === "ALEATORIO_ACOTADO",
  );
  if (chasingEnemies.length > 0) {
    const anyCanReach = chasingEnemies.some((_, idx) => {
      // canEnemyReachPlayer usa el índice en state.enemies, que coincide
      // con el orden de level.enemies.
      return canEnemyReachPlayer(state, idx) !== Infinity;
    });
    if (!anyCanReach) {
      return { ok: false, reason: "ningún enemigo persecutorio puede alcanzar al jugador (situación absurda)" };
    }
  }
  // Un enemigo que bloquea el 100% de las rutas de forma no resoluble ya
  // se detecta en checkSolvable. Aquí solo verificamos amenaza mínima.
  return { ok: true, reason: null };
}

// ---------------------------------------------------------------------------
// Checklist completo
// ---------------------------------------------------------------------------

/** Opciones del validador completo. */
export interface ValidatorOptions {
  readonly solver: SolverOptions;
  readonly refWidth: number;
  readonly refHeight: number;
  /** Número de nivel en la progresión (para checkDifficultyInRange). */
  readonly levelNumber: number;
  /** true si es nivel tutorial (permite soluciones triviales). */
  readonly isTutorial: boolean;
}

export const DEFAULT_VALIDATOR_OPTIONS: ValidatorOptions = {
  solver: DEFAULT_SOLVER_OPTIONS,
  refWidth: 1920,
  refHeight: 1080,
  levelNumber: 1,
  isTutorial: false,
};

/**
 * Ejecuta los 10 chequeos del checklist en orden (fallar rápido).
 * Los chequeos 8–10 dependen del solver (chequeo 7), así que si 1–6
 * fallan, no se ejecuta el solver (ahorro de cómputo).
 */
export function runChecklist(
  level: LevelMap,
  world: WorldConfig,
  background: BackgroundTemplate,
  opts: ValidatorOptions = DEFAULT_VALIDATOR_OPTIONS,
): ChecklistResult & { solver: SolverResult | null; difficultyScore: number } {
  // 1–6: geométricos (baratos)
  const withinBoardArea = checkWithinBoardArea(level, background, opts.refWidth, opts.refHeight);
  const gridAligned = checkGridAligned(level);
  const noDecorationOverlap = checkNoDecorationOverlap(level, background);
  const tilingResolved = checkTilingResolved(level, world);
  const entitiesFit = checkEntitiesFit(level);
  const noImpossiblePositions = checkNoImpossiblePositions(level);

  // Si los geométricos fallan, no ejecutamos el solver.
  const geometricOk =
    withinBoardArea.ok &&
    gridAligned.ok &&
    noDecorationOverlap.ok &&
    tilingResolved.ok &&
    entitiesFit.ok &&
    noImpossiblePositions.ok;

  let solver: SolverResult | null = null;
  let solvable: CheckResult = { ok: false, reason: "no evaluado (chequeos geométricos fallaron)" };
  let difficultyInRange: CheckResult = { ok: false, reason: "no evaluado" };
  let notTrivial: CheckResult = { ok: false, reason: "no evaluado" };
  let noAbsurdSituations: CheckResult = { ok: false, reason: "no evaluado" };
  let difficultyScore = 0;

  if (geometricOk) {
    // 7: solver (caro)
    const solvableCheck = checkSolvable(level, opts.solver);
    solver = solvableCheck.solver;
    solvable = { ok: solvableCheck.ok, reason: solvableCheck.reason };

    if (solver.solvable) {
      // 8–10: dependen del solver
      difficultyInRange = checkDifficultyInRange(solver, world, opts.levelNumber);
      notTrivial = checkNotTrivial(solver, opts.isTutorial);
      noAbsurdSituations = checkNoAbsurdSituations(level);
      difficultyScore = computeDifficultyScore(level, solver);
    } else {
      difficultyInRange = { ok: false, reason: "no hay solución" };
      notTrivial = { ok: true, reason: null };
      noAbsurdSituations = checkNoAbsurdSituations(level);
    }
  }

  const checks = {
    withinBoardArea,
    gridAligned,
    noDecorationOverlap,
    tilingResolved,
    entitiesFit,
    noImpossiblePositions,
    solvable,
    difficultyInRange,
    notTrivial,
    noAbsurdSituations,
  };

  const allOk = Object.values(checks).every((c) => c.ok);
  const firstFailure = Object.entries(checks).find(([, c]) => !c.ok)?.[0] ?? null;

  return { ...checks, allOk, firstFailure, solver, difficultyScore };
}

// ---------------------------------------------------------------------------
// Puntuador de dificultad (doc 04 §3)
// ---------------------------------------------------------------------------

/**
 * Combina múltiples factores en una puntuación de dificultad normalizada
 * a 0–10:
 *  - longitud de la solución mínima (peso principal),
 *  - número de enemigos y su capacidad de amenaza,
 *  - complejidad geométrica del arquetipo,
 *  - ramas falsas (estados explorados / solución mínima),
 *  - márgenes de error (estimado por densidad de celdas transitables).
 */
export function computeDifficultyScore(level: LevelMap, solver: SolverResult): number {
  if (!solver.solvable) return 0;

  // Factor 1: longitud de solución (0–4 puntos, normalizado a ~50 movimientos).
  const lengthScore = Math.min(4, (solver.minMoves / 50) * 4);

  // Factor 2: enemigos (0–2 puntos).
  const enemyScore = Math.min(2, level.enemies.length * 0.5);

  // Factor 3: complejidad geométrica del arquetipo (0–2 puntos).
  const archetypeComplexity: Record<string, number> = {
    RECTANGULO: 0.2,
    L: 0.5,
    T: 0.6,
    CRUZ: 0.7,
    PASILLO: 0.4,
    CAMARA_CENTRAL: 0.8,
    ANILLO: 1.0,
    DOBLE_PASILLO: 1.2,
    LABERINTO: 2.0,
    IRREGULAR: 1.5,
  };
  const geomScore = archetypeComplexity[level.archetype] ?? 1.0;

  // Factor 4: ramas falsas (0–1.5 puntos). Más estados explorados respecto
  // a la solución → más engañoso.
  const branchScore = Math.min(1.5, (solver.statesExplored / (solver.minMoves * 10)) * 0.5);

  // Factor 5: márgenes de error (0–0.5 puntos). Menos celdas transitables
  // → menos margen → más difícil.
  const floorCells = level.grid.reduce(
    (acc, row) => acc + row.split("").filter((c) => c === "." || c === "P" || c === "E" || c === "G" || c === "K").length,
    0,
  );
  const density = floorCells / (level.width * level.height);
  const marginScore = Math.min(0.5, (1 - density) * 0.5);

  const total = lengthScore + enemyScore + geomScore + branchScore + marginScore;
  return Math.round(Math.min(10, total) * 10) / 10; // 0–10 con 1 decimal.
}
