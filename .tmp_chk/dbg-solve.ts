import { TIERS, solve } from "../generator/generate-screens.js";
// acceso interno a randomCandidate no exportado: replico mediante generateLevel stats?
// mejor: probar solve() sobre un nivel de la bbdd vieja
import { readFileSync } from "node:fs";
const old = JSON.parse(readFileSync("db/screens-tier-3.json","utf-8"))[0];
console.log("old screen:", old.id, "minMoves", old.minMoves);
const lv = { obstacles:new Set(old.obstacles.map(([c,r]:number[])=>r*8+c)), traps:new Set(old.traps.map(([c,r]:number[])=>r*8+c)), exit:old.goal[1]*8+old.goal[0], player:old.player[1]*8+old.player[0], enemies:old.enemies.map((e:any)=>e.pos[1]*8+e.pos[0]) };
console.log("solve(old):", solve(lv));
