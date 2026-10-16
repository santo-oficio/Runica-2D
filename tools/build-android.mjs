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

console.log("android-app/www listo — siguiente: npx cordova platform add android && npx cordova build android");
