# 🎨 Motor Gráfico

Este documento cubre todo lo relacionado con el arte: cómo se analiza un fondo,
cómo se adapta a panorámico sin deformarse, cómo se calcula la rejilla de casillas
sobre cada fondo, y cómo se elige automáticamente qué sprite dibujar en cada
casilla (incluyendo enemigos y elementos).

## 1. Analizador de fondos (una sola vez por fondo, no por partida)

> Como los fondos artísticos ya están creados de antemano, este paso se hace
> con ayuda de una **IA de visión** que analiza cada imagen y propone la
> plantilla automáticamente, en vez de marcarla a mano en un editor. El
> proceso detallado (qué pedirle a la IA, formato de salida, validación
> obligatoria posterior) está en `10-ANALIZADOR-IA-FONDOS.md`. Aquí se
> describe solo el resultado que produce este paso, independientemente de si
> se genera con IA o a mano.

Cuando subes un fondo nuevo (ej. `tablero_espacio.png`), un analizador
(herramienta interna, no algo que corra en cada partida) genera su **plantilla**:

```
IMAGEN DEL TABLERO
        ↓
Analizador/editor de niveles (herramienta offline)
        ↓
PLANTILLA DE FONDO (JSON): zona segura, zona jugable, anclajes
        ↓
Motor del juego (en tiempo real, usa la plantilla, no la imagen en bruto)
```

Esto evita que el motor tenga que "adivinar" nada en tiempo real: la plantilla
ya dice exactamente dónde se puede construir el tablero.

La plantilla define, en **coordenadas relativas (0.0–1.0)**, no en píxeles
absolutos, para que funcione en cualquier resolución:

- `safeArea`: zona decorativa que nunca debe taparse.
- `boardArea`: rectángulo (o zona) donde el generador puede construir el tablero.
- `anchorPoints`: puntos de referencia para alinear elementos fijos (marco, HUD).

Ver el esquema exacto en `06-ESQUEMAS-JSON.md`.

## 2. Adaptación a pantalla panorámica (Screen Layout)

**No se estira la imagen.** Estirar deformaría sprites y arte pixel/retro.
En su lugar, el fondo se trata como una composición por zonas:

```
BackgroundTemplate
│
├── Background         (arte decorativo de fondo, puede extenderse/repetirse)
├── SafeArea            (nunca se tapa ni se recorta)
├── BoardArea           (zona jugable, coordenadas relativas)
├── DecorativeAreas     (elementos decorativos secundarios, opcionales, recortables)
└── AnchorPoints        (referencias para marco/HUD)
```

Estrategias recomendadas para pasar de un formato más cuadrado a 16:9/panorámico:

- **Extensión lateral**: el fondo se diseña con márgenes "seguros" repetibles o
  ampliables (parallax simple, patrones tileables, degradados) a los lados,
  dejando el elemento central (nave, planeta, etc.) intacto.
- **Composición en capas**: fondo lejano (se puede recortar/extender libremente),
  fondo medio (decorativo, algo de margen), zona de tablero (fija, nunca se toca).
- **Anclaje central**: el `boardArea` y los elementos importantes se anclan al
  centro; el espacio sobrante a los lados se rellena con la propia estética
  (estrellas, nebulosas, lava, agua... según el mundo) generado o repetido.

El motor de layout calcula, para la resolución real del dispositivo/TV:

```
resolución real → recalcular boardArea en píxeles → recalcular rejilla de casillas
```

## 3. Cálculo de la rejilla de casillas (por nivel, en tiempo real)

Una vez se sabe el tamaño en píxeles del `boardArea` para la pantalla actual, y
el generador de niveles ha decidido cuántas columnas/filas tiene el nivel:

```
BoardArea (px)
     ↓
ancho disponible / número de columnas → cellWidth candidato
alto disponible  / número de filas    → cellHeight candidato
     ↓
elegir el tamaño de celda dentro de una lista de tamaños permitidos
(ej. 48, 56, 64, 72, 80 px) — NUNCA un valor decimal arbitrario
     ↓
centrar el tablero resultante dentro del boardArea
     ↓
originX, originY, cellWidth, cellHeight → rejilla final
```

