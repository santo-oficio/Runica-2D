/**
 * Asset Resolver / Auto-tiling (docs/02-MOTOR-GRAFICO.md §5).
 *
 * Dado un `LevelMap` ya validado y un `WorldConfig`, produce la lista de
 * sprites a dibujar por celda según sus vecinos (arriba, abajo, izquierda,
 * derecha; diagonales si aplica para esquinas).
 *
 * Cada mundo tiene su propio set de assets (suelo, bordes, esquinas, marco,
 * jugador, enemigos, objetivo) pero comparten la misma lógica de
 * auto-tiling. Cambiar de temática es solo cambiar el "diccionario de
 * sprites", no la lógica.
 *
 * La celda se clasifica por:
 *  - su tipo (pared `#`, suelo `.`, jugador `P`, enemigo `E`, objetivo `G`,
 *    obstáculo `X`, puerta `D`, llave `K`)
 *  - la máscara de vecinos transitables/no-transitables (4-vecinos + 4
 *    diagonales) para elegir el sprite de borde/esquina adecuado.
 */

import type { LevelMap, WorldConfig } from "../schemas/types.js";

// ---------------------------------------------------------------------------
// Tipos de celda del mapa lógico (doc 05 §1)
// ---------------------------------------------------------------------------

export type CellType =
  | "WALL"
  | "FLOOR"
  | "PLAYER"
  | "ENEMY"
  | "OBSTACLE"
  | "GOAL"
  | "DOOR"
  | "KEY"
  | "EMPTY";

export const CHAR_TO_CELL: Record<string, CellType> = {
  "#": "WALL",
  ".": "FLOOR",
  P: "PLAYER",
  E: "ENEMY",
  X: "OBSTACLE",
  G: "GOAL",
  D: "DOOR",
  K: "KEY",
};

/** true si la celda es transitable (suelo o entidad), false si pared/vacío. */
export function isWalkable(cell: CellType): boolean {
  return cell !== "WALL" && cell !== "EMPTY";
}

// ---------------------------------------------------------------------------
// Máscara de vecinos (8-vecinos)
// ---------------------------------------------------------------------------

/**
 * Máscara de 8 bits para los 8 vecinos de una celda, en orden:
 *   bit 0: N (arriba),     bit 1: NE,  bit 2: E (derecha),  bit 3: SE,
 *   bit 4: S (abajo),      bit 5: SW,  bit 6: W (izquierda),bit 7: NW
 * Un bit a 1 significa que ese vecino es NO-transitable (pared/vacío).
 */
export interface NeighborMask {
  readonly N: boolean;
  readonly NE: boolean;
  readonly E: boolean;
  readonly SE: boolean;
  readonly S: boolean;
  readonly SW: boolean;
  readonly W: boolean;
  readonly NW: boolean;
}

/**
 * Calcula la máscara de vecinos no-transitables para una celda (col, row).
 * Los bordes del tablero se consideran no-transitables (pared implícita).
 */
export function computeNeighborMask(grid: readonly string[], col: number, row: number): NeighborMask {
  const at = (c: number, r: number): boolean => {
    if (r < 0 || r >= grid.length || c < 0 || c >= (grid[r]?.length ?? 0)) return true;
    const ch = grid[r]![c]!;
    const cell = CHAR_TO_CELL[ch] ?? "EMPTY";
    return !isWalkable(cell);
  };
  return {
    N: at(col, row - 1),
    NE: at(col + 1, row - 1),
    E: at(col + 1, row),
    SE: at(col + 1, row + 1),
    S: at(col, row + 1),
    SW: at(col - 1, row + 1),
    W: at(col - 1, row),
    NW: at(col - 1, row - 1),
  };
}

// ---------------------------------------------------------------------------
// Clasificación del sprite de suelo por vecinos (auto-tiling)
// ---------------------------------------------------------------------------

/**
 * Categoría de sprite de suelo/borde según vecinos 4-adyacentes.
 * Las esquinas se refinan con diagonales.
 */
export type FloorSpriteCategory =
  | "floor_interior"
  | "floor_edge_top"
  | "floor_edge_bottom"
  | "floor_edge_left"
  | "floor_edge_right"
  | "floor_corner_top_left"
  | "floor_corner_top_right"
  | "floor_corner_bottom_left"
  | "floor_corner_bottom_right"
  | "floor_peninsula"
  | "floor_isolated";

/**
 * Clasifica el sprite de suelo de una celda FLOOR según su máscara de
 * vecinos. Lógica de auto-tiling básica de 4-vecinos + 4-diagonales para
 * esquinas.
 */
