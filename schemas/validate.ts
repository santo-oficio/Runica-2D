/**
 * Validadores de esquemas. Cada función recibe `unknown` y devuelve el dato
 * tipado si es válido, o lanza `SchemaError` con un mensaje descriptivo.
 *
 * Son validadores geométricos/de tipo simples (sin IA), pensados para tests
 * unitarios y para proteger el pipeline de entradas malformadas.
 */

import type {
  BackgroundTemplate,
  BackgroundTemplateCandidate,
  CellPos,
  BoardSize,
  DecorativeArea,
  DifficultyBand,
  Enemy,
  EnemyPattern,
  LevelBank,
  LevelBankEntry,
  LevelMap,
  Archetype,
  RelativePoint,
  RelativeRect,
  SolutionInfo,
  SuggestedGrid,
  TileAssets,
  ValidationChecks,
  ValidationResult,
  WorldConfig,
} from "./types.js";

// ---------------------------------------------------------------------------
// Errores y helpers
// ---------------------------------------------------------------------------

/** Error de validación de esquema con ruta del campo problemática. */
export class SchemaError extends Error {
  readonly path: string;
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "SchemaError";
    this.path = path;
  }
}

const EPS = 1e-9;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(path: string, v: unknown): string {
  if (typeof v !== "string") throw new SchemaError(path, `se esperaba string, se obtuvo ${typeof v}`);
  return v;
}

function asNonEmptyString(path: string, v: unknown): string {
  const s = asString(path, v);
  if (s.length === 0) throw new SchemaError(path, "string vacío no permitido");
  return s;
}

function asNumber(path: string, v: unknown): number {
  if (typeof v !== "number" || Number.isNaN(v)) {
    throw new SchemaError(path, `se esperaba number, se obtuvo ${typeof v}`);
  }
  return v;
}

function asFiniteNumber(path: string, v: unknown): number {
  const n = asNumber(path, v);
  if (!Number.isFinite(n)) throw new SchemaError(path, "number no finito");
  return n;
}

function asBoolean(path: string, v: unknown): boolean {
  if (typeof v !== "boolean") throw new SchemaError(path, `se esperaba boolean, se obtuvo ${typeof v}`);
  return v;
}

function asArray(path: string, v: unknown): unknown[] {
  if (!Array.isArray(v)) throw new SchemaError(path, `se esperaba array, se obtuvo ${typeof v}`);
  return v;
}

function asInt(path: string, v: unknown): number {
  const n = asFiniteNumber(path, v);
  if (!Number.isInteger(n)) throw new SchemaError(path, `se esperaba entero, se obtuvo ${n}`);
  return n;
}

function asNonNegativeInt(path: string, v: unknown): number {
  const n = asInt(path, v);
  if (n < 0) throw new SchemaError(path, `se esperaba entero >= 0, se obtuvo ${n}`);
  return n;
}

function asPositiveInt(path: string, v: unknown): number {
  const n = asInt(path, v);
  if (n <= 0) throw new SchemaError(path, `se esperaba entero > 0, se obtuvo ${n}`);
  return n;
}

function inRange(path: string, n: number, min: number, max: number): number {
  if (n < min - EPS || n > max + EPS) {
    throw new SchemaError(path, `se esperaba valor en [${min}, ${max}], se obtuvo ${n}`);
  }
  return n;
}

function oneOf<T extends string>(path: string, v: unknown, allowed: readonly T[]): T {
  const s = asString(path, v);
  if (!allowed.includes(s as T)) {
    throw new SchemaError(path, `valor no válido: "${s}". Permitidos: ${allowed.join(", ")}`);
  }
  return s as T;
}

// ---------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------

export function validateRelativeRect(path: string, v: unknown): RelativeRect {
  if (!isObject(v)) throw new SchemaError(path, "se esperaba objeto RelativeRect");
  const x = inRange(`${path}.x`, asFiniteNumber(`${path}.x`, v.x), 0, 1);
  const y = inRange(`${path}.y`, asFiniteNumber(`${path}.y`, v.y), 0, 1);
  const width = inRange(`${path}.width`, asFiniteNumber(`${path}.width`, v.width), 0, 1);
  const height = inRange(`${path}.height`, asFiniteNumber(`${path}.height`, v.height), 0, 1);
  if (width <= EPS) throw new SchemaError(`${path}.width`, "debe ser > 0");
  if (height <= EPS) throw new SchemaError(`${path}.height`, "debe ser > 0");
  if (x + width > 1 + EPS) throw new SchemaError(path, `x+width=${x + width} excede 1.0`);
  if (y + height > 1 + EPS) throw new SchemaError(path, `y+height=${y + height} excede 1.0`);
  return { x, y, width, height };
}

