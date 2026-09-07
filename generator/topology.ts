/**
 * Pre-filtro topológico rápido (docs/03-GENERADOR-NIVELES.md §2).
 *
 * Comprobaciones baratas que se hacen ANTES de pasar al solver completo:
 *  - existe al menos un camino entre dos celdas transitables (BFS)
 *  - distancia Manhattan entre dos celdas
 *
 * Esto descarta rápidamente niveles con objetivo aislado o sin conexión
 * jugador→objetivo, sin necesidad de ejecutar el solver de resolubilidad
 * completo (que simula el juego con enemigos).
 */

import type { CellPos } from "../schemas/types.js";

/** Distancia Manhattan entre dos posiciones (en casillas). */
export function manhattan(a: CellPos, b: CellPos): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

/**
 * BFS sobre el grid: ¿existe un camino de `start` a `goal` moviéndose
 * solo por celdas transitables (`.` o la celda de goal)?
 *
 * `walkable` indica qué chars son transitables (por defecto `.`).
 * El `start` y el `goal` se consideran transitables aunque sean otros chars.
 */
export function hasPath(
  grid: readonly string[],
  start: CellPos,
  goal: CellPos,
  walkable = new Set<string>(["."]),
): boolean {
  const h = grid.length;
  const w = grid[0]!.length;
  const isWalkableCell = (c: number, r: number): boolean => {
    if (r < 0 || r >= h || c < 0 || c >= w) return false;
    if ((c === start[0] && r === start[1]) || (c === goal[0] && r === goal[1])) return true;
    return walkable.has(grid[r]![c]!);
  };
  const visited = new Set<string>();
  const key = (c: number, r: number) => `${c},${r}`;
  const queue: Array<[number, number]> = [[start[0], start[1]]];
  visited.add(key(start[0], start[1]));
  while (queue.length > 0) {
    const [c, r] = queue.shift()!;
    if (c === goal[0] && r === goal[1]) return true;
    const neighbors: Array<[number, number]> = [
      [c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1],
    ];
    for (const [nc, nr] of neighbors) {
      const k = key(nc, nr);
      if (!visited.has(k) && isWalkableCell(nc, nr)) {
        visited.add(k);
        queue.push([nc, nr]);
      }
    }
  }
  return false;
}

/**
 * Distancia BFS más corta (en pasos) entre `start` y `goal` sobre celdas
 * transitables. Devuelve `Infinity` si no hay camino.
 */
export function bfsDistance(
  grid: readonly string[],
  start: CellPos,
  goal: CellPos,
  walkable = new Set<string>(["."]),
): number {
  const h = grid.length;
  const w = grid[0]!.length;
  const isWalkableCell = (c: number, r: number): boolean => {
    if (r < 0 || r >= h || c < 0 || c >= w) return false;
    if ((c === start[0] && r === start[1]) || (c === goal[0] && r === goal[1])) return true;
    return walkable.has(grid[r]![c]!);
  };
  const visited = new Set<string>();
  const key = (c: number, r: number) => `${c},${r}`;
  const queue: Array<[number, number, number]> = [[start[0], start[1], 0]];
  visited.add(key(start[0], start[1]));
  while (queue.length > 0) {
    const [c, r, d] = queue.shift()!;
    if (c === goal[0] && r === goal[1]) return d;
    const neighbors: Array<[number, number]> = [
      [c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1],
    ];
    for (const [nc, nr] of neighbors) {
      const k = key(nc, nr);
      if (!visited.has(k) && isWalkableCell(nc, nr)) {
        visited.add(k);
        queue.push([nc, nr, d + 1]);
      }
    }
  }
  return Infinity;
}
