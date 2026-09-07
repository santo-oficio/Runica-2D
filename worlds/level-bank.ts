/**
 * Banco de niveles y generación por lotes (docs/03 §5, docs/07).
 *
 * Pipeline offline:
 *  1. Generar N seeds por mundo.
 *  2. Pasar cada una por el validador/solver.
 *  3. Quedarse solo con los niveles que pasan todos los tests.
 *  4. Guardar el banco de niveles válidos indexado por dificultad.
 *
 * En la partida real, se sirven niveles del banco en el orden de
 * progresión definido por la tabla de dificultad del WorldConfig.
 */

import type {
  BackgroundTemplate,
  LevelBank,
  LevelBankEntry,
  LevelMap,
  WorldConfig,
} from "../schemas/types.js";
import { generateLevel } from "../generator/generator.js";
import { validateLevel } from "../solver/validate.js";
import {
  DEFAULT_VALIDATOR_OPTIONS,
  type SolverOptions,
} from "../solver/checklist.js";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Opciones de generación por lotes. */
export interface BankGenerationOptions {
  /** Número de seeds a intentar. */
  readonly seedCount: number;
  /** Seed base (las seeds serán base, base+1, base+2, ...). */
  readonly seedBase: number;
  /** Número de nivel en la progresión (para elegir franja de dificultad). */
  readonly levelNumber: number;
  /** Opciones del solver. */
  readonly solverOptions: SolverOptions;
  /** true si es nivel tutorial (permite soluciones triviales). */
  readonly isTutorial: boolean;
  /** Resolución de referencia para validación. */
  readonly refWidth: number;
  readonly refHeight: number;
}

export const DEFAULT_BANK_OPTIONS: BankGenerationOptions = {
  seedCount: 1000,
  seedBase: 10000,
  levelNumber: 10,
  solverOptions: { maxDepth: 60, maxStates: 50_000 },
  isTutorial: false,
  refWidth: 1920,
  refHeight: 1080,
};

/** Resultado de la generación por lotes. */
export interface BankGenerationResult {
  readonly bank: LevelBank;
  readonly accepted: number;
  readonly rejected: number;
  readonly acceptanceRate: number;
  readonly rejectionReasons: Map<string, number>;
  /** Niveles válidos completos (no solo el índice), para depuración/tests. */
  readonly validLevels: LevelMap[];
}

// ---------------------------------------------------------------------------
// Generación por lotes
// ---------------------------------------------------------------------------

/**
 * Genera un banco de niveles válidos para un mundo.
 *
 * Genera `opts.seedCount` seeds, valida cada nivel, y guarda solo los
 * que pasan todos los chequeos en un `LevelBank` indexado por dificultad.
 *
 * @param world WorldConfig del mundo.
 * @param backgrounds plantillas de fondo del mundo (se usa la primera).
 * @param opts opciones de generación.
 */