export function validateRelativePoint(path: string, v: unknown): RelativePoint {
  if (!isObject(v)) throw new SchemaError(path, "se esperaba objeto RelativePoint");
  const x = inRange(`${path}.x`, asFiniteNumber(`${path}.x`, v.x), 0, 1);
  const y = inRange(`${path}.y`, asFiniteNumber(`${path}.y`, v.y), 0, 1);
  return { x, y };
}

export function validateCellPos(path: string, v: unknown): CellPos {
  const arr = asArray(path, v);
  if (arr.length !== 2) throw new SchemaError(path, `se esperaba tupla [col, row], longitud=${arr.length}`);
  const col = asNonNegativeInt(`${path}[0]`, arr[0]);
  const row = asNonNegativeInt(`${path}[1]`, arr[1]);
  return [col, row] as const;
}

export function validateBoardSize(path: string, v: unknown): BoardSize {
  const arr = asArray(path, v);
  if (arr.length !== 2) throw new SchemaError(path, `se esperaba tupla [cols, rows], longitud=${arr.length}`);
  const cols = asPositiveInt(`${path}[0]`, arr[0]);
  const rows = asPositiveInt(`${path}[1]`, arr[1]);
  return [cols, rows] as const;
}

function validateDecorativeArea(path: string, v: unknown): DecorativeArea {
  if (!isObject(v)) throw new SchemaError(path, "se esperaba objeto DecorativeArea");
  const rect = validateRelativeRect(path, v);
  const extendable = asBoolean(`${path}.extendable`, v.extendable);
  return { ...rect, extendable };
}

// ---------------------------------------------------------------------------
// 1. BackgroundTemplate / Candidate
// ---------------------------------------------------------------------------

const ARCHETYPES: readonly Archetype[] = [
  "RECTANGULO", "L", "T", "CRUZ", "PASILLO", "CAMARA_CENTRAL",
  "ANILLO", "DOBLE_PASILLO", "LABERINTO", "IRREGULAR",
];

const ENEMY_PATTERNS: readonly EnemyPattern[] = [
  "PATRULLA_FIJA", "PERSECUCION_SIMPLE", "ALEATORIO_ACOTADO", "VIGILANCIA_ZONA",
];

export function isArchetype(v: unknown): v is Archetype {
  return typeof v === "string" && (ARCHETYPES as readonly string[]).includes(v);
}

export function isEnemyPattern(v: unknown): v is EnemyPattern {
  return typeof v === "string" && (ENEMY_PATTERNS as readonly string[]).includes(v);
}

export function validateBackgroundTemplate(path: string, v: unknown): BackgroundTemplate {
  if (!isObject(v)) throw new SchemaError(path, "se esperaba objeto BackgroundTemplate");
  const id = asNonEmptyString(`${path}.id`, v.id);
  const world = asNonEmptyString(`${path}.world`, v.world);
  const image = asNonEmptyString(`${path}.image`, v.image);
  const safeArea = validateRelativeRect(`${path}.safeArea`, v.safeArea);
  const boardArea = validateRelativeRect(`${path}.boardArea`, v.boardArea);
  const marginPx = asNonNegativeInt(`${path}.marginPx`, v.marginPx);
  const sizesArr = asArray(`${path}.allowedCellSizes`, v.allowedCellSizes);
  if (sizesArr.length === 0) throw new SchemaError(`${path}.allowedCellSizes`, "no puede estar vacío");
  const allowedCellSizes = sizesArr.map((s, i) => asPositiveInt(`${path}.allowedCellSizes[${i}]`, s));
  const anchorRaw = v.anchorPoints;
  if (!isObject(anchorRaw)) throw new SchemaError(`${path}.anchorPoints`, "se esperaba objeto");
  const anchorPoints: Record<string, RelativePoint> = {};
  for (const key of Object.keys(anchorRaw)) {
    anchorPoints[key] = validateRelativePoint(`${path}.anchorPoints.${key}`, anchorRaw[key]);
  }
  let decorativeAreas: readonly DecorativeArea[] | undefined;
  if (v.decorativeAreas !== undefined) {
    const darr = asArray(`${path}.decorativeAreas`, v.decorativeAreas);
    decorativeAreas = darr.map((d, i) => validateDecorativeArea(`${path}.decorativeAreas[${i}]`, d));
  }
  return { id, world, image, safeArea, boardArea, marginPx, allowedCellSizes, anchorPoints, decorativeAreas };
}

