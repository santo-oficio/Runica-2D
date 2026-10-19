# 🧾 Esquemas de Datos (JSON)

Formatos de referencia para los datos que fluyen entre módulos. Ajustar nombres
de campos a tu stack (Unity/C#, Godot/GDScript, JS/TS, etc.), pero mantener esta
estructura conceptual.

## 1. Plantilla de fondo (`BackgroundTemplate`)

Generada una vez por el analizador/editor, por cada imagen de fondo.

```json
{
  "id": "ESPACIO_01",
  "world": "ESPACIO",
  "image": "assets/backgrounds/ESPACIO/bg_01.jpg",
  "safeArea": { "x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0 },
  "boardArea": { "x": 0.297962, "y": 0.259115, "width": 0.403343, "height": 0.609375 },
  "marginPx": 3,
  "allowedCellSizes": [47, 71, 95, 118, 142],
  "anchorPoints": {
    "frameTopLeft": { "x": 0.02, "y": 0.02 },
    "hud": { "x": 0.02, "y": 0.02 }
  },
  "decorativeAreas": [
    { "x": 0.0, "y": 0.0, "width": 0.297962, "height": 1.0, "extendable": true },
    { "x": 0.701305, "y": 0.0, "width": 0.298695, "height": 1.0, "extendable": true }
  ]
}
```

> Nota: el tablero es **fijo 8×6** y los 8 mundos comparten la misma
> `boardArea` calibrada (ver `10-ANALIZADOR-IA-FONDOS.md`). El campo
> `boardArea` es la zona donde el tablero ya está dibujado en la imagen.

- Coordenadas siempre **relativas** (0.0–1.0) para independencia de resolución.
- `extendable: true` marca zonas decorativas que se pueden ampliar/repetir al
  adaptar a panorámico, sin tocar nunca `boardArea` ni `safeArea`.

## 2. Mapa lógico de un nivel (`LevelMap`)

Salida del Level Generator, entrada del Solver y del Asset Resolver.

```json
{
  "levelId": 48321,
  "seed": 839271,
  "world": "ESPACIO",
  "backgroundTemplateId": "ESPACIO_01",
  "archetype": "RECTANGULO",
  "width": 8,
  "height": 6,
  "grid": [
    "########",
    "#......#",
    "#..E...#",
    "#..PG..#",
    "#......#",
    "########"
  ],
  "player": [2, 3],
  "enemies": [
    { "pos": [2, 2], "pattern": "PERSECUCION_SIMPLE" }
  ],
  "goal": [3, 3],
  "keys": [],
  "doors": [],
  "rulesetVersion": "1.0.0"
}
```

> Nota: el tablero es fijo **8×6** (`width=8, height=6`).

- `grid` es la representación humana-legible de la matriz; internamente se
  puede indexar como array 2D de enums (`WALL`, `FLOOR`, `PLAYER`, `ENEMY`, ...).
- `rulesetVersion` permite versionar cambios en las reglas sin romper niveles
  ya validados con una versión anterior (o forzar su re-validación).

## 3. Resultado de validación (`ValidationResult`)

Salida del Solver/Validador, lo que decide si un `LevelMap` entra al banco.

```json
{
  "levelId": 48321,
  "valid": true,
  "checks": {
    "withinBoardArea": true,
    "gridAligned": true,
    "noDecorationOverlap": true,
    "tilingResolved": true,
    "entitiesFit": true,
    "noImpossiblePositions": true,
    "solvable": true,
    "difficultyInRange": true,
    "notTrivial": true,
    "noAbsurdSituations": true
  },
  "solution": {
    "minMoves": 23,
    "path": "solo longitud/metadata, no se guarda el path completo si no hace falta"
  },
  "difficultyScore": 7.2,
  "rejectionReason": null
}
```

## 4. Configuración de mundo (`WorldConfig`)

```json
{
  "world": "ESPACIO",
  "backgroundTemplates": ["ESPACIO_01"],
  "tileAssets": {
    "floor": "space_floor.webp",
    "wallEdgeTop": "space_wall_top.webp",
    "wallCornerTopLeft": "space_wall_corner_tl.webp",
    "player": "space_player.webp",
    "enemyDefault": "space_enemy.webp",
    "goal": "space_goal.webp"
  },
  "allowedBoardSizes": [[6,5]],
  "difficultyTable": [
    { "range": [1, 10], "stars": 1, "maxEnemies": 1 },
    { "range": [11, 25], "stars": 2, "maxEnemies": 1 },
    { "range": [26, 50], "stars": 3, "maxEnemies": 2 },
    { "range": [51, 100], "stars": 4, "maxEnemies": 3 },
    { "range": [101, 200], "stars": 5, "maxEnemies": 4 }
  ]
}
```

> Nota: `allowedBoardSizes` es `[[8,6]]` (tablero fijo, no se generan otras
> dimensiones por ahora).

## 5. Banco de niveles (índice)

Para servir niveles en producción sin regenerar todo cada vez:

```json
{
  "world": "ESPACIO",
  "levels": [
    { "levelId": 48321, "seed": 839271, "difficultyScore": 7.2, "minMoves": 23 },
    { "levelId": 48322, "seed": 839274, "difficultyScore": 3.1, "minMoves": 9 }
  ]
}
```

Solo se guardan los niveles que ya pasaron `ValidationResult.valid == true`.
El `grid` completo puede regenerarse en el momento a partir de la `seed` (si el
generador es determinista) o guardarse ya calculado (más simple, más peso en
disco/BD) — decisión de ingeniería según vuestro volumen de niveles.

## 6. Calibración de sprites del tablero (`sprites.json`)

Por mundo, en `assets/backgrounds/<MUNDO>/sprites.json`. Editado con
`calibrate-board-sprites.html`. Calibración independiente por tipo e instancia:

```json
{
  "world": "AGUA",
  "global": { "offsetX": 0, "offsetY": 0, "scale": 1 },
  "avatar":   [ { "size": 0.91, "offsetX": 0, "offsetY": -0.01 } ],
  "enemy":    [ { "size": 0.89, "offsetX": 0, "offsetY": 0 } ],
  "boss":     [ { "size": 0.98, "offsetX": 0, "offsetY": -0.01 } ],
  "trap":     [ { "size": 0.95, "offsetX": 0, "offsetY": -0.02 } ],
  "exit":     [ { "size": 0.75, "offsetX": 0, "offsetY": -0.04 } ],
  "obstacle": [ { "size": 0.95, "offsetX": 0, "offsetY": 0 } ]
}
```

- `size` = fracción de la casilla (1.0 = llena la celda). `offsetX/offsetY` =
  desplazamiento desde el centro de la casilla, en fracciones de celda.
- `global` aplica a todos los tipos a la vez (ajuste conjunto, usar con cuidado).
- `avatar` tiene siempre 8 entradas; el resto tantas como imágenes haya en la
  carpeta del mundo. Trampas/obstáculos se colocan sobre `boardArea`; el resto
  sobre `avatarArea`.

## 7. Áreas de texto del tablero (`text-areas.json` en backgrounds)

Por mundo, en `assets/backgrounds/<MUNDO>/text-areas.json`. Editado con
`calibrate-board-texts.html`. Los textos son dinámicos desde i18n
(`board.turn`, `board.optimal`, `board.info`); los números son valores de juego.

```json
{
  "world": "ESPACIO",
  "areas": {
    "turn":     { "x": 0.092, "y": 0.373, "w": 0.058, "h": 0.064 },
    "nTurn":    { "x": 0.092, "y": 0.462, "w": 0.058, "h": 0.065 },
    "optimal":  { "x": 0.846, "y": 0.368, "w": 0.066, "h": 0.064 },
    "nOptimal": { "x": 0.855, "y": 0.459, "w": 0.053, "h": 0.061 },
    "info":     { "x": 0.389, "y": 0.908, "w": 0.225, "h": 0.068 },
    "gold":     { "x": 0.450, "y": 0.908, "w": 0.100, "h": 0.068 }
  }
}
```

`gold` es el texto en color oro (ej. contador de tesoros `3/12`). El
calibrador auto-ajusta el tamaño de fuente al área para que el texto nunca se
corte por los bordes. El texto `gold` se alinea **a la derecha** del área con
un margen (~6% del ancho) — igual en todas las pantallas. A la izquierda del
texto va el icono `assets/comunes/monedas.webp` (altura = altura del área),
pegado al número aunque cambie su longitud.

### Campo opcional `fontScale` (todas las áreas de texto)

Cada área `{x,y,w,h}` puede llevar además `fontScale` — multiplicador
**relativo** del tamaño de fuente (1 = por defecto, 1.5 = 50% más grande).
Siempre relativo al tamaño base que calcula el área; nunca un tamaño absoluto.
Se calibra con `,` / `.` en los calibradores de texto (`calibrate-board-texts`,
`calibrate-submundos-text`, `calibrate-mapamundi-text`, `calibrate-creditos`)
y las pantallas lo aplican al renderizar (`fontScale || 1` si falta). En esos
calibradores `Q`/`E` redimensionan **solo el ancho** y `Z`/`X` **solo el alto**
del área (centro fijo); `+`/`-` siguen cambiando ambos.

## 8. Calibración de submundos

Por mundo, en `assets/submundos/<MUNDO>/`:

- `avatar-positions.json` (`calibrate-submundos.html`):
  `{ world, positions:{"0".."11"}:{x,y}, avatarSize,
  avatars[8]:{size, positions?:{"0".."11":{x,y}}} }` — posiciones base por
  nivel (rejilla serpiente 4×3), con overrides por avatar cuando se necesiten,
  y tamaño independiente para cada uno de los 8 avatares.
- `text-areas.json` (`calibrate-submundos-text.html`):
  `{ world, areas:{ worldName:{x,y,w,h}, level:{x,y,w,h}, gold:{x,y,w,h} } }`
  — nombre del mundo (`submundo.title`), `Nivel X/12` (`submundo.level`) y
  texto en oro (`gold`, ej. contador de tesoros), dinámicos.

## 9. Calibración de instrucciones (`instructions-areas.json`)

En `assets/instrucciones/instructions-areas.json`, editado con
`calibrate-instructions.html` (tecla **B** alterna entre áreas y botón):

```json
{
  "areas": [
    { "label": "area 0", "x": 0.249, "y": 0.332, "w": 0.492, "h": 0.453 }
  ],
  "backButton": { "cx": 0.299, "cy": 0.911, "r": 0.033 }
}
```

- `areas[]` — rectángulos normalizados; el primero es el pergamino de texto.
- `backButton` — **círculo** `{cx, cy, r}` (r = fracción del ANCHO de imagen)
  sobre la brújula pintada abajo-izquierda. El botón HTML es invisible: es
  solo el área clickeable (anillo dorado al tener foco).
- La navegación por teclado de la pantalla está en AGENTS.md (regla a fuego).

## 10. Textos del mapamundi (`text-areas.json` en mapamundi)

En `assets/mapamundi/text-areas.json`, editado con
`calibrate-mapamundi-text.html` (una sola imagen, sin selector de mundo):

```json
{
  "areas": {
    "gold": { "x": 0.4, "y": 0.05, "w": 0.2, "h": 0.07 }
  }
}
```

`gold` es el texto en color oro sobre `mapamundi.16x9.webp` (ej. contador de
tesoros). La fuente se auto-ajusta al área para no cortar letras.

## 11. Calibración de créditos (`creditos-areas.json`)

En `assets/creditos/creditos-areas.json`, editado con
`calibrate-creditos.html` (tecla **B** alterna entre áreas y botón):

```json
{
  "areas": {
    "title":   { "x": 0.30, "y": 0.05, "w": 0.40, "h": 0.10 },
    "credits": { "x": 0.20, "y": 0.25, "w": 0.60, "h": 0.50 }
  },
  "backButton": { "cx": 0.30, "cy": 0.88, "r": 0.04 }
}
```

- `areas.title` — título (`credits.title`, i18n) sobre `creditos.jpg`.
- `areas.credits` — bloque de texto de créditos (i18n, scrollable).
- `backButton` — **círculo** `{cx, cy, r}` (r = fracción del ANCHO de imagen)
  sobre el medallón/brújula pintado abajo-izquierda. El botón HTML es
  invisible: solo el área clickeable (anillo dorado al tener foco).
- La pantalla `creditos.html` consume este JSON; las reglas de foco son las
  mismas que en instrucciones (AGENTS.md).
