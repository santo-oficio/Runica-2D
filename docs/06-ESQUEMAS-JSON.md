# 🧾 Esquemas de Datos (JSON)

Formatos de referencia para los datos que fluyen entre módulos. Ajustar nombres
de campos a tu stack (Unity/C#, Godot/GDScript, JS/TS, etc.), pero mantener esta
estructura conceptual.

## 1. Plantilla de fondo (`BackgroundTemplate`)

Generada una vez por el analizador/editor, por cada imagen de fondo.

```json
{
  "id": "SPACE_01",
  "world": "ESPACIO",
  "image": "tablero_espacio.png",
  "safeArea": { "x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0 },
  "boardArea": { "x": 0.25, "y": 0.28, "width": 0.50, "height": 0.48 },
  "marginPx": 3,
  "allowedCellSizes": [48, 56, 64, 72, 80],
  "anchorPoints": {
    "frameTopLeft": { "x": 0.20, "y": 0.22 },
    "hud": { "x": 0.02, "y": 0.02 }
  },
  "decorativeAreas": [
    { "x": 0.0, "y": 0.0, "width": 0.25, "height": 1.0, "extendable": true },
    { "x": 0.75, "y": 0.0, "width": 0.25, "height": 1.0, "extendable": true }
  ]
}
```

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
  "backgroundTemplateId": "SPACE_01",
  "archetype": "L_IRREGULAR",
  "width": 12,
  "height": 10,
  "grid": [
    "############",
    "#..#.......#",
    "#..#..####.#",
    "#.....#....#",
    "###...#..E.#",
    "#.....#....#",
    "#..P.......#",
    "#..........#",
    "#....G.....#",
    "############"
  ],
  "player": [3, 6],
  "enemies": [
    { "pos": [9, 4], "pattern": "PERSECUCION_SIMPLE" }
  ],
  "goal": [5, 8],
  "keys": [],
  "doors": [],
  "rulesetVersion": "1.0.0"
}
```

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
  "backgroundTemplates": ["SPACE_01", "SPACE_02", "SPACE_03"],
  "tileAssets": {
    "floor": "space_floor.png",
    "wallEdgeTop": "space_wall_top.png",
    "wallCornerTopLeft": "space_wall_corner_tl.png",
    "player": "space_player.png",
    "enemyDefault": "space_enemy.png",
    "goal": "space_goal.png"
  },
  "allowedBoardSizes": [[6,5], [7,6], [8,6], [8,8]],
  "difficultyTable": [
    { "range": [1, 10], "stars": 1, "maxEnemies": 1 },
    { "range": [11, 25], "stars": 2, "maxEnemies": 1 },
    { "range": [26, 50], "stars": 3, "maxEnemies": 2 },
    { "range": [51, 100], "stars": 4, "maxEnemies": 3 },
    { "range": [101, 200], "stars": 5, "maxEnemies": 4 }
  ]
}
```

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
