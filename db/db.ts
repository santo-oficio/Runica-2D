/**
 * Base de datos local con lazy-loading por tier + persistencia JSON.
 *
 * Estructura de archivos:
 *  - db/screens-tier-6.json .. db/screens-tier-18.json: banco de pantallas
 *    generadas y validadas (25.000 por tier). La curva jugable es 6..18;
 *    el tier 18 coincide con el boss final (ultima isla de MAZMORRA).
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
/** Datos del jugador (writable). En la app instalada, fuera de resources/. */
const DB_DIR = process.env.RUNIKA_DB_DIR ?? __dirname;
/** Bancos de pantallas (read-only): junto al código, o ROOT/db en la app. */
const BANK_DIR =
  process.env.RUNIKA_BANK_DIR ??
  join(process.env.RUNIKA_ROOT ?? dirname(__dirname), "db");
const PLAYER_PATH = join(DB_DIR, "player.json");

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type Pattern = "CHASE";

export interface Screen {
  id: string;
  level: number; // tier 6..18
  world: string;
  grid: string[];
  player: [number, number];
  goal: [number, number];
  enemies: { pos: [number, number]; pattern: Pattern }[];
  obstacles: [number, number][];
  traps: [number, number][];
  minMoves: number;
  /** Jugada óptima mostrada (par): mínimo real +1/2. Generada por el generador nuevo. */
  par?: number;
  /** Mínimo real BFS de la solución óptima. */
  trueMin?: number;
  /** Conteos de soluciones [par, par-1, par-2] (capado). */
  sols?: number[];
}

export type ProgressStatus = "in_use" | "completed";

export interface ScreenProgress {
  screenId: string;
  tier: number; // 1..15
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
  /** Progreso por mundo: última isla jugada + islas completadas (0..MAP_LEVELS_PER_WORLD-1)
   *  + `shopGone`: índices de tiendas que desaparecieron al pasar de largo.
   *  + `midasAt`: isla donde se aplicó el Toque de Midas — el oro de las islas
   *    posteriores de ese mundo se duplica para siempre. */
  worldProgress?: Record<string, { last?: number; completed?: number[]; shopGone?: number[]; shopVisited?: number[]; midasAt?: number }>;
  /** Inventario de la tienda: itemId -> usos restantes. */
  inventory?: Record<string, number>;
  /** Compras acumuladas por ítem: solo crece en ítems con `priceGrowth`
   *  (p. ej. midas: cada compra multiplica su precio por 1.8). */
  itemPurchases?: Record<string, number>;
  /** Nivel de juego actual (tier 1..14 según la curva global; el 15 es solo del boss final). */
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
  /** Huellas de contenido de las pantallas usadas (dedupe entre bancos de tier). */
  keys?: string[];
}

// ---------------------------------------------------------------------------
// Curva de dificultad (docs/12, docs/15)
// ---------------------------------------------------------------------------

export const WORLDS = [
  "ESPACIO", "AGUA", "TIERRA", "FUEGO", "HIELO", "VIENTO", "INFRAMUNDO", "MAZMORRA",
] as const;
export const SUBLEVELS_PER_WORLD = 12;
export const TOTAL_STAGES = WORLDS.length * SUBLEVELS_PER_WORLD; // 96
export const TOTAL_TIERS = 18;
/** Tier del boss final (ultima isla de MAZMORRA): coincide con el techo de la curva. */
export const FINAL_TIER = 18;
/** Tier de dificultad inicial: la partida siempre empieza en el nivel 2. */
export const FIRST_TIER = 2;
/** Tier de la primera isla de cada mundo (bienvenida, sin cazadores). */
export const ENTRY_TIER = 1;
/** Islas jugables por submundo en el mapa (rejilla serpiente 4×3). */
export const MAP_LEVELS_PER_WORLD = SUBLEVELS_PER_WORLD;
/** Mundo central del mapamundi: solo se desbloquea al completar los demás. */
export const FINAL_WORLD = "MAZMORRA";
/** Índice (0-based) de la isla del boss en cada submundo. */
export const BOSS_LEVEL_IDX = MAP_LEVELS_PER_WORLD - 1;

/** Etapa global (1..96) a partir de mundo y subnivel. */
export function stageFor(world: number, subLevel: number): number {
  return (world - 1) * SUBLEVELS_PER_WORLD + subLevel;
}

