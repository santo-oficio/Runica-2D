/**
 * Cliente de la API de Stable Diffusion (Automatic1111).
 *
 * Se conecta a localhost:7860 (Automatic1111 con --api).
 * Permite generar imágenes programáticamente desde nuestro pipeline.
 *
 * Tipos de imágenes que genera:
 *  - Fondos panorámicos 1920x1080 con área central despejada para el tablero.
 *  - Tiles del tablero (suelo, paredes, bordes, esquinas).
 *  - Sprites de entidades (jugador, enemigos, objetivo, llaves, puertas).
 *  - Elementos de HUD y marco.
 */

import type { BackgroundTemplate, WorldConfig } from "../schemas/types.js";

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

/** URL base de la API de Automatic1111. */
export const SD_API_URL = "http://localhost:7860";

/** Resolución de generación (16:9 panorámico). */
export const GEN_WIDTH = 1920;
export const GEN_HEIGHT = 1080;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Respuesta de la API de SD (txt2img). */
interface SdTxt2ImgResponse {
  images: string[]; // base64
  parameters: Record<string, unknown>;
  info: string;
}

/** Parámetros de generación. */
export interface GenerationParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfgScale?: number;
  sampler?: string;
  seed?: number;
  batchSize?: number;
}

/** Resultado de generación (imagen en base64 + metadata). */
export interface GenerationResult {
  imageBase64: string;
  seed: number;
  info: string;
}

// ---------------------------------------------------------------------------
// Cliente HTTP
// ---------------------------------------------------------------------------

/**
 * Comprueba si Automatic1111 está corriendo y accesible.
 */
export async function isSdRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${SD_API_URL}/sdapi/v1/options`, {
      signal: new AbortController().signal,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Genera una imagen con Stable Diffusion via txt2img.
 * @param params Parámetros de generación.
 * @returns GenerationResult con la imagen en base64.
 */
export async function generateImage(
  params: GenerationParams,
): Promise<GenerationResult> {
  const payload = {
    prompt: params.prompt,
    negative_prompt: params.negativePrompt ?? "",
    width: params.width ?? GEN_WIDTH,
    height: params.height ?? GEN_HEIGHT,
    steps: params.steps ?? 30,
    cfg_scale: params.cfgScale ?? 7,
    sampler_name: params.sampler ?? "DPM++ 2M Karras",
    seed: params.seed ?? -1,
    batch_size: params.batchSize ?? 1,
  };

  const res = await fetch(`${SD_API_URL}/sdapi/v1/txt2img`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`SD API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as SdTxt2ImgResponse;
  if (!data.images || data.images.length === 0) {
    throw new Error("SD API no devolvió imágenes");
  }

  // Parsear la info para extraer la seed usada
  let seed = -1;
  try {
    const info = JSON.parse(data.info);
    seed = info.seed ?? -1;
  } catch {
    // info puede ser string JSON o no
  }

  return {
    imageBase64: data.images[0]!,
    seed,
    info: data.info,
  };
}

/**
 * Guarda una imagen base64 en disco.
 */
export async function saveImage(
  imageBase64: string,
  outputPath: string,
): Promise<void> {
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const { dirname } = await import("node:path");
  mkdirSync(dirname(outputPath), { recursive: true });
  const buffer = Buffer.from(imageBase64, "base64");
  writeFileSync(outputPath, buffer);
}

// ---------------------------------------------------------------------------
// Prompts predefinidos por tipo de asset
// ---------------------------------------------------------------------------

/**
 * Prompt para generar un fondo de mundo con área central despejada.
 * El tablero se proyectará en el centro, por lo que el prompt le dice a SD
 * que mantenga el centro oscuro/vacío y ponga la decoración en los bordes.
 */
