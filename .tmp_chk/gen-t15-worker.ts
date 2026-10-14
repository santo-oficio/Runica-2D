// Worker paralelo para generar parte del banco del tier 15.
// Uso: npx tsx .tmp_chk/gen-t15-worker.ts <workerId> <count>
// Seeds: 15_000_000 + workerId*500_000 + intento (ventanas disjuntas por worker).
import { writeFileSync } from "node:fs";
import { TIERS, generateLevel, levelToScreen } from "../generator/generate-screens.js";

const workerId = Number(process.argv[2]);
const count = Number(process.argv[3]);
const tier = TIERS.find((t) => t.level === 15)!;
const base = tier.level * 1_000_000 + workerId * 500_000;

const screens = [];
let accepted = 0;
let attempts = 0;
const t0 = Date.now();
while (accepted < count) {
  attempts++;
  const r = generateLevel(tier, base + attempts);
  if (!r) continue;
  accepted++;
  screens.push(levelToScreen(r.lv, tier.level, accepted, r.length));
  if (accepted % 100 === 0) {
    console.log(`w${workerId}: ${accepted}/${count} (${((Date.now() - t0) / 1000).toFixed(0)}s, ${attempts} intentos)`);
  }
}
writeFileSync(`.tmp_chk/t15-part-${workerId}.json`, JSON.stringify(screens));
console.log(`w${workerId}: DONE ${accepted} en ${((Date.now() - t0) / 1000).toFixed(0)}s`);
