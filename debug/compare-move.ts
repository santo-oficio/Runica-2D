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

// Replay con la lógica del GENERADOR
function genReplay(path: Direction[]) {
  let p = s.player[1] * W + s.player[0];
  let e = s.enemies.map((x) => x.pos[1] * W + x.pos[0]);
  let st = s.enemies.map(() => 0);
  const chase = s.enemies.map((x) => x.pattern === "CHASE");
  const goalIdx = s.goal[1] * W + s.goal[0];
  const n = e.length;
  for (let m = 0; m < path.length; m++) {
    const d = path[m]!;
    const delta = d === "UP" ? -W : d === "DOWN" ? W : d === "LEFT" ? -1 : 1;
    const np = p + delta;
    let captured = false;
    for (let step = 0; step < 2; step++) {
      for (let i = 0; i < n; i++) {
        if (!chase[i]) continue;
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
    const pos = (k: number) => `(${k % W},${Math.floor(k / W)})`;
    console.log(`GEN move ${m + 1} (${d}): player=${pos(np)} enemies=${e.map(pos).join(",")} captured=${captured}`);
    if (captured) { console.log("  -> GENERADOR: capturado aquí"); break; }
    p = np;
  }
}

// Replay con el MOTOR
function engineReplay(path: Direction[]) {
  const MAP: Record<string, EnemyPattern> = { CHASE: "PERSECUCION_SIMPLE", VIGILANCIA: "VIGILANCIA_ZONA" };
  const lvl: LevelMap = {
    levelId: s.level, seed: 1, world: "AGUA", backgroundTemplateId: "agua-bg-01",
    archetype: "RECTANGULO", width: 6, height: 6, grid: s.grid,
    player: s.player, goal: s.goal,
    enemies: s.enemies.map((x) => ({ pos: x.pos, pattern: MAP[x.pattern]! })),
    keys: [], doors: [], rulesetVersion: "wappo-v1",
  };
  const st = createInitialState(lvl);
  for (let m = 0; m < path.length; m++) {
    playTurn(st, path[m]!);
    console.log(`ENG move ${m + 1} (${path[m]}): player=${st.player} enemies=${st.enemies.map((e) => `(${e.pos[0]},${e.pos[1]})`).join(",")} failed=${st.failed}`);
    if (st.failed) { console.log("  -> MOTOR: capturado aquí"); break; }
  }
}

const path: Direction[] = ["DOWN","DOWN","UP","UP","RIGHT","RIGHT","LEFT","RIGHT","LEFT","LEFT","DOWN","DOWN","DOWN","DOWN","DOWN"];
console.log("=== GENERADOR ===");
genReplay(path);
console.log("\n=== MOTOR ===");
engineReplay(path);