export function validateSuggestedGrid(path: string, v: unknown): SuggestedGrid {
  if (!isObject(v)) throw new SchemaError(path, "se esperaba objeto SuggestedGrid");
  const columns = asPositiveInt(`${path}.columns`, v.columns);
  const rows = asPositiveInt(`${path}.rows`, v.rows);
  const cr = asArray(`${path}.columnsRange`, v.columnsRange);
  if (cr.length !== 2) throw new SchemaError(`${path}.columnsRange`, "tupla de 2 elementos");
  const cMin = asPositiveInt(`${path}.columnsRange[0]`, cr[0]);
  const cMax = asPositiveInt(`${path}.columnsRange[1]`, cr[1]);
  if (cMin > cMax) throw new SchemaError(`${path}.columnsRange`, `min ${cMin} > max ${cMax}`);
  const rr = asArray(`${path}.rowsRange`, v.rowsRange);
  if (rr.length !== 2) throw new SchemaError(`${path}.rowsRange`, "tupla de 2 elementos");
  const rMin = asPositiveInt(`${path}.rowsRange[0]`, rr[0]);
  const rMax = asPositiveInt(`${path}.rowsRange[1]`, rr[1]);
  if (rMin > rMax) throw new SchemaError(`${path}.rowsRange`, `min ${rMin} > max ${rMax}`);
  if (columns < cMin || columns > cMax) throw new SchemaError(`${path}.columns`, `${columns} fuera de rango [${cMin},${cMax}]`);
  if (rows < rMin || rows > rMax) throw new SchemaError(`${path}.rows`, `${rows} fuera de rango [${rMin},${rMax}]`);
  return { columns, columnsRange: [cMin, cMax] as const, rows, rowsRange: [rMin, rMax] as const };
}

export function validateBackgroundTemplateCandidate(path: string, v: unknown): BackgroundTemplateCandidate {
  const base = validateBackgroundTemplate(path, v);
  if (!isObject(v)) throw new SchemaError(path, "se esperaba objeto"); // ya validado arriba, salvaguarda
  const suggestedGrid = validateSuggestedGrid(`${path}.suggestedGrid`, v.suggestedGrid);
  const confidence = inRange(`${path}.confidence`, asFiniteNumber(`${path}.confidence`, v.confidence), 0, 1);
  const notes = asString(`${path}.notes`, v.notes);
  return { ...base, suggestedGrid, confidence, notes };
}

// ---------------------------------------------------------------------------
// 2. LevelMap
// ---------------------------------------------------------------------------

function validateEnemy(path: string, v: unknown, width: number, height: number): Enemy {
  if (!isObject(v)) throw new SchemaError(path, "se esperaba objeto Enemy");
  const pos = validateCellPos(`${path}.pos`, v.pos);
  const [col, row] = pos;
  if (col >= width) throw new SchemaError(`${path}.pos`, `col ${col} fuera del tablero (width=${width})`);
  if (row >= height) throw new SchemaError(`${path}.pos`, `row ${row} fuera del tablero (height=${height})`);
  const pattern = oneOf(`${path}.pattern`, v.pattern, ENEMY_PATTERNS);
  return { pos, pattern };
}

function validateCellPosInBounds(path: string, v: unknown, width: number, height: number): CellPos {
  const pos = validateCellPos(path, v);
  const [col, row] = pos;
  if (col >= width) throw new SchemaError(path, `col ${col} fuera del tablero (width=${width})`);
  if (row >= height) throw new SchemaError(path, `row ${row} fuera del tablero (height=${height})`);
  return pos;
}

