/**
 * Generador de pantallas (screens) para el banco local — Runika 2D.
 *
 * Porta fielmente el pipeline del diseñador de niveles (wappo_generator.py,
 * wappo_simulator.py, wappo_solver.py) a TypeScript:
 *
 *  - 14 tiers de dificultad con rangos parametrizados (enemigos, obstáculos,
 *    trampas, longitud de solución, distancia mínima enemigo-jugador).
 *  - Colocación aleatoria con bias hacia el camino directo jugador→salida.
 *  - Pruning de elementos redundantes: cada obstáculo/trampa/enemigo debe
 *    ser funcional (su eliminación cambia la resolubilidad, la longitud
 *    óptima, o la libertad del jugador a profundidad óptima).
 *  - Validación final: longitud de solución en rango del tier, al menos un
 *    enemigo presente, todos los elementos funcionales.
 *  - Solver BFS determinista que replica LITERALMENTE las reglas del motor
 *    (engine/rules.ts): movimiento ortogonal, enemigo CHASE 2 sub-pasos
 *    por turno, trampa aturde 3 turnos, colisión = derrota.
 *
 * Tablero fijo 8×6 (8 columnas × 6 filas).
 *
 * Reglas Wappo (docs/11-REGLAS-WAPPO-ORIGINAL.md):
 *  - Jugador: 1 casilla/turno, ortogonal.
 *  - Enemigo CHASE: 2 sub-pasos/turno, horizontal primero, luego vertical.
 *  - Todo enemigo persigue (no hay enemigos estáticos).
 *  - Obstáculo (X): bloquea a ambos.
 *  - Trampa (T): aturde 3 turnos a quien la pisa (jugador o enemigo).
 *  - Salida (G): victoria inmediata al llegar (antes del movimiento enemigo).
 *  - Contacto con enemigo: derrota.
 *  - Movimiento inválido (pared/obstáculo/límite): no cuenta como turno.
 *  - Sin solapamiento inicial: ninguna casilla con más de un item.
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const W = 8;
const H = 6;
const CELLS = W * H;

// Pantallas por tier: 50k para tiers 1-9, 5k para tiers 10-14.
function screensForTier(tierLevel: number): number {
  return tierLevel <= 9 ? 50000 : 5000;
}

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
  minMoves: number;
}

export interface Tier {
  level: number;
  numEnemies: number;
  numObstacles: [number, number]; // (min, max)
  numTraps: [number, number];
  minSolutionLen: [number, number]; // rango aceptable de longitud óptima
  minEnemyPlayerDist: number;
}

// ---------------------------------------------------------------------------
// 14 tiers de dificultad (portados de wappo_generator.py TIERS)
// ---------------------------------------------------------------------------

export const TIERS: Tier[] = [
  { level: 1, numEnemies: 1, numObstacles: [0, 1], numTraps: [0, 0], minSolutionLen: [4, 7], minEnemyPlayerDist: 4 },
  { level: 2, numEnemies: 1, numObstacles: [1, 2], numTraps: [0, 0], minSolutionLen: [5, 8], minEnemyPlayerDist: 4 },
  { level: 3, numEnemies: 1, numObstacles: [1, 2], numTraps: [0, 1], minSolutionLen: [6, 9], minEnemyPlayerDist: 4 },
  { level: 4, numEnemies: 1, numObstacles: [1, 3], numTraps: [0, 1], minSolutionLen: [6, 10], minEnemyPlayerDist: 4 },
  { level: 5, numEnemies: 1, numObstacles: [2, 3], numTraps: [1, 1], minSolutionLen: [7, 11], minEnemyPlayerDist: 4 },
  { level: 6, numEnemies: 2, numObstacles: [2, 3], numTraps: [1, 1], minSolutionLen: [8, 12], minEnemyPlayerDist: 3 },
  { level: 7, numEnemies: 2, numObstacles: [2, 3], numTraps: [1, 2], minSolutionLen: [9, 13], minEnemyPlayerDist: 3 },
  { level: 8, numEnemies: 2, numObstacles: [2, 4], numTraps: [1, 2], minSolutionLen: [9, 13], minEnemyPlayerDist: 3 },
  { level: 9, numEnemies: 2, numObstacles: [2, 4], numTraps: [1, 2], minSolutionLen: [10, 14], minEnemyPlayerDist: 3 },
  { level: 10, numEnemies: 2, numObstacles: [3, 4], numTraps: [2, 2], minSolutionLen: [10, 15], minEnemyPlayerDist: 3 },
  { level: 11, numEnemies: 3, numObstacles: [3, 4], numTraps: [2, 3], minSolutionLen: [11, 16], minEnemyPlayerDist: 3 },
  { level: 12, numEnemies: 3, numObstacles: [3, 4], numTraps: [2, 3], minSolutionLen: [12, 17], minEnemyPlayerDist: 3 },
  { level: 13, numEnemies: 3, numObstacles: [3, 5], numTraps: [2, 3], minSolutionLen: [13, 18], minEnemyPlayerDist: 3 },
  { level: 14, numEnemies: 3, numObstacles: [3, 5], numTraps: [2, 3], minSolutionLen: [14, 20], minEnemyPlayerDist: 3 },
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

function mulberry32(seed: number): () => number {
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

const idx = (c: number, r: number) => r * W + c;
const col = (k: number) => k % W;
const row = (k: number) => Math.floor(k / W);

function manhattan(a: number, b: number): number {
  return Math.abs(col(a) - col(b)) + Math.abs(row(a) - row(b));
}

function allCells(): number[] {
  const cells: number[] = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) cells.push(idx(c, r));
  return cells;
}

/** BFS shortest path en tablero vacío (sin obstáculos/enemigos). */
function directPathCells(player: number, exit: number): number[] {
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

// ---------------------------------------------------------------------------
// Generación de candidato aleatorio (portado de random_candidate)
// ---------------------------------------------------------------------------

function randomCandidate(tier: Tier, rnd: () => number): LevelData | null {
  const cells = allCells();
  shuffle(cells, rnd);
  const used = new Set<number>();

  // Salida
  const exitC = cells.pop()!;
  used.add(exitC);

  // Jugador: distancia Manhattan >= 4 desde la salida
  let playerC: number | null = null;
  for (let i = cells.length - 1; i >= 0; i--) {
    const c = cells[i]!;
    if (manhattan(c, exitC) >= 4 && !used.has(c)) {
      playerC = c;
      break;
    }
  }
  if (playerC === null) return null;
  used.add(playerC);

  const freeAfterPlayer = cells.filter((c) => !used.has(c));

  // Camino directo para bias de enemigos
  const pathCells = directPathCells(playerC, exitC);

  const nearPath = (c: number, radius: number): boolean =>
    pathCells.some((p) => manhattan(c, p) <= radius);

  // Enemigos: bias hacia celdas que amenazan el camino directo
  const enemies: number[] = [];
  for (let i = 0; i < tier.numEnemies; i++) {
    let candidates = freeAfterPlayer.filter(
      (c) => !used.has(c) && manhattan(c, playerC) >= tier.minEnemyPlayerDist && nearPath(c, 5),
    );
    if (candidates.length === 0) {
      candidates = freeAfterPlayer.filter(
        (c) => !used.has(c) && manhattan(c, playerC) >= tier.minEnemyPlayerDist,
      );
    }
    if (candidates.length === 0) return null;
    const e = candidates[Math.floor(rnd() * candidates.length)]!;
    enemies.push(e);
    used.add(e);
  }

  const freeAfterEnemies = freeAfterPlayer.filter((c) => !used.has(c));

  // Obstáculos y trampas: cantidades aleatorias dentro del rango del tier
  const nObs = tier.numObstacles[0] + Math.floor(rnd() * (tier.numObstacles[1] - tier.numObstacles[0] + 1));
  const nTrp = tier.numTraps[0] + Math.floor(rnd() * (tier.numTraps[1] - tier.numTraps[0] + 1));
  if (freeAfterEnemies.length < nObs + nTrp) return null;

  const shuffled = shuffle(freeAfterEnemies.slice(), rnd);
  const obstacles = new Set<number>(shuffled.slice(0, nObs));
  const traps = new Set<number>(shuffled.slice(nObs, nObs + nTrp));

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
 *
 * Reglas (idénticas a engine/rules.ts playTurn):
 *  1. Jugador aturdido: decrementa stun, enemigos se mueven (turno avanza).
 *  2. Jugador se mueve 1 casilla ortogonal. Si bloqueado (pared/obstáculo/
 *     límite/enemigo): movimiento inválido, NO cuenta como turno.
 *  3. ¿Jugador en salida? → VICTORIA (antes de que se mueva el enemigo).
 *  4. Jugador pisa trampa → aturdido 3 turnos.
 *  5. Enemigos: cada uno hace 2 sub-pasos (horizontal primero, luego vertical).
 *     Si un enemigo está aturdido: decrementa stun y salta todo el turno.
 *     Si un enemigo pisa trampa: aturdido 3 turnos, para de moverse.
 *     Colisión tras cada sub-paso → DERROTA.
 *  6. ¿Jugador en salida? → VICTORIA (recheck).
 *  7. Turno++.
 */

interface SolveResult {
  solvable: boolean;
  length: number | null;
}

function solve(lv: LevelData): SolveResult {
  const n = lv.enemies.length;
  const blocked = new Uint8Array(CELLS);
  const trap = new Uint8Array(CELLS);
  for (const k of lv.obstacles) blocked[k] = 1;
  for (const k of lv.traps) trap[k] = 1;

  const enemyStart = lv.enemies.slice();
  const playerStart = lv.player;
  const goalIdx = lv.exit;

  // Codificación de estado: player + enemies + stuns
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
      // No atravesar bordes horizontalmente
      if (Math.floor(nc / W) !== er && Math.abs(nc - ep) === 1) continue;
      if (blocked[nc]) continue;
      return nc;
    }
    return ep;
  }

  /** Procesa el turno de enemigos. Devuelve nuevas posiciones, stuns y captura. */
  function moveEnemies(
    e: number[],
    s: number[],
    np: number,
  ): { e: number[]; s: number[]; captured: boolean } {
    const ne = e.slice();
    const ns = s.slice();
    let captured = false;
    for (let i = 0; i < n; i++) {
      // Aturdido: decrementa 1 vez por turno, salta los 2 sub-pasos
      if (ns[i]! > 0) {
        ns[i] = ns[i]! - 1;
        continue;
      }
      for (let step = 0; step < 2; step++) {
        // Recalcular dx/dy con posición actual del jugador
        const newPos = enemySubstep(ne[i]!, np);
        ne[i] = newPos;
        // Colisión tras cada sub-paso
        if (newPos === np) {
          captured = true;
          break;
        }
        // Pisó trampa: aturdir 3 turnos, parar
        if (trap[newPos]) {
          ns[i] = 3;
          break;
        }
      }
      if (captured) break;
    }
    return { e: ne, s: ns, captured };
  }

  const startKey = keyOf(playerStart, enemyStart, enemyStart.map(() => 0), 0);
  const visited = new Set<number>([startKey]);
  const queue: { p: number; e: number[]; s: number[]; ps: number; depth: number }[] = [
    { p: playerStart, e: enemyStart, s: enemyStart.map(() => 0), ps: 0, depth: 0 },
  ];

  const DIRS = [1, -1, W, -W];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.depth > 60) continue;

    // Jugador aturdido: pasa el turno (enemigos se mueven)
    if (cur.ps > 0) {
      const res = moveEnemies(cur.e, cur.s, cur.p);
      if (res.captured) continue;
      const key = keyOf(cur.p, res.e, res.s, cur.ps - 1);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ p: cur.p, e: res.e, s: res.s, ps: cur.ps - 1, depth: cur.depth + 1 });
      continue;
    }

    for (const d of DIRS) {
      const np = cur.p + d;
      if (np < 0 || np >= CELLS) continue;
      const pc = cur.p % W;
      if (d === 1 && pc === W - 1) continue;
      if (d === -1 && pc === 0) continue;

      // Movimiento inválido: no cuenta turno
      if (blocked[np]) continue;
      if (cur.e.includes(np)) continue;

      // ¿Victoria? (antes de que se mueva el enemigo)
      if (np === goalIdx) return { solvable: true, length: cur.depth + 1 };

      // El jugador pisa trampa → aturdido 3 turnos
      const newPs = trap[np] ? 3 : 0;

      const res = moveEnemies(cur.e, cur.s, np);
      if (res.captured) continue;

      const key = keyOf(np, res.e, res.s, newPs);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ p: np, e: res.e, s: res.s, ps: newPs, depth: cur.depth + 1 });
    }
  }
  return { solvable: false, length: null };
}

