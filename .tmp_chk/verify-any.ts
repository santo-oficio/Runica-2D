import { readFileSync } from "node:fs";
import { solveLevel } from "../solver/checklist.js";
import type { LevelMap } from "../schemas/types.js";

const file = process.argv[2];
const screens = JSON.parse(readFileSync(file, "utf-8")) as any[];
function toLevelMap(s: any): LevelMap {
  return {
    levelId: s.level, seed: s.level, world: "MAZMORRA",
    backgroundTemplateId: "MAZMORRA_01", archetype: "RECTANGULO",
    width: 8, height: 6, grid: s.grid, player: s.player, goal: s.goal,
    enemies: s.enemies.map((e: any) => ({ pos: e.pos, pattern: "PERSECUCION_SIMPLE" })) as any,
    keys: [], doors: [], rulesetVersion: "runika-v1",
  };
}
const N = 200;
const step = Math.max(1, Math.floor(screens.length / N));
let ok = 0, fail = 0, mismatch = 0;
for (let i = 0; i < screens.length; i += step) {
  const s = screens[i];
  const r = solveLevel(toLevelMap(s), { maxDepth: 40, maxStates: 500000 });
  if (!r.solvable) { fail++; continue; }
  if (r.minMoves !== s.minMoves) mismatch++;
  ok++;
}
console.log(`${file}: solubles=${ok}, insolubles=${fail}, minMoves-distintos=${mismatch} (muestra ${ok+fail})`);
