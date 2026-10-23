/**
 * build-android.mjs — prepara android-app/www con el juego autónomo.
 *
 *   node tools/build-android.mjs   (ejecuta antes build-tizen si hace falta)
 *
 * Reutiliza webdist/ (misma app autónoma que la TV), inyecta cordova.js en
 * las páginas y deja el www listo para `cordova build android`.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEBDIST = join(ROOT, "webdist");
const APP = join(ROOT, "android-app");
const WWW = join(APP, "www");

// 1. Asegurar webdist fresco (si no existe, lo genera)
if (!existsSync(WEBDIST)) {
  execSync("node tools/build-tizen.mjs", { cwd: ROOT, stdio: "inherit" });
}

// 2. www = webdist sin config.xml (Cordova usa la suya propia en la raíz)
rmSync(WWW, { recursive: true, force: true });
mkdirSync(WWW, { recursive: true });
cpSync(WEBDIST, WWW, { recursive: true });
rmSync(join(WWW, "config.xml"), { force: true });

// 3. Inyectar cordova.js antes del resto de scripts en cada página
for (const f of readdirSync(WWW)) {
  if (!f.endsWith(".html")) continue;
  const p = join(WWW, f);
  let s = readFileSync(p, "utf8");
  if (!s.includes("cordova.js")) {
    s = s.replace("<head>", '<head>\n<script src="cordova.js"></script>');
    writeFileSync(p, s);
  }
}

// 4. Recursos de icono
const resDir = join(APP, "res");
mkdirSync(resDir, { recursive: true });
for (const f of ["icon.png", "icon-foreground.png", "icon-background.png"]) {
  const src = join(ROOT, "android-res", f);
  if (existsSync(src)) copyFileSync(src, join(resDir, f));
}

// 5. Móvil: reescalar imágenes pesadas dentro de www. Los masters son
// 8-10K (bg 7680x4320, menús 9102x5120, monedas.webp 7680² para un icono
// de 30px): cada bitmap decodificado son ~130-235 MB y el WebView mata el
// renderer por OOM → pantalla negra al entrar al tablero. Las coordenadas
// calibradas son normalizadas (0-1), así que reducir el bitmap no rompe
// nada. Límites por clase:
//   - escenas/fondos/menús/modales: 1920px máx (la TV/móvil renderizan a
//     1080p: 2560 era memoria de raster desperdiciada y decodificación
//     más lenta — casi la mitad de coste sin diferencia visible)
//   - sprites/variantes display:    1536px máx (ocupan 1-2 casillas)
//   - iconos puros (monedas…):      768px máx
const { default: sharp } = await import("sharp");
const IMG_RE = /\.(webp|png|jpe?g)$/i;
const ICON_CAP = new Map([
  ["assets/comunes/monedas.webp", 768],
  ["assets/comunes/calavera.webp", 768],
]);
const isSpritePath = (rel) =>
  /assets[\\/](avatars|enemys|bosses|obstaculos|salida|trampas|bonus)[\\/]/i.test(rel) ||
  /[\\/]display[\\/]/i.test(rel);

async function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (IMG_RE.test(e.name)) yield p;
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let shrunk = 0, kept = 0, failed = 0;
for await (const abs of walk(join(WWW, "assets"))) {
  const rel = abs.slice(WWW.length + 1);
  const cap = ICON_CAP.get(rel.replaceAll("\\", "/")) ?? (isSpritePath(rel) ? 1536 : 1920);
  // sharp(abs) mantiene el archivo mapeado en Windows y luego no deja
  // sobrescribirlo — se lee a buffer primero para que no quede handle.
  let done = false;
  for (let attempt = 0; attempt < 4 && !done; attempt++) {
    try {
      const input = readFileSync(abs);
      const meta = await sharp(input).metadata();
      const m = Math.max(meta.width, meta.height);
      if (m <= cap) { kept++; done = true; break; }
      const scale = cap / m;
      const w = Math.round(meta.width * scale), h = Math.round(meta.height * scale);
      const buf = await sharp(input).resize(w, h).toBuffer();
      writeFileSync(abs, buf);
      shrunk++;
      console.log(`  ↓ ${rel} ${meta.width}x${meta.height} → ${w}x${h}`);
      done = true;
    } catch (e) {
      if (attempt === 3) {
        failed++;
        console.warn(`  ⚠ no se pudo reescalar ${rel}: ${e.message}`);
      } else await sleep(300 * (attempt + 1));
    }
  }
}
if (failed) console.warn(`⚠ ${failed} imágenes no se pudieron reescalar`);
console.log(`imágenes www: ${shrunk} reescaladas, ${kept} ya cabían`);

console.log("android-app/www listo — siguiente: npx cordova platform add android && npx cordova build android");
