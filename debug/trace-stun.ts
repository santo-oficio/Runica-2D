import { readFileSync } from "node:fs";
import { playTurn } from "../engine/rules.js";
import { createInitialState } from "../engine/state.js";
import type { LevelMap, EnemyPattern, Direction } from "../schemas/types.js";

interface Screen { id: string; level: number; grid: string[]; player: [number, number]; goal: [number, number]; enemies: { pos: [number, number]; pattern: string }[]; }
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
const st = createInitialState(lvl);
const path: Direction[] = ["DOWN","DOWN","UP","UP","RIGHT","RIGHT","LEFT","RIGHT"];
for (let m = 0; m < path.length; m++) {
  playTurn(st, path[m]!);
  console.log(`move ${m+1} (${path[m]}): player=${st.player} enemies=${st.enemies.map((e,i)=>`#${i}=(${e.pos[0]},${e.pos[1]})`).join(" ")} stun=${st.enemyStunnedTurns}`);
}
