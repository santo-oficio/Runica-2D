/**
 * Tests del pre-filtro topológico y la población de entidades (Fase 2).
 */

import { describe, it, expect } from "vitest";
import { bfsDistance, hasPath, manhattan } from "../generator/topology.js";
import { populateEntities, optionsFromWorld, DEFAULT_POPULATE_OPTIONS } from "../generator/populate.js";
import { generateArchetypeGrid, gridToStrings } from "../generator/archetypes.js";
import { createRng } from "../generator/rng.js";
import { worldConfigExample } from "../schemas/examples.js";

describe("manhattan", () => {
  it("distancia entre celdas adyacentes", () => {
    expect(manhattan([0, 0], [1, 0])).toBe(1);
    expect(manhattan([0, 0], [0, 1])).toBe(1);
  });
  it("distancia diagonal", () => {
    expect(manhattan([0, 0], [3, 4])).toBe(7);
  });
  it("distancia a sí mismo", () => {
    expect(manhattan([5, 5], [5, 5])).toBe(0);
  });
});

describe("hasPath / bfsDistance", () => {
  const grid = [
    "#####",
    "#...#",
    "#.#.#",
    "#...#",
    "#####",
  ];

  it("hasPath: camino existente", () => {
    expect(hasPath(grid, [1, 1], [3, 3])).toBe(true);
  });
  it("hasPath: sin camino (objetivo aislado)", () => {
    const g2 = [
      "#####",
      "#...#",
      "###.#",
      "#.#.#",
      "#####",
    ];
    expect(hasPath(g2, [1, 1], [1, 3])).toBe(false);
  });
  it("bfsDistance: distancia más corta", () => {
    expect(bfsDistance(grid, [1, 1], [3, 1])).toBe(2);
  });
  it("bfsDistance: Infinity si no hay camino", () => {
    const g2 = [
      "#####",
      "#...#",
      "###.#",
      "#.#.#",
      "#####",
    ];
    expect(bfsDistance(g2, [1, 1], [1, 3])).toBe(Infinity);
  });
});

describe("populateEntities", () => {
  it("coloca jugador y objetivo únicos con camino", () => {
    const rng = createRng(42);
    const grid = generateArchetypeGrid("RECTANGULO", 10, 8, rng);
    const entities = populateEntities(grid, rng, DEFAULT_POPULATE_OPTIONS);
    expect(grid[entities.player[1]]![entities.player[0]]).toBe("P");
    expect(grid[entities.goal[1]]![entities.goal[0]]).toBe("G");
    expect(hasPath(gridToStrings(grid), entities.player, entities.goal)).toBe(true);
  });

  it("respeta distancia mínima jugador-objetivo cuando es posible", () => {
    const rng = createRng(100);
    const grid = generateArchetypeGrid("RECTANGULO", 12, 10, rng);
    const opts = { ...DEFAULT_POPULATE_OPTIONS, minPlayerGoalDistance: 6 };
    const entities = populateEntities(grid, rng, opts);
    expect(manhattan(entities.player, entities.goal)).toBeGreaterThanOrEqual(6);
  });

  it("coloca el número correcto de enemigos", () => {
    const rng = createRng(7);
    const grid = generateArchetypeGrid("RECTANGULO", 12, 10, rng);
    const opts = { ...DEFAULT_POPULATE_OPTIONS, enemyCount: 3 };
    const entities = populateEntities(grid, rng, opts);
    expect(entities.enemies.length).toBe(3);
    for (const e of entities.enemies) {
      expect(grid[e.pos[1]]![e.pos[0]]).toBe("E");
    }
  });

  it("respeta distancia mínima jugador-enemigo", () => {
    const rng = createRng(7);
    const grid = generateArchetypeGrid("RECTANGULO", 12, 10, rng);
    const opts = { ...DEFAULT_POPULATE_OPTIONS, enemyCount: 3, minPlayerEnemyDistance: 4 };
    const entities = populateEntities(grid, rng, opts);
    for (const e of entities.enemies) {
      expect(manhattan(entities.player, e.pos)).toBeGreaterThanOrEqual(4);
    }
  });

  it("no solapa entidades", () => {
    const rng = createRng(7);
    const grid = generateArchetypeGrid("RECTANGULO", 12, 10, rng);
    const opts = { ...DEFAULT_POPULATE_OPTIONS, enemyCount: 3, obstacleCount: 2 };
    const entities = populateEntities(grid, rng, opts);
    const all = [entities.player, entities.goal, ...entities.enemies.map((e) => e.pos), ...entities.obstacles];
    const seen = new Set<string>();
    for (const p of all) {
      const k = `${p[0]},${p[1]}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });

  it("coloca obstáculos en celdas transitables", () => {
    const rng = createRng(7);
    const grid = generateArchetypeGrid("RECTANGULO", 12, 10, rng);
    const opts = { ...DEFAULT_POPULATE_OPTIONS, obstacleCount: 3 };
    const entities = populateEntities(grid, rng, opts);
    expect(entities.obstacles.length).toBe(3);
    for (const p of entities.obstacles) {
      expect(grid[p[1]]![p[0]]).toBe("X");
    }
  });

  it("lanza si no hay suficientes celdas transitables", () => {
    const rng = createRng(1);
    // Forzamos un grid casi vacío de suelo
    const tiny = [["#","#","#"],["#","#","#"],["#","#","#"]];
    expect(() => populateEntities(tiny, rng, DEFAULT_POPULATE_OPTIONS)).toThrow();
  });
});

describe("optionsFromWorld", () => {
  it("deriva enemyCount desde la franja de dificultad", () => {
    const opts1 = optionsFromWorld(worldConfigExample, 5); // stars=1, maxEnemies=1
    expect(opts1.enemyCount).toBeGreaterThanOrEqual(1);
    expect(opts1.enemyCount).toBeLessThanOrEqual(1);

    const opts50 = optionsFromWorld(worldConfigExample, 50); // stars=3, maxEnemies=2
    expect(opts50.enemyCount).toBeGreaterThanOrEqual(1);
    expect(opts50.enemyCount).toBeLessThanOrEqual(2);

    const opts150 = optionsFromWorld(worldConfigExample, 150); // stars=5, maxEnemies=4
    expect(opts150.enemyCount).toBeGreaterThanOrEqual(1);
    expect(opts150.enemyCount).toBeLessThanOrEqual(4);
  });

  it("activa puertas/llaves solo en estrellas >= 4", () => {
    expect(optionsFromWorld(worldConfigExample, 5).doorCount).toBe(0);
    expect(optionsFromWorld(worldConfigExample, 50).doorCount).toBe(0);
    expect(optionsFromWorld(worldConfigExample, 150).doorCount).toBe(1);
    expect(optionsFromWorld(worldConfigExample, 150).keyCount).toBe(1);
  });

  it("aumenta distancia mínima con dificultad", () => {
    expect(optionsFromWorld(worldConfigExample, 150).minPlayerGoalDistance)
      .toBeGreaterThan(optionsFromWorld(worldConfigExample, 5).minPlayerGoalDistance);
  });
});
