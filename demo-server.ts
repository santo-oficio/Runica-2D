/**
 * Servidor de demo visual de todos los fondos.
 *
 * Sirve las detecciones de los 8 mundos. El cliente cambia de uno a otro
 * con la tecla espacio.
 */

import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const PORT = 3000;
const ROOT = process.cwd();

const MUNDOS = ["ESPACIO", "AGUA", "TIERRA", "FUEGO", "HIELO", "VIENTO", "INFRAMUNDO", "CASTILLO_FINAL"];

type BoardArea = { x: number; y: number; width: number; height: number };

type Detection = {
  world: string;
  image: string;
  width: number;
  height: number;
  boardArea: BoardArea;
  boardSize: [number, number];
  cellSize: number;
};

function loadDetection(world: string): Detection | null {
  const path = join(ROOT, "assets", "backgrounds", world, "board-detection.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Detection;
  } catch {
    return null;
  }
}

const detections = MUNDOS
  .map((m) => loadDetection(m))
  .filter((d): d is Detection => d !== null);

if (detections.length === 0) {
  throw new Error("No hay detecciones SAM disponibles");
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  const url = req.url ?? "/";

  // API: todas las detecciones
  if (url === "/api/worlds") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(detections));
    return;
  }

  // Archivos estáticos
  let filePath = url === "/" ? "/demo.html" : url;
  filePath = join(ROOT, filePath);

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = extname(filePath);
  const mime = MIME[ext] ?? "application/octet-stream";
  res.writeHead(200, { "Content-Type": mime });
  res.end(readFileSync(filePath));
});

server.listen(PORT, () => {
  console.log(`\n  Demo visual de todos los fondos`);
  console.log(`  → http://localhost:${PORT}\n`);
  console.log(`  ${detections.length} mundos disponibles:`);
  detections.forEach((d, i) => console.log(`    ${i + 1}. ${d.world}`));
  console.log(`\n  Controles: Espacio = siguiente mundo · Flechas = mover selector\n`);
});

