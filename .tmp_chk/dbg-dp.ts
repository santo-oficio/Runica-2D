import { TIERS, mulberry32, randomCandidate, solve, solvePath, pruneRedundant, ensureElements, validateCandidate } from "../generator/generate-screens.js";
const tier = TIERS[2];
let shown=0, stats={};
for(let i=0;i<4000 && shown<5;i++){
  const rnd = mulberry32((i*2246822519)>>>0);
  const raw = randomCandidate(tier, rnd);
  if(!raw || !solve(raw).solvable) continue;
  const p = pruneRedundant(raw);
  if(!p) continue;
  const f = ensureElements(p, tier, rnd);
  if(!f) continue;
  const v = validateCandidate(f, tier);
  if(v.ok) { console.log("¡ACEPTADA!", v.par); continue; }
  const k=v.reason.split("(")[0]; stats[k]=(stats[k]||0)+1;
  if(k==="direct_path" && shown++<5){
    console.log(`direct_path T=${v.trueMin} enem=${f.enemies.length} obs=${f.obstacles.size} traps=${f.traps.size}`);
    for(let rr=0;rr<6;rr++){let l="";for(let c=0;c<8;c++){const k2=rr*8+c;l+=f.obstacles.has(k2)?"X":f.traps.has(k2)?"T":f.exit===k2?"G":f.player===k2?"P":f.enemies.includes(k2)?"E":".";}console.log("   "+l);}
  }
}
console.log(stats);