export function backgroundPrompt(world: string, variant: number): { prompt: string; negativePrompt: string } {
  const worldThemes: Record<string, string> = {
    ESPACIO: "deep space nebula, stars, galaxies, cosmic dust, sci-fi atmosphere, dark center with empty void, decorative borders with planets and space stations",
    FUEGO: "volcanic landscape, lava flows, molten rock, fire embers, dark center with scorched earth, decorative borders with flames and volcanic rocks",
    HIELO: "frozen tundra, ice crystals, snow, aurora borealis, dark center with frozen ground, decorative borders with ice formations and snow",
    INFRAMUNDO: "underworld, dark realm, ghostly spirits, purple mist, dark center with empty void, decorative borders with skeletal trees and souls",
    TIERRA: "lush forest, ancient ruins, mossy stones, green foliage, dark center with clearing, decorative borders with trees and vines",
    VIENTO: "windy sky, clouds, floating islands, storm, dark center with calm air, decorative borders with swirling clouds and birds",
    MAZMORRA: "dark castle, throne room, gothic architecture, dark center with empty floor, decorative borders with pillars and banners",
  };

  const theme = worldThemes[world] ?? worldThemes["ESPACIO"]!;

  return {
    prompt: `pixel art game background, ${theme}, panoramic 16:9, high quality, detailed, retro game style, variant ${variant}, central area empty and dark for game board, decoration only on edges and corners`,
    negativePrompt: "text, watermark, UI, hud, grid, board, game pieces, characters, blurry, low quality, distorted, central elements, objects in center",
  };
}

/**
 * Prompt para generar un tile de suelo.
 */
export function tilePrompt(world: string, tileType: string): { prompt: string; negativePrompt: string } {
  const worldStyles: Record<string, string> = {
    ESPACIO: "sci-fi metal floor, space station, futuristic tiles",
    FUEGO: "volcanic rock floor, cracked lava stone, scorched earth",
    HIELO: "frozen ice floor, frost crystals, snowy ground",
    INFRAMUNDO: "dark stone floor, ghostly tiles, underworld ground",
    TIERRA: "mossy stone floor, earthy ground, forest clearing",
    VIENTO: "cloud floor, airy stone, wind-swept ground",
    MAZMORRA: "castle stone floor, gothic tiles, dark dungeon",
  };

  const style = worldStyles[world] ?? worldStyles["ESPACIO"]!;

  const tileDescriptions: Record<string, string> = {
    floor: "flat floor tile, seamless, top-down view",
    wallEdgeTop: "wall edge top, vertical face, top-down view",
    wallCornerTopLeft: "wall corner top-left, L-shaped, top-down view",
    wallCornerTopRight: "wall corner top-right, L-shaped, top-down view",
    wallEdgeBottom: "wall edge bottom, vertical face, top-down view",
    wallEdgeLeft: "wall edge left, vertical face, top-down view",
    wallEdgeRight: "wall edge right, vertical face, top-down view",
    obstacle: "obstacle rock, blocking object, top-down view",
  };

  const desc = tileDescriptions[tileType] ?? "game tile, top-down view";

  return {
    prompt: `pixel art game tile, ${desc}, ${style}, 64x64, seamless, clean, retro game asset`,
    negativePrompt: "text, watermark, UI, hud, blurry, distorted, multiple tiles, grid lines",
  };
}

/**
 * Prompt para generar un sprite de entidad.
 */
export function spritePrompt(world: string, entityType: string): { prompt: string; negativePrompt: string } {
  const worldStyles: Record<string, string> = {
    ESPACIO: "sci-fi, space suit, futuristic",
    FUEGO: "fire theme, molten, volcanic",
    HIELO: "ice theme, frozen, crystalline",
    INFRAMUNDO: "ghostly, dark, spectral",
    TIERRA: "nature, forest, earthy",
    VIENTO: "windy, airy, cloud",
    MAZMORRA: "gothic, dark, castle",
  };

  const style = worldStyles[world] ?? worldStyles["ESPACIO"]!;

  const entityDescriptions: Record<string, string> = {
    player: "hero character, small, cute, facing forward, top-down view, idle pose",
    enemyDefault: "enemy creature, small, menacing, top-down view",
    enemyPatrol: "patrol enemy, guard creature, top-down view",
    enemyChase: "chase enemy, predator creature, aggressive, top-down view",
    enemyRandom: "random enemy, chaotic creature, top-down view",
    enemyVigilance: "vigilance enemy, watcher creature, eye, top-down view",
    goal: "goal portal, glowing exit, sparkle, top-down view",
    key: "small key item, golden, shiny, top-down view",
    door: "door tile, closed door, top-down view",
  };

  const desc = entityDescriptions[entityType] ?? "game sprite, top-down view";

  return {
    prompt: `pixel art game sprite, ${desc}, ${style}, 64x64, transparent background, clean, retro game asset, centered`,
    negativePrompt: "text, watermark, UI, hud, blurry, distorted, multiple characters, background scenery",
  };
}

