/**
 * Screen Layout (docs/02-MOTOR-GRAFICO.md §2).
 *
 * Dado un `BackgroundTemplate` (coordenadas relativas 0.0–1.0) y una
 * resolución de pantalla real, calcula las zonas en píxeles SIN deformar el
 * arte: composición por zonas, no estiramiento.
 *
 * Estrategia: el fondo se trata con "anclaje central" + extensión lateral.
 * El `boardArea` y los elementos importantes se anclan al centro; el espacio
 * sobrante a los lados se rellena con la estética del mundo (no se toca el
 * `boardArea` ni el `safeArea`).
 *
 * Para mantener el pixel-art sin deformar, el fondo se dibuja con su
 * relación de aspecto nativa (aspectRatio de la imagen) centrado en la
 * pantalla, y las zonas relativas se proyectan sobre ese fondo colocado.
 */

import type { BackgroundTemplate, RelativeRect } from "../schemas/types.js";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Resolución de pantalla real en píxeles. */
export interface ScreenResolution {
  readonly width: number;
  readonly height: number;
}

/** Zona en píxeles absolutos. */
export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Resultado del Screen Layout: todas las zonas del fondo proyectadas a
 * píxeles reales para una resolución dada, sin deformar el arte.
 */
export interface ScreenLayout {
  readonly screen: ScreenResolution;
  /** Rectángulo donde se dibuja el fondo (con aspect ratio nativo, centrado). */
  readonly backgroundRect: PixelRect;
  /** safeArea en píxeles. */
  readonly safeAreaPx: PixelRect;
  /** boardArea en píxeles (zona jugable segura). */
  readonly boardAreaPx: PixelRect;
  /** decorativeAreas en píxeles (si las hay). */
  readonly decorativeAreasPx: readonly PixelRect[];
  /** anchorPoints en píxeles. */
  readonly anchorPointsPx: Readonly<Record<string, { x: number; y: number }>>;
  /** Modo de adaptación usado (para depuración). */
  readonly mode: "letterbox" | "pillarbox" | "exact";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relToPxRect(rel: RelativeRect, origin: PixelRect): PixelRect {
  return {
    x: Math.round(origin.x + rel.x * origin.width),
    y: Math.round(origin.y + rel.y * origin.height),
    width: Math.round(rel.width * origin.width),
    height: Math.round(rel.height * origin.height),
  };
}

function relToPxPoint(rel: { x: number; y: number }, origin: PixelRect): { x: number; y: number } {
  return {
    x: Math.round(origin.x + rel.x * origin.width),
    y: Math.round(origin.y + rel.y * origin.height),
  };
}

// ---------------------------------------------------------------------------
// Screen Layout
// ---------------------------------------------------------------------------

/**
 * Coloca el fondo en la pantalla manteniendo su aspect ratio nativo
 * (sin estirar). Devuelve el rectángulo donde se dibuja el fondo y las
 * zonas proyectadas a píxeles.
 *
 * @param template plantilla de fondo (coords relativas).
 * @param screen resolución real de pantalla.
 * @param imageAspectRatio ancho/alto de la imagen original. Si no se pasa,
 *   se asume que el fondo ya es panorámico (16:9) y se usa el aspect de la
 *   pantalla (modo "exact", sin letterbox/pillarbox).
 */
export function computeScreenLayout(
  template: BackgroundTemplate,
  screen: ScreenResolution,
  imageAspectRatio?: number,
): ScreenLayout {
  const screenAspect = screen.width / screen.height;
  const bgAspect = imageAspectRatio ?? screenAspect;

  let bgRect: PixelRect;
  let mode: "letterbox" | "pillarbox" | "exact";

  if (Math.abs(bgAspect - screenAspect) < 1e-6) {
    // Aspect idéntico: el fondo ocupa toda la pantalla.
    bgRect = { x: 0, y: 0, width: screen.width, height: screen.height };
    mode = "exact";
  } else if (bgAspect > screenAspect) {
    // El fondo es más ancho que la pantalla: pillarbox (bandas laterales).
    // Se escala por altura, el ancho sobra → centrado horizontal.
    const height = screen.height;
    const width = Math.round(height * bgAspect);
    const x = Math.round((screen.width - width) / 2);
    bgRect = { x, y: 0, width, height };
    mode = "pillarbox";
  } else {
    // El fondo es más alto que la pantalla: letterbox (bandas superior/inferior).
    // Se escala por ancho, el alto sobra → centrado vertical.
    const width = screen.width;
    const height = Math.round(width / bgAspect);
    const y = Math.round((screen.height - height) / 2);
    bgRect = { x: 0, y, width, height };
    mode = "letterbox";
  }

  return {
    screen,
    backgroundRect: bgRect,
    safeAreaPx: relToPxRect(template.safeArea, bgRect),
    boardAreaPx: relToPxRect(template.boardArea, bgRect),
    decorativeAreasPx: (template.decorativeAreas ?? []).map((d) => relToPxRect(d, bgRect)),
    anchorPointsPx: Object.fromEntries(
      Object.entries(template.anchorPoints).map(([k, p]) => [k, relToPxPoint(p, bgRect)]),
    ),
    mode,
  };
}