export function validateLevelMap(path: string, v: unknown): LevelMap {
  if (!isObject(v)) throw new SchemaError(path, "se esperaba objeto LevelMap");
  const levelId = asInt(`${path}.levelId`, v.levelId);
  const seed = asInt(`${path}.seed`, v.seed);
  const world = asNonEmptyString(`${path}.world`, v.world);
  const backgroundTemplateId = asNonEmptyString(`${path}.backgroundTemplateId`, v.backgroundTemplateId);
  const archetype = oneOf(`${path}.archetype`, v.archetype, ARCHETYPES);
  const width = asPositiveInt(`${path}.width`, v.width);
  const height = asPositiveInt(`${path}.height`, v.height);
  const gridArr = asArray(`${path}.grid`, v.grid);
  if (gridArr.length !== height) {
    throw new SchemaError(`${path}.grid`, `longitud ${gridArr.length} != height ${height}`);
  }
  const grid = gridArr.map((row, i) => {
    const s = asString(`${path}.grid[${i}]`, row);
    if (s.length !== width) {
      throw new SchemaError(`${path}.grid[${i}]`, `longitud ${s.length} != width ${width}`);
    }
    return s;
  });
  const player = validateCellPosInBounds(`${path}.player`, v.player, width, height);
  const enemiesArr = asArray(`${path}.enemies`, v.enemies);
  const enemies = enemiesArr.map((e, i) => validateEnemy(`${path}.enemies[${i}]`, e, width, height));
  const goal = validateCellPosInBounds(`${path}.goal`, v.goal, width, height);
  const keysArr = asArray(`${path}.keys`, v.keys);
  const keys = keysArr.map((k, i) => validateCellPosInBounds(`${path}.keys[${i}]`, k, width, height));
  const doorsArr = asArray(`${path}.doors`, v.doors);
  const doors = doorsArr.map((d, i) => validateCellPosInBounds(`${path}.doors[${i}]`, d, width, height));
  const rulesetVersion = asNonEmptyString(`${path}.rulesetVersion`, v.rulesetVersion);
  return { levelId, seed, world, backgroundTemplateId, archetype, width, height, grid, player, enemies, goal, keys, doors, rulesetVersion };
}

// ---------------------------------------------------------------------------
// 3. ValidationResult
// ---------------------------------------------------------------------------

const CHECK_KEYS: readonly (keyof ValidationChecks)[] = [
  "withinBoardArea", "gridAligned", "noDecorationOverlap", "tilingResolved",
  "entitiesFit", "noImpossiblePositions", "solvable", "difficultyInRange",
  "notTrivial", "noAbsurdSituations",
];

function validateSolutionInfo(path: string, v: unknown): SolutionInfo {
  if (!isObject(v)) throw new SchemaError(path, "se esperaba objeto SolutionInfo");
  const minMoves = asNonNegativeInt(`${path}.minMoves`, v.minMoves);
  const pathStr = asString(`${path}.path`, v.path);
  return { minMoves, path: pathStr };
}

export function validateValidationResult(path: string, v: unknown): ValidationResult {
  if (!isObject(v)) throw new SchemaError(path, "se esperaba objeto ValidationResult");
  const levelId = asInt(`${path}.levelId`, v.levelId);
  const valid = asBoolean(`${path}.valid`, v.valid);
  const checksRaw = v.checks;
  if (!isObject(checksRaw)) throw new SchemaError(`${path}.checks`, "se esperaba objeto");
  const checks: Record<string, boolean> = {};
  for (const k of CHECK_KEYS) {
    if (!(k in checksRaw)) throw new SchemaError(`${path}.checks.${k}`, "falta clave obligatoria");
    checks[k] = asBoolean(`${path}.checks.${k}`, checksRaw[k]);
  }
  const solution = validateSolutionInfo(`${path}.solution`, v.solution);
  const difficultyScore = asFiniteNumber(`${path}.difficultyScore`, v.difficultyScore);
  if (difficultyScore < 0) throw new SchemaError(`${path}.difficultyScore`, "debe ser >= 0");
  let rejectionReason: string | null = null;
  if (v.rejectionReason === null) rejectionReason = null;
  else if (v.rejectionReason === undefined) rejectionReason = null;
  else rejectionReason = asString(`${path}.rejectionReason`, v.rejectionReason);
  return { levelId, valid, checks: checks as unknown as ValidationChecks, solution, difficultyScore, rejectionReason };
}

// ---------------------------------------------------------------------------
// 4. WorldConfig
// ---------------------------------------------------------------------------

function validateTileAssets(path: string, v: unknown): TileAssets {
  if (!isObject(v)) throw new SchemaError(path, "se esperaba objeto TileAssets");
  const required = ["floor", "wallEdgeTop", "wallCornerTopLeft", "player", "enemyDefault", "goal"];
  const out: Record<string, string> = {};
  for (const k of required) {
    if (!(k in v)) throw new SchemaError(`${path}.${k}`, "falta clave obligatoria");
    out[k] = asNonEmptyString(`${path}.${k}`, v[k]);
  }
  for (const k of Object.keys(v)) {
    if (k in out) continue;
    out[k] = asNonEmptyString(`${path}.${k}`, v[k]);
  }
  return out as TileAssets;
}

