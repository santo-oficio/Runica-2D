/**
 * Tests unitarios de los esquemas de datos (Fase 0).
 *
 * Para cada esquema se verifica:
 *  - que el ejemplo canónico de docs/06-ESQUEMAS-JSON.md / docs/10 parsea
 *    correctamente y devuelve el dato tipado esperado,
 *  - que variantes inválidas lanzan `SchemaError` con la ruta del campo
 *    problemática.
 */

import { describe, it, expect } from "vitest";
import {
  SchemaError,
  validateBackgroundTemplate,
  validateBackgroundTemplateCandidate,
  validateCellPos,
  validateBoardSize,
  validateLevelBank,
  validateLevelMap,
  validateRelativeRect,
  validateSchema,
  validateValidationResult,
  validateWorldConfig,
} from "../schemas/validate.js";
import {
  backgroundTemplateCandidateExample,
  backgroundTemplateExample,
  levelBankExample,
  levelMapExample,
  validationResultExample,
  worldConfigExample,
} from "../schemas/examples.js";

/** Versión mutable (un nivel) de T, para poder mutar clones en tests. */
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** Clona un objeto plano de forma segura para mutar en tests. */
function clone<T>(v: T): Mutable<T> {
  return JSON.parse(JSON.stringify(v)) as Mutable<T>;
}

/** Espera que `fn` lance un SchemaError cuyo mensaje contiene `pathFragment`. */
function expectSchemaError(fn: () => unknown, pathFragment: string): void {
  try {
    fn();
    expect.fail("se esperaba que lanzara SchemaError pero no lanzó nada");
  } catch (e) {
    expect(e).toBeInstanceOf(SchemaError);
    const msg = (e as SchemaError).message;
    expect(msg).toContain(pathFragment);
  }
}

// ---------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------

describe("primitivas", () => {
  it("validateRelativeRect acepta un rectángulo válido en [0,1]", () => {
    const r = validateRelativeRect("r", { x: 0.1, y: 0.2, width: 0.5, height: 0.3 });
    expect(r).toEqual({ x: 0.1, y: 0.2, width: 0.5, height: 0.3 });
  });

  it("validateRelativeRect rechaza x+width > 1", () => {
    expectSchemaError(
      () => validateRelativeRect("r", { x: 0.6, y: 0.0, width: 0.6, height: 0.1 }),
      "r",
    );
  });

  it("validateRelativeRect rechaza width <= 0", () => {
    expectSchemaError(
      () => validateRelativeRect("r", { x: 0.0, y: 0.0, width: 0.0, height: 0.1 }),
      "r.width",
    );
  });

  it("validateCellPos acepta [col,row] no negativos", () => {
    expect(validateCellPos("p", [3, 6])).toEqual([3, 6]);
  });

  it("validateCellPos rechaza tuplas de longitud != 2", () => {
    expectSchemaError(() => validateCellPos("p", [1, 2, 3]), "p");
  });

  it("validateCellPos rechaza negativos", () => {
    expectSchemaError(() => validateCellPos("p", [-1, 2]), "p[0]");
  });

  it("validateBoardSize acepta [cols,rows] positivos", () => {
    expect(validateBoardSize("b", [8, 6])).toEqual([8, 6]);
  });

  it("validateBoardSize rechaza cols = 0", () => {
    expectSchemaError(() => validateBoardSize("b", [0, 6]), "b[0]");
  });
});

// ---------------------------------------------------------------------------
// 1. BackgroundTemplate
// ---------------------------------------------------------------------------

describe("BackgroundTemplate", () => {
  it("parsea el ejemplo canónico", () => {
    const t = validateBackgroundTemplate("bt", backgroundTemplateExample);
    expect(t.id).toBe("SPACE_01");
    expect(t.world).toBe("ESPACIO");
    expect(t.allowedCellSizes).toEqual([48, 56, 64, 72, 80]);
    expect(t.decorativeAreas?.length).toBe(2);
    expect(t.decorativeAreas?.[0]?.extendable).toBe(true);
  });

  it("rechaza id vacío", () => {
    const bad = clone(backgroundTemplateExample);
    bad.id = "";
    expectSchemaError(() => validateBackgroundTemplate("bt", bad), "bt.id");
  });

  it("rechaza boardArea con x+width > 1", () => {
    const bad = clone(backgroundTemplateExample);
    bad.boardArea = { x: 0.8, y: 0.28, width: 0.5, height: 0.48 };
    expectSchemaError(() => validateBackgroundTemplate("bt", bad), "bt.boardArea");
  });

  it("rechaza allowedCellSizes vacío", () => {
    const bad = clone(backgroundTemplateExample);
    bad.allowedCellSizes = [];
    expectSchemaError(() => validateBackgroundTemplate("bt", bad), "bt.allowedCellSizes");
  });

  it("rechaza anchorPoints no objeto", () => {
    const bad = clone(backgroundTemplateExample);
    bad.anchorPoints = "nope" as unknown as typeof bad.anchorPoints;
    expectSchemaError(() => validateBackgroundTemplate("bt", bad), "bt.anchorPoints");
  });

  it("rechaza marginPx negativo", () => {
    const bad = clone(backgroundTemplateExample);
    bad.marginPx = -1;
    expectSchemaError(() => validateBackgroundTemplate("bt", bad), "bt.marginPx");
  });
});

