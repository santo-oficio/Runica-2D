/**
 * Chequeos automáticos de sanidad posteriores al análisis IA de un fondo
 * (docs/10-ANALIZADOR-IA-FONDOS.md §5).
 *
 * Son comprobaciones geométricas simples (sin IA) que validan que la
 * `BackgroundTemplateCandidate` propuesta por el modelo de visión es usable
 * antes de aceptarla como `BackgroundTemplate` definitiva.
 *
 * Cada chequeo es una función independiente y componible, con su propio test.
 */

import type {
  BackgroundTemplateCandidate,
  RelativeRect,
} from "../schemas/types.js";

// ---------------------------------------------------------------------------
// Tipos de resultado
// ---------------------------------------------------------------------------

/** Resultado de un chequeo individual de sanidad. */
export interface SanityCheckResult {
  readonly ok: boolean;
  readonly reason: string | null;
}

/** Resultado completo de la validación de sanidad de una plantilla. */
export interface TemplateSanityReport {
  /** true solo si TODOS los chequeos pasan. */
  readonly ok: boolean;
  /** true si la confianza del análisis está por debajo del umbral (no bloqueante). */
  readonly needsHumanReview: boolean;
  readonly checks: {
    readonly boardAreaWithinSafeArea: SanityCheckResult;
    readonly boardAreaProportions: SanityCheckResult;
    readonly atLeastOneValidCellSize: SanityCheckResult;
    readonly noExtendableOverlapWithBoardArea: SanityCheckResult;
    readonly confidenceAboveThreshold: SanityCheckResult;
  };
}

/** Opciones configurables de la validación de sanidad. */
export interface SanityOptions {
  /** Umbral mínimo de confianza (doc 10 §5.5). Por debajo → revisión humana. */
  readonly confidenceThreshold: number;
  /**
   * Proporción mínima de aspecto del boardArea (ancho/alto y alto/ancho).
   * Evita áreas degeneradas (línea de 1px o cuadrado que ocupa todo).
   * Por defecto 0.1.
   */
  readonly minBoardAreaAspect: number;
  /**
   * Fracción máxima de la imagen que puede ocupar boardArea sin dejar margen
   * a decoración. Por defecto 0.95.
   */
  readonly maxBoardAreaCoverage: number;
}

export const DEFAULT_SANITY_OPTIONS: SanityOptions = {
  confidenceThreshold: 0.7,
  minBoardAreaAspect: 0.15,
  maxBoardAreaCoverage: 0.9,
};

// ---------------------------------------------------------------------------
// Helpers geométricos
// ---------------------------------------------------------------------------

/** true si `inner` está completamente dentro de `outer` (coords relativas). */
export function rectContains(outer: RelativeRect, inner: RelativeRect, eps = 1e-9): boolean {
  return (
    inner.x >= outer.x - eps &&
    inner.y >= outer.y - eps &&
    inner.x + inner.width <= outer.x + outer.width + eps &&
    inner.y + inner.height <= outer.y + outer.height + eps
  );
}

/** true si dos rectángulos se solapan (intersección con área > 0). */
export function rectsOverlap(a: RelativeRect, b: RelativeRect, eps = 1e-9): boolean {
  const noOverlap =
    a.x + a.width <= b.x + eps ||
    b.x + b.width <= a.x + eps ||
    a.y + a.height <= b.y + eps ||
    b.y + b.height <= a.y + eps;
  return !noOverlap;
}

/** Área de un rectángulo relativo. */
function rectArea(r: RelativeRect): number {
  return r.width * r.height;
}

// ---------------------------------------------------------------------------
// Chequeos individuales (doc 10 §5)
// ---------------------------------------------------------------------------

/**
 * §5.1 — boardArea está completamente dentro de safeArea/los límites de la imagen.
 */
export function checkBoardAreaWithinSafeArea(
  candidate: BackgroundTemplateCandidate,
): SanityCheckResult {
  // safeArea se asume ya validada en [0,1]; comprobamos contención.
  if (rectContains(candidate.safeArea, candidate.boardArea)) {
    return { ok: true, reason: null };
  }
  return {
    ok: false,
    reason: "boardArea no está completamente dentro de safeArea",
  };
}

/**
 * §5.2 — boardArea tiene proporciones razonables (ni línea de 1px ni ocupa el 100%).
 */
