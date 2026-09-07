/**
 * Tests del analizador de fondos: prompt, extracción JSON, flujo completo
 * con MockVisionProvider.
 */

import { describe, it, expect } from "vitest";
import {
  analyzeBackground,
  buildInstructionPrompt,
  extractJson,
} from "../background/analyzer.js";
import { MockVisionProvider } from "../background/vision-provider.js";
import { backgroundTemplateCandidateExample } from "../schemas/examples.js";
import type { BackgroundTemplateCandidate } from "../schemas/types.js";

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
function clone<T>(v: T): Mutable<T> {
  return JSON.parse(JSON.stringify(v)) as Mutable<T>;
}

describe("buildInstructionPrompt", () => {
  it("incluye el world, id y filename esperados", () => {
    const p = buildInstructionPrompt("ESPACIO", "SPACE_01", "assets/backgrounds/ESPACIO/bg_01.jpg");
    expect(p).toContain("ESPACIO");
    expect(p).toContain("SPACE_01");
    expect(p).toContain("assets/backgrounds/ESPACIO/bg_01.jpg");
  });
  it("menciona las reglas clave del doc 10 §4", () => {
    const p = buildInstructionPrompt("X", "Y", "z");
    expect(p).toContain("relativas (0.0–1.0");
    expect(p).toContain("boardArea");
    expect(p).toContain("confidence");
    expect(p).toContain("extendable");
  });
});

describe("extractJson", () => {
  it("extrae JSON puro", () => {
    const s = '{"a":1,"b":"x"}';
    expect(JSON.parse(extractJson(s))).toEqual({ a: 1, b: "x" });
  });
  it("extrae JSON dentro de bloque ```json```", () => {
    const s = 'Aquí va:\n```json\n{"a":1}\n```\nFin.';
    expect(JSON.parse(extractJson(s))).toEqual({ a: 1 });
  });
  it("extrae JSON embebido en prosa", () => {
    const s = 'Resultado: {"a":1,"b":{"c":2}} hecho.';
    expect(JSON.parse(extractJson(s))).toEqual({ a: 1, b: { c: 2 } });
  });
  it("lanza si no hay JSON", () => {
    expect(() => extractJson("no hay nada aqui")).toThrow();
  });
  it("lanza si JSON no balanceado", () => {
    expect(() => extractJson('{"a":1')).toThrow();
  });
});

describe("analyzeBackground (con MockVisionProvider)", () => {
  const image = { bytes: new Uint8Array([1, 2, 3]), mime: "image/jpeg", filename: "bg_01.jpg" };

  it("acepta una plantilla válida del mock", async () => {
    const provider = new MockVisionProvider(backgroundTemplateCandidateExample);
    const r = await analyzeBackground(image, "ESPACIO", "SPACE_01", provider);
    expect(r.accepted).toBe(true);
    expect(r.needsHumanReview).toBe(false);
    expect(r.template).not.toBeNull();
    expect(r.template?.id).toBe("SPACE_01");
    expect(r.parseError).toBeNull();
  });

  it("marca needsHumanReview si confidence < umbral", async () => {
    const low = clone(backgroundTemplateCandidateExample);
    low.confidence = 0.4;
    const provider = new MockVisionProvider(low);
    const r = await analyzeBackground(image, "ESPACIO", "SPACE_01", provider);
    expect(r.accepted).toBe(true);
    expect(r.needsHumanReview).toBe(true);
  });

  it("rechaza si boardArea sale de safeArea", async () => {
    const bad = clone(backgroundTemplateCandidateExample);
    // safeArea reducida para que boardArea (válida en [0,1]) quede fuera de ella
    bad.safeArea = { x: 0.0, y: 0.0, width: 0.4, height: 0.4 };
    const provider = new MockVisionProvider(bad);
    const r = await analyzeBackground(image, "ESPACIO", "SPACE_01", provider);
    expect(r.accepted).toBe(false);
    expect(r.template).toBeNull();
    expect(r.sanity.ok).toBe(false);
  });

  it("lanza si el mock devuelve JSON inválido", async () => {
    const provider = new MockVisionProvider("not-json" as unknown as BackgroundTemplateCandidate);
    await expect(analyzeBackground(image, "ESPACIO", "SPACE_01", provider)).rejects.toThrow();
  });

  it("el template definitivo no incluye confidence/notes/suggestedGrid", async () => {
    const provider = new MockVisionProvider(backgroundTemplateCandidateExample);
    const r = await analyzeBackground(image, "ESPACIO", "SPACE_01", provider);
    expect(r.template).not.toBeNull();
    const t = r.template!;
    expect("confidence" in t).toBe(false);
    expect("notes" in t).toBe(false);
    expect("suggestedGrid" in t).toBe(false);
  });
});
