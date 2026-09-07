/**
 * CLI offline para analizar todas las imágenes de `assets/backgrounds/<MUNDO>/`
 * y generar sus `BackgroundTemplate` (docs/02-MOTOR-GRAFICO.md §1 + 10).
 *
 * Uso:
 *   npx tsx background/cli.ts [--provider mock|http] [--out worlds/templates]
 *
 * - `--provider mock`: usa MockVisionProvider con plantillas preconfiguradas
 *   (para desarrollo sin clave API).
 * - `--provider http`: usa HttpVisionProvider con config desde env vars
 *   (VISION_ENDPOINT, VISION_MODEL, VISION_API_KEY, VISION_NAME).
 *
 * Para cada imagen:
 *   1. La lee como bytes.
 *   2. Llama al analizador.
 *   3. Si pasa sanidad, guarda `<world>/<id>.json` en `--out`.
 *   4. Si needsHumanReview, marca el JSON con un campo `_review: true`.
 *   5. Imprime un resumen por consola.
 *
 * Este CLI es una herramienta de pipeline (offline), no corre en partida.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AnalysisResult,
  DEFAULT_ANALYZER_OPTIONS,
  analyzeBackground,
} from "./analyzer.js";
import {
  HttpVisionProvider,
  HttpVisionProviderConfig,
  MockVisionProvider,
  VisionProvider,
} from "./vision-provider.js";
import { backgroundTemplateCandidateExample } from "../schemas/examples.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

interface CliArgs {
  provider: "mock" | "http";
  outDir: string;
  backgroundsDir: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    provider: "mock",
    outDir: path.join(PROJECT_ROOT, "worlds", "templates"),
    backgroundsDir: path.join(PROJECT_ROOT, "assets", "backgrounds"),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--provider") args.provider = (argv[++i] as "mock" | "http") ?? args.provider;
    else if (a === "--out") args.outDir = argv[++i] ?? args.outDir;
    else if (a === "--backgrounds") args.backgroundsDir = argv[++i] ?? args.backgroundsDir;
  }
  return args;
}

function buildProvider(name: "mock" | "http"): VisionProvider {
  if (name === "mock") {
    return new MockVisionProvider(backgroundTemplateCandidateExample);
  }
  const endpoint = process.env.VISION_ENDPOINT;
  const model = process.env.VISION_MODEL;
  const apiKey = process.env.VISION_API_KEY;
  if (!endpoint || !model) {
    throw new Error(
      "Para --provider http hace falta VISION_ENDPOINT y VISION_MODEL (y VISION_API_KEY si aplica) en env.",
    );
  }
  const cfg: HttpVisionProviderConfig = {
    name: process.env.VISION_NAME ?? "http-vision",
    endpoint,
    model,
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    temperature: 0,
    maxTokens: 2048,
  };
  return new HttpVisionProvider(cfg);
}

function mimeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

async function listImages(root: string): Promise<Array<{ world: string; file: string; abs: string }>> {
  const { readdir } = await import("node:fs/promises");
  const out: Array<{ world: string; file: string; abs: string }> = [];
  const worlds = await readdir(root, { withFileTypes: true });
  for (const w of worlds) {
    if (!w.isDirectory()) continue;
    const worldDir = path.join(root, w.name);
    const files = await readdir(worldDir, { withFileTypes: true });
    for (const f of files) {
      if (!f.isFile()) continue;
      const ext = path.extname(f.name).toLowerCase();
      if (ext === ".png" || ext === ".jpg" || ext === ".jpeg" || ext === ".webp") {
        out.push({ world: w.name, file: f.name, abs: path.join(worldDir, f.name) });
      }
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.backgroundsDir)) {
    console.error(`No existe ${args.backgroundsDir}`);
    process.exit(1);
  }
  const provider = buildProvider(args.provider);
  const images = await listImages(args.backgroundsDir);
  if (images.length === 0) {
    console.error(`No se encontraron imágenes en ${args.backgroundsDir}`);
    process.exit(1);
  }
  console.error(`Analizando ${images.length} fondo(s) con provider "${provider.name}"...`);

  const results: AnalysisResult[] = [];
  for (const img of images) {
    const bytes = new Uint8Array(await readFile(img.abs));
    const imageId = img.file.replace(/\.[^.]+$/, "").toUpperCase().replace(/\s+/g, "_");
    const relPath = path.relative(PROJECT_ROOT, img.abs).replace(/\\/g, "/");
    try {
      const result = await analyzeBackground(
        { bytes, mime: mimeFor(img.file), filename: relPath },
        img.world,
        imageId,
        provider,
        DEFAULT_ANALYZER_OPTIONS,
      );
      results.push(result);
      const status = result.accepted
        ? result.needsHumanReview
          ? "ACEPTADA (revisión humana recomendada)"
          : "ACEPTADA"
        : "RECHAZADA";
      console.error(`  [${status}] ${img.world}/${img.file} (confidence=${result.candidate.confidence.toFixed(2)})`);
      if (!result.sanity.ok) {
        for (const [k, v] of Object.entries(result.sanity.checks)) {
          if (!v.ok) console.error(`      ✗ ${k}: ${v.reason}`);
        }
      }
      if (result.accepted && result.template) {
        const outDir = path.join(args.outDir, img.world);
        await mkdir(outDir, { recursive: true });
        const outPath = path.join(outDir, `${result.template.id}.json`);
        const payload = {
          ...result.template,
          ...(result.needsHumanReview ? { _review: true, _confidence: result.candidate.confidence } : {}),
        };
        await writeFile(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
        console.error(`      → guardado ${path.relative(PROJECT_ROOT, outPath)}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  [ERROR] ${img.world}/${img.file}: ${msg}`);
    }
  }

  const accepted = results.filter((r) => r.accepted).length;
  const review = results.filter((r) => r.needsHumanReview).length;
  console.error(`\nResumen: ${accepted}/${results.length} aceptadas, ${review} requieren revisión humana.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
