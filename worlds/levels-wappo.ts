/**
 * 10 niveles de dificultad del Wappo (docs/11-REGLAS-WAPPO-ORIGINAL.md).
 *
 * Tablero fijo 8x6 (docs/11-ACTUALIZACION-NIVELES-DIFICULTAD-PROGRESO.md).
 * Progresión de dificultad 1-10:
 *  - Nivel 1-2: tutorial, enemigo en vigilancia (no persigue)
 *  - Nivel 3-4: enemigo persigue pero está bloqueado por muro
 *  - Nivel 5-6: enemigo + trampas, rutas más largas
 *  - Nivel 7-8: 2 enemigos + trampas, puzle de ruta
 *  - Nivel 9-10: 2 enemigos + laberinto + trampas, máxima dificultad
 *
 * Reglas Wappo:
 *  - Jugador: 1 casilla/turno, ortogonal
 *  - Enemigo: 2 casillas/turno, preferencia horizontal
 *  - Obstáculos (X): bloquean a ambos
 *  - Trampas (T): aturden 3 turnos a quien las pisa (jugador o enemigo)
 *  - Salida (G): en esquina, victoria al llegar
 *
 * Todos los niveles son resolubles (verificado por el solver en tests).
 * Ninguna entidad se solapa con otra en la misma casilla.
 */

import type { LevelMap, EnemyPattern } from "../schemas/types.js";

export const BOARD_WIDTH = 8;
export const BOARD_HEIGHT = 6;

function mkLevel(
  levelId: number,
  grid: readonly string[],
  player: [number, number],
  goal: [number, number],
  enemies: ReadonlyArray<{ pos: [number, number]; pattern: EnemyPattern }>,
): LevelMap {
  return {
    levelId,
    seed: 1000 + levelId,
    world: "AGUA",
    backgroundTemplateId: "agua-bg-01",
    archetype: "RECTANGULO",
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    grid,
    player,
    enemies,
    goal,
    keys: [],
    doors: [],
    rulesetVersion: "wappo-v1",
  };
}

// ---------------------------------------------------------------------------
// Nivel 1 — Tutorial: enemigo en vigilancia (no se mueve), camino recto.
// ---------------------------------------------------------------------------
export const LEVEL_01: LevelMap = mkLevel(
  1,
  [
    "........",
    ".......G",
    "P.......",
    "........",
    "........",
    "......E.",
  ],
  [0, 2],
  [7, 1],
  [{ pos: [6, 5], pattern: "VIGILANCIA_ZONA" }],
);

// ---------------------------------------------------------------------------
// Nivel 2 — Tutorial con obstáculo: navegar alrededor, enemigo en vigilancia.
// ---------------------------------------------------------------------------
export const LEVEL_02: LevelMap = mkLevel(
  2,
  [
    "........",
    ".......G",
    "P.X.....",
    "........",
    "........",
    "......E.",
  ],
  [0, 2],
  [7, 1],
  [{ pos: [6, 5], pattern: "VIGILANCIA_ZONA" }],
);

// ---------------------------------------------------------------------------
// Nivel 3 — Enemigo persigue pero está bloqueado por un muro horizontal.
// ---------------------------------------------------------------------------
export const LEVEL_03: LevelMap = mkLevel(
  3,
  [
    "........",
    ".......G",
    "P.......",
    "XXXXXXX.",
    "........",
    "E.......",
  ],
  [0, 2],
  [7, 1],
  [{ pos: [0, 5], pattern: "PERSECUCION_SIMPLE" }],
);

// ---------------------------------------------------------------------------
// Nivel 4 — Enemigo persigue, muro con un hueco. Ruta más larga.
// ---------------------------------------------------------------------------
export const LEVEL_04: LevelMap = mkLevel(
  4,
  [
    "........",
    ".......G",
    "P.......",
    "XXXXXX.X",
    "........",
    "E.......",
  ],
  [0, 2],
  [7, 1],
  [{ pos: [0, 5], pattern: "PERSECUCION_SIMPLE" }],
);

