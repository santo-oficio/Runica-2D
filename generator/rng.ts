/**
 * RNG determinista por seed.
 *
 * Usa mulberry32: algoritmo PRNG de 32 bits rápido, con secuencia
 * determinista a partir de una semilla entera. La misma seed produce
 * siempre la misma secuencia de números, garantizando que un LevelMap
 * generado con una seed es reproducible (docs/03 §1).
 */

/** PRNG determinista con API cómoda. */
export interface Rng {
  /** Siguiente float en [0, 1). */
  next(): number;
  /** Entero en [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Devuelve true con probabilidad p (0..1). */
  chance(p: number): boolean;
  /** Elemento aleatorio de un array (no vacío). */
  pick<T>(arr: readonly T[]): T;
  /** Mezcla un array in-place (Fisher-Yates) y lo devuelve. */
  shuffle<T>(arr: T[]): T[];
  /** Seed original. */
  readonly seed: number;
}

/**
 * Crea un Rng determinista a partir de una seed entera.
 * mulberry32: https://gist.github.com/tommyettinger/46da8afcea5256c1b3d9
 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;

  function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function int(min: number, max: number): number {
    if (max < min) [min, max] = [max, min];
    const range = max - min + 1;
    return min + Math.floor(next() * range);
  }

  function chance(p: number): boolean {
    return next() < p;
  }

  function pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("pick sobre array vacío");
    return arr[Math.floor(next() * arr.length)]!;
  }

  function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const tmp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = tmp;
    }
    return arr;
  }

  return { next, int, chance, pick, shuffle, seed };
}
