/**
 * build-tizen.mjs — prepara webdist/ con todo lo necesario para el .wgt de Tizen.
 *
 *   node tools/build-tizen.mjs
 *
 * Copia páginas de juego + assets + i18n + bancos + web/ y pre-genera los
 * JSONs que el servidor calcula en runtime (manifest, detecciones de mundo,
 * listas de sprites). Después se firma/empaqueta con la CLI de Tizen:
 *   tizen package -t wgt -s <perfil> -- webdist
 */
import { readdirSync, existsSync, mkdirSync, cpSync, copyFileSync, writeFileSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "webdist");
const WORLDS = ["ESPACIO", "AGUA", "TIERRA", "FUEGO", "HIELO", "VIENTO", "INFRAMUNDO", "MAZMORRA"];

const PAGES = [
  "menu.html", "seleccion-personaje.html", "mapamundi.html", "submundo.html",
  "game.html", "ajustes.html", "instructions.html", "creditos.html",
  "exit.html", "fin.html",
  "assets-cache.js", "final-battle.js",
];

// ── Limpieza ───────────────────────────────────────────────────────────────
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// ── Copias ─────────────────────────────────────────────────────────────────
for (const f of PAGES) copyFileSync(join(ROOT, f), join(OUT, f));
cpSync(join(ROOT, "assets"), join(OUT, "assets"), { recursive: true });
cpSync(join(ROOT, "i18n"), join(OUT, "i18n"), { recursive: true });
cpSync(join(ROOT, "web"), join(OUT, "web"), { recursive: true });
mkdirSync(join(OUT, "db"), { recursive: true });
for (const f of readdirSync(join(ROOT, "db"))) {
  if (/^screens-tier-\d+\.json$/.test(f)) copyFileSync(join(ROOT, "db", f), join(OUT, "db", f));
}

// ── web/manifest.json (misma lógica que /api/assets-manifest) ──────────────
const images = [], sounds = [], music = [];
(function walk(dir, rel) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (/^old\b/i.test(e.name)) continue;
      walk(join(dir, e.name), `${rel}/${e.name}`);
    } else {
      images.push(`/assets${rel}/${e.name}`);
    }
  }
})(join(ROOT, "assets"), "");
const allFiles = images.slice();
const imgs = allFiles.filter((u) => /\.(webp|png|jpe?g)$/i.test(u));
const mus = allFiles.filter((u) => /\/music\//i.test(u) && /\.(mp3|wav|ogg)$/i.test(u));
const snd = allFiles.filter((u) => /\/sounds\//i.test(u) && /\.(mp3|wav|ogg)$/i.test(u));
writeFileSync(join(OUT, "web", "manifest.json"),
  JSON.stringify({ ok: true, images: imgs, sounds: snd, music: mus }));

// ── web/detections.json (= /api/worlds) ────────────────────────────────────
const detections = [];
for (const w of WORLDS) {
  const p = join(ROOT, "assets", "backgrounds", w, "board-detection.json");
  if (existsSync(p)) detections.push(JSON.parse(readFileSync(p, "utf-8")));
}
writeFileSync(join(OUT, "web", "detections.json"), JSON.stringify(detections));

// ── web/sprite-assets.json (= /api/board-sprites-assets por mundo) ─────────
const isImg = (f) => /\.(png|jpg|jpeg|webp)$/i.test(f);
const spriteAssets = {};
for (const det of detections) {
  const world = det.world;
  const list = (folder, sub) => {
    if (!existsSync(folder)) return [];
    return readdirSync(folder).filter(isImg).sort().map((f) => {
      const stem = f.replace(/\.[^.]+$/, "");
      const [cat, w] = sub.split("/");
      return existsSync(join(ROOT, "assets", cat, "display", w, `${stem}.webp`))
        ? `/assets/${cat}/display/${w}/${encodeURIComponent(stem)}.webp`
        : `/assets/${sub}/${encodeURIComponent(f)}`;
    });
  };
  const trapSub = world === "VIENTO" ? "trampas/AIRE" : `trampas/${world}`;
  spriteAssets[world] = {
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
    exit: list(join(ROOT, "assets", "salida", world), `salida/${world}`),
    obstacle: list(join(ROOT, "assets", "obstaculos", world), `obstaculos/${world}`),
  };
}
writeFileSync(join(OUT, "web", "sprite-assets.json"), JSON.stringify(spriteAssets));

// ── config.xml + index.html + icono ────────────────────────────────────────
writeFileSync(join(OUT, "config.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns="http://www.w3.org/ns/widgets" xmlns:tizen="http://tizen.org/ns/widgets" id="http://runika2d/game" version="1.0.0" viewmodes="maximized">
    <tizen:application id="Runika2D.runika" package="Runika2D" required_version="2.3"/>
    <content src="index.html"/>
    <icon src="icon.png"/>
    <name>Runika 2D</name>
    <access origin="*" subdomains="true"/>
    <tizen:privilege name="http://tizen.org/privilege/tvinputdevice.manager"/>
    <tizen:setting screen-orientation="landscape" context-menu="disable" background-support="disable" encryption="disable" hwkey-event="enable"/>
</widget>
`);
writeFileSync(join(OUT, "index.html"), `<!DOCTYPE html><html><head><meta charset="utf-8"><script>location.replace("menu.html");</script></head><body></body></html>\n`);

// Icono PNG (generado con PIL desde calavera.webp: web/icon.png)
const iconSrc = join(ROOT, "web", "icon.png");
if (existsSync(iconSrc)) copyFileSync(iconSrc, join(OUT, "icon.png"));

const size = (d) => readdirSync(d, { withFileTypes: true }).reduce((t, e) =>
  t + (e.isDirectory() ? size(join(d, e.name)) : statSync(join(d, e.name)).size), 0);
console.log(`webdist/ listo — ${(size(OUT) / 1048576).toFixed(0)} MB`);
console.log("Siguiente: tizen package -t wgt -s <perfil> --", OUT);
