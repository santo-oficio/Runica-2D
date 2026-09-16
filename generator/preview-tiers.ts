/**
 * Genera 14 niveles representativos (uno por tier) y los renderiza en ASCII
 * para revisar visualmente la curva de dificultad antes de la generación masiva.
 *
 * Uso: npx tsx generator/preview-tiers.ts
 */

import { TIERS, generateLevel, type LevelData } from "./generate-screens.js";

const W = 8;
const H = 6;

function renderAscii(lv: LevelData): string {
  const lines: string[] = [];
  for (let r = 0; r < H; r++) {
    let line = "";
    for (let c = 0; c < W; c++) {
      const k = r * W + c;
      if (lv.player === k) line += "P";
      else if (lv.exit === k) line += "G";
      else if (lv.enemies.includes(k)) line += "E";
      else if (lv.obstacles.has(k)) line += "X";
      else if (lv.traps.has(k)) line += "T";
      else line += ".";
    }
    lines.push(line.split("").join(" "));
  }
  return lines.join("\n");
}

function main() {
  console.log("═".repeat(60));
  console.log("  RUNIKKA — 14 niveles representativos (uno por tier)");
  console.log("═".repeat(60));
  console.log();

  const results: { tier: number; len: number; enemies: number; obstacles: number; traps: number }[] = [];

  for (const tier of TIERS) {
    // Probar varias seeds para encontrar un buen representante
    let best: { lv: LevelData; length: number } | null = null;
    for (let attempt = 1; attempt <= 50; attempt++) {
      const seed = tier.level * 10_000 + attempt;
      const result = generateLevel(tier, seed, 500);
      if (result !== null) {
        // Preferir niveles con longitud cercana al centro del rango
        const center = (tier.minSolutionLen[0] + tier.minSolutionLen[1]) / 2;
        if (best === null || Math.abs(result.length - center) < Math.abs(best.length - center)) {
          best = result;
        }
      }
    }

    if (best === null) {
      console.log(`❌ Tier ${tier.level}: no se pudo generar ningún nivel`);
      continue;
    }

    const { lv, length } = best;
    const nEnemies = lv.enemies.length;
    const nObstacles = lv.obstacles.size;
    const nTraps = lv.traps.size;

    results.push({ tier: tier.level, len: length, enemies: nEnemies, obstacles: nObstacles, traps: nTraps });

    console.log(`┌─ Tier ${String(tier.level).padStart(2, " ")} ────────────────────────────────────────┐`);
    console.log(`│  Solución: ${length} movimientos  │  Enemigos: ${nEnemies}  │  Obstáculos: ${nObstacles}  │  Trampas: ${nTraps}  │`);
    console.log(`│                                                            │`);
    for (const line of renderAscii(lv).split("\n")) {
      console.log(`│  ${line}  │`);
    }
    console.log(`└────────────────────────────────────────────────────────────┘`);
    console.log();
  }

  // Tabla resumen
  console.log("═".repeat(60));
  console.log("  TABLA RESUMEN");
  console.log("═".repeat(60));
  console.log();
  console.log("  Tier  Sol.  Enem.  Obs.  Trampas  Rango esperado");
  console.log("  ────  ────  ─────  ───  ───────  ──────────────");
  for (const r of results) {
    const tier = TIERS[r.tier - 1]!;
    console.log(
      `  ${String(r.tier).padStart(3, " ")}   ${String(r.len).padStart(3, " ")}   ${r.enemies}      ${r.obstacles}    ${r.traps}        ${tier.minSolutionLen[0]}-${tier.minSolutionLen[1]}`,
    );
  }
  console.log();

  // Verificar monotonía
  let monotono = true;
  for (let i = 1; i < results.length; i++) {
    if (results[i]!.len < results[i - 1]!.len) {
      monotono = false;
      console.log(`  ⚠️  Tier ${results[i]!.tier} tiene solución más corta (${results[i]!.len}) que tier ${results[i - 1]!.tier} (${results[i - 1]!.len})`);
    }
  }
  if (monotono) {
    console.log("  ✅ Longitud de solución monótona creciente");
  }
  console.log();
}

main();