/**
 * Tier de dificultad (2..18) según el Nº DE PANTALLAS SUPERADAS, no la
 * posición en el mapa (los mundos se juegan en orden libre). La partida
 * siempre empieza en el tier 2 y los 96 escenarios se reparten de forma
 * uniforme entre los 17 tiers (~5-6 islas por tier).
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
    lastWorld: "ESPACIO",
    worldProgress: {},
    gameLevel: FIRST_TIER,
  };
}

function assignmentKey(world: string, tier: number): string {
  return `${world}:${tier}`;
}

function persist(): void {
  usedKeysCache = null; // las asignaciones cambiaron: huellas se recalculan
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
  const path = join(BANK_DIR, `screens-tier-${tier}.json`);
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
    return t >= ENTRY_TIER && t <= FINAL_TIER
      ? [t]
      : Array.from({ length: FINAL_TIER - ENTRY_TIER + 1 }, (_, i) => ENTRY_TIER + i);
  })();
  for (const t of tiers) {
    try {
      const s = ensureTierLoaded(t).find((sc) => sc.id === id);
      if (s) return s;
    } catch { /* tier sin banco */ }
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
  return WORLDS[player.currentWorld - 1] ?? "ESPACIO";
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

  // 2. Pantalla no completada: sorteo AL AZAR entre las no jugadas — cada
  // partida recorre puzles distintos. La asignación queda sticky en
  // `assign.current`/`completed`: re-entrar a la misma isla repite.
  const pool = ensureTierLoaded(tier);
  const completedSet = new Set(assign.completed);
  const unused = pool.filter((s) => !completedSet.has(s.id));

  let chosen: Screen;
  if (unused.length > 0) {
    chosen = unused[Math.floor(Math.random() * unused.length)]!;
  } else {
    // 3. Todas completadas → reset
    assign.completed = [];
    chosen = pool[Math.floor(Math.random() * pool.length)]!;
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
 * Excepcion: la ultima isla de MAZMORRA (boss final) usa el tier 18,
 * exclusivo — no forma parte de la curva de progresion.
 */
export function mapTierFor(world: string, level: number): number {
  if (world === FINAL_WORLD && level === BOSS_LEVEL_IDX) return FINAL_TIER;
  const wIdx = WORLDS.indexOf(world as (typeof WORLDS)[number]);
  // Bienvenida solo en el PRIMER mundo: su primera isla juega tier 1
  // (laberinto sin cazadores) y la segunda el tier 2; en mundos posteriores
  // seria un descenso absurdo (antes TODAS las islas caian a tier 1-2 y el
  // mundo entero se sentia planisimo).
  if (wIdx === 0 && level === 0) return ENTRY_TIER;
  if (wIdx === 0 && level === 1) return FIRST_TIER;
  // Curva por mundo + rampa por isla: cada mundo arranca ~2 tiers por
  // encima del anterior y las 12 islas suben ~4-5 tiers dentro del mundo
  // (ESPACIO 1-6 → INFRAMUNDO 14-18 → MAZMORRA 16-18 + boss 18).
  const base = FIRST_TIER + Math.max(0, wIdx) * 2;
  const ramp = Math.floor(level * 0.45);
  return Math.min(TOTAL_TIERS, base + ramp);
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
 * Huella de contenido de una pantalla: mismo puzzle = misma clave aunque
 * exista en dos bancos de tier con ids distintos (hay ~950 duplicados así
 * entre bancos — el dedupe por id no los cazaba y el puzzle "se repetía").
 */
function screenContentKey(s: Screen): string {
  const cell = (p: readonly number[]) => `${p[0]},${p[1]}`;
  const en = (s.enemies ?? []).map((e) => `${cell(e.pos)}:${e.pattern}`).sort().join("|");
  const ob = (s.obstacles ?? []).map(cell).sort().join("|");
  const tr = (s.traps ?? []).map(cell).sort().join("|");
  return [(s.grid ?? []).join("/"), cell(s.player), cell(s.goal), en, ob, tr].join("#");
}

/**
 * Huellas de contenido de TODAS las pantallas ya usadas en la partida.
 * Las asignaciones antiguas sin `keys` se resuelven por id una sola vez
 * por sesión y sus huellas se guardan en la propia asignación.
 */
let usedKeysCache: Set<string> | null = null;
function usedContentKeys(): Set<string> {
  if (usedKeysCache) return usedKeysCache;
  const keys = new Set<string>();
  let migrated = false;
  for (const a of assignments.values()) {
    for (const k of a.keys ?? []) keys.add(k);
    for (const id of [a.current, ...a.completed]) {
      if (!id) continue;
      const s = findScreenById(id);
      if (!s) continue;
      const k = screenContentKey(s);
      keys.add(k);
      if (!(a.keys ?? []).includes(k)) { a.keys = [...(a.keys ?? []), k]; migrated = true; }
    }
  }
  if (migrated) persist();
  usedKeysCache = keys;
  return keys;
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
  const usedKeys = usedContentKeys();
  // Primera visita a la isla: sorteo AL AZAR entre las pantallas aún no
  // usadas en esta partida — ni por id NI por contenido (un mismo puzzle
  // puede existir en dos bancos con ids distintos y "repetirse").
  const free = pool.filter((s) => !used.has(s.id));
  const fresh = free.filter((s) => !usedKeys.has(screenContentKey(s)));
  const pickFrom = fresh.length > 0 ? fresh : free;
  const chosen = pickFrom.length > 0
    ? pickFrom[Math.floor(Math.random() * pickFrom.length)]!
    : pool[Math.floor(Math.random() * pool.length)]!;
  assign.current = chosen.id;
  assign.keys = [...(assign.keys ?? []), screenContentKey(chosen)];
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
    // El oro solo se gana la PRIMERA vez: re-jugar una isla completada no suma
    player.gold = (player.gold ?? 0) + goldEarned;
  }
  w.last = level;
  wp[world] = w;
  player.worldProgress = wp;
  player.lastWorld = world;
  player.gameLevel = tierForCompleted(player.totalStagesCompleted);
  player.updatedAt = Date.now();
  persist();
  return { ...player };
}

/** La isla tienda `index` desaparece cuando el jugador pasa a la isla
 *  siguiente sin entrar en ella (oportunidad única por tienda). */
export function markShopGone(world: string, index = 0): PlayerState {
  if (!(WORLDS as readonly string[]).includes(world)) return { ...player };
  const wp = { ...(player.worldProgress ?? {}) };
  const w = { ...(wp[world] ?? {}) };
  const prev = w.shopGone as number[] | boolean | undefined;
  const g = prev === true ? [0] : (Array.isArray(prev) ? [...prev] : []);
  if (!g.includes(index)) g.push(index);
  w.shopGone = g;
  wp[world] = w;
  player.worldProgress = wp;
  player.updatedAt = Date.now();
  persist();
  return { ...player };
}

/** La tienda `index` ya fue visitada una vez: se marcha volando y no
 *  reaparece aunque el jugador repita el nivel (visita única por tienda).
 *  Se marca también en `shopGone` para que deje de renderizarse, pero el
 *  submundo no dibuja la mancha de "pasada de largo" en las visitadas. */
export function markShopVisited(world: string, index = 0): PlayerState {
  if (!(WORLDS as readonly string[]).includes(world)) return { ...player };
  const wp = { ...(player.worldProgress ?? {}) };
  const w = { ...(wp[world] ?? {}) };
  const prev = w.shopGone as number[] | boolean | undefined;
  const g = prev === true ? [0] : (Array.isArray(prev) ? [...prev] : []);
  if (!g.includes(index)) g.push(index);
  w.shopGone = g;
  const v = Array.isArray(w.shopVisited) ? [...w.shopVisited] : [];
  if (!v.includes(index)) v.push(index);
  w.shopVisited = v;
  wp[world] = w;
  player.worldProgress = wp;
  player.updatedAt = Date.now();
  persist();
  return { ...player };
}

/** Pantalla bonus: suma (o resta) el botín del minijuego al oro del
 *  jugador. El total nunca baja de 0. */
export function addBonusGold(delta: number): PlayerState {
  player.gold = Math.max(0, (player.gold ?? 0) + Math.trunc(delta));
  player.updatedAt = Date.now();
  persist();
  return { ...player };
}

/** Mundo completado: todas sus islas del mapa terminadas. */
export function isWorldComplete(world: string): boolean {
  return (player.worldProgress?.[world]?.completed?.length ?? 0) >= MAP_LEVELS_PER_WORLD;
}

// ---------------------------------------------------------------------------
// Tienda (isla extra por submundo)
// ---------------------------------------------------------------------------

/** Precio efectivo de un ítem: si lleva `priceGrowth` (>1) cada compra
 *  multiplica el precio base — p. ej. midas ×1.8 por compra, sin decimales. */
export function itemPrice(itemId: string, price: number, priceGrowth?: number): number {
  if (!(priceGrowth && priceGrowth > 1)) return price;
  const n = player.itemPurchases?.[itemId] ?? 0;
  return Math.round(price * Math.pow(priceGrowth, n));
}

/** Compra un ítem: descuenta el oro y suma `uses` al inventario.
 *  Falla sin oro o si ya se lleva el máximo (`max` unidades por tipo).
 *  Con `priceGrowth` el precio crece por compra (ver `itemPrice`). */
export function buyItem(itemId: string, price: number, uses = 1, max = 1, priceGrowth?: number): { ok: boolean; player: PlayerState } {
  const inv0 = player.inventory ?? {};
  if ((inv0[itemId] ?? 0) >= max) return { ok: false, player: { ...player } };
  const effPrice = itemPrice(itemId, price, priceGrowth);
  if ((player.gold ?? 0) < effPrice) return { ok: false, player: { ...player } };
  player.gold = (player.gold ?? 0) - effPrice;
  const inv = { ...(player.inventory ?? {}) };
  inv[itemId] = (inv[itemId] ?? 0) + uses;
  player.inventory = inv;
  if (priceGrowth && priceGrowth > 1) {
    const p = { ...(player.itemPurchases ?? {}) };
    p[itemId] = (p[itemId] ?? 0) + 1;
    player.itemPurchases = p;
  }
  player.updatedAt = Date.now();
  persist();
  return { ok: true, player: { ...player } };
}

/** Consume un uso de un ítem del inventario (p. ej. una pista en el tablero). */
export function consumeItem(itemId: string): { ok: boolean; player: PlayerState } {
  const inv = { ...(player.inventory ?? {}) };
  if ((inv[itemId] ?? 0) <= 0) return { ok: false, player: { ...player } };
  inv[itemId] = (inv[itemId] ?? 0) - 1;
  player.inventory = inv;
  player.updatedAt = Date.now();
  persist();
  return { ok: true, player: { ...player } };
}

/** Aplica el Toque de Midas al mundo `world` desde la isla `level` (0-based):
 *  todo el oro que se gane en las islas posteriores de ESE mundo se duplica.
 *  Consume un uso del inventario; falla si el mundo ya tiene el efecto. */
export function activateMidas(world: string, level: number): { ok: boolean; player: PlayerState } {
  if (!(WORLDS as readonly string[]).includes(world)) return { ok: false, player: { ...player } };
  const wp = { ...(player.worldProgress ?? {}) };
  const w = { ...(wp[world] ?? {}) };
  if (w.midasAt != null) return { ok: false, player: { ...player } };
  const inv = { ...(player.inventory ?? {}) };
  if ((inv["midas"] ?? 0) <= 0) return { ok: false, player: { ...player } };
  inv["midas"] = (inv["midas"] ?? 0) - 1;
  player.inventory = inv;
  w.midasAt = Math.max(0, Math.min(MAP_LEVELS_PER_WORLD - 1, Math.trunc(level)));
  wp[world] = w;
  player.worldProgress = wp;
  player.updatedAt = Date.now();
  persist();
  return { ok: true, player: { ...player } };
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

/** Pantalla en la posición `index` del banco de un tier (para next/prev de la consola). */
export function getScreenAt(tier: number, index: number): Screen | null {
  const pool = ensureTierLoaded(tier);
  if (pool.length === 0) return null;
  const i = ((index % pool.length) + pool.length) % pool.length;
  return pool[i] ?? null;
}

/** Índice de una pantalla dentro del banco de su tier (-1 si no está). */
export function indexOfScreen(screen: Screen): number {
  const pool = ensureTierLoaded(screen.level);
  return pool.findIndex((s) => s.id === screen.id);
}

/** Número de pantallas del banco de un tier (0 si no existe el archivo). */
export function tierSize(tier: number): number {
  try {
    return ensureTierLoaded(tier).length;
  } catch {
    return 0;
  }
}
