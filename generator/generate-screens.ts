/**
 * Generador de pantallas (screens) para el banco local — Runika 2D.
 *
 * Rediseño de niveles (ver docs/16-DISENADOR-NIVELES-TIERS.md):
 *
 *  - 13 tiers de dificultad (6..18) con rangos parametrizados. La partida
 *    empieza en el tier 6 y llega al 18 (FIRST_TIER/TOTAL_TIERS/FINAL_TIER
 *    en db/db.ts); el tier 18 es además el del boss final de MAZMORRA.
 *  - REGLA A FUEGO: |col(jugador) − col(salida)| ≥ 6
 *    (MIN_PLAYER_EXIT_COLDIST). La salida siempre queda en el lado
 *    opuesto del tablero de 8 columnas.
 *  - "Jugada óptima" mostrada = PAR: el mínimo real (BFS) + 1 o +2, de modo
 *    que el jugador SIEMPRE pueda batir el número mostrado. Se exige
 *    solución en TODA longitud entre el mínimo real y el par.
 *  - Máximo 3 enemigos por pantalla (2 hasta el tier 16, 3 desde el 17).
 *    Con ≥2 enemigos, distancia Manhattan entre
 *    ellos ≥ 4 y con sentido táctico (cubren tramos distintos del camino).
 *  - Todo elemento es NECESARIO: quitarlo cambia la resolubilidad o el
 *    mínimo real. Si tras el pruning faltan obstáculos para el mínimo del
 *    tier, se buscan colocaciones alternativas que sí condicionen la
 *    solución; si no se encuentran, se descarta la pantalla.
 *  - Desde el tier 7: par mínimo 12 y uso del tablero ≥ MIN_BOARD_USE
 *    (casillas del recorrido óptimo ∪ elementos / 48).
 *  - Ningún nivel se resuelve por el camino geométrico directo: el mínimo
 *    real debe superar la distancia BFS del tablero vacío.
 *  - Dedupe por clave canónica incluyendo las 4 simetrías válidas del
 *    tablero 8×6 (espejo H, espejo V, rotación 180°).
 *  - Motor determinista: una pasada del solver BFS demuestra resolubilidad
 *    (explora todo el espacio de estados) — más fuerte que 100 simulaciones.
 *
 * Tablero fijo 8×6 (8 columnas × 6 filas).
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const W = 8;
const H = 6;
const CELLS = W * H;

/** Pantallas por tier: 25.000 (reducido de 100k — la partida consume
 *  como mucho 96 pantallas; sobra variedad). */
export const SCREENS_PER_TIER = 25_000;

/**
 * Uso mínimo del tablero desde el tier 7: fracción de las 48 casillas
 * cubiertas por (casillas del camino óptimo ∪ enemigos ∪ obstáculos ∪
 * trampas ∪ jugador ∪ salida). Medido real: ver docs/16.
 */
export const MIN_BOARD_USE = 0.35;
/** Tier desde el que se exige el uso mínimo del tablero. */
export const BOARD_USE_FROM_TIER = 7;
/** Tier desde el que el par mínimo es 12 (minSolutionLen ya lo refleja). */
export const MIN_PAR_T12_FROM_TIER = 7;
/**
 * REGLA A FUEGO (decisión del usuario): distancia horizontal mínima entre
 * el avatar y la salida = 6 columnas. La salida nunca puede quedar cerca
 * del avatar: en un tablero de 8 columnas quedan solo parejas 0↔6/7 y 1↔7.
 * Se aplica al generar (distPool) y se exige al validar.
 */
export const MIN_PLAYER_EXIT_COLDIST = 6;

// REGLA A FUEGO #2 (usuario): el juego no puede ser "ir adelante y atrás
// todo el rato" para esquivar a los cazadores. Una ruta de estrategia
// (rodear, temporizar con una trampa, cruzar cuando el enemigo se
// compromete) apenas pisa dos veces la misma casilla; el bailoteo para
// cebar al cazador sí. Toda pantalla válida debe admitir UNA solución
// de longitud ≤ par que re-entre como mucho en este número de casillas
// ya visitadas.
export const MAX_PATH_REVISITS = 3;
// Presupuesto de nodos del DFS que busca la ruta limpia. Las pantallas
// que lo agotan suelen ser las más bailonas: se rechazan.
export const CLEAN_SOLVE_BUDGET = 150_000;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type Pattern = "CHASE";

export interface Screen {
  id: string;
  level: number;
  world: string;
  grid: string[];
  player: [number, number];
  goal: [number, number];
  enemies: { pos: [number, number]; pattern: Pattern }[];
  obstacles: [number, number][];
  traps: [number, number][];
  /** Par mostrado como "jugada óptima" = mínimo real + 1 o +2 (bateable). */
  minMoves: number;
  /** Soluciones distintas en [par, par-1, par-2] (cap 50 por entrada). */
  sols?: [number, number, number];
}

export interface Tier {
  level: number;
  numEnemies: number;
  numObstacles: [number, number]; // (min, max)
  numTraps: [number, number];
  minSolutionLen: [number, number]; // rango del PAR mostrado
  minEnemyPlayerDist: number;
  minEnemyEnemyDist: number; // ≥4 cuando numEnemies ≥ 2
}

// ---------------------------------------------------------------------------
// 13 tiers de dificultad (6..18) — rediseño con separación avatar↔salida ≥6.
//
// Par = "jugada óptima" mostrada. El mínimo real es par−1 o par−2.
// La curva jugable empieza en el tier 6 (regla a fuego del usuario) y
// llega al 18 — los tiers 1-5 se han eliminado: con la regla de las 6
// columnas un solo cazador 2× queda insoluble o decorativo (espacio
// prácticamente vacío, medido: 0 válidos).
// Enemigos: 2 hasta el tier 16, 3 desde el 17 (máximo 3 — cada uno debe
// condicionar la solución o la validación lo rechaza).
// Obstáculos: mínimo 2 en todos los tiers, todos necesarios.
// REGLA A FUEGO: |col(jugador) − col(salida)| ≥ 6 — la salida nunca está
// cerca del avatar. Consecuencia: el mínimo real es ≥7 y el par ≥8.
// ---------------------------------------------------------------------------

export const TIERS: Tier[] = [
  { level: 6,  numEnemies: 2, numObstacles: [2, 4], numTraps: [1, 2], minSolutionLen: [10, 14], minEnemyPlayerDist: 4, minEnemyEnemyDist: 4 },
  // Desde el tier 7 el par mínimo es 12: en tablero abierto el mínimo real
  // casi nunca llega — hacen falta tableros densos (más obstáculos y
  // trampas, todos necesarios) para forzar los rodeos largos.
  { level: 7,  numEnemies: 2, numObstacles: [4, 8],  numTraps: [2, 4], minSolutionLen: [12, 18], minEnemyPlayerDist: 3, minEnemyEnemyDist: 4 },
  { level: 8,  numEnemies: 2, numObstacles: [4, 9],  numTraps: [2, 4], minSolutionLen: [13, 19], minEnemyPlayerDist: 3, minEnemyEnemyDist: 4 },
  { level: 9,  numEnemies: 2, numObstacles: [5, 9],  numTraps: [2, 5], minSolutionLen: [14, 20], minEnemyPlayerDist: 3, minEnemyEnemyDist: 4 },
  { level: 10, numEnemies: 2, numObstacles: [5, 10], numTraps: [2, 5], minSolutionLen: [15, 21], minEnemyPlayerDist: 3, minEnemyEnemyDist: 4 },
  { level: 11, numEnemies: 2, numObstacles: [5, 10], numTraps: [3, 6], minSolutionLen: [16, 22], minEnemyPlayerDist: 3, minEnemyEnemyDist: 4 },
  { level: 12, numEnemies: 2, numObstacles: [5, 11], numTraps: [3, 6], minSolutionLen: [17, 23], minEnemyPlayerDist: 3, minEnemyEnemyDist: 4 },
  { level: 13, numEnemies: 2, numObstacles: [5, 11], numTraps: [3, 7], minSolutionLen: [18, 25], minEnemyPlayerDist: 3, minEnemyEnemyDist: 4 },
  { level: 14, numEnemies: 2, numObstacles: [5, 12], numTraps: [3, 7], minSolutionLen: [19, 26], minEnemyPlayerDist: 3, minEnemyEnemyDist: 4 },
  { level: 15, numEnemies: 2, numObstacles: [5, 12], numTraps: [4, 7], minSolutionLen: [20, 27], minEnemyPlayerDist: 3, minEnemyEnemyDist: 4 },
  { level: 16, numEnemies: 2, numObstacles: [6, 13], numTraps: [4, 8], minSolutionLen: [21, 28], minEnemyPlayerDist: 3, minEnemyEnemyDist: 4 },
  // Desde el tier 17 entra un tercer cazador (separación ≥4 entre todos)
  { level: 17, numEnemies: 3, numObstacles: [6, 13], numTraps: [4, 8], minSolutionLen: [22, 30], minEnemyPlayerDist: 3, minEnemyEnemyDist: 4 },
  // Boss final: 3 enemigos + laberinto denso de obstáculos/trampas.
  { level: 18, numEnemies: 3, numObstacles: [5, 9], numTraps: [5, 8], minSolutionLen: [22, 30], minEnemyPlayerDist: 3, minEnemyEnemyDist: 4 },
];

