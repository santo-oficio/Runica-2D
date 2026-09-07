/**
 * Tests end-to-end de la Fase 5 + Fase 6 (docs/09).
 *
 * Fase 5:
 *  - Generar un banco de ≥100 niveles válidos.
 *  - Renderizar uno de cada arquetipo en ASCII.
 *  - Reproducir la solución del solver como partida real → victoria.
 *
 * Fase 6:
 *  - Verificar que añadir un WorldConfig nuevo (FUEGO) no requiere
 *    cambios de código en generador/solver/motor — solo configuración.
 *  - Cargar dos WorldConfig distintos y confirmar que el mismo pipeline
 *    funciona con ambos.
 */

import { describe, it, expect } from "vitest";
import {
  generateLevelBank,
  serveLevel,
  loadLevelFromBankEntry,
  DEFAULT_BANK_OPTIONS,
} from "../worlds/level-bank.js";
import { renderAscii, renderAsciiWithSolution } from "../worlds/ascii-render.js";
import {
  SPACE_WORLD,
  SPACE_BACKGROUNDS,
  FIRE_WORLD,
  FIRE_BACKGROUNDS,
  getWorld,
  WORLD_REGISTRY,
} from "../worlds/configs.js";
import { generateLevel } from "../generator/generator.js";
import { solveLevel } from "../solver/checklist.js";
import { createInitialState } from "../engine/state.js";
import { replayMoves } from "../engine/rules.js";
import { createRng } from "../generator/rng.js";
import { ALL_ARCHETYPES } from "../generator/archetypes.js";
import type { Direction } from "../engine/state.js";

// ---------------------------------------------------------------------------
// Fase 5 — Banco de niveles + progresión + renderizado + reproducción
// ---------------------------------------------------------------------------

describe("Fase 5 — Banco de niveles", () => {
  it("genera un banco de ≥100 niveles válidos para ESPACIO", () => {
    const result = generateLevelBank(SPACE_WORLD, SPACE_BACKGROUNDS, {
      ...DEFAULT_BANK_OPTIONS,
      seedCount: 500,
      seedBase: 10000,
      levelNumber: 10,
    });
    expect(result.accepted).toBeGreaterThanOrEqual(100);
    expect(result.bank.levels.length).toBeGreaterThanOrEqual(100);
    expect(result.bank.world).toBe("ESPACIO");
    // Las entradas están ordenadas por dificultad.
    for (let i = 1; i < result.bank.levels.length; i++) {
      expect(result.bank.levels[i]!.difficultyScore).toBeGreaterThanOrEqual(
        result.bank.levels[i - 1]!.difficultyScore,
      );
    }
    // eslint-disable-next-line no-console
    console.log(`[banco ESPACIO] ${result.accepted}/500 aceptados (${(result.acceptanceRate * 100).toFixed(1)}%)`);
  });

  it("serveLevel devuelve un nivel apropiado para cada número de nivel", () => {
    const result = generateLevelBank(SPACE_WORLD, SPACE_BACKGROUNDS, {
      ...DEFAULT_BANK_OPTIONS,
      seedCount: 500,
      levelNumber: 10,
    });
    for (const ln of [1, 5, 10, 15, 30, 75, 150]) {
      const entry = serveLevel(result.bank, SPACE_WORLD, ln);
      expect(entry).not.toBeNull();
    }
  });

  it("serveLevel devuelve null si el banco está vacío", () => {
    expect(serveLevel({ world: "ESPACIO", levels: [] }, SPACE_WORLD, 1)).toBeNull();
  });

  it("loadLevelFromBankEntry reconstruye el nivel desde la seed", () => {
    const result = generateLevelBank(SPACE_WORLD, SPACE_BACKGROUNDS, {
      ...DEFAULT_BANK_OPTIONS,
      seedCount: 100,
      levelNumber: 10,
    });
    const entry = result.bank.levels[0]!;
    const level = loadLevelFromBankEntry(entry, SPACE_WORLD, SPACE_BACKGROUNDS[0]!, 10);
    expect(level.levelId).toBe(entry.levelId);
    expect(level.seed).toBe(entry.seed);
    expect(level.world).toBe("ESPACIO");
  });
});

describe("Fase 5 — Renderizado ASCII", () => {
  it("renderAscii produce una representación legible del nivel", () => {
    const level = generateLevel({
      seed: 42,
      world: SPACE_WORLD,
      background: SPACE_BACKGROUNDS[0]!,
      levelNumber: 10,
    });
    const ascii = renderAscii(level);
    expect(ascii).toContain("┌");
    expect(ascii).toContain("└");
    expect(ascii).toContain("│");
    expect(ascii).toContain(`seed: ${level.seed}`);
    expect(ascii).toContain(`archetype: ${level.archetype}`);
  });

  it("renderAsciiWithSolution muestra el camino del jugador", () => {
    // Nivel simple sin enemigos para solución corta.
    const level = generateLevel({
      seed: 42,
      world: SPACE_WORLD,
      background: SPACE_BACKGROUNDS[0]!,
      levelNumber: 10,
      populateOptions: {
        minPlayerGoalDistance: 4,
        minPlayerEnemyDistance: 3,
        enemyCount: 0,
        enemyPatterns: [],
        obstacleCount: 0,
        doorCount: 0,
        keyCount: 0,
        maxPlacementAttempts: 200,
      },
    });
    const solver = solveLevel(level, { maxDepth: 60, maxStates: 50_000 });
    expect(solver.solvable).toBe(true);
    expect(solver.solution).not.toBeNull();
    const ascii = renderAsciiWithSolution(level, solver.solution!);
    expect(ascii).toContain("P");
    expect(ascii).toContain("G");
    expect(ascii).toContain(`solución: ${solver.solution!.length} movimientos`);
  });
});

