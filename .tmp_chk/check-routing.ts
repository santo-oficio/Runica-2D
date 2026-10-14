import { mapTierFor, getLevelScreen, FINAL_TIER } from "../db/db.js";
console.log("MAZMORRA:11 →", mapTierFor("MAZMORRA", 11), "(esperado 15)");
console.log("MAZMORRA:10 →", mapTierFor("MAZMORRA", 10), "(curva, <15)");
console.log("AGUA:11    →", mapTierFor("AGUA", 11), "(curva, <15)");
console.log("FUEGO:0    →", mapTierFor("FUEGO", 0), "(curva, <15)");
const { screen, tier } = getLevelScreen("MAZMORRA", 11);
console.log(`getLevelScreen(MAZMORRA,11) → tier=${tier} id=${screen.id} enemigos=${screen.enemies.length} minMoves=${screen.minMoves}`);
