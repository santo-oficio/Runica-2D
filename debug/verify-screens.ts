/**
 * Verificación cruzada: compara el solver del generador contra el motor
 * real (solver/checklist.ts solveLevel) sobre una muestra de pantallas.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { solveLevel } from "../solver/checklist.js";
import type { LevelMap, EnemyPattern } from "../schemas/types.js";

interface Screen {
  id: string;
  level: number;
  grid: string[];
  player: [number, number];
  goal: [number, number];
  enemies: { pos: [number, number]; pattern: string }[];
  obstacles: [number, number][];
  traps: [number, number][];
  minMoves: number;
}

const data = JSON.parse(readFileSync(join(process.cwd(), "db", "screens.json"), "utf-8")) as Screen[];

const MAP: Record<string, EnemyPattern> = {
  CHASE: "PERSECUCION_SIMPLE",
  VIGILANCIA: "VIGILANCIA_ZONA",
};

function toLevelMap(s: Screen): LevelMap {
  return {
    levelId: s.level,
    seed: 1,
    world: "AGUA",
    backgroundTemplateId: "agua-bg-01",
    archetype: "RECTANGULO",
    width: 6,
    height: 6,
    grid: s.grid,
    player: s.player,
    goal: s.goal,
    enemies: s.enemies.map((e) => ({ pos: e.pos, pattern: MAP[e.pattern]! })),
    keys: [],
    doors: [],
    rulesetVersion: "wappo-v1",
  };
}

let mismatches = 0;
let checked = 0;
// Muestreo aleatorio determinista: 200 pantallas repartidas por todos los niveles
const sample: number[] = [];
const rng = mulberry(42);
for (let i = 0; i < 200; i++) {
  sample.push(Math.floor(rng() * data.length));
}

for (const idx of sample) {
  const s = data[idx]!;
  const lvl = toLevelMap(s);
  const res = solveLevel(lvl);
  checked++;
  if (!res.solvable) {
    console.log(`MISMATCH ${s.id} (level ${s.level}): generador dice ${s.minMoves}, motor dice NO resoluble`);
    mismatches++;
  } else if (res.minMoves !== s.minMoves) {
    console.log(`MISMATCH ${s.id} (level ${s.level}): generador=${s.minMoves} motor=${res.minMoves}`);
    mismatches++;
  }
}

console.log(`\n${mismatches} discrepancias en ${checked} muestras`);

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
