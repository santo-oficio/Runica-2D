import { TIERS, mulberry32, solve, solvePath, ensureMinObstacles } from "../generator/generate-screens.js";
const tier = TIERS[2]; // obs min1 max2
const lv = { obstacles:new Set<number>(), traps:new Set<number>(), exit:1*8+4, player:0, enemies:[] };
const r = ensureMinObstacles(lv, tier, mulberry32(42));
console.log("obstacles after fill:", r ? [...r.obstacles] : null);
if(r) console.log("new opt:", solve(r).length);
