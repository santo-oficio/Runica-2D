import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const I18N_DIR = join(__dirname, "..", "i18n");

const LANGS = ["es", "en", "fr", "de", "it"] as const;
type Lang = (typeof LANGS)[number];

function loadLang(lang: Lang): Record<string, string> {
  const path = join(I18N_DIR, `${lang}.json`);
  return JSON.parse(readFileSync(path, "utf-8")) as Record<string, string>;
}

describe("i18n — archivos de idioma", () => {
  it("los 5 idiomas tienen las mismas claves que el español", () => {
    const esKeys = Object.keys(loadLang("es")).sort();
    expect(esKeys.length).toBeGreaterThan(0);

    for (const lang of LANGS) {
      if (lang === "es") continue;
      const langKeys = Object.keys(loadLang(lang)).sort();
      expect(langKeys).toEqual(esKeys);
    }
  });

  it("ningún valor está vacío", () => {
    for (const lang of LANGS) {
      const entries = Object.entries(loadLang(lang));
      for (const [key, value] of entries) {
        expect(value, `${lang}.${key} está vacío`).toBeTruthy();
        expect(value.trim().length, `${lang}.${key} está vacío`).toBeGreaterThan(0);
      }
    }
  });

  it("el español tiene todas las claves esperadas del menú", () => {
    const es = loadLang("es");
    const expectedKeys = [
      "menu.title", "menu.subtitle", "menu.newGame", "menu.continue",
      "menu.instructions", "menu.credits", "menu.language",
      "game.world", "game.stage", "game.tier", "game.turn", "game.moves",
      "game.victory", "game.defeat", "game.retry", "game.next", "game.exit",
      "instructions.title", "instructions.move", "instructions.orthogonal",
      "instructions.bounce", "instructions.noCount", "instructions.enemies",
      "instructions.traps", "instructions.goal", "instructions.back",
      "credits.title", "credits.design", "credits.inspired", "credits.back",
    ];
    for (const key of expectedKeys) {
      expect(es[key], `Falta clave ${key} en es.json`).toBeDefined();
    }
  });

  it("los 8 mundos están traducidos en todos los idiomas", () => {
    const worlds = [
      "worlds.ESPACIO", "worlds.AGUA", "worlds.TIERRA", "worlds.FUEGO",
      "worlds.HIELO", "worlds.VIENTO", "worlds.INFRAMUNDO", "worlds.MAZMORRA",
    ];
    for (const lang of LANGS) {
      const dict = loadLang(lang);
      for (const w of worlds) {
        expect(dict[w], `Falta ${w} en ${lang}.json`).toBeDefined();
      }
    }
  });
});