// ---------------------------------------------------------------------------
// Conteo de soluciones de longitud exacta (freedom counting con memoización)
// ---------------------------------------------------------------------------

/**
 * Cuenta (hasta `cap`) secuencias distintas de exactamente `len` acciones
 * que ganan. Sirve como proxy de la libertad del jugador a profundidad óptima.
 *
 * Memoizado en (stateKey, remaining) para evitar explosión exponencial.
 */
function countSolutionsOfMinLength(lv: LevelData, len: number, cap = 50): number {
  const n = lv.enemies.length;
  const blocked = new Uint8Array(CELLS);
  const trap = new Uint8Array(CELLS);
  for (const k of lv.obstacles) blocked[k] = 1;
  for (const k of lv.traps) trap[k] = 1;

  const enemyStart = lv.enemies.slice();
  const playerStart = lv.player;
  const goalIdx = lv.exit;

  function keyOf(p: number, e: number[], s: number[], ps: number): string {
    let k = `${p},${ps}`;
    for (let i = 0; i < n; i++) k += `,${e[i]},${s[i]}`;
    return k;
  }

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
        const newPos = enemySubstep(ne[i]!, np);
        ne[i] = newPos;
        if (newPos === np) {
          captured = true;
          break;
        }
        if (trap[newPos]) {
          ns[i] = 3;
          break;
        }
      }
      if (captured) break;
    }
    return { e: ne, s: ns, captured };
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
      // Jugador aturdido: pasa el turno
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

      // ¿Victoria?
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
// Pruning de elementos redundantes (portado de prune_redundant)
// ---------------------------------------------------------------------------

