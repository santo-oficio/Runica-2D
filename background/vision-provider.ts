/**
 * Proveedor de visión pluggable para el analizador de fondos.
 *
 * Define una interfaz común (`VisionProvider`) para que el analizador no
 * dependa del modelo concreto (Claude con visión, GLM-4V/5.2 con visión, etc.).
 * Cada implementación recibe una imagen (bytes + mime) y el prompt de
 * instrucción, y devuelve el JSON de `BackgroundTemplateCandidate`.
 *
 * Implementaciones incluidas:
 *  - `MockVisionProvider`: devuelve una plantilla preconfigurada (para tests
 *    y para desarrollo sin clave API).
 *  - `HttpVisionProvider`: implementación base que llama a un endpoint HTTP
 *    con un esquema de mensajes OpenAI-compatible (usado por muchos
 *    proveedores de visión). Se inyecta URL, headers y mapeo de respuesta.
 *
 * No se incluye ninguna clave API en el código: se lee de variables de
 * entorno en el CLI, nunca se loguea.
 */

import type { BackgroundTemplateCandidate } from "../schemas/types.js";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Imagen de entrada para el modelo de visión. */
export interface VisionImage {
  readonly bytes: Uint8Array;
  readonly mime: string;
  readonly filename: string;
}

/** Respuesta cruda del modelo de visión (texto, normalmente JSON). */
export interface VisionResponse {
  readonly content: string;
  readonly model: string;
  /** Metadatos opcionales (tokens, latencia, etc.). */
  readonly meta?: Readonly<Record<string, unknown>>;
}

/** Interfaz que debe implementar cualquier proveedor de visión. */
export interface VisionProvider {
  readonly name: string;
  analyze(image: VisionImage, instructionPrompt: string): Promise<VisionResponse>;
}

// ---------------------------------------------------------------------------
// MockVisionProvider — para tests y desarrollo sin clave API
// ---------------------------------------------------------------------------

/**
 * Proveedor de visión mock que devuelve una plantilla preconfigurada.
 * Útil para tests y para ejecutar el pipeline sin clave API real.
 */
export class MockVisionProvider implements VisionProvider {
  readonly name = "mock";
  private readonly responseJson: string;

  constructor(response: BackgroundTemplateCandidate) {
    this.responseJson = JSON.stringify(response);
  }

  async analyze(_image: VisionImage, _instructionPrompt: string): Promise<VisionResponse> {
    return { content: this.responseJson, model: "mock-vision-1.0" };
  }
}

// ---------------------------------------------------------------------------
// HttpVisionProvider — base OpenAI-compatible (usado por Claude/GLM/etc.)
// ---------------------------------------------------------------------------

/** Configuración para el proveedor HTTP de visión. */
export interface HttpVisionProviderConfig {
  /** Nombre legible del proveedor (ej. "claude", "glm"). */
  readonly name: string;
  /** URL del endpoint de chat/completions. */
  readonly endpoint: string;
  /** Modelo a usar (ej. "claude-3-5-sonnet-20241022", "glm-4v"). */
  readonly model: string;
  /** Headers HTTP adicionales (ej. Authorization). */
  readonly headers?: Readonly<Record<string, string>>;
  /** Temperatura (por defecto 0 para salida determinista). */
  readonly temperature?: number;
  /** Máximo de tokens de salida. */
  readonly maxTokens?: number;
  /** Timeout en ms (por defecto 60s). */
  readonly timeoutMs?: number;
}

/**
 * Proveedor de visión que llama a un endpoint HTTP con esquema de mensajes
 * OpenAI-compatible (role + content con partes de texto e imagen base64).
 *
 * No depende de ninguna SDK concreta: usa `fetch` (disponible en Node 18+).
 * El mapeo exacto del body puede variar entre proveedores; esta clase
 * construye un body genérico y permite personalizarlo mediante subclases
 * si hace falta. Para Claude/GLM con endpoints compatibles funciona tal cual.
 */
export class HttpVisionProvider implements VisionProvider {
  readonly name: string;
  private readonly cfg: HttpVisionProviderConfig;

  constructor(cfg: HttpVisionProviderConfig) {
    this.name = cfg.name;
    this.cfg = cfg;
  }

  async analyze(image: VisionImage, instructionPrompt: string): Promise<VisionResponse> {
    const base64 = encodeBase64(image.bytes);
    const dataUrl = `data:${image.mime};base64,${base64}`;

    const body = {
      model: this.cfg.model,
      temperature: this.cfg.temperature ?? 0,
      max_tokens: this.cfg.maxTokens ?? 2048,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: instructionPrompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs ?? 60_000);
    try {
      const res = await fetch(this.cfg.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.cfg.headers ?? {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; model?: string };
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new Error("respuesta sin choices[0].message.content (string)");
      }
      return { content, model: json.model ?? this.cfg.model };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Codifica bytes a base64 (compatible con Node y navegadores). */
function encodeBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}
