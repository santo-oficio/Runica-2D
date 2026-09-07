/**
 * Esquemas de datos del proyecto Wappo Infinito.
 *
 * Tipos fieles a docs/06-ESQUEMAS-JSON.md y docs/10-ANALIZADOR-IA-FONDOS.md.
 * Todas las coordenadas de zonas de fondo son relativas (0.0–1.0) para
 * independencia de resolución. Las posiciones del mapa lógico son tuplas
 * [columna, fila] (0-indexed).
 */

// ---------------------------------------------------------------------------
// Primitivas compartidas
// ---------------------------------------------------------------------------

/** Rectángulo en coordenadas relativas (0.0–1.0) respecto al fondo. */
export interface RelativeRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Punto en coordenadas relativas (0.0–1.0). */
export interface RelativePoint {
  readonly x: number;
  readonly y: number;
}

/** Posición del mapa lógico como tupla [columna, fila] (0-indexed). */
export type CellPos = readonly [number, number];

/** Tamaño de tablero como tupla [columnas, filas]. */
export type BoardSize = readonly [number, number];

// ---------------------------------------------------------------------------
// 1. BackgroundTemplate (doc 06 §1) + Candidate (doc 10 §3)
// ---------------------------------------------------------------------------

/** Zona decorativa opcional, puede marcarse como extensible lateralmente. */
export interface DecorativeArea extends RelativeRect {
  readonly extendable: boolean;
}

/**
 * Plantilla de fondo definitiva (la que consume el motor en tiempo real).
 * Generada una vez por el analizador (IA de visión o editor manual) y
 * validada antes de guardarse.
 */
export interface BackgroundTemplate {
  readonly id: string;
  readonly world: string;
  readonly image: string;
  readonly safeArea: RelativeRect;
  readonly boardArea: RelativeRect;
  readonly marginPx: number;
  readonly allowedCellSizes: readonly number[];
  readonly anchorPoints: Readonly<Record<string, RelativePoint>>;
  readonly decorativeAreas?: readonly DecorativeArea[];
}

/**
 * Rejilla sugerida por el analizador de fondos. No es vinculante: la
 * decisión final de columnas/filas la toma el Level Generator.
 */
export interface SuggestedGrid {
  readonly columns: number;
  readonly columnsRange: readonly [number, number];
  readonly rows: number;
  readonly rowsRange: readonly [number, number];
}

/**
 * Salida del analizador IA de visión (doc 10 §3). Añade al BackgroundTemplate
 * los campos propios de la fase de análisis: `suggestedGrid`, `confidence` y
 * `notes`. Estos tres NO van al BackgroundTemplate final guardado.
 */
export interface BackgroundTemplateCandidate extends BackgroundTemplate {
  readonly suggestedGrid: SuggestedGrid;
  readonly confidence: number;
  readonly notes: string;
}

// ---------------------------------------------------------------------------
// 2. LevelMap (doc 06 §2)
// ---------------------------------------------------------------------------

/** Patrones de movimiento de enemigos (doc 05 §4). */
export type EnemyPattern =
  | "PATRULLA_FIJA"
  | "PERSECUCION_SIMPLE"
  | "ALEATORIO_ACOTADO"
  | "VIGILANCIA_ZONA";

/** Enemigo colocado por el generador en el mapa lógico. */
export interface Enemy {
  readonly pos: CellPos;
  readonly pattern: EnemyPattern;
}

/** Arquetipos de forma del tablero (doc 03 §1). */
export type Archetype =
  | "RECTANGULO"
  | "L"
  | "T"
  | "CRUZ"
  | "PASILLO"
  | "CAMARA_CENTRAL"
  | "ANILLO"
  | "DOBLE_PASILLO"
  | "LABERINTO"
  | "IRREGULAR";

/**
 * Mapa lógico de un nivel: salida del Level Generator, entrada del Solver y
 * del Asset Resolver. `grid` es la representación humana-legible (filas de
 * caracteres); internamente se puede indexar como array 2D de enums.
 */
export interface LevelMap {
  readonly levelId: number;
  readonly seed: number;
  readonly world: string;
  readonly backgroundTemplateId: string;
  readonly archetype: Archetype;
  readonly width: number;
  readonly height: number;
  readonly grid: readonly string[];
  readonly player: CellPos;
  readonly enemies: readonly Enemy[];
  readonly goal: CellPos;
  readonly keys: readonly CellPos[];
  readonly doors: readonly CellPos[];
  readonly rulesetVersion: string;
}

// ---------------------------------------------------------------------------
// 3. ValidationResult (doc 06 §3)
// ---------------------------------------------------------------------------

/**
 * Resultado de los 10 chequeos del validador (doc 04 §1). Cada uno debe ser
 * independiente y componible, con su propio test.
 */
export interface ValidationChecks {
  readonly withinBoardArea: boolean;
  readonly gridAligned: boolean;
  readonly noDecorationOverlap: boolean;
  readonly tilingResolved: boolean;
  readonly entitiesFit: boolean;
  readonly noImpossiblePositions: boolean;
  readonly solvable: boolean;
  readonly difficultyInRange: boolean;
  readonly notTrivial: boolean;
  readonly noAbsurdSituations: boolean;
}

/** Solución encontrada por el solver (solo metadatos, no el path completo). */
export interface SolutionInfo {
  readonly minMoves: number;
  readonly path: string;
}

/** Salida del Solver/Validador: decide si un LevelMap entra al banco. */
export interface ValidationResult {
  readonly levelId: number;
  readonly valid: boolean;
  readonly checks: ValidationChecks;
  readonly solution: SolutionInfo;
  readonly difficultyScore: number;
  readonly rejectionReason: string | null;
}

// ---------------------------------------------------------------------------
// 4. WorldConfig (doc 06 §4 / doc 07)
// ---------------------------------------------------------------------------

/** Diccionario de assets de casillas del mundo (auto-tiling). */
export interface TileAssets {
  readonly floor: string;
  readonly wallEdgeTop: string;
  readonly wallCornerTopLeft: string;
  readonly player: string;
  readonly enemyDefault: string;
  readonly goal: string;
  readonly [key: string]: string;
}

/** Franja de progresión de dificultad de un mundo. */
export interface DifficultyBand {
  readonly range: readonly [number, number];
  readonly stars: number;
  readonly maxEnemies: number;
}

/** Configuración completa de un mundo (añadir mundo = añadir datos, no código). */
export interface WorldConfig {
  readonly world: string;
  readonly backgroundTemplates: readonly string[];
  readonly tileAssets: TileAssets;
  readonly allowedBoardSizes: readonly BoardSize[];
  readonly difficultyTable: readonly DifficultyBand[];
}

// ---------------------------------------------------------------------------
// 5. Banco de niveles (doc 06 §5)
// ---------------------------------------------------------------------------

/** Entrada del índice del banco de niveles (solo niveles ya validados). */
export interface LevelBankEntry {
  readonly levelId: number;
  readonly seed: number;
  readonly difficultyScore: number;
  readonly minMoves: number;
}

/** Índice de niveles válidos de un mundo, para servir por progresión. */
export interface LevelBank {
  readonly world: string;
  readonly levels: readonly LevelBankEntry[];
}
