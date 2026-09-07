# Progreso de implementación — Wappo Infinito

Seguimiento fase a fase del plan de `docs/09-SUPER-PROMPT-IMPLEMENTACION.md`.
Cada fase deja aquí un resumen breve: qué se implementó, qué tests existen y
resultado de ejecutarlos. Útil para retomar contexto entre sesiones/modelos.

Stack: **TypeScript puro + Vitest** (sin frameworks pesados), Node ≥ 20, ESM.

---

## FASE 0 — Setup ✅

### Qué se implementó
- **Estructura de carpetas** reflejando los módulos de la arquitectura:
  `background/` (analizador de plantillas), `layout/`, `generator/`,
  `solver/`, `assets-resolver/`, `engine/`, `worlds/`, `schemas/`, `tests/`.
- **Reorganización de fondos**: las 7 imágenes que estaban en `background/`
  se movieron a `assets/backgrounds/<MUNDO>/` (un mundo por carpeta):
  - ESPACIO, FUEGO, HIELO, INFRAMUNDO, TIERRA, VIENTO, CASTILLO_FINAL.
  - `background/` queda vacío para alojar el módulo analizador (Fase 1).
- **Proyecto TypeScript** (`package.json`, `tsconfig.json` con strict +
  `noUncheckedIndexedAccess`, `vitest.config.ts`, `.gitignore`).
- **Esquemas de datos** en `schemas/` fieles a `docs/06-ESQUEMAS-JSON.md` y
  `docs/10-ANALIZADOR-IA-FONDOS.md`:
  - `schemas/types.ts` — tipos: `RelativeRect`, `RelativePoint`, `CellPos`,
    `BoardSize`, `BackgroundTemplate`, `BackgroundTemplateCandidate`,
    `SuggestedGrid`, `DecorativeArea`, `LevelMap`, `Enemy`, `EnemyPattern`,
    `Archetype`, `ValidationResult`, `ValidationChecks`, `SolutionInfo`,
    `WorldConfig`, `TileAssets`, `DifficultyBand`, `LevelBank`,
    `LevelBankEntry`.
  - `schemas/validate.ts` — validadores que reciben `unknown` y devuelven el
    tipo tipado o lanzan `SchemaError` con la ruta del campo problemático.
    Incluye `validateSchema(name, v)` como dispatcher por nombre.
  - `schemas/examples.ts` — ejemplos canónicos de cada esquema (los del doc 06).
  - `schemas/index.ts` — re-exporta todo.

### Tests existentes
- `tests/schemas.test.ts` — **41 tests**:
  - Primitivas (`RelativeRect`, `CellPos`, `BoardSize`): casos válidos e inválidos.
  - `BackgroundTemplate`: ejemplo canónico + 5 casos inválidos (id vacío,
    boardArea fuera de límites, allowedCellSizes vacío, anchorPoints no objeto,
    marginPx negativo).
  - `BackgroundTemplateCandidate`: ejemplo + 3 inválidos (confidence >1,
    columns fuera de rango, columnsRange min>max).
  - `LevelMap`: ejemplo + 6 inválidos (grid filas != height, fila longitud
    != width, player fuera de bounds, archetype inválido, enemy pattern
    inválido, enemy pos fuera de bounds).
  - `ValidationResult`: ejemplo + 4 inválidos (falta clave de checks,
    valid no boolean, difficultyScore negativo, rejectionReason string).
  - `WorldConfig`: ejemplo + 4 inválidos (tileAssets sin floor,
    allowedBoardSizes vacío, difficultyBand range min>max,
    backgroundTemplates vacío).
  - `LevelBank`: ejemplo + 3 inválidos (world vacío, minMoves negativo,
    entry sin seed).
  - `validateSchema` dispatcher: valida los 6 esquemas por nombre y
    devuelve el dato tipado.

### Resultado de ejecutar los tests
- `npm run typecheck` → **verde** (tsc --noEmit sin errores).
- `npm test` → **verde**: 1 archivo, 41 tests pasados, 0 fallos, ~1.4s.

### Notas / decisiones
- Stack por defecto (TS puro) según el prompt, al no especificarse otro.
- Fondos renombrados a rutas `assets/backgrounds/<MUNDO>/<archivo>`; las
  `BackgroundTemplate` que se generen en Fase 1 referenciarán esa ruta.
- Validadores a mano (sin zod) para mantener "sin frameworks pesados" y
  tener mensajes de error con ruta de campo explícitos.
- Los tipos llevan `readonly` en todas las propiedades para fomentar
  inmutabilidad; los tests usan un helper `clone()` con `Mutable<T>` para
  poder construir variantes inválidas.

### Próximo paso
FASE 1 — Motor gráfico (`02-MOTOR-GRAFICO.md` + `10-ANALIZADOR-IA-FONDOS.md`):
analizador de plantillas con IA de visión, validación geométrica post-análisis,
Screen Layout, cálculo de rejilla y Asset Resolver (auto-tiling).

---

## FASE 1 — Motor gráfico ✅

