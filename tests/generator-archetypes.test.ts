/**
 * Tests de los arquetipos de forma (Fase 2).
 *
 * Verifica que cada arquetipo:
 *  - produce un grid del tamaño solicitado,
 *  - tiene borde de paredes,
 *  - tiene al menos una celda transitable,
 *  - es determinista por seed.
 */

import { describe, it, expect } from "vitest";
import {
  ALL_ARCHETYPES,
  countFloor,
  generateArchetypeGrid,
  gridToStrings,
} from "../generator/archetypes.js";
import { createRng } from "../generator/rng.js";

const W = 10;
const H = 8;

function hasBorder(g: string[][]): boolean {
  const h = g.length;
  const w = g[0]!.length;
  for (let c = 0; c < w; c++) {
    if (g[0]![c] !== "#") return false;
    if (g[h - 1]![c] !== "#") return false;
  }
  for (let r = 0; r < h; r++) {
    if (g[r]![0] !== "#") return false;
    if (g[r]![w - 1] !== "#") return false;
  }
  return true;
}

describe("generateArchetypeGrid — todos los arquetipos", () => {
  for (const arch of ALL_ARCHETYPES) {
    it(`${arch}: tamaño correcto, borde de paredes, al menos 1 suelo`, () => {
      const rng = createRng(42);
      const g = generateArchetypeGrid(arch, W, H, rng);
      expect(g.length).toBe(H);
      expect(g[0]!.length).toBe(W);
      expect(hasBorder(g)).toBe(true);
      expect(countFloor(g)).toBeGreaterThan(0);
    });

    it(`${arch}: determinista por seed`, () => {
      const a = generateArchetypeGrid(arch, W, H, createRng(123));
      const b = generateArchetypeGrid(arch, W, H, createRng(123));
      expect(gridToStrings(a)).toEqual(gridToStrings(b));
    });
  }

  it("lanza si tamaño < 3x3", () => {
    expect(() => generateArchetypeGrid("RECTANGULO", 2, 2, createRng(1))).toThrow();
  });

  it("lanza si arquetipo desconocido", () => {
    expect(() =>
      generateArchetypeGrid("CIRCULO" as never, W, H, createRng(1)),
    ).toThrow();
  });
});

describe("generateArchetypeGrid — invariantes por arquetipo", () => {
  it("RECTANGULO: todo el interior es suelo", () => {
    const g = generateArchetypeGrid("RECTANGULO", 6, 5, createRng(1));
    for (let r = 1; r < 4; r++) {
      for (let c = 1; c < 5; c++) {
        expect(g[r]![c]).toBe(".");
      }
    }
  });

  it("PASILLO: solo una banda horizontal de suelo", () => {
    const g = generateArchetypeGrid("PASILLO", 8, 7, createRng(1));
    // Las filas 0 y 6 son borde (pared). La banda está en el medio.
    const floorRows = [];
    for (let r = 1; r < 6; r++) {
      if (g[r]!.some((c) => c === ".")) floorRows.push(r);
    }
    expect(floorRows.length).toBeGreaterThanOrEqual(2);
    expect(floorRows.length).toBeLessThanOrEqual(3);
  });

  it("CRUZ: tiene suelo en el centro", () => {
    const g = generateArchetypeGrid("CRUZ", 9, 9, createRng(1));
    expect(g[4]![4]).toBe(".");
  });

  it("ANILLO: el centro es pared (cámara cerrada)", () => {
    const g = generateArchetypeGrid("ANILLO", 9, 9, createRng(1));
    // El perímetro interior es suelo
    expect(g[1]![1]).toBe(".");
    expect(g[7]![7]).toBe(".");
  });

  it("LABERINTO: tiene muros internos (no es todo suelo)", () => {
    const g = generateArchetypeGrid("LABERINTO", 12, 10, createRng(7));
    // Debe haber al menos un '#' interno (no solo el borde)
    let internalWalls = 0;
    for (let r = 1; r < 9; r++) {
      for (let c = 1; c < 11; c++) {
        if (g[r]![c] === "#") internalWalls++;
      }
    }
    expect(internalWalls).toBeGreaterThan(0);
  });
});
