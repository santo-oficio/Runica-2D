/**
 * Arquetipos de forma del tablero (docs/03-GENERADOR-NIVELES.md §1).
 *
 * Cada arquetipo genera un grid `width × height` (ambos >= 3) con:
 *  - `#` = pared / celda no transitable
 *  - `.` = celda transitable (suelo)
 *
 * Todos los arquetipos garantizan un borde de paredes alrededor (la celda
 * (0,0), (width-1,0), etc. son siempre `#`), de modo que el tablero está
 * "enmarcado" y ninguna celda jugable toca el límite del grid.
 *
 * Los 10 arquetipos:
 *   RECTANGULO, L, T, CRUZ, PASILLO, CAMARA_CENTRAL, ANILLO,
 *   DOBLE_PASILLO, LABERINTO, IRREGULAR
 */

import type { Archetype } from "../schemas/types.js";
import type { Rng } from "./rng.js";

// ---------------------------------------------------------------------------
// Helpers de grid
// ---------------------------------------------------------------------------

/** Crea un grid `width × height` lleno de `ch`. */
function filledGrid(width: number, height: number, ch: string): string[][] {
  const g: string[][] = [];
  for (let r = 0; r < height; r++) {
    const row: string[] = [];
    for (let c = 0; c < width; c++) row.push(ch);
    g.push(row);
  }
  return g;
}

/** Convierte un grid 2D de chars en array de strings (filas). */
export function gridToStrings(g: string[][]): string[] {
  return g.map((row) => row.join(""));
}

/** Asegura el borde de paredes alrededor del grid (en su lugar). */
function addBorder(g: string[][]): void {
  const h = g.length;
  const w = g[0]!.length;
  for (let c = 0; c < w; c++) {
    g[0]![c] = "#";
    g[h - 1]![c] = "#";
  }
  for (let r = 0; r < h; r++) {
    g[r]![0] = "#";
    g[r]![w - 1] = "#";
  }
}

/** Cuenta celdas transitables (`.`) del grid. */
export function countFloor(g: string[][]): number {
  let n = 0;
  for (const row of g) for (const ch of row) if (ch === ".") n++;
  return n;
}