export function checkBoardAreaProportions(
  candidate: BackgroundTemplateCandidate,
  opts: SanityOptions = DEFAULT_SANITY_OPTIONS,
): SanityCheckResult {
  const { boardArea } = candidate;
  const aspect = boardArea.width / boardArea.height;
  if (aspect < opts.minBoardAreaAspect || aspect > 1 / opts.minBoardAreaAspect) {
    return {
      ok: false,
      reason: `proporción boardArea ${aspect.toFixed(3)} fuera de rango aceptable`,
    };
  }
  const coverage = rectArea(boardArea); // relativa a la imagen completa (1x1)
  if (coverage > opts.maxBoardAreaCoverage) {
    return {
      ok: false,
      reason: `boardArea cubre ${(coverage * 100).toFixed(1)}% de la imagen sin margen para decoración`,
    };
  }
  return { ok: true, reason: null };
}

/**
 * §5.3 — suggestedGrid (columnas × filas × allowedCellSizes) permite al menos
 * un tamaño de celda válido dentro de boardArea.
 *
 * Como el analizador no conoce la resolución real, se comprueba que existe
 * al menos un `allowedCellSize` tal que `cols * size` cabe en el ancho
 * relativo y `rows * size` en el alto relativo, considerando un ancho de
 * imagen de referencia (refImagePx). Por defecto se usa 1920x1080 (TV).
 */
export function checkAtLeastOneValidCellSize(
  candidate: BackgroundTemplateCandidate,
  refImagePx: { width: number; height: number } = { width: 1920, height: 1080 },
): SanityCheckResult {
  const boardPx = {
    width: candidate.boardArea.width * refImagePx.width,
    height: candidate.boardArea.height * refImagePx.height,
  };
  const { columns, rows } = candidate.suggestedGrid;
  const valid = candidate.allowedCellSizes.filter(
    (size) => columns * size <= boardPx.width + 1e-6 && rows * size <= boardPx.height + 1e-6,
  );
  if (valid.length === 0) {
    return {
      ok: false,
      reason: `ningún allowedCellSize cabe en boardArea (${boardPx.width.toFixed(0)}x${boardPx.height.toFixed(0)}px) para ${columns}x${rows} celdas`,
    };
  }
  return { ok: true, reason: null };
}

/**
 * §5.4 — Ninguna decorativeArea con extendable=true se solapa con boardArea.
 */
export function checkNoExtendableOverlap(
  candidate: BackgroundTemplateCandidate,
): SanityCheckResult {
  const areas = candidate.decorativeAreas ?? [];
  const offender = areas.find((a) => a.extendable && rectsOverlap(a, candidate.boardArea));
  if (offender) {
    return {
      ok: false,
      reason: `decorativeArea extensible se solapa con boardArea (x=${offender.x}, y=${offender.y})`,
    };
  }
  return { ok: true, reason: null };
}

/**
 * §5.5 — confidence >= umbral. NO bloqueante: marca para revisión humana.
 */
export function checkConfidenceAboveThreshold(
  candidate: BackgroundTemplateCandidate,
  opts: SanityOptions = DEFAULT_SANITY_OPTIONS,
): SanityCheckResult {
  if (candidate.confidence >= opts.confidenceThreshold) {
    return { ok: true, reason: null };
  }
  return {
    ok: false,
    reason: `confidence ${candidate.confidence.toFixed(2)} < umbral ${opts.confidenceThreshold} (requiere revisión humana)`,
  };
}

// ---------------------------------------------------------------------------
// Validación completa
// ---------------------------------------------------------------------------

/**
 * Ejecuta los 5 chequeos de sanidad sobre una plantilla candidata.
 *
 * `ok` es true solo si los 4 chequeos geométricos (1–4) pasan. El chequeo de
 * confianza (5) NO bloquea: si falla, `needsHumanReview` queda a true pero
 * `ok` puede seguir siendo true.
 */
export function runSanityChecks(
  candidate: BackgroundTemplateCandidate,
  opts: SanityOptions = DEFAULT_SANITY_OPTIONS,
): TemplateSanityReport {
  const boardAreaWithinSafeArea = checkBoardAreaWithinSafeArea(candidate);
  const boardAreaProportions = checkBoardAreaProportions(candidate, opts);
  const atLeastOneValidCellSize = checkAtLeastOneValidCellSize(candidate);
  const noExtendableOverlapWithBoardArea = checkNoExtendableOverlap(candidate);
  const confidenceAboveThreshold = checkConfidenceAboveThreshold(candidate, opts);

  const geometricOk =
    boardAreaWithinSafeArea.ok &&
    boardAreaProportions.ok &&
    atLeastOneValidCellSize.ok &&
    noExtendableOverlapWithBoardArea.ok;

  return {
    ok: geometricOk,
    needsHumanReview: !confidenceAboveThreshold.ok,
    checks: {
      boardAreaWithinSafeArea,
      boardAreaProportions,
      atLeastOneValidCellSize,
      noExtendableOverlapWithBoardArea,
      confidenceAboveThreshold,
    },
  };
}
