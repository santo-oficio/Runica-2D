/**
 * WorldConfigs completos (docs/07-MUNDOS-TEMATICAS.md).
 *
 * Cada mundo se define por datos (WorldConfig + BackgroundTemplates),
 * no por código. Añadir un mundo nuevo = añadir datos aquí, sin tocar
 * el generador, solver o motor de reglas.
 */

import type { BackgroundTemplate, WorldConfig } from "../schemas/types.js";

// ---------------------------------------------------------------------------
// ESPACIO — mundo tutorial/inicial
// ---------------------------------------------------------------------------

export const SPACE_BACKGROUND_01: BackgroundTemplate = {
  id: "SPACE_01",
  world: "ESPACIO",
  image: "assets/backgrounds/ESPACIO/bg_01.webp",
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

export const SPACE_BACKGROUND_02: BackgroundTemplate = {
  id: "SPACE_02",
  world: "ESPACIO",
  image: "assets/backgrounds/ESPACIO/bg_01.webp",
  safeArea: { x: 0.0, y: 0.0, width: 1.0, height: 1.0 },
  boardArea: { x: 0.2, y: 0.25, width: 0.6, height: 0.55 },
  marginPx: 4,
  allowedCellSizes: [48, 56, 64, 72],
  anchorPoints: {
    frameTopLeft: { x: 0.18, y: 0.2 },
    hud: { x: 0.02, y: 0.02 },
  },
  decorativeAreas: [
    { x: 0.0, y: 0.0, width: 0.2, height: 1.0, extendable: true },
    { x: 0.8, y: 0.0, width: 0.2, height: 1.0, extendable: true },
  ],
};

export const SPACE_WORLD: WorldConfig = {
  world: "ESPACIO",
  backgroundTemplates: ["SPACE_01", "SPACE_02", "SPACE_03"],
  tileAssets: {
    floor: "space_floor.webp",
    wallEdgeTop: "space_wall_top.webp",
    wallCornerTopLeft: "space_wall_corner_tl.webp",
    wallCornerTopRight: "space_wall_corner_tr.webp",
    wallCornerBottomLeft: "space_wall_corner_bl.webp",
    wallCornerBottomRight: "space_wall_corner_br.webp",
    wallEdgeBottom: "space_wall_bottom.webp",
    wallEdgeLeft: "space_wall_left.webp",
    wallEdgeRight: "space_wall_right.webp",
    player: "space_player.webp",
    enemyDefault: "space_enemy.webp",
    enemyPatrol: "space_enemy_patrol.webp",
    enemyChase: "space_enemy_chase.webp",
    enemyRandom: "space_enemy_random.webp",
    enemyVigilance: "space_enemy_vigilance.webp",
    goal: "space_goal.webp",
    key: "space_key.webp",
    door: "space_door.webp",
    obstacle: "space_obstacle.webp",
  },
  allowedBoardSizes: [[8, 6]],
  difficultyTable: [
    { range: [1, 10], stars: 1, maxEnemies: 1 },
    { range: [11, 25], stars: 2, maxEnemies: 1 },
    { range: [26, 50], stars: 3, maxEnemies: 2 },
    { range: [51, 100], stars: 4, maxEnemies: 3 },
    { range: [101, 200], stars: 5, maxEnemies: 4 },
  ],
};

export const SPACE_BACKGROUNDS: readonly BackgroundTemplate[] = [
  SPACE_BACKGROUND_01,
  SPACE_BACKGROUND_02,
];

// ---------------------------------------------------------------------------
// FUEGO — mundo avanzado (ejemplo de que añadir mundo = solo datos)
// ---------------------------------------------------------------------------

export const FIRE_BACKGROUND_01: BackgroundTemplate = {
  id: "FIRE_01",
  world: "FUEGO",
  image: "assets/backgrounds/FUEGO/bg_01.webp",
  safeArea: { x: 0.0, y: 0.0, width: 1.0, height: 1.0 },
  boardArea: { x: 0.22, y: 0.3, width: 0.56, height: 0.5 },
  marginPx: 4,
  allowedCellSizes: [48, 56, 64, 72],
  anchorPoints: {
    frameTopLeft: { x: 0.2, y: 0.25 },
    hud: { x: 0.02, y: 0.02 },
  },
  decorativeAreas: [
    { x: 0.0, y: 0.0, width: 0.22, height: 1.0, extendable: true },
    { x: 0.78, y: 0.0, width: 0.22, height: 1.0, extendable: true },
  ],
};

export const FIRE_WORLD: WorldConfig = {
  world: "FUEGO",
  backgroundTemplates: ["FIRE_01", "FIRE_02"],
  tileAssets: {
    floor: "fire_floor.webp",
    wallEdgeTop: "fire_wall_top.webp",
    wallCornerTopLeft: "fire_wall_corner_tl.webp",
    wallCornerTopRight: "fire_wall_corner_tr.webp",
    wallCornerBottomLeft: "fire_wall_corner_bl.webp",
    wallCornerBottomRight: "fire_wall_corner_br.webp",
    wallEdgeBottom: "fire_wall_bottom.webp",
    wallEdgeLeft: "fire_wall_left.webp",
    wallEdgeRight: "fire_wall_right.webp",
    player: "fire_player.webp",
    enemyDefault: "fire_enemy.webp",
    enemyPatrol: "fire_enemy_patrol.webp",
    enemyChase: "fire_enemy_chase.webp",
    enemyRandom: "fire_enemy_random.webp",
    enemyVigilance: "fire_enemy_vigilance.webp",
    goal: "fire_goal.webp",
    key: "fire_key.webp",
    door: "fire_door.webp",
    obstacle: "fire_obstacle.webp",
  },
  allowedBoardSizes: [[8, 6]],
  difficultyTable: [
    { range: [1, 10], stars: 2, maxEnemies: 1 }, // FUEGO empieza más difícil
    { range: [11, 25], stars: 3, maxEnemies: 2 },
    { range: [26, 50], stars: 4, maxEnemies: 3 },
    { range: [51, 100], stars: 5, maxEnemies: 4 },
    { range: [101, 200], stars: 5, maxEnemies: 4 },
  ],
};

export const FIRE_BACKGROUNDS: readonly BackgroundTemplate[] = [
  FIRE_BACKGROUND_01,
];

// ---------------------------------------------------------------------------
// Registro de mundos (para carga dinámica por nombre)
// ---------------------------------------------------------------------------

export const WORLD_REGISTRY: Record<string, {
  config: WorldConfig;
  backgrounds: readonly BackgroundTemplate[];
}> = {
  ESPACIO: { config: SPACE_WORLD, backgrounds: SPACE_BACKGROUNDS },
  FUEGO: { config: FIRE_WORLD, backgrounds: FIRE_BACKGROUNDS },
};

export function getWorld(name: string): { config: WorldConfig; backgrounds: readonly BackgroundTemplate[] } | null {
  return WORLD_REGISTRY[name] ?? null;
}