export function generateLevelBank(
  world: WorldConfig,
  backgrounds: readonly BackgroundTemplate[],
  opts: BankGenerationOptions = DEFAULT_BANK_OPTIONS,
): BankGenerationResult {
  if (backgrounds.length === 0) {
    throw new Error(`no hay BackgroundTemplates para el mundo "${world.world}"`);
  }
  const background = backgrounds[0]!;
  if (background.world !== world.world) {
    throw new Error(
      `BackgroundTemplate.world "${background.world}" != WorldConfig.world "${world.world}"`,
    );
  }

  const validLevels: LevelMap[] = [];
  const entries: LevelBankEntry[] = [];
  const rejectionReasons = new Map<string, number>();
  let accepted = 0;
  let rejected = 0;

  for (let i = 0; i < opts.seedCount; i++) {
    const seed = opts.seedBase + i;
    try {
      const level = generateLevel({
        seed,
        world,
        background,
        levelNumber: opts.levelNumber,
      });
      const result = validateLevel(level, world, background, {
        ...DEFAULT_VALIDATOR_OPTIONS,
        levelNumber: opts.levelNumber,
        isTutorial: opts.isTutorial,
        solver: opts.solverOptions,
        refWidth: opts.refWidth,
        refHeight: opts.refHeight,
      });

      if (result.valid) {
        accepted++;
        validLevels.push(level);
        entries.push({
          levelId: level.levelId,
          seed: level.seed,
          difficultyScore: result.difficultyScore,
          minMoves: result.solution.minMoves,
        });
      } else {
        rejected++;
        const reason = result.rejectionReason ?? "desconocido";
        const category = reason.split(":")[0] ?? "desconocido";
        rejectionReasons.set(category, (rejectionReasons.get(category) ?? 0) + 1);
      }
    } catch (e) {
      rejected++;
      const msg = e instanceof Error ? e.message : String(e);
      const category = msg.split(":")[0] ?? "error";
      rejectionReasons.set(`throw:${category}`, (rejectionReasons.get(`throw:${category}`) ?? 0) + 1);
    }
  }

  // Ordenar entradas por dificultad ascendente (progresión natural).
  entries.sort((a, b) => a.difficultyScore - b.difficultyScore);

  const bank: LevelBank = {
    world: world.world,
    levels: entries,
  };

  return {
    bank,
    accepted,
    rejected,
    acceptanceRate: accepted / opts.seedCount,
    rejectionReasons,
    validLevels,
  };
}

// ---------------------------------------------------------------------------
// Lógica de progresión: servir niveles del banco
// ---------------------------------------------------------------------------

/**
 * Devuelve el nivel del banco que corresponde a un número de nivel en la
 * progresión, según la tabla de dificultad del WorldConfig.
 *
 * Estrategia: encontrar la franja de dificultad que contiene el
 * `levelNumber`, y servir un nivel del banco cuya puntuación de
 * dificultad esté en el rango esperado para esa franja.
 *
 * @param bank banco de niveles válidos.
 * @param world WorldConfig con la tabla de dificultad.
 * @param levelNumber número de nivel en la progresión (1-indexed).
 * @returns LevelBankEntry o null si no hay nivel adecuado.
 */
export function serveLevel(
  bank: LevelBank,
  world: WorldConfig,
  levelNumber: number,
): LevelBankEntry | null {
  if (bank.levels.length === 0) return null;

  // Encontrar la franja de dificultad.
  const band = world.difficultyTable.find(
    (b) => levelNumber >= b.range[0] && levelNumber <= b.range[1],
  );
  if (!band) {
    // Fuera de rango: servir el último nivel disponible.
    return bank.levels[bank.levels.length - 1]!;
  }

  // Rango de dificultad esperado para esta franja (estrellas × 2).
  const minScore = band.stars * 0.8;
  const maxScore = band.stars * 2.5;

  // Buscar niveles en el rango.
  const inRange = bank.levels.filter(
    (e) => e.difficultyScore >= minScore && e.difficultyScore <= maxScore,
  );

  if (inRange.length > 0) {
    // Servir por orden de dificultad dentro del rango, rotando por levelNumber.
    const idx = (levelNumber - band.range[0]) % inRange.length;
    return inRange[idx]!;
  }

  // Si no hay niveles en el rango exacto, servir el más cercano.
  let closest = bank.levels[0]!;
  let closestDist = Infinity;
  for (const entry of bank.levels) {
    const targetScore = (minScore + maxScore) / 2;
    const dist = Math.abs(entry.difficultyScore - targetScore);
    if (dist < closestDist) {
      closestDist = dist;
      closest = entry;
    }
  }
  return closest;
}

/**
 * Devuelve el LevelMap completo para una entrada del banco.
 * Reconstruye el nivel desde la seed (determinismo garantizado).
 */
export function loadLevelFromBankEntry(
  entry: LevelBankEntry,
  world: WorldConfig,
  background: BackgroundTemplate,
  levelNumber: number,
): LevelMap {
  return generateLevel({
    seed: entry.seed,
    world,
    background,
    levelNumber,
    levelId: entry.levelId,
  });
}
