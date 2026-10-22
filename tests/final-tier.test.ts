/**
 * El boss final (última isla de MAZMORRA) usa el tier 18, que coincide
 * con el techo de la curva de progresión (tiers 6-18) y tiene su propio
 * banco (db/screens-tier-18.json).
 */

import { describe, it, expect } from "vitest";
import {
  mapTierFor,
  tierForCompleted,
  FINAL_TIER,
  FINAL_WORLD,
  BOSS_LEVEL_IDX,
  MAP_LEVELS_PER_WORLD,
  TOTAL_TIERS,
  FIRST_TIER,
} from "../db/db.js";

describe("Tier 18 — boss final de MAZMORRA", () => {
  it("el tier final es 18, el techo de la curva (6..18)", () => {
    expect(FINAL_TIER).toBe(18);
    expect(FINAL_TIER).toBe(TOTAL_TIERS);
  });

  it("la última isla de MAZMORRA usa el tier 18", () => {
    expect(mapTierFor(FINAL_WORLD, BOSS_LEVEL_IDX)).toBe(FINAL_TIER);
  });

  it("solo la última isla: las demás de MAZMORRA siguen la curva", () => {
    expect(mapTierFor(FINAL_WORLD, 0)).toBe(tierForCompleted(0));
    expect(mapTierFor(FINAL_WORLD, BOSS_LEVEL_IDX - 1)).toBe(tierForCompleted(0));
  });

  it("la última isla de cualquier otro mundo sigue la curva", () => {
    expect(mapTierFor("FUEGO", BOSS_LEVEL_IDX)).toBe(tierForCompleted(0));
    expect(mapTierFor("ESPACIO", BOSS_LEVEL_IDX)).toBe(tierForCompleted(0));
  });

  it("BOSS_LEVEL_IDX es el índice 0-based de la última isla", () => {
    expect(BOSS_LEVEL_IDX).toBe(MAP_LEVELS_PER_WORLD - 1);
  });

  it("la curva va del tier 2 al 18 (techo = tier del boss final)", () => {
    expect(tierForCompleted(0)).toBe(FIRST_TIER);
    expect(tierForCompleted(10_000)).toBe(TOTAL_TIERS);
    expect(tierForCompleted(95)).toBe(18);
  });
});