function validateDifficultyBand(path: string, v: unknown): DifficultyBand {
  if (!isObject(v)) throw new SchemaError(path, "se esperaba objeto DifficultyBand");
  const r = asArray(`${path}.range`, v.range);
  if (r.length !== 2) throw new SchemaError(`${path}.range`, "tupla de 2 elementos");
  const lo = asPositiveInt(`${path}.range[0]`, r[0]);
  const hi = asPositiveInt(`${path}.range[1]`, r[1]);
  if (lo > hi) throw new SchemaError(`${path}.range`, `min ${lo} > max ${hi}`);
  const stars = asPositiveInt(`${path}.stars`, v.stars);
  const maxEnemies = asNonNegativeInt(`${path}.maxEnemies`, v.maxEnemies);
  return { range: [lo, hi] as const, stars, maxEnemies };
}

export function validateWorldConfig(path: string, v: unknown): WorldConfig {
  if (!isObject(v)) throw new SchemaError(path, "se esperaba objeto WorldConfig");
  const world = asNonEmptyString(`${path}.world`, v.world);
  const btArr = asArray(`${path}.backgroundTemplates`, v.backgroundTemplates);
  if (btArr.length === 0) throw new SchemaError(`${path}.backgroundTemplates`, "no puede estar vacío");
  const backgroundTemplates = btArr.map((b, i) => asNonEmptyString(`${path}.backgroundTemplates[${i}]`, b));
  const tileAssets = validateTileAssets(`${path}.tileAssets`, v.tileAssets);
  const sizesArr = asArray(`${path}.allowedBoardSizes`, v.allowedBoardSizes);
  if (sizesArr.length === 0) throw new SchemaError(`${path}.allowedBoardSizes`, "no puede estar vacío");
  const allowedBoardSizes = sizesArr.map((s, i) => validateBoardSize(`${path}.allowedBoardSizes[${i}]`, s));
  const dtArr = asArray(`${path}.difficultyTable`, v.difficultyTable);
  if (dtArr.length === 0) throw new SchemaError(`${path}.difficultyTable`, "no puede estar vacío");
  const difficultyTable = dtArr.map((d, i) => validateDifficultyBand(`${path}.difficultyTable[${i}]`, d));
  return { world, backgroundTemplates, tileAssets, allowedBoardSizes, difficultyTable };
}

// ---------------------------------------------------------------------------
// 5. LevelBank
// ---------------------------------------------------------------------------

function validateLevelBankEntry(path: string, v: unknown): LevelBankEntry {
  if (!isObject(v)) throw new SchemaError(path, "se esperaba objeto LevelBankEntry");
  const levelId = asInt(`${path}.levelId`, v.levelId);
  const seed = asInt(`${path}.seed`, v.seed);
  const difficultyScore = asFiniteNumber(`${path}.difficultyScore`, v.difficultyScore);
  if (difficultyScore < 0) throw new SchemaError(`${path}.difficultyScore`, "debe ser >= 0");
  const minMoves = asNonNegativeInt(`${path}.minMoves`, v.minMoves);
  return { levelId, seed, difficultyScore, minMoves };
}

export function validateLevelBank(path: string, v: unknown): LevelBank {
  if (!isObject(v)) throw new SchemaError(path, "se esperaba objeto LevelBank");
  const world = asNonEmptyString(`${path}.world`, v.world);
  const levelsArr = asArray(`${path}.levels`, v.levels);
  const levels = levelsArr.map((l, i) => validateLevelBankEntry(`${path}.levels[${i}]`, l));
  return { world, levels };
}

// ---------------------------------------------------------------------------
// Punto de entrada conveniente: valida por nombre de esquema
// ---------------------------------------------------------------------------

export type SchemaName =
  | "BackgroundTemplate"
  | "BackgroundTemplateCandidate"
  | "LevelMap"
  | "ValidationResult"
  | "WorldConfig"
  | "LevelBank";

export function validateSchema(name: SchemaName, v: unknown): unknown {
  switch (name) {
    case "BackgroundTemplate": return validateBackgroundTemplate("BackgroundTemplate", v);
    case "BackgroundTemplateCandidate": return validateBackgroundTemplateCandidate("BackgroundTemplateCandidate", v);
    case "LevelMap": return validateLevelMap("LevelMap", v);
    case "ValidationResult": return validateValidationResult("ValidationResult", v);
    case "WorldConfig": return validateWorldConfig("WorldConfig", v);
    case "LevelBank": return validateLevelBank("LevelBank", v);
  }
}
