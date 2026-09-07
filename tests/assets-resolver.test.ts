/**
 * Tests del Asset Resolver / Auto-tiling (docs/02 §5).
 *
 * Requisito del prompt Fase 1 (c): el auto-tiling asigna un sprite a cada
 * combinación de vecinos posible en los arquetipos definidos en
 * docs/03-GENERADOR-NIVELES.md.
 */

import { describe, it, expect } from "vitest";
import {
  CHAR_TO_CELL,
  classifyFloorSprite,
  computeNeighborMask,
  isTilingFullyResolved,
  resolveAllSprites,
  resolveSprite,
  type NeighborMask,
} from "../assets-resolver/auto-tiling.js";
import { levelMapExample } from "../schemas/examples.js";
import { worldConfigExample } from "../schemas/examples.js";
import type { LevelMap, WorldConfig } from "../schemas/types.js";

// WorldConfig de test con todos los assets de borde/esquina posibles.
const fullTileAssets = {
  floor: "space_floor.png",
  wallEdgeTop: "space_wall_top.png",
  wallEdgeBottom: "space_wall_bottom.png",
  wallEdgeLeft: "space_wall_left.png",
  wallEdgeRight: "space_wall_right.png",
  wallCornerTopLeft: "space_wall_corner_tl.png",
  wallCornerTopRight: "space_wall_corner_tr.png",
  wallCornerBottomLeft: "space_wall_corner_bl.png",
  wallCornerBottomRight: "space_wall_corner_br.png",
  player: "space_player.png",
  enemyDefault: "space_enemy.png",
  goal: "space_goal.png",
  obstacle: "space_obstacle.png",
  door: "space_door.png",
  key: "space_key.png",
};
const worldFull: WorldConfig = { ...worldConfigExample, tileAssets: fullTileAssets };

function mkLevel(grid: string[], archetype: LevelMap["archetype"]): LevelMap {
  const height = grid.length;
  const width = grid[0]!.length;
  let player: [number, number] = [0, 0];
  let goal: [number, number] = [0, 0];
  const enemies: Array<{ pos: [number, number]; pattern: "PERSECUCION_SIMPLE" }> = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const ch = grid[r]![c]!;
      if (ch === "P") player = [c, r];
      else if (ch === "G") goal = [c, r];
      else if (ch === "E") enemies.push({ pos: [c, r], pattern: "PERSECUCION_SIMPLE" });
    }
  }
  return {
    levelId: 1,
    seed: 1,
    world: "ESPACIO",
    backgroundTemplateId: "SPACE_01",
    archetype,
    width,
    height,
    grid,
    player,
    enemies: enemies as LevelMap["enemies"],
    goal,
    keys: [],
    doors: [],
    rulesetVersion: "1.0.0",
  };
}

describe("CHAR_TO_CELL / computeNeighborMask", () => {
  it("mapea todos los símbolos del doc 05 §1", () => {
    expect(CHAR_TO_CELL["#"]).toBe("WALL");
    expect(CHAR_TO_CELL["."]).toBe("FLOOR");
    expect(CHAR_TO_CELL["P"]).toBe("PLAYER");
    expect(CHAR_TO_CELL["E"]).toBe("ENEMY");
    expect(CHAR_TO_CELL["X"]).toBe("OBSTACLE");
    expect(CHAR_TO_CELL["G"]).toBe("GOAL");
    expect(CHAR_TO_CELL["D"]).toBe("DOOR");
    expect(CHAR_TO_CELL["K"]).toBe("KEY");
  });

  it("computeNeighborMask trata bordes del tablero como no-transitables", () => {
    const grid = ["..", ".."];
    const m = computeNeighborMask(grid, 0, 0);
    expect(m.N).toBe(true); // fuera del tablero
    expect(m.W).toBe(true);
    expect(m.NW).toBe(true);
    expect(m.S).toBe(false); // (0,1) es '.'
    expect(m.E).toBe(false); // (1,0) es '.'
  });
});

describe("classifyFloorSprite — todas las combinaciones de vecinos", () => {
  const mk = (n: boolean, e: boolean, s: boolean, w: boolean): NeighborMask => ({
    N: n, NE: n, E: e, SE: s, S: s, SW: s, W: w, NW: n,
  });

  it("suelo interior (0 vecinos bloqueados)", () => {
    expect(classifyFloorSprite(mk(false, false, false, false))).toBe("floor_interior");
  });
  it("borde superior (1 vecino: N)", () => {
    expect(classifyFloorSprite(mk(true, false, false, false))).toBe("floor_edge_top");
  });
  it("borde inferior (1 vecino: S)", () => {
    expect(classifyFloorSprite(mk(false, false, true, false))).toBe("floor_edge_bottom");
  });
  it("borde izquierdo (1 vecino: W)", () => {
    expect(classifyFloorSprite(mk(false, false, false, true))).toBe("floor_edge_left");
  });
  it("borde derecho (1 vecino: E)", () => {
    expect(classifyFloorSprite(mk(false, true, false, false))).toBe("floor_edge_right");
  });
  it("esquina sup-izq (N+W)", () => {
    expect(classifyFloorSprite(mk(true, false, false, true))).toBe("floor_corner_top_left");
  });
  it("esquina sup-der (N+E)", () => {
    expect(classifyFloorSprite(mk(true, true, false, false))).toBe("floor_corner_top_right");
  });
  it("esquina inf-izq (S+W)", () => {
    expect(classifyFloorSprite(mk(false, false, true, true))).toBe("floor_corner_bottom_left");
  });
  it("esquina inf-der (S+E)", () => {
    expect(classifyFloorSprite(mk(false, true, true, false))).toBe("floor_corner_bottom_right");
  });
  it("pasillo horizontal (E+W)", () => {
    expect(classifyFloorSprite(mk(false, true, false, true))).toBe("floor_interior");
  });
  it("pasillo vertical (N+S)", () => {
    expect(classifyFloorSprite(mk(true, false, true, false))).toBe("floor_interior");
  });
  it("península (3 vecinos bloqueados)", () => {
    expect(classifyFloorSprite(mk(true, true, false, true))).toBe("floor_peninsula");
  });
  it("aislado (4 vecinos bloqueados)", () => {
    expect(classifyFloorSprite(mk(true, true, true, true))).toBe("floor_isolated");
  });
});

