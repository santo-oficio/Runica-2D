/**
 * Base de datos local con lazy-loading por tier + persistencia JSON.
 *
 * Estructura de archivos:
 *  - db/screens-tier-1.json .. db/screens-tier-14.json: banco de pantallas
 *    generadas y validadas (50.000 por tier = 700.000 total).
 *  - db/player.json: estado del jugador + asignaciones sticky por (mundo, tier).
 *
 * Lazy-loading: solo se carga en memoria el archivo del tier actual.
 * Cambiar de tier descarga el anterior y carga el nuevo (~50ms).
 *
 * Lógica sticky (por mundo + tier):
 *  1. Al entrar en una pantalla, se marca como asignada para ese (mundo, tier).
 *  2. Mientras esté en ese mundo y no complete el juego, siempre se muestra la misma.
 *  3. Al completarla, se marca como completada — jamás vuelve a salir para ese (mundo, tier).
 *  4. Si no quedan pantallas sin usar para ese (mundo, tier), se resetean todas a no-usadas.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = __dirname;
const PLAYER_PATH = join(DB_DIR, "player.json");

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type Pattern = "CHASE";

export interface Screen {
  id: string;
  level: number; // tier 1..14
  world: string;
  grid: string[];
  player: [number, number];
  goal: [number, number];
  enemies: { pos: [number, number]; pattern: Pattern }[];
  obstacles: [number, number][];
  traps: [number, number][];
  minMoves: number;
}

export type ProgressStatus = "in_use" | "completed";

export interface ScreenProgress {
  screenId: string;
  tier: number; // 1..14
  world: string;
  status: ProgressStatus;
  turns: number; // turnos en los que se completó (0 si no completada)
  retries: number; // reintentos (fallos)
  assignedAt: number;
  completedAt: number | null;
}

export interface PlayerState {
  playerId: string;
  currentWorld: number; // 1..8
  currentSubLevel: number; // 1..15
  totalStagesCompleted: number; // 0..120 (contador global monótono)
  updatedAt: number;
}

/**
 * Asignaciones sticky por combinación (mundo, tier).
 * - current: pantalla actualmente asignada (null si ninguna)
 * - completed: IDs de pantallas completadas para ese (mundo, tier)
 */
interface WorldTierAssignment {
  current: string | null;
  completed: string[];
}

// ---------------------------------------------------------------------------
// Curva de dificultad (docs/12, docs/15)
// ---------------------------------------------------------------------------

export const WORLDS = [
  "ESPACIO", "AGUA", "TIERRA", "FUEGO", "HIELO", "VIENTO", "INFRAMUNDO", "MAZMORRA",
] as const;
export const SUBLEVELS_PER_WORLD = 15;
export const TOTAL_STAGES = WORLDS.length * SUBLEVELS_PER_WORLD; // 120
export const TOTAL_TIERS = 14;
export const CURVE_P = 0.6;

/** Etapa global (1..120) a partir de mundo y subnivel. */
export function stageFor(world: number, subLevel: number): number {
  return (world - 1) * SUBLEVELS_PER_WORLD + subLevel;
}

/** Tier de dificultad (1..14) para una etapa global, con la curva p=0.6. */
export function tierForStage(g: number): number {
  const x = (g - 1) / (TOTAL_STAGES - 1);
  const y = Math.pow(x, CURVE_P);
  return Math.min(TOTAL_TIERS - 1, Math.floor(y * TOTAL_TIERS)) + 1;
}

/** Banda de dificultad continua (0.5..8.0) para una etapa global. */
export function bandForStage(g: number): number {
  const x = (g - 1) / (TOTAL_STAGES - 1);
  const y = Math.pow(x, CURVE_P);
  return 0.5 + y * 7.5;
}

// ---------------------------------------------------------------------------
// Estado en memoria
// ---------------------------------------------------------------------------

// Cache de pantallas por tier (lazy-loaded)
let loadedTier: number | null = null;
let tierScreens: Screen[] = [];

// Estado del jugador
let player: PlayerState = defaultPlayer();

// Asignaciones sticky: clave "world:tier" → { current, completed }
let assignments = new Map<string, WorldTierAssignment>();

function defaultPlayer(): PlayerState {
  return {
    playerId: "player-1",
    currentWorld: 1,
    currentSubLevel: 1,
    totalStagesCompleted: 0,
    updatedAt: Date.now(),
  };
}

function assignmentKey(world: string, tier: number): string {
  return `${world}:${tier}`;
}

function persist(): void {
  if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });
  writeFileSync(
    PLAYER_PATH,
    JSON.stringify({ player, assignments: Object.fromEntries(assignments) }, null, 2),
    "utf-8",
  );
}

/** Carga el estado del jugador y las asignaciones desde player.json. */
export function loadDb(): void {
  if (existsSync(PLAYER_PATH)) {
    const data = JSON.parse(readFileSync(PLAYER_PATH, "utf-8")) as {
      player?: Partial<PlayerState>;
      assignments?: Record<string, WorldTierAssignment>;
    };
    if (data.player) player = { ...defaultPlayer(), ...data.player };
    assignments = new Map(Object.entries(data.assignments ?? {}));
  } else {
    player = defaultPlayer();
    assignments = new Map();
  }
}

