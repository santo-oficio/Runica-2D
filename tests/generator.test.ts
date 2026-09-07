/**
 * Tests del Level Generator completo (Fase 2).
 *
 * Genera cientos de seeds y verifica las invariantes de docs/03 §2:
 *  - jugador y objetivo existen y son únicos,
 *  - no hay solapamiento de entidades,
 *  - el tablero cabe en el boardArea (vía allowedBoardSizes + allowedCellSizes),
 *  - la generación es determinista por seed,
 *  - el LevelMap producido pasa el validador de esquema.
 */

import { describe, it, expect } from "vitest";
import { generateLevel, checkLevelInvariants } from "../generator/generator.js";
import { hasPath } from "../generator/topology.js";
import { validateLevelMap } from "../schemas/validate.js";
import { backgroundTemplateExample, worldConfigExample } from "../schemas/examples.js";

const NUM_SEEDS = 300;

describe("generateLevel — determinismo", () => {
  it("la misma seed produce siempre el mismo LevelMap", () => {
    for (const seed of [1, 42, 12345, 999999]) {
      const a = generateLevel({
        seed,
        world: worldConfigExample,
        background: backgroundTemplateExample,
        levelNumber: 10,
      });
      const b = generateLevel({
        seed,
        world: worldConfigExample,
        background: backgroundTemplateExample,
        levelNumber: 10,
      });
      expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    }
  });

  it("seeds distintas producen LevelMaps distintos (con alta probabilidad)", () => {
    const a = generateLevel({
      seed: 1,
      world: worldConfigExample,
      background: backgroundTemplateExample,
      levelNumber: 10,
    });
    const b = generateLevel({
      seed: 2,
      world: worldConfigExample,
      background: backgroundTemplateExample,
      levelNumber: 10,
    });
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });
});

describe("generateLevel — invariantes sobre cientos de seeds", () => {
  const seeds = Array.from({ length: NUM_SEEDS }, (_, i) => 1000 + i);

  it("todas las seeds generan un LevelMap válido por esquema", () => {
    let ok = 0;
    for (const seed of seeds) {
      const level = generateLevel({
        seed,
        world: worldConfigExample,
        background: backgroundTemplateExample,
        levelNumber: 10,
      });
      // No lanza
      expect(() => validateLevelMap("lm", level)).not.toThrow();
      ok++;
    }
    expect(ok).toBe(NUM_SEEDS);
  });

  it("jugador y objetivo únicos, sin solapamiento (checkLevelInvariants)", () => {
    let failures = 0;
    const sample: string[] = [];
    for (const seed of seeds) {
      const level = generateLevel({
        seed,
        world: worldConfigExample,
        background: backgroundTemplateExample,
        levelNumber: 10,
      });
      const r = checkLevelInvariants(level);
      if (!r.ok) {
        failures++;
        if (sample.length < 5) sample.push(`seed=${seed}: ${r.reasons.join("; ")}`);
      }
    }
    expect(failures).toBe(0);
    if (failures > 0) {
      console.error("Fallos de invariantes:", sample);
    }
  });

  it("existe un camino topológico jugador→objetivo en todos los niveles", () => {
    let failures = 0;
    for (const seed of seeds) {
      const level = generateLevel({
        seed,
        world: worldConfigExample,
        background: backgroundTemplateExample,
        levelNumber: 10,
      });
      if (!hasPath(level.grid, level.player, level.goal)) failures++;
    }
    expect(failures).toBe(0);
  });

  it("el tamaño del tablero está en world.allowedBoardSizes", () => {
    for (const seed of seeds) {
      const level = generateLevel({
        seed,
        world: worldConfigExample,
        background: backgroundTemplateExample,
        levelNumber: 10,
      });
      const sizeMatch = worldConfigExample.allowedBoardSizes.some(
        ([c, r]) => c === level.width && r === level.height,
      );
      expect(sizeMatch).toBe(true);
    }
  });

  it("el tablero cabe en boardArea con algún allowedCellSize (ref 1920x1080)", () => {
    const boardPx = {
      width: backgroundTemplateExample.boardArea.width * 1920,
      height: backgroundTemplateExample.boardArea.height * 1080,
    };
    for (const seed of seeds) {
      const level = generateLevel({
        seed,
        world: worldConfigExample,
        background: backgroundTemplateExample,
        levelNumber: 10,
      });
      const fits = backgroundTemplateExample.allowedCellSizes.some(
        (size) => level.width * size <= boardPx.width && level.height * size <= boardPx.height,
      );
      expect(fits).toBe(true);
    }
  });

  it("el nº de enemigos está dentro del límite de la franja de dificultad", () => {
    for (const seed of seeds) {
      const level = generateLevel({
        seed,
        world: worldConfigExample,
        background: backgroundTemplateExample,
        levelNumber: 10, // franja [1,10], stars=1, maxEnemies=1
      });
      expect(level.enemies.length).toBeLessThanOrEqual(1);
    }
  });

  it("cada fila del grid tiene longitud == width", () => {
    for (const seed of seeds) {
      const level = generateLevel({
        seed,
        world: worldConfigExample,
        background: backgroundTemplateExample,
        levelNumber: 10,
      });
      for (const row of level.grid) {
        expect(row.length).toBe(level.width);
      }
    }
  });
});

describe("generateLevel — arquetipos forzados", () => {
  const archetypes = [
    "RECTANGULO", "L", "T", "CRUZ", "PASILLO", "CAMARA_CENTRAL",
    "ANILLO", "DOBLE_PASILLO", "LABERINTO", "IRREGULAR",
  ] as const;

  for (const arch of archetypes) {
    it(`${arch}: genera un nivel válido con invariantes`, () => {
      const level = generateLevel({
        seed: 42,
        world: worldConfigExample,
        background: backgroundTemplateExample,
        levelNumber: 10,
        archetype: arch,
      });
      expect(level.archetype).toBe(arch);
      expect(checkLevelInvariants(level).ok).toBe(true);
      expect(hasPath(level.grid, level.player, level.goal)).toBe(true);
    });
  }
});

describe("generateLevel — errores y validaciones", () => {
  it("lanza si world != background.world", () => {
    expect(() =>
      generateLevel({
        seed: 1,
        world: { ...worldConfigExample, world: "FUEGO" },
        background: backgroundTemplateExample,
        levelNumber: 10,
      }),
    ).toThrow();
  });

  it("lanza si ningún tamaño de tablero cabe en boardArea", () => {
    const tinyBg = {
      ...backgroundTemplateExample,
      boardArea: { x: 0.4, y: 0.4, width: 0.05, height: 0.05 },
    };
    expect(() =>
      generateLevel({
        seed: 1,
        world: worldConfigExample,
        background: tinyBg,
        levelNumber: 10,
      }),
    ).toThrow();
  });
});
