/**
 * Tests del RNG determinista (Fase 2).
 */

import { describe, it, expect } from "vitest";
import { createRng } from "../generator/rng.js";

describe("createRng — determinismo", () => {
  it("la misma seed produce la misma secuencia", () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("seeds distintas producen secuencias distintas", () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it("next() devuelve valores en [0, 1)", () => {
    const rng = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int(min, max) devuelve enteros en rango inclusive", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(3, 9);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
  });

  it("int(min, max) con min > max lo invierte", () => {
    const rng = createRng(7);
    for (let i = 0; i < 100; i++) {
      const v = rng.int(9, 3);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
  });

  it("chance(p) devuelve true ~p de las veces", () => {
    const rng = createRng(99);
    let trues = 0;
    const N = 10000;
    for (let i = 0; i < N; i++) if (rng.chance(0.3)) trues++;
    const ratio = trues / N;
    expect(ratio).toBeGreaterThan(0.27);
    expect(ratio).toBeLessThan(0.33);
  });

  it("pick devuelve un elemento del array", () => {
    const rng = createRng(5);
    const arr = [10, 20, 30, 40];
    const v = rng.pick(arr);
    expect(arr).toContain(v);
  });

  it("pick lanza sobre array vacío", () => {
    const rng = createRng(5);
    expect(() => rng.pick([])).toThrow();
  });

  it("shuffle mezcla sin perder ni duplicar elementos", () => {
    const rng = createRng(13);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const orig = [...arr];
    rng.shuffle(arr);
    expect(arr.sort()).toEqual(orig.sort());
  });

  it("shuffle es determinista por seed", () => {
    const a = createRng(100);
    const b = createRng(100);
    const arrA = [1, 2, 3, 4, 5, 6, 7, 8];
    const arrB = [1, 2, 3, 4, 5, 6, 7, 8];
    a.shuffle(arrA);
    b.shuffle(arrB);
    expect(arrA).toEqual(arrB);
  });

  it("expone la seed original", () => {
    expect(createRng(777).seed).toBe(777);
  });
});
