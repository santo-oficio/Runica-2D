/**
 * Verificador de bancos generados (db/screens-tier-N.json).
 *
 * Comprueba por cada pantalla:
 *  - REGLA A FUEGO #1: |col(player) − col(exit)| ≥ MIN_PLAYER_EXIT_COLDIST
 *  - conteos de enemigos/obstáculos/trampas dentro del rango del tier
 *  - par (minMoves) dentro del rango minSolutionLen del tier
 *  - par − trueMin ∈ {1, 2}
 *  - ids consistentes con el tier del banco
 * Y por muestreo (--sample=N, por defecto 200/banco):
 *  - resolubilidad real con el solver BFS
 *  - REGLA A FUEGO #2: existe ruta limpia ≤ par con ≤ MAX_PATH_REVISITS
 *    casillas revisitadas (sin "adelante y atrás" para esquivar)
 *
 * Uso: npx tsx tools/verify-banks.ts [--sample=N] [--all]
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TIERS,
  screenToLevelData,
  solve,
  findCleanSolution,
  MIN_PLAYER_EXIT_COLDIST,
  MAX_PATH_REVISITS,
  type Screen,
} from "../generator/generate-screens.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BANK_DIR = process.env.RUNIKA_BANK_DIR ?? join(ROOT, "db");

const argVal = (name: string) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=")[1]! : null;
};
const SAMPLE = argVal("sample") ? Number(argVal("sample")) : process.argv.includes("--all") ? Infinity : 200;

const col = (k: number) => k % 8;

function main() {
  const files = readdirSync(BANK_DIR)
    .filter((f) => /^screens-tier-\d+\.json$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));

  if (files.length === 0) {
    console.log("No hay bancos en", BANK_DIR);
    process.exit(1);
  }

  let totalOk = true;
  let grand = 0;

  for (const file of files) {
    const tierLevel = Number(file.match(/\d+/)![0]);
    const tier = TIERS.find((t) => t.level === tierLevel);
    const screens = JSON.parse(readFileSync(join(BANK_DIR, file), "utf-8")) as Screen[];
    grand += screens.length;
    const problems: string[] = [];
    const parHist: Record<string, number> = {};

    if (!tier) problems.push(`tier ${tierLevel} sin definición en TIERS`);
    for (const s of screens) {
      const d = screenToLevelData(s);
      const gap = Math.abs(col(d.player) - col(d.exit));
      if (gap < MIN_PLAYER_EXIT_COLDIST) {
        problems.push(`${s.id}: gap ${gap} < ${MIN_PLAYER_EXIT_COLDIST}`);
      }
      if (!s.id.startsWith(`l${tierLevel}-`)) problems.push(`${s.id}: id no casa con tier ${tierLevel}`);
      if (tier) {
        if (d.enemies.length !== tier.numEnemies) {
          problems.push(`${s.id}: ${d.enemies.length} enemigos ≠ ${tier.numEnemies}`);
        }
        if (d.obstacles.size < tier.numObstacles[0] || d.obstacles.size > tier.numObstacles[1]) {
          problems.push(`${s.id}: ${d.obstacles.size} obstáculos fuera de ${tier.numObstacles}`);
        }
        if (d.traps.size < tier.numTraps[0] || d.traps.size > tier.numTraps[1]) {
          problems.push(`${s.id}: ${d.traps.size} trampas fuera de ${tier.numTraps}`);
        }
        if (s.minMoves < tier.minSolutionLen[0] || s.minMoves > tier.minSolutionLen[1]) {
          problems.push(`${s.id}: par ${s.minMoves} fuera de ${tier.minSolutionLen}`);
        }
      }
      parHist[String(s.minMoves)] = (parHist[String(s.minMoves)] ?? 0) + 1;
    }

    // Muestreo de resolubilidad (determinista: primeras N tras barajar por hash del índice)
    const n = Math.min(SAMPLE, screens.length);
    let solved = 0;
    for (let i = 0; i < n; i++) {
      const s = screens[Math.floor((i * screens.length) / n)]!;
      const d = screenToLevelData(s);
      const res = solve(d);
      if (!res.solvable || !res.length) {
        problems.push(`${s.id}: insoluble en muestreo`);
      } else {
        solved++;
        const slack = s.minMoves - res.length;
        if (slack < 1 || slack > 2) problems.push(`${s.id}: par−trueMin = ${slack} (esperado 1-2)`);
      }
      if (!findCleanSolution(d, s.minMoves)) {
        problems.push(`${s.id}: sin ruta limpia ≤ par (>${MAX_PATH_REVISITS} revisitas)`);
      }
    }

    const badge = problems.length === 0 ? "OK " : "FAIL";
    const pars = Object.keys(parHist).map(Number).sort((a, b) => a - b);
    console.log(
      `${badge} ${file}: ${screens.length} pantallas · par ${pars[0]}–${pars[pars.length - 1]} · muestreo resoluble ${solved}/${n}`,
    );
    if (problems.length) {
      totalOk = false;
      for (const p of problems.slice(0, 15)) console.log(`     ✗ ${p}`);
      if (problems.length > 15) console.log(`     … y ${problems.length - 15} problemas más`);
    }
  }

  console.log(`\nTotal: ${grand} pantallas en ${files.length} bancos — ${totalOk ? "TODO CORRECTO" : "HAY PROBLEMAS"}`);
  process.exit(totalOk ? 0 : 1);
}

main();
