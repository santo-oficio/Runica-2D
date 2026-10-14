import { generateLevel } from "../generator/generate-screens.js";

const candidates = [
  { level: 15, numEnemies: 4, numObstacles: [4,5], numTraps: [3,4], minSolutionLen: [16,23], minEnemyPlayerDist: 3 },
  { level: 15, numEnemies: 3, numObstacles: [4,6], numTraps: [3,4], minSolutionLen: [15,22], minEnemyPlayerDist: 3 },
] as const;

for (const tier of candidates) {
  let ok = 0; const lens: number[] = [];
  const t0 = Date.now();
  for (let s = 15_000_000; s < 15_000_000 + 400; s++) {
    const r = generateLevel({ ...tier, numObstacles: [...tier.numObstacles] as any, numTraps: [...tier.numTraps] as any, minSolutionLen: [...tier.minSolutionLen] as any }, s);
    if (r) { ok++; lens.push(r.length); }
  }
  const ms = ((Date.now() - t0) / 1000).toFixed(1);
  const avg = lens.length ? (lens.reduce((a,b)=>a+b,0)/lens.length).toFixed(1) : '-';
  console.log(`E${tier.numEnemies} O${tier.numObstacles} T${tier.numTraps} L${tier.minSolutionLen}: ${ok}/400 aceptados (${(ok/400*100).toFixed(1)}%), len media ${avg}, ${ms}s`);
}
