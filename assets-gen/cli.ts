/**
 * CLI para generar assets visuales con Stable Diffusion.
 *
 * Uso:
 *   npx tsx assets-gen/cli.ts generate-world ESPACIO
 *   npx tsx assets-gen/cli.ts generate-world FUEGO --bgs 3
 *   npx tsx assets-gen/cli.ts check
 */

import { isSdRunning, generateWorldAssets } from "./sd-client.js";
import { SPACE_WORLD, FIRE_WORLD } from "../worlds/configs.js";
import { join } from "node:path";

const WORLD_MAP: Record<string, typeof SPACE_WORLD> = {
  ESPACIO: SPACE_WORLD,
  FUEGO: FIRE_WORLD,
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "check") {
    console.log("Comprobando Automatic1111...");
    const running = await isSdRunning();
    if (running) {
      console.log("✓ Automatic1111 está corriendo en localhost:7860");
    } else {
      console.log("✗ Automatic1111 no responde.");
      console.log("  Asegúrate de lanzarlo con:");
      console.log("  cd \"C:\\Proyectos personales\\stable-diffusion-webui\"");
      console.log("  .\\webui-user.bat");
    }
    return;
  }

  if (command === "generate-world") {
    const worldName = args[1];
    if (!worldName || !WORLD_MAP[worldName]) {
      console.error("Uso: generate-world <ESPACIO|FUEGO>");
      process.exit(1);
    }

    const world = WORLD_MAP[worldName]!;
    const bgCountIdx = args.indexOf("--bgs");
    const bgCount = bgCountIdx >= 0 ? parseInt(args[bgCountIdx + 1] ?? "2", 10) : 2;

    console.log(`\nGenerando assets para el mundo "${worldName}"...`);
    console.log(`  Fondos: ${bgCount}`);
    console.log(`  Tiles: 8`);
    console.log(`  Sprites: 9\n`);

    const running = await isSdRunning();
    if (!running) {
      console.error("✗ Automatic1111 no responde. Lánzalo primero:");
      console.error("  cd \"C:\\Proyectos personales\\stable-diffusion-webui\"");
      console.error("  .\\webui-user.bat");
      process.exit(1);
    }

    const outputDir = join(process.cwd(), "assets", "generated", worldName);
    const result = await generateWorldAssets(world, outputDir, bgCount);

    console.log(`\n=== Resultado ===`);
    console.log(`  Fondos:   ${result.backgrounds.length}/${bgCount}`);
    console.log(`  Tiles:    ${result.tiles.length}/8`);
    console.log(`  Sprites:  ${result.sprites.length}/9`);
    if (result.errors.length > 0) {
      console.log(`  Errores:  ${result.errors.length}`);
      for (const e of result.errors) console.log(`    - ${e}`);
    } else {
      console.log(`  Errores:  0`);
    }
    return;
  }

  console.log("Uso:");
  console.log("  npx tsx assets-gen/cli.ts check");
  console.log("  npx tsx assets-gen/cli.ts generate-world <ESPACIO|FUEGO> [--bgs N]");
}

main().catch(console.error);