### Qué se implementó
- **Chequeos de sanidad post-análisis** (`background/sanity-checks.ts`):
  los 5 chequeos de `10-ANALIZADOR-IA-FONDOS.md` §5 como funciones
  independientes y testeables (sin IA, geométricas):
  1. `checkBoardAreaWithinSafeArea` — boardArea dentro de safeArea.
  2. `checkBoardAreaProportions` — proporciones razonables (aspect 0.15–6.67,
     cobertura ≤ 90% de la imagen).
  3. `checkAtLeastOneValidCellSize` — algún `allowedCellSize` cabe en
     boardArea para el `suggestedGrid`.
  4. `checkNoExtendableOverlap` — ninguna `decorativeArea` extensible se
     solapa con boardArea.
  5. `checkConfidenceAboveThreshold` — confidence ≥ 0.7 (NO bloqueante:
     marca `needsHumanReview`).
  - `runSanityChecks` integra los 5: `ok` true solo si los 4 geométricos
    pasan; el de confianza solo afecta a `needsHumanReview`.
  - Helpers `rectContains` / `rectsOverlap` exportados para reutilizar.

- **Analizador de fondos** (`background/analyzer.ts`):
  - `buildInstructionPrompt(world, imageId, filename)` — prompt textual del
    doc 10 §4 con los valores esperados inyectados.
  - `extractJson(content)` — extrae JSON de respuesta del modelo (bloque
    ```json``, JSON puro o embebido en prosa, con balanceado de llaves).
  - `analyzeBackground(image, world, imageId, provider, opts)` — flujo
    completo: prompt → vision provider → parseo JSON → validación de
    esquema → sanity checks → `BackgroundTemplate` definitiva (sin
    confidence/notes/suggestedGrid) si pasa.
  - `AnalysisResult` incluye `accepted`, `needsHumanReview`, `template`,
    `sanity`, `parseError`, `raw`.

- **Proveedor de visión pluggable** (`background/vision-provider.ts`):
  - Interfaz `VisionProvider` común (analyze(image, prompt) → response).
  - `MockVisionProvider` — devuelve plantilla preconfigurada (tests/deso).
  - `HttpVisionProvider` — llamada HTTP OpenAI-compatible (Claude/GLM/etc.)
    con `fetch`, sin SDK, clave vía headers inyectados (nunca hardcodeada).

- **CLI offline** (`background/cli.ts`):
  - Recorre `assets/backgrounds/<MUNDO>/`, analiza cada imagen y guarda
    `worlds/templates/<MUNDO>/<ID>.json` si pasa sanidad.
  - `--provider mock|http` (http requiere `VISION_ENDPOINT`, `VISION_MODEL`,
    `VISION_API_KEY` en env).
  - Marca `_review: true` en el JSON si `needsHumanReview`.

- **Screen Layout** (`layout/screen-layout.ts`):
  - `computeScreenLayout(template, screen, imageAspectRatio?)` — coloca el
    fondo manteniendo aspect ratio nativo (sin estirar): modo `exact`,
    `pillarbox` o `letterbox`. Proyecta safeArea, boardArea,
    decorativeAreas y anchorPoints a píxeles.

- **Cálculo de rejilla** (`layout/grid.ts`):
  - `computeGridLayout(boardAreaPx, cols, rows, allowedCellSizes, opts)` —
    elige `cellWidth`/`cellHeight` SOLO de `allowedCellSizes` (celdas
    cuadradas, sin deformación), con estrategias `largest`/`smallest`/
    `nearest`. Centra el tablero dentro del boardArea.
  - `hasValidCellSize`, `validCellSizes`, `isBoardWithinArea` (con margen).

- **Asset Resolver / Auto-tiling** (`assets-resolver/auto-tiling.ts`):
  - `computeNeighborMask` — máscara 8-vecinos (4-adyacentes + 4 diagonales).
  - `classifyFloorSprite` — clasifica suelo en interior / borde / esquina /
    península / aislado según vecinos.
  - `resolveSprite` / `resolveAllSprites` — traduce cada celda del LevelMap
    a un asset del `WorldConfig.tileAssets` (con fallback si faltan assets
    opcionales como obstacle/door/key).
  - `isTilingFullyResolved` — verifica que toda celda tiene asset válido.

### Tests existentes (84 nuevos, 125 total)
- `tests/background-sanity.test.ts` (20): helpers rect, los 5 chequeos
  individuales, `runSanityChecks` con casos válidos/inválidos/umbral.
- `tests/background-analyzer.test.ts` (12): prompt, `extractJson` (4 casos),
  flujo completo con mock (aceptado, needsHumanReview, rechazado, JSON
  inválido, template sin campos de análisis).
- `tests/layout.test.ts` (18): Screen Layout (exact/pillarbox/letterbox,
  proyección de zonas, no deformación) y rejilla (tamaño siempre permitido,
  tablero dentro de boardArea, centrado, estrategias, errores).
- `tests/assets-resolver.test.ts` (34): CHAR_TO_CELL, neighbor mask,
  `classifyFloorSprite` para las 13 combinaciones de vecinos, resolveSprite
  por tipo de celda, resolveAllSprites, e `isTilingFullyResolved` sobre un
  grid de cada uno de los 10 arquetipos del doc 03 (requisito c).

### Resultado de ejecutar los tests
- `npm run typecheck` → **verde**.
- `npm test` → **verde**: 5 archivos, 125/125 tests pasados, ~0.7s.

### Notas / decisiones
- El analizador es pluggable: el modelo de visión real (Claude/GLM) se
  inyecta vía `VisionProvider`. Sin clave API, el CLI usa `--provider mock`
  para desarrollo. La llamada HTTP real se hace con `fetch` (sin SDK
  pesada), leyendo credenciales de env vars (nunca en código).
- Umbrales de sanidad ajustados tras iteración: `minBoardAreaAspect=0.15`
  (aspect 6.67 máx) y `maxBoardAreaCoverage=0.9` para que los casos
  degenerados del doc 10 §5.2 (línea de 1px, boardArea que ocupa todo)
  se rechacen correctamente.
- Auto-tiling con celdas cuadradas (cellWidth===cellHeight) para garantizar
  alineación perfecta del pixel-art. El set mínimo de assets del mundo
  cubre interior + 4 bordes + 4 esquinas; las categorías península/aislado
  caen a `floor` (sprite de suelo) como fallback razonable.
- El test del arquetipo IRREGULAR usa un grid con filas de longitudes
  distintas validado por el esquema (cada fila debe medir `width`), así que
  los arquetipos irregulares se representan con `#` internos, no con filas
  de longitudes variables. Esto se revisará en Fase 2 (generador).

### Próximo paso
FASE 2 — Generador de niveles (`03-GENERADOR-NIVELES.md`): dado un seed, un
WorldConfig y un BackgroundTemplate, produce un LevelMap determinista
siguiendo los 10 arquetipos y las reglas de población de entidades.

---

## FASE 2 — Generador de niveles ✅

### Qué se implementó
- **RNG determinista** (`generator/rng.ts`): mulberry32 con API cómoda
  (`next`, `int`, `chance`, `pick`, `shuffle`). Misma seed → misma secuencia.

- **10 arquetipos de forma** (`generator/archetypes.ts`): cada uno genera un
  grid `width × height` con borde de paredes y celdas `.`/`#`:
  RECTANGULO, L, T, CRUZ, PASILLO, CAMARA_CENTRAL, ANILLO, DOBLE_PASILLO,
  LABERINTO (recursive division), IRREGULAR (bloques aleatorios).
  - `generateArchetypeGrid(archetype, w, h, rng)` dispatcher.
  - Helpers `gridToStrings`, `countFloor`, `floorCells`.

- **Pre-filtro topológico** (`generator/topology.ts`): BFS barato para
  verificar camino jugador→objetivo antes del solver completo.
  - `hasPath`, `bfsDistance`, `manhattan`.

- **Población de entidades** (`generator/populate.ts`): coloca jugador,
  objetivo, enemigos, obstáculos, puertas y llaves respetando:
  - distancia mínima jugador-objetivo y jugador-enemigo,
  - nº de enemigos según la franja de dificultad del WorldConfig,
  - pre-filtro topológico (camino jugador→objetivo obligatorio),
  - sin solapamiento entre entidades.
  - `optionsFromWorld(world, levelNumber)` deriva opciones desde la tabla
    de dificultad (enemyCount, obstacleCount, doorCount, keyCount,
    distancias mínimas escaladas por estrellas).

- **Level Generator** (`generator/generator.ts`):
  - `generateLevel(params)` orquesta: arquetipo (aleatorio o forzado) →
    tamaño (de `world.allowedBoardSizes` que quepa en `boardArea` con algún
    `allowedCellSize`) → grid del arquetipo → población → pre-filtro →
    serializa `LevelMap`.
  - Determinista: misma seed + mismo world + mismo background = mismo LevelMap.
  - Reintentos con sub-seed si la generación falla (pre-filtro o población).
  - `checkLevelInvariants(level)` verifica jugador/objetivo únicos, sin
    solapamiento, entidades en bounds, chars del grid coherentes.

### Tests existentes (76 nuevos, 201 total)
- `tests/generator-rng.test.ts` (11): determinismo, rangos, chance, pick,
  shuffle, seed expuesta.
- `tests/generator-archetypes.test.ts` (27): los 10 arquetipos × (tamaño
  correcto, borde, suelo > 0, determinismo) + invariantes específicas
  (RECTANGULO interior, PASILLO banda, CRUZ centro, ANILLO perímetro,
  LABERINTO muros internos) + errores.
- `tests/generator-populate.test.ts` (17): manhattan, hasPath/bfsDistance,
  población (jugador/objetivo únicos con camino, distancia mínima,
  nº enemigos, distancia jugador-enemigo, sin solapamiento, obstáculos,
  error sin celdas) + `optionsFromWorld` por franja.
- `tests/generator.test.ts` (21): determinismo (misma seed = mismo nivel,
  seeds distintas = niveles distintos), **300 seeds** verificando
  (esquema válido, invariantes, camino topológico, tamaño en
  allowedBoardSizes, tablero cabe en boardArea, nº enemigos ≤ maxEnemies,
  filas de longitud == width), los 10 arquetipos forzados, y errores
  (world != background.world, boardArea demasiado pequeño).

### Resultado de ejecutar los tests
- `npm run typecheck` → **verde**.
- `npm test` → **verde**: 9 archivos, 201/201 tests pasados, ~1.2s.
  - Los 300 seeds generan niveles válidos con todas las invariantes.

### Notas / decisiones
- El generador es determinista pero con reintentos: si una sub-seed produce
  un nivel sin camino jugador→objetivo (raro en arquetipos abiertos, posible
  en LABERINTO/CAMARA_CENTRAL), se reintenta con `seed*1000 + attempt`.
  Esto mantiene determinismo (la seed original sigue decidiendo el resultado
  final) pero mejora la tasa de éxito.
- `optionsFromWorld` usa la tabla `difficultyTable` del WorldConfig para
  derivar enemyCount/obstacleCount/doorCount/keyCount escalados por estrellas.
  Esto satisface el requisito "añadir mundo nuevo = solo configuración" de
  la Fase 6: cambiar la tabla cambia la población sin tocar código.
- El pre-filtro topológico (BFS) es el "pre-filtro rápido y barato" del
  doc 03 §2. El solver completo (BFS sobre espacio de estados con enemigos)
  se implementa en la Fase 4 y reutiliza el motor de reglas de la Fase 3.
- `pickBoardSize` usa una resolución de referencia 1920x1080 para verificar
  que el tablero cabe. En la Fase 5 (integración) se podrá pasar la
  resolución real del dispositivo.

### Próximo paso
FASE 3 — Motor de reglas (`05-REGLAS-MOTOR-JUEGO.md`): implementar la API
mínima (Player.Move, IsValidMove, Enemy.Move, CanEnemyReachPlayer,
IsLevelSolved, IsLevelFailed) en modo headless para que el solver la
reutilice literalmente en la Fase 4.

---

## FASE 3 — Motor de reglas ✅

### Qué se implementó
- **Tipos y estado headless** (`engine/state.ts`):
  - `Direction` (UP/DOWN/LEFT/RIGHT), `DIRECTION_DELTA`.
  - `EnemyState` (pos, pattern, patrolRoute, step).
  - `GameState` serializable y determinista: grid, player, goal, enemies,
    keysCollected, doorsOpen, turn, solved, failed, failureReason.
  - `createInitialState(level)` construye el estado desde un LevelMap.
  - `cloneState(state)` clonación profunda para el solver (BFS sobre
    estados sin mutar el original).
  - `stateKey(state)` clave canónica para poda de estados repetidos.

- **Reglas** (`engine/rules.ts`) — API mínima del doc 05 §2:
  - `isValidMove(state, pos, direction)`: valida límites, paredes,
    obstáculos, puertas cerradas, y que no haya enemigo en destino.
  - `playerMove(state, direction)`: abre puertas adyacentes con llaves
    ANTES de validar (para poder cruzar en el mismo turno), recoge llaves,
    mueve al jugador.
  - `enemyMove(state, idx, rng)`: 4 patrones (doc 05 §4):
    - PATRULLA_FIJA: sigue route[] cíclicamente.
    - PERSECUCION_SIMPLE: un paso hacia el jugador (prioriza eje con
      mayor distancia Manhattan).
    - ALEATORIO_ACOTADO: celda adyacente transitable al azar.
    - VIGILANCIA_ZONA: no se mueve.
    - Los enemigos pueden capturar al jugador (moverse onto su celda).
  - `canEnemyReachPlayer(state, idx)`: BFS de amenaza (distancia en
    pasos o Infinity). Usado por el solver y el validador.
  - `isLevelSolved(state)`: jugador en G.
  - `isLevelFailed(state)`: algún enemigo en la celda del jugador.
  - `playTurn(state, direction, rng)`: bucle de turno completo (doc 05 §3):
    player move → check victoria → enemy moves → check derrota → check
    victoria → turno++.
  - `replayMoves(state, moves, rng)`: reproduce una secuencia (para el
    test end-to-end de la Fase 5).

### Tests existentes (35 nuevos, 236 total)
- `tests/engine.test.ts` (35):
  - `isValidMove` (7): suelo, límites, pared, obstáculo, puerta
    cerrada/abierta, enemigo en destino.
  - `playerMove` (5): movimiento válido/inválido, recogida de llave,
    apertura de puerta adyacente con llave, no mueve si finalizado.
  - `enemyMove` (7): VIGILANCIA no se mueve, PERSECUCION un paso hacia
    jugador + prioriza eje, ALEATORIO celda adyacente, PATRULLA sigue
    ruta, no se mueve onto otro enemigo, no se mueve onto pared.
  - `canEnemyReachPlayer` (3): distancia con camino, 0 si ya en jugador,
    Infinity sin camino.
  - `isLevelSolved/isLevelFailed` (4): victoria en G, derrota por
    colisión con enemigo.
  - `playTurn` (4): victoria sin enemigos, derrota por enemigo que
    persigue, no procesa tras finalizar, incrementa turno.
  - `replayMoves` (2): reproduce hasta victoria, detiene en derrota.
  - `cloneState/stateKey` (3): copia independiente, misma clave para
    estados idénticos, distinta clave para estados distintos.

### Resultado de ejecutar los tests
- `npm run typecheck` → **verde**.
- `npm test` → **verde**: 10 archivos, 236/236 tests pasados, ~1.3s.

### Notas / decisiones
- **Apertura de puertas**: `openAdjacentDoors` se ejecuta ANTES de
  `isValidMove` dentro de `playerMove`, para que el jugador pueda cruzar
  una puerta en el mismo turno que la abre (si ya está adyacente con
  llave). Cada llave abre una puerta y se consume del inventario.
- **Captura de jugador**: los enemigos pueden moverse onto la celda del
  jugador (eso es la captura). `isWalkableForEnemy` lo permite
  explícitamente. La derrota se detecta con `isLevelFailed` después del
  movimiento de enemigos.
- **Determinismo para el solver**: `playTurn` acepta un `Rng` inyectado
  para que los enemigos ALEATORIO_ACOTADO sean deterministas en la
  simulación del solver. `cloneState` y `stateKey` permiten BFS sobre el
  espacio de estados sin mutar el original y con poda de repetidos.
- **Sin lógica duplicada**: el solver de la Fase 4 reutilizará
  LITERALMENTE `playTurn`, `isLevelSolved`, `isLevelFailed` y `cloneState`
  — no habrá una segunda implementación de las reglas (regla de oro).

### Próximo paso
FASE 4 — Solver / Validador (`04-SOLVER-VALIDADOR.md`): BFS de
resolubilidad reutilizando el motor de reglas, checklist de 10 puntos,
puntuador de dificultad, y test de integración con 1.000 seeds.

---

## FASE 4 — Solver / Validador ✅

### Qué se implementó
- **Checklist de 10 chequeos** (`solver/checklist.ts`) — cada uno
  independiente y componible, con su propio test:
  1. `checkWithinBoardArea`: el tablero cabe en `boardArea` con algún
     `allowedCellSize` (resolución ref 1920x1080).
  2. `checkGridAligned`: todas las filas tienen longitud == width.
  3. `checkNoDecorationOverlap`: `boardArea` no se solapa con
     `decorativeAreas` no extensibles.
  4. `checkTilingResolved`: el auto-tiling tiene sprite para cada celda.
  5. `checkEntitiesFit`: entidades dentro de bounds, no solapadas, no
     sobre pared.
  6. `checkNoImpossiblePositions`: jugador y objetivo tienen vecino
     transitable, y existe camino topológico jugador→objetivo.
  7. `checkSolvable` / `solveLevel`: BFS sobre el espacio de estados del
     puzzle, **reutilizando LITERALMENTE** `playTurn`, `isLevelSolved`,
     `isLevelFailed`, `cloneState` y `stateKey` del motor de reglas
     (regla de oro: lo que se valida es lo que se juega — NO hay
     reimplementación paralela de las reglas).
  8. `checkDifficultyInRange`: `minMoves` dentro del rango esperado para
     la franja de dificultad (estrellas × [2, 20]).
  9. `checkNotTrivial`: `minMoves > 1` salvo nivel tutorial.
  10. `checkNoAbsurdSituations`: al menos un enemigo persecutorio puede
      alcanzar al jugador (amenaza real).

- **Solver de resolubilidad** (`solveLevel`):
  - BFS garantiza optimalidad (solución más corta).
  - Límites configurables: `maxDepth` (profundidad máxima) y `maxStates`
    (poda de exploración). Defaults: 100 y 200.000.
  - RNG determinista inyectado por nivel (seed del LevelMap) para que
    los enemigos ALEATORIO_ACOTADO sean deterministas en la simulación.
  - Devuelve `SolverResult` con `solvable`, `minMoves`, `solution`,
    `reason` y `statesExplored`.

- **Puntuador de dificultad** (`computeDifficultyScore`):
  - Combina 5 factores normalizados a 0–10:
    - longitud de solución (0–4 puntos, ~50 movimientos).
    - nº de enemigos (0–2 puntos).
    - complejidad geométrica del arquetipo (0–2 puntos, RECTANGULO=0.2,
      LABERINTO=2.0).
    - ramas falsas (0–1.5 puntos, estados explorados / solución).
    - márgenes de error (0–0.5 puntos, inverso de densidad de suelo).

- **Validador completo** (`solver/validate.ts`):
  - `validateLevel(level, world, background, opts)` orquesta los 10
    chequeos en orden "fallar rápido" (geométricos 1–6 primero, solver
    7 solo si los geométricos pasan, 8–10 solo si el solver encuentra
    solución).
  - Devuelve `ValidationResult` conforme al esquema JSON (doc 06 §3):
    `levelId`, `valid`, `checks`, `solution` (minMoves + path),
    `difficultyScore`, `rejectionReason`.

### Tests existentes (42 nuevos, 278 total)
- `tests/solver.test.ts` (39):
  - 10 chequeos × casos positivos y negativos.
  - `solveLevel` (6): resolución simple, ya-resuelto, sin camino,
    maxDepth, maxStates, solución reproducible.
  - `checkSolvable` (1).
  - `checkDifficultyInRange` (3): en rango, demasiado bajo, demasiado alto.
  - `checkNotTrivial` (3): >1, ≤1 no tutorial, ≤1 tutorial.
  - `checkNoAbsurdSituations` (3): sin enemigos, con amenaza, sin amenaza.
  - `computeDifficultyScore` (3): no resoluble=0, en rango 0–10,
    RECTANGULO < LABERINTO.
  - `runChecklist` (3): válido pasa todo, sin camino falla geométrico,
    tablero grande falla withinBoardArea.
  - `validateLevel` (2): válido con todos los campos, inválido con
    rejectionReason.

- `tests/solver-integration.test.ts` (3):
  - **1.000 seeds**: no crashea (0 throws), 848/1000 aceptados (84.8%),
    0 falsos positivos (todos los aceptados cumplen checklist al 100%).
  - **200 seeds sin enemigos**: 187/200 aceptados (93.5%) — el solver
    funciona bien sin complejidad de enemigos.

### Resultado de ejecutar los tests
- `npm run typecheck` → **verde**.
- `npm test` → **verde**: 12 archivos, 278/278 tests pasados, ~1.7s.
  - 1.000 seeds en ~700ms (solver con maxDepth=60, maxStates=50.000).

### Notas / decisiones
- **Regla de oro cumplida**: el solver reutiliza LITERALMENTE `playTurn`,
  `isLevelSolved`, `isLevelFailed`, `cloneState` y `stateKey` del motor
  de reglas. No hay una segunda implementación de las reglas. Lo que se
  valida es exactamente lo que se juega.
- **Estrategia "fallar rápido"**: los 6 chequeos geométricos (baratos)
  se ejecutan primero. Si alguno falla, no se ejecuta el solver (caro).
  Esto hace que el validador sea eficiente incluso con niveles
  claramente inválidos.
- **Tasa de aceptación del 84.8%** con 1.000 seeds y levelNumber=10
  (1 enemigo, stars=1). Los ~15% de rechazos se deben principalmente a:
  - `difficultyInRange`: minMoves fuera de rango para stars=1 (demasiado
    corto por enemigo que bloquea o demasiado largo por laberinto).
  - `notTrivial`: solución en 1 movimiento (raro pero posible).
  - `solvable`: no se encontró solución dentro de maxDepth=60 (niveles
    con enemigos persecutorios que crean espacio de estados grande).
- **Sin falsos positivos**: los 848 niveles aceptados cumplen los 10
  chequeos al 100% (verificado por el test).
- **Solver determinista**: usa `createRng(level.seed + depth)` para que
  los enemigos ALEATORIO_ACOTADO sean deterministas en la simulación.
  Misma seed + mismo nivel = misma solución.

### Próximo paso
FASE 5 — Mundos, configuración, bancos de niveles y generación por lotes
(`07-MUNDOS-TEMATICAS.md`): definir los 7 mundos temáticos (ESPACIO,
FUEGO, HIELO, INFRAMUNDO, TIERRA, VIENTO, CASTILLO_FINAL), sus
WorldConfigs, tablas de dificultad, y generación por lotes de bancos de
niveles validados.

---

## FASE 5 — Integración y banco de niveles ✅

### Qué se implementó
- **Pipeline de generación por lotes** (`worlds/level-bank.ts`):
  - `generateLevelBank(world, backgrounds, opts)`: genera N seeds, valida
    cada nivel con el validador completo, y guarda solo los válidos en un
    `LevelBank` indexado y ordenado por dificultad.
  - Devuelve `BankGenerationResult` con `bank`, `accepted`, `rejected`,
    `acceptanceRate`, `rejectionReasons` (categorizadas) y `validLevels`.
  - Opciones configurables: `seedCount`, `seedBase`, `levelNumber`,
    `solverOptions`, `isTutorial`, resolución de referencia.

- **Lógica de progresión** (`serveLevel`):
  - `serveLevel(bank, world, levelNumber)`: encuentra la franja de
    dificultad del WorldConfig que contiene `levelNumber`, y sirve un
    nivel del banco cuya puntuación esté en el rango esperado para esa
    franja. Rota por `levelNumber` dentro del rango.
  - Si no hay niveles en el rango exacto, sirve el más cercano.
  - `loadLevelFromBankEntry(entry, world, background, levelNumber)`:
    reconstruye el `LevelMap` desde la seed (determinismo garantizado).

- **Renderizado ASCII** (`worlds/ascii-render.ts`):
  - `renderAscii(level)`: tablero con marco Unicode + metadata.
  - `renderAsciiWithSolution(level, solution)`: muestra el camino del
    jugador con números sobre el grid.

### Tests existentes (22 nuevos, 300 total)
- `tests/worlds.test.ts` (22):
  - **Fase 5 — Banco de niveles** (4): genera ≥100 niveles válidos para
    ESPACIO, `serveLevel` devuelve nivel apropiado para cada número,
    `serveLevel` devuelve null si banco vacío, `loadLevelFromBankEntry`
    reconstruye el nivel desde la seed.
  - **Fase 5 — Renderizado ASCII** (2): `renderAscii` produce
    representación legible, `renderAsciiWithSolution` muestra el camino.
  - **Fase 5 — Reproducir solución del solver** (10): para cada uno de
    los 10 arquetipos, genera un nivel resoluble, lo resuelve con el
    solver, reproduce la solución como partida real con el motor de
    reglas, y verifica que termina en victoria (`solved=true`,
    `failed=false`).
  - **Fase 6 — Añadir mundo nuevo** (6): FUEGO registrado y válido, el
    mismo pipeline funciona con ESPACIO y FUEGO sin cambios de código,
    `WORLD_REGISTRY` tiene ≥2 mundos, FUEGO tiene tabla de dificultad
    distinta (empieza en stars=2), FUEGO tiene tileAssets distintos,
    `getWorld` devuelve null para mundo inexistente.

### Resultado de ejecutar los tests
- `npm run typecheck` → **verde**.
- `npm test` → **verde**: 13 archivos, 300/300 tests pasados, ~1.9s.
  - Banco ESPACIO: 428/500 aceptados (85.6%).
  - Los 10 arquetipos: la solución del solver termina en victoria al
    reproducirla con el motor de reglas.
  - Fase 6: ESPACIO 86/100, FUEGO 79/100 — mismo pipeline sin cambios
    de código.

---

## FASE 6 — Mundos ✅

### Qué se implementó
- **WorldConfig completo de ESPACIO** (`worlds/configs.ts`):
  - 2 BackgroundTemplates (SPACE_01, SPACE_02) con boardArea,
    safeArea, allowedCellSizes, anchorPoints, decorativeAreas.
  - TileAssets completo: floor, 4 wall edges, 4 wall corners, player,
    5 enemy variants (default, patrol, chase, random, vigilance),
    goal, key, door, obstacle.
  - 5 tamaños de tablero permitidos: [6,5], [7,6], [8,6], [8,8], [10,8].
  - Tabla de dificultad de 5 franjas (1-10 stars=1, 11-25 stars=2,
    26-50 stars=3, 51-100 stars=4, 101-200 stars=5).

- **WorldConfig de FUEGO** (mundo avanzado, solo configuración):
  - 1 BackgroundTemplate (FIRE_01).
  - TileAssets propios (fire_floor, fire_player, etc.).
  - 5 tamaños de tablero (empieza en [7,6], más grande que ESPACIO).
  - Tabla de dificultad más alta (empieza en stars=2, maxEnemies=1).

- **Registro de mundos** (`WORLD_REGISTRY` + `getWorld(name)`):
  - Carga dinámica por nombre. Añadir mundo = añadir entrada al registro.

### Verificación de la regla "añadir mundo = solo configuración"
- El test `Fase 6 — Añadir mundo nuevo sin tocar código` genera bancos
  para ESPACIO y FUEGO usando el MISMO pipeline (`generateLevelBank` +
  `validateLevel` + `generateLevel`), sin ningún cambio de código entre
  mundos. Solo cambia el `WorldConfig` y las `BackgroundTemplates`.
- Confirmado: generador, solver y motor de reglas son los mismos para
  todos los mundos. Lo que cambia es el contenido (assets, tabla de
  dificultad, plantillas de fondo).

---

## INFORME FINAL — Checklist de cierre (doc 09 §6)

- [x] **Los esquemas JSON de 06-ESQUEMAS-JSON.md están implementados y
      testeados** — 41 tests en `tests/schemas.test.ts` cubren
      BackgroundTemplate, LevelMap, ValidationResult, WorldConfig,
      LevelBank y validación de ejemplos canónicos.
- [x] **El Screen Layout adapta un fondo a al menos dos relaciones de
      aspecto distintas sin deformar el arte ni tocar boardArea/safeArea**
      — 18 tests en `tests/layout.test.ts` cubren letterbox, pillarbox,
      preservación de aspecto, y proyección de safeArea/boardArea.
- [x] **El cálculo de rejilla usa siempre tamaños de celda permitidos**
      — `layout/grid.ts` solo usa `allowedCellSizes` del
      BackgroundTemplate; tests verifican que nunca se genera un
      cellSize arbitrario.
- [x] **El Asset Resolver resuelve auto-tiling para todos los
      arquetipos** — 34 tests en `tests/assets-resolver.test.ts` cubren
      floor interior, bordes, esquinas, isolated/peninsula, player,
      enemy, goal, y fallback. El test de Fase 5 verifica que los 10
      arquetipos generan niveles cuyo tiling pasa `checkTilingResolved`.
- [x] **El Level Generator es determinista por seed** — 21 tests en
      `tests/generator.test.ts` verifican que misma seed = mismo LevelMap
      sobre 300 seeds, y seeds distintas = niveles distintos.
- [x] **El motor de reglas tiene tests unitarios independientes del
      generador** — 35 tests en `tests/engine.test.ts` construyen
      LevelMaps a mano (sin generador) y testean isValidMove, playerMove,
      enemyMove (4 patrones), canEnemyReachPlayer, isLevelSolved,
      isLevelFailed, playTurn, replayMoves, cloneState, stateKey.
- [x] **El solver reutiliza el motor de reglas (no hay lógica de reglas
      duplicada entre motor y solver)** — `solver/checklist.ts` importa
      y usa LITERALMENTE `playTurn`, `isLevelSolved`, `isLevelFailed`,
      `cloneState`, `stateKey` de `engine/`. No hay segunda
      implementación de las reglas.
- [x] **El checklist de 10 puntos de validación está implementado y
      testeado** — 39 tests en `tests/solver.test.ts` cubren cada uno de
      los 10 chequeos por separado + integración.
- [x] **El test de 1.000 seeds generadas + validadas pasa con una tasa
      de aceptación razonable** — `tests/solver-integration.test.ts`:
      848/1000 aceptados (84.8%), 0 crasheos, 0 falsos positivos.
- [x] **El banco de niveles se genera, indexa y sirve por progresión de
      dificultad correctamente** — `tests/worlds.test.ts`: banco de
      ≥100 niveles, `serveLevel` sirve por franja de dificultad,
      `loadLevelFromBankEntry` reconstruye desde seed.
- [x] **Añadir un mundo nuevo no requiere cambios de código, solo
      configuración** — `tests/worlds.test.ts` Fase 6: ESPACIO y FUEGO
      funcionan con el mismo pipeline sin cambios de código.

### Resumen final
- **300 tests en verde** (13 archivos), typecheck en verde.
- **Pipeline completo**: esquemas → análisis de fondos → layout → grid →
  generación → motor de reglas → solver/validador → banco de niveles →
  mundos.
- **Determinismo garantizado**: misma seed = mismo nivel = misma solución.
- **Regla de oro cumplida**: lo que se valida es lo que se juega (solver
  reutiliza el motor de reglas literalmente).
- **Añadir mundo = solo datos**: WorldConfig + BackgroundTemplates, sin
  tocar generador/solver/motor.

---

## FASE 7 — Detección de tableros con MobileSAM ✅

### Qué se implementó
- **MobileSAM** instalado en `.sam-venv` (Python 3.11, torch 2.1.2+cu121,
  mobile_sam, opencv 4.8, numpy 1.26, timm).
- **Modelo** `models/mobile_sam.pt` (~40MB, TinyViT).
- **Script Python** `background/sam-detect.py`:
  - Prueba ~270 cajas candidatas centradas con diferentes tamaños y
    offsets.
  - Pasa cada caja como *box prompt* a MobileSAM.
  - Evalúa cada máscara por: aspecto 6:5, rectangularidad, y fuerza del
    grid interno (Sobel sobre líneas de 6 columnas × 5 filas).
  - Devuelve `boardArea` en coordenadas normalizadas.
  - Guarda resultado en `assets/backgrounds/<MUNDO>/board-detection.json`.
- **Informe de casillas** `tools/detect-cells.ts`:
  - Lee los JSON de detección y muestra las coordenadas de cada casilla
    (6×5 = 30 casillas) en píxeles y normalizadas.
  - No modifica ningún archivo.
- **Demo visual** `demo-server.ts` + `demo.html`:
  - Muestra los 8 fondos a pantalla completa, adaptados sin recortar
    (object-fit: contain).
  - Selector de casilla retro con esquinas iluminadas (color temático
    por mundo).
  - Calibración interactiva: Shift+Flechas mueve la rejilla,
    Ctrl+Flechas la escala, G guarda, C abre formulario por píxeles.
  - Espacio cambia al siguiente mundo.
  - Rejilla oculta para los 8 mundos (calibración final aplicada).

### Calibración final
Los 8 mundos comparten el mismo `boardArea` calibrado:

```json
{ "x": 0.297962, "y": 0.259115, "width": 0.403343, "height": 0.609375 }
```

| Mundo | Imagen | boardArea calibrado | Rejilla oculta |
|-------|--------|---------------------|-----------------|
| ESPACIO | 1376×768 | ✅ | ✅ |
| AGUA | 1376×768 | ✅ | ✅ |
| TIERRA | 1376×768 | ✅ | ✅ |
| FUEGO | 1376×768 | ✅ | ✅ |
| HIELO | 1376×768 | ✅ | ✅ |
| VIENTO | 1376×768 | ✅ | ✅ |
| INFRAMUNDO | 1376×768 | ✅ | ✅ |
| CASTILLO_FINAL | 1376×768 | ✅ | ✅ |

### Colores temáticos del selector
- ESPACIO → blanco brillante con fondo azul celeste
- AGUA → cian
- TIERRA → verde liana oscuro
- FUEGO → naranja-rojo
- HIELO → cian brillante
- VIENTO → verde claro
- INFRAMUNDO → morado
- CASTILLO_FINAL → dorado

### Resultado de ejecutar los tests
- `npm run typecheck` → **verde**.
- `npm test` → **verde**: 13 archivos, 300/300 tests pasados.

### Notas / decisiones
- **MobileSAM vs CV clásica**: la visión por computador clásica (Sobel,
  varianza de bloques, detección de líneas) no fue fiable con pixel art
  rico en detalles. MobileSAM con box prompts sí detectó el tablero
  correctamente en los 8 mundos.
- **Calibración manual final**: SAM dio una buena aproximación inicial,
  pero el ajuste fino se hizo manualmente con el demo visual
  interactivo. El resultado final es el mismo `boardArea` para los 8
  mundos.
- **Sin recortes**: no se recortó ni modificó ninguna imagen de fondo.
  Las detecciones se guardan como metadatos en `board-detection.json`.
- **Tablero fijo 6×5**: todos los fondos tienen el tablero incorporado
  con 6 columnas × 5 filas. No se generan tableros nuevos al azar.


