/**
 * Tests de los chequeos de sanidad del analizador de fondos (doc 10 §5).
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_SANITY_OPTIONS,
  checkAtLeastOneValidCellSize,
  checkBoardAreaProportions,
  checkBoardAreaWithinSafeArea,
  checkConfidenceAboveThreshold,
  checkNoExtendableOverlap,
  rectContains,
  rectsOverlap,
  runSanityChecks,
} from "../background/sanity-checks.js";
import { backgroundTemplateCandidateExample } from "../schemas/examples.js";

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
function clone<T>(v: T): Mutable<T> {
  return JSON.parse(JSON.stringify(v)) as Mutable<T>;
}

describe("rectContains / rectsOverlap", () => {
  it("rectContains: inner dentro de outer", () => {
    expect(rectContains({ x: 0, y: 0, width: 1, height: 1 }, { x: 0.25, y: 0.25, width: 0.5, height: 0.5 })).toBe(true);
  });
  it("rectContains: inner fuera de outer", () => {
    expect(rectContains({ x: 0, y: 0, width: 0.5, height: 1 }, { x: 0.6, y: 0, width: 0.2, height: 0.2 })).toBe(false);
  });
  it("rectsOverlap: solapados", () => {
    expect(rectsOverlap({ x: 0, y: 0, width: 0.5, height: 1 }, { x: 0.3, y: 0, width: 0.5, height: 1 })).toBe(true);
  });
  it("rectsOverlap: adyacentes no solapados", () => {
    expect(rectsOverlap({ x: 0, y: 0, width: 0.3, height: 1 }, { x: 0.3, y: 0, width: 0.3, height: 1 })).toBe(false);
  });
});

describe("checkBoardAreaWithinSafeArea (§5.1)", () => {
  it("pasa cuando boardArea está dentro de safeArea", () => {
    expect(checkBoardAreaWithinSafeArea(backgroundTemplateCandidateExample).ok).toBe(true);
  });
  it("falla cuando boardArea sale de safeArea", () => {
    const bad = clone(backgroundTemplateCandidateExample);
    bad.safeArea = { x: 0.5, y: 0.5, width: 0.4, height: 0.4 };
    expect(checkBoardAreaWithinSafeArea(bad).ok).toBe(false);
  });
});

describe("checkBoardAreaProportions (§5.2)", () => {
  it("pasa con proporciones razonables", () => {
    expect(checkBoardAreaProportions(backgroundTemplateCandidateExample).ok).toBe(true);
  });
  it("falla con boardArea demasiado ancho", () => {
    const bad = clone(backgroundTemplateCandidateExample);
    bad.boardArea = { x: 0, y: 0.45, width: 1.0, height: 0.1 };
    expect(checkBoardAreaProportions(bad).ok).toBe(false);
  });
  it("falla si boardArea cubre casi toda la imagen", () => {
    const bad = clone(backgroundTemplateCandidateExample);
    bad.boardArea = { x: 0.02, y: 0.02, width: 0.97, height: 0.97 };
    expect(checkBoardAreaProportions(bad).ok).toBe(false);
  });
});

describe("checkAtLeastOneValidCellSize (§5.3)", () => {
  it("pasa cuando al menos un allowedCellSize cabe", () => {
    expect(checkAtLeastOneValidCellSize(backgroundTemplateCandidateExample).ok).toBe(true);
  });
  it("falla si ningún tamaño cabe", () => {
    const bad = clone(backgroundTemplateCandidateExample);
    bad.suggestedGrid = { columns: 50, columnsRange: [40, 60], rows: 50, rowsRange: [40, 60] };
    expect(checkAtLeastOneValidCellSize(bad).ok).toBe(false);
  });
});

describe("checkNoExtendableOverlap (§5.4)", () => {
  it("pasa cuando no hay solape", () => {
    expect(checkNoExtendableOverlap(backgroundTemplateCandidateExample).ok).toBe(true);
  });
  it("falla cuando una decorativeArea extensible solapa boardArea", () => {
    const bad = clone(backgroundTemplateCandidateExample);
    bad.decorativeAreas = [{ x: 0.2, y: 0.2, width: 0.4, height: 0.5, extendable: true }];
    expect(checkNoExtendableOverlap(bad).ok).toBe(false);
  });
  it("pasa si la decorativeArea solapada NO es extensible", () => {
    const bad = clone(backgroundTemplateCandidateExample);
    bad.decorativeAreas = [{ x: 0.2, y: 0.2, width: 0.4, height: 0.5, extendable: false }];
    expect(checkNoExtendableOverlap(bad).ok).toBe(true);
  });
});

describe("checkConfidenceAboveThreshold (§5.5)", () => {
  it("pasa con confidence alto", () => {
    expect(checkConfidenceAboveThreshold(backgroundTemplateCandidateExample).ok).toBe(true);
  });
  it("falla con confidence bajo (no bloqueante)", () => {
    const bad = clone(backgroundTemplateCandidateExample);
    bad.confidence = 0.3;
    expect(checkConfidenceAboveThreshold(bad).ok).toBe(false);
  });
});

describe("runSanityChecks (integración)", () => {
  it("acepta el ejemplo canónico sin necesidad de revisión", () => {
    const r = runSanityChecks(backgroundTemplateCandidateExample);
    expect(r.ok).toBe(true);
    expect(r.needsHumanReview).toBe(false);
  });
  it("marca needsHumanReview cuando confidence < umbral pero ok sigue true", () => {
    const bad = clone(backgroundTemplateCandidateExample);
    bad.confidence = 0.4;
    const r = runSanityChecks(bad);
    expect(r.ok).toBe(true);
    expect(r.needsHumanReview).toBe(true);
  });
  it("rechaza si boardArea sale de safeArea (ok false)", () => {
    const bad = clone(backgroundTemplateCandidateExample);
    bad.boardArea = { x: 0.9, y: 0.28, width: 0.5, height: 0.48 };
    const r = runSanityChecks(bad);
    expect(r.ok).toBe(false);
  });
  it("respeta umbral configurable", () => {
    const low = clone(backgroundTemplateCandidateExample);
    low.confidence = 0.75;
    const r = runSanityChecks(low, { ...DEFAULT_SANITY_OPTIONS, confidenceThreshold: 0.8 });
    expect(r.needsHumanReview).toBe(true);
  });
});
