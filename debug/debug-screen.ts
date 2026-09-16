import { readFileSync } from "node:fs";
import { playTurn } from "../engine/rules.js";
import { createInitialState } from "../engine/state.js";
import type { LevelMap, EnemyPattern, Direction } from "../schemas/types.js";

(globalThis as any).__TRACE_CHASE__ = true;

interface Screen {
  id: string; level: number; grid: string[]; player: [number, number];
  goal: [number, number]; enemies: { pos: [number, number]; pattern: string }[];
}

const data = JSON.parse(readFileSync("db/screens.json", "utf-8")) as Screen[];
const s = data.find((x) => x.id === "l7-s1303")!;

const MAP: Record<string, EnemyPattern> = {
  CHASE: "PERSECUCION_SIMPLE", VIGILANCIA: "VIGILANCIA_ZONA",
};

const lvl: LevelMap = {
  levelId: s.level, seed: 1, world: "AGUA", backgroundTemplateId: "agua-bg-01",
  archetype: "RECTANGULO", width: 6, height: 6, grid: s.grid,
  player: s.player, goal: s.goal,
  enemies: s.enemies.map((e) => ({ pos: e.pos, pattern: MAP[e.pattern]! })),
  keys: [], doors: [], rulesetVersion: "wappo-v1",
};

const st = createInitialState(lvl);
console.log("initial enemies:", st.enemies.map((e) => e.pos));
const moves: Direction[] = ["UP", "UP"];
for (let m = 0; m < moves.length; m++) {
  console.log(`\n=== Move ${m + 1} (${moves[m]}) ===`);
  playTurn(st, moves[m]!);
  console.log(`result: player=${st.player} enemies=${st.enemies.map((e) => e.pos)} stun=${st.enemyStunnedTurns}`);
}