// ---------------------------------------------------------------------------
// Nivel 5 — Muro horizontal + trampa. Enemigo cae en trampa al perseguir.
// ---------------------------------------------------------------------------
export const LEVEL_05: LevelMap = mkLevel(
  5,
  [
    "........",
    ".......G",
    "P.......",
    "XXXXXXX.",
    "........",
    "...T..E.",
  ],
  [0, 2],
  [7, 1],
  [{ pos: [6, 5], pattern: "PERSECUCION_SIMPLE" }],
);

// ---------------------------------------------------------------------------
// Nivel 6 — Trampa + obstáculos verticales. Ruta más larga.
// ---------------------------------------------------------------------------
export const LEVEL_06: LevelMap = mkLevel(
  6,
  [
    "........",
    ".......G",
    "P.X.T...",
    ".X......",
    "........",
    "......E.",
  ],
  [0, 2],
  [7, 1],
  [{ pos: [6, 5], pattern: "PERSECUCION_SIMPLE" }],
);

// ---------------------------------------------------------------------------
// Nivel 7 — 2 enemigos + trampa. Un enemigo vigilancia, otro persigue.
// ---------------------------------------------------------------------------
export const LEVEL_07: LevelMap = mkLevel(
  7,
  [
    "........",
    ".......G",
    "P.......",
    "XXXXXXX.",
    "........",
    "E.T...E.",
  ],
  [0, 2],
  [7, 1],
  [
    { pos: [0, 5], pattern: "VIGILANCIA_ZONA" },
    { pos: [6, 5], pattern: "PERSECUCION_SIMPLE" },
  ],
);

// ---------------------------------------------------------------------------
// Nivel 8 — 2 enemigos que persiguen + trampa + muro.
// ---------------------------------------------------------------------------
export const LEVEL_08: LevelMap = mkLevel(
  8,
  [
    "........",
    ".......G",
    "P.......",
    "XXXXXXX.",
    "........",
    "E...TE..",
  ],
  [0, 2],
  [7, 1],
  [
    { pos: [0, 5], pattern: "PERSECUCION_SIMPLE" },
    { pos: [5, 5], pattern: "PERSECUCION_SIMPLE" },
  ],
);

// ---------------------------------------------------------------------------
// Nivel 9 — 2 enemigos + muro vertical + trampa + obstáculos.
// ---------------------------------------------------------------------------
export const LEVEL_09: LevelMap = mkLevel(
  9,
  [
    "........",
    ".......G",
    "........",
    "XXXXXXX.",
    "..X.X...",
    "E..T..E.",
  ],
  [0, 2],
  [7, 1],
  [
    { pos: [0, 5], pattern: "PERSECUCION_SIMPLE" },
    { pos: [6, 5], pattern: "PERSECUCION_SIMPLE" },
  ],
);

// ---------------------------------------------------------------------------
// Nivel 10 — Máxima dificultad. 2 enemigos + muros + 2 trampas.
// ---------------------------------------------------------------------------
export const LEVEL_10: LevelMap = mkLevel(
  10,
  [
    "........",
    ".......G",
    "....X...",
    "XXXXXXX.",
    "..X.X.T.",
    "ET...E..",
  ],
  [0, 2],
  [7, 1],
  [
    { pos: [0, 5], pattern: "PERSECUCION_SIMPLE" },
    { pos: [5, 5], pattern: "PERSECUCION_SIMPLE" },
  ],
);

// ---------------------------------------------------------------------------
// Exportar todos para tests y demo
// ---------------------------------------------------------------------------
export const ALL_LEVELS: readonly LevelMap[] = [
  LEVEL_01, LEVEL_02, LEVEL_03, LEVEL_04, LEVEL_05,
  LEVEL_06, LEVEL_07, LEVEL_08, LEVEL_09, LEVEL_10,
];
