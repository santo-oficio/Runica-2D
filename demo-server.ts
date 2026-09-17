/**
 * Servidor de demo visual de todos los fondos.
 *
 * Sirve las detecciones de los 8 mundos. El cliente cambia de uno a otro
 * con la tecla espacio.
 */

import http from "node:http";
import { readFileSync, existsSync, writeFileSync, readdirSync, createReadStream, statSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import {
  loadDb,
  getNextScreen,
  completeScreen,
  failScreen,
  getProgress,
  getPlayer,
  getStats,
  getRandomScreenByTier,
} from "./db/db.js";

const PORT = 3000;
const ROOT = process.cwd();

// Cargar banco de pantallas + progreso en memoria
loadDb();

const MUNDOS = ["ESPACIO", "AGUA", "TIERRA", "FUEGO", "HIELO", "VIENTO", "INFRAMUNDO", "MAZMORRA"];

type BoardArea = { x: number; y: number; width: number; height: number };

type Detection = {
  world: string;
  image: string;
  width: number;
  height: number;
  boardArea: BoardArea;
  avatarArea?: BoardArea;
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
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
};

const server = http.createServer((req, res) => {
  const url = req.url ?? "/";

  // CORS: permitir peticiones desde el preview proxy (puerto distinto)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: guardar glow config (POST /api/save-glow)
  if (url === "/api/save-glow" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const savePath = join(ROOT, "assets", "menu principal", "glow-config.json");
        writeFileSync(savePath, body, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: cargar glow config (GET /api/load-glow)
  if (url === "/api/load-glow") {
    const loadPath = join(ROOT, "assets", "menu principal", "glow-config.json");
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: guardar esquinas del grid (POST /api/save-corners?world=XXX)
  if (url.startsWith("/api/save-corners") && req.method === "POST") {
    const u = new URL(url, "http://localhost");
    const world = u.searchParams.get("world") || "";
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const dir = join(ROOT, "assets", "backgrounds", world);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const savePath = join(dir, "grid-corners.json");
        writeFileSync(savePath, body, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: cargar esquinas del grid (GET /api/load-corners?world=XXX)
  if (url.startsWith("/api/load-corners")) {
    const u = new URL(url, "http://localhost");
    const world = u.searchParams.get("world") || "";
    const loadPath = join(ROOT, "assets", "backgrounds", world, "grid-corners.json");
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: guardar tamano de losa (POST /api/save-losa-size)
  if (url.startsWith("/api/save-losa-size") && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const savePath = join(ROOT, "assets", "losa-size.json");
        writeFileSync(savePath, body, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: cargar tamano de losa (GET /api/load-losa-size)
  if (url.startsWith("/api/load-losa-size")) {
    const loadPath = join(ROOT, "assets", "losa-size.json");
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: guardar losas (POST /api/save-losas?world=XXX)
  if (url.startsWith("/api/save-losas") && req.method === "POST") {
    const u = new URL(url, "http://localhost");
    const world = u.searchParams.get("world") || "";
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const dir = join(ROOT, "assets", "backgrounds", world);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const savePath = join(dir, "losas.json");
        writeFileSync(savePath, body, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: cargar losas (GET /api/load-losas?world=XXX)
  if (url.startsWith("/api/load-losas")) {
    const u = new URL(url, "http://localhost");
    const world = u.searchParams.get("world") || "";
    const loadPath = join(ROOT, "assets", "backgrounds", world, "losas.json");
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: guardar casillas individuales (POST /api/save-cells?world=XXX)
  if (url.startsWith("/api/save-cells") && req.method === "POST") {
    const u = new URL(url, "http://localhost");
    const world = u.searchParams.get("world") || "";
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const dir = join(ROOT, "assets", "backgrounds", world);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const savePath = join(dir, "cells.json");
        writeFileSync(savePath, body, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: cargar casillas individuales (GET /api/load-cells?world=XXX)
  if (url.startsWith("/api/load-cells")) {
    const u = new URL(url, "http://localhost");
    const world = u.searchParams.get("world") || "";
    const loadPath = join(ROOT, "assets", "backgrounds", world, "cells.json");
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: guardar posiciones de submundo (POST /api/save-subworld-positions?world=XXX)
  if (url.startsWith("/api/save-subworld-positions") && req.method === "POST") {
    const u = new URL(url, "http://localhost");
    const world = u.searchParams.get("world") || "";
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const dir = join(ROOT, "assets", "submundos", world);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const savePath = join(dir, "avatar-positions.json");
        writeFileSync(savePath, body, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: cargar posiciones de submundo (GET /api/load-subworld-positions?world=XXX)
  if (url.startsWith("/api/load-subworld-positions")) {
    const u = new URL(url, "http://localhost");
    const world = u.searchParams.get("world") || "";
    const loadPath = join(ROOT, "assets", "submundos", world, "avatar-positions.json");
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: guardar áreas de texto de submundo (POST /api/save-subworld-text-areas?world=XXX)
  if (url.startsWith("/api/save-subworld-text-areas") && req.method === "POST") {
    const u = new URL(url, "http://localhost");
    const world = u.searchParams.get("world") || "";
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const dir = join(ROOT, "assets", "submundos", world);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "text-areas.json"), body, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: cargar áreas de texto de submundo (GET /api/load-subworld-text-areas?world=XXX)
  if (url.startsWith("/api/load-subworld-text-areas")) {
    const u = new URL(url, "http://localhost");
    const world = u.searchParams.get("world") || "";
    const loadPath = join(ROOT, "assets", "submundos", world, "text-areas.json");
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: guardar caminos del mapamundi (POST /api/save-world-paths)
  if (url === "/api/save-world-paths" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const savePath = join(ROOT, "assets", "mapamundi", "world-paths.json");
        // Merge con existente
        let existing: { paths?: Record<string, unknown> } = {};
        if (existsSync(savePath)) {
          try { existing = JSON.parse(readFileSync(savePath, "utf-8")) as { paths?: Record<string, unknown> }; } catch {}
        }
        const incoming = JSON.parse(body) as { paths?: Record<string, unknown> };
        if (incoming.paths) {
          const existingPaths = existing.paths ?? (existing.paths = {});
          const incomingPaths = incoming.paths;
          Object.keys(incomingPaths).forEach(w => {
            existingPaths[w] = incomingPaths[w];
          });
        }
        writeFileSync(savePath, JSON.stringify(existing, null, 2), "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: cargar caminos del mapamundi (GET /api/load-world-paths)
  if (url === "/api/load-world-paths") {
    const loadPath = join(ROOT, "assets", "mapamundi", "world-paths.json");
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: guardar posiciones de avatar en mapamundi (POST /api/save-avatar-positions)
  if (url === "/api/save-avatar-positions" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const savePath = join(ROOT, "assets", "mapamundi", "avatar-positions.json");
        writeFileSync(savePath, body, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: cargar posiciones de avatar en mapamundi (GET /api/load-avatar-positions)
  if (url === "/api/load-avatar-positions") {
    const loadPath = join(ROOT, "assets", "mapamundi", "avatar-positions.json");
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: guardar instrucciones areas (POST /api/save-instructions-areas)
  if (url === "/api/save-instructions-areas" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const savePath = join(ROOT, "assets", "menu principal", "instructions-areas.json");
        writeFileSync(savePath, body, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: cargar instrucciones areas (GET /api/load-instructions-areas)
  if (url === "/api/load-instructions-areas") {
    const loadPath = join(ROOT, "assets", "menu principal", "instructions-areas.json");
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: guardar botones del menu (POST /api/save-menu-buttons)
  if (url === "/api/save-menu-buttons" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const savePath = join(ROOT, "assets", "menu principal", "menu-buttons.json");
        writeFileSync(savePath, body, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: guardar el área del nombre de selección de personaje
  if (url === "/api/save-selection-name" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const savePath = join(ROOT, "assets", "menu principal", "selection-name-area.json");
        writeFileSync(savePath, body, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: cargar el área del nombre de selección de personaje
  if (url === "/api/load-selection-name") {
    const loadPath = join(ROOT, "assets", "menu principal", "selection-name-area.json");
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: guardar polígonos de los botones de selección de personaje
  if (url === "/api/save-selection-buttons" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const savePath = join(ROOT, "assets", "menu principal", "selection-buttons.json");
        writeFileSync(savePath, body, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: cargar polígonos de los botones de selección de personaje
  if (url === "/api/load-selection-buttons") {
    const loadPath = join(ROOT, "assets", "menu principal", "selection-buttons.json");
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: guardar posiciones de selección de personaje (POST /api/save-character-positions)
  if (url === "/api/save-character-positions" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const savePath = join(ROOT, "assets", "menu principal", "character-positions.json");
        writeFileSync(savePath, body, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: cargar posiciones de selección de personaje (GET /api/load-character-positions)
  if (url === "/api/load-character-positions") {
    const loadPath = join(ROOT, "assets", "menu principal", "character-positions.json");
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: cargar botones del menu (GET /api/load-menu-buttons)
  if (url === "/api/load-menu-buttons") {
    const loadPath = join(ROOT, "assets", "menu principal", "menu-buttons.json");
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "No hay guardado" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: archivo de idioma (GET /api/i18n/:lang)
  const i18nMatch = url.match(/^\/api\/i18n\/(\w+)$/);
  if (i18nMatch) {
    const lang = i18nMatch[1]!;
    const langPath = join(ROOT, "i18n", `${lang}.json`);
    if (!existsSync(langPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: `Idioma no encontrado: ${lang}` }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(langPath, "utf-8"));
    return;
  }

  // API: todas las detecciones
  if (url.startsWith("/api/worlds")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(detections));
    return;
  }

  // API: guardar calibración manual (POST JSON: { world, boardArea? , avatarArea? })
  // boardArea = tablero para losas/obstáculos; avatarArea = tablero solo para avatares.
  if (url === "/api/save-calibration" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const world = data.world as string;
        const boardArea = data.boardArea as BoardArea | undefined;
        const avatarArea = data.avatarArea as BoardArea | undefined;
        if (!world || (!boardArea && !avatarArea)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Faltan world y boardArea/avatarArea" }));
          return;
        }
        const path = join(ROOT, "assets", "backgrounds", world, "board-detection.json");
        if (!existsSync(path)) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Mundo no encontrado" }));
          return;
        }
        const det = JSON.parse(readFileSync(path, "utf-8")) as Detection;
        if (boardArea) det.boardArea = boardArea;
        if (avatarArea) det.avatarArea = avatarArea;
        det.boardSize = [8, 6];
        writeFileSync(path, JSON.stringify(det, null, 2) + "\n");
        // Recargar en memoria
        const idx = detections.findIndex((d) => d.world === world);
        if (idx >= 0) detections[idx] = det;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, boardArea: det.boardArea, avatarArea: det.avatarArea }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: estado del jugador (GET /api/player)
  if (url === "/api/player") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, player: getPlayer() }));
    return;
  }

  // API: siguiente pantalla según posición/progreso del jugador (GET /api/next-screen)
  if (url.startsWith("/api/next-screen")) {
    const { screen, tier, world, stage } = getNextScreen();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, screen, tier, world, stage, player: getPlayer() }));
    return;
  }

  // API: marcar pantalla completada (POST JSON: { screenId, turns })
  if (url === "/api/complete-screen" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const player = completeScreen(data.screenId as string, Number(data.turns) || 0);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, player }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: registrar fallo/reintento (POST JSON: { screenId })
  if (url === "/api/fail-screen" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        failScreen(data.screenId as string);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: estadísticas globales del jugador (GET /api/stats)
  if (url === "/api/stats") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, ...getStats() }));
    return;
  }

  // API: progreso completo (depuración)
  if (url === "/api/progress") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(getProgress()));
    return;
  }

  // API DEMO: pantalla aleatoria de un tier, sin guardar nada en la bbdd
  // GET /api/demo-screen?tier=1
  if (url.startsWith("/api/demo-screen")) {
    const u = new URL(url, `http://localhost:${PORT}`);
    const tier = Number(u.searchParams.get("tier") ?? "1") || 1;
    const screen = getRandomScreenByTier(tier);
    res.writeHead(screen ? 200 : 404, { "Content-Type": "application/json" });
    res.end(JSON.stringify(screen ? { ok: true, screen, tier } : { ok: false, error: "Tier sin pantallas" }));
    return;
  }

  // API: lista de imágenes de obstáculos de un mundo (GET /api/obstacles?world=XXX)
  // Mapeo de carpetas especiales: VIENTO→AIRE
  if (url.startsWith("/api/obstacles")) {
    const u = new URL(url, `http://localhost:${PORT}`);
    const world = u.searchParams.get("world") ?? "";
    const dir = join(ROOT, "assets", "obstaculos", world);
    let images: string[] = [];
    if (existsSync(dir)) {
      images = readdirSync(dir)
        .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f) && !/^test_/i.test(f) && !/_cyan_triskele_3\.png$/i.test(f))
        .sort()
        .map((f) => `/assets/obstaculos/${world}/${encodeURIComponent(f)}`);
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, world, images }));
    return;
  }

  // Archivos estáticos (ignorar query string y decodificar %20 etc.)
  const cleanUrl = url.split("?")[0] ?? "/";
  let filePath = cleanUrl === "/" ? "/demo.html" : decodeURIComponent(cleanUrl);
  filePath = join(ROOT, filePath);

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = extname(filePath);
  const mime = MIME[ext] ?? "application/octet-stream";
  const stat = statSync(filePath);
  const headers: Record<string, string> = {
    "Content-Type": mime,
    "Content-Length": String(stat.size),
  };
  // No cachear JSON ni HTML para que los cambios surtan efecto inmediatamente
  if (ext === ".json" || ext === ".html") {
    headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
  }
  res.writeHead(200, headers);
  createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`\n  Demo visual de todos los fondos`);
  console.log(`  → http://localhost:${PORT}\n`);
  console.log(`  ${detections.length} mundos disponibles:`);
  detections.forEach((d, i) => console.log(`    ${i + 1}. ${d.world}`));
  console.log(`\n  Controles: Espacio = siguiente mundo · Flechas = mover selector\n`);
});