describe("Fase 5 — Reproducir solución del solver como partida real", () => {
  // Generar un nivel de cada arquetipo, resolverlo, y reproducir la
  // solución como una partida real → debe terminar en victoria.
  for (const archetype of ALL_ARCHETYPES) {
    it(`arquetipo ${archetype}: la solución del solver termina en victoria`, () => {
      // Buscar una seed que produzca un nivel resoluble de este arquetipo.
      let level = null;
      let solver = null;
      for (let seed = 100; seed < 300; seed++) {
        try {
          const candidate = generateLevel({
            seed,
            world: SPACE_WORLD,
            background: SPACE_BACKGROUNDS[0]!,
            levelNumber: 10,
            archetype,
            populateOptions: {
              minPlayerGoalDistance: 4,
              minPlayerEnemyDistance: 3,
              enemyCount: 0, // sin enemigos para garantizar resolubilidad
              enemyPatterns: [],
              obstacleCount: 0,
              doorCount: 0,
              keyCount: 0,
              maxPlacementAttempts: 200,
            },
          });
          const s = solveLevel(candidate, { maxDepth: 60, maxStates: 50_000 });
          if (s.solvable) {
            level = candidate;
            solver = s;
            break;
          }
        } catch {
          // continuar
        }
      }
      expect(level).not.toBeNull();
      expect(solver).not.toBeNull();
      expect(solver!.solvable).toBe(true);

      // Reproducir la solución como partida real.
      const state = createInitialState(level!);
      const rng = createRng(level!.seed);
      const moves = solver!.solution as Direction[];
      replayMoves(state, moves, rng);
      expect(state.solved).toBe(true);
      expect(state.failed).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// Fase 6 — Mundos: añadir mundo nuevo = solo configuración
// ---------------------------------------------------------------------------

describe("Fase 6 — Añadir mundo nuevo sin tocar código", () => {
  it("FUEGO está registrado y tiene config + backgrounds válidos", () => {
    const fire = getWorld("FUEGO");
    expect(fire).not.toBeNull();
    expect(fire!.config.world).toBe("FUEGO");
    expect(fire!.backgrounds.length).toBeGreaterThan(0);
    expect(fire!.backgrounds[0]!.world).toBe("FUEGO");
  });

  it("el mismo pipeline funciona con ESPACIO y FUEGO sin cambios de código", () => {
    // Generar un banco pequeño para cada mundo usando el MISMO pipeline.
    for (const worldInfo of [
      { name: "ESPACIO", config: SPACE_WORLD, backgrounds: SPACE_BACKGROUNDS },
      { name: "FUEGO", config: FIRE_WORLD, backgrounds: FIRE_BACKGROUNDS },
    ]) {
      const result = generateLevelBank(worldInfo.config, worldInfo.backgrounds, {
        ...DEFAULT_BANK_OPTIONS,
        seedCount: 100,
        levelNumber: 10,
      });
      expect(result.bank.world).toBe(worldInfo.name);
      expect(result.accepted).toBeGreaterThan(0);
      // eslint-disable-next-line no-console
      console.log(`[Fase 6] ${worldInfo.name}: ${result.accepted}/100 aceptados`);
    }
  });

  it("WORLD_REGISTRY contiene al menos 2 mundos", () => {
    expect(Object.keys(WORLD_REGISTRY).length).toBeGreaterThanOrEqual(2);
    expect(WORLD_REGISTRY["ESPACIO"]).toBeDefined();
    expect(WORLD_REGISTRY["FUEGO"]).toBeDefined();
  });

  it("FUEGO tiene una tabla de dificultad distinta a ESPACIO", () => {
    expect(FIRE_WORLD.difficultyTable[0]!.stars).not.toBe(SPACE_WORLD.difficultyTable[0]!.stars);
    // FUEGO empieza en stars=2 (más difícil) vs ESPACIO stars=1.
    expect(FIRE_WORLD.difficultyTable[0]!.stars).toBeGreaterThan(SPACE_WORLD.difficultyTable[0]!.stars);
  });

  it("FUEGO tiene tileAssets distintos a ESPACIO", () => {
    expect(FIRE_WORLD.tileAssets.floor).not.toBe(SPACE_WORLD.tileAssets.floor);
    expect(FIRE_WORLD.tileAssets.player).not.toBe(SPACE_WORLD.tileAssets.player);
  });

  it("getWorld devuelve null para mundo inexistente", () => {
    expect(getWorld("INEXISTENTE")).toBeNull();
  });
});
