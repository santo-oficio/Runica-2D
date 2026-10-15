import { mulberry32, solve, TIERS } from "../generator/generate-screens.js";
const tier = TIERS[2];
const lv = { obstacles:new Set<number>([2,11]), traps:new Set<number>(), exit:1*8+4, player:0, enemies:[] };
const base = solve(lv).length!;
console.log("base opt:", base);
let changed=0, same=0, uns=0;
const good=[];
for(let k=0;k<48;k++){
  if(lv.obstacles.has(k)||k===lv.player||k===lv.exit) continue;
  const d=Math.abs(k%8-lv.player%8)+Math.abs(Math.floor(k/8)-Math.floor(lv.player/8));
  if(d<tier.minEnemyPlayerDist) continue;
  const t={...lv,enemies:[k]};
  const r=solve(t);
  if(!r.solvable) uns++;
  else if(r.length!==base){changed++;good.push([k,r.length]);}
  else same++;
}
console.log({changed,same,uns});
console.log("cells cambiando opt:", good.slice(0,20));
