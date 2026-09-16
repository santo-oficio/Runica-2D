import { readFileSync } from "node:fs";
import { playTurn } from "../engine/rules.js";
import { createInitialState } from "../engine/state.js";
import type { LevelMap, EnemyPattern, Direction } from "../schemas/types.js";

interface Screen {
  id: string; level: number; grid: string[]; player: [number, number];
  goal: [number, number]; enemies: { pos: [number, number]; pattern: string }[];
}

const data = JSON.parse(readFileSync("db/screens.json", "utf-8")) as Screen[];
const s = data.find((x) => x.id === "l10-s679")!;

const W = 6, H = 6, CELLS = 36;
const blocked = new Uint8Array(CELLS);
const trap = new Uint8Array(CELLS);
for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
  const ch = s.grid[r]![c]!;
  if (ch === "#" || ch === "X") blocked[r * W + c] = 1;
  else if (ch === "T") trap[r * W + c] = 1;
}
const n = s.enemies.length;
const playerStart = s.player[1] * W + s.player[0];
const goalIdx = s.goal[1] * W + s.goal[0];
const enemyStart = s.enemies.map((e) => e.pos[1] * W + e.pos[0]);
const enemyChase = s.enemies.map((e) => e.pattern === "CHASE");

function keyOf(p: number, e: number[], st: number[]): number {
  let k = p, mult = 36;
  for (let i = 0; i < n; i++) { k += e[i]! * mult; mult *= 36; }
  let sMult = mult;
  for (let i = 0; i < n; i++) { k += st[i]! * sMult; sMult *= 4; }
  return k;
}

const startKey = keyOf(playerStart, enemyStart, enemyStart.map(() => 0));
const visited = new Set<number>([startKey]);
const queue: { p: number; e: number[]; st: number[]; path: string[] }[] = [
  { p: playerStart, e: enemyStart, st: enemyStart.map(() => 0), path: [] },
];
const DIRS: [number, string][] = [[1, "R"], [-1, "L"], [6, "D"], [-6, "U"]];

let found: string[] | null = null;
while (queue.length > 0 && !found) {
  const cur = queue.shift()!;
  if (cur.path.length > 60) continue;
  for (const [d, label] of DIRS) {
    const np = cur.p + d;
    if (np < 0 || np >= CELLS) continue;
    const pc = cur.p % W;
    if (d === 1 && pc === W - 1) continue;
    if (d === -1 && pc === 0) continue;
    if (blocked[np]) continue;
    if (cur.e.includes(np)) continue;
    if (np === goalIdx) { found = [...cur.path, label]; break; }
    const e = cur.e.slice();
    const st = cur.st.slice();
    let captured = false;
    for (let step = 0; step < 2; step++) {
      for (let i = 0; i < n; i++) {
        if (!enemyChase[i]) continue;
        if (st[i]! > 0) { st[i] = st[i]! - 1; continue; }
        const ec = e[i]!;
        const er = Math.floor(ec / W), ecc = ec % W;
        const dx = Math.sign((np % W) - ecc), dy = Math.sign(Math.floor(np / W) - er);
        const cand: number[] = [];
        if (dx !== 0) cand.push(ec + dx);
        if (dy !== 0) cand.push(ec + dy * W);
        for (const nc of cand) {
          if (nc < 0 || nc >= CELLS) continue;
          if (Math.floor(nc / W) !== er && Math.abs(nc - ec) === 1) continue;
          if (blocked[nc]) continue;
          if (e.some((o, j) => j !== i && o === nc)) continue;
          e[i] = nc;
          if (trap[nc]) st[i] = 3;
          break;
        }
        if (e[i] === np) captured = true;
      }
      if (captured) break;
    }
    if (captured) continue;
    if (np === goalIdx) { found = [...cur.path, label]; break; }
    const key = keyOf(np, e, st);
    if (visited.has(key)) continue;
    visited.add(key);
    queue.push({ p: np, e, st, path: [...cur.path, label] });
  }
}

console.log("Path encontrado (generador):", found ? found.join(" ") : "NO");

// Replay con el motor
if (found) {
  const MAP: Record<string, EnemyPattern> = { CHASE: "PERSECUCION_SIMPLE", VIGILANCIA: "VIGILANCIA_ZONA" };
  const lvl: LevelMap = {
    levelId: s.level, seed: 1, world: "AGUA", backgroundTemplateId: "agua-bg-01",
    archetype: "RECTANGULO", width: 6, height: 6, grid: s.grid,
    player: s.player, goal: s.goal,
    enemies: s.enemies.map((e) => ({ pos: e.pos, pattern: MAP[e.pattern]! })),
    keys: [], doors: [], rulesetVersion: "wappo-v1",
  };
  const st = createInitialState(lvl);
  const dirMap: Record<string, Direction> = { U: "UP", D: "DOWN", L: "LEFT", R: "RIGHT" };
  for (let i = 0; i < found.length; i++) {
    playTurn(st, dirMap[found[i]!]!);
    console.log(`  move ${i+1} (${found[i]}): player=${st.player} enemies=${st.enemies.map(e=>e.pos)} solved=${st.solved} failed=${st.failed}`);
    if (st.failed || st.solved) break;
  }
  console.log("Replay motor: solved=", st.solved, "failed=", st.failed);
}
