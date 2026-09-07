/**
 * Solver / Validador (docs/04-SOLVER-VALIDADOR.md).
 *
 * Orquesta los 10 chequeos del checklist + el solver de resolubilidad +
 * el puntuador de dificultad, y devuelve un `ValidationResult` conforme
 * al esquema JSON (docs/06 §3).
 */

import type {
  BackgroundTemplate,
  LevelMap,
  ValidationResult,
  WorldConfig,
} from "../schemas/types.js";
import {
  DEFAULT_VALIDATOR_OPTIONS,
  runChecklist,
  type ValidatorOptions,
} from "./checklist.js";

/**
 * Valida un nivel completo: ejecuta los 10 chequeos del checklist, el
 * solver de resolubilidad y el puntuador de dificultad.
 *
 * Devuelve un `ValidationResult` con:
 *  - `valid`: true solo si TODOS los 10 chequeos pasan.
 *  - `checks`: detalle de cada chequeo.
 *  - `solution`: minMoves y path de la solución (si es resoluble).
 *  - `difficultyScore`: puntuación 0–10.
 *  - `rejectionReason`: motivo del primer fallo (si no es válido).
 */
export function validateLevel(
  level: LevelMap,
  world: WorldConfig,
  background: BackgroundTemplate,
  opts: ValidatorOptions = DEFAULT_VALIDATOR_OPTIONS,
): ValidationResult {
  const result = runChecklist(level, world, background, opts);

  const checks: ValidationResult["checks"] = {
    withinBoardArea: result.withinBoardArea.ok,
    gridAligned: result.gridAligned.ok,
    noDecorationOverlap: result.noDecorationOverlap.ok,
    tilingResolved: result.tilingResolved.ok,
    entitiesFit: result.entitiesFit.ok,
    noImpossiblePositions: result.noImpossiblePositions.ok,
    solvable: result.solvable.ok,
    difficultyInRange: result.difficultyInRange.ok,
    notTrivial: result.notTrivial.ok,
    noAbsurdSituations: result.noAbsurdSituations.ok,
  };

  const minMoves = result.solver?.solvable ? result.solver.minMoves : 0;
  const path = result.solver?.solution ? result.solver.solution.join(",") : "";

  // rejectionReason: el primer chequeo que falla, con su motivo.
  let rejectionReason: string | null = null;
  if (!result.allOk) {
    const checks: Array<[string, { ok: boolean; reason: string | null }]> = [
      ["withinBoardArea", result.withinBoardArea],
      ["gridAligned", result.gridAligned],
      ["noDecorationOverlap", result.noDecorationOverlap],
      ["tilingResolved", result.tilingResolved],
      ["entitiesFit", result.entitiesFit],
      ["noImpossiblePositions", result.noImpossiblePositions],
      ["solvable", result.solvable],
      ["difficultyInRange", result.difficultyInRange],
      ["notTrivial", result.notTrivial],
      ["noAbsurdSituations", result.noAbsurdSituations],
    ];
    for (const [name, check] of checks) {
      if (!check.ok) {
        rejectionReason = `${name}: ${check.reason ?? "falló"}`;
        break;
      }
    }
  }

  return {
    levelId: level.levelId,
    valid: result.allOk,
    checks,
    solution: { minMoves, path },
    difficultyScore: result.difficultyScore,
    rejectionReason,
  };
}
