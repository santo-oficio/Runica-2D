/** Verifica que el banco generado coincide con el motor real (source of truth). */
import { readFileSync } from "node:fs";
import { solveLevel } from "../solver/checklist.js";
import type { LevelMap } from "../schemas/types.js";

type Screen = {
  id: string;
  level: number;
  world: string;
  grid: string[];
  player: [number, number];
  goal: [number, number];
  enemies: { pos: [number, number]; pattern: string }[];
  minMoves: number;
};

const screens = JSON.parse(readFileSync("db/screens.json", "utf-8")) as Screen[];

function toLevelMap(s: Screen): LevelMap {
  return {
    levelId: s.level * 1000 + Number(s.id.split("-")[1]?.slice(1) ?? 0),
    seed: 1,
    world: s.world,
    backgroundTemplateId: "agua-bg-01",
    archetype: "RECTANGULO",
    width: 8,
    height: 6,
    grid: s.grid,
    player: s.player,
    goal: s.goal,
    enemies: s.enemies.map((e) => ({
      pos: e.pos,
      pattern: e.pattern === "CHASE" ? "PERSECUCION_SIMPLE" : "VIGILANCIA_ZONA",
    })),
    keys: [],
    doors: [],
    rulesetVersion: "wappo-v1",
  };
}

// Muestrear ~8 por nivel (112 en total)
let mismatches = 0;
let checked = 0;
for (let level = 1; level <= 14; level++) {
  const pool = screens.filter((s) => s.level === level);
  const step = Math.max(1, Math.floor(pool.length / 8));
  for (let i = 0; i < pool.length; i += step) {
    const s = pool[i]!;
    const result = solveLevel(toLevelMap(s), { maxDepth: 80, maxStates: 300_000 });
    checked++;
    if (!result.solvable) {
      console.log(`NO RESOLUBLE (motor): ${s.id} minMoves=${s.minMoves}`);
      mismatches++;
    } else if (result.minMoves !== s.minMoves) {
      console.log(`DISCREPANCIA: ${s.id} generador=${s.minMoves} motor=${result.minMoves}`);
      mismatches++;
    }
  }
}
console.log(`\n${checked} pantallas verificadas, ${mismatches} discrepancias.`);