// ---------------------------------------------------------------------------
// Pipeline completo: generar todos los assets de un mundo
// ---------------------------------------------------------------------------

export interface WorldAssetGenerationResult {
  backgrounds: string[]; // rutas de los fondos generados
  tiles: string[]; // rutas de los tiles generados
  sprites: string[]; // rutas de los sprites generados
  errors: string[];
}

/**
 * Genera todos los assets visuales de un mundo con Stable Diffusion.
 *
 * @param world WorldConfig del mundo.
 * @param outputDir Directorio base de salida (ej: "assets/generated/ESPACIO").
 * @param bgCount Número de fondos a generar.
 * @param seedBase Seed base para reproducibilidad.
 */
export async function generateWorldAssets(
  world: WorldConfig,
  outputDir: string,
  bgCount = 2,
  seedBase = 42,
): Promise<WorldAssetGenerationResult> {
  const backgrounds: string[] = [];
  const tiles: string[] = [];
  const sprites: string[] = [];
  const errors: string[] = [];

  // 1. Fondos panorámicos
  for (let i = 0; i < bgCount; i++) {
    try {
      const { prompt, negativePrompt } = backgroundPrompt(world.world, i + 1);
      const result = await generateImage({
        prompt,
        negativePrompt,
        width: GEN_WIDTH,
        height: GEN_HEIGHT,
        steps: 30,
        cfgScale: 7,
        seed: seedBase + i,
      });
      const path = `${outputDir}/backgrounds/bg_${i + 1}.png`;
      await saveImage(result.imageBase64, path);
      backgrounds.push(path);
      console.log(`  ✓ Fondo ${i + 1}/${bgCount} generado (seed: ${result.seed})`);
    } catch (e) {
      errors.push(`fondo ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 2. Tiles
  const tileTypes = [
    "floor", "wallEdgeTop", "wallCornerTopLeft", "wallCornerTopRight",
    "wallEdgeBottom", "wallEdgeLeft", "wallEdgeRight", "obstacle",
  ];
  for (let i = 0; i < tileTypes.length; i++) {
    const tileType = tileTypes[i]!;
    try {
      const { prompt, negativePrompt } = tilePrompt(world.world, tileType);
      const result = await generateImage({
        prompt,
        negativePrompt,
        width: 64,
        height: 64,
        steps: 25,
        cfgScale: 7,
        seed: seedBase + 100 + i,
      });
      const path = `${outputDir}/tiles/${tileType}.png`;
      await saveImage(result.imageBase64, path);
      tiles.push(path);
      console.log(`  ✓ Tile ${tileType} generado`);
    } catch (e) {
      errors.push(`tile ${tileType}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 3. Sprites de entidades
  const entityTypes = [
    "player", "enemyDefault", "enemyPatrol", "enemyChase",
    "enemyRandom", "enemyVigilance", "goal", "key", "door",
  ];
  for (let i = 0; i < entityTypes.length; i++) {
    const entityType = entityTypes[i]!;
    try {
      const { prompt, negativePrompt } = spritePrompt(world.world, entityType);
      const result = await generateImage({
        prompt,
        negativePrompt,
        width: 64,
        height: 64,
        steps: 25,
        cfgScale: 7,
        seed: seedBase + 200 + i,
      });
      const path = `${outputDir}/sprites/${entityType}.png`;
      await saveImage(result.imageBase64, path);
      sprites.push(path);
      console.log(`  ✓ Sprite ${entityType} generado`);
    } catch (e) {
      errors.push(`sprite ${entityType}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { backgrounds, tiles, sprites, errors };
}
