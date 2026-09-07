/**
 * Ejemplos canónicos de cada esquema, basados en docs/06-ESQUEMAS-JSON.md y
 * docs/10-ANALIZADOR-IA-FONDOS.md. Se usan en los tests de parseo de la
 * Fase 0 y como datos semilla en fases posteriores.
 */

import type {
  BackgroundTemplate,
  BackgroundTemplateCandidate,
  LevelBank,
  LevelMap,
  ValidationResult,
  WorldConfig,
} from "./types.js";

// 1. BackgroundTemplate (doc 06 §1)
export const backgroundTemplateExample: BackgroundTemplate = {
  id: "SPACE_01",
  world: "ESPACIO",
  image: "assets/backgrounds/ESPACIO/bg_01.jpg",
  safeArea: { x: 0.0, y: 0.0, width: 1.0, height: 1.0 },
  boardArea: { x: 0.25, y: 0.28, width: 0.5, height: 0.48 },
  marginPx: 3,
  allowedCellSizes: [48, 56, 64, 72, 80],
  anchorPoints: {
    frameTopLeft: { x: 0.2, y: 0.22 },
    hud: { x: 0.02, y: 0.02 },
  },
  decorativeAreas: [
    { x: 0.0, y: 0.0, width: 0.25, height: 1.0, extendable: true },
    { x: 0.75, y: 0.0, width: 0.25, height: 1.0, extendable: true },
  ],
};

// 1b. BackgroundTemplateCandidate (doc 10 §3) — salida del analizador IA
export const backgroundTemplateCandidateExample: BackgroundTemplateCandidate = {
  ...backgroundTemplateExample,
  suggestedGrid: { columns: 8, columnsRange: [6, 10], rows: 6, rowsRange: [5, 8] },
  confidence: 0.83,
  notes: "El área central despejada corresponde al tablero; la nave superior es zona protegida.",
};

// 2. LevelMap (doc 06 §2)
export const levelMapExample: LevelMap = {
  levelId: 48321,
  seed: 839271,
  world: "ESPACIO",
  backgroundTemplateId: "SPACE_01",
  archetype: "IRREGULAR",
  width: 12,
  height: 10,
  grid: [
    "############",
    "#..#.......#",
    "#..#..####.#",
    "#.....#....#",
    "###...#..E.#",
    "#.....#....#",
    "#..P.......#",
    "#..........#",
    "#....G.....#",
    "############",
  ],
  player: [3, 6],
  enemies: [{ pos: [9, 4], pattern: "PERSECUCION_SIMPLE" }],
  goal: [5, 8],
  keys: [],
  doors: [],
  rulesetVersion: "1.0.0",
};

// 3. ValidationResult (doc 06 §3)
export const validationResultExample: ValidationResult = {
  levelId: 48321,
  valid: true,
  checks: {
    withinBoardArea: true,
    gridAligned: true,
    noDecorationOverlap: true,
    tilingResolved: true,
    entitiesFit: true,
    noImpossiblePositions: true,
    solvable: true,
    difficultyInRange: true,
    notTrivial: true,
    noAbsurdSituations: true,
  },
  solution: {
    minMoves: 23,
    path: "solo longitud/metadata, no se guarda el path completo si no hace falta",
  },
  difficultyScore: 7.2,
  rejectionReason: null,
};

// 4. WorldConfig (doc 06 §4)
export const worldConfigExample: WorldConfig = {
  world: "ESPACIO",
  backgroundTemplates: ["SPACE_01", "SPACE_02", "SPACE_03"],
  tileAssets: {
    floor: "space_floor.png",
    wallEdgeTop: "space_wall_top.png",
    wallCornerTopLeft: "space_wall_corner_tl.png",
    player: "space_player.png",
    enemyDefault: "space_enemy.png",
    goal: "space_goal.png",
  },
  allowedBoardSizes: [[6, 5], [7, 6], [8, 6], [8, 8]],
  difficultyTable: [
    { range: [1, 10], stars: 1, maxEnemies: 1 },
    { range: [11, 25], stars: 2, maxEnemies: 1 },
    { range: [26, 50], stars: 3, maxEnemies: 2 },
    { range: [51, 100], stars: 4, maxEnemies: 3 },
    { range: [101, 200], stars: 5, maxEnemies: 4 },
  ],
};

// 5. LevelBank (doc 06 §5)
export const levelBankExample: LevelBank = {
  world: "ESPACIO",
  levels: [
    { levelId: 48321, seed: 839271, difficultyScore: 7.2, minMoves: 23 },
    { levelId: 48322, seed: 839274, difficultyScore: 3.1, minMoves: 9 },
  ],
};
