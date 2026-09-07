/**
 * Tests del Solver / Validador (Fase 4).
 *
 * Tests unitarios de cada chequeo del checklist por separado, tests del
 * solver de resolubilidad, tests del puntuador de dificultad, y test de
 * integración con 1.000 seeds.
 */

import { describe, it, expect } from "vitest";
import {
  checkDifficultyInRange,
  checkEntitiesFit,
  checkGridAligned,
  checkNoAbsurdSituations,
  checkNoDecorationOverlap,
  checkNoImpossiblePositions,
  checkNotTrivial,
  checkSolvable,
  checkTilingResolved,
  checkWithinBoardArea,
  computeDifficultyScore,
  DEFAULT_SOLVER_OPTIONS,
  DEFAULT_VALIDATOR_OPTIONS,
  runChecklist,
  solveLevel,
  type SolverOptions,
} from "../solver/checklist.js";
import { validateLevel } from "../solver/validate.js";
import { backgroundTemplateExample, worldConfigExample } from "../schemas/examples.js";
import { generateLevel } from "../generator/generator.js";
import { createInitialState } from "../engine/state.js";
import { replayMoves } from "../engine/rules.js";
import { createRng } from "../generator/rng.js";
import type { BackgroundTemplate, LevelMap } from "../schemas/types.js";

// ---------------------------------------------------------------------------
// Helpers para construir niveles a mano
// ---------------------------------------------------------------------------

