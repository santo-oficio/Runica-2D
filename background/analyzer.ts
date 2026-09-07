/**
 * Analizador de plantillas de fondo (docs/02-MOTOR-GRAFICO.md §1 + 10-ANALIZADOR-IA-FONDOS.md).
 *
 * Es una herramienta offline (se ejecuta una vez por fondo nuevo, no en cada
 * partida). Para cada imagen en `assets/backgrounds/<MUNDO>/`:
 *   1. Construye el prompt de instrucción (doc 10 §4, tal cual).
 *   2. Llama a un `VisionProvider` (Claude con visión, GLM-4V, mock...).
 *   3. Parsea la respuesta como JSON → `BackgroundTemplateCandidate`.
 *   4. Valida el esquema y ejecuta los chequeos de sanidad (doc 10 §5).
 *   5. Devuelve un `AnalysisResult` con la plantilla, el informe de sanidad
 *      y el flag `needsHumanReview` (confidence < umbral, no bloqueante).
 *
 * La IA de visión propone; el sistema geométrico decide (regla de oro).
 */

import type {
  BackgroundTemplate,
  BackgroundTemplateCandidate,
} from "../schemas/types.js";
import { SchemaError, validateBackgroundTemplateCandidate } from "../schemas/validate.js";
import {
  DEFAULT_SANITY_OPTIONS,
  runSanityChecks,
  type SanityOptions,
  type TemplateSanityReport,
} from "./sanity-checks.js";
import type { VisionImage, VisionProvider, VisionResponse } from "./vision-provider.js";

// ---------------------------------------------------------------------------
// Prompt de instrucción (doc 10 §4, textual)
// ---------------------------------------------------------------------------

/**
 * Prompt de instrucción para el modelo de visión, tomado literalmente de
 * docs/10-ANALIZADOR-IA-FONDOS.md §4. Se inyecta el `world` y el `imageId`
 * esperados para que la IA los devuelva en el JSON.
 */
export function buildInstructionPrompt(world: string, imageId: string, imageFilename: string): string {
  return [
    `Analiza esta imagen de fondo de un juego de puzzles tipo Wappo, estilo`,
    `pixel-art/retro. Devuelve EXCLUSIVAMENTE un JSON (sin texto adicional) con esta`,
    `forma: { id, world, image, safeArea, boardArea, suggestedGrid, anchorPoints,`,
    `decorativeAreas, confidence, notes }.`,
    ``,
    `Reglas:`,
    `- Todas las coordenadas de área (x, y, width, height) son relativas (0.0–1.0`,
    `  respecto al ancho/alto total de la imagen), nunca píxeles absolutos.`,
    `- boardArea debe ser la zona más despejada/neutra pensada para colocar`,
    `  casillas de juego, sin tapar elementos centrales de la composición`,
    `  (personajes, naves, iconografía del mundo).`,
    `- decorativeAreas con extendable=true son zonas que se podrían repetir o`,
    `  ampliar lateralmente sin romper la composición (para adaptar a pantalla`,
    `  panorámica). Márcalas solo si realmente son repetibles (ej. patrones de`,
    `  estrellas, texturas de fondo homogéneas), NUNCA si contienen elementos`,
    `  únicos (naves, letreros, personajes).`,
    `- suggestedGrid.columns/rows deben ser números razonables dado el tamaño de`,
    `  boardArea; incluye también un rango (columnsRange, rowsRange) de valores`,
    `  aceptables.`,
    `- confidence entre 0.0 y 1.0: baja si la imagen es ambigua o no está claro`,
    `  dónde debería ir el tablero.`,
    `- No inventes anchorPoints si no hay un marco o referencia visual clara.`,
    ``,
    `Valores esperados para esta imagen en concreto:`,
    `- id: "${imageId}"`,
    `- world: "${world}"`,
    `- image: "${imageFilename}"`,
    `- allowedCellSizes: [48, 56, 64, 72, 80]`,
    `- marginPx: 3`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Resultado del análisis
// ---------------------------------------------------------------------------

/** Resultado de analizar una imagen de fondo. */
export interface AnalysisResult {
  readonly imageFilename: string;
  readonly world: string;
  readonly imageId: string;
  /** Plantilla candidata parseada y validada por esquema. */
  readonly candidate: BackgroundTemplateCandidate;
  /** Informe de los chequeos de sanidad (doc 10 §5). */
  readonly sanity: TemplateSanityReport;
  /** Plantilla definitiva (sin confidence/notes/suggestedGrid) si todo pasa. */
  readonly template: BackgroundTemplate | null;
  /** true si confidence < umbral (no bloqueante, requiere revisión humana). */
  readonly needsHumanReview: boolean;
  /** true si la plantilla está lista para usar (sanity.ok === true). */
  readonly accepted: boolean;
  /** Error de parseo/esquema si la IA devolvió JSON inválido. */
  readonly parseError: string | null;
  /** Respuesta cruda del modelo (para depuración). */
  readonly raw: VisionResponse;
}

// ---------------------------------------------------------------------------
// Parseo de la respuesta del modelo
// ---------------------------------------------------------------------------

/**
 * Extrae el primer objeto JSON válido del texto de respuesta del modelo.
 * Soporta: JSON puro, JSON dentro de bloque ```json ... ```, o JSON embebido
 * en prosa (extrae el primer `{ ... }` balanceado).
 */
export function extractJson(content: string): string {
  const trimmed = content.trim();
  // Caso 1: bloque ```json ... ```
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) {
    return fence[1].trim();
  }
  // Caso 2: extraer primer bloque balanceado { ... }
  const start = trimmed.indexOf("{");
  if (start === -1) throw new Error("no se encontró '{' en la respuesta del modelo");
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i]!;
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
    } else {
      if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return trimmed.slice(start, i + 1);
      }
    }
  }
  throw new Error("JSON no balanceado en la respuesta del modelo");
}