/** Carga en memoria las pantallas de un tier (lazy-loading con cache). */
function ensureTierLoaded(tier: number): Screen[] {
  if (loadedTier === tier) return tierScreens;
  const path = join(DB_DIR, `screens-tier-${tier}.json`);
  if (!existsSync(path)) {
    throw new Error(`No existe el archivo de pantallas para tier ${tier}: ${path}`);
  }
  tierScreens = JSON.parse(readFileSync(path, "utf-8")) as Screen[];
  loadedTier = tier;
  return tierScreens;
}

// ---------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------

export function getPlayer(): PlayerState {
  return { ...player };
}

/** Etapa global actual del jugador (la que va a jugar a continuación). */
export function currentStage(): number {
  return stageFor(player.currentWorld, player.currentSubLevel);
}

/** Tier de dificultad de la etapa actual. */
export function currentTier(): number {
  return tierForStage(currentStage());
}

/** Mundo de la etapa actual. */
export function currentWorldName(): string {
  return WORLDS[player.currentWorld - 1] ?? "AGUA";
}

/**
 * Devuelve la pantalla que toca jugar en la posición actual:
 *  1. Si hay una pantalla "in_use" para (mundo, tier) → esa (sticky).
 *  2. Si no, una pantalla no completada del tier → se asigna.
 *  3. Si todas están completadas → reset de completed, asignar cualquiera.
 */
export function getNextScreen(): { screen: Screen; tier: number; world: string; stage: number } {
  const stage = currentStage();
  const tier = tierForStage(stage);
  const world = currentWorldName();
  const key = assignmentKey(world, tier);

  let assign = assignments.get(key) ?? { current: null, completed: [] };

  // 1. Pantalla en uso (sticky)
  if (assign.current !== null) {
    const pool = ensureTierLoaded(tier);
    const s = pool.find((sc) => sc.id === assign.current);
    if (s) return { screen: s, tier, world, stage };
    // Si no se encuentra (datos corruptos), reasignar
    assign.current = null;
  }

  // 2. Pantalla no completada
  const pool = ensureTierLoaded(tier);
  const completedSet = new Set(assign.completed);
  const unused = pool.filter((s) => !completedSet.has(s.id));

  let chosen: Screen;
  if (unused.length > 0) {
    // Determinista: primera no completada
    chosen = unused[0]!;
  } else {
    // 3. Todas completadas → reset
    assign.completed = [];
    chosen = pool[0]!;
  }

  assign.current = chosen.id;
  assignments.set(key, assign);
  persist();
  return { screen: chosen, tier, world, stage };
}

/** Marca una pantalla como completada y avanza al siguiente subnivel/mundo. */
export function completeScreen(screenId: string, _turns: number): PlayerState {
  const stage = currentStage();
  const tier = tierForStage(stage);
  const world = currentWorldName();
  const key = assignmentKey(world, tier);

  const assign = assignments.get(key) ?? { current: null, completed: [] };

  // Marcar como completada
  if (assign.current === screenId) {
    assign.current = null;
  }
  if (!assign.completed.includes(screenId)) {
    assign.completed.push(screenId);
  }
  assignments.set(key, assign);

  // Avanzar posición (subnivel → mundo), con contador global monótono.
  player.totalStagesCompleted += 1;
  if (player.currentSubLevel >= SUBLEVELS_PER_WORLD) {
    if (player.currentWorld < WORLDS.length) {
      player.currentWorld += 1;
      player.currentSubLevel = 1;
    } else {
      // Último subnivel del último mundo: partida completa
      player.currentSubLevel = SUBLEVELS_PER_WORLD;
    }
  } else {
    player.currentSubLevel += 1;
  }
  player.updatedAt = Date.now();
  persist();
  return { ...player };
}

/** Incrementa el contador de reintentos de la pantalla actual (sin persistir avance). */
export function failScreen(_screenId: string): void {
  // Los reintentos no cambian la asignación sticky: la pantalla sigue asignada.
  // Se podría añadir un contador si se quiere estadística.
}

/** Estadísticas globales del jugador. */
export function getStats() {
  const stage = currentStage();
  let totalCompleted = 0;
  for (const a of assignments.values()) {
    totalCompleted += a.completed.length;
  }
  return {
    player: { ...player },
    currentStage: stage,
    currentTier: tierForStage(stage),
    currentBand: Number(bandForStage(stage).toFixed(2)),
    totalStages: TOTAL_STAGES,
    screensCompleted: totalCompleted,
  };
}

/** Devuelve las asignaciones completas (para depuración/API). */
export function getProgress(): { world: string; tier: number; current: string | null; completed: string[] }[] {
  const result: { world: string; tier: number; current: string | null; completed: string[] }[] = [];
  for (const [key, a] of assignments) {
    const [world, tierStr] = key.split(":");
    result.push({ world: world!, tier: Number(tierStr), current: a.current, completed: a.completed });
  }
  return result;
}

/**
 * Pantalla aleatoria de un tier, SIN tocar el progreso ni persistir.
 * Uso: demos jugables (no cuentan para las estadísticas del jugador).
 */
export function getRandomScreenByTier(tier: number): Screen | null {
  const pool = ensureTierLoaded(tier);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

/** Devuelve una pantalla por su ID (carga el tier correspondiente si hace falta). */
export function getScreenById(id: string): Screen | null {
  // El ID tiene formato "l{tier}-s{index}"
  const match = id.match(/^l(\d+)-s\d+$/);
  if (!match) return null;
  const tier = Number(match[1]);
  const pool = ensureTierLoaded(tier);
  return pool.find((s) => s.id === id) ?? null;
}
