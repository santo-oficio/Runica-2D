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
  findCleanSolution,
  makeSimulator,
  MIN_PLAYER_EXIT_COLDIST,
  MAX_PATH_REVISITS,
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
  it("la partida empieza en el tier 2", () => {
    expect(FIRST_TIER).toBe(2);
    expect(tierForCompleted(0)).toBe(2);
  });
  it("los 96 escenarios se reparten 2..18 (~5-6 por tier)", () => {
    expect(tierForCompleted(0)).toBe(2);
    expect(tierForCompleted(95)).toBe(18);
    // ~5-6 islas por tier: isla 10 → tier 3-4
    expect(tierForCompleted(10)).toBeGreaterThanOrEqual(3);
    expect(tierForCompleted(10)).toBeLessThanOrEqual(4);
  });
  it("la tabla de tiers cubre exactamente 2..18", () => {
    expect(TIERS.map((t) => t.level)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });
});

describe("rediseño — tabla de tiers", () => {
  it("máximo 3 enemigos en todos los tiers (3 solo desde el 17)", () => {
    for (const t of TIERS) expect(t.numEnemies).toBeLessThanOrEqual(3);
    for (const t of TIERS.filter((t) => t.level < 5)) expect(t.numEnemies).toBe(1);
    for (const t of TIERS.filter((t) => t.level >= 5 && t.level < 17)) expect(t.numEnemies).toBe(2);
    for (const t of TIERS.filter((t) => t.level >= 17)) expect(t.numEnemies).toBe(3);
  });
  it("separación enemigo-enemigo ≥4 cuando hay 2 o más", () => {
    for (const t of TIERS.filter((t) => t.numEnemies >= 2)) {
      expect(t.minEnemyEnemyDist).toBeGreaterThanOrEqual(4);
    }
  });
  it("par mínimo ≥12 desde el tier 7", () => {
    for (const t of TIERS.filter((t) => t.level >= BOARD_USE_FROM_TIER)) {
      expect(t.minSolutionLen[0]).toBeGreaterThanOrEqual(12);
    }
  });
  it("mínimo 2 obstáculos en todos los tiers", () => {
    for (const t of TIERS) {
      expect(t.numObstacles[0]).toBeGreaterThanOrEqual(2);
    }
  });
  it("par mínimo ≥8 en todos los tiers (consecuencia del gap ≥6 columnas)", () => {
    for (const t of TIERS) {
      expect(t.minSolutionLen[0]).toBeGreaterThanOrEqual(8);
    }
  });
});