// ---------------------------------------------------------------------------
// 1b. BackgroundTemplateCandidate
// ---------------------------------------------------------------------------

describe("BackgroundTemplateCandidate", () => {
  it("parsea el ejemplo canónico", () => {
    const c = validateBackgroundTemplateCandidate("c", backgroundTemplateCandidateExample);
    expect(c.confidence).toBeCloseTo(0.83);
    expect(c.suggestedGrid.columns).toBe(8);
    expect(c.notes.length).toBeGreaterThan(0);
  });

  it("rechaza confidence > 1", () => {
    const bad = clone(backgroundTemplateCandidateExample);
    bad.confidence = 1.5;
    expectSchemaError(() => validateBackgroundTemplateCandidate("c", bad), "c.confidence");
  });

  it("rechaza suggestedGrid.columns fuera de rango", () => {
    const bad = clone(backgroundTemplateCandidateExample);
    bad.suggestedGrid = { columns: 99, columnsRange: [6, 10], rows: 6, rowsRange: [5, 8] };
    expectSchemaError(() => validateBackgroundTemplateCandidate("c", bad), "c.suggestedGrid.columns");
  });

  it("rechaza columnsRange con min > max", () => {
    const bad = clone(backgroundTemplateCandidateExample);
    bad.suggestedGrid = { columns: 8, columnsRange: [10, 6], rows: 6, rowsRange: [5, 8] };
    expectSchemaError(() => validateBackgroundTemplateCandidate("c", bad), "c.suggestedGrid.columnsRange");
  });
});

// ---------------------------------------------------------------------------
// 2. LevelMap
// ---------------------------------------------------------------------------

describe("LevelMap", () => {
  it("parsea el ejemplo canónico", () => {
    const m = validateLevelMap("lm", levelMapExample);
    expect(m.levelId).toBe(48321);
    expect(m.seed).toBe(839271);
    expect(m.width).toBe(12);
    expect(m.height).toBe(10);
    expect(m.grid.length).toBe(10);
    expect(m.player).toEqual([3, 6]);
    expect(m.enemies.length).toBe(1);
    expect(m.enemies[0]?.pattern).toBe("PERSECUCION_SIMPLE");
  });

  it("rechaza grid con número de filas != height", () => {
    const bad = clone(levelMapExample);
    bad.grid = bad.grid.slice(0, 5);
    expectSchemaError(() => validateLevelMap("lm", bad), "lm.grid");
  });

  it("rechaza fila con longitud != width", () => {
    const bad = clone(levelMapExample);
    const rows = [...bad.grid];
    rows[0] = "###"; // demasiado corta
    bad.grid = rows;
    expectSchemaError(() => validateLevelMap("lm", bad), "lm.grid[0]");
  });

  it("rechaza player fuera de bounds", () => {
    const bad = clone(levelMapExample);
    bad.player = [99, 6];
    expectSchemaError(() => validateLevelMap("lm", bad), "lm.player");
  });

  it("rechaza archetype inválido", () => {
    const bad = clone(levelMapExample);
    bad.archetype = "CIRCULO" as unknown as typeof bad.archetype;
    expectSchemaError(() => validateLevelMap("lm", bad), "lm.archetype");
  });

  it("rechaza enemy con pattern inválido", () => {
    const bad = clone(levelMapExample);
    bad.enemies = [{ pos: [9, 4], pattern: "VOLADOR" as unknown as typeof bad.enemies[number]["pattern"] }];
    expectSchemaError(() => validateLevelMap("lm", bad), "lm.enemies[0].pattern");
  });

  it("rechaza enemy con pos fuera de bounds", () => {
    const bad = clone(levelMapExample);
    bad.enemies = [{ pos: [99, 4], pattern: "PERSECUCION_SIMPLE" }];
    expectSchemaError(() => validateLevelMap("lm", bad), "lm.enemies[0].pos");
  });
});

// ---------------------------------------------------------------------------
// 3. ValidationResult
// ---------------------------------------------------------------------------

