import { TIERS, generateTierBatch } from "../generator/generate-screens.js";
const list = (process.argv[2] || "2,3,7,10,13").split(",").map(Number);
const N = Number(process.argv[3] || 3000);
for (const t of list) {
  const tier = TIERS.find((x) => x.level === t)!;
  const t0 = Date.now();
  const { screens, stats } = generateTierBatch(tier, 10_000, t * 123_457, N);
  const ms = Date.now() - t0;
  const rate = ((stats.accepted / stats.attempts) * 100).toFixed(2);
  console.log(`tier ${t}: ${stats.accepted}/${stats.attempts} (${rate}%) en ${(ms / 1000).toFixed(1)}s → ${(ms / Math.max(1, stats.accepted)).toFixed(0)}ms/pantalla`);
  const rs = Object.entries(stats.reasons).sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log(`   descartes: ${rs.map(([k, v]) => `${k}=${v}`).join(" ")}`);
  console.log(`   par: ${JSON.stringify(stats.parHistogram)}  uso: ${JSON.stringify(stats.useHistogram)}`);
}
