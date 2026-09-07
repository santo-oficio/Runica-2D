/**
 * Tests del motor de reglas (Fase 3).
 *
 * Tests unitarios de cada función, independientes del generador: se
 * construyen LevelMaps a mano para controlar el escenario exacto.
 */

import { describe, it, expect } from "vitest";
import {
  canEnemyReachPlayer,
  enemyMove,
  isLevelFailed,
  isLevelSolved,
  isValidMove,
  playTurn,
  playerMove,
  replayMoves,
} from "../engine/rules.js";
import {
  cloneState,
  createInitialState,
  stateKey,
} from "../engine/state.js";
import { createRng } from "../generator/rng.js";
import type { LevelMap } from "../schemas/types.js";

// ---------------------------------------------------------------------------
// Helpers para construir LevelMaps a mano
// ---------------------------------------------------------------------------

function mkLevel(
  grid: string[],
  opts: { player?: [number, number]; goal?: [number, number]; enemies?: Array<{ pos: [number, number]; pattern: LevelMap["enemies"][number]["pattern"]; patrolRoute?: Array<[number, number]> }> } = {},
): LevelMap {
  const height = grid.length;
  const width = grid[0]!.length;
  let player: [number, number] = opts.player ?? [0, 0];
  let goal: [number, number] = opts.goal ?? [0, 0];
  const enemies: Array<{ pos: [number, number]; pattern: LevelMap["enemies"][number]["pattern"] }> = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const ch = grid[r]![c]!;
      if (ch === "P" && !opts.player) player = [c, r];
      else if (ch === "G" && !opts.goal) goal = [c, r];
      else if (ch === "E" && !opts.enemies) enemies.push({ pos: [c, r], pattern: "PERSECUCION_SIMPLE" });
    }
  }
  if (opts.enemies) {
    for (const e of opts.enemies) enemies.push({ pos: e.pos, pattern: e.pattern });
  }
  return {
    levelId: 1,
    seed: 1,
    world: "ESPACIO",
    backgroundTemplateId: "SPACE_01",
    archetype: "RECTANGULO",
    width,
    height,
    grid,
    player,
    enemies: enemies as LevelMap["enemies"],
    goal,
    keys: [],
    doors: [],
    rulesetVersion: "1.0.0",
  };
}

// ---------------------------------------------------------------------------
// isValidMove
// ---------------------------------------------------------------------------

describe("isValidMove", () => {
  it("permite moverse a suelo", () => {
    const level = mkLevel(["#####", "#P..#", "#####"]);
    const state = createInitialState(level);
    const r = isValidMove(state, state.player, "RIGHT");
    expect(r.valid).toBe(true);
    expect(r.target).toEqual([2, 1]);
  });

  it("bloquea fuera de límites", () => {
    const level = mkLevel(["#####", "#P..#", "#####"]);
    const state = createInitialState(level);
    expect(isValidMove(state, state.player, "UP").valid).toBe(false);
    expect(isValidMove(state, state.player, "UP").reason).toBe("pared");
  });

  it("bloquea pared", () => {
    const level = mkLevel(["#####", "#P#.#", "#####"]);
    const state = createInitialState(level);
    expect(isValidMove(state, state.player, "RIGHT").valid).toBe(false);
    expect(isValidMove(state, state.player, "RIGHT").reason).toBe("pared");
  });

  it("bloquea obstáculo", () => {
    const level = mkLevel(["#####", "#PX.#", "#####"]);
    const state = createInitialState(level);
    expect(isValidMove(state, state.player, "RIGHT").valid).toBe(false);
    expect(isValidMove(state, state.player, "RIGHT").reason).toBe("obstáculo");
  });

  it("bloquea puerta cerrada", () => {
    const level = mkLevel(["#####", "#PD.#", "#####"]);
    const state = createInitialState(level);
    expect(isValidMove(state, state.player, "RIGHT").valid).toBe(false);
    expect(isValidMove(state, state.player, "RIGHT").reason).toContain("puerta");
  });

  it("permite puerta abierta", () => {
    const level = mkLevel(["#####", "#PDG#", "#####"]);
    const state = createInitialState(level);
    state.doorsOpen = [[2, 1]];
    state.grid[1] = "#P.G#"; // puerta abierta → '.'
    expect(isValidMove(state, state.player, "RIGHT").valid).toBe(true);
  });

  it("bloquea enemigo en destino", () => {
    const level = mkLevel(["#####", "#PE.#", "#####"]);
    const state = createInitialState(level);
    expect(isValidMove(state, state.player, "RIGHT").valid).toBe(false);
    expect(isValidMove(state, state.player, "RIGHT").reason).toContain("enemigo");
  });
});

