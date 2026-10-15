import { mulberry32, solve, solvePath, ensureMinObstacles, TIERS } from "../generator/generate-screens.js";
// Caso: tablero vacío, P(0,0) G(4,1), sin enemigos
const lv = { obstacles:new Set<number>(), traps:new Set<number>(), exit:1*8+4, player:0, enemies:[] };
console.log("solve:", solve(lv));
const r = ensureMinObstacles(lv, TIERS[2], mulberry32(42));
console.log("result:", r ? [...r.obstacles] : null);
