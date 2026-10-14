// Verificación exhaustiva: resuelve TODAS las pantallas del tier 15 con el
// solver público (motor real) y comprueba minMoves.
import { readFileSync } from "node:fs";
import { solveLevel } from "../solver/checklist.js";
import type { LevelMap } from "../schemas/types.js";

const screens = JSON.parse(readFileSync("db/screens-tier-15.json", "utf-8")) as any[];
function toLevelMap(s: any): LevelMap {
  return {
    levelId: 15, seed: 15, world: "MAZMORRA",
    backgroundTemplateId: "MAZMORRA_01", archetype: "RECTANGULO",
    width: 8, height: 6, grid: s.grid, player: s.player, goal: s.goal,
    enemies: s.enemies.map((e: any) => ({ pos: e.pos, pattern: "PERSECUCION_SIMPLE" })) as any,
    keys: [], doors: [], rulesetVersion: "runika-v1",
  };
}
let ok = 0, fail = 0, mismatch = 0;
const t0 = Date.now();
for (const s of screens) {
  const r = solveLevel(toLevelMap(s), { maxDepth: 40, maxStates: 500000 });
  if (!r.solvable) { fail++; if (fail <= 5) console.log(`INSOLUBLE ${s.id}: ${r.reason}`); continue; }
  if (r.minMoves !== s.minMoves) { mismatch++; if (mismatch <= 5) console.log(`minMoves ${s.id}: solver=${r.minMoves} bank=${s.minMoves}`); }
  ok++;
}
console.log(`TOTAL: ${screens.length} | solubles=${ok} insolubles=${fail} minMoves-distintos=${mismatch} | ${((Date.now()-t0)/1000).toFixed(0)}s`);
