/**
 * Informe de casillas del tablero (solo lectura).
 *
 * Lee las detecciones SAM guardadas en
 *   assets/backgrounds/<MUNDO>/board-detection.json
 * y calcula las coordenadas de cada casilla (6 columnas x 5 filas).
 *
 * NO modifica ningún archivo de configuración ni recorta imágenes.
 *
 * Uso:
 *   npx tsx tools/detect-cells.ts            # todos los mundos
 *   npx tsx tools/detect-cells.ts ESPACIO    # un solo mundo
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

type Detection = {
  world: string;
  image: string;
  width: number;
  height: number;
  boardArea: { x: number; y: number; width: number; height: number };
  boardSize: [number, number];
  cellSize: number;
};

const MUNDOS = ["ESPACIO", "AGUA", "CASTILLO_FINAL", "FUEGO", "HIELO", "INFRAMUNDO", "TIERRA", "VIENTO"];

function loadDetection(world: string): Detection | null {
  const path = join(process.cwd(), "assets", "backgrounds", world, "board-detection.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as Detection;
}

function reportCells(world: string) {
  const d = loadDetection(world);
  if (!d) {
    console.log(`\n[${world}] sin deteccion (ejecuta primero background/sam-detect.py)`);
    return;
  }

  const [cols, rows] = d.boardSize;
  const cw = d.boardArea.width / cols;
  const ch = d.boardArea.height / rows;

  console.log(`\n=== ${world} ===`);
  console.log(`imagen: ${d.image}  (${d.width}x${d.height}px)`);
  console.log(`boardArea: x=${d.boardArea.x.toFixed(4)} y=${d.boardArea.y.toFixed(4)} w=${d.boardArea.width.toFixed(4)} h=${d.boardArea.height.toFixed(4)}`);
  console.log(`tamano tablero: ${cols} cols x ${rows} filas  |  casilla aprox: ${(d.width * cw).toFixed(1)}x${(d.height * ch).toFixed(1)}px`);
  console.log(`\nCasillas (x,y en pixeles | centro normalizado):`);

  for (let r = 0; r < rows; r++) {
    const line: string[] = [];
    for (let c = 0; c < cols; c++) {
      const x0 = (d.boardArea.x + c * cw) * d.width;
      const y0 = (d.boardArea.y + r * ch) * d.height;
      const x1 = (d.boardArea.x + (c + 1) * cw) * d.width;
      const y1 = (d.boardArea.y + (r + 1) * ch) * d.height;
      const cx = (x0 + x1) / 2 / d.width;
      const cy = (y0 + y1) / 2 / d.height;
      line.push(`(${Math.round(x0)},${Math.round(y0)}) c(${cx.toFixed(3)},${cy.toFixed(3)})`);
    }
    console.log(`  fila ${r}: ${line.join("  ")}`);
  }
}

const arg = process.argv[2];
if (arg && MUNDOS.includes(arg)) {
  reportCells(arg);
} else {
  for (const m of MUNDOS) reportCells(m);
}