// ---------------------------------------------------------------------------
// Analizador
// ---------------------------------------------------------------------------

/** Opciones del analizador. */
export interface AnalyzerOptions {
  readonly sanity: SanityOptions;
}

export const DEFAULT_ANALYZER_OPTIONS: AnalyzerOptions = {
  sanity: DEFAULT_SANITY_OPTIONS,
};

/**
 * Analiza una imagen de fondo y produce una `BackgroundTemplateCandidate`
 * validada + informe de sanidad.
 *
 * Lanza error si el proveedor de visión falla o si la respuesta no es JSON
 * válido. NO lanza por fallos de sanidad: se reflejan en `result.sanity`
 * y `result.accepted`.
 */
export async function analyzeBackground(
  image: VisionImage,
  world: string,
  imageId: string,
  provider: VisionProvider,
  opts: AnalyzerOptions = DEFAULT_ANALYZER_OPTIONS,
): Promise<AnalysisResult> {
  // 1. Construir prompt
  const prompt = buildInstructionPrompt(world, imageId, image.filename);

  // 2. Llamar al modelo de visión
  const raw = await provider.analyze(image, prompt);

  // 3. Extraer y parsear JSON
  let parseError: string | null = null;
  let candidate: BackgroundTemplateCandidate;
  try {
    const jsonStr = extractJson(raw.content);
    const parsed = JSON.parse(jsonStr) as unknown;
    candidate = validateBackgroundTemplateCandidate("candidate", parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof SchemaError) {
      parseError = `esquema inválido: ${msg}`;
    } else {
      parseError = `parseo JSON fallido: ${msg}`;
    }
    // Re-lanzar para que el caller decida (el CLI lo captura y registra).
    throw new Error(`Análisis de "${image.filename}" fallido: ${parseError}\nRespuesta cruda:\n${raw.content.slice(0, 500)}`);
  }

  // 4. Chequeos de sanidad (doc 10 §5)
  const sanity = runSanityChecks(candidate, opts.sanity);

  // 5. Construir plantilla definitiva si pasa sanidad geométrica
  const template: BackgroundTemplate | null = sanity.ok
    ? {
        id: candidate.id,
        world: candidate.world,
        image: candidate.image,
        safeArea: candidate.safeArea,
        boardArea: candidate.boardArea,
        marginPx: candidate.marginPx,
        allowedCellSizes: candidate.allowedCellSizes,
        anchorPoints: candidate.anchorPoints,
        decorativeAreas: candidate.decorativeAreas,
      }
    : null;

  return {
    imageFilename: image.filename,
    world,
    imageId,
    candidate,
    sanity,
    template,
    needsHumanReview: sanity.needsHumanReview,
    accepted: sanity.ok,
    parseError,
    raw,
  };
}
