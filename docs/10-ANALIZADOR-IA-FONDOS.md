# 🧠 Analizador de Fondos con IA (Visión)

Este documento sustituye/complementa al punto 1 de `02-MOTOR-GRAFICO.md`
("Analizador de fondos"). Como **tú ya tienes las imágenes de fondo hechas**,
lo que necesitas no es un editor manual donde marques tú a mano la zona
jugable, sino un paso automático (asistido por IA con visión) que analice cada
imagen y proponga la `BackgroundTemplate` (zona segura, zona jugable, tamaño de
rejilla sugerido, puntos de anclaje).

Esto sigue siendo un paso **offline** (se ejecuta una vez por cada fondo nuevo
que subas, no en cada partida) — solo cambia cómo se genera el resultado: en
vez de "tú lo dibujas a mano en un editor", "una IA de visión lo propone y tú
lo apruebas o corriges".

## 1. Dónde encaja en la arquitectura

```
IMAGEN DE FONDO (la que ya tienes)
        ↓
ANALIZADOR IA (visión) → propone BackgroundTemplate candidata
        ↓
Revisión/ajuste rápido (humano o reglas automáticas de sanidad)
        ↓
BackgroundTemplate final (JSON, ver 06-ESQUEMAS-JSON.md)
        ↓
Motor del juego (en tiempo real, usa la plantilla, nunca la IA de visión)
```

Importante: **la IA de visión no interviene en tiempo real durante la
partida.** Es una herramienta de producción/pipeline, igual que un editor
manual lo sería. Una vez generada y aprobada la `BackgroundTemplate`, el juego
solo usa el JSON, nunca vuelve a llamar a un modelo de IA para eso.

## 2. Qué debe hacer el analizador IA, paso a paso

Dado un fondo (ej. `tablero_espacio.png`), pedir al modelo de visión que
identifique:

1. **Zona jugable / tablero**: el rectángulo (o polígono) donde hay espacio
   "neutro" pensado para colocar casillas, normalmente el área central o más
   despejada de la composición.
2. **Zona protegida / decorativa**: elementos que no se deben tapar nunca
   (nave, personaje central, marco decorativo, textos, iconografía del mundo).
3. **Rejilla sugerida**: si el propio fondo ya insinúa una cuadrícula (líneas,
   paneles, baldosas dibujadas), que la IA intente detectar cuántas columnas y
   filas "caben" de forma natural. Si no hay pistas visuales, que proponga un
   nº de columnas/filas razonable según el tamaño del área jugable y los
   `allowedCellSizes` del proyecto.
4. **Puntos de anclaje**: esquinas o referencias claras del marco/decoración
   para poder alinear HUD u otros elementos fijos.
5. **Zonas decorativas extensibles**: qué partes del fondo se podrían repetir/
   extender lateralmente al adaptar a panorámico sin romper la composición
   (ver `02-MOTOR-GRAFICO.md`, sección 2), y cuáles son fijas e intocables.

## 3. Formato de salida esperado (la IA debe devolver esto, no prosa)

La IA de visión debe devolver **directamente** un JSON con la forma de
`BackgroundTemplate` (ver `06-ESQUEMAS-JSON.md`), con coordenadas relativas
(0.0–1.0), por ejemplo:

```json
{
  "id": "SPACE_01",
  "world": "ESPACIO",
  "image": "tablero_espacio.png",
  "safeArea": { "x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0 },
  "boardArea": { "x": 0.25, "y": 0.28, "width": 0.50, "height": 0.48 },
  "suggestedGrid": { "columns": 8, "columnsRange": [6, 10], "rows": 6, "rowsRange": [5, 8] },
  "anchorPoints": {
    "frameTopLeft": { "x": 0.20, "y": 0.22 }
  },
  "decorativeAreas": [
    { "x": 0.0, "y": 0.0, "width": 0.25, "height": 1.0, "extendable": true },
    { "x": 0.75, "y": 0.0, "width": 0.25, "height": 1.0, "extendable": true }
  ],
  "confidence": 0.83,
  "notes": "El área central despejada corresponde al tablero; la nave superior es zona protegida."
}
```

- `confidence` y `notes` son campos propios de esta fase de análisis (no van
  al `BackgroundTemplate` final): sirven para saber qué imágenes necesitan
  revisión humana antes de aprobarse (ej. `confidence < 0.7` → revisar a mano).
