import { TIERS, mulberry32, randomCandidate, solve, solvePath, pruneRedundant, ensureElements } from "../generator/generate-screens.js";
const tier = TIERS[2];
let checked=0, ok=0, fail=0;
for(let i=0;i<300 && fail<4;i++){
  const rnd = mulberry32((i*2654435761)>>>0);
  const raw = randomCandidate(tier, rnd);
  if(!raw || !solve(raw).solvable) continue;
  const p = pruneRedundant(raw);
  if(!p) continue;
  checked++;
  const f = ensureElements(p, tier, mulberry32(i+7));
  if(f===null){
    fail++;
    console.log(`FAIL#${fail} pruned: obs=${p.obstacles.size} traps=${p.traps.size} enem=${p.enemies.length} opt=${solve(p).length}`);
  } else ok++;
}
console.log({checked, ok, fail});
