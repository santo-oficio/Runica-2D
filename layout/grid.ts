/**
 * Cálculo de la rejilla de casillas (docs/02-MOTOR-GRAFICO.md §3).
 *
 * Dado un `boardArea` en píxeles y un número de columnas/filas, calcula
 * `cellWidth`/`cellHeight` eligiendo SOLO valores de `allowedCellSizes`
 * (nunca un valor decimal arbitrario) y centra el tablero resultante dentro
 * del boardArea.
 *
 * Por qué tamaños fijos y no escalado libre: al ser arte retro/pixel-art,
 * escalar libremente (ej. 63.73 × 61.28 px) produce bordes borrosos. Por eso
 * se define una lista cerrada de tamaños de celda válidos y se prefieren
 * escalados enteros (×1, ×2, ×3) del sprite base.
 */

import type { PixelRect } from "./screen-layout.js";

export type { PixelRect };

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Rejilla final calculada para un tablero concreto. */
export interface GridLayout {
  /** Origen absoluto (px) del tablero dentro del boardArea. */
  readonly originX: number;
  readonly originY: number;
  /** Tamaño de celda elegido (px). Siempre de `allowedCellSizes`. */
  readonly cellWidth: number;
  readonly cellHeight: number;
  /** Número de columnas. */
  readonly columns: number;
  /** Número de filas. */
  readonly rows: number;
  /** Rectángulo final que ocupa el tablero (para verificación). */
  readonly boardRect: PixelRect;
}

/** Estrategia para elegir el tamaño de celda dentro de los permitidos. */
export type CellSizeStrategy = "largest" | "smallest" | "nearest";

/** Opciones del cálculo de rejilla. */
export interface GridOptions {
  /**
   * Estrategia para elegir el tamaño de celda:
   *  - "largest" (por defecto): el mayor tamaño que cabe (mejor legibilidad).
   *  - "smallest": el menor tamaño que cabe (más margen alrededor).
   *  - "nearest": el tamaño más cercano al tamaño "ideal" (cols*cellWidth ≈ ancho).
   */
  readonly strategy: CellSizeStrategy;
}

export const DEFAULT_GRID_OPTIONS: GridOptions = { strategy: "largest" };

// ---------------------------------------------------------------------------
// Validación previa
// ---------------------------------------------------------------------------

/**
 * Comprueba si existe al menos un tamaño de celda válido para el boardArea
 * y el número de columnas/filas dados. Útil como pre-filtro barato.
 */
export function hasValidCellSize(
  boardAreaPx: PixelRect,
  columns: number,
  rows: number,
  allowedCellSizes: readonly number[],
): boolean {
  return allowedCellSizes.some(
    (size) => columns * size <= boardAreaPx.width && rows * size <= boardAreaPx.height,
  );
}

/**
 * Lista los tamaños de celda permitidos que caben en el boardArea para el
 * número de columnas/filas dado, ordenados de mayor a menor.
 */
export function validCellSizes(
  boardAreaPx: PixelRect,
  columns: number,
  rows: number,
  allowedCellSizes: readonly number[],
): number[] {
  return allowedCellSizes
    .filter((size) => columns * size <= boardAreaPx.width && rows * size <= boardAreaPx.height)
    .sort((a, b) => b - a);
}

// ---------------------------------------------------------------------------
// Cálculo de la rejilla
// ---------------------------------------------------------------------------

/**
 * Calcula la rejilla final: elige cellWidth/cellHeight de `allowedCellSizes`
 * y centra el tablero dentro del boardArea.
 *
 * Lanza error si ningún tamaño de celda permitido cabe (el caller debe
 * filtrar antes con `hasValidCellSize` o regenerar con otros parámetros).
 *
 * Nota: se asume celdas cuadradas (cellWidth === cellHeight). El tamaño
 * elegido es el mismo para ambos ejes, garantizando alineación perfecta y
 * sin deformación del pixel-art.
 */
export function computeGridLayout(
  boardAreaPx: PixelRect,
  columns: number,
  rows: number,
  allowedCellSizes: readonly number[],
  opts: GridOptions = DEFAULT_GRID_OPTIONS,
): GridLayout {
  if (columns <= 0 || rows <= 0) {
    throw new Error(`columnas/filas deben ser > 0 (recibido ${columns}x${rows})`);
  }
  if (allowedCellSizes.length === 0) {
    throw new Error("allowedCellSizes no puede estar vacío");
  }

  const valid = validCellSizes(boardAreaPx, columns, rows, allowedCellSizes);
  if (valid.length === 0) {
    throw new Error(
      `ningún tamaño de celda permitido (${allowedCellSizes.join(", ")}) cabe en ` +
        `${boardAreaPx.width}x${boardAreaPx.height}px para ${columns}x${rows} celdas`,
    );
  }

  let cellSize: number;
  switch (opts.strategy) {
    case "smallest":
      cellSize = valid[valid.length - 1]!;
      break;
    case "nearest": {
      const idealW = boardAreaPx.width / columns;
      const idealH = boardAreaPx.height / rows;
      const ideal = Math.min(idealW, idealH);
      cellSize = valid.reduce((best, s) =>
        Math.abs(s - ideal) < Math.abs(best - ideal) ? s : best,
      );
      break;
    }
    case "largest":
    default:
      cellSize = valid[0]!;
      break;
  }

  const totalWidth = columns * cellSize;
  const totalHeight = rows * cellSize;
  // Centrar dentro del boardArea.
  const originX = boardAreaPx.x + Math.floor((boardAreaPx.width - totalWidth) / 2);
  const originY = boardAreaPx.y + Math.floor((boardAreaPx.height - totalHeight) / 2);

  return {
    originX,
    originY,
    cellWidth: cellSize,
    cellHeight: cellSize,
    columns,
    rows,
    boardRect: { x: originX, y: originY, width: totalWidth, height: totalHeight },
  };
}

// ---------------------------------------------------------------------------
// Verificación: ¿todas las celdas caen dentro del boardArea?
// ---------------------------------------------------------------------------

/**
 * Comprueba que el tablero completo (todas las celdas) cae dentro del
 * boardArea, con el margen de seguridad extra (marginPx) si se especifica.
 *
 * Usado por los tests de la Fase 1 (requisito (a)) y por el validador del
 * solver (check `withinBoardArea`).
 */
export function isBoardWithinArea(grid: GridLayout, boardAreaPx: PixelRect, marginPx = 0): boolean {
  const g = grid.boardRect;
  return (
    g.x >= boardAreaPx.x - marginPx &&
    g.y >= boardAreaPx.y - marginPx &&
    g.x + g.width <= boardAreaPx.x + boardAreaPx.width + marginPx &&
    g.y + g.height <= boardAreaPx.y + boardAreaPx.height + marginPx
  );
}
