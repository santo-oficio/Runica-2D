import { readFileSync } from "node:fs";
import { solveLevel } from "../solver/checklist.js";
import type { LevelMap, EnemyPattern } from "../schemas/types.js";

interface Screen {
  id: string; level: number; grid: string[]; player: [number, number];
  goal: [number, number]; enemies: { pos: [number, number]; pattern: string }[];
  minMoves: number;
}

const data = JSON.parse(readFileSync("db/screens.json", "utf-8")) as Screen[];

const MAP: Record<string, EnemyPattern> = {
  CHASE: "PERSECUCION_SIMPLE", VIGILANCIA: "VIGILANCIA_ZONA",
};

function toLevelMap(s: Screen): LevelMap {
  return {
    levelId: s.level, seed: 1, world: "AGUA", backgroundTemplateId: "agua-bg-01",
    archetype: "RECTANGULO", width: 6, height: 6, grid: s.grid,
    player: s.player, goal: s.goal,
    enemies: s.enemies.map((e) => ({ pos: e.pos, pattern: MAP[e.pattern]! })),
    keys: [], doors: [], rulesetVersion: "wappo-v1",
  };
}

let bad = 0;
const start = Date.now();
for (const s of data) {
  const res = solveLevel(toLevelMap(s));
  if (!res.solvable || res.minMoves !== s.minMoves) {
    console.log(`MAL ${s.id}: motor=${res.solvable ? res.minMoves : "NO"} generador=${s.minMoves}`);
    bad++;
    if (bad > 20) { console.log("...demasiados fallos, parando"); break; }
  }
}
console.log(`\n${bad} discrepancias en ${data.length} pantallas (${((Date.now()-start)/1000).toFixed(1)}s)`);
