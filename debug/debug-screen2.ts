import { readFileSync } from "node:fs";
import { solveLevel } from "../solver/checklist.js";
import type { LevelMap, EnemyPattern } from "../schemas/types.js";

interface Screen {
  id: string; level: number; grid: string[]; player: [number, number];
  goal: [number, number]; enemies: { pos: [number, number]; pattern: string }[];
}

const data = JSON.parse(readFileSync("db/screens.json", "utf-8")) as Screen[];
const s = data.find((x) => x.id === "l10-s679")!;

const MAP: Record<string, EnemyPattern> = { CHASE: "PERSECUCION_SIMPLE", VIGILANCIA: "VIGILANCIA_ZONA" };
const lvl: LevelMap = {
  levelId: s.level, seed: 1, world: "AGUA", backgroundTemplateId: "agua-bg-01",
  archetype: "RECTANGULO", width: 6, height: 6, grid: s.grid,
  player: s.player, goal: s.goal,
  enemies: s.enemies.map((e) => ({ pos: e.pos, pattern: MAP[e.pattern]! })),
  keys: [], doors: [], rulesetVersion: "wappo-v1",
};

const r1 = solveLevel(lvl);
console.log("default:", r1.solvable, "minMoves", r1.minMoves, "states", r1.statesExplored, r1.reason);
const r2 = solveLevel(lvl, { maxDepth: 100, maxStates: 2_000_000 });
console.log("2M states:", r2.solvable, "minMoves", r2.minMoves, "states", r2.statesExplored, r2.reason);