describe("ValidationResult", () => {
  it("parsea el ejemplo canónico", () => {
    const r = validateValidationResult("vr", validationResultExample);
    expect(r.valid).toBe(true);
    expect(r.solution.minMoves).toBe(23);
    expect(r.difficultyScore).toBeCloseTo(7.2);
    expect(r.rejectionReason).toBeNull();
    expect(Object.keys(r.checks).length).toBe(10);
  });

  it("rechaza si falta una clave de checks", () => {
    const bad = clone(validationResultExample);
    delete (bad.checks as unknown as Record<string, unknown>).solvable;
    expectSchemaError(() => validateValidationResult("vr", bad), "vr.checks.solvable");
  });

  it("rechaza valid no boolean", () => {
    const bad = clone(validationResultExample);
    bad.valid = "yes" as unknown as boolean;
    expectSchemaError(() => validateValidationResult("vr", bad), "vr.valid");
  });

  it("rechaza difficultyScore negativo", () => {
    const bad = clone(validationResultExample);
    bad.difficultyScore = -1;
    expectSchemaError(() => validateValidationResult("vr", bad), "vr.difficultyScore");
  });

  it("acepta rejectionReason como string", () => {
    const bad = clone(validationResultExample);
    bad.valid = false;
    bad.rejectionReason = "objetivo inalcanzable";
    const r = validateValidationResult("vr", bad);
    expect(r.rejectionReason).toBe("objetivo inalcanzable");
  });
});

// ---------------------------------------------------------------------------
// 4. WorldConfig
// ---------------------------------------------------------------------------

describe("WorldConfig", () => {
  it("parsea el ejemplo canónico", () => {
    const w = validateWorldConfig("wc", worldConfigExample);
    expect(w.world).toBe("ESPACIO");
    expect(w.backgroundTemplates.length).toBe(3);
    expect(w.allowedBoardSizes.length).toBe(4);
    expect(w.difficultyTable.length).toBe(5);
    expect(w.tileAssets.floor).toBe("space_floor.png");
  });

  it("rechaza si tileAssets falta 'floor'", () => {
    const bad = clone(worldConfigExample);
    delete (bad.tileAssets as Record<string, unknown>).floor;
    expectSchemaError(() => validateWorldConfig("wc", bad), "wc.tileAssets.floor");
  });

  it("rechaza allowedBoardSizes vacío", () => {
    const bad = clone(worldConfigExample);
    bad.allowedBoardSizes = [];
    expectSchemaError(() => validateWorldConfig("wc", bad), "wc.allowedBoardSizes");
  });

  it("rechaza difficultyBand con range min > max", () => {
    const bad = clone(worldConfigExample);
    bad.difficultyTable = [{ range: [50, 10], stars: 3, maxEnemies: 2 }];
    expectSchemaError(() => validateWorldConfig("wc", bad), "wc.difficultyTable[0].range");
  });

  it("rechaza backgroundTemplates vacío", () => {
    const bad = clone(worldConfigExample);
    bad.backgroundTemplates = [];
    expectSchemaError(() => validateWorldConfig("wc", bad), "wc.backgroundTemplates");
  });
});

// ---------------------------------------------------------------------------
// 5. LevelBank
// ---------------------------------------------------------------------------

describe("LevelBank", () => {
  it("parsea el ejemplo canónico", () => {
    const b = validateLevelBank("lb", levelBankExample);
    expect(b.world).toBe("ESPACIO");
    expect(b.levels.length).toBe(2);
    expect(b.levels[0]?.levelId).toBe(48321);
  });

  it("rechaza world vacío", () => {
    const bad = clone(levelBankExample);
    bad.world = "";
    expectSchemaError(() => validateLevelBank("lb", bad), "lb.world");
  });

  it("rechaza entry con minMoves negativo", () => {
    const bad = clone(levelBankExample);
    bad.levels = [{ levelId: 1, seed: 1, difficultyScore: 1, minMoves: -5 }];
    expectSchemaError(() => validateLevelBank("lb", bad), "lb.levels[0].minMoves");
  });

  it("rechaza entry sin seed", () => {
    const bad = clone(levelBankExample);
    bad.levels = [{ levelId: 1, seed: undefined as unknown as number, difficultyScore: 1, minMoves: 5 }];
    expectSchemaError(() => validateLevelBank("lb", bad), "lb.levels[0].seed");
  });
});

// ---------------------------------------------------------------------------
// Punto de entrada validateSchema
// ---------------------------------------------------------------------------

describe("validateSchema (dispatch por nombre)", () => {
  it("valida cada esquema por nombre sin lanzar", () => {
    expect(() => validateSchema("BackgroundTemplate", backgroundTemplateExample)).not.toThrow();
    expect(() => validateSchema("BackgroundTemplateCandidate", backgroundTemplateCandidateExample)).not.toThrow();
    expect(() => validateSchema("LevelMap", levelMapExample)).not.toThrow();
    expect(() => validateSchema("ValidationResult", validationResultExample)).not.toThrow();
    expect(() => validateSchema("WorldConfig", worldConfigExample)).not.toThrow();
    expect(() => validateSchema("LevelBank", levelBankExample)).not.toThrow();
  });

  it("devuelve el dato tipado", () => {
    const r = validateSchema("WorldConfig", worldConfigExample) as { world: string };
    expect(r.world).toBe("ESPACIO");
  });
});