/** Devuelve las posiciones (col,row) de celdas transitables. */
export function floorCells(g: string[][]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 0; r < g.length; r++) {
    for (let c = 0; c < g[r]!.length; c++) {
      if (g[r]![c] === ".") out.push([c, r]);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Arquetipos individuales
// ---------------------------------------------------------------------------

/** RECTANGULO: todo el interior es suelo. */
function genRectangulo(w: number, h: number): string[][] {
  const g = filledGrid(w, h, ".");
  addBorder(g);
  return g;
}

/**
 * L: forma de L ocupando la mitad izquierda + mitad inferior.
 * Se elimina el cuadrante superior-derecho.
 */
function genL(w: number, h: number, rng: Rng): string[][] {
  const g = filledGrid(w, h, ".");
  addBorder(g);
  // Cuadrante superior-derecho a pared. Variación: punto de corte aleatorio.
  const cutCol = Math.max(2, Math.floor(w / 2) + rng.int(-1, 1));
  const cutRow = Math.max(2, Math.floor(h / 2) + rng.int(-1, 1));
  for (let r = 1; r < cutRow; r++) {
    for (let c = cutCol; c < w - 1; c++) g[r]![c] = "#";
  }
  return g;
}

/**
 * T: barra horizontal superior + barra vertical central.
 * Se eliminan las esquinas inferior-izq e inferior-der.
 */
function genT(w: number, h: number, rng: Rng): string[][] {
  const g = filledGrid(w, h, ".");
  addBorder(g);
  const stemCol = Math.floor(w / 2) + rng.int(-1, 1);
  const stemStart = Math.max(1, stemCol - 1);
  const stemEnd = Math.min(w - 2, stemCol + 1);
  // Eliminar las dos esquinas inferiores dejando la barra vertical central.
  for (let r = Math.floor(h / 2); r < h - 1; r++) {
    for (let c = 1; c < stemStart; c++) g[r]![c] = "#";
    for (let c = stemEnd + 1; c < w - 1; c++) g[r]![c] = "#";
  }
  return g;
}

/** CRUZ: brazo horizontal + brazo vertical centrados. */
function genCruz(w: number, h: number, rng: Rng): string[][] {
  const g = filledGrid(w, h, "#");
  const midRow = Math.floor(h / 2);
  const midCol = Math.floor(w / 2);
  // Brazo horizontal
  for (let c = 1; c < w - 1; c++) g[midRow]![c] = ".";
  // Brazo vertical
  for (let r = 1; r < h - 1; r++) g[r]![midCol] = ".";
  // Ensanchamiento central opcional
  if (rng.chance(0.5)) {
    for (let r = midRow - 1; r <= midRow + 1; r++) {
      for (let c = midCol - 1; c <= midCol + 1; c++) {
        if (r > 0 && r < h - 1 && c > 0 && c < w - 1) g[r]![c] = ".";
      }
    }
  }
  addBorder(g);
  return g;
}

/** PASILLO: pasillo horizontal ancho de 2-3 filas centradas. */
function genPasillo(w: number, h: number, rng: Rng): string[][] {
  const g = filledGrid(w, h, "#");
  const bandH = Math.min(h - 2, rng.int(2, 3));
  const start = Math.max(1, Math.floor((h - bandH) / 2));
  for (let r = start; r < start + bandH; r++) {
    for (let c = 1; c < w - 1; c++) g[r]![c] = ".";
  }
  addBorder(g);
  return g;
}

/** CAMARA_CENTRAL: habitación central con marco de paredes. */
function genCamaraCentral(w: number, h: number, rng: Rng): string[][] {
  const g = filledGrid(w, h, "#");
  const innerW = Math.max(3, Math.floor(w * 0.6));
  const innerH = Math.max(3, Math.floor(h * 0.6));
  const startC = Math.floor((w - innerW) / 2);
  const startR = Math.floor((h - innerH) / 2);
  for (let r = startR; r < startR + innerH; r++) {
    for (let c = startC; c < startC + innerW; c++) g[r]![c] = ".";
  }
  // Una o dos aberturas en el marco para no aislar la cámara.
  const openings = rng.int(1, 2);
  for (let i = 0; i < openings; i++) {
    const side = rng.int(0, 3);
    if (side === 0) g[startR]![startC + Math.floor(innerW / 2)] = ".";
    else if (side === 1) g[startR + innerH - 1]![startC + Math.floor(innerW / 2)] = ".";
    else if (side === 2) g[startR + Math.floor(innerH / 2)]![startC] = ".";
    else g[startR + Math.floor(innerH / 2)]![startC + innerW - 1] = ".";
  }
  addBorder(g);
  return g;
}

/** ANILLO: pasillo perimetral + muro central. */
function genAnillo(w: number, h: number): string[][] {
  const g = filledGrid(w, h, "#");
  // Perímetro interior
  for (let c = 1; c < w - 1; c++) {
    g[1]![c] = ".";
    g[h - 2]![c] = ".";
  }
  for (let r = 1; r < h - 1; r++) {
    g[r]![1] = ".";
    g[r]![w - 2] = ".";
  }
  // Muro central (cámara interior cerrada)
  const innerStartR = Math.max(2, Math.floor(h / 2) - 1);
  const innerEndR = Math.min(h - 3, Math.floor(h / 2) + 1);
  for (let r = innerStartR; r <= innerEndR; r++) {
    for (let c = Math.max(2, Math.floor(w / 2) - 1); c <= Math.min(w - 3, Math.floor(w / 2) + 1); c++) {
      g[r]![c] = "#";
    }
  }
  addBorder(g);
  return g;
}

/** DOBLE_PASILLO: dos pasillos paralelos separados por un muro central. */
function genDoblePasillo(w: number, h: number, rng: Rng): string[][] {
  const g = filledGrid(w, h, "#");
  const bandH = Math.max(2, Math.floor((h - 3) / 2));
  const midRow = Math.floor(h / 2);
  // Pasillo superior
  for (let r = 1; r < 1 + bandH; r++) {
    for (let c = 1; c < w - 1; c++) g[r]![c] = ".";
  }
  // Pasillo inferior
  for (let r = midRow + 1; r < midRow + 1 + bandH && r < h - 1; r++) {
    for (let c = 1; c < w - 1; c++) g[r]![c] = ".";
  }
  // Conexión entre pasillos (1-2 aberturas en el muro central)
  const conns = rng.int(1, 2);
  for (let i = 0; i < conns; i++) {
    const c = rng.int(2, w - 3);
    g[midRow]![c] = ".";
  }
  addBorder(g);
  return g;
}

/**
 * LABERINTO: laberinto con muros internos generados con divisiones
 * recursivas simplificadas (recursive division) sobre el área interior.
 */
function genLaberinto(w: number, h: number, rng: Rng): string[][] {
  const g = filledGrid(w, h, ".");
  addBorder(g);
  // División recursiva sobre el área interior [1, w-2] x [1, h-2].
  divide(g, 1, 1, w - 2, h - 2, rng);
  return g;
}

function divide(
  g: string[][],
  x: number,
  y: number,
  w: number,
  h: number,
  rng: Rng,
): void {
  if (w < 3 || h < 3) return;
  const horizontal = h > w ? true : w > h ? false : rng.chance(0.5);
  if (horizontal) {
    const wallY = y + 1 + Math.floor(rng.next() * (h - 2));
    const gap = x + Math.floor(rng.next() * w);
    for (let c = x; c < x + w; c++) {
      if (c !== gap) g[wallY]![c] = "#";
    }
    divide(g, x, y, w, wallY - y, rng);
    divide(g, x, wallY + 1, w, y + h - wallY - 1, rng);
  } else {
    const wallX = x + 1 + Math.floor(rng.next() * (w - 2));
    const gap = y + Math.floor(rng.next() * h);
    for (let r = y; r < y + h; r++) {
      if (r !== gap) g[r]![wallX] = "#";
    }
    divide(g, x, y, wallX - x, h, rng);
    divide(g, wallX + 1, y, x + w - wallX - 1, h, rng);
  }
}

/**
 * IRREGULAR: rectángulo base con varios "bloques" de paredes internos
 * colocados aleatoriamente, respetando el borde.
 */
function genIrregular(w: number, h: number, rng: Rng): string[][] {
  const g = filledGrid(w, h, ".");
  addBorder(g);
  const numBlocks = rng.int(1, Math.max(1, Math.floor((w * h) / 12)));
  for (let i = 0; i < numBlocks; i++) {
    const bw = rng.int(1, Math.max(1, Math.floor(w / 4)));
    const bh = rng.int(1, Math.max(1, Math.floor(h / 4)));
    const bx = rng.int(1, w - 2 - bw);
    const by = rng.int(1, h - 2 - bh);
    for (let r = by; r <= by + bh && r < h - 1; r++) {
      for (let c = bx; c <= bx + bw && c < w - 1; c++) g[r]![c] = "#";
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export const ARCHETYPE_GENERATORS: Record<
  Archetype,
  (w: number, h: number, rng: Rng) => string[][]
> = {
  RECTANGULO: (w, h) => genRectangulo(w, h),
  L: (w, h, rng) => genL(w, h, rng),
  T: (w, h, rng) => genT(w, h, rng),
  CRUZ: (w, h, rng) => genCruz(w, h, rng),
  PASILLO: (w, h, rng) => genPasillo(w, h, rng),
  CAMARA_CENTRAL: (w, h, rng) => genCamaraCentral(w, h, rng),
  ANILLO: (w, h) => genAnillo(w, h),
  DOBLE_PASILLO: (w, h, rng) => genDoblePasillo(w, h, rng),
  LABERINTO: (w, h, rng) => genLaberinto(w, h, rng),
  IRREGULAR: (w, h, rng) => genIrregular(w, h, rng),
};

/** Lista de arquetipos disponibles (para selección aleatoria). */
export const ALL_ARCHETYPES: readonly Archetype[] = [
  "RECTANGULO", "L", "T", "CRUZ", "PASILLO", "CAMARA_CENTRAL",
  "ANILLO", "DOBLE_PASILLO", "LABERINTO", "IRREGULAR",
];

/**
 * Genera el grid de un arquetipo concreto.
 * @param archetype arquetipo a generar.
 * @param width ancho del grid (>= 3).
 * @param height alto del grid (>= 3).
 * @param rng generador determinista.
 */
export function generateArchetypeGrid(
  archetype: Archetype,
  width: number,
  height: number,
  rng: Rng,
): string[][] {
  if (width < 3 || height < 3) {
    throw new Error(`tamaño de tablero demasiado pequeño: ${width}x${height} (mínimo 3x3)`);
  }
  const gen = ARCHETYPE_GENERATORS[archetype];
  if (!gen) throw new Error(`arquetipo desconocido: ${archetype}`);
  return gen(width, height, rng);
}
