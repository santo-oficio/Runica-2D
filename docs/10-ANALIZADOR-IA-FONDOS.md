# 🧠 Analizador de Fondos con IA (MobileSAM)

Este documento sustituye/complementa al punto 1 de `02-MOTOR-GRAFICO.md`
("Analizador de fondos"). Como **los fondos ya tienen el tablero incorporado**
(6 columnas × 5 filas, dibujado en la propia imagen), lo que se necesita no es
un editor manual ni un VLM que "adivine" dónde está el tablero, sino un paso
automático de **segmentación de imagen** que localice el rectángulo del tablero
y derive su `boardArea`.

La herramienta elegida es **MobileSAM** (Segment Anything Model de Meta, versión
ligera TinyViT). Es un modelo de segmentación que, dado un *box prompt* (una
caja aproximada), devuelve la máscara exacta del objeto contenido en esa caja.

> Importante: MobileSAM **no se usa en tiempo real durante la partida**. Es una
> herramienta offline de pipeline. Una vez generada y calibrada la
> `boardArea`, el juego solo usa el JSON (`board-detection.json`).

## 1. Dónde encaja en la arquitectura

```
IMAGEN DE FONDO (ya con tablero dibujado)
        ↓
background/sam-detect.py (MobileSAM) → board-detection.json
        ↓
Calibración manual fina (demo visual interactivo)
        ↓
board-detection.json final (coordenadas normalizadas)
        ↓
Motor del juego (usa la boardArea, nunca el modelo de IA)
```

## 2. Cómo funciona la detección (implementación real)

El script `background/sam-detect.py`:

1. Carga MobileSAM (`vit_t`, checkpoint `models/mobile_sam.pt`).
2. Genera ~270 **cajas candidatas** centradas, con distintos tamaños y offsets.
3. Pasa cada caja a MobileSAM como *box prompt* y obtiene una máscara.
4. Evalúa cada máscara con tres métricas:
   - **aspecto 6:5**: qué tan cerca está el rectángulo de la proporción
     `columns / rows` (6/5 = 1.2).
   - **rectangularidad**: fracción de la máscara que rellena su bounding box
     (una máscara perfectamente rectangular = 1.0).
   - **fuerza del grid interno**: energía de bordes (Sobel) sobre las líneas
     divisorias de 6 columnas y 5 filas dentro de la máscara.
5. Elige la máscara con mejor puntuación combinada y devuelve:

```json
{
  "world": "ESPACIO",
  "image": "assets/backgrounds/ESPACIO/bg_01.jpg",
  "width": 1376,
  "height": 768,
  "boardArea": { "x": 0.2919, "y": 0.2526, "width": 0.4150, "height": 0.6206 },
  "boardSize": [6, 5],
  "cellSize": 94.05,
  "arScore": 0.997,
  "rectangularity": 0.966,
  "gridScore": 2660.9,
  "totalScore": 28572.6
}
```

El resultado se guarda en `assets/backgrounds/<MUNDO>/board-detection.json`.

## 3. Por qué MobileSAM y no CV clásica ni VLM

- **CV clásica** (Sobel, detección de líneas, varianza de bloques) resultó
  **no fiable** con pixel art rico en detalles: los bordes decorativos del
  fondo se confunden con las líneas del tablero.
- **VLM** (Claude con visión, GLM, etc.) da coordenadas aproximadas en texto,
  menos precisas para un tablero que debe encajar píxel a píxel.
- **MobileSAM** es segmentación real: devuelve la máscara exacta del tablero,
  funciona con pixel art, no requiere entrenamiento, y cabe en una RTX 3060
  de 6 GB (modelo ~40 MB).

## 4. Calibración manual final

La detección de MobileSAM da una **buena aproximación inicial**, pero el
ajuste fino se hace a mano con la demo visual (`demo-server.ts` + `demo.html`):

- La demo muestra el fondo a pantalla completa (`object-fit: contain`, sin
  recortar) y superpone la rejilla 6×5 sobre la `boardArea` detectada.
- Controles de calibración:
  - `Flechas/WASD` — mover el selector de casilla.
  - `Shift + Flechas` — mover la rejilla (ajuste fino).
  - `Ctrl + Flechas` — escalar la rejilla.
  - `C` — formulario para introducir píxeles exactos (left/top/width/height).
  - `G` — guardar el ajuste.
  - `Espacio` — cambiar de mundo.
- Tras calibrar, los 8 mundos quedaron con la **misma `boardArea`**:

```json
{ "x": 0.297962, "y": 0.259115, "width": 0.403343, "height": 0.609375 }
```

## 5. Validación después del análisis

La salida de MobileSAM no se usa a ciegas. Se comprueba:

1. `boardArea` dentro de los límites de la imagen (0.0–1.0).
2. `boardArea` con proporciones razonables (~6:5).
3. `boardSize` = [6, 5] (tablero fijo).
4. Que la rejilla resultante tenga casillas de tamaño coherente.
5. Calibración manual con la demo visual (visto bueno humano).

## 6. Comandos

```bash
# Detectar el tablero de un mundo
.sam-venv\Scripts\python.exe background/sam-detect.py assets/backgrounds/<MUNDO>/bg_01.jpg <MUNDO> assets/backgrounds/<MUNDO>/board-detection.json

# Informe de casillas (solo lectura)
npx tsx tools/detect-cells.ts [MUNDO]

# Demo visual interactiva (calibración)
npx tsx demo-server.ts
```

## 7. Por qué esto no rompe la "regla de oro"

MobileSAM **propone** dónde está el tablero (una máscara). La calibración
humana + los chequeos geométricos **deciden** si la `boardArea` final es
válida. Ningún nivel se construye sobre una `boardArea` sin calibrar y
verificar.
