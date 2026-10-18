/**
 * Servidor local de Runika 2D.
 *
 * Sirve las detecciones de los 8 mundos. El cliente cambia de uno a otro
 * con la tecla espacio.
 */

import http from "node:http";
import { readFileSync, existsSync, writeFileSync, readdirSync, createReadStream, statSync, mkdirSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadDb,
  getNextScreen,
  completeScreen,
  failScreen,
  getProgress,
  getPlayer,
  getStats,
  getRandomScreenByTier,
  hasSaveGame,
  startNewGame,
  setLastWorld,
  setLevelPosition,
  getLevelScreen,
  completeLevel,
  getScreenById,
  getScreenAt,
  indexOfScreen,
  tierSize,
  buyItem,
  consumeItem,
  markShopGone,
  FIRST_TIER,
} from "./db/db.js";
import {
  screenToLevelData,
  solvePath,
  nextMoveFrom,
  countSolutionsOfMinLength,
} from "./generator/generate-screens.js";

const PORT = Number(process.env.RUNIKA_PORT ?? 3000);
const ROOT = process.env.RUNIKA_ROOT ?? dirname(fileURLToPath(import.meta.url));
/** Datos escribibles del usuario (partida, ajustes). En la app instalada, fuera de resources/. */
const DATA_DIR = process.env.RUNIKA_DB_DIR ?? join(ROOT, "db");
const APP_VERSION = (() => {
  try {
    return (JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as { version?: string }).version ?? "0.0.0";
  } catch { return "0.0.0"; }
})();

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
  ".webp": "image/webp",
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

  // API: versión del juego (GET /api/version) — sale de package.json
  if (url === "/api/version") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ version: APP_VERSION }));
    return;
  }

  // API: estado de la partida guardada (GET /api/savegame)
  if (url === "/api/savegame") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ exists: hasSaveGame(), player: getPlayer() }));
    return;
  }

  // API: nueva partida (POST /api/new-game {name, avatar})
  if (url === "/api/new-game" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const data = JSON.parse(body || "{}") as { name?: string; avatar?: number };
        const p = startNewGame(String(data.name ?? ""), Number(data.avatar ?? 0));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, player: p }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
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

  // API: isla tienda de un submundo (GET /api/load-shop?world=XXX)
  if (url.startsWith("/api/load-shop")) {
    const u = new URL(url, "http://localhost");
    const world = u.searchParams.get("world") || "";
    const loadPath = join(ROOT, "assets", "submundos", world, "shop.json");
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: zonas calibradas del interior de tienda (GET /api/shop-areas?world=XXX)
  // OJO: la ruta no puede llamarse /api/load-shop-areas porque empezaría por
  // /api/load-shop y colisionaría con el handler de shop.json.
  if (url.startsWith("/api/shop-areas")) {
    const u = new URL(url, "http://localhost");
    const world = u.searchParams.get("world") || "";
    const loadPath = join(ROOT, "assets", "tienda", world, "areas.json");
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: guardar zonas de tienda (POST /api/save-shop-areas?world=XXX)
  if (url.startsWith("/api/save-shop-areas") && req.method === "POST") {
    const u = new URL(url, "http://localhost");
    const world = u.searchParams.get("world") || "";
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const dir = join(ROOT, "assets", "tienda", world);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "areas.json"), body, "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: catálogo de la tienda (GET /api/shop-items)
  if (url === "/api/shop-items") {
    const loadPath = join(ROOT, "assets", "tienda", "items.json");
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: compra (POST /api/buy-item {itemId}) — el precio se valida en
  // servidor desde items.json, nunca se confía en el cliente.
  if (url === "/api/buy-item" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", async () => {
      try {
        const itemId = String(JSON.parse(body || "{}")?.itemId ?? "");
        const catalog = JSON.parse(
          readFileSync(join(ROOT, "assets", "tienda", "items.json"), "utf-8"),
        ) as { items: Array<{ id: string; price: number; uses?: number; max?: number }> };
        const item = catalog.items.find(i => i.id === itemId);
        if (!item) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "unknown-item" }));
          return;
        }
        const result = buyItem(item.id, item.price, item.uses ?? 1, item.max ?? 1);
        res.writeHead(result.ok ? 200 : 409, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: consumir un uso del inventario (POST /api/consume-item {itemId})
  if (url === "/api/consume-item" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const itemId = String(JSON.parse(body || "{}")?.itemId ?? "");
        const result = consumeItem(itemId);
        res.writeHead(result.ok ? 200 : 409, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
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

  // API: guardar textos del mapamundi (POST /api/save-mapamundi-text-areas)
  if (url === "/api/save-mapamundi-text-areas" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const savePath = join(ROOT, "assets", "mapamundi", "text-areas.json");
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

  // API: cargar textos del mapamundi (GET /api/load-mapamundi-text-areas)
  if (url === "/api/load-mapamundi-text-areas") {
    const loadPath = join(ROOT, "assets", "mapamundi", "text-areas.json");
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
        const savePath = join(ROOT, "assets", "instrucciones", "instructions-areas.json");
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
    const loadPath = join(ROOT, "assets", "instrucciones", "instructions-areas.json");
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: guardar areas de creditos (POST /api/save-creditos-areas)
  if (url === "/api/save-creditos-areas" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const savePath = join(ROOT, "assets", "creditos", "creditos-areas.json");
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

  // API: cargar areas de creditos (GET /api/load-creditos-areas)
  if (url === "/api/load-creditos-areas") {
    const loadPath = join(ROOT, "assets", "creditos", "creditos-areas.json");
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: guardar areas de texto del modal (POST /api/save-modal-areas)
  // ?which=reintentar -> modal-reintentar-areas.json (modal de derrota)
  if (url.startsWith("/api/save-modal-areas") && req.method === "POST") {
    const u = new URL(url, "http://localhost");
    const modalFile = u.searchParams.get("which") === "reintentar"
      ? "modal-reintentar-areas.json" : "modal-areas.json";
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const savePath = join(ROOT, "assets", "comunes", modalFile);
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

  // API: cargar areas de texto del modal (GET /api/load-modal-areas)
  // ?which=reintentar -> modal-reintentar-areas.json (modal de derrota)
  if (url.startsWith("/api/load-modal-areas")) {
    const u = new URL(url, "http://localhost");
    const modalFile = u.searchParams.get("which") === "reintentar"
      ? "modal-reintentar-areas.json" : "modal-areas.json";
    const loadPath = join(ROOT, "assets", "comunes", modalFile);
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: guardar areas de la pantalla de configuracion (POST /api/save-config-areas)
  if (url === "/api/save-config-areas" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const savePath = join(ROOT, "assets", "configuracion", "config-areas.json");
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

  // API: cargar areas de configuracion (GET /api/load-config-areas)
  if (url === "/api/load-config-areas") {
    const loadPath = join(ROOT, "assets", "configuracion", "config-areas.json");
    if (!existsSync(loadPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: guardar areas del fin del juego (POST /api/save-fin-areas)
  if (url === "/api/save-fin-areas" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const savePath = join(ROOT, "assets", "comunes", "fin-areas.json");
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

  // API: cargar areas del fin del juego (GET /api/load-fin-areas)
  if (url === "/api/load-fin-areas") {
    const loadPath = join(ROOT, "assets", "comunes", "fin-areas.json");
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

  // API: ajustes globales (sound, music, lang) — db/settings.json
  const SETTINGS_PATH = join(DATA_DIR, "settings.json");
  const readSettings = () => {
    try {
      if (existsSync(SETTINGS_PATH)) {
        return { sound: true, music: true, lang: "es", ...JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")) };
      }
    } catch {}
    return { sound: true, music: true, lang: "es" };
  };
  if (url === "/api/settings" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(readSettings()));
    return;
  }
  if (url === "/api/settings" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const next = { ...readSettings(), ...JSON.parse(body) };
        if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
        writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, settings: next }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: archivo de idioma activo (GET /api/i18n) — usa settings.lang
  if (url === "/api/i18n") {
    const lang = readSettings().lang;
    const langPath = join(ROOT, "i18n", `${lang}.json`);
    const fallbackPath = join(ROOT, "i18n", "es.json");
    const file = existsSync(langPath) ? langPath : fallbackPath;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(file, "utf-8"));
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

  // API: manifiesto de TODOS los assets runtime (excluye carpetas "old *").
  // GET /api/assets-manifest → { images:[], sounds:[], music:[] } (rutas URL)
  if (url === "/api/assets-manifest") {
    const assetsRoot = join(ROOT, "assets");
    const files: string[] = [];
    const walk = (dir: string) => {
      if (!existsSync(dir)) return;
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) {
          if (/^old\b/i.test(e.name)) continue;
          walk(join(dir, e.name));
        } else {
          files.push(join(dir, e.name));
        }
      }
    };
    walk(assetsRoot);
    const toUrl = (p: string) => encodeURI("/assets" + p.slice(assetsRoot.length).replace(/\\/g, "/"));
    const rel = files.map(toUrl);
    const images = rel.filter((u) => /\.(webp|png|jpe?g)$/i.test(u));
    const music = rel.filter((u) => /\/music\//i.test(u) && /\.(mp3|wav|ogg)$/i.test(u));
    const sounds = rel.filter((u) => /\/sounds\//i.test(u) && /\.(mp3|wav|ogg)$/i.test(u));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, images, sounds, music }));
    return;
  }

  // API: última posición del jugador en el mapamundi (POST {world})
  if (url === "/api/map-position" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const player = setLastWorld(String(data.world ?? ""));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, player }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: última isla jugada de un mundo (POST {world, level})
  if (url === "/api/level-position" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const player = setLevelPosition(String(data.world ?? ""), Number(data.level) || 0);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, player }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: isla completada (POST {world, level, gold?, screenId?})
  if (url === "/api/level-complete" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const player = completeLevel(
          String(data.world ?? ""), Number(data.level) || 0,
          Number(data.gold) || 0, data.screenId ? String(data.screenId) : undefined,
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, player }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: la isla tienda desaparece al pasar de largo (POST {world})
  if (url === "/api/shop-skip" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const player = markShopGone(String(data.world ?? ""), Number(data.index) || 0);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, player }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // API: pantalla asignada a una isla del mapa (GET /api/level-screen?world=X&level=N)
  if (url.startsWith("/api/level-screen")) {
    const u = new URL(url, `http://localhost:${PORT}`);
    const world = u.searchParams.get("world") ?? "";
    const level = Number(u.searchParams.get("level") ?? "0") || 0;
    try {
      const { screen, tier } = getLevelScreen(world, level);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, screen, tier, world, level }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(e) }));
    }
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

  // API práctica: pantalla aleatoria de un tier, sin guardar nada en la bbdd
  // GET /api/practice-screen?tier=1
  if (url.startsWith("/api/practice-screen")) {
    const u = new URL(url, `http://localhost:${PORT}`);
    const tier = Math.max(FIRST_TIER, Number(u.searchParams.get("tier") ?? String(FIRST_TIER)) || FIRST_TIER);
    const screen = getRandomScreenByTier(tier);
    res.writeHead(screen ? 200 : 404, { "Content-Type": "application/json" });
    res.end(JSON.stringify(screen ? { ok: true, screen, tier } : { ok: false, error: "Tier sin pantallas" }));
    return;
  }

  // ── API consola de hacks: navegar el banco, resolver y pedir pistas ────────

  // GET /api/screen?id=l7-s12  |  ?tier=7&index=12
  if (url.startsWith("/api/screen") && !url.startsWith("/api/screen-nav")) {
    const u = new URL(url, `http://localhost:${PORT}`);
    const id = u.searchParams.get("id");
    const tier = u.searchParams.get("tier");
    const index = u.searchParams.get("index");
    const screen = id
      ? getScreenById(id)
      : tier !== null && index !== null
        ? getScreenAt(Number(tier) || 0, Number(index) || 0)
        : null;
    res.writeHead(screen ? 200 : 404, { "Content-Type": "application/json" });
    res.end(JSON.stringify(screen ? { ok: true, screen } : { ok: false, error: "Pantalla no encontrada" }));
    return;
  }

  // GET /api/screen-nav?id=l7-s12&dir=next|prev → pantalla adyacente en el banco de su tier
  if (url.startsWith("/api/screen-nav")) {
    const u = new URL(url, `http://localhost:${PORT}`);
    const id = u.searchParams.get("id") ?? "";
    const dir = u.searchParams.get("dir") === "prev" ? -1 : 1;
    const cur = getScreenById(id);
    const idx = cur ? indexOfScreen(cur) : -1;
    const screen = cur && idx >= 0 ? getScreenAt(cur.level, idx + dir) : null;
    res.writeHead(screen ? 200 : 404, { "Content-Type": "application/json" });
    res.end(JSON.stringify(screen ? { ok: true, screen } : { ok: false, error: "Sin pantalla adyacente" }));
    return;
  }

  // GET /api/tier-size?tier=7 → tamaño del banco
  if (url.startsWith("/api/tier-size")) {
    const u = new URL(url, `http://localhost:${PORT}`);
    const tier = Number(u.searchParams.get("tier") ?? "0") || 0;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, tier, size: tierSize(tier) }));
    return;
  }

  // GET /api/solve-screen?id=l7-s12 → solución BFS del puzzle
  // {ok, par, trueMin, sols:[n_par,n_par-1,n_par-2], moves:[[dc,dr]…], path:[[c,r]…]}
  if (url.startsWith("/api/solve-screen")) {
    const u = new URL(url, `http://localhost:${PORT}`);
    const screen = getScreenById(u.searchParams.get("id") ?? "");
    if (!screen) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Pantalla no encontrada" }));
      return;
    }
    const lv = screenToLevelData(screen);
    const sol = solvePath(lv);
    const path = sol.solvable && sol.path ? sol.path : null;
    const par = screen.par ?? sol.length ?? 0;
    const sols = screen.sols ?? (sol.solvable
      ? [par, par - 1, par - 2].map((len) => countSolutionsOfMinLength(lv, len))
      : null);
    const moves: Array<[number, number]> = [];
    const cells: Array<[number, number]> = [];
    if (path) {
      for (const idx of path) cells.push([idx % 8, Math.floor(idx / 8)]);
      for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1]!;
        const cur = path[i]!;
        if (cur !== prev) moves.push([(cur % 8) - (prev % 8), Math.floor(cur / 8) - Math.floor(prev / 8)]);
      }
    }
    res.writeHead(path ? 200 : 404, { "Content-Type": "application/json" });
    res.end(JSON.stringify(path
      ? { ok: true, par, trueMin: screen.trueMin ?? sol.length, sols, moves, path: cells }
      : { ok: false, error: "Sin solución" }));
    return;
  }

  // GET /api/hint?id=…&p=c,r&e=c,r,c,r&ps=0&es=0,0 → siguiente movimiento desde el estado actual
  if (url.startsWith("/api/hint")) {
    const u = new URL(url, `http://localhost:${PORT}`);
    const screen = getScreenById(u.searchParams.get("id") ?? "");
    const parsePair = (s: string | null): [number, number] | null => {
      const m = s?.match(/^(-?\d+),(-?\d+)$/);
      return m ? [Number(m[1]), Number(m[2])] : null;
    };
    const p = parsePair(u.searchParams.get("p"));
    const eRaw = (u.searchParams.get("e") ?? "")
      .split(";")
      .map(parsePair)
      .filter((e): e is [number, number] => e !== null);
    const ps = Number(u.searchParams.get("ps") ?? "0") || 0;
    const es = (u.searchParams.get("es") ?? "").split(",").map((n) => Number(n) || 0);
    if (!screen || !p) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Parámetros inválidos" }));
      return;
    }
    const lv = screenToLevelData(screen);
    const idx = (cr: [number, number]) => cr[1] * 8 + cr[0];
    const move = nextMoveFrom(lv, { p: idx(p), e: eRaw.map(idx), s: es, ps });
    res.writeHead(move ? 200 : 404, { "Content-Type": "application/json" });
    res.end(JSON.stringify(move ? { ok: true, move: [move.dc, move.dr], remaining: move.remaining } : { ok: false, error: "Sin ruta desde aquí" }));
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
        .map((f) => {
          const stem = f.replace(/\.[^.]+$/, "");
          return existsSync(join(ROOT, "assets", "obstaculos", "display", world, `${stem}.webp`))
            ? `/assets/obstaculos/display/${world}/${encodeURIComponent(stem)}.webp`
            : `/assets/obstaculos/${world}/${encodeURIComponent(f)}`;
        });
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, world, images }));
    return;
  }

  // API: assets de sprites del tablero por mundo (GET /api/board-sprites-assets?world=XXX)
  // Devuelve las imágenes disponibles de avatar/enemigo/boss/trampa + áreas del tablero.
  if (url.startsWith("/api/board-sprites-assets")) {
    const u = new URL(url, `http://localhost:${PORT}`);
    const world = u.searchParams.get("world") ?? "";
    const det = detections.find((d) => d.world === world);
    if (!det) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Mundo no encontrado" }));
      return;
    }
    const isImg = (f: string) => /\.(png|jpg|jpeg|webp)$/i.test(f);
    // Preferir el derivado ligero display/<stem>.webp si existe (regla a fuego:
    // las pantallas no pintan masters 8K en el hot path)
    const list = (folder: string, sub: string): string[] =>
      existsSync(folder)
        ? readdirSync(folder)
            .filter(isImg)
            .sort()
            .map((f) => {
              const stem = f.replace(/\.[^.]+$/, "");
              const parts = sub.split("/");
              const cat = parts[0] ?? "";
              const w = parts[1] ?? "";
              return existsSync(join(ROOT, "assets", cat, "display", w, `${stem}.webp`))
                ? `/assets/${cat}/display/${w}/${encodeURIComponent(stem)}.webp`
                : `/assets/${sub}/${encodeURIComponent(f)}`;
            })
        : [];
    const trapSub = world === "VIENTO" ? "trampas/AIRE" : `trampas/${world}`;
    const salidaWorld = world;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        world,
        background: `/assets/backgrounds/${world}/bg_01.webp`,
        boardArea: det.boardArea,
        avatarArea: det.avatarArea ?? det.boardArea,
        width: det.width,
        height: det.height,
        avatar: Array.from({ length: 8 }, (_, i) => `/assets/avatars/display/avatar_0${i + 1}.webp`),
        enemy: list(join(ROOT, "assets", "enemys", world), `enemys/${world}`),
        boss: list(join(ROOT, "assets", "bosses", world), `bosses/${world}`),
        trap: list(join(ROOT, "assets", "trampas", world === "VIENTO" ? "AIRE" : world), trapSub),
        exit: list(join(ROOT, "assets", "salida", salidaWorld), `salida/${salidaWorld}`),
        obstacle: list(join(ROOT, "assets", "obstaculos", world), `obstaculos/${world}`),
      })
    );
    return;
  }

  // API: guardar calibración de sprites del tablero (POST /api/save-board-sprites?world=XXX)
  if (url.startsWith("/api/save-board-sprites") && req.method === "POST") {
    const u = new URL(url, `http://localhost:${PORT}`);
    const world = u.searchParams.get("world") ?? "";
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const savePath = join(ROOT, "assets", "backgrounds", world, "sprites.json");
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

  // API: cargar calibración de sprites del tablero (GET /api/load-board-sprites?world=XXX)
  // Sin calibración guardada devuelve 200 con valores por defecto (sin ruido en consola).
  if (url.startsWith("/api/load-board-sprites")) {
    const u = new URL(url, `http://localhost:${PORT}`);
    const world = u.searchParams.get("world") ?? "";
    const loadPath = join(ROOT, "assets", "backgrounds", world, "sprites.json");
    if (!existsSync(loadPath)) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, world, global: { offsetX: 0, offsetY: 0, scale: 1 } }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // API: guardar áreas de texto del tablero (POST /api/save-board-text-areas?world=XXX)
  if (url.startsWith("/api/save-board-text-areas") && req.method === "POST") {
    const u = new URL(url, `http://localhost:${PORT}`);
    const world = u.searchParams.get("world") ?? "";
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try {
        const savePath = join(ROOT, "assets", "backgrounds", world, "text-areas.json");
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

  // API: cargar áreas de texto del tablero (GET /api/load-board-text-areas?world=XXX)
  if (url.startsWith("/api/load-board-text-areas")) {
    const u = new URL(url, `http://localhost:${PORT}`);
    const world = u.searchParams.get("world") ?? "";
    const loadPath = join(ROOT, "assets", "backgrounds", world, "text-areas.json");
    if (!existsSync(loadPath)) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, world }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(readFileSync(loadPath, "utf-8"));
    return;
  }

  // Archivos estáticos (ignorar query string y decodificar %20 etc.)
  const cleanUrl = url.split("?")[0] ?? "/";
  let filePath = cleanUrl === "/" ? "/menu.html" : decodeURIComponent(cleanUrl);
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
  // No cachear código/datos (JSON, HTML, JS, CSS) para que los cambios
  // surtan efecto inmediatamente y nunca se sirva un script desfasado
  if (ext === ".json" || ext === ".html" || ext === ".js" || ext === ".css") {
    headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
  }
  res.writeHead(200, headers);
  createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`\n  Servidor de Runika 2D`);
  console.log(`  → http://localhost:${PORT}\n`);
  console.log(`  ${detections.length} mundos disponibles:`);
  detections.forEach((d, i) => console.log(`    ${i + 1}. ${d.world}`));
  console.log(`\n  Controles: Espacio = siguiente mundo · Flechas = mover selector\n`);
});