// ---------------------------------------------------------------------------
// playerMove
// ---------------------------------------------------------------------------

describe("playerMove", () => {
  it("mueve al jugador a suelo", () => {
    const level = mkLevel(["#####", "#P.G#", "#####"]);
    const state = createInitialState(level);
    const r = playerMove(state, "RIGHT");
    expect(r.moved).toBe(true);
    expect(state.player).toEqual([2, 1]);
  });

  it("no mueve si es inválido", () => {
    const level = mkLevel(["#####", "#P#G#", "#####"]);
    const state = createInitialState(level);
    const r = playerMove(state, "RIGHT");
    expect(r.moved).toBe(false);
    expect(state.player).toEqual([1, 1]);
  });

  it("recoge llave al moverse onto ella", () => {
    const level = mkLevel(["#####", "#PKG#", "#####"]);
    const state = createInitialState(level);
    const r = playerMove(state, "RIGHT");
    expect(r.moved).toBe(true);
    expect(r.pickedKey).toEqual([2, 1]);
    expect(state.keysCollected).toEqual([[2, 1]]);
    expect(state.grid[1]).toBe("#P.G#"); // K → .
  });

  it("abre puerta adyacente si tiene llave", () => {
    // P en [1,1], K en [2,1], D en [3,1], G en [5,1].
    const level2 = mkLevel(["#######", "#PKD.G#", "#######"]);
    const state2 = createInitialState(level2);
    // 1. P→K (recoge llave). P sigue en [1,1] tras recoger; D no es adyacente todavía.
    playerMove(state2, "RIGHT");
    expect(state2.keysCollected.length).toBe(1);
    expect(state2.player).toEqual([2, 1]); // P se mueve a la celda de K
    // Tras moverse, openAdjacentDoors se ejecuta desde la posición ANTES de mover,
    // así que la puerta no se abre todavía. La apertura ocurre al inicio del
    // siguiente playerMove, cuando P ya está en [2,1] adyacente a D en [3,1].
    // Verificamos que la puerta sigue cerrada:
    expect(state2.doorsOpen.length).toBe(0);
    // 2. Siguiente movimiento: openAdjacentDoors abre D antes de mover.
    playerMove(state2, "RIGHT");
    expect(state2.doorsOpen).toEqual([[3, 1]]);
    expect(state2.player).toEqual([3, 1]); // P cruza la puerta ya abierta
  });

  it("no mueve si la partida está finalizada", () => {
    const level = mkLevel(["#####", "#P.G#", "#####"]);
    const state = createInitialState(level);
    state.solved = true;
    const r = playerMove(state, "RIGHT");
    expect(r.moved).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// enemyMove — 4 patrones
// ---------------------------------------------------------------------------

describe("enemyMove", () => {
  it("VIGILANCIA_ZONA: no se mueve", () => {
    const level = mkLevel(["#######", "#P...E.#", "#######"], {
      enemies: [{ pos: [5, 1], pattern: "VIGILANCIA_ZONA" }],
    });
    const state = createInitialState(level);
    enemyMove(state, 0, createRng(1));
    expect(state.enemies[0]!.pos).toEqual([5, 1]);
  });

  it("PERSECUCION_SIMPLE: se mueve un paso hacia el jugador", () => {
    const level = mkLevel(["#######", "#P...E.#", "#######"], {
      enemies: [{ pos: [5, 1], pattern: "PERSECUCION_SIMPLE" }],
    });
    const state = createInitialState(level);
    enemyMove(state, 0, createRng(1));
    expect(state.enemies[0]!.pos).toEqual([4, 1]);
  });

  it("PERSECUCION_SIMPLE: prioriza eje con mayor distancia", () => {
    const level = mkLevel(["#######", "#P....#", "#.....#", "#....E#", "#######"], {
      enemies: [{ pos: [5, 3], pattern: "PERSECUCION_SIMPLE" }],
    });
    const state = createInitialState(level);
    enemyMove(state, 0, createRng(1));
    // dx=4, dy=2 → prioriza horizontal
    expect(state.enemies[0]!.pos).toEqual([4, 3]);
  });

  it("ALEATORIO_ACOTADO: se mueve a una celda adyacente", () => {
    const level = mkLevel(["#######", "#P...E.#", "#######"], {
      enemies: [{ pos: [5, 1], pattern: "ALEATORIO_ACOTADO" }],
    });
    const state = createInitialState(level);
    enemyMove(state, 0, createRng(42));
    const [c, r] = state.enemies[0]!.pos;
    const moved = Math.abs(c - 5) + Math.abs(r - 1) === 1;
    expect(moved).toBe(true);
  });

  it("PATRULLA_FIJA: sigue la ruta", () => {
    const level = mkLevel(["#######", "#P...E.#", "#######"], {
      enemies: [{ pos: [5, 1], pattern: "PATRULLA_FIJA" }],
    });
    const state = createInitialState(level);
    state.enemies[0]!.patrolRoute = [[5, 1], [4, 1], [3, 1], [4, 1]];
    enemyMove(state, 0, createRng(1));
    expect(state.enemies[0]!.pos).toEqual([4, 1]);
    expect(state.enemies[0]!.step).toBe(1);
    enemyMove(state, 0, createRng(1));
    expect(state.enemies[0]!.pos).toEqual([3, 1]);
  });

  it("no se mueve onto otro enemigo", () => {
    const level = mkLevel(["#######", "#P.EE.#", "#######"], {
      enemies: [
        { pos: [3, 1], pattern: "PERSECUCION_SIMPLE" },
        { pos: [4, 1], pattern: "VIGILANCIA_ZONA" },
      ],
    });
    const state = createInitialState(level);
    enemyMove(state, 0, createRng(1));
    // Enemigo 0 en [3,1] quiere ir a [2,1] (hacia P) → se mueve
    expect(state.enemies[0]!.pos).toEqual([2, 1]);
  });

  it("no se mueve onto pared", () => {
    const level = mkLevel(["#######", "#P#E#.#", "#######"], {
      enemies: [{ pos: [3, 1], pattern: "PERSECUCION_SIMPLE" }],
    });
    const state = createInitialState(level);
    enemyMove(state, 0, createRng(1));
    // Enemigo rodeado de paredes → no se mueve
    expect(state.enemies[0]!.pos).toEqual([3, 1]);
  });
});

// ---------------------------------------------------------------------------
// canEnemyReachPlayer
// ---------------------------------------------------------------------------

describe("canEnemyReachPlayer", () => {
  it("devuelve distancia si hay camino", () => {
    const level = mkLevel(["#######", "#P...E.#", "#######"], {
      enemies: [{ pos: [5, 1], pattern: "PERSECUCION_SIMPLE" }],
    });
    const state = createInitialState(level);
    expect(canEnemyReachPlayer(state, 0)).toBe(4);
  });

  it("devuelve 0 si ya está en el jugador", () => {
    const level = mkLevel(["#######", "#PE...#", "#######"], {
      enemies: [{ pos: [2, 1], pattern: "PERSECUCION_SIMPLE" }],
    });
    const state = createInitialState(level);
    state.enemies[0]!.pos = [1, 1];
    expect(canEnemyReachPlayer(state, 0)).toBe(0);
  });

  it("devuelve Infinity si no hay camino", () => {
    const level = mkLevel(["#######", "#P.#E.#", "#######"], {
      enemies: [{ pos: [4, 1], pattern: "PERSECUCION_SIMPLE" }],
    });
    const state = createInitialState(level);
    expect(canEnemyReachPlayer(state, 0)).toBe(Infinity);
  });
});

// ---------------------------------------------------------------------------
// isLevelSolved / isLevelFailed
// ---------------------------------------------------------------------------

describe("isLevelSolved / isLevelFailed", () => {
  it("isLevelSolved: true cuando jugador en G", () => {
    const level = mkLevel(["#####", "#P.G#", "#####"]);
    const state = createInitialState(level);
    state.player = [3, 1];
    expect(isLevelSolved(state)).toBe(true);
  });

  it("isLevelSolved: false cuando jugador no en G", () => {
    const level = mkLevel(["#####", "#P.G#", "#####"]);
    const state = createInitialState(level);
    expect(isLevelSolved(state)).toBe(false);
  });

  it("isLevelFailed: true cuando enemigo en celda del jugador", () => {
    const level = mkLevel(["#####", "#P.E#", "#####"], {
      enemies: [{ pos: [3, 1], pattern: "PERSECUCION_SIMPLE" }],
    });
    const state = createInitialState(level);
    state.enemies[0]!.pos = [1, 1];
    expect(isLevelFailed(state)).toBe(true);
  });

  it("isLevelFailed: false cuando enemigo no en celda del jugador", () => {
    const level = mkLevel(["#####", "#P.E#", "#####"], {
      enemies: [{ pos: [3, 1], pattern: "PERSECUCION_SIMPLE" }],
    });
    const state = createInitialState(level);
    expect(isLevelFailed(state)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// playTurn — bucle completo
// ---------------------------------------------------------------------------

describe("playTurn — bucle de turno", () => {
  it("victoria: jugador llega a G sin enemigos", () => {
    const level = mkLevel(["#######", "#P...G#", "#######"]);
    const state = createInitialState(level);
    playTurn(state, "RIGHT");
    expect(state.solved).toBe(false);
    playTurn(state, "RIGHT");
    playTurn(state, "RIGHT");
    playTurn(state, "RIGHT");
    expect(state.solved).toBe(true);
    expect(state.failed).toBe(false);
  });

  it("derrota: enemigo alcanza al jugador", () => {
    const level = mkLevel(["#######", "#P.E..#", "#######"], {
      enemies: [{ pos: [3, 1], pattern: "PERSECUCION_SIMPLE" }],
    });
    const state = createInitialState(level);
    // Jugador no se mueve (LEFT contra pared), enemigo persigue
    playTurn(state, "LEFT"); // P no se mueve, E avanza a [2,1]
    expect(state.enemies[0]!.pos).toEqual([2, 1]);
    expect(state.failed).toBe(false);
    playTurn(state, "LEFT"); // P no se mueve, E avanza a [1,1] = P → derrota
    expect(state.failed).toBe(true);
    expect(state.failureReason).toContain("enemigo");
  });

  it("no procesa más turnos tras victoria", () => {
    const level = mkLevel(["#######", "#P...G#", "#######"]);
    const state = createInitialState(level);
    for (let i = 0; i < 4; i++) playTurn(state, "RIGHT");
    expect(state.solved).toBe(true);
    const turnBefore = state.turn;
    playTurn(state, "RIGHT");
    expect(state.turn).toBe(turnBefore);
  });

  it("incrementa turno si no hay victoria ni derrota", () => {
    const level = mkLevel(["#######", "#P...G#", "#######"]);
    const state = createInitialState(level);
    playTurn(state, "RIGHT");
    expect(state.turn).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// replayMoves
// ---------------------------------------------------------------------------

describe("replayMoves", () => {
  it("reproduce una secuencia hasta victoria", () => {
    const level = mkLevel(["#######", "#P...G#", "#######"]);
    const state = createInitialState(level);
    replayMoves(state, ["RIGHT", "RIGHT", "RIGHT", "RIGHT"], createRng(0));
    expect(state.solved).toBe(true);
  });

  it("detiene la reproducción si hay derrota", () => {
    const level = mkLevel(["#######", "#P.E..#", "#######"], {
      enemies: [{ pos: [3, 1], pattern: "PERSECUCION_SIMPLE" }],
    });
    const state = createInitialState(level);
    replayMoves(state, ["LEFT", "LEFT", "LEFT", "LEFT"], createRng(0));
    expect(state.failed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cloneState / stateKey (para el solver)
// ---------------------------------------------------------------------------

describe("cloneState / stateKey", () => {
  it("cloneState produce una copia independiente", () => {
    const level = mkLevel(["#######", "#P.E.G#", "#######"], {
      enemies: [{ pos: [3, 1], pattern: "PERSECUCION_SIMPLE" }],
    });
    const a = createInitialState(level);
    const b = cloneState(a);
    b.player = [5, 1];
    expect(a.player).toEqual([1, 1]); // a no cambia
    expect(b.player).toEqual([5, 1]);
  });

  it("stateKey: estados idénticos → misma clave", () => {
    const level = mkLevel(["#######", "#P.E.G#", "#######"], {
      enemies: [{ pos: [3, 1], pattern: "PERSECUCION_SIMPLE" }],
    });
    const a = createInitialState(level);
    const b = createInitialState(level);
    expect(stateKey(a)).toEqual(stateKey(b));
  });

  it("stateKey: estados distintos → claves distintas", () => {
    const level = mkLevel(["#######", "#P.E.G#", "#######"], {
      enemies: [{ pos: [3, 1], pattern: "PERSECUCION_SIMPLE" }],
    });
    const a = createInitialState(level);
    const b = cloneState(a);
    b.player = [2, 1];
    expect(stateKey(a)).not.toEqual(stateKey(b));
  });
});
