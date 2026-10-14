import { generateLevel } from "../generator/generate-screens.js";

const W = 8;
const cfg = JSON.parse(process.argv[2]); // {obs:[a,b], traps:[a,b], len:[a,b]}
const N = Number(process.argv[3] ?? 300);
const tier = {
  level: 15, numEnemies: 2, numObstacles: cfg.obs, numTraps: cfg.traps,
  minSolutionLen: cfg.len, minEnemyPlayerDist: 3,
};
let ok = 0, sumLen = 0, sumTries = 0;
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const r = generateLevel(tier as any, 99_000_000 + i * 7919);
  if (r) { ok++; sumLen += r.length; }
}
console.log(`${JSON.stringify(cfg)} → aceptación ${(100 * ok / N).toFixed(1)}% (${ok}/${N}), longitud media ${ok ? (sumLen / ok).toFixed(1) : "-"}, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
