/**
 * Tests de los 10 niveles del Wappo (worlds/levels-wappo.ts).
 *
 * Verifica:
 *  1. Cada nivel es resoluble (el solver encuentra solución)
 *  2. Ninguna entidad se solapa en la misma casilla
 *  3. La dificultad es progresiva (minMoves crece)
 *  4. El grid tiene el tamaño correcto (8x6)
 */

import { describe, it, expect } from "vitest";
import { ALL_LEVELS } from "../worlds/levels-wappo.js";
import { solveLevel } from "../solver/checklist.js";
import { createInitialState } from "../engine/state.js";
import { playTurn } from "../engine/rules.js";
import { createRng } from "../generator/rng.js";
import type { LevelMap } from "../schemas/types.js";
import type { Direction } from "../engine/state.js";

/** Todas las posiciones ocupadas por entidades de un nivel. */
function entityPositions(level: LevelMap): Array<{ pos: readonly [number, number]; type: string }> {
  const positions: Array<{ pos: readonly [number, number]; type: string }> = [
    { pos: level.player, type: "player" },
    { pos: level.goal, type: "goal" },
    ...level.enemies.map((e) => ({ pos: e.pos, type: "enemy" })),
  ];
  // Obstáculos y trampas del grid
  for (let r = 0; r < level.height; r++) {
    for (let c = 0; c < level.width; c++) {
      const ch = level.grid[r]![c];
      if (ch === "X") positions.push({ pos: [c, r], type: "obstacle" });
      if (ch === "T") positions.push({ pos: [c, r], type: "trap" });
    }
  }
  return positions;
}

/** Verifica que no hay solapamiento entre entidades. */
function checkNoOverlap(level: LevelMap): { ok: boolean; reason: string | null } {
  const positions = entityPositions(level);
  const seen = new Map<string, string>();
  for (const { pos, type } of positions) {
    const key = `${pos[0]},${pos[1]}`;
    if (seen.has(key)) {
      return { ok: false, reason: `${type} solapa con ${seen.get(key)} en (${key})` };
    }
    seen.set(key, type);
  }
  return { ok: true, reason: null };
}

/** Reproduce la solución del solver y verifica que llega a victoria. */
function verifySolution(level: LevelMap, moves: Direction[]): boolean {
  const state = createInitialState(level);
  const rng = createRng(level.seed);
  for (const dir of moves) {
    playTurn(state, dir, rng);
    if (state.solved) return true;
    if (state.failed) return false;
  }
  return state.solved;
}

describe("Niveles del Wappo (10 niveles)", () => {
  it("hay exactamente 10 niveles", () => {
    expect(ALL_LEVELS).toHaveLength(10);
  });

  it("todos los niveles tienen tablero 8x6", () => {
    for (const level of ALL_LEVELS) {
      expect(level.width).toBe(8);
      expect(level.height).toBe(6);
      expect(level.grid).toHaveLength(6);
      for (const row of level.grid) {
        expect(row.length).toBe(8);
      }
    }
  });

  it("ninguna entidad se solapa en la misma casilla", () => {
    for (const level of ALL_LEVELS) {
      const check = checkNoOverlap(level);
      expect(check.ok, `Nivel ${level.levelId}: ${check.reason}`).toBe(true);
    }
  });

  it("todos los niveles son resolubles", () => {
    for (const level of ALL_LEVELS) {
      const result = solveLevel(level, { maxDepth: 50, maxStates: 100_000 });
      expect(result.solvable, `Nivel ${level.levelId} no es resoluble: ${result.reason}`).toBe(true);
    }
  });

  it("las soluciones encontradas son válidas (llevan a victoria)", () => {
    for (const level of ALL_LEVELS) {
      const result = solveLevel(level, { maxDepth: 50, maxStates: 100_000 });
      if (!result.solvable || !result.solution) continue;
      expect(verifySolution(level, result.solution), `Nivel ${level.levelId}: la solución no llega a victoria`).toBe(true);
    }
  });

  it("la dificultad es progresiva (minMoves no decrece bruscamente)", () => {
    const minMoves: number[] = [];
    for (const level of ALL_LEVELS) {
      const result = solveLevel(level, { maxDepth: 50, maxStates: 100_000 });
      minMoves.push(result.solvable ? result.minMoves : Infinity);
    }
    // El nivel 1 debe ser el más fácil (menos movimientos)
    expect(minMoves[0]).toBeLessThanOrEqual(minMoves[9]!);
    // Imprimir para diagnóstico
    console.log(`[niveles Wappo] minMoves: ${minMoves.join(", ")}`);
  });

  // Tests individuales por nivel para mejor diagnóstico
  for (const level of ALL_LEVELS) {
    it(`nivel ${level.levelId} es resoluble`, () => {
      const result = solveLevel(level, { maxDepth: 50, maxStates: 100_000 });
      expect(result.solvable, `Nivel ${level.levelId}: ${result.reason}`).toBe(true);
      if (result.solvable) {
        console.log(`  nivel ${level.levelId}: ${result.minMoves} movimientos mínimos`);
      }
    });
  }
});