// ---------------------------------------------------------------------------
// Nivel interno (mutable, usado durante generación/pruning)
// ---------------------------------------------------------------------------

export interface LevelData {
  obstacles: Set<number>; // celdas con obstáculo (blocked)
  traps: Set<number>; // celdas con trampa
  exit: number; // celda de salida
  player: number; // celda inicial del jugador
  enemies: number[]; // celdas iniciales de enemigos
}

function cloneLevel(lv: LevelData): LevelData {
  return {
    obstacles: new Set(lv.obstacles),
    traps: new Set(lv.traps),
    exit: lv.exit,
    player: lv.player,
    enemies: lv.enemies.slice(),
  };
}

// ---------------------------------------------------------------------------
// RNG determinista (mulberry32)
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const idx = (c: number, r: number) => r * W + c;
export const col = (k: number) => k % W;
export const row = (k: number) => Math.floor(k / W);

export function manhattan(a: number, b: number): number {
  return Math.abs(col(a) - col(b)) + Math.abs(row(a) - row(b));
}

export function allCells(): number[] {
  const cells: number[] = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) cells.push(idx(c, r));
  return cells;
}

/** BFS shortest path en tablero vacío (sin obstáculos/enemigos). */
export function directPathCells(player: number, exit: number, blocked?: Set<number>): number[] {
  const prev = new Map<number, number | null>();
  const queue: number[] = [player];
  prev.set(player, null);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === exit) break;
    const cx = col(cur);
    const cy = row(cur);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const nk = idx(nx, ny);
      if (blocked && blocked.has(nk)) continue;
      if (prev.has(nk)) continue;
      prev.set(nk, cur);
      queue.push(nk);
    }
  }
  if (!prev.has(exit)) return [player, exit];
  const path: number[] = [];
  let cur: number | null = exit;
  while (cur !== null) {
    path.push(cur);
    cur = prev.get(cur) ?? null;
  }
  return path;
}

/** Distancia BFS jugador→salida en el tablero vacío (-1 si no hay camino). */
export function emptyBoardDistance(player: number, exit: number): number {
  return directPathCells(player, exit).length - 1;
}

// ---------------------------------------------------------------------------
// Generación de candidato aleatorio
// ---------------------------------------------------------------------------

