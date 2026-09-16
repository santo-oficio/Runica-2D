/**
 * Sistema de internacionalización (i18n) para Runika 2D.
 *
 * Carga archivos JSON de `i18n/<lang>.json`. Función `t("clave")` resuelve
 * las traducciones. Fallback al español si falta una clave.
 *
 * Idiomas soportados: es, en, fr, de, it.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type Lang = "es" | "en" | "fr" | "de" | "it";

export const SUPPORTED_LANGS: Lang[] = ["es", "en", "fr", "de", "it"];
const DEFAULT_LANG: Lang = "es";

let currentLang: Lang = DEFAULT_LANG;
let translations: Record<string, string> = {};
let fallback: Record<string, string> = {};

function loadLangFile(lang: Lang): Record<string, string> {
  const path = join(__dirname, `${lang}.json`);
  return JSON.parse(readFileSync(path, "utf-8")) as Record<string, string>;
}

/** Inicializa el i18n cargando el idioma especificado y el fallback español. */
export function initI18n(lang: Lang = DEFAULT_LANG): void {
  fallback = loadLangFile(DEFAULT_LANG);
  setLang(lang);
}

/** Cambia el idioma activo. */
export function setLang(lang: Lang): void {
  if (!SUPPORTED_LANGS.includes(lang)) {
    lang = DEFAULT_LANG;
  }
  currentLang = lang;
  translations = loadLangFile(lang);
}

/** Devuelve el idioma activo. */
export function getLang(): Lang {
  return currentLang;
}

/**
 * Traduce una clave al idioma activo.
 * Si falta en el idioma activo, usa el español como fallback.
 * Si falta en ambos, devuelve la clave tal cual.
 */
export function t(key: string): string {
  return translations[key] ?? fallback[key] ?? key;
}
