# 🚀 Super Prompt — Loop de Implementación con IA de Código

Este documento contiene un **prompt maestro** pensado para pegarlo en una IA de
código con acceso a herramientas (Claude Code, Cursor, Windsurf, un agente con
bash/editor de archivos, etc.). Su objetivo es que la IA construya el proyecto
completo descrito en los documentos `01`–`08`, **iterando en bucle** hasta que
todo el sistema pase sus propios tests automáticos, sin necesidad de que tú
supervises cada paso.

Copia y pega el bloque de la sección "PROMPT" tal cual (o adáptalo con el
stack/motor que finalmente elijáis: Godot, Unity, Unreal, o un motor propio en
JS/TS/Python). Sustituye los placeholders entre `<...>` antes de enviarlo.

---

## Repositorio y ubicación de los fondos

- **Repositorio del proyecto**: `https://github.com/santo-oficio/Runika 2D.git`
- **Fondos de imagen**: ya existen en **`assets/backgrounds/<MUNDO>/bg_01.jpg`**
  (un archivo por mundo, 1376×768 px). Hay 8 mundos: ESPACIO, AGUA, TIERRA,
  FUEGO, HIELO, VIENTO, INFRAMUNDO y MAZMORRA.
- **Detección de tableros**: los fondos ya tienen el tablero **6×5 dibujado**.
  La detección de `boardArea` se hace con **MobileSAM**
  (`background/sam-detect.py`) y el resultado se guarda en
  `assets/backgrounds/<MUNDO>/board-detection.json`. La calibración final
  (ajuste fino) se hace con la demo visual (`demo-server.ts`).
- **Tablero fijo**: `allowedBoardSizes` es `[[6,5]]`. No se generan tableros
  con otras dimensiones por ahora.

## Cómo usar este prompt

1. Clona el repositorio `https://github.com/santo-oficio/Runika 2D.git` y trabaja
   sobre él (o ábrelo directamente en Windsurf).
2. Asegúrate de que los documentos (`00` a `10`) están accesibles para la IA
   (en el mismo repositorio/carpeta, o pegados como contexto).
3. Rellena los placeholders (`<STACK_ELEGIDO>`, etc.) — `<CARPETA_ASSETS>` ya
   no hace falta rellenarlo a mano: el prompt ya indica `background/` en la
   raíz del repo.
4. Pega el prompt completo como primera instrucción de una sesión nueva.
5. Deja que la IA trabaje en bucle: generar código → generar tests → ejecutar →
   corregir → repetir, hasta que el checklist final quede en verde.
6. Revisa tú, al final de cada bloque grande (motor gráfico, generador, solver,
   motor de reglas), el resultado antes de pasar al siguiente — el prompt ya
   se lo pide explícitamente a la IA, pero conviene que tú también lo valides.

## Nota sobre tu stack de trabajo (Windsurf + Claude Code / GLM 5.2)

Este prompt está pensado para funcionar tal cual con tu flujo de trabajo real:

- **Windsurf** como editor/IDE con el agente integrado: pega el prompt en el
  chat del agente de Windsurf con el repositorio del proyecto abierto (para
  que tenga acceso a leer/escribir archivos y ejecutar comandos/tests).
- **Claude Code** o **GLM 5.2** como el modelo/agente que ejecuta el bucle de
  trabajo: ambos pueden usarse indistintamente como "la IA" a la que te
  refieres en el prompt (leer archivos, escribir código, correr tests, iterar).
  Si usas GLM 5.2 y no tiene acceso nativo a herramientas de archivo/ejecución
  dentro de Windsurf, verifica que el modo agente de Windsurf se lo habilite;
  si no, usa Claude Code para las fases que requieran ejecutar tests reales.
- Si vas a alternar entre ambos modelos en distintas fases (por ejemplo, uno
  para el motor gráfico y otro para el solver), dile explícitamente al inicio
  de cada sesión nueva que lea los documentos de diseño Y el resumen de fases
  ya completadas (pídele a la sesión anterior que te escriba ese resumen antes
  de cerrar), para no perder contexto de una IA a otra.