describe("resolveSprite — tipos de celda", () => {
  // grid: fila 0 = "#.#", fila 1 = "PEG", fila 2 = "XDK"
  // P=(0,1), E=(1,1), G=(2,1), X=(0,2), D=(1,2), K=(2,2)
  const grid = ["#.#", "PEG", "XDK"];

  it("resuelve WALL", () => {
    expect(resolveSprite(grid, 0, 0, fullTileAssets).cellType).toBe("WALL");
  });
  it("resuelve PLAYER", () => {
    expect(resolveSprite(grid, 0, 1, fullTileAssets).cellType).toBe("PLAYER");
    expect(resolveSprite(grid, 0, 1, fullTileAssets).asset).toBe("space_player.png");
  });
  it("resuelve ENEMY", () => {
    expect(resolveSprite(grid, 1, 1, fullTileAssets).cellType).toBe("ENEMY");
    expect(resolveSprite(grid, 1, 1, fullTileAssets).asset).toBe("space_enemy.png");
  });
  it("resuelve GOAL", () => {
    expect(resolveSprite(grid, 2, 1, fullTileAssets).cellType).toBe("GOAL");
    expect(resolveSprite(grid, 2, 1, fullTileAssets).asset).toBe("space_goal.png");
  });
  it("resuelve OBSTACLE/DOOR/KEY con fallback si faltan assets", () => {
    expect(resolveSprite(grid, 0, 2, fullTileAssets).cellType).toBe("OBSTACLE");
    expect(resolveSprite(grid, 1, 2, fullTileAssets).cellType).toBe("DOOR");
    expect(resolveSprite(grid, 2, 2, fullTileAssets).cellType).toBe("KEY");
  });
});

describe("resolveAllSprites — ejemplo canónico", () => {
  it("produce un sprite por celda del grid", () => {
    const sprites = resolveAllSprites(levelMapExample, worldFull);
    expect(sprites.length).toBe(levelMapExample.width * levelMapExample.height);
  });
  it("todos los sprites tienen asset no vacío", () => {
    const sprites = resolveAllSprites(levelMapExample, worldFull);
    expect(sprites.every((s) => s.asset.length > 0)).toBe(true);
  });
  it("lanza si el world del level != world del config", () => {
    const wrongWorld: WorldConfig = { ...worldFull, world: "FUEGO" };
    expect(() => resolveAllSprites(levelMapExample, wrongWorld)).toThrow();
  });
});

describe("isTilingFullyResolved — arquetipos (req c)", () => {
  // Un grid por cada arquetipo del doc 03 §1, con combinaciones variadas
  // de vecinos (interior, bordes, esquinas, penínsulas, aislados).
  const cases: Array<{ name: string; archetype: LevelMap["archetype"]; grid: string[] }> = [
    { name: "RECTANGULO", archetype: "RECTANGULO", grid: ["####", "#..#", "#..#", "####"] },
    { name: "L", archetype: "L", grid: ["######", "#....#", "#....#", "###...", "#.....", "######"] },
    { name: "T", archetype: "T", grid: ["########", "###..###", "###..###", "#......#", "#......#", "########"] },
    { name: "CRUZ", archetype: "CRUZ", grid: ["###..###", "###..###", "#......#", "#......#", "###..###", "###..###"] },
    { name: "PASILLO", archetype: "PASILLO", grid: ["######", "#....#", "#....#", "#....#", "######"] },
    { name: "CAMARA_CENTRAL", archetype: "CAMARA_CENTRAL", grid: ["########", "##....##", "##....##", "##....##", "########"] },
    { name: "ANILLO", archetype: "ANILLO", grid: ["########", "#......#", "#.####.#", "#.#..#.#", "#.####.#", "#......#", "########"] },
    { name: "DOBLE_PASILLO", archetype: "DOBLE_PASILLO", grid: ["########", "#....#.#", "#....#.#", "########", "#.#....#", "#.#....#", "########"] },
    { name: "LABERINTO", archetype: "LABERINTO", grid: ["########", "#.#....#", "#.#.##.#", "#.#..#.#", "#.##.#.#", "#....#.#", "########"] },
    { name: "IRREGULAR", archetype: "IRREGULAR", grid: ["###...##", "#.....#.", "#.###..#", "#.#.#.##", "#...#...", "#######.."] },
  ];

  for (const c of cases) {
    it(`${c.name}: auto-tiling asigna sprite a cada celda`, () => {
      const level = mkLevel(c.grid, c.archetype);
      expect(isTilingFullyResolved(level, worldFull)).toBe(true);
    });
  }

  it("falla si un asset requerido falta y no hay fallback", () => {
    // WorldConfig mínimo sin wallEdgeBottom/wallEdgeLeft/etc.: las celdas
    // FLOOR con borde inferior/caja izquierdo caerían a fallback 'floor',
    // que SÍ existe → sigue resolviendo. Para forzar fallo, quitamos 'floor'.
    const noFloor: WorldConfig = {
      ...worldFull,
      tileAssets: { ...fullTileAssets, floor: "" },
    };
    const level = mkLevel(["####", "#..#", "####"], "RECTANGULO");
    expect(isTilingFullyResolved(level, noFloor)).toBe(false);
  });
});
