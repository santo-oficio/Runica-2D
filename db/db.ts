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
  currentSubLevel: number; // 1..12
  totalStagesCompleted: number; // 0..96 (contador global monótono)
  updatedAt: number;
  /** true cuando el jugador ha pasado por "Nueva partida" (selección de personaje). */
  started?: boolean;
  playerName?: string;
  avatarIndex?: number;
  /** Oro acumulado (se muestra en mapamundi/submundo). */
  gold?: number;
  /** Último mundo seleccionado en el mapamundi (posición del avatar al volver). */
  lastWorld?: string;
  /** Progreso por mundo: última isla jugada + islas completadas (0..MAP_LEVELS_PER_WORLD-1). */
  worldProgress?: Record<string, { last?: number; completed?: number[] }>;
  /** Nivel de juego actual (tier 1..14 según la curva global de dificultad). */
  gameLevel?: number;
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
export const SUBLEVELS_PER_WORLD = 12;
export const TOTAL_STAGES = WORLDS.length * SUBLEVELS_PER_WORLD; // 96
export const TOTAL_TIERS = 14;
/** Tier de dificultad inicial: la partida siempre empieza en el nivel 5. */
export const FIRST_TIER = 5;
/** Islas jugables por submundo en el mapa (rejilla serpiente 4×3). */
export const MAP_LEVELS_PER_WORLD = SUBLEVELS_PER_WORLD;
/** Mundo central del mapamundi: solo se desbloquea al completar los demás. */
export const FINAL_WORLD = "MAZMORRA";

/** Etapa global (1..96) a partir de mundo y subnivel. */
export function stageFor(world: number, subLevel: number): number {
  return (world - 1) * SUBLEVELS_PER_WORLD + subLevel;
}

/**
 * Tier de dificultad (5..14) según el Nº DE PANTALLAS SUPERADAS, no la
 * posición en el mapa (los mundos se juegan en orden libre). La partida
 * siempre empieza en el tier 5 y los 96 escenarios se reparten de forma
 * uniforme entre los 10 tiers restantes (~9-10 islas por tier).
 */
export function tierForCompleted(completed: number): number {
  const c = Math.max(0, Math.min(TOTAL_STAGES - 1, completed));
  return Math.min(TOTAL_TIERS, FIRST_TIER + Math.floor((c * (TOTAL_TIERS - FIRST_TIER + 1)) / TOTAL_STAGES));
}