- La Fase 1 (ver más abajo) debe usar el flujo de `10-ANALIZADOR-IA-FONDOS.md`:
  como tú ya tienes las imágenes de fondo, el agente debe implementar el paso
  de análisis con un modelo de visión (puede ser una llamada a la propia API
  de Claude con visión, o al modelo de visión de GLM, según cuál tengáis
  configurado) y NO pedirte que dibujes las zonas a mano salvo como fallback
  de revisión/corrección cuando la confianza del análisis sea baja.

---

## PROMPT

```
Eres un ingeniero de software senior especializado en motores de juego 2D,
generación procedural de contenido y sistemas de validación automática
(solvers). Vas a construir, de forma iterativa y en bucle hasta que todo pase
los tests, un juego de puzzles tipo "Wappo" con niveles infinitos generados
proceduralmente, siguiendo EXACTAMENTE la arquitectura descrita en los
siguientes documentos de diseño (que tienes disponibles en el repositorio):

- 01-ARQUITECTURA-GENERAL.md
- 02-MOTOR-GRAFICO.md
- 03-GENERADOR-NIVELES.md
- 04-SOLVER-VALIDADOR.md
- 05-REGLAS-MOTOR-JUEGO.md
- 06-ESQUEMAS-JSON.md
- 07-MUNDOS-TEMATICAS.md
- 08-AUDIO-NOTAS.md
- 10-ANALIZADOR-IA-FONDOS.md

Lee estos documentos completos ANTES de escribir una sola línea de código.
Si algo es ambiguo, elige la interpretación más simple y explícita que cumpla
la "regla de oro" repetida en varios documentos:

  "La IA/el generador proponen. El motor de reglas y el solver deciden.
   Ningún nivel llega al jugador sin pasar todos los tests de geometría,
   alineación y resolubilidad."

STACK Y RESTRICCIONES TÉCNICAS
- Repositorio del proyecto: https://github.com/santo-oficio/Runika 2D.git
- Stack a usar: <STACK_ELEGIDO> (ej. "Godot 4 + GDScript", "TypeScript + Canvas/
  PixiJS", "Unity + C#"). Si no se especifica, usa TypeScript puro (sin
  frameworks pesados) para máxima portabilidad y facilidad de testear.
- Carpeta de assets de entrada (fondos e imágenes ya creadas): están en la
  carpeta raíz del proyecto llamada `background` (ej. `background/*.png`).
  Si la estructura de proyecto que definas en la Fase 0 requiere organizarlas
  de otra manera (por subcarpeta de mundo, por ejemplo), MUEVE tú mismo esas
  imágenes a donde las necesites y actualiza todas las referencias de ruta en
  el código y en los JSON de `BackgroundTemplate` que generes. No le pidas al
  usuario que las mueva ni que te las vuelva a pasar.
- El pixel art NUNCA debe escalarse de forma no entera ni con tamaños de celda
  fuera de la lista `allowedCellSizes` de cada plantilla de fondo.
- Todas las coordenadas de zonas de fondo son relativas (0.0–1.0), nunca
  píxeles absolutos hardcodeados.

PLAN DE TRABAJO (respeta este orden, no saltes fases)

FASE 0 — Setup
- Crea la estructura de carpetas del proyecto reflejando los módulos:
  /background (analizador de plantillas), /layout (screen layout),
  /generator (level generator), /solver (validador/solver),
  /assets-resolver (auto-tiling), /engine (motor de reglas), /worlds
  (configuración por mundo), /schemas (JSON schemas o tipos), /tests.
- Define los tipos/esquemas de datos exactamente como en 06-ESQUEMAS-JSON.md
  (BackgroundTemplate, LevelMap, ValidationResult, WorldConfig, banco de
  niveles). Escribe tests unitarios que validen que un JSON de ejemplo de cada
  esquema parsea correctamente.

FASE 1 — Motor gráfico (02-MOTOR-GRAFICO.md + 10-ANALIZADOR-IA-FONDOS.md)
- Implementa el analizador de plantillas de fondo como una herramienta
  CLI/offline que, para cada imagen en `assets/backgrounds/<MUNDO>/bg_01.jpg`,
  usa **MobileSAM** (segmentación, ver 10-ANALIZADOR-IA-FONDOS.md) para
  localizar el tablero 6×5 y producir `board-detection.json`. No uses VLM ni
  CV clásica: MobileSAM con box prompts es la opción validada.
- Implementa los chequeos automáticos de la sección 5 de
  10-ANALIZADOR-IA-FONDOS.md (boardArea dentro de límites, proporción ~6:5,
  boardSize = [6,5]) como funciones testeables independientes del modelo.
- Implementa la demo visual de calibración (demo-server.ts + demo.html) con
  selector de casilla retro y ajuste fino (Shift/Ctrl + flechas).
- Implementa el Screen Layout: dado un BackgroundTemplate y una resolución de
  pantalla real, calcula el boardArea en píxeles sin deformar el arte
  (object-fit: contain, sin recortar).
- Implementa el cálculo de rejilla de casillas: dado un boardArea en píxeles y
  6×5, calcula cellWidth/cellHeight eligiendo SOLO valores de
  `allowedCellSizes`, y centra el tablero.
- Implementa el Asset Resolver (auto-tiling): dado un LevelMap ya validado y un
  WorldConfig, produce la lista de sprites a dibujar por celda según vecinos.
- Escribe tests que verifiquen: (a) ninguna celda cae fuera del boardArea,
  (b) el tamaño de celda elegido está siempre en la lista permitida,
  (c) el auto-tiling asigna un sprite a cada combinación de vecinos posible.

FASE 2 — Generador de niveles (03-GENERADOR-NIVELES.md)
- Implementa el Level Generator: dado un seed, un WorldConfig y un
  BackgroundTemplate, produce un LevelMap siguiendo los arquetipos de forma
  (RECTÁNGULO, L, T, CRUZ, PASILLO, CÁMARA_CENTRAL, ANILLO, DOBLE_PASILLO,
  LABERINTO, IRREGULAR) y las reglas de población de entidades descritas.
- Garantiza que la generación es determinista: la misma seed produce siempre
  el mismo LevelMap.
- Escribe tests que generen cientos de seeds y verifiquen invariantes básicas
  (jugador y objetivo existen y son únicos, no hay solapamiento de entidades,
  el tablero cabe en el boardArea).

FASE 3 — Motor de reglas (05-REGLAS-MOTOR-JUEGO.md)
- Implementa la API mínima del motor: Player.Move, IsValidMove, Enemy.Move,
  CanEnemyReachPlayer, IsLevelSolved, IsLevelFailed, exactamente como se
  describe. Debe poder ejecutarse en modo "headless" (sin renderizado) para
  que el solver lo reutilice tal cual.
- Escribe tests unitarios de cada función de reglas por separado (movimiento
  válido/ inválido, colisión con pared, colisión con enemigo, condición de
  victoria) antes de conectar nada con el generador.

FASE 4 — Solver / Validador (04-SOLVER-VALIDADOR.md)
- Implementa el solver de resolubilidad reutilizando LITERALMENTE las mismas
  funciones del motor de reglas de la Fase 3 (no una reimplementación
  paralela). Usa BFS para garantizar la solución más corta; añade límite de
  profundidad/tiempo configurable.
- Implementa el checklist completo de 10 puntos de 04-SOLVER-VALIDADOR.md como
  funciones de validación independientes y componibles, cada una con su propio
  test.
- Implementa el puntuador de dificultad combinando longitud de solución,
  número de enemigos, complejidad geométrica del arquetipo, tal como se
  describe.
- Escribe un test de integración: generar 1.000 seeds con el generador de la
  Fase 2, pasarlas todas por el validador completo, y verificar que:
    (a) el sistema no crashea con ninguna,
    (b) se acepta un porcentaje razonable (define un umbral, ej. >20%; si es
        muy bajo, ajusta los parámetros del generador, no el validador),
    (c) todos los niveles aceptados cumplen el checklist de 10 puntos al 100%.

FASE 5 — Integración y banco de niveles
- Implementa el pipeline de generación por lotes: generar N seeds → validar →
  guardar en un banco de niveles indexado (ver esquema "banco de niveles" en
  06-ESQUEMAS-JSON.md).
- Implementa la lógica de progresión: servir niveles del banco según la tabla
  de dificultad del WorldConfig correspondiente.
- Escribe un test end-to-end: desde una BackgroundTemplate + WorldConfig de
  ejemplo, generar un banco de al menos 100 niveles válidos, renderizar (aunque
  sea en modo texto/ASCII para el test) uno de cada arquetipo, y confirmar que
  el motor de reglas puede completarlos siguiendo la solución encontrada por
  el solver (es decir: reproducir la solución del solver como una partida real
  y comprobar que efectivamente termina en victoria).

FASE 6 — Mundos (07-MUNDOS-TEMATICAS.md)
- Implementa los WorldConfigs de los 8 mundos (ESPACIO, AGUA, TIERRA, FUEGO,
  HIELO, VIENTO, INFRAMUNDO, MAZMORRA) con sus tileAssets, tablero fijo
  [6,5] y tabla de dificultad.
- Verifica que añadir un WorldConfig nuevo NO requiere tocar código del
  generador, solver o motor de reglas (solo configuración/datos). Escríbelo
  como test explícito si es posible (ej. cargar dos WorldConfig distintos y
  confirmar que el mismo pipeline funciona con ambos sin cambios de código).

REGLAS DE TRABAJO EN BUCLE (loop engineering)
1. Después de cada fase, ejecuta TODOS los tests (no solo los nuevos).
2. Si algo falla, corrígelo antes de avanzar a la siguiente fase. No acumules
   deuda "ya lo arreglo después".
3. Al final de cada fase, escribe un resumen breve de: qué se implementó, qué
   tests existen, y el resultado de ejecutarlos (verde/rojo y por qué).
4. Si un test de integración revela que una fase anterior necesita cambios,
   vuelve atrás, corrige, y vuelve a ejecutar TODO el conjunto de tests desde
   el principio antes de continuar.
5. No avances a la Fase N+1 si la Fase N tiene tests en rojo.
6. Al terminar la Fase 5, genera un informe final con este checklist (marca
   cada punto explícitamente como ✅ o ❌ con el motivo):

   [ ] Los esquemas JSON de 06-ESQUEMAS-JSON.md están implementados y testeados
   [ ] El Screen Layout adapta un fondo a al menos dos relaciones de aspecto
       distintas sin deformar el arte ni tocar boardArea/safeArea
   [ ] El cálculo de rejilla usa siempre tamaños de celda permitidos
   [ ] El Asset Resolver resuelve auto-tiling para todos los arquetipos
   [ ] El Level Generator es determinista por seed
   [ ] El motor de reglas tiene tests unitarios independientes del generador
   [ ] El solver reutiliza el motor de reglas (no hay lógica de reglas
       duplicada entre motor y solver)
   [ ] El checklist de 10 puntos de validación está implementado y testeado
   [ ] El test de 1.000 seeds generadas + validadas pasa con una tasa de
       aceptación razonable
   [ ] El banco de niveles se genera, indexa y sirve por progresión de
       dificultad correctamente
   [ ] Añadir un mundo nuevo no requiere cambios de código, solo configuración

No me entregues el proyecto como "terminado" hasta que este checklist esté
100% en ✅. Si algún punto queda en ❌, sigue iterando sobre esa fase
concreta antes de considerar el trabajo cerrado.

Empieza ahora por la FASE 0.
```

---

## Notas sobre el uso de este prompt

- **Por qué en fases y no todo de golpe**: cada fase depende de que la anterior
  esté testeada. Si le pides a la IA "hazme todo el juego" de una sentada,
  suele generar código plausible pero con bugs de integración difíciles de
  rastrear. Forzar el orden y los tests intermedios reduce mucho ese riesgo.
- **Por qué "reutiliza literalmente las mismas funciones del motor de reglas
  en el solver"**: es la garantía técnica de la regla de oro del proyecto. Si
  el solver tuviera su propia copia de las reglas, un día divergirán y
  tendréis niveles "validados" que en el juego real no se pueden completar.
- **Cuándo intervenir tú**: aunque el prompt pide que la IA itere sola hasta
  que los tests pasen, conviene que revises manualmente el resultado de las
  Fases 1 (motor gráfico, para el aspecto visual) y 4 (solver, la pieza más
  delicada) antes de dar luz verde a seguir.
- **Adaptarlo a tu stack final**: si decides usar un motor de juego concreto
  (Godot, Unity, Unreal), sustituye `<STACK_ELEGIDO>` y ten en cuenta que la
  Fase 0 debe adaptarse a las convenciones de proyecto de ese motor (escenas,
  prefabs, etc.), aunque la separación en módulos lógicos se mantiene igual.
