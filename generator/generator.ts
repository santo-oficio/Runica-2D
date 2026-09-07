/**
 * Level Generator (docs/03-GENERADOR-NIVELES.md).
 *
 * Orquesta la generación de un `LevelMap` a partir de:
 *  - seed (semilla determinista)
 *  - WorldConfig (tamaños permitidos, tabla de dificultad)
 *  - BackgroundTemplate (boardArea, allowedCellSizes)
 *  - número de nivel (para elegir la franja de dificultad)
 *
 * Pasos (docs/03 §1):
 *  1. Elegir arquetipo de forma (aleatorio por seed, o forzado).
 *  2. Elegir tamaño del tablero (de `world.allowedBoardSizes`, que quepa en
 *     `boardArea` con algún `allowedCellSize`).
 *  3. Generar el grid del arquetipo.
 *  4. Poblar entidades (jugador, objetivo, enemigos, obstáculos, puertas,
 *     llaves) según la franja de dificultad.
 *  5. Pre-filtro topológico: camino jugador→objetivo.
 *  6. Serializar a `LevelMap`.
 *
 * La generación es determinista: la misma seed + mismo WorldConfig +
 * mismo BackgroundTemplate producen siempre el mismo LevelMap.
 */

import type {
  Archetype,
  BackgroundTemplate,
  LevelMap,
  WorldConfig,
} from "../schemas/types.js";
import { ALL_ARCHETYPES, generateArchetypeGrid, gridToStrings } from "./archetypes.js";
import { optionsFromWorld, populateEntities, type PopulateOptions } from "./populate.js";
import { createRng, type Rng } from "./rng.js";
import { hasPath } from "./topology.js";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Parámetros de generación. */
export interface GenerateLevelParams {
  readonly seed: number;
  readonly world: WorldConfig;
  readonly background: BackgroundTemplate;
  /** Número de nivel dentro de la progresión (para elegir franja de dificultad). */
  readonly levelNumber: number;
  /** ID único del nivel. Por defecto se deriva de la seed. */
  readonly levelId?: number;
  /** Arquetipo forzado (si null, se elige aleatoriamente por seed). */
  readonly archetype?: Archetype;
  /** Tamaño forzado [cols, rows] (si null, se elige de world.allowedBoardSizes). */
  readonly boardSize?: readonly [number, number];
  /** Opciones de población forzadas (si null, se derivan del WorldConfig + levelNumber). */
  readonly populateOptions?: PopulateOptions;
  /** Versión del ruleset (docs/06 §2). Por defecto "1.0.0". */
  readonly rulesetVersion?: string;
  /** Máximo de reintentos si la generación falla (pre-filtro o población). */
  readonly maxRetries?: number;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Elige un tamaño de tablero de `world.allowedBoardSizes` que quepa en el
 * `boardArea` (en píxeles, para una resolución de referencia) con al menos
 * un `allowedCellSize` del fondo.
 *
 * Resolución de referencia: 1920x1080 (TV panorámica, doc 02).
 */
function pickBoardSize(
  rng: Rng,
  world: WorldConfig,
  background: BackgroundTemplate,
  refWidth = 1920,
  refHeight = 1080,
): readonly [number, number] {
  const boardPx = {
    width: background.boardArea.width * refWidth,
    height: background.boardArea.height * refHeight,
  };
  const viable = world.allowedBoardSizes.filter(([cols, rows]) =>
    background.allowedCellSizes.some(
      (size) => cols * size <= boardPx.width && rows * size <= boardPx.height,
    ),
  );
  if (viable.length === 0) {
    throw new Error(
      `ningún tamaño de tablero de world.allowedBoardSizes cabe en boardArea ` +
        `(${boardPx.width.toFixed(0)}x${boardPx.height.toFixed(0)}px) con allowedCellSizes ` +
        `[${background.allowedCellSizes.join(", ")}]`,
    );
  }
  return rng.pick(viable);
}

// ---------------------------------------------------------------------------
// Generación
// ---------------------------------------------------------------------------

/**
 * Genera un `LevelMap` determinista a partir de los parámetros.
 *
 * Lanza si tras `maxRetries` intentos no consigue un nivel que pase el
 * pre-filtro topológico (camino jugador→objetivo). El solver completo
 * (resolubilidad) se ejecuta en la Fase 4, no aquí.
 */
export function generateLevel(params: GenerateLevelParams): LevelMap {
  const {
    seed,
    world,
    background,
    levelNumber,
    levelId = seed,
    rulesetVersion = "1.0.0",
    maxRetries = 50,
  } = params;

  if (world.world !== background.world) {
    throw new Error(
      `WorldConfig.world "${world.world}" != BackgroundTemplate.world "${background.world}"`,
    );
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Cada intento deriva un sub-RNG distinto pero determinista.
    const rng = createRng(seed * 1000 + attempt);

    try {
      // 1. Arquetipo
      const archetype: Archetype = params.archetype ?? rng.pick(ALL_ARCHETYPES);

      // 2. Tamaño
      const [cols, rows] = params.boardSize ?? pickBoardSize(rng, world, background);

      // 3. Grid del arquetipo
      const grid = generateArchetypeGrid(archetype, cols, rows, rng);

      // 4. Poblar entidades
      const popOpts = params.populateOptions ?? optionsFromWorld(world, levelNumber);
      const entities = populateEntities(grid, rng, popOpts);

      // 5. Pre-filtro topológico (camino jugador→objetivo)
      const gridStrings = gridToStrings(grid);
      if (!hasPath(gridStrings, entities.player, entities.goal)) {
        // Población ya lo garantiza, pero por seguridad reintentamos.
        lastError = new Error("pre-filtro topológico fallido: sin camino jugador→objetivo");
        continue;
      }

      // 6. Serializar LevelMap
      return {
        levelId,
        seed,
        world: world.world,
        backgroundTemplateId: background.id,
        archetype,
        width: cols,
        height: rows,
        grid: gridStrings,
        player: entities.player,
        enemies: entities.enemies,
        goal: entities.goal,
        keys: entities.keys,
        doors: entities.doors,
        rulesetVersion,
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      // Reintentar con otra sub-seed.
    }
  }

  throw new Error(
    `generateLevel falló tras ${maxRetries} intentos (seed=${seed}, level=${levelNumber}). ` +
      `Último error: ${lastError?.message ?? "desconocido"}`,
  );
}

// ---------------------------------------------------------------------------
// Validación de invariantes (para tests y para el validador de la Fase 4)
// ---------------------------------------------------------------------------

/**
 * Comprueba las invariantes básicas que todo LevelMap generado debe cumplir
 * (docs/03 §2): jugador y objetivo existen y son únicos, no hay
 * solapamiento de entidades, todas las entidades están en celdas
 * transitables.
 */
export function checkLevelInvariants(level: LevelMap): {
  ok: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  // Jugador único
  const playerCount = countChar(level.grid, "P");
  if (playerCount !== 1) reasons.push(`jugador: esperado 1, encontrado ${playerCount}`);

  // Objetivo único
  const goalCount = countChar(level.grid, "G");
  if (goalCount !== 1) reasons.push(`objetivo: esperado 1, encontrado ${goalCount}`);

  // No solapamiento: todas las entidades en celdas distintas
  const all = [level.player, level.goal, ...level.enemies.map((e) => e.pos), ...level.keys, ...level.doors];
  const seen = new Set<string>();
  for (const p of all) {
    const k = `${p[0]},${p[1]}`;
    if (seen.has(k)) reasons.push(`entidades solapadas en ${k}`);
    seen.add(k);
  }

  // Entidades dentro de bounds
  for (const p of all) {
    if (p[0] < 0 || p[0] >= level.width || p[1] < 0 || p[1] >= level.height) {
      reasons.push(`entidad fuera de bounds en ${p[0]},${p[1]}`);
    }
  }

  // Enemigos coinciden con 'E' en el grid
  for (const e of level.enemies) {
    const ch = level.grid[e.pos[1]]?.[e.pos[0]];
    if (ch !== "E") reasons.push(`enemigo en ${e.pos[0]},${e.pos[1]} no es 'E' en el grid (es '${ch}')`);
  }

  // Jugador/objetivo coinciden con 'P'/'G'
  if (level.grid[level.player[1]]?.[level.player[0]] !== "P") {
    reasons.push("player no es 'P' en el grid");
  }
  if (level.grid[level.goal[1]]?.[level.goal[0]] !== "G") {
    reasons.push("goal no es 'G' en el grid");
  }

  return { ok: reasons.length === 0, reasons };
}

function countChar(grid: readonly string[], ch: string): number {
  let n = 0;
  for (const row of grid) for (const c of row) if (c === ch) n++;
  return n;
}
