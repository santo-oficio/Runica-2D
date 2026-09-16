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

  it("puede solaparse con otro enemigo durante el movimiento", () => {
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

  it("derrota: enemigo alcanza al jugador (2 pasos/turno)", () => {
    const level = mkLevel(["#######", "#P.E..#", "#######"], {
      enemies: [{ pos: [3, 1], pattern: "PERSECUCION_SIMPLE" }],
    });
    const state = createInitialState(level);
    // Jugador se mueve RIGHT (válido), enemigo persigue 2 pasos
    // P: [1,1]→[2,1], E: [3,1]→[2,1] (paso1) → captura en paso 1
    playTurn(state, "RIGHT");
    expect(state.failed).toBe(true);
    expect(state.failureReason).toContain("enemigo");
  });

  it("enemigo 2 pasos: primer paso intermedio sin derrota", () => {
    // Tablero mas largo para ver los 2 pasos por separado
    const level = mkLevel(["#########", "#P....E.#", "#########"], {
      enemies: [{ pos: [6, 1], pattern: "PERSECUCION_SIMPLE" }],
    });
    const state = createInitialState(level);
    // P se mueve LEFT (válido, hay suelo a la izquierda dentro del borde)
    // P: [1,1]→[0,1] no, [0,1] es pared. Usar RIGHT en su lugar.
    // P: [1,1]→[2,1], E: [6,1]→[5,1] (paso1), [4,1] (paso2)
    playTurn(state, "RIGHT");
    expect(state.enemies[0]!.pos).toEqual([4, 1]);
    expect(state.failed).toBe(false);
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

  it("movimiento inválido (pared) NO cuenta como turno ni mueve enemigos", () => {
    // Jugador en [1,1], pared a la izquierda, enemigo en [5,1]
    const level = mkLevel(["#######", "#P...E#", "#######"], {
      enemies: [{ pos: [5, 1], pattern: "PERSECUCION_SIMPLE" }],
    });
    const state = createInitialState(level);
    const enemyPosBefore = [...state.enemies[0]!.pos] as [number, number];
    // Intentar mover LEFT (pared) — no debe contar
    playTurn(state, "LEFT");
    expect(state.player).toEqual([1, 1]); // no se movió
    expect(state.turn).toBe(0); // turno no avanzó
    expect(state.enemies[0]!.pos).toEqual(enemyPosBefore); // enemigo no se movió
    expect(state.failed).toBe(false);
  });

  it("movimiento inválido (obstáculo) NO cuenta como turno ni mueve enemigos", () => {
    // Jugador en [2,1], obstáculo a la derecha en [3,1], enemigo en [5,1]
    const level = mkLevel(["#######", "#P.X.E#", "#######"], {
      enemies: [{ pos: [5, 1], pattern: "PERSECUCION_SIMPLE" }],
    });
    const state = createInitialState(level);
    // Mover RIGHT primero (válido, a [2,1])
    playTurn(state, "RIGHT");
    expect(state.player).toEqual([2, 1]);
    const enemyPosAfter1 = [...state.enemies[0]!.pos] as [number, number];
    // Ahora intentar RIGHT otra vez (obstáculo en [3,1]) — no debe contar
    playTurn(state, "RIGHT");
    expect(state.player).toEqual([2, 1]); // no se movió
    expect(state.enemies[0]!.pos).toEqual(enemyPosAfter1); // enemigo no se movió
  });

  it("movimiento inválido (fuera del tablero) NO cuenta como turno", () => {
    const level = mkLevel(["#######", "#P...E#", "#######"], {
      enemies: [{ pos: [5, 1], pattern: "PERSECUCION_SIMPLE" }],
    });
    const state = createInitialState(level);
    const enemyPosBefore = [...state.enemies[0]!.pos] as [number, number];
    // Intentar UP (pared en [1,0]) — no debe contar
    playTurn(state, "UP");
    expect(state.player).toEqual([1, 1]); // no se movió
    expect(state.turn).toBe(0); // turno no avanzó
    expect(state.enemies[0]!.pos).toEqual(enemyPosBefore); // enemigo no se movió
  });
});

// ---------------------------------------------------------------------------
// Aturdimiento del jugador por trampa (regla "a fuego": 3 turnos)
// ---------------------------------------------------------------------------

describe("aturdimiento del jugador (trampa)", () => {
  it("pisar trampa aturde 3 turnos (no puede moverse, pero el turno avanza)", () => {
    const level = mkLevel(["#########", "#PT..E..#", "#########"], {
      enemies: [{ pos: [6, 1], pattern: "VIGILANCIA_ZONA" }],
      player: [1, 1],
    });
    const state = createInitialState(level);

    // Turno 1: P se mueve a la trampa [2,1] → queda aturdido 3 turnos.
    playTurn(state, "RIGHT");
    expect(state.player).toEqual([2, 1]);
    expect(state.playerStunnedTurns).toBe(3);
    expect(state.turn).toBe(1);

    // Turnos 2-4: input ignorado, no se mueve, pero el turno avanza.
    playTurn(state, "RIGHT");
    expect(state.player).toEqual([2, 1]);
    expect(state.playerStunnedTurns).toBe(2);
    expect(state.turn).toBe(2);

    playTurn(state, "RIGHT");
    expect(state.player).toEqual([2, 1]);
    expect(state.playerStunnedTurns).toBe(1);
    expect(state.turn).toBe(3);

    playTurn(state, "RIGHT");
    expect(state.player).toEqual([2, 1]);
    expect(state.playerStunnedTurns).toBe(0);
    expect(state.turn).toBe(4);

    // Turno 5: ya no está aturdido, se mueve con normalidad.
    playTurn(state, "RIGHT");
    expect(state.player).toEqual([3, 1]);
    expect(state.turn).toBe(5);
  });

  it("jugador aturdido sigue siendo capturable por el enemigo", () => {
    // P pisa trampa en [2,1] y queda aturdido. Un enemigo perseguidor cercano
    // se mueve hacia él y lo captura aunque esté aturdido.
    const level = mkLevel(["#########", "#PTE....#", "#########"], {
      enemies: [{ pos: [3, 1], pattern: "PERSECUCION_SIMPLE" }],
      player: [1, 1],
    });
    const state = createInitialState(level);

    // Turno 1: P→[2,1] trampa (aturdido). E en [3,1] persigue: paso1 → [2,1] captura.
    playTurn(state, "RIGHT");
    expect(state.player).toEqual([2, 1]);
    expect(state.playerStunnedTurns).toBe(3);
    expect(state.failed).toBe(true);
    expect(state.failureReason).toContain("enemigo");
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
    // P se mueve RIGHT hacia el enemigo. E persigue 2 pasos.
    // Turno 1: P→[2,1], E: [3,1]→[2,1] captura en paso 1
    replayMoves(state, ["RIGHT"], createRng(0));
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
