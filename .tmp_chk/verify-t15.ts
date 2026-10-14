// Re-verificación independiente: resuelve una muestra de db/screens-tier-15.json
// con el solver público (engine real) y comprueba minMoves.
import { readFileSync } from "node:fs";
import { solveLevel } from "../solver/checklist.js";
import type { LevelMap } from "../schemas/types.js";

const screens = JSON.parse(readFileSync("db/screens-tier-15.json", "utf-8")) as any[];

function toLevelMap(s: any): LevelMap {
  return {
    levelId: 15,
    seed: 15,
    world: "MAZMORRA",
    backgroundTemplateId: "MAZMORRA_01",
    archetype: "RECTANGULO",
    width: 8,
    height: 6,
    grid: s.grid,
    player: s.player,
    goal: s.goal,
    enemies: s.enemies.map((e: any) => ({ pos: e.pos, pattern: "PERSECUCION_SIMPLE" })) as any,
    keys: [],
    doors: [],
    rulesetVersion: "runika-v1",
  };
}

const N = 200;
const step = Math.floor(screens.length / N);
let ok = 0;
let fail = 0;
let mismatch = 0;
const t0 = Date.now();
for (let i = 0; i < screens.length; i += step) {
  const s = screens[i];
  const r = solveLevel(toLevelMap(s), { maxDepth: 30, maxStates: 200000 });
  if (!r.solvable) { fail++; if (fail <= 3) console.log(`NO SOLUBLE ${s.id}: ${r.reason}`); continue; }
  if (r.minMoves !== s.minMoves) { mismatch++; if (mismatch <= 3) console.log(`minMoves ${s.id}: solver=${r.minMoves} bank=${s.minMoves}`); }
  ok++;
}
console.log(`verificados ${ok + fail} (${((Date.now() - t0) / 1000).toFixed(0)}s): solubles=${ok}, no solubles=${fail}, minMoves distintos=${mismatch}`);
