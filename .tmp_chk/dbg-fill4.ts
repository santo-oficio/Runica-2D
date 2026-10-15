import { TIERS, mulberry32, randomCandidate, solve, solvePath, pruneRedundant, fillTo as _x } from "../generator/generate-screens.js";
// fillTo no exportado; replica: uso ensureElements y rastreo diff
import { ensureElements } from "../generator/generate-screens.js";
const tier = TIERS[2];
for(let i=0;i<4000;i++){
  const rnd = mulberry32((i*2246822519)>>>0);
  const raw = randomCandidate(tier, rnd);
  if(!raw || !solve(raw).solvable) continue;
  const p = pruneRedundant(raw);
  if(!p) continue;
  const f = ensureElements(p, tier, rnd);
  if(!f) continue;
  const T = solve(f).length!;
  // distancia manhattan
  const md = Math.abs(f.exit%8-f.player%8)+Math.abs(Math.floor(f.exit/8)-Math.floor(f.player/8));
  const emp = (()=>{ // bfs vacío
    const seen=new Set([f.player]);const q=[[f.player,0]];
    while(q.length){const [k,d]=q.shift();if(k===f.exit)return d;
      for(const dd of [1,-1,8,-8]){const nk=k+dd;const c=k%8;
        if(nk<0||nk>=48)continue;if(dd===1&&c===7)continue;if(dd===-1&&c===0)continue;
        if(!seen.has(nk)){seen.add(nk);q.push([nk,d+1]);}}}
    return -1;})();
  if(T===emp){
    console.log(`T=${T} emp=${emp} enem=${f.enemies.length} obs=${f.obstacles.size} traps=${f.traps.size}`);
    console.log(`  pruned era: enem=${p.enemies.length} obs=${p.obstacles.size} traps=${p.traps.size} opt=${solve(p).length}`);
    for(let rr=0;rr<6;rr++){let l="";for(let c=0;c<8;c++){const k2=rr*8+c;l+=f.obstacles.has(k2)?"X":f.traps.has(k2)?"T":f.exit===k2?"G":f.player===k2?"P":f.enemies.includes(k2)?"E":".";}console.log("   "+l);}
    break;
  }
}
console.log("fin");