export function randomCandidate(tier: Tier, rnd: () => number): LevelData | null {
  const cells = allCells();
  shuffle(cells, rnd);
  const used = new Set<number>();

  // Salida
  const exitC = cells.pop()!;
  used.add(exitC);

  // Jugador: la distancia máxima alcanzable depende de DÓNDE cayó la
  // salida (una salida central no permite dp > ~7), así que la banda se
  // calcula por-exit: se toma el tramo ALTO de lo alcanzable, siempre
  // por debajo de parMax−1 (dp > parMax−1 haría imposible el par).
  const hiD = Math.min(W - 1 + H - 1, tier.minSolutionLen[1] - 1);
  let maxD = 0;
  for (const c of cells) if (!used.has(c)) maxD = Math.max(maxD, manhattan(c, exitC));
  const loD = Math.max(2, Math.min(hiD, maxD - 2, Math.max(2, tier.minSolutionLen[0] - 6)));
  const distPool = cells.filter((c) => {
    const d = manhattan(c, exitC);
    return d >= loD && d <= hiD && !used.has(c) &&
      Math.abs(col(c) - col(exitC)) >= MIN_PLAYER_EXIT_COLDIST;
  });
  if (distPool.length === 0) return null;
  const playerC = distPool[Math.floor(rnd() * distPool.length)]!;
  used.add(playerC);

  const pathCells = directPathCells(playerC, exitC);
  const pathSet = new Set(pathCells);
  const freeCells = () => allCells().filter((c) => !used.has(c));
  const adjPath = (c: number): boolean => {
    const cc = col(c), rr = row(c);
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nc = cc + dx!, nr = rr + dy!;
      return nc >= 0 && nc < W && nr >= 0 && nr < H && pathSet.has(nr * W + nc);
    });
  };

  const nObs = tier.numObstacles[0] + Math.floor(rnd() * (tier.numObstacles[1] - tier.numObstacles[0] + 1));
  const nTrp = tier.numTraps[0] + Math.floor(rnd() * (tier.numTraps[1] - tier.numTraps[0] + 1));

  // --- Obstáculos ---
  const obstacles = new Set<number>();
  let gapCell = -1;
  let wallSide: ((c: number) => boolean) | null = null;
  // Variante estructural (tiers con sitio para muro): barrera completa
  // entre jugador y salida con UN hueco — fuerza un rodeo garantizado.
  // El pruning recorta después los tramos decorativos (los alejados del
  // hueco no cambian el óptimo y desaparecen), dejando el núcleo
  // necesario. Los enemigos se colocan en el LADO DEL JUGADOR: deben
  // pasar el hueco como él → la persecución llega con retraso, y una
  // trampa en su ruta les roba 3 turnos (el ecualizador del 2×).
  if (nObs >= 4 && rnd() < 0.5) {
    const pc = col(playerC), pr = row(playerC), ec = col(exitC), er = row(exitC);
    const line: number[] = [];
    if (Math.abs(pc - ec) >= Math.abs(pr - er)) {
      const wc = Math.floor((pc + ec) / 2);
      if (wc !== pc && wc !== ec) {
        for (let r = 0; r < H; r++) line.push(idx(wc, r));
        wallSide = pc < wc ? (c: number) => col(c) < wc : (c: number) => col(c) > wc;
      }
    } else {
      const wr = Math.floor((pr + er) / 2);
      if (wr !== pr && wr !== er) {
        for (let c = 0; c < W; c++) line.push(idx(c, wr));
        wallSide = pr < wr ? (c: number) => row(c) < wr : (c: number) => row(c) > wr;
      }
    }
    if (line.length > 0) {
      gapCell = line[Math.floor(rnd() * line.length)]!;
      for (const c of line) {
        if (c === gapCell || used.has(c)) continue;
        if (obstacles.size >= nObs) break;
        obstacles.add(c);
        used.add(c);
      }
    }
  }
  // Dispersión con sesgo al camino directo/adyacentes hasta completar nObs
  if (obstacles.size < nObs) {
    const pool = [
      ...shuffle(pathCells.filter((c) => c !== playerC && c !== exitC && !used.has(c)), rnd),
      ...shuffle(freeCells().filter((c) => adjPath(c)), rnd),
      ...shuffle(freeCells(), rnd),
    ];
    for (const c of pool) {
      if (obstacles.size >= nObs) break;
      if (obstacles.has(c) || used.has(c)) continue;
      obstacles.add(c);
      used.add(c);
    }
  }

  // --- Enemigos + trampas con reintento (hasta 24): el único patrón
  //     resoluble con un cazador 2× es ralentizarlo — las trampas se
  //     siembran en SU ruta de persecución (e→jugador y e→hueco), no en
  //     la del jugador. Se acepta la primera combinación resoluble y no
  //     directa. ---
  const nearestPathIdx = (c: number): number => {
    let best = 0, bd = Infinity;
    pathCells.forEach((p, i) => {
      const d = manhattan(c, p);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  };
  const nearPath = (c: number, radius: number): boolean =>
    pathCells.some((p) => manhattan(c, p) <= radius);
  const pathEnd = pathCells.slice(Math.floor(pathCells.length * 0.6));
  const threat = (c: number) =>
    manhattan(c, exitC) <= 5 || pathEnd.some((p) => manhattan(c, p) <= 3) ||
    (gapCell >= 0 && manhattan(c, gapCell) <= 4);

  const freePre = freeCells().filter((c) => !obstacles.has(c));
  const emptyDist = emptyBoardDistance(playerC, exitC);

  const pickEnemySet = (): number[] | null => {
    const es: number[] = [];
    const eIdx: number[] = [];
    const occ = new Set<number>(used);
    for (let i = 0; i < tier.numEnemies; i++) {
      const valid = (c: number) =>
        !occ.has(c) && !obstacles.has(c) &&
        manhattan(c, playerC) >= tier.minEnemyPlayerDist &&
        es.every((e) => manhattan(c, e) >= tier.minEnemyEnemyDist);
      let cands = freePre.filter(
        (c) => valid(c) && threat(c) && (wallSide === null || wallSide(c)) &&
          eIdx.every((pi) => Math.abs(nearestPathIdx(c) - pi) >= 2),
      );
      if (cands.length === 0) cands = freePre.filter((c) => valid(c) && threat(c));
      if (cands.length === 0) cands = freePre.filter((c) => valid(c) && nearPath(c, 4));
      if (cands.length === 0) cands = freePre.filter(valid);
      if (cands.length === 0) return null;
      const e = cands[Math.floor(rnd() * cands.length)]!;
      es.push(e);
      eIdx.push(nearestPathIdx(e));
      occ.add(e);
    }
    return es;
  };

  const pickTraps = (es: number[]): Set<number> => {
    const tr = new Set<number>();
    // Celdas de la ruta de persecución del enemigo (BFS a través de los
    // obstáculos): hacia el jugador y hacia el hueco del muro. Nunca en
    // la casilla del jugador ni en la salida.
    const pool: number[] = [];
    for (const e of es) {
      for (const tgt of [playerC, gapCell]) {
        if (tgt < 0) continue;
        const route = directPathCells(e, tgt, obstacles);
        for (const c of route.slice(1)) {
          if (c === tgt && tgt === playerC) continue;
          if (manhattan(c, playerC) < 2) continue;
          if (!used.has(c) && !obstacles.has(c) && !es.includes(c)) pool.push(c);
        }
      }
    }
    // Relleno: camino del jugador / adyacentes / libres
    pool.push(...pathCells.filter((c) => c !== playerC && c !== exitC && !used.has(c) && !obstacles.has(c)));
    pool.push(...freeCells().filter((c) => !obstacles.has(c) && !es.includes(c) && adjPath(c)));
    pool.push(...freeCells().filter((c) => !obstacles.has(c) && !es.includes(c)));
    shuffle(pool, rnd);
    const seen = new Set<number>();
    for (const c of pool) {
      if (tr.size >= nTrp) break;
      if (seen.has(c) || used.has(c) || obstacles.has(c) || es.includes(c)) continue;
      tr.add(c);
      seen.add(c);
    }
    return tr;
  };

  let enemies: number[] | null = null;
  let traps = new Set<number>();
  for (let attempt = 0; attempt < 12 && enemies === null; attempt++) {
    const es = pickEnemySet();
    if (es === null) continue;
    // Por cada colocación de enemigos se prueban 3 disposiciones de
    // trampas — es la disposición la que decide si el cazador 2× queda
    // ralentizado lo bastante.
    for (let j = 0; j < 3 && enemies === null; j++) {
      const tr = pickTraps(es);
      if (tr.size < nTrp) break;
      const test: LevelData = {
        obstacles: new Set(obstacles), traps: new Set(tr),
        exit: exitC, player: playerC, enemies: es,
      };
      const r = solve(test);
      if (r.solvable && r.length! > emptyDist) { enemies = es; traps = tr; }
    }
  }
  if (enemies === null) return null;
  for (const t of traps) used.add(t);

  return { obstacles, traps, exit: exitC, player: playerC, enemies };
}

// ---------------------------------------------------------------------------
// Solver BFS determinista (réplica exacta de engine/rules.ts)
// ---------------------------------------------------------------------------

/**
 * Estado codificado como enteros para BFS rápido:
 *  - player: 0..47
 *  - playerStun: 0..3
 *  - cada enemigo: 0..47 (posición) + stun 0..3
 */

export interface GameStartState {
  p: number; // posición del jugador
  e: number[]; // posiciones de enemigos
  s: number[]; // stun de cada enemigo
  ps: number; // stun del jugador
}

interface SolveResult {
  solvable: boolean;
  length: number | null;
  /** Celdas visitadas por UNA solución óptima (incl. inicio y salida). */
  path?: number[];
}

function initialState(lv: LevelData): GameStartState {
  return { p: lv.player, e: lv.enemies.slice(), s: lv.enemies.map(() => 0), ps: 0 };
}

/** Comparte el simulador de turno entre solve, solvePath y countSolutions. */
export function makeSimulator(lv: LevelData) {
  const n = lv.enemies.length;
  const blocked = new Uint8Array(CELLS);
  const trap = new Uint8Array(CELLS);
  for (const k of lv.obstacles) blocked[k] = 1;
  for (const k of lv.traps) trap[k] = 1;
  const goalIdx = lv.exit;

  /** Mueve un enemigo 1 sub-paso hacia el jugador (CHASE: horizontal primero). */
  function enemySubstep(ep: number, pp: number): number {
    const ec = ep % W;
    const er = Math.floor(ep / W);
    const pc = pp % W;
    const pr = Math.floor(pp / W);
    const dx = Math.sign(pc - ec);
    const dy = Math.sign(pr - er);
    const cand: number[] = [];
    if (dx !== 0) cand.push(ep + dx);
    if (dy !== 0) cand.push(ep + dy * W);
    for (const nc of cand) {
      if (nc < 0 || nc >= CELLS) continue;
      if (Math.floor(nc / W) !== er && Math.abs(nc - ep) === 1) continue;
      if (blocked[nc]) continue;
      return nc;
    }
    return ep;
  }

  /** Turno de enemigos: nuevas posiciones, stuns y captura. */
  function moveEnemies(
    e: number[],
    s: number[],
    np: number,
  ): { e: number[]; s: number[]; captured: boolean } {
    const ne = e.slice();
    const ns = s.slice();
    let captured = false;
    for (let i = 0; i < n; i++) {
      if (ns[i]! > 0) {
        ns[i] = ns[i]! - 1;
        continue;
      }
      for (let step = 0; step < 2; step++) {
        const before = ne[i]!;
        const newPos = enemySubstep(ne[i]!, np);
        ne[i] = newPos;
        if (newPos === np) {
          captured = true;
          break;
        }
        if (trap[newPos] && newPos !== before) {
          ns[i] = 3;
          break;
        }
      }
      if (captured) break;
    }
    return { e: ne, s: ns, captured };
  }

  return { n, blocked, trap, goalIdx, moveEnemies };
}

/**
 * BFS desde un estado arbitrario. Devuelve la longitud de la solución
 * óptima (nº de turnos/movimientos) y, si wantPath, las celdas visitadas
 * por una solución óptima.
 */
function solveFrom(
  lv: LevelData,
  start: GameStartState,
  wantPath = false,
): SolveResult {
  const { n, blocked, trap, goalIdx, moveEnemies } = makeSimulator(lv);
  const base = CELLS;

  function keyOf(p: number, e: number[], s: number[], ps: number): number {
    let k = p;
    let mult = base;
    for (let i = 0; i < n; i++) {
      k += e[i]! * mult;
      mult *= base;
    }
    let sMult = mult;
    for (let i = 0; i < n; i++) {
      k += s[i]! * sMult;
      sMult *= 4;
    }
    k += ps * sMult;
    return k;
  }

  const startKey = keyOf(start.p, start.e, start.s, start.ps);
  const visited = new Set<number>([startKey]);
  // parent[childKey] = [parentKey, playerCell] para reconstruir el camino
  const parent = wantPath ? new Map<number, [number, number]>() : null;
  const queue: { p: number; e: number[]; s: number[]; ps: number; depth: number }[] = [
    { p: start.p, e: start.e.slice(), s: start.s.slice(), ps: start.ps, depth: 0 },
  ];

  const DIRS = [1, -1, W, -W];

  const buildPath = (endKey: number, endP: number): number[] => {
    const cells = [endP];
    let cur = endKey;
    while (parent!.has(cur)) {
      const [pk, pp] = parent!.get(cur)!;
      cells.push(pp);
      cur = pk;
    }
    cells.reverse();
    return cells;
  };

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.depth > 60) continue;
    const curKey = wantPath ? keyOf(cur.p, cur.e, cur.s, cur.ps) : 0;

    if (cur.ps > 0) {
      const res = moveEnemies(cur.e, cur.s, cur.p);
      if (res.captured) continue;
      const key = keyOf(cur.p, res.e, res.s, cur.ps - 1);
      if (visited.has(key)) continue;
      visited.add(key);
      if (parent) parent.set(key, [curKey, cur.p]);
      queue.push({ p: cur.p, e: res.e, s: res.s, ps: cur.ps - 1, depth: cur.depth + 1 });
      continue;
    }

    for (const d of DIRS) {
      const np = cur.p + d;
      if (np < 0 || np >= CELLS) continue;
      const pc = cur.p % W;
      if (d === 1 && pc === W - 1) continue;
      if (d === -1 && pc === 0) continue;

      if (blocked[np]) continue;
      if (cur.e.includes(np)) continue;

      if (np === goalIdx) {
        const path = wantPath ? [...buildPath(curKey, cur.p), np] : undefined;
        return { solvable: true, length: cur.depth + 1, path };
      }

      const newPs = trap[np] ? 3 : 0;
      const res = moveEnemies(cur.e, cur.s, np);
      if (res.captured) continue;

      const key = keyOf(np, res.e, res.s, newPs);
      if (visited.has(key)) continue;
      visited.add(key);
      if (parent) parent.set(key, [curKey, cur.p]);
      queue.push({ p: np, e: res.e, s: res.s, ps: newPs, depth: cur.depth + 1 });
    }
  }
  return { solvable: false, length: null };
}

