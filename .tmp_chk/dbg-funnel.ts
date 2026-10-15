import { TIERS, mulberry32, randomCandidate, solve, pruneRedundant } from "../generator/generate-screens.js";
const tier = TIERS[2]; // tier 3
let solvable=0, unsolvable=0, nullCand=0, pruneFail=0, pruneOk=0;
const N=2000;
const rnd0 = mulberry32(1);
for(let i=0;i<N;i++){
  const rnd = mulberry32((i*2654435761)>>>0);
  const raw = randomCandidate(tier, rnd);
  if(!raw){nullCand++;continue;}
  const r = solve(raw);
  if(!r.solvable){unsolvable++;continue;}
  solvable++;
  const p = pruneRedundant(raw);
  if(p===null) pruneFail++; else pruneOk++;
}
console.log({N, nullCand, unsolvable, solvable, pruneFail, pruneOk});
