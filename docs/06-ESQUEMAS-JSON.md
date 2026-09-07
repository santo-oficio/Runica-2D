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

> Nota: el tablero es **fijo 6×5** y los 8 mundos comparten la misma
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
  "width": 6,
  "height": 5,
  "grid": [
    "######",
    "#....#",
    "#.E..#",
    "#.PG.#",
    "######"
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

> Nota: el tablero es fijo **6×5** (`width=6, height=5`).

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
    "floor": "space_floor.png",
    "wallEdgeTop": "space_wall_top.png",
    "wallCornerTopLeft": "space_wall_corner_tl.png",
    "player": "space_player.png",
    "enemyDefault": "space_enemy.png",
    "goal": "space_goal.png"
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

> Nota: `allowedBoardSizes` es `[[6,5]]` (tablero fijo, no se generan otras
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