/**
 * Devuelve true si el elemento ES funcional: su eliminación cambia la
 * resolubilidad, la longitud óptima, O aumenta la libertad del jugador
 * a profundidad óptima.
 */
function isFunctionalRemoval(
  lv: LevelData,
  modifyFn: (lv: LevelData) => LevelData,
  baseLen: number,
  baseFreedom: number,
): boolean {
  const modified = modifyFn(lv);
  const res = solve(modified);
  if (!res.solvable) return true; // era solvable, ahora no → funcional
  if (res.length !== baseLen) return true; // cambia longitud → funcional
  const newFreedom = countSolutionsOfMinLength(modified, res.length!, 50);
  if (newFreedom > baseFreedom) return true; // aumenta libertad → funcional
  return false;
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

function pruneRedundant(lv: LevelData): LevelData | null {
  const res = solve(lv);
  if (!res.solvable) return null;
  const length = res.length!;

  let current = lv;
  let changed = true;
  while (changed) {
    changed = false;
    const freedom = countSolutionsOfMinLength(current, length, 50);

    for (const obs of current.obstacles) {
      if (!isFunctionalRemoval(current, (lv2) => removeObstacle(lv2, obs), length, freedom)) {
        current = removeObstacle(current, obs);
        changed = true;
        break;
      }
    }
    if (changed) continue;

    for (const trp of current.traps) {
      if (!isFunctionalRemoval(current, (lv2) => removeTrap(lv2, trp), length, freedom)) {
        current = removeTrap(current, trp);
        changed = true;
        break;
      }
    }
    if (changed) continue;

    for (const en of current.enemies) {
      if (!isFunctionalRemoval(current, (lv2) => removeEnemy(lv2, en), length, freedom)) {
        current = removeEnemy(current, en);
        changed = true;
        break;
      }
    }
  }
  return current;
}

// ---------------------------------------------------------------------------
// Validación final (portado de validate_candidate)
// ---------------------------------------------------------------------------

interface ValidationResult {
  ok: boolean;
  reason: string;
  length: number | null;
}

function validateCandidate(lv: LevelData, tier: Tier): ValidationResult {
  const res = solve(lv);
  if (!res.solvable) return { ok: false, reason: "no_solution", length: null };
  const L = res.length!;
  if (L < tier.minSolutionLen[0] || L > tier.minSolutionLen[1]) {
    return { ok: false, reason: `length_out_of_range(${L})`, length: L };
  }
  if (lv.enemies.length === 0) return { ok: false, reason: "no_enemies_left", length: L };

  // Exigir que los counts post-pruning cumplan los rangos del tier.
  // Si el pruning eliminó demasiados elementos, el nivel se rechaza.
  if (lv.enemies.length < tier.numEnemies) {
    return { ok: false, reason: `too_few_enemies(${lv.enemies.length}/${tier.numEnemies})`, length: L };
  }
  if (lv.obstacles.size < tier.numObstacles[0] || lv.obstacles.size > tier.numObstacles[1]) {
    return { ok: false, reason: `obstacles_out_of_range(${lv.obstacles.size}/${tier.numObstacles[0]}-${tier.numObstacles[1]})`, length: L };
  }
  if (lv.traps.size < tier.numTraps[0] || lv.traps.size > tier.numTraps[1]) {
    return { ok: false, reason: `traps_out_of_range(${lv.traps.size}/${tier.numTraps[0]}-${tier.numTraps[1]})`, length: L };
  }

  const freedom = countSolutionsOfMinLength(lv, L, 50);

  for (const obs of lv.obstacles) {
    if (!isFunctionalRemoval(lv, (lv2) => removeObstacle(lv2, obs), L, freedom)) {
      return { ok: false, reason: `redundant_obstacle(${col(obs)},${row(obs)})`, length: L };
    }
  }
  for (const trp of lv.traps) {
    if (!isFunctionalRemoval(lv, (lv2) => removeTrap(lv2, trp), L, freedom)) {
      return { ok: false, reason: `redundant_trap(${col(trp)},${row(trp)})`, length: L };
    }
  }
  for (const en of lv.enemies) {
    if (!isFunctionalRemoval(lv, (lv2) => removeEnemy(lv2, en), L, freedom)) {
      return { ok: false, reason: `decorative_enemy(${col(en)},${row(en)})`, length: L };
    }
  }

  return { ok: true, reason: "ok", length: L };
}

// ---------------------------------------------------------------------------
// Generación de un nivel completo (portado de generate_level)
// ---------------------------------------------------------------------------

export function generateLevel(tier: Tier, seed: number, maxTries = 2500): { lv: LevelData; length: number } | null {
  const rnd = mulberry32(seed);
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const raw = randomCandidate(tier, rnd);
    if (raw === null) continue;
    const pruned = pruneRedundant(raw);
    if (pruned === null) continue;
    const validation = validateCandidate(pruned, tier);
    if (validation.ok) {
      return { lv: pruned, length: validation.length! };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Conversión LevelData → Screen
// ---------------------------------------------------------------------------

export function levelToScreen(lv: LevelData, tier: number, index: number, length: number): Screen {
  const grid: string[] = [];
  for (let r = 0; r < H; r++) {
    let row = "";
    for (let c = 0; c < W; c++) {
      const k = idx(c, r);
      if (lv.obstacles.has(k)) row += "X";
      else if (lv.traps.has(k)) row += "T";
      else if (lv.exit === k) row += "G";
      else if (lv.player === k) row += "P";
      else if (lv.enemies.includes(k)) row += "E";
      else row += ".";
    }
    grid.push(row);
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
    minMoves: length,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const dataDir = join(ROOT, "db");
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const startedAt = Date.now();
  let totalScreens = 0;

  for (const tier of TIERS) {
    const target = screensForTier(tier.level);
    const tierPath = join(dataDir, `screens-tier-${tier.level}.json`);

    // Saltar si ya existe el archivo con suficientes pantallas
    if (existsSync(tierPath)) {
      try {
        const existing = JSON.parse(readFileSync(tierPath, "utf-8")) as Screen[];
        if (existing.length >= target) {
          console.log(`Nivel ${tier.level}: ya tiene ${existing.length} pantallas (≥${target}), saltando`);
          totalScreens += existing.length;
          continue;
        }
      } catch {
        // Si el archivo está corrupto, regenerar
      }
    }

    let accepted = 0;
    let attempts = 0;
    let consecutiveFails = 0;
    const MAX_CONSECUTIVE_FAILS = 200;
    const levelStarted = Date.now();
    const tierScreens: Screen[] = [];

    while (accepted < target) {
      attempts++;
      const seed = tier.level * 1_000_000 + attempts;
      const result = generateLevel(tier, seed);
      if (result === null) {
        consecutiveFails++;
        if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
          console.warn(`  nivel ${tier.level}: ${consecutiveFails} fallos consecutivos, parando en ${accepted} pantallas`);
          break;
        }
        continue;
      }
      consecutiveFails = 0;

      accepted++;
      const screen = levelToScreen(result.lv, tier.level, accepted, result.length);
      tierScreens.push(screen);

      if (accepted % 1000 === 0) {
        const elapsed = ((Date.now() - levelStarted) / 1000).toFixed(1);
        console.log(`  nivel ${tier.level}: ${accepted}/${target} (${elapsed}s, ${attempts} intentos)`);
      }
    }

    // Escribir archivo por tier
    writeFileSync(tierPath, JSON.stringify(tierScreens), "utf-8");
    totalScreens += accepted;

    const elapsed = ((Date.now() - levelStarted) / 1000).toFixed(1);
    const sizeMB = (Buffer.byteLength(JSON.stringify(tierScreens), "utf-8") / 1024 / 1024).toFixed(1);
    console.log(
      `Nivel ${tier.level}: ${accepted} pantallas en ${tierPath} (${sizeMB} MB, ${elapsed}s, ` +
      `${accepted > 0 ? ((accepted / attempts * 100).toFixed(1)) : "0"}% éxito)`,
    );
  }

  const total = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nTotal: ${totalScreens} pantallas en ${total}s`);
}

// Solo ejecutar main cuando es el punto de entrada directo
import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
