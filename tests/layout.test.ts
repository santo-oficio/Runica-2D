/**
 * Tests del Screen Layout y del cálculo de rejilla (docs/02 §2, §3).
 *
 * Requisitos del prompt Fase 1:
 *  (a) ninguna celda cae fuera del boardArea,
 *  (b) el tamaño de celda elegido está siempre en la lista permitida.
 */

import { describe, it, expect } from "vitest";
import {
  computeScreenLayout,
  type ScreenResolution,
} from "../layout/screen-layout.js";
import {
  computeGridLayout,
  hasValidCellSize,
  isBoardWithinArea,
  validCellSizes,
  type PixelRect,
} from "../layout/grid.js";
import { backgroundTemplateExample } from "../schemas/examples.js";

const ALLOWED = [48, 56, 64, 72, 80];

describe("computeScreenLayout", () => {
  it("modo exact cuando aspect del fondo == aspect de pantalla", () => {
    const screen: ScreenResolution = { width: 1920, height: 1080 };
    const layout = computeScreenLayout(backgroundTemplateExample, screen, 16 / 9);
    expect(layout.mode).toBe("exact");
    expect(layout.backgroundRect).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it("modo pillarbox cuando el fondo es más ancho que la pantalla", () => {
    const screen: ScreenResolution = { width: 1024, height: 768 };
    const layout = computeScreenLayout(backgroundTemplateExample, screen, 16 / 9);
    expect(layout.mode).toBe("pillarbox");
    // El fondo se escala por altura (768) → ancho = 768 * 16/9 ≈ 1365
    expect(layout.backgroundRect.height).toBe(768);
    expect(layout.backgroundRect.width).toBe(Math.round(768 * (16 / 9)));
    // Centrado horizontal: x = (1024 - 1365) / 2 ≈ -170 (bandas negras fuera de pantalla)
    expect(layout.backgroundRect.x).toBe(Math.round((1024 - Math.round(768 * (16 / 9))) / 2));
  });

  it("modo letterbox cuando el fondo es más alto que la pantalla", () => {
    const screen: ScreenResolution = { width: 1920, height: 1200 };
    const layout = computeScreenLayout(backgroundTemplateExample, screen, 4 / 3);
    expect(layout.mode).toBe("letterbox");
    expect(layout.backgroundRect.width).toBe(1920);
    expect(layout.backgroundRect.height).toBe(Math.round(1920 / (4 / 3)));
  });

  it("proyecta boardArea a píxeles coherentes con el fondo colocado", () => {
    const screen: ScreenResolution = { width: 1920, height: 1080 };
    const layout = computeScreenLayout(backgroundTemplateExample, screen, 16 / 9);
    // boardArea relativa: x=0.25, y=0.28, w=0.5, h=0.48
    expect(layout.boardAreaPx.x).toBe(Math.round(0.25 * 1920));
    expect(layout.boardAreaPx.y).toBe(Math.round(0.28 * 1080));
    expect(layout.boardAreaPx.width).toBe(Math.round(0.5 * 1920));
    expect(layout.boardAreaPx.height).toBe(Math.round(0.48 * 1080));
  });

  it("no deforma: backgroundRect mantiene el aspect ratio nativo", () => {
    const screen: ScreenResolution = { width: 1920, height: 1080 };
    const layout = computeScreenLayout(backgroundTemplateExample, screen, 4 / 3);
    const ar = layout.backgroundRect.width / layout.backgroundRect.height;
    expect(ar).toBeCloseTo(4 / 3, 3);
  });

  it("proyecta anchorPoints y decorativeAreas", () => {
    const screen: ScreenResolution = { width: 1920, height: 1080 };
    const layout = computeScreenLayout(backgroundTemplateExample, screen, 16 / 9);
    expect(layout.anchorPointsPx.frameTopLeft).toBeDefined();
    expect(layout.decorativeAreasPx.length).toBe(2);
  });
});

describe("computeGridLayout — tamaño de celda siempre permitido (req b)", () => {
  const boardAreaPx: PixelRect = { x: 480, y: 302, width: 960, height: 518 };

  it("elige el mayor tamaño permitido que cabe (estrategia largest)", () => {
    const g = computeGridLayout(boardAreaPx, 8, 6, ALLOWED);
    expect(ALLOWED).toContain(g.cellWidth);
    expect(g.cellWidth).toBe(g.cellHeight);
    // 8*80=640 <= 960, 6*80=480 <= 518 → 80 cabe
    expect(g.cellWidth).toBe(80);
  });

  it("elige el menor tamaño permitido (estrategia smallest)", () => {
    const g = computeGridLayout(boardAreaPx, 8, 6, ALLOWED, { strategy: "smallest" });
    expect(ALLOWED).toContain(g.cellWidth);
    expect(g.cellWidth).toBe(48);
  });

  it("elige el más cercano al ideal (estrategia nearest)", () => {
    const g = computeGridLayout(boardAreaPx, 8, 6, ALLOWED, { strategy: "nearest" });
    expect(ALLOWED).toContain(g.cellWidth);
    // ideal = min(960/8, 518/6) = min(120, 86.3) = 86.3 → nearest en ALLOWED es 80
    expect(g.cellWidth).toBe(80);
  });

  it("lanza si ningún tamaño permitido cabe", () => {
    expect(() => computeGridLayout(boardAreaPx, 50, 50, ALLOWED)).toThrow();
  });

  it("lanza si allowedCellSizes vacío", () => {
    expect(() => computeGridLayout(boardAreaPx, 8, 6, [])).toThrow();
  });

  it("lanza si columnas o filas <= 0", () => {
    expect(() => computeGridLayout(boardAreaPx, 0, 6, ALLOWED)).toThrow();
    expect(() => computeGridLayout(boardAreaPx, 8, 0, ALLOWED)).toThrow();
  });
});

describe("computeGridLayout — ninguna celda fuera del boardArea (req a)", () => {
  const boardAreaPx: PixelRect = { x: 480, y: 302, width: 960, height: 518 };

  it("el tablero completo cabe dentro del boardArea", () => {
    for (const [cols, rows] of [[6, 5], [7, 6], [8, 6], [8, 8]] as const) {
      const g = computeGridLayout(boardAreaPx, cols, rows, ALLOWED);
      expect(isBoardWithinArea(g, boardAreaPx)).toBe(true);
    }
  });

  it("el tablero está centrado dentro del boardArea", () => {
    const g = computeGridLayout(boardAreaPx, 8, 6, ALLOWED);
    const marginX = boardAreaPx.width - g.boardRect.width;
    const marginY = boardAreaPx.height - g.boardRect.height;
    expect(g.boardRect.x - boardAreaPx.x).toBe(Math.floor(marginX / 2));
    expect(g.boardRect.y - boardAreaPx.y).toBe(Math.floor(marginY / 2));
  });

  it("respeta el margen de seguridad extra (marginPx)", () => {
    const g = computeGridLayout(boardAreaPx, 8, 6, ALLOWED);
    // Con marginPx negativo forzamos a que el tablero "sobresalga" conceptualmente
    expect(isBoardWithinArea(g, boardAreaPx, 0)).toBe(true);
    expect(isBoardWithinArea(g, boardAreaPx, -1000)).toBe(false);
  });
});

describe("hasValidCellSize / validCellSizes", () => {
  const boardAreaPx: PixelRect = { x: 0, y: 0, width: 960, height: 518 };

  it("hasValidCellSize true cuando cabe alguno", () => {
    expect(hasValidCellSize(boardAreaPx, 8, 6, ALLOWED)).toBe(true);
  });
  it("hasValidCellSize false cuando no cabe ninguno", () => {
    expect(hasValidCellSize(boardAreaPx, 100, 100, ALLOWED)).toBe(false);
  });
  it("validCellSizes devuelve ordenados de mayor a menor", () => {
    const v = validCellSizes(boardAreaPx, 8, 6, ALLOWED);
    expect(v).toEqual([...v].sort((a, b) => b - a));
    expect(v.length).toBeGreaterThan(0);
  });
});
