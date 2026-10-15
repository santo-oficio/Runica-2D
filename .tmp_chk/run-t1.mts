import { TIERS, generateTier1Exhaustive } from "../generator/generate-screens.js";
const r = generateTier1Exhaustive(TIERS[0]!);
console.log("aceptadas:", r.screens.length, "intentos:", r.stats.attempts, "dupes:", r.stats.duplicates, "tiempo:", (r.stats.elapsedMs / 1000).toFixed(1) + "s");
console.log("par:", JSON.stringify(r.stats.parHistogram));
console.log("descartes:", JSON.stringify(r.stats.reasons));
