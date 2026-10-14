// Fusiona las partes .tmp_chk/t15-part-*.json en db/screens-tier-15.json,
// reindexando ids l15-s1..s5000 y verificando el contrato del tier.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const parts = readdirSync(".tmp_chk")
  .filter((f) => /^t15-part-\d+\.json$/.test(f))
  .sort();
const all: any[] = [];
for (const p of parts) all.push(...JSON.parse(readFileSync(`.tmp_chk/${p}`, "utf-8")));
console.log(`partes: ${parts.length}, total: ${all.length}`);

const screens = all.slice(0, 5000);
screens.forEach((s, i) => { s.id = `l15-s${i + 1}`; s.level = 15; });

// Verificación del contrato del tier 15
const bad = screens.filter(
  (s) =>
    s.level !== 15 ||
    s.enemies.length !== 2 ||
    s.obstacles.length < 5 || s.obstacles.length > 7 ||
    s.traps.length < 4 || s.traps.length > 5 ||
    s.minMoves < 16 || s.minMoves > 24
);
const ids = new Set(screens.map((s) => s.id));
console.log(`verificación: ${bad.length} fuera de contrato, ids únicos: ${ids.size}/${screens.length}`);
if (bad.length) console.log("ejemplo malo:", JSON.stringify(bad[0]));

writeFileSync("db/screens-tier-15.json", JSON.stringify(screens));
console.log(`escrito db/screens-tier-15.json con ${screens.length} pantallas`);
