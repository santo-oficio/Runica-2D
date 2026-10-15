import { describe, it, expect } from "vitest";
import {
  TIERS,
  solve,
  validateCandidate,
  countSolutionsOfMinLength,
  boardUse,
  canonicalKey,
  screenToLevelData,
  generateTierBatch,
  generateTier1Exhaustive,
  BOARD_USE_FROM_TIER,
  type LevelData,
} from "../generator/generate-screens.js";
import { FIRST_TIER, tierForCompleted } from "../db/db.js";

const lv = (o: Partial<LevelData>): LevelData => ({
  obstacles: new Set(),
  traps: new Set(),
  exit: 0,
  player: 0,
  enemies: [],
  ...o,
});
const idx = (c: number, r: number) => r * 8 + c;

describe("rediseño — progresión", () => {
  it("la partida empieza en el tier 3", () => {
    expect(FIRST_TIER).toBe(3);
    expect(tierForCompleted(0)).toBe(3);
  });
  it("los 96 escenarios se reparten 3..14 (8 por tier)", () => {
    expect(tierForCompleted(0)).toBe(3);
    expect(tierForCompleted(95)).toBe(14);
    // 8 islas por tier: isla 8 → tier 4
    expect(tierForCompleted(8)).toBe(4);
  });
});

describe("rediseño — tabla de tiers", () => {
  it("máximo 2 enemigos en todos los tiers", () => {
    for (const t of TIERS) expect(t.numEnemies).toBeLessThanOrEqual(2);
  });
  it("separación enemigo-enemigo ≥4 cuando hay 2", () => {
    for (const t of TIERS.filter((t) => t.numEnemies >= 2)) {
      expect(t.minEnemyEnemyDist).toBeGreaterThanOrEqual(4);
    }
  });
  it("par mínimo ≥12 desde el tier 7", () => {
    for (const t of TIERS.filter((t) => t.level >= BOARD_USE_FROM_TIER)) {
      expect(t.minSolutionLen[0]).toBeGreaterThanOrEqual(12);
    }
  });
  it("mínimo 2 obstáculos desde el tier 4", () => {
    for (const t of TIERS.filter((t) => t.level >= 4)) {
      expect(t.numObstacles[0]).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("rediseño — reglas de validación", () => {
  // Puzzle con solución directa: sin nada que la estorbe.
  const direct = lv({ player: idx(0, 0), exit: idx(4, 0), enemies: [idx(7, 5)] });
  it("rechaza camino directo (óptimo = distancia del tablero vacío)", () => {
    const t3 = TIERS.find((t) => t.level === 3)!;
    const v = validateCandidate(direct, t3);
    expect(v.ok).toBe(false);
    // el enemigo a (7,5) no afecta: la razón será camino directo o enemigo decorativo
    expect(["direct_path", "decorative_enemy"]).toContain(v.reason.split("(")[0]);
  });
  it("un enemigo que no condiciona nada es decorativo", () => {
    const t3 = TIERS.find((t) => t.level === 3)!;
    // obstáculo lejos de todo: no cambia nada
    const v = validateCandidate(
      lv({ player: idx(0, 0), exit: idx(4, 0), enemies: [idx(7, 5)], obstacles: new Set([idx(0, 5)]) }),
      t3,
    );
    expect(v.ok).toBe(false);
  });
  it("el par es mínimo real +1 o +2 y debe ser bateable", () => {
    // Cualquier pantalla aceptada por generateTierBatch cumple:
    // par ∈ [minLen[0], minLen[1]] y par - trueMin ∈ {1, 2}
    const t5 = TIERS.find((t) => t.level === 5)!;
    const { screens } = generateTierBatch(t5, 3, 12345, 4000);
    for (const s of screens) {
      const data = screenToLevelData(s);
      const T = solve(data).length!;
      expect(s.minMoves - T).toBeGreaterThanOrEqual(1);
      expect(s.minMoves - T).toBeLessThanOrEqual(2);
      // bateable: existe solución en par-1 o par-2
      const beatable =
        countSolutionsOfMinLength(data, s.minMoves - 1, 1) > 0 ||
        countSolutionsOfMinLength(data, s.minMoves - 2, 1) > 0;
      expect(beatable).toBe(true);
      // conteos almacenados
      expect(s.sols).toBeDefined();
      expect(s.sols![0]).toBeGreaterThan(0);
    }
  });
});

describe("rediseño — simetrías y uso del tablero", () => {
  it("canonicalKey iguala espejos y rotación 180°", () => {
    const base = lv({ player: idx(1, 1), exit: idx(6, 4), enemies: [idx(4, 2)], obstacles: new Set([idx(3, 3)]) });
    const hMirror = lv({ player: idx(6, 1), exit: idx(1, 4), enemies: [idx(3, 2)], obstacles: new Set([idx(4, 3)]) });
    const vMirror = lv({ player: idx(1, 4), exit: idx(6, 1), enemies: [idx(4, 3)], obstacles: new Set([idx(3, 2)]) });
    const rot180 = lv({ player: idx(6, 4), exit: idx(1, 1), enemies: [idx(3, 3)], obstacles: new Set([idx(4, 2)]) });
    const k = canonicalKey(base);
    expect(canonicalKey(hMirror)).toBe(k);
    expect(canonicalKey(vMirror)).toBe(k);
    expect(canonicalKey(rot180)).toBe(k);
  });
  it("boardUse cuenta camino + elementos", () => {
    const level = lv({ player: idx(0, 0), exit: idx(7, 5), enemies: [idx(7, 0)], obstacles: new Set([idx(2, 2)]) });
    // Camino sintético de 13 celdas + enemigo + obstáculo → 15/48 ≈ 0.31
    const path = [idx(0, 0), idx(1, 0), idx(2, 0), idx(3, 0), idx(4, 0), idx(5, 0), idx(6, 0), idx(7, 0), idx(7, 1), idx(7, 2), idx(7, 3), idx(7, 4), idx(7, 5)];
    const use = boardUse(level, path);
    expect(use).toBeGreaterThan(0.2);
    expect(use).toBeLessThan(0.5);
  });
});

describe("rediseño — tier 1 exhaustivo", () => {
  it("el espacio completo del tier 1 es pequeño pero no vacío", () => {
    const t1 = TIERS.find((t) => t.level === 1)!;
    const { screens } = generateTier1Exhaustive(t1);
    // Espacio medido: ~258 puzzles únicos (sin duplicados ni simetrías)
    expect(screens.length).toBeGreaterThan(100);
    expect(screens.length).toBeLessThan(2000);
    for (const s of screens) expect(s.minMoves).toBeGreaterThanOrEqual(4);
  }, 300_000);
});
