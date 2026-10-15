import { TIERS, mulberry32, solve, allCells, manhattan, directPathCells, emptyBoardDistance, col, row, idx } from "../generator/generate-screens.js";
// Réplica del tramo de randomCandidate para diagnosticar el reintento de enemigos
const t = TIERS.find((x) => x.level === Number(process.argv[2] || 10))!;
const N = 300;
let nullDist = 0, attemptsStat = { unsolvable: 0, direct: 0, ok: 0, noPlace: 0 }, cands = 0;
for (let i = 0; i < N; i++) {
  const rnd = mulberry32((i * 2654435761) >>> 0);
  const cells = allCells();
  for (let a = cells.length - 1; a > 0; a--) { const j = Math.floor(rnd() * (a + 1)); [cells[a], cells[j]] = [cells[j], cells[a]]; }
  const used = new Set<number>();
  const exitC = cells.pop()!;
  used.add(exitC);
  const hiD = Math.min(12, t.minSolutionLen[1] - 1);
  let maxD = 0;
  for (const c of cells) maxD = Math.max(maxD, manhattan(c, exitC));
  const loD = Math.max(2, Math.min(hiD, maxD - 2, Math.max(2, t.minSolutionLen[0] - 6)));
  const distPool = cells.filter((c) => { const d = manhattan(c, exitC); return d >= loD && d <= hiD && !used.has(c); });
  if (!distPool.length) { nullDist++; continue; }
  const playerC = distPool[Math.floor(rnd() * distPool.length)]!;
  used.add(playerC);
  cands++;
  const pathCells = directPathCells(playerC, exitC);
  const pathSet = new Set(pathCells);
  const nObs = t.numObstacles[0] + Math.floor(rnd() * (t.numObstacles[1] - t.numObstacles[0] + 1));
  const nTrp = t.numTraps[0] + Math.floor(rnd() * (t.numTraps[1] - t.numTraps[0] + 1));
  const obstacles = new Set<number>();
  let gapCell = -1;
  if (nObs >= 4 && rnd() < 0.5) {
    const pc = col(playerC), pr = row(playerC), ec = col(exitC), er = row(exitC);
    const line: number[] = [];
    if (Math.abs(pc - ec) >= Math.abs(pr - er)) {
      const wc = Math.floor((pc + ec) / 2);
      if (wc !== pc && wc !== ec) for (let r = 0; r < 6; r++) line.push(r * 8 + wc);
    } else {
      const wr = Math.floor((pr + er) / 2);
      if (wr !== pr && wr !== er) for (let c = 0; c < 8; c++) line.push(wr * 8 + c);
    }
    if (line.length) {
      gapCell = line[Math.floor(rnd() * line.length)]!;
      for (const c of line) { if (c === gapCell || used.has(c)) continue; if (obstacles.size >= nObs) break; obstacles.add(c); used.add(c); }
    }
  }
  const freeC = () => allCells().filter((c) => !used.has(c));
  if (obstacles.size < nObs) {
    for (const c of freeC()) { if (obstacles.size >= nObs) break; obstacles.add(c); used.add(c); }
  }
  const traps = new Set<number>();
  for (const c of freeC()) { if (traps.size >= nTrp) break; traps.add(c); used.add(c); }
  const freePre = freeC().filter((c) => !obstacles.has(c) && !traps.has(c));
  const emptyDist = emptyBoardDistance(playerC, exitC);
  const pathEnd = pathCells.slice(Math.floor(pathCells.length * 0.6));
  const threat = (c: number) => manhattan(c, exitC) <= 5 || pathEnd.some((p) => manhattan(c, p) <= 3) || (gapCell >= 0 && manhattan(c, gapCell) <= 4);
  for (let attempt = 0; attempt < 24; attempt++) {
    const occ = new Set<number>(used);
    const es: number[] = [];
    let ok2 = true;
    for (let e2 = 0; e2 < t.numEnemies; e2++) {
      const valid = (c: number) => !occ.has(c) && manhattan(c, playerC) >= t.minEnemyPlayerDist && es.every((e) => manhattan(c, e) >= t.minEnemyEnemyDist);
      let cd = freePre.filter((c) => valid(c) && threat(c));
      if (!cd.length) cd = freePre.filter((c) => valid(c) && manhattan(c, exitC) <= 8);
      if (!cd.length) cd = freePre.filter(valid);
      if (!cd.length) { ok2 = false; break; }
      const e = cd[Math.floor(rnd() * cd.length)]!;
      es.push(e); occ.add(e);
    }
    if (!ok2) { attemptsStat.noPlace++; continue; }
    const r = solve({ obstacles: new Set(obstacles), traps: new Set(traps), exit: exitC, player: playerC, enemies: es });
    if (!r.solvable) attemptsStat.unsolvable++;
    else if (r.length! <= emptyDist) attemptsStat.direct++;
    else attemptsStat.ok++;
  }
}
console.log(`tier ${t.level}: candidatos ${cands}/${N} (dist null ${nullDist})`);
console.log(`  reintentos enemigos: ok=${attemptsStat.ok} unsolvable=${attemptsStat.unsolvable} direct=${attemptsStat.direct} sinSitio=${attemptsStat.noPlace}`);