- `suggestedGrid` con rangos (no solo un número fijo) porque la decisión final
  de columnas/filas de cada nivel concreto la toma el **Level Generator**
  (`03-GENERADOR-NIVELES.md`), no este analizador. El analizador solo dice
  "qué es razonable para este fondo".

## 4. Ejemplo de instrucción para el modelo de visión

Esto es una referencia de qué pedirle al modelo (Claude con visión, GLM-4V/5.2
con visión, etc.) al automatizar este paso dentro del proyecto:

```
Analiza esta imagen de fondo de un juego de puzzles tipo Wappo, estilo
pixel-art/retro. Devuelve EXCLUSIVAMENTE un JSON (sin texto adicional) con esta
forma: { id, world, image, safeArea, boardArea, suggestedGrid, anchorPoints,
decorativeAreas, confidence, notes }.

Reglas:
- Todas las coordenadas de área (x, y, width, height) son relativas (0.0–1.0
  respecto al ancho/alto total de la imagen), nunca píxeles absolutos.
- boardArea debe ser la zona más despejada/neutra pensada para colocar
  casillas de juego, sin tapar elementos centrales de la composición
  (personajes, naves, iconografía del mundo).
- decorativeAreas con extendable=true son zonas que se podrían repetir o
  ampliar lateralmente sin romper la composición (para adaptar a pantalla
  panorámica). Márcalas solo si realmente son repetibles (ej. patrones de
  estrellas, texturas de fondo homogéneas), NUNCA si contienen elementos
  únicos (naves, letreros, personajes).
- suggestedGrid.columns/rows deben ser números razonables dado el tamaño de
  boardArea; incluye también un rango (columnsRange, rowsRange) de valores
  aceptables.
- confidence entre 0.0 y 1.0: baja si la imagen es ambigua o no está claro
  dónde debería ir el tablero.
- No inventes anchorPoints si no hay un marco o referencia visual clara.
```

## 5. Validación obligatoria después del análisis IA

Igual que con cualquier otro dato que entra al sistema, **la salida de la IA
de visión no se usa a ciegas**. Antes de aceptar una `BackgroundTemplate`
generada así, se aplican comprobaciones automáticas (no hace falta IA para
esto, son chequeos geométricos simples):

1. `boardArea` está completamente dentro de `safeArea`/los límites de la imagen.
2. `boardArea` tiene proporciones razonables (ni una línea de 1 px de alto, ni
   ocupa el 100% de la imagen sin dejar margen a decoración).
3. `suggestedGrid` (columnas × filas × `allowedCellSizes` del proyecto) permite
   al menos un tamaño de celda válido dentro de `boardArea`.
4. Ninguna `decorativeArea` con `extendable: true` se solapa con `boardArea`.
5. Si `confidence < 0.7` (umbral configurable), marcar el fondo como
   "pendiente de revisión humana" antes de usarlo en producción — no bloquea
   el pipeline, pero no se publica sin visto bueno.

Solo cuando pasa estas comprobaciones, la `BackgroundTemplate` se guarda como
definitiva y entra al resto del pipeline (`02-MOTOR-GRAFICO.md` en adelante).

## 6. Por qué esto no rompe la "regla de oro" del proyecto

La IA de visión **propone** una interpretación de la imagen (dónde está el
tablero, qué es decorativo). El sistema geométrico/matemático (sección 5, y
después el Solver de `04-SOLVER-VALIDADOR.md`) **decide** si esa propuesta es
válida para construir niveles. Ningún nivel llega al jugador basándose
únicamente en "lo que dijo la IA de visión" sin pasar los chequeos
automáticos — exactamente el mismo principio que ya rige el generador de
niveles y el solver.

## 7. Nota práctica sobre coste y flujo de trabajo

- Este análisis se hace **una vez por imagen de fondo**, no en cada partida ni
  en cada nivel generado. El coste de usar un modelo con visión es marginal
  frente al volumen de niveles generados.
- Recomendado: guardar junto a cada `BackgroundTemplate` el `confidence` y las
  `notes` originales del análisis, por si en el futuro queréis re-analizar
  fondos con un modelo mejor y comparar resultados.
- Si en el futuro cambiáis de modelo de visión (ej. de Claude a GLM o
  viceversa), el contrato de entrada/salida (el JSON de la sección 3) se
  mantiene igual — solo cambia qué modelo genera la propuesta inicial.