describe("rediseño — reglas de validación", () => {
  const t6 = TIERS.find((t) => t.level === 6)!;
  // Puzzle con solución directa: enemigos enjaulados en las esquinas →
  // tablero resoluble por el camino geométrico directo.
  const direct = lv({
    player: idx(0, 0), exit: idx(6, 0), enemies: [idx(7, 5), idx(0, 5)],
    obstacles: new Set([idx(7, 4), idx(6, 5), idx(0, 4), idx(1, 5)]),
  });
  it("rechaza camino directo (óptimo = distancia del tablero vacío)", () => {
    const v = validateCandidate(direct, t6);
    expect(v.ok).toBe(false);
    expect(v.reason.split("(")[0]).toBe("direct_path");
  });
  it("REGLA A FUEGO: rechaza salida a menos de 6 columnas del avatar", () => {
    const v = validateCandidate(
      lv({ player: idx(0, 0), exit: idx(4, 0), enemies: [idx(7, 5), idx(0, 5)] }),
      t6,
    );
    expect(v.ok).toBe(false);
    expect(v.reason.split("(")[0]).toBe("exit_too_close");
  });
  it("un enemigo que no condiciona nada es decorativo", () => {
    // obstáculo lejos de todo: no cambia nada
    const v = validateCandidate(
      lv({ player: idx(0, 0), exit: idx(6, 0), enemies: [idx(7, 5), idx(0, 5)], obstacles: new Set([idx(3, 3)]) }),
      t6,
    );
    expect(v.ok).toBe(false);
  });
  it("el par es mínimo real +1 o +2 y debe ser bateable", () => {
    // Cualquier pantalla aceptada por generateTierBatch cumple:
    // par ∈ [minLen[0], minLen[1]] y par - trueMin ∈ {1, 2}
    const { screens } = generateTierBatch(t6, 3, 12345, 4000);
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

describe("rediseño — regla anti-bailoteo (ruta limpia)", () => {
  const t10 = TIERS.find((t) => t.level === 10)!;
  // Puzzle real capturado durante el desarrollo: resoluble (trueMin 13)
  // pero TODA solución ≤ par exige >3 casillas revisitadas (bailoteo).
  const dancey = lv({
    player: 0, exit: 30, enemies: [35, 4],
    obstacles: new Set([3, 22, 14, 6, 2]),
    traps: new Set([28, 8, 13, 10, 37]),
  });
  it("rechaza pantallas que solo se resuelven yendo adelante y atrás", () => {
    const v = validateCandidate(dancey, t10);
    expect(v.ok).toBe(false);
    expect(v.reason.split("(")[0]).toBe("no_clean_route");
  });
  it("findCleanSolution devuelve ruta limpia en tablero abierto", () => {
    const open = lv({ player: idx(0, 0), exit: idx(7, 5), enemies: [] });
    const path = findCleanSolution(open, 20);
    expect(path).not.toBeNull();
    expect(path![0]).toBe(open.player);
    expect(path![path!.length - 1]).toBe(open.exit);
  });

  /** Reproduce un camino de celdas con el simulador real y mide sus
   *  revisita­s/turnos. Falla el test si no llega a la salida o atrapan. */
  function replay(d: LevelData, path: number[]) {
    const { blocked, trap, goalIdx, moveEnemies } = makeSimulator(d);
    let e = d.enemies.slice();
    let s = d.enemies.map(() => 0);
    const seen = new Set<number>([path[0]!]);
    let rv = 0, turns = 0;
    expect(path[0]).toBe(d.player);
    for (let i = 1; i < path.length; i++) {
      const p = path[i - 1]!, np = path[i]!;
      turns++;
      // adyacente, libre y sin enemigo encima
      const dc = Math.abs((np % 8) - (p % 8));
      const dr = Math.abs(Math.floor(np / 8) - Math.floor(p / 8));
      expect(dc + dr).toBe(1);
      expect(blocked[np]).toBeFalsy();
      expect(e.includes(np)).toBe(false);
      if (seen.has(np)) rv++;
      seen.add(np);
      if (np === goalIdx) return { rv, turns, reached: true };
      const newPs = trap[np] ? 3 : 0;
      const res = moveEnemies(e, s, np);
      expect(res.captured).toBe(false);
      e = res.e; s = res.s;
      // el aturdimiento quema turnos sin mover (no añade celdas al path)
      for (let st = newPs; st > 0; st--) {
        turns++;
        const r = moveEnemies(e, s, np);
        expect(r.captured).toBe(false);
        e = r.e; s = r.s;
      }
    }
    return { rv, turns, reached: false };
  }

  it("las rutas limpias aceptadas son soluciones reales ≤ par", () => {
    const t6 = TIERS.find((t) => t.level === 6)!;
    const { screens } = generateTierBatch(t6, 10, 31337, 20000);
    expect(screens.length).toBeGreaterThan(0);
    for (const s of screens) {
      const d = screenToLevelData(s);
      const path = findCleanSolution(d, s.minMoves);
      expect(path, `${s.id} sin ruta limpia`).not.toBeNull();
      const r = replay(d, path!);
      expect(r.reached).toBe(true);
      expect(r.turns).toBeLessThanOrEqual(s.minMoves);
      expect(r.rv).toBeLessThanOrEqual(MAX_PATH_REVISITS);
    }
  }, 120_000);
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

describe("rediseño — muestreo del tier 6", () => {
  it("todo lote generado cumple la regla de las 6 columnas y es resoluble", () => {
    const t6 = TIERS.find((t) => t.level === 6)!;
    const { screens } = generateTierBatch(t6, 10, 777, 20000);
    expect(screens.length).toBeGreaterThan(0);
    for (const s of screens) {
      const data = screenToLevelData(s);
      // REGLA A FUEGO: |col(jugador) − col(salida)| ≥ 6
      expect(Math.abs((data.player % 8) - (data.exit % 8))).toBeGreaterThanOrEqual(MIN_PLAYER_EXIT_COLDIST);
      // resoluble y no directo
      const T = solve(data).length!;
      expect(T).toBeGreaterThan(0);
      expect(s.minMoves).toBeGreaterThan(T);
    }
  }, 120_000);
});