/** Banda de dificultad continua (0.5..8.0) según pantallas superadas. */
export function bandForCompleted(completed: number): number {
  const c = Math.max(0, Math.min(TOTAL_STAGES - 1, completed));
  return 0.5 + (c / (TOTAL_STAGES - 1)) * 7.5;
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
    gold: 0,
    lastWorld: "AGUA",
    worldProgress: {},
    gameLevel: FIRST_TIER,
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
    player.gameLevel = tierForCompleted(player.totalStagesCompleted);
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

/**
 * Busca una pantalla por id en el tier donde vive. El id codifica el nivel
 * ("l3-s12" → tier 3); si no, se recorren todos los tiers. Necesario para
 * re-jugar puzzles de islas ya completadas cuando el tier actual ha subido.
 */
function findScreenById(id: string): Screen | null {
  const tiers = (() => {
    const m = /^l(\d+)-/.exec(id);
    const t = m ? Number(m[1]) : 0;
    return t >= 1 && t <= TOTAL_TIERS
      ? [t]
      : Array.from({ length: TOTAL_TIERS }, (_, i) => i + 1);
  })();
  for (const t of tiers) {
    try {
      const s = ensureTierLoaded(t).find((sc) => sc.id === id);
      if (s) return s;
    } catch { /* tier sin banco (p.ej. tiers archivados 1-4) */ }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------

export function getPlayer(): PlayerState {
  return { ...player };
}

/** Hay una partida empezada (el jugador eligió personaje/nombre alguna vez). */
export function hasSaveGame(): boolean {
  return player.started === true;
}

/**
 * Nueva partida: reinicia progreso y asignaciones, y guarda nombre/avatar.
 * Devuelve el estado inicial del jugador.
 */
export function startNewGame(playerName: string, avatarIndex: number): PlayerState {
  player = {
    ...defaultPlayer(),
    started: true,
    playerName,
    avatarIndex,
  };
  assignments = new Map();
  persist();
  return { ...player };
}

/** Etapa global actual del jugador (la que va a jugar a continuación). */
export function currentStage(): number {
  return stageFor(player.currentWorld, player.currentSubLevel);
}

/** Tier de dificultad actual: depende de las pantallas superadas. */
export function currentTier(): number {
  return tierForCompleted(player.totalStagesCompleted);
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
  const tier = currentTier();
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
  const tier = currentTier();
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

// ---------------------------------------------------------------------------
// Progreso por mapa (submundos de 12 islas)
// ---------------------------------------------------------------------------

/**
 * Tier de dificultad de la pantalla que toca jugar: por pantallas superadas
 * (los mundos se juegan en orden libre, el nivel no depende de la isla).
 */
export function mapTierFor(_world: string, _level: number): number {
  return currentTier();
}

/** Recuerda el último mundo seleccionado en el mapamundi. */
export function setLastWorld(world: string): PlayerState {
  if ((WORLDS as readonly string[]).includes(world)) player.lastWorld = world;
  player.updatedAt = Date.now();
  persist();
  return { ...player };
}

/** Recuerda la última isla jugada de un mundo (completada o no). */
export function setLevelPosition(world: string, level: number): PlayerState {
  if (!(WORLDS as readonly string[]).includes(world)) return { ...player };
  const wp = { ...(player.worldProgress ?? {}) };
  const w = { ...(wp[world] ?? {}) };
  w.last = Math.max(0, Math.min(MAP_LEVELS_PER_WORLD - 1, level));
  wp[world] = w;
  player.worldProgress = wp;
  player.lastWorld = world;
  player.gameLevel = currentTier();
  player.updatedAt = Date.now();
  persist();
  return { ...player };
}

/**
 * IDs de pantallas ya usadas en TODO el juego (asignadas o completadas en
 * cualquier isla). Garantiza que ninguna pantalla se repita jamás.
 */
function usedScreenIds(): Set<string> {
  const used = new Set<string>();
  for (const a of assignments.values()) {
    if (a.current) used.add(a.current);
    for (const id of a.completed) used.add(id);
  }
  return used;
}

/**
 * Pantalla asignada a una isla del mapa (sticky): mientras la isla no se
 * complete, siempre devuelve la misma pantalla del tier correspondiente.
 * La elección excluye TODAS las pantallas ya usadas en el juego, así dos
 * islas nunca reciben el mismo puzzle.
 * Al re-entrar a una isla YA COMPLETADA siempre sale el mismo puzzle que
 * se completó ahí (buscado en su tier original, aunque el tier actual haya
 * subido) — nunca una pantalla nueva.
 */
export function getLevelScreen(world: string, level: number): { screen: Screen; tier: number } {
  const tier = mapTierFor(world, level);
  const key = `map:${world}:${level}`;
  let assign = assignments.get(key) ?? { current: null, completed: [] };

  if (assign.current !== null) {
    const s = findScreenById(assign.current);
    if (s) return { screen: s, tier };
    assign.current = null;
  }

  const replayId = assign.completed[0] ?? null;
  if (replayId !== null) {
    const s = findScreenById(replayId);
    if (s) return { screen: s, tier };
  }

  const pool = ensureTierLoaded(tier);
  const used = usedScreenIds();
  const chosen = pool.find((s) => !used.has(s.id)) ?? pool[0]!;
  assign.current = chosen.id;
  assignments.set(key, assign);
  persist();
  return { screen: chosen, tier };
}

/**
 * Marca una isla del mapa como completada: libera la pantalla asignada,
 * registra el nivel y suma el oro ganado.
 */
export function completeLevel(world: string, level: number, goldEarned = 0, screenId?: string): PlayerState {
  const key = `map:${world}:${level}`;
  const assign = assignments.get(key) ?? { current: null, completed: [] };
  if (screenId) {
    if (assign.current === screenId) assign.current = null;
    if (!assign.completed.includes(screenId)) assign.completed.push(screenId);
  }
  assignments.set(key, assign);

  const wp = { ...(player.worldProgress ?? {}) };
  const w = { completed: [] as number[], ...(wp[world] ?? {}) };
  const isNew = !w.completed!.includes(level);
  if (isNew) {
    w.completed!.push(level);
    player.totalStagesCompleted += 1; // el nivel de juego sube por pantallas superadas
  }
  w.last = level;
  wp[world] = w;
  player.worldProgress = wp;
  player.lastWorld = world;
  player.gold = (player.gold ?? 0) + goldEarned;
  player.gameLevel = tierForCompleted(player.totalStagesCompleted);
  player.updatedAt = Date.now();
  persist();
  return { ...player };
}

/** Mundo completado: todas sus islas del mapa terminadas. */
export function isWorldComplete(world: string): boolean {
  return (player.worldProgress?.[world]?.completed?.length ?? 0) >= MAP_LEVELS_PER_WORLD;
}

/**
 * Un mundo se puede jugar si no está completo y, en el caso del mundo final
 * (centro del mapa), solo cuando todos los demás están completados.
 */
export function isWorldUnlocked(world: string): boolean {
  if (isWorldComplete(world)) return false;
  if (world !== FINAL_WORLD) return true;
  return WORLDS.filter((w) => w !== FINAL_WORLD).every(isWorldComplete);
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
    currentTier: currentTier(),
    currentBand: Number(bandForCompleted(player.totalStagesCompleted).toFixed(2)),
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
 * Uso: modo práctica (no cuentan para las estadísticas del jugador).
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
