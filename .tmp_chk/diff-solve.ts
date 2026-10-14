// Replica solve() del generador con flag para el re-stun de trampa,
// y lo ejecuta sobre pantallas que el solver público marcó insolubles.
import { readFileSync } from "node:fs";

const W = 8, H = 6, CELLS = W * H;
const screens = JSON.parse(readFileSync("db/screens-tier-15.json", "utf-8")) as any[];

function screenToLv(s: any) {
  return {
    obstacles: new Set(s.obstacles.map(([c, r]: number[]) => r * W + c)),
    traps: new Set(s.traps.map(([c, r]: number[]) => r * W + c)),
    enemies: s.enemies.map((e: any) => e.pos[1] * W + e.pos[0]),
    player: s.player[1] * W + s.player[0],
    exit: s.goal[1] * W + s.goal[0],
  };
}

function solve(lv: any, restunBlocked: boolean): number | null {
  const n = lv.enemies.length;
  const blocked = new Uint8Array(CELLS), trap = new Uint8Array(CELLS);
  for (const k of lv.obstacles) blocked[k] = 1;
  for (const k of lv.traps) trap[k] = 1;
  function keyOf(p: number, e: number[], s: number[], ps: number) {
    let k = p, mult = CELLS;
    for (let i = 0; i < n; i++) { k += e[i] * mult; mult *= CELLS; }
    let sm = mult;
    for (let i = 0; i < n; i++) { k += s[i] * sm; sm *= 4; }
    return k + ps * sm;
  }
  function substep(ep: number, pp: number) {
    const ec = ep % W, er = (ep / W) | 0, pc = pp % W, pr = (pp / W) | 0;
    const dx = Math.sign(pc - ec), dy = Math.sign(pr - er);
    const cand: number[] = [];
    if (dx !== 0) cand.push(ep + dx);
    if (dy !== 0) cand.push(ep + dy * W);
    for (const nc of cand) {
      if (nc < 0 || nc >= CELLS) continue;
      if (((nc / W) | 0) !== er && Math.abs(nc - ep) === 1) continue;
      if (blocked[nc]) continue;
      return nc;
    }
    return ep;
  }
  function moveEnemies(e: number[], s: number[], np: number) {
    const ne = e.slice(), ns = s.slice();
    let captured = false;
    for (let i = 0; i < n; i++) {
      if (ns[i] > 0) { ns[i]--; continue; }
      for (let st = 0; st < 2; st++) {
        const before = ne[i];
        const newPos = substep(ne[i], np);
        ne[i] = newPos;
        if (newPos === np) { captured = true; break; }
        if (trap[newPos] && (restunBlocked || newPos !== before)) { ns[i] = 3; break; }
      }
      if (captured) break;
    }
    return { e: ne, s: ns, captured };
  }
  const visited = new Set<number>();
  const q = [{ p: lv.player, e: lv.enemies.slice(), s: lv.enemies.map(() => 0), ps: 0, d: 0 }];
  visited.add(keyOf(lv.player, lv.enemies.slice(), lv.enemies.map(() => 0), 0));
  const DIRS = [1, -1, W, -W];
  while (q.length) {
    const c = q.shift()!;
    if (c.d > 60) continue;
    if (c.ps > 0) {
      const r = moveEnemies(c.e, c.s, c.p);
      if (r.captured) continue;
      const k = keyOf(c.p, r.e, r.s, c.ps - 1);
      if (!visited.has(k)) { visited.add(k); q.push({ p: c.p, e: r.e, s: r.s, ps: c.ps - 1, d: c.d + 1 }); }
      continue;
    }
    for (const d of DIRS) {
      const np = c.p + d;
      if (np < 0 || np >= CELLS) continue;
      const pc = c.p % W;
      if (d === 1 && pc === W - 1) continue;
      if (d === -1 && pc === 0) continue;
      if (blocked[np] || c.e.includes(np)) continue;
      if (np === lv.exit) return c.d + 1;
      const nps = trap[np] ? 3 : 0;
      const r = moveEnemies(c.e, c.s, np);
      if (r.captured) continue;
      const k = keyOf(np, r.e, r.s, nps);
      if (!visited.has(k)) { visited.add(k); q.push({ p: np, e: r.e, s: r.s, ps: nps, d: c.d + 1 }); }
    }
  }
  return null;
}

// Casos que el solver público marcó insolubles o con minMoves distinto
const targets = ["l15-s51", "l15-s76", "l15-s176", "l15-s301", "l15-s476", "l15-s551"];
for (const id of targets) {
  const s = screens.find((x) => x.id === id)!;
  const lv = screenToLv(s);
  const genA = solve(lv, true);   // comportamiento actual del generador
  const genB = solve(lv, false);  // con fix "solo aturde si se movió" (como el motor)
  console.log(`${id}: bank=${s.minMoves}, gen(re-stun)=${genA}, gen(sin re-stun)=${genB}`);
}