### Por qué tamaños fijos y no escalado libre

Al ser arte retro/pixel-art, escalar libremente (ej. `63.73 × 61.28 px`) produce
bordes borrosos. Por eso:

- Se define una lista cerrada de tamaños de celda válidos.
- Se prefieren **escalados enteros** (×1, ×2, ×3) del sprite base.
- Todas las casillas se alinean perfectamente en horizontal y vertical, dentro
  del área de juego diseñada en el fondo (restricción absoluta, ver `04-SOLVER-VALIDADOR.md`).

## 4. Forma del tablero (no siempre un rectángulo)

Dentro del `boardArea` se puede definir una "zona máxima segura" y, dentro de
ella, el generador construye distintas formas (arquetipos) sin invadir nunca la
decoración:

```
RECTÁNGULO · L · T · CRUZ · PASILLO · CÁMARA_CENTRAL · ANILLO · DOBLE_PASILLO · LABERINTO · IRREGULAR
```

La forma se representa como una matriz donde `#` = celda inexistente y `.` =
celda jugable, siempre sobre la rejilla ya calculada (nunca desplazada píxel a
píxel de forma arbitraria).

Más detalle de cómo se eligen y combinan arquetipos en `03-GENERADOR-NIVELES.md`.

## 5. Asset Resolver / Auto-tiling

Una vez el mapa lógico de un nivel ya pasó el solver (ver `04-SOLVER-VALIDADOR.md`),
el Asset Resolver decide qué sprite gráfico corresponde a cada celda, mirando
sus vecinos (arriba, abajo, izquierda, derecha, diagonales si aplica):

```
celda "." con vecino "#" arriba          → sprite "borde_superior"
celda "." con vecinos "#" arriba+izq     → sprite "esquina_superior_izq"
celda "." rodeada de "."                 → sprite "suelo_interior"
celda "P"                                → sprite jugador del mundo (nave, buzo, etc.)
celda "E"                                → sprite enemigo del mundo
celda "G"                                → sprite objetivo/puerta del mundo
```

Cada **mundo** (Espacio, Fuego, Agua...) tiene su propio set de assets de
casillas (suelo, bordes, esquinas, obstáculos, marco) pero comparten la misma
lógica de auto-tiling. Así, cambiar de temática es solo cambiar el "diccionario
de sprites", no la lógica.

### Cálculo de enemigos y elementos ("luego calcule el resto")

Una vez la forma del tablero está fijada y validada, el propio **generador**
(no el resolver visual) decide **cuántos y dónde** van los enemigos/objetos,
respetando reglas de dificultad y distancia mínima al jugador. Este cálculo se
hace en el mapa lógico (números/celdas), y el Asset Resolver solo se encarga
después de "traducir" esas celdas ya decididas a sprites correctos. Ver el
proceso completo de decisión de enemigos en `03-GENERADOR-NIVELES.md` (sección
"Población de entidades") y su verificación en `04-SOLVER-VALIDADOR.md`.

## 6. Resumen de responsabilidades

| Componente | Responsabilidad | Cuándo corre |
|---|---|---|
| Analizador de fondos | Genera la plantilla (zonas) de un fondo | Una vez, offline, al añadir un fondo nuevo |
| Screen Layout | Adapta la plantilla a la resolución real | Al iniciar la app / cambiar resolución |
| Level Generator | Decide forma + entidades (mapa lógico) | Al generar cada nivel |
| Solver/Validador | Verifica geometría + resolubilidad + dificultad | Justo después de generar, antes de guardar |
| Asset Resolver | Traduce mapa lógico validado a sprites | Al renderizar un nivel ya aceptado |
| Motor de reglas | Ejecuta el juego (movimiento, victoria) | Durante la partida |