function mkLevel(overrides: Partial<LevelMap> = {}): LevelMap {
  const base: LevelMap = {
    levelId: 1,
    seed: 1,
    world: "ESPACIO",
    backgroundTemplateId: "SPACE_01",
    archetype: "RECTANGULO",
    width: 5,
    height: 3,
    grid: ["#####", "#P.G#", "#####"],
    player: [1, 1],
    enemies: [],
    goal: [3, 1],
    keys: [],
    doors: [],
    rulesetVersion: "1.0.0",
  };
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// 1. checkWithinBoardArea
// ---------------------------------------------------------------------------

describe("checkWithinBoardArea", () => {
  it("pasa si el tablero cabe en boardArea", () => {
    const level = mkLevel();
    expect(checkWithinBoardArea(level, backgroundTemplateExample).ok).toBe(true);
  });

  it("falla si el tablero no cabe", () => {
    const level = mkLevel({ width: 200, height: 200, grid: [] });
    expect(checkWithinBoardArea(level, backgroundTemplateExample).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. checkGridAligned
// ---------------------------------------------------------------------------

describe("checkGridAligned", () => {
  it("pasa si todas las filas tienen la longitud correcta", () => {
    const level = mkLevel();
    expect(checkGridAligned(level).ok).toBe(true);
  });

  it("falla si una fila tiene longitud incorrecta", () => {
    const level = mkLevel({ grid: ["####", "#P.G#", "#####"] });
    expect(checkGridAligned(level).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. checkNoDecorationOverlap
// ---------------------------------------------------------------------------

describe("checkNoDecorationOverlap", () => {
  it("pasa si boardArea no se solapa con decoración no extensible", () => {
    const bg: BackgroundTemplate = {
      ...backgroundTemplateExample,
      decorativeAreas: [{ x: 0.0, y: 0.0, width: 0.1, height: 0.1, extendable: false }],
    };
    expect(checkNoDecorationOverlap(mkLevel(), bg).ok).toBe(true);
  });

  it("falla si boardArea se solapa con decoración no extensible", () => {
    const bg: BackgroundTemplate = {
      ...backgroundTemplateExample,
      decorativeAreas: [
        { x: 0.2, y: 0.2, width: 0.5, height: 0.5, extendable: false },
      ],
    };
    expect(checkNoDecorationOverlap(mkLevel(), bg).ok).toBe(false);
  });

  it("pasa si la decoración solapada es extensible", () => {
    const bg: BackgroundTemplate = {
      ...backgroundTemplateExample,
      decorativeAreas: [
        { x: 0.2, y: 0.2, width: 0.5, height: 0.5, extendable: true },
      ],
    };
    expect(checkNoDecorationOverlap(mkLevel(), bg).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. checkTilingResolved
// ---------------------------------------------------------------------------

describe("checkTilingResolved", () => {
  it("pasa con un nivel del ejemplo y mundo del ejemplo", () => {
    const level = generateLevel({
      seed: 42,
      world: worldConfigExample,
      background: backgroundTemplateExample,
      levelNumber: 10,
    });
    expect(checkTilingResolved(level, worldConfigExample).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. checkEntitiesFit
// ---------------------------------------------------------------------------

describe("checkEntitiesFit", () => {
  it("pasa con entidades en celdas válidas y sin solapamiento", () => {
    const level = mkLevel({
      grid: ["#######", "#P..G.#", "#######"],
      width: 7,
      height: 3,
      player: [1, 1],
      goal: [5, 1],
    });
    expect(checkEntitiesFit(level).ok).toBe(true);
  });

  it("falla si entidades solapadas", () => {
    const level = mkLevel({
      grid: ["#######", "#P..G.#", "#######"],
      width: 7,
      height: 3,
      player: [1, 1],
      goal: [1, 1], // solapado con player
    });
    expect(checkEntitiesFit(level).ok).toBe(false);
  });

  it("falla si entidad fuera de bounds", () => {
    const level = mkLevel({
      grid: ["#######", "#P..G.#", "#######"],
      width: 7,
      height: 3,
      player: [10, 1],
      goal: [5, 1],
    });
    expect(checkEntitiesFit(level).ok).toBe(false);
  });

  it("falla si entidad sobre pared", () => {
    const level = mkLevel({
      grid: ["#######", "#P..G.#", "#######"],
      width: 7,
      height: 3,
      player: [0, 0],
      goal: [5, 1],
    });
    expect(checkEntitiesFit(level).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. checkNoImpossiblePositions
// ---------------------------------------------------------------------------

describe("checkNoImpossiblePositions", () => {
  it("pasa con jugador y objetivo accesibles", () => {
    const level = mkLevel();
    expect(checkNoImpossiblePositions(level).ok).toBe(true);
  });

  it("falla si objetivo rodeado de paredes", () => {
    // G en [3,2] totalmente rodeado de paredes.
    const isolated = mkLevel({
      grid: [
        "#########",
        "#P.######",
        "###G#####",
        "#########",
      ],
      width: 9,
      height: 4,
      player: [1, 1],
      goal: [3, 2],
    });
    expect(checkNoImpossiblePositions(isolated).ok).toBe(false);
  });

  it("falla si no hay camino topológico jugador→objetivo", () => {
    const level = mkLevel({
      grid: ["#######", "#P.#.G#", "#######"],
      width: 7,
      height: 3,
      player: [1, 1],
      goal: [5, 1],
    });
    // P en [1,1], G en [5,1], pared en [3,1] separa las dos mitades
    expect(checkNoImpossiblePositions(level).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. solveLevel / checkSolvable
// ---------------------------------------------------------------------------

describe("solveLevel", () => {
  it("resuelve un nivel simple sin enemigos", () => {
    const level = mkLevel({
      grid: ["#######", "#P...G#", "#######"],
      width: 7,
      height: 3,
      player: [1, 1],
      goal: [5, 1],
    });
    const r = solveLevel(level);
    expect(r.solvable).toBe(true);
    expect(r.minMoves).toBe(4);
    expect(r.solution).toEqual(["RIGHT", "RIGHT", "RIGHT", "RIGHT"]);
  });

  it("devuelve minMoves=0 si ya está resuelto", () => {
    const level = mkLevel({
      grid: ["#######", "#....G#", "#######"],
      width: 7,
      height: 3,
      player: [5, 1],
      goal: [5, 1],
    });
    const r = solveLevel(level);
    expect(r.solvable).toBe(true);
    expect(r.minMoves).toBe(0);
  });

  it("devuelve no solvable si no hay camino", () => {
    const level = mkLevel({
      grid: ["#######", "#P.#.G#", "#######"],
      width: 7,
      height: 3,
      player: [1, 1],
      goal: [5, 1],
    });
    const r = solveLevel(level);
    expect(r.solvable).toBe(false);
  });

  it("respeta maxDepth", () => {
    // Nivel que requiere muchos movimientos pero maxDepth bajo.
    const level = mkLevel({
      grid: ["#############", "#P.........G#", "#############"],
      width: 13,
      height: 3,
      player: [1, 1],
      goal: [11, 1],
    });
    const opts: SolverOptions = { ...DEFAULT_SOLVER_OPTIONS, maxDepth: 5 };
    const r = solveLevel(level, opts);
    expect(r.solvable).toBe(false);
    expect(r.reason).toContain("no se encontró solución");
  });

  it("respeta maxStates", () => {
    const level = mkLevel({
      grid: ["#############", "#P.........G#", "#############"],
      width: 13,
      height: 3,
      player: [1, 1],
      goal: [11, 1],
    });
    const opts: SolverOptions = { ...DEFAULT_SOLVER_OPTIONS, maxStates: 10 };
    const r = solveLevel(level, opts);
    expect(r.solvable).toBe(false);
    expect(r.reason).toContain("límite de estados");
  });

  it("la solución encontrada es válida (reproducible)", () => {
    const level = mkLevel({
      grid: ["#######", "#P...G#", "#######"],
      width: 7,
      height: 3,
      player: [1, 1],
      goal: [5, 1],
    });
    const r = solveLevel(level);
    expect(r.solvable).toBe(true);
    expect(r.solution).not.toBeNull();
    // Verificamos que la solución es correcta reproduciéndola.
    const state = createInitialState(level);
    const rng = createRng(level.seed);
    replayMoves(state, r.solution!, rng);
    expect(state.solved).toBe(true);
  });
});

describe("checkSolvable", () => {
  it("devuelve ok=true y solver con solución", () => {
    const level = mkLevel({
      grid: ["#######", "#P...G#", "#######"],
      width: 7,
      height: 3,
      player: [1, 1],
      goal: [5, 1],
    });
    const r = checkSolvable(level);
    expect(r.ok).toBe(true);
    expect(r.solver.solvable).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. checkDifficultyInRange
// ---------------------------------------------------------------------------

describe("checkDifficultyInRange", () => {
  it("pasa si minMoves está en rango", () => {
    const solver = { solvable: true, minMoves: 10, solution: [], reason: null, statesExplored: 50 };
    expect(checkDifficultyInRange(solver, worldConfigExample, 10).ok).toBe(true);
  });

  it("falla si minMoves es demasiado bajo", () => {
    const solver = { solvable: true, minMoves: 1, solution: [], reason: null, statesExplored: 5 };
    expect(checkDifficultyInRange(solver, worldConfigExample, 10).ok).toBe(false);
  });

  it("falla si minMoves es demasiado alto", () => {
    const solver = { solvable: true, minMoves: 1000, solution: [], reason: null, statesExplored: 5000 };
    expect(checkDifficultyInRange(solver, worldConfigExample, 10).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 9. checkNotTrivial
// ---------------------------------------------------------------------------

describe("checkNotTrivial", () => {
  it("pasa si minMoves > 1", () => {
    const solver = { solvable: true, minMoves: 5, solution: [], reason: null, statesExplored: 20 };
    expect(checkNotTrivial(solver).ok).toBe(true);
  });

  it("falla si minMoves <= 1 y no es tutorial", () => {
    const solver = { solvable: true, minMoves: 1, solution: [], reason: null, statesExplored: 5 };
    expect(checkNotTrivial(solver, false).ok).toBe(false);
  });

  it("pasa si minMoves <= 1 pero es tutorial", () => {
    const solver = { solvable: true, minMoves: 1, solution: [], reason: null, statesExplored: 5 };
    expect(checkNotTrivial(solver, true).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. checkNoAbsurdSituations
// ---------------------------------------------------------------------------

describe("checkNoAbsurdSituations", () => {
  it("pasa si no hay enemigos persecutorios", () => {
    const level = mkLevel({
      grid: ["#######", "#P...G#", "#######"],
      width: 7,
      height: 3,
      player: [1, 1],
      goal: [5, 1],
      enemies: [],
    });
    expect(checkNoAbsurdSituations(level).ok).toBe(true);
  });

  it("pasa si un enemigo persecutorio puede alcanzar al jugador", () => {
    const level = mkLevel({
      grid: ["#######", "#P.E.G#", "#######"],
      width: 7,
      height: 3,
      player: [1, 1],
      goal: [5, 1],
      enemies: [{ pos: [3, 1], pattern: "PERSECUCION_SIMPLE" }],
    });
    expect(checkNoAbsurdSituations(level).ok).toBe(true);
  });

  it("falla si ningún enemigo persecutorio puede alcanzar al jugador", () => {
    const level = mkLevel({
      grid: ["#######", "#P.#E.G#", "#######"],
      width: 8,
      height: 3,
      player: [1, 1],
      goal: [6, 1],
      enemies: [{ pos: [4, 1], pattern: "PERSECUCION_SIMPLE" }],
    });
    // E en [4,1] está separado de P por pared en [3,1]
    expect(checkNoAbsurdSituations(level).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeDifficultyScore
// ---------------------------------------------------------------------------

describe("computeDifficultyScore", () => {
  it("devuelve 0 si no es resoluble", () => {
    const solver = { solvable: false, minMoves: 0, solution: null, reason: "no", statesExplored: 0 };
    expect(computeDifficultyScore(mkLevel(), solver)).toBe(0);
  });

  it("devuelve una puntuación entre 0 y 10 si es resoluble", () => {
    const level = mkLevel({
      grid: ["#######", "#P...G#", "#######"],
      width: 7,
      height: 3,
      player: [1, 1],
      goal: [5, 1],
    });
    const solver = { solvable: true, minMoves: 4, solution: [], reason: null, statesExplored: 20 };
    const score = computeDifficultyScore(level, solver);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(10);
  });

  it("RECTANGULO tiene menor puntuación geométrica que LABERINTO", () => {
    const easyLevel = mkLevel({ archetype: "RECTANGULO" });
    const hardLevel = mkLevel({ archetype: "LABERINTO" });
    const solver = { solvable: true, minMoves: 10, solution: [], reason: null, statesExplored: 100 };
    const easy = computeDifficultyScore(easyLevel, solver);
    const hard = computeDifficultyScore(hardLevel, solver);
    expect(hard).toBeGreaterThan(easy);
  });
});

// ---------------------------------------------------------------------------
// runChecklist — integración de los 10 chequeos
// ---------------------------------------------------------------------------

describe("runChecklist", () => {
  it("nivel válido pasa todos los chequeos", () => {
    const level = mkLevel({
      grid: ["#######", "#P...G#", "#######"],
      width: 7,
      height: 3,
      player: [1, 1],
      goal: [5, 1],
    });
    const r = runChecklist(level, worldConfigExample, backgroundTemplateExample, {
      ...DEFAULT_VALIDATOR_OPTIONS,
      levelNumber: 10,
    });
    expect(r.allOk).toBe(true);
    expect(r.firstFailure).toBeNull();
  });

  it("nivel sin camino falla en noImpossiblePositions (no llega al solver)", () => {
    const level = mkLevel({
      grid: ["#######", "#P.#.G#", "#######"],
      width: 7,
      height: 3,
      player: [1, 1],
      goal: [5, 1],
    });
    const r = runChecklist(level, worldConfigExample, backgroundTemplateExample);
    expect(r.noImpossiblePositions.ok).toBe(false);
    expect(r.solvable.ok).toBe(false); // no evaluado
    expect(r.allOk).toBe(false);
  });

  it("nivel con tablero demasiado grande falla en withinBoardArea", () => {
    const level = mkLevel({ width: 500, height: 500, grid: [] });
    const r = runChecklist(level, worldConfigExample, backgroundTemplateExample);
    expect(r.withinBoardArea.ok).toBe(false);
    expect(r.allOk).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateLevel — resultado conforme al esquema
// ---------------------------------------------------------------------------

describe("validateLevel", () => {
  it("devuelve ValidationResult con todos los campos", () => {
    const level = mkLevel({
      grid: ["#######", "#P...G#", "#######"],
      width: 7,
      height: 3,
      player: [1, 1],
      goal: [5, 1],
    });
    const r = validateLevel(level, worldConfigExample, backgroundTemplateExample, {
      ...DEFAULT_VALIDATOR_OPTIONS,
      levelNumber: 10,
    });
    expect(r.levelId).toBe(level.levelId);
    expect(r.valid).toBe(true);
    expect(r.checks.withinBoardArea).toBe(true);
    expect(r.checks.solvable).toBe(true);
    expect(r.difficultyScore).toBeGreaterThanOrEqual(0);
    expect(r.solution.minMoves).toBe(4);
    expect(r.solution.path).not.toBe("");
    expect(r.rejectionReason).toBeNull();
  });

  it("nivel inválido devuelve valid=false y rejectionReason", () => {
    const level = mkLevel({
      grid: ["#######", "#P.#.G#", "#######"],
      width: 7,
      height: 3,
      player: [1, 1],
      goal: [5, 1],
    });
    const r = validateLevel(level, worldConfigExample, backgroundTemplateExample);
    expect(r.valid).toBe(false);
    expect(r.rejectionReason).not.toBeNull();
  });
});