export function solve(lv: LevelData): SolveResult {
  return solveFrom(lv, initialState(lv), false);
}

/** Solución óptima con camino de celdas (para métricas y endpoint). */
export function solvePath(lv: LevelData): SolveResult {
  return solveFrom(lv, initialState(lv), true);
}

/**
 * Siguiente movimiento óptimo DESDE un estado arbitrario (para el comando
 * `hint` de la consola de hacks). Devuelve {dc, dr} y turnos restantes.
 */
export function nextMoveFrom(
  lv: LevelData,
  state: GameStartState,
): { dc: number; dr: number; remaining: number } | null {
  const res = solveFrom(lv, state, true);
  if (!res.solvable || !res.path || res.path.length < 2) return null;
  const from = res.path[0]!;
  const to = res.path[1]!;
  return { dc: col(to) - col(from), dr: row(to) - row(from), remaining: res.length! };
}

// ---------------------------------------------------------------------------
// Conteo de soluciones de longitud exacta (freedom counting con memoización)
// ---------------------------------------------------------------------------

export function countSolutionsOfMinLength(lv: LevelData, len: number, cap = 50): number {
  if (len <= 0) return 0;
  const { n, blocked, trap, goalIdx, moveEnemies } = makeSimulator(lv);
  const enemyStart = lv.enemies.slice();
  const playerStart = lv.player;

  function keyOf(p: number, e: number[], s: number[], ps: number): string {
    let k = `${p},${ps}`;
    for (let i = 0; i < n; i++) k += `,${e[i]},${s[i]}`;
    return k;
  }

  const DIRS = [1, -1, W, -W];
  const memo = new Map<string, number>();

  function rec(p: number, e: number[], s: number[], ps: number, remaining: number): number {
    if (remaining === 0) return 0;
    const key = `${keyOf(p, e, s, ps)},${remaining}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    let total = 0;

    if (ps > 0) {
      const res = moveEnemies(e, s, p);
      if (!res.captured) {
        total += rec(p, res.e, res.s, ps - 1, remaining - 1);
      }
      total = Math.min(total, cap);
      memo.set(key, total);
      return total;
    }

    for (const d of DIRS) {
      const np = p + d;
      if (np < 0 || np >= CELLS) continue;
      const pc = p % W;
      if (d === 1 && pc === W - 1) continue;
      if (d === -1 && pc === 0) continue;
      if (blocked[np]) continue;
      if (e.includes(np)) continue;

      if (np === goalIdx) {
        if (remaining === 1) total += 1;
        continue;
      }

      const newPs = trap[np] ? 3 : 0;
      const res = moveEnemies(e, s, np);
      if (res.captured) continue;

      total += rec(np, res.e, res.s, newPs, remaining - 1);
      if (total >= cap) break;
    }

    total = Math.min(total, cap);
    memo.set(key, total);
    return total;
  }

  return rec(playerStart, enemyStart, enemyStart.map(() => 0), 0, len);
}

// ---------------------------------------------------------------------------
// Ruta limpia (regla anti-bailoteo): existe solución ≤ maxLen con ≤ capRv
// casillas revisitadas.
// ---------------------------------------------------------------------------

/**
 * DFS acotado que busca UNA solución de ≤ maxLen turnos re-entrando como
 * mucho en capRv casillas ya pisadas. Explora primero las casillas
 * vírgenes, así las rutas limpias se encuentran pronto y los poda
 * rv > capRv. Devuelve el camino de celdas si la encuentra, null si no
 * (o si agota el presupuesto de nodos).
 *
 * "Revisita" = entrar en una casilla por la que ya se pasó antes en la
 * misma ruta (el "adelante y atrás" para cebar/esquivar al cazador).
 * Un rodeo estratégico alrededor de obstáculos no revisita nada, y un
 * par de esquivas puntuales queda dentro del cap.
 */
export function findCleanSolution(
  lv: LevelData,
  maxLen: number,
  capRv: number = MAX_PATH_REVISITS,
  budget: number = CLEAN_SOLVE_BUDGET,
): number[] | null {
  const { blocked, trap, goalIdx, moveEnemies } = makeSimulator(lv);
  let nodes = 0;
  let found: number[] | null = null;
  // firstDepth[c] = profundidad en la que se pisó c por primera vez en la
  // rama actual (−1 = virgen). Se desmarca al retroceder el DFS.
  const firstDepth = new Int16Array(CELLS).fill(-1);
  const DIRS = [1, -1, W, -W];

  function dfs(p: number, e: number[], s: number[], ps: number, depth: number, rv: number, path: number[]) {
    if (found || rv > capRv || depth >= maxLen || ++nodes > budget) return;
    if (ps > 0) {
      const res = moveEnemies(e, s, p);
      if (!res.captured) dfs(p, res.e, res.s, ps - 1, depth + 1, rv, path);
      return;
    }
    const moves: number[] = [];
    for (const d of DIRS) {
      const np = p + d;
      if (np < 0 || np >= CELLS) continue;
      const pc = p % W;
      if (d === 1 && pc === W - 1) continue;
      if (d === -1 && pc === 0) continue;
      if (blocked[np] || e.includes(np)) continue;
      moves.push(np);
    }
    // primero vírgenes y más cercanas a la salida
    moves.sort(
      (a, b) =>
        ((firstDepth[a!] ?? -1) >= 0 ? 1 : 0) - ((firstDepth[b!] ?? -1) >= 0 ? 1 : 0) ||
        manhattan(a!, goalIdx) - manhattan(b!, goalIdx),
    );
    for (const np of moves) {
      if (np === goalIdx) { found = [...path, np]; return; }
      const newPs = trap[np] ? 3 : 0;
      const res = moveEnemies(e, s, np);
      if (res.captured) continue;
      const virgin = firstDepth[np]! < 0;
      if (virgin) firstDepth[np] = depth + 1;
      path.push(np);
      dfs(np, res.e, res.s, newPs, depth + 1, rv + (virgin ? 0 : 1), path);
      path.pop();
      if (firstDepth[np]! === depth + 1) firstDepth[np] = -1;
      if (found || nodes > budget) return;
    }
  }

  firstDepth[lv.player] = 0;
  dfs(lv.player, lv.enemies.slice(), lv.enemies.map(() => 0), 0, 0, 0, [lv.player]);
  return found;
}

// ---------------------------------------------------------------------------
// Pruning de elementos (regla: cada elemento debe CONDICIONAR la solución)
// ---------------------------------------------------------------------------

/**
 * Un elemento es NECESARIO si quitarlo hace el puzzle irresoluble o cambia
 * el mínimo real (en cualquier dirección: un obstáculo que alarga el
 * camino condiciona la solución igual que una trampa que abre una ventana).
 */
function isRequired(lv: LevelData, modifyFn: (lv: LevelData) => LevelData, baseLen: number): boolean {
  const res = solve(modifyFn(lv));
  if (!res.solvable) return true;
  return res.length !== baseLen;
}

function removeObstacle(lv: LevelData, obs: number): LevelData {
  const clone = cloneLevel(lv);
  clone.obstacles.delete(obs);
  return clone;
}

function removeTrap(lv: LevelData, trap: number): LevelData {
  const clone = cloneLevel(lv);
  clone.traps.delete(trap);
  return clone;
}

function removeEnemy(lv: LevelData, enemy: number): LevelData {
  const clone = cloneLevel(lv);
  clone.enemies = clone.enemies.filter((e) => e !== enemy);
  return clone;
}

export function pruneRedundant(lv: LevelData): LevelData | null {
  const res = solve(lv);
  if (!res.solvable) return null;
  let length = res.length!;

  let current = lv;
  let changed = true;
  while (changed) {
    changed = false;

    for (const obs of current.obstacles) {
      if (!isRequired(current, (lv2) => removeObstacle(lv2, obs), length)) {
        current = removeObstacle(current, obs);
        changed = true;
        break;
      }
    }
    if (changed) continue;

    for (const trp of current.traps) {
      if (!isRequired(current, (lv2) => removeTrap(lv2, trp), length)) {
        current = removeTrap(current, trp);
        changed = true;
        break;
      }
    }
    if (changed) continue;

    for (const en of current.enemies) {
      if (!isRequired(current, (lv2) => removeEnemy(lv2, en), length)) {
        current = removeEnemy(current, en);
        changed = true;
        break;
      }
    }

    if (changed) {
      const r = solve(current);
      if (!r.solvable) return null; // no debería pasar: cada paso valida
      length = r.length!;
    }
  }
  return current;
}

/**
 * Tras el pruning, completa los mínimos del tier (enemigos, obstáculos,
 * trampas) con colocaciones que SÍ condicionen la solución: un elemento
 * añadido es necesario si su presencia cambia el mínimo real (quitarlo
 * devolvería el óptimo anterior).
 *
 * Para obstáculos/trampas también se prueban PAREJAS: en tablero abierto
 * una celda suelta casi nunca alarga el óptimo (hay muchos caminos
 * Manhattan equivalentes), pero dos celdas juntas sí pueden forzar el
 * rodeo — y cada una es necesaria porque quitarla devuelve el óptimo
 * corto.
 */
function occupiedCells(lv: LevelData): Set<number> {
  return new Set<number>([
    lv.player, lv.exit, ...lv.enemies,
    ...lv.traps, ...lv.obstacles,
  ]);
}

function elementCount(lv: LevelData, kind: "enemy" | "obstacle" | "trap"): number {
  return kind === "enemy" ? lv.enemies.length : kind === "obstacle" ? lv.obstacles.size : lv.traps.size;
}

function addElement(lv: LevelData, kind: "enemy" | "obstacle" | "trap", cell: number): LevelData {
  const c = cloneLevel(lv);
  if (kind === "enemy") c.enemies.push(cell);
  else if (kind === "obstacle") c.obstacles.add(cell);
  else c.traps.add(cell);
  return c;
}

function dropElement(lv: LevelData, kind: "enemy" | "obstacle" | "trap", cell: number): LevelData {
  const c = cloneLevel(lv);
  if (kind === "enemy") c.enemies = c.enemies.filter((e) => e !== cell);
  else if (kind === "obstacle") c.obstacles.delete(cell);
  else c.traps.delete(cell);
  return c;
}

function fillTo(
  lv: LevelData,
  kind: "enemy" | "obstacle" | "trap",
  min: number,
  max: number,
  tier: Tier,
  rnd: () => number,
): LevelData | null {
  let current = lv;
  let guard = 0;
  while (elementCount(current, kind) < min && guard++ < 60) {
    const res = solvePath(current);
    if (!res.solvable || !res.path) return null;
    const baseLen = res.length!;
    const occupied = occupiedCells(current);
    const pathSet = new Set(res.path);
    const onPath = res.path.slice(1, -1).filter((c) => !occupied.has(c));
    const adjPath = allCells().filter((c) =>
      !occupied.has(c) && !pathSet.has(c) &&
      [[1, 0], [-1, 0], [0, W], [0, -W]].some(([d]) => pathSet.has(c + d!)),
    );
    const offPath = allCells().filter((c) => !occupied.has(c) && !pathSet.has(c) && !adjPath.includes(c));

    // Candidatos válidos según el tipo (reglas de distancia de enemigos)
    const validFor = (c: number): boolean => {
      if (kind !== "enemy") return true;
      return (
        manhattan(c, current.player) >= tier.minEnemyPlayerDist &&
        current.enemies.every((e) => manhattan(c, e) >= tier.minEnemyEnemyDist)
      );
    };
    const pool = [
      ...shuffle(onPath, rnd).filter(validFor),
      ...shuffle(adjPath, rnd).filter(validFor),
      ...shuffle(offPath, rnd).filter(validFor),
    ];

    let added = false;
    // 1) Elemento suelto que cambie el mínimo real → necesario por definición
    if (elementCount(current, kind) + 1 <= max) {
      for (const c of pool) {
        const test = addElement(current, kind, c);
        const r = solve(test);
        if (r.solvable && r.length !== baseLen) {
          current = test;
          added = true;
          break;
        }
      }
    }
    // 2) Pareja de obstáculos/trampas: juntas fuerzan el rodeo y cada una
    //    es necesaria (quitarla cambia el nuevo óptimo). Solo si caben 2.
    if (!added && kind !== "enemy" && elementCount(current, kind) + 2 <= max) {
      const top = pool.slice(0, 16);
      outer: for (let i = 0; i < top.length; i++) {
        for (let j = i + 1; j < top.length; j++) {
          const test = addElement(addElement(current, kind, top[i]!), kind, top[j]!);
          const r = solve(test);
          if (!r.solvable || r.length === baseLen) continue;
          const newLen = r.length!;
          if (
            isRequired(test, (l) => dropElement(l, kind, top[i]!), newLen) &&
            isRequired(test, (l) => dropElement(l, kind, top[j]!), newLen)
          ) {
            current = test;
            added = true;
            break outer;
          }
        }
      }
    }
    // 3) Rescate enemigo+trampa: un enemigo suelto en tablero podado casi
    //    siempre hace el puzzle irresoluble (cazador 2×). Pero enemigo +
    //    trampa en su ruta de persecución puede ser resoluble, con cada
    //    elemento necesario (sin trampa no hay escapatoria; sin enemigo
    //    el óptimo vuelve a ser el base). Consume una trampa si queda
    //    margen dentro del máximo del tier.
    if (!added && kind === "enemy" && elementCount(current, "trap") < tier.numTraps[1]) {
      const blocked = new Set([...current.obstacles, ...current.traps]);
      outer2: for (const e of pool.slice(0, 10)) {
        const route = directPathCells(e, current.player, blocked);
        const mids = route.slice(1).filter(
          (c) => c !== e && manhattan(c, current.player) >= 2 && !occupied.has(c),
        );
        for (const t of shuffle(mids, rnd).slice(0, 6)) {
          const test = addElement(addElement(current, "enemy", e), "trap", t);
          const r = solve(test);
          if (!r.solvable || r.length === baseLen) continue;
          const newLen = r.length!;
          if (
            isRequired(test, (l) => dropElement(l, "enemy", e), newLen) &&
            isRequired(test, (l) => dropElement(l, "trap", t), newLen)
          ) {
            current = test;
            added = true;
            break outer2;
          }
        }
      }
    }
    if (!added) return null;
  }
  return elementCount(current, kind) >= min ? current : null;
}

export function ensureMinObstacles(lv: LevelData, tier: Tier, rnd: () => number): LevelData | null {
  return fillTo(lv, "obstacle", tier.numObstacles[0], tier.numObstacles[1], tier, rnd);
}

/**
 * Completa los mínimos del tier tras el pruning: enemigos primero
 * (condicionan todo lo demás), luego obstáculos y trampas.
 */
export function ensureElements(lv: LevelData, tier: Tier, rnd: () => number): LevelData | null {
  // Primero la geometría (obstáculos/trampas crean cobertura y rodeos) y
  // DESPUÉS los enemigos: un enemigo en tablero abierto casi siempre hace
  // el puzzle irresoluble (es 2× más rápido); con obstáculos hay huecos
  // donde condiciona la solución siendo escapable.
  let current = fillTo(lv, "obstacle", tier.numObstacles[0], tier.numObstacles[1], tier, rnd);
  if (current === null) return null;
  current = fillTo(current, "trap", tier.numTraps[0], tier.numTraps[1], tier, rnd);
  if (current === null) return null;
  current = fillTo(current, "enemy", tier.numEnemies, tier.numEnemies, tier, rnd);
  if (current === null) return null;
  return trimTo(lengthenTo(current, tier, rnd), tier, rnd);
}

/**
 * Si el mínimo real queda por debajo del rango del par, sigue añadiendo
 * obstáculos/trampas (hasta los máximos del tier) que ALARGUEN la
 * solución. Cada elemento añadido es necesario por construcción:
 * quitarlo devuelve el óptimo más corto. Es lo que construye los pars
 * ≥12 de los tiers altos — imposibles de conseguir en tablero abierto
 * tras el pruning.
 */
function lengthenTo(lv: LevelData, tier: Tier, rnd: () => number): LevelData {
  // trueMin T admite par ∈ {T+1, T+2} → para entrar en rango basta
  // T ≥ parMin−2; y T > parMax−1 ya no puede producir par ≤ parMax.
  const lo = tier.minSolutionLen[0] - 2;
  const hi = tier.minSolutionLen[1] - 1;
  let current = lv;
  let res = solvePath(current);
  let guard = 0;
  while (res.solvable && res.length! < lo && guard++ < 24) {
    const baseLen = res.length!;
    const path = res.path ?? [];
    const pathSet = new Set(path);
    const occupied = occupiedCells(current);
    const onPath = path.slice(1, -1).filter((c) => !occupied.has(c));
    const adjPath = allCells().filter((c) =>
      !occupied.has(c) && !pathSet.has(c) &&
      [[1, 0], [-1, 0], [0, W], [0, -W]].some(([d]) => pathSet.has(c + d!)),
    );
    const offPath = allCells().filter((c) => !occupied.has(c) && !pathSet.has(c) && !adjPath.includes(c));
    const pool = [...shuffle(onPath, rnd), ...shuffle(adjPath, rnd), ...shuffle(offPath, rnd)];

    let added = false;
    for (const kind of ["obstacle", "trap"] as const) {
      const max = kind === "obstacle" ? tier.numObstacles[1] : tier.numTraps[1];
      if (elementCount(current, kind) >= max) continue;
      for (const c of pool) {
        const test = addElement(current, kind, c);
        const r = solve(test);
        // Alarga sin pasarse: T' > T y T' ≤ hi → el par queda en rango.
        if (r.solvable && r.length! > baseLen && r.length! <= hi) {
          current = test;
          added = true;
          break;
        }
      }
      if (added) break;
    }
    if (!added) break;
    res = solvePath(current);
  }
  return current;
}

/**
 * Espejo de lengthenTo: si el mínimo real se pasa del rango del par,
 * retira obstáculos/trampas (nunca por debajo de los mínimos del tier)
 * eligiendo la retirada que deja T más cerca de la ventana. Los elementos
 * retirados dejan de existir en el puzzle final; los que quedan se
 * re-verifican como necesarios en la validación.
 */
function trimTo(lv: LevelData, tier: Tier, rnd: () => number): LevelData {
  const lo = tier.minSolutionLen[0] - 2;
  const hi = tier.minSolutionLen[1] - 1;
  let current = lv;
  let res = solve(current);
  let guard = 0;
  while (res.solvable && res.length! > hi && guard++ < 24) {
    const baseLen = res.length!;
    let best: { lv: LevelData; len: number } | null = null;
    const cands: { kind: "obstacle" | "trap"; cell: number }[] = [
      ...[...current.obstacles].map((cell) => ({ kind: "obstacle" as const, cell })),
      ...[...current.traps].map((cell) => ({ kind: "trap" as const, cell })),
    ];
    shuffle(cands, rnd);
    for (const { kind, cell } of cands) {
      const min = kind === "obstacle" ? tier.numObstacles[0] : tier.numTraps[0];
      if (elementCount(current, kind) <= min) continue;
      const test = dropElement(current, kind, cell);
      const r = solve(test);
      if (!r.solvable || r.length! >= baseLen) continue;
      // Mejor retirada: la que aterriza T dentro de [lo, hi] o la más
      // cercana por encima (nunca por debajo de lo: empeoraría).
      const len = r.length!;
      const score = len >= lo ? 0 : lo - len; // 0 = en ventana
      if (best === null || score < (best.len >= lo ? 0 : lo - best.len) || (score === 0 && len < best.len)) {
        best = { lv: test, len };
      }
      if (len >= lo && len <= hi) { best = { lv: test, len }; break; }
    }
    // Parejas: cuando lo mejor individual queda fuera de la ventana, dos
    // elementos juntos pueden aterrizar dentro (p. ej. dos obstáculos
    // del mismo muro que abren un atajo).
    if (best === null || best.len < lo || best.len > hi) {
      const top = cands.slice(0, 10);
      outer: for (let i = 0; i < top.length; i++) {
        for (let j = i + 1; j < top.length; j++) {
          const a = top[i]!, b = top[j]!;
          const minA = a.kind === "obstacle" ? tier.numObstacles[0] : tier.numTraps[0];
          const minB = b.kind === "obstacle" ? tier.numObstacles[0] : tier.numTraps[0];
          if (elementCount(current, a.kind) - (a.kind === b.kind ? 2 : 1) < minA) continue;
          if (a.kind !== b.kind && elementCount(current, b.kind) - 1 < minB) continue;
          const test = dropElement(dropElement(current, a.kind, a.cell), b.kind, b.cell);
          const r = solve(test);
          if (!r.solvable || r.length! < lo || r.length! >= baseLen) continue;
          const len = r.length!;
          if (len <= hi) { best = { lv: test, len }; break outer; }
          if (best === null || len < best.len) best = { lv: test, len };
        }
      }
    }
    // Una retirada que acorta pero sigue por encima de hi también sirve:
    // la siguiente iteración vuelve a intentarlo desde un T menor.
    if (best === null || best.len >= baseLen) break;
    current = best.lv;
    res = solve(current);
  }
  return current;
}

// ---------------------------------------------------------------------------
// Uso del tablero y clave canónica (dedupe con simetrías)
// ---------------------------------------------------------------------------

/**
 * Fracción del tablero usada: casillas del camino óptimo ∪ enemigos ∪
 * obstáculos ∪ trampas ∪ jugador ∪ salida, sobre las 48 celdas.
 */
export function boardUse(lv: LevelData, optimalPath: number[]): number {
  const used = new Set<number>(optimalPath);
  used.add(lv.player);
  used.add(lv.exit);
  for (const e of lv.enemies) used.add(e);
  for (const o of lv.obstacles) used.add(o);
  for (const t of lv.traps) used.add(t);
  return used.size / CELLS;
}

/** Serializa el tablero a una clave de 48 caracteres (.,X,T,P,G,E). */
function serialize(lv: LevelData): string {
  let s = "";
  for (let k = 0; k < CELLS; k++) {
    if (lv.obstacles.has(k)) s += "X";
    else if (lv.traps.has(k)) s += "T";
    else if (k === lv.exit) s += "G";
    else if (k === lv.player) s += "P";
    else if (lv.enemies.includes(k)) s += "E";
    else s += ".";
  }
  return s;
}

/** Simetrías válidas del 8×6: identidad, espejo H, espejo V, rotación 180°. */
function transformCell(k: number, mode: 0 | 1 | 2 | 3): number {
  const c = col(k), r = row(k);
  switch (mode) {
    case 1: return idx(W - 1 - c, r);       // espejo horizontal
    case 2: return idx(c, H - 1 - r);       // espejo vertical
    case 3: return idx(W - 1 - c, H - 1 - r); // rotación 180°
    default: return k;
  }
}

/** Clave canónica: la menor serialización entre las 4 simetrías. */
export function canonicalKey(lv: LevelData): string {
  let best: string | null = null;
  for (const mode of [0, 1, 2, 3] as const) {
    const t: LevelData = {
      obstacles: new Set([...lv.obstacles].map((k) => transformCell(k, mode))),
      traps: new Set([...lv.traps].map((k) => transformCell(k, mode))),
      exit: transformCell(lv.exit, mode),
      player: transformCell(lv.player, mode),
      enemies: lv.enemies.map((k) => transformCell(k, mode)),
    };
    const s = serialize(t);
    if (best === null || s < best) best = s;
  }
  return best!;
}

// ---------------------------------------------------------------------------
// Validación final
// ---------------------------------------------------------------------------

export interface ValidationResult {
  ok: boolean;
  reason: string;
  trueMin: number | null;
  /** Par mostrado (mínimo real +1/+2) si la pantalla es válida. */
  par: number | null;
  /** Conteos en [par, par-1, par-2]. */
  sols?: [number, number, number];
  /** Camino óptimo (celdas) si la pantalla es válida. */
  path?: number[];
  use?: number;
}

export function validateCandidate(lv: LevelData, tier: Tier): ValidationResult {
  const res = solvePath(lv);
  if (!res.solvable || !res.path) {
    return { ok: false, reason: "no_solution", trueMin: null, par: null };
  }
  const T = res.length!;
  if (lv.enemies.length === 0) {
    return { ok: false, reason: "no_enemies_left", trueMin: T, par: null };
  }

  // Regla a fuego: la salida nunca a menos de 6 columnas del avatar
  if (Math.abs(col(lv.player) - col(lv.exit)) < MIN_PLAYER_EXIT_COLDIST) {
    return { ok: false, reason: `exit_too_close(${Math.abs(col(lv.player) - col(lv.exit))})`, trueMin: T, par: null };
  }

  // Nunca camino directo ni una tirada: el mínimo real supera la
  // distancia geométrica del tablero vacío.
  if (T <= emptyBoardDistance(lv.player, lv.exit)) {
    return { ok: false, reason: `direct_path(${T})`, trueMin: T, par: null };
  }

  // Conteos/rangos post-pruning (incluye separación entre enemigos)
  if (lv.enemies.length < tier.numEnemies) {
    return { ok: false, reason: `too_few_enemies(${lv.enemies.length}/${tier.numEnemies})`, trueMin: T, par: null };
  }
  for (let i = 0; i < lv.enemies.length; i++) {
    for (let j = i + 1; j < lv.enemies.length; j++) {
      if (manhattan(lv.enemies[i]!, lv.enemies[j]!) < tier.minEnemyEnemyDist) {
        return { ok: false, reason: "enemy_distance", trueMin: T, par: null };
      }
    }
  }
  if (lv.obstacles.size < tier.numObstacles[0] || lv.obstacles.size > tier.numObstacles[1]) {
    return { ok: false, reason: `obstacles_out_of_range(${lv.obstacles.size}/${tier.numObstacles[0]}-${tier.numObstacles[1]})`, trueMin: T, par: null };
  }
  if (lv.traps.size < tier.numTraps[0] || lv.traps.size > tier.numTraps[1]) {
    return { ok: false, reason: `traps_out_of_range(${lv.traps.size}/${tier.numTraps[0]}-${tier.numTraps[1]})`, trueMin: T, par: null };
  }

  // Uso del tablero desde el tier 7
  const use = boardUse(lv, res.path);
  if (tier.level >= BOARD_USE_FROM_TIER && use < MIN_BOARD_USE) {
    return { ok: false, reason: `board_use(${(use * 100).toFixed(0)}%)`, trueMin: T, par: null, use };
  }

  // Par: mínimo real + 2 si existe solución en T+2; si no, mínimo + 1 si
  // existe en T+1. La regla es "bateable en óptimo−1 U óptimo−2": basta
  // una de las dos (si no existe T+1 pero sí T+2, par=T+2 es bateable).
  // Si no existe ni T+1 ni T+2, no es bateable → rechazo.
  const cT1 = countSolutionsOfMinLength(lv, T + 1, 1);
  let par: number;
  if (countSolutionsOfMinLength(lv, T + 2, 1) > 0) {
    par = T + 2;
  } else if (cT1 > 0) {
    par = T + 1;
  } else {
    return { ok: false, reason: `not_beatable(T=${T})`, trueMin: T, par: null, use };
  }
  if (par < tier.minSolutionLen[0] || par > tier.minSolutionLen[1]) {
    return { ok: false, reason: `par_out_of_range(${par})`, trueMin: T, par, use };
  }

  // Regla a fuego #2: debe existir una ruta limpia ≤ par que no sea
  // "adelante y atrás" para esquivar al cazador (≤ MAX_PATH_REVISITS
  // casillas revisitadas). El camino óptimo del BFS puede bailar aunque
  // haya alternativa limpia — lo que importa es que exista.
  if (!findCleanSolution(lv, par)) {
    return { ok: false, reason: `no_clean_route(>${MAX_PATH_REVISITS}rv)`, trueMin: T, par, use };
  }

  // Todos los elementos deben condicionar la solución
  for (const obs of lv.obstacles) {
    if (!isRequired(lv, (lv2) => removeObstacle(lv2, obs), T)) {
      return { ok: false, reason: `redundant_obstacle(${col(obs)},${row(obs)})`, trueMin: T, par, use };
    }
  }
  for (const trp of lv.traps) {
    if (!isRequired(lv, (lv2) => removeTrap(lv2, trp), T)) {
      return { ok: false, reason: `redundant_trap(${col(trp)},${row(trp)})`, trueMin: T, par, use };
    }
  }
  for (const en of lv.enemies) {
    if (!isRequired(lv, (lv2) => removeEnemy(lv2, en), T)) {
      return { ok: false, reason: `decorative_enemy(${col(en)},${row(en)})`, trueMin: T, par, use };
    }
  }

  const sols: [number, number, number] = [
    countSolutionsOfMinLength(lv, par, 50),
    countSolutionsOfMinLength(lv, par - 1, 50),
    countSolutionsOfMinLength(lv, par - 2, 50),
  ];

  return { ok: true, reason: "ok", trueMin: T, par, sols, path: res.path, use };
}

// ---------------------------------------------------------------------------
// Generación de un nivel completo
// ---------------------------------------------------------------------------

export interface GeneratedLevel {
  lv: LevelData;
  trueMin: number;
  par: number;
  sols: [number, number, number];
  path: number[];
  use: number;
}

export function generateLevel(tier: Tier, seed: number, maxTries = 2500): GeneratedLevel | null {
  const rnd = mulberry32(seed);
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const raw = randomCandidate(tier, rnd);
    if (raw === null) continue;
    const pruned = pruneRedundant(raw);
    if (pruned === null) continue;
    const fixed = ensureElements(pruned, tier, rnd);
    if (fixed === null) continue;
    const validation = validateCandidate(fixed, tier);
    if (validation.ok) {
      return {
        lv: fixed,
        trueMin: validation.trueMin!,
        par: validation.par!,
        sols: validation.sols!,
        path: validation.path!,
        use: validation.use!,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Conversión LevelData ↔ Screen
// ---------------------------------------------------------------------------

export function levelToScreen(gen: GeneratedLevel, tier: number, index: number): Screen {
  const { lv } = gen;
  const grid: string[] = [];
  for (let r = 0; r < H; r++) {
    let rowStr = "";
    for (let c = 0; c < W; c++) {
      const k = idx(c, r);
      if (lv.obstacles.has(k)) rowStr += "X";
      else if (lv.traps.has(k)) rowStr += "T";
      else if (lv.exit === k) rowStr += "G";
      else if (lv.player === k) rowStr += "P";
      else if (lv.enemies.includes(k)) rowStr += "E";
      else rowStr += ".";
    }
    grid.push(rowStr);
  }

  return {
    id: `l${tier}-s${index}`,
    level: tier,
    world: "AGUA",
    grid,
    player: [col(lv.player), row(lv.player)],
    goal: [col(lv.exit), row(lv.exit)],
    enemies: lv.enemies.map((e) => ({ pos: [col(e), row(e)] as [number, number], pattern: "CHASE" as Pattern })),
    obstacles: [...lv.obstacles].map((k) => [col(k), row(k)] as [number, number]),
    traps: [...lv.traps].map((k) => [col(k), row(k)] as [number, number]),
    minMoves: gen.par,
    sols: gen.sols,
  };
}

/** Screen del banco → LevelData (para los endpoints del servidor). */
export function screenToLevelData(s: {
  grid?: string[];
  player: [number, number];
  goal: [number, number];
  enemies: { pos: [number, number] }[];
  obstacles: [number, number][];
  traps: [number, number][];
}): LevelData {
  const obstacles = new Set<number>(s.obstacles.map(([c, r]) => idx(c, r)));
  const traps = new Set<number>(s.traps.map(([c, r]) => idx(c, r)));
  // Paredes '#' del grid (el generador no las usa, pero el formato las admite)
  if (s.grid) {
    for (let r = 0; r < Math.min(H, s.grid.length); r++) {
      const rowStr = s.grid[r]!;
      for (let c = 0; c < Math.min(W, rowStr.length); c++) {
        if (rowStr[c] === "#") obstacles.add(idx(c, r));
      }
    }
  }
  return {
    obstacles,
    traps,
    exit: idx(s.goal[0], s.goal[1]),
    player: idx(s.player[0], s.player[1]),
    enemies: s.enemies.map((e) => idx(e.pos[0], e.pos[1])),
  };
}

// ---------------------------------------------------------------------------
// Generación por tier con dedupe (usada por el worker y el driver)
// ---------------------------------------------------------------------------

export interface GenStats {
  tier: number;
  attempts: number;
  accepted: number;
  duplicates: number;
  reasons: Record<string, number>;
  elapsedMs: number;
  /** Distribución del uso del tablero (solo aceptados), en % redondeado. */
  useHistogram: Record<string, number>;
  /** Distribución del par mostrado. */
  parHistogram: Record<string, number>;
}

/**
 * Genera hasta `target` pantallas únicas de un tier.
 * Devuelve las pantallas y las estadísticas. Se detiene antes si se
 * agotan las seeds útiles (maxAttempts) — el espacio de puzzles distintos
 * de los tiers bajos puede ser menor que el objetivo.
 */
export function generateTierBatch(
  tier: Tier,
  target: number,
  seedBase: number,
  maxAttempts = target * 60,
  dedupeSeed: Set<string> | null = null,
): { screens: Screen[]; stats: GenStats } {
  const seen = dedupeSeed ?? new Set<string>();
  const screens: Screen[] = [];
  const reasons: Record<string, number> = {};
  const useHistogram: Record<string, number> = {};
  const parHistogram: Record<string, number> = {};
  let attempts = 0;
  let duplicates = 0;
  const t0 = Date.now();

  while (screens.length < target && attempts < maxAttempts) {
    attempts++;
    // seed única por intento (mezcla de tier+base+intento en 32 bits)
    const seed = (seedBase + Math.imul(attempts, 2246822519)) >>> 0;
    const rnd = mulberry32(seed ^ Math.imul(tier.level + 1, 2654435761));
    const raw = randomCandidate(tier, rnd);
    if (raw === null) {
      reasons["candidate_null"] = (reasons["candidate_null"] ?? 0) + 1;
      continue;
    }
    const pruned = pruneRedundant(raw);
    if (pruned === null) {
      reasons["unprunable"] = (reasons["unprunable"] ?? 0) + 1;
      continue;
    }
    let fixed = ensureElements(pruned, tier, rnd);
    if (fixed === null) {
      reasons["min_elements_unreachable"] = (reasons["min_elements_unreachable"] ?? 0) + 1;
      continue;
    }
    // Estabilización: alargar/recortar puede dejar elementos redundantes.
    // Re-podar y re-completar hasta 2 veces convierte esos descartes en
    // candidatos válidos en lugar de tirarlos.
    let validation = validateCandidate(fixed, tier);
    for (let stab = 0; stab < 2 && !validation.ok && validation.reason.startsWith("redundant"); stab++) {
      const repruned = pruneRedundant(fixed);
      if (repruned === null) break;
      fixed = ensureElements(repruned, tier, rnd);
      if (fixed === null) break;
      validation = validateCandidate(fixed, tier);
    }
    if (fixed === null || !validation.ok) {
      const k = fixed === null ? "min_elements_unreachable" : validation.reason.split("(")[0]!;
      reasons[k] = (reasons[k] ?? 0) + 1;
      continue;
    }
    const key = canonicalKey(fixed);
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    const gen: GeneratedLevel = {
      lv: fixed,
      trueMin: validation.trueMin!,
      par: validation.par!,
      sols: validation.sols!,
      path: validation.path!,
      use: validation.use!,
    };
    screens.push(levelToScreen(gen, tier.level, 0)); // id se reasigna al final
    const useBucket = `${Math.floor(validation.use! * 10) * 10}-${Math.floor(validation.use! * 10) * 10 + 9}`;
    useHistogram[useBucket] = (useHistogram[useBucket] ?? 0) + 1;
    parHistogram[String(validation.par)] = (parHistogram[String(validation.par)] ?? 0) + 1;
  }

  screens.forEach((s, i) => { s.id = `l${tier.level}-s${i + 1}`; });
  return {
    screens,
    stats: {
      tier: tier.level,
      attempts,
      accepted: screens.length,
      duplicates,
      reasons,
      elapsedMs: Date.now() - t0,
      useHistogram,
      parHistogram,
    },
  };
}

// ---------------------------------------------------------------------------
// CLI: driver principal + worker
// ---------------------------------------------------------------------------
//
//   npx tsx generator/generate-screens.ts                     → todos los tiers, 100k c/u
//   npx tsx generator/generate-screens.ts --tier=7 --count=1000
//   npx tsx generator/generate-screens.ts --test              → lote pequeño + estadísticas
//   npx tsx generator/generate-screens.ts --workers=8         → paralelo por tier
//   npx tsx generator/generate-screens.ts --worker --tier=7 --count=5000 --seed=3 --out=part.json
//
// ---------------------------------------------------------------------------

function argVal(name: string): string | null {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=")[1]! : null;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

function writeTierFile(tierLevel: number, screens: Screen[], outDir: string) {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const path = join(outDir, `screens-tier-${tierLevel}.json`);
  writeFileSync(path, JSON.stringify(screens), "utf-8");
  return path;
}

function printStats(s: GenStats) {
  const rate = s.attempts > 0 ? ((s.accepted / s.attempts) * 100).toFixed(1) : "0";
  console.log(`  tier ${s.tier}: ${s.accepted} aceptadas / ${s.attempts} intentos (${rate}% éxito, ${s.duplicates} duplicados, ${(s.elapsedMs / 1000).toFixed(1)}s)`);
  const rs = Object.entries(s.reasons).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (rs.length) console.log(`    descartes: ${rs.map(([k, v]) => `${k}=${v}`).join(" ")}`);
}

async function runWorker(tierLevel: number, count: number, seed: number, outPath: string, attempts: number) {
  const tier = TIERS.find((t) => t.level === tierLevel)!;
  const { screens, stats } = generateTierBatch(tier, count, seed, attempts);
  writeFileSync(outPath, JSON.stringify(screens), "utf-8");
  printStats(stats);
}

function spawnWorker(tierLevel: number, count: number, seed: number, outPath: string, attempts: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", fileURLToPath(import.meta.url), "--worker", `--tier=${tierLevel}`, `--count=${count}`, `--seed=${seed}`, `--attempts=${attempts}`, `--out=${outPath}`],
      { stdio: "inherit", cwd: ROOT },
    );
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`worker tier ${tierLevel} exit ${code}`))));
  });
}

async function generateTier(tier: Tier, target: number, workers: number): Promise<Screen[]> {
  if (workers <= 1) {
    const { screens, stats } = generateTierBatch(tier, target, tier.level * 1_000_003, target * 2000);
    printStats(stats);
    return screens;
  }
  // Paralelo: cada worker genera su parte con seeds disjuntas; el merge
  // deduplica entre workers (las simetrías se canonicalizan igual).
  // Tope de intentos ×2000: cubre aceptaciones de ~0,05% y actúa de
  // cortafuegos si el espacio único se agota antes del objetivo.
  const per = Math.ceil(target / workers);
  const attempts = per * 2000;
  const tmpDir = join(ROOT, ".tmp_chk", "gen-parts");
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  const jobs: Promise<void>[] = [];
  for (let w = 0; w < workers; w++) {
    jobs.push(spawnWorker(tier.level, per, (tier.level * 1_000_003 + w * 97_531) >>> 0, join(tmpDir, `t${tier.level}-w${w}.json`), attempts));
  }
  await Promise.all(jobs);
  const seen = new Set<string>();
  const merged: Screen[] = [];
  for (let w = 0; w < workers; w++) {
    const part = JSON.parse(readFileSync(join(tmpDir, `t${tier.level}-w${w}.json`), "utf-8")) as Screen[];
    for (const s of part) {
      const key = canonicalKey(screenToLevelData(s));
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(s);
    }
  }
  return merged;
}

async function main() {
  const dataDir = join(ROOT, "db");

  // --- modo worker (proceso hijo) ---
  if (hasFlag("worker")) {
    const att = Number(argVal("attempts") ?? "0");
    await runWorker(
      Number(argVal("tier")), Number(argVal("count")),
      Number(argVal("seed") ?? "0") >>> 0, argVal("out") ?? join(ROOT, ".tmp_chk", "part.json"),
      att > 0 ? att : Number(argVal("count")) * 60,
    );
    return;
  }

  const workers = Math.max(1, Number(argVal("workers") ?? "1") || 1);
  const onlyTier = argVal("tier") ? Number(argVal("tier")) : null;
  const count = argVal("count") ? Number(argVal("count")) : SCREENS_PER_TIER;
  const test = hasFlag("test");
  const outDir = test ? join(ROOT, ".tmp_chk", "gen-test") : dataDir;
  const target = test ? Math.min(count, 300) : count;
  const maxAttempts = test ? target * 80 : target * 60;

  const startedAt = Date.now();
  let totalScreens = 0;
  const globalStats: GenStats[] = [];

  for (const tier of TIERS) {
    if (onlyTier !== null && tier.level !== onlyTier) continue;
    console.log(`Nivel ${tier.level} (objetivo ${target}${workers > 1 ? `, ${workers} workers` : ""})…`);

    if (workers <= 1) {
      const { screens, stats } = generateTierBatch(tier, target, tier.level * 1_000_003, maxAttempts);
      screens.forEach((s, i) => { s.id = `l${tier.level}-s${i + 1}`; });
      globalStats.push(stats);
      printStats(stats);
      const path = writeTierFile(tier.level, screens, outDir);
      const sizeMB = (Buffer.byteLength(JSON.stringify(screens), "utf-8") / 1024 / 1024).toFixed(1);
      console.log(`  → ${path} (${sizeMB} MB)`);
      totalScreens += screens.length;
      if (screens.length < target) {
        console.log(`  ⚠ ${screens.length} distintas en ${stats.attempts} intentos (tope de intentos alcanzado)`);
      }
    } else {
      const t0 = Date.now();
      const merged = await generateTier(tier, target, workers);
      merged.forEach((s, i) => { s.id = `l${tier.level}-s${i + 1}`; });
      const path = writeTierFile(tier.level, merged, outDir);
      const sizeMB = (Buffer.byteLength(JSON.stringify(merged), "utf-8") / 1024 / 1024).toFixed(1);
      console.log(`  → ${merged.length} pantallas en ${path} (${sizeMB} MB, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      totalScreens += merged.length;
      if (merged.length < target) {
        console.log(`  ⚠ solo ${merged.length} únicas tras dedupe entre workers`);
      }
    }
  }

  const total = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nTotal: ${totalScreens} pantallas en ${total}s`);

  if (test) {
    console.log("\n=== Resumen del lote de prueba ===");
    for (const s of globalStats) {
      const rate = s.attempts > 0 ? (s.accepted / s.attempts) : 0;
      console.log(
        `tier ${s.tier}: éxito ${(rate * 100).toFixed(1)}% · ` +
        `uso[${Object.entries(s.useHistogram).sort().map(([k, v]) => `${k}%:${v}`).join(" ")}] · ` +
        `par[${Object.entries(s.parHistogram).sort((a, b) => +a[0] - +b[0]).map(([k, v]) => `${k}:${v}`).join(" ")}]`,
      );
    }
    const okStats = globalStats.filter((s) => s.accepted > 0);
    if (okStats.length) {
      const msPer = okStats.reduce((a, s) => a + s.elapsedMs / Math.max(1, s.accepted), 0) / okStats.length;
      console.log(`\nTiempo medio por pantalla aceptada: ${msPer.toFixed(0)}ms ` +
        `(estimación ${target}/tier con ${workers} worker(s): ${((msPer * target) / workers / 3600000).toFixed(1)}h por tier)`);
    }
  }
}

// Solo ejecutar main cuando es el punto de entrada directo
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