export function classifyFloorSprite(mask: NeighborMask): FloorSpriteCategory {
  const blocked = mask.N ? 1 : 0;
  const blockedS = mask.S ? 1 : 0;
  const blockedE = mask.E ? 1 : 0;
  const blockedW = mask.W ? 1 : 0;
  const count = blocked + blockedS + blockedE + blockedW;

  if (count === 0) return "floor_interior";
  if (count >= 3) return count === 4 ? "floor_isolated" : "floor_peninsula";

  if (count === 1) {
    if (mask.N) return "floor_edge_top";
    if (mask.S) return "floor_edge_bottom";
    if (mask.E) return "floor_edge_right";
    return "floor_edge_left";
  }

  // count === 2: esquina (dos lados adyacentes bloqueados) o pasillo (opuestos)
  const horiz = blockedE + blockedW;
  const vert = blocked + blockedS;
  if (horiz === 2 || vert === 2) {
    // pasillo: dos lados opuestos bloqueados → tratar como interior con bordes
    // (no hay sprite específico de pasillo en el set mínimo; se usa interior)
    return "floor_interior";
  }
  // Esquina: combinar 4-adyacente + diagonal correspondiente
  if (mask.N && mask.W) return "floor_corner_top_left";
  if (mask.N && mask.E) return "floor_corner_top_right";
  if (mask.S && mask.W) return "floor_corner_bottom_left";
  if (mask.S && mask.E) return "floor_corner_bottom_right";
  // No debería llegar aquí con count === 2 y no-opuestos, pero salvaguarda:
  return "floor_interior";
}

// ---------------------------------------------------------------------------
// Resolución de sprite → asset del WorldConfig
// ---------------------------------------------------------------------------

/** Sprite resuelto para una celda: tipo + nombre de asset. */
export interface ResolvedSprite {
  readonly col: number;
  readonly row: number;
  readonly cellType: CellType;
  readonly spriteName: string;
  readonly asset: string;
}

/**
 * Mapa de categoría de suelo → clave en `WorldConfig.tileAssets`.
 * Permite que el set mínimo de assets del mundo cubra el auto-tiling.
 */
const FLOOR_CATEGORY_TO_KEY: Record<FloorSpriteCategory, string> = {
  floor_interior: "floor",
  floor_edge_top: "wallEdgeTop",
  floor_edge_bottom: "wallEdgeBottom",
  floor_edge_left: "wallEdgeLeft",
  floor_edge_right: "wallEdgeRight",
  floor_corner_top_left: "wallCornerTopLeft",
  floor_corner_top_right: "wallCornerTopRight",
  floor_corner_bottom_left: "wallCornerBottomLeft",
  floor_corner_bottom_right: "wallCornerBottomRight",
  floor_peninsula: "floor",
  floor_isolated: "floor",
};

/**
 * Resuelve el sprite para una celda concreta del mapa lógico.
 * Devuelve el nombre del asset del `WorldConfig.tileAssets` que corresponde.
 */
export function resolveSprite(
  grid: readonly string[],
  col: number,
  row: number,
  tileAssets: WorldConfig["tileAssets"],
): ResolvedSprite {
  const ch = grid[row]![col]!;
  const cellType = CHAR_TO_CELL[ch] ?? "EMPTY";

  switch (cellType) {
    case "WALL":
      return { col, row, cellType, spriteName: "wall", asset: tileAssets.wallEdgeTop };
    case "PLAYER":
      return { col, row, cellType, spriteName: "player", asset: tileAssets.player };
    case "ENEMY":
      return { col, row, cellType, spriteName: "enemy", asset: tileAssets.enemyDefault };
    case "GOAL":
      return { col, row, cellType, spriteName: "goal", asset: tileAssets.goal };
    case "OBSTACLE":
      return { col, row, cellType, spriteName: "obstacle", asset: tileAssets.obstacle ?? tileAssets.wallEdgeTop };
    case "DOOR":
      return { col, row, cellType, spriteName: "door", asset: tileAssets.door ?? tileAssets.wallEdgeTop };
    case "KEY":
      return { col, row, cellType, spriteName: "key", asset: tileAssets.key ?? tileAssets.goal };
    case "EMPTY":
      return { col, row, cellType, spriteName: "empty", asset: tileAssets.floor };
    case "FLOOR":
    default: {
      const mask = computeNeighborMask(grid, col, row);
      const category = classifyFloorSprite(mask);
      const key = FLOOR_CATEGORY_TO_KEY[category];
      const asset = tileAssets[key] ?? tileAssets.floor;
      return { col, row, cellType, spriteName: category, asset };
    }
  }
}

// ---------------------------------------------------------------------------
// Resolución completa del tablero
// ---------------------------------------------------------------------------

/**
 * Resuelve todos los sprites de un `LevelMap` ya validado.
 * Devuelve una lista plana de `ResolvedSprite` (uno por celda del grid).
 */
export function resolveAllSprites(level: LevelMap, world: WorldConfig): ResolvedSprite[] {
  if (level.world !== world.world) {
    throw new Error(
      `LevelMap.world "${level.world}" != WorldConfig.world "${world.world}"`,
    );
  }
  const out: ResolvedSprite[] = [];
  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      out.push(resolveSprite(level.grid, col, row, world.tileAssets));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Verificación: ¿el auto-tiling asigna sprite a cada combinación posible?
// ---------------------------------------------------------------------------

/**
 * Comprueba que para cada celda del grid, el auto-tiling asigna un asset
 * válido (no undefined) del `WorldConfig.tileAssets`.
 *
 * Usado por los tests de la Fase 1 (requisito (c)) y por el validador del
 * solver (check `tilingResolved`).
 */
export function isTilingFullyResolved(level: LevelMap, world: WorldConfig): boolean {
  try {
    const sprites = resolveAllSprites(level, world);
    return sprites.every((s) => typeof s.asset === "string" && s.asset.length > 0);
  } catch {
    return false;
  }
}
