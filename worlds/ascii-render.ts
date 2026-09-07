/**
 * Renderizado ASCII de un LevelMap para tests (docs/09 Fase 5).
 *
 * No es un renderizador gráfico — es una representación textual del
 * tablero que permite verificar visualmente (en logs de test) que el
 * nivel tiene la estructura esperada. El grid del LevelMap ya es ASCII
 * (`#`, `.`, `P`, `E`, `G`, `X`, `D`, `K`), así que basta con imprimirlo
 * con un marco y metadata.
 */

import type { LevelMap } from "../schemas/types.js";

/**
 * Renderiza un LevelMap en ASCII con marco y metadata.
 * Útil para logs de tests y depuración.
 */
export function renderAscii(level: LevelMap): string {
  const lines: string[] = [];
  const topBorder = "┌" + "─".repeat(level.width) + "┐";
  const bottomBorder = "└" + "─".repeat(level.width) + "┘";

  lines.push(topBorder);
  for (const row of level.grid) {
    lines.push("│" + row + "│");
  }
  lines.push(bottomBorder);

  lines.push("");
  lines.push(`levelId: ${level.levelId}  seed: ${level.seed}  world: ${level.world}`);
  lines.push(`archetype: ${level.archetype}  size: ${level.width}x${level.height}`);
  lines.push(`player: [${level.player[0]},${level.player[1]}]  goal: [${level.goal[0]},${level.goal[1]}]`);
  lines.push(`enemies: ${level.enemies.length}  keys: ${level.keys.length}  doors: ${level.doors.length}`);
  if (level.enemies.length > 0) {
    const enemyInfo = level.enemies
      .map((e) => `[${e.pos[0]},${e.pos[1]}](${e.pattern})`)
      .join(" ");
    lines.push(`  enemies: ${enemyInfo}`);
  }

  return lines.join("\n");
}

/**
 * Renderiza un LevelMap con una solución superpuesta (mostrando el
 * camino del jugador con números). Útil para verificar que la solución
 * del solver es correcta.
 */
export function renderAsciiWithSolution(
  level: LevelMap,
  solution: readonly string[],
): string {
  // Reconstruir el camino del jugador paso a paso.
  let [pc, pr] = level.player;
  const path = new Map<string, number>();
  path.set(`${pc},${pr}`, 0);
  const deltas: Record<string, [number, number]> = {
    UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0],
  };
  for (let i = 0; i < solution.length; i++) {
    const dir = solution[i]!;
    const [dc, dr] = deltas[dir]!;
    pc += dc;
    pr += dr;
    path.set(`${pc},${pr}`, i + 1);
  }

  const lines: string[] = [];
  const topBorder = "┌" + "─".repeat(level.width) + "┐";
  const bottomBorder = "└" + "─".repeat(level.width) + "┘";

  lines.push(topBorder);
  for (let r = 0; r < level.height; r++) {
    let row = "│";
    for (let c = 0; c < level.width; c++) {
      const ch = level.grid[r]![c]!;
      const step = path.get(`${c},${r}`);
      if (step !== undefined && ch !== "#") {
        if (step === 0) row += "P";
        else if (step === solution.length) row += "G";
        else row += step < 10 ? String(step) : "·";
      } else {
        row += ch;
      }
    }
    row += "│";
    lines.push(row);
  }
  lines.push(bottomBorder);

  lines.push("");
  lines.push(`solución: ${solution.length} movimientos`);
  lines.push(`  ${solution.join(" → ")}`);

  return lines.join("\n");
}
