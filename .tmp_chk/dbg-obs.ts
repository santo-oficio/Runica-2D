import { TIERS, mulberry32, randomCandidate, solve, solvePath, pruneRedundant, ensureMinObstacles } from "../generator/generate-screens.js";
const tier = TIERS[2]; // tier 3, min obstacles = 1
let checked=0, fixed=0, fail=0, zeroObs=0;
for(let i=0;i<500;i++){
  const rnd = mulberry32((i*2654435761)>>>0);
  const raw = randomCandidate(tier, rnd);
  if(!raw) continue;
  if(!solve(raw).solvable) continue;
  const p = pruneRedundant(raw);
  if(!p) continue;
  checked++;
  if(p.obstacles.size===0) zeroObs++;
  const f = ensureMinObstacles(p, tier, rnd);
  if(f===null){
    fail++;
    if(fail<=3){
      const r = solvePath(p);
      console.log("FAIL obs:", [...p.obstacles], "enemies:", p.enemies.length, "optLen:", r.length, "pathCells:", r.path?.length, "traps:", p.traps.size);
      // imprimir grid
      for(let rr=0;rr<6;rr++){let l="";for(let c=0;c<8;c++){const k=rr*8+c;l+= p.obstacles.has(k)?"X":p.traps.has(k)?"T":p.exit===k?"G":p.player===k?"P":p.enemies.includes(k)?"E":".";}console.log("   "+l);}
    }
  } else fixed++;
}
console.log({checked, zeroObs, fixed, fail});
