import { TIERS, solve, allCells, manhattan, col, row, idx } from "../generator/generate-screens.js";
// Geometría fija con muro vertical + hueco: dónde puede ir el enemigo?
const W = 8, H = 6;
const exit = idx(7, 0), player = idx(0, 5);
const wall: number[] = [];
for (let r = 0; r < H; r++) if (r !== 2) wall.push(idx(4, r)); // muro col 4, hueco en (4,2)
const obstacles = new Set(wall);
const traps = new Set<number>();
const emptyD = manhattan(player, exit);
console.log("emptyD:", emptyD);
const grid: string[][] = [];
for (let r = 0; r < H; r++) { grid.push(new Array(W).fill(".")); }
grid[row(exit)][col(exit)] = "G"; grid[row(player)][col(player)] = "P";
for (const o of obstacles) grid[row(o)][col(o)] = "X";
let sol = 0, nondirect = 0;
for (const e of allCells()) {
  if (obstacles.has(e) || e === player || e === exit) continue;
  const r = solve({ obstacles, traps, exit, player, enemies: [e] });
  const mark = !r.solvable ? "x" : r.length! <= emptyD ? "d" : String(Math.min(9, r.length! - emptyD));
  grid[row(e)][col(e)] = mark;
  if (r.solvable) { sol++; if (r.length! > emptyD) nondirect++; }
}
console.log(grid.map((r) => r.join(" ")).join("\n"));
console.log(`solvables: ${sol}  no-directos: ${nondirect}`);
