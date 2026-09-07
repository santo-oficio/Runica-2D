# 🌍 Mundos y Temáticas

## Estructura general

```
ESPACIO
  ├── plantilla de fondo: ESPACIO_01 (bg_01.jpg)
  ├── set de assets de casillas propio
  ├── enemigos propios (estética + patrones que tengan sentido temático)
  ├── reglas especiales (opcional, ej. gravedad, "planetas" que teletransportan)
  └── banco de niveles válidos

FUEGO
  ├── plantilla de fondo propia
  ├── assets propios (lava, brasas, marco de piedra...)
  ├── posible regla especial: celdas de lava = derrota instantánea
  └── banco de niveles propio

AGUA
  ├── plantilla de fondo propia
  ├── assets propios (corrientes, burbujas...)
  ├── posible regla especial: corrientes que empujan al jugador un paso extra
  └── banco de niveles propio

TIERRA
  ├── plantilla de fondo propia
  ├── assets propios (lianas, madera...)
  └── banco de niveles propio

VIENTO
  ├── plantilla de fondo propia
  └── banco de niveles propio

HIELO
  ├── plantilla de fondo propia
  └── banco de niveles propio

INFRAMUNDO
  ├── plantilla de fondo propia
  └── banco de niveles propio

CASTILLO_FINAL
  ├── plantilla de fondo propia
  └── banco de niveles propio
```

**8 mundos en total.** Todos comparten:

- **Tablero fijo 6×5** (6 columnas × 5 filas), ya dibujado en la imagen de fondo.
  No se generan tableros con otras dimensiones.
- **La misma `boardArea` calibrada** (ver más abajo).
- Imágenes de fondo de **1376×768 px**, en `assets/backgrounds/<MUNDO>/bg_01.jpg`.
- Detección de tablero con MobileSAM guardada en
  `assets/backgrounds/<MUNDO>/board-detection.json`.

## Calibración de tablero compartida

Los 8 mundos usan la misma `boardArea`:

```json
{ "x": 0.297962, "y": 0.259115, "width": 0.403343, "height": 0.609375 }
```

| Mundo | Imagen | boardArea calibrada |
|-------|--------|---------------------|
| ESPACIO | 1376×768 | ✅ |
| AGUA | 1376×768 | ✅ |
| TIERRA | 1376×768 | ✅ |
| FUEGO | 1376×768 | ✅ |
| HIELO | 1376×768 | ✅ |
| VIENTO | 1376×768 | ✅ |
| INFRAMUNDO | 1376×768 | ✅ |
| CASTILLO_FINAL | 1376×768 | ✅ |

## Colores temáticos del selector (demo visual)

La demo usa un selector de casilla retro con color por mundo:

- ESPACIO → blanco brillante con fondo azul celeste
- AGUA → cian
- TIERRA → verde liana oscuro
- FUEGO → naranja-rojo
- HIELO → cian brillante
- VIENTO → verde claro
- INFRAMUNDO → morado
- CASTILLO_FINAL → dorado

## Por qué por mundo y no todo junto

- El motor **no necesita saber de antemano** cómo es cada fondo: simplemente
  lee la `BackgroundTemplate` (ver `06-ESQUEMAS-JSON.md`) y el `WorldConfig`
  correspondiente. Añadir un mundo nuevo no toca el código del motor.
- Permite dar identidad visual y de reglas a cada mundo sin duplicar lógica:
  el generador, el solver y el motor de reglas son los mismos para todos los
  mundos; lo que cambia es el **contenido** (assets, reglas especiales opcionales,
  tabla de dificultad, plantillas de fondo).
- Facilita planificar contenido: "queremos lanzar el mundo Fuego" es tarea de
  arte + configuración, no de reingeniería del motor.

## Qué define cada mundo (`WorldConfig`, ver esquema en `06-ESQUEMAS-JSON.md`)

1. Lista de `backgroundTemplates` que pertenecen a ese mundo.
2. Diccionario de `tileAssets` (suelo, bordes, esquinas, marco, jugador,
   enemigos, objetivo) usado por el Asset Resolver.
3. Tamaño de tablero: **fijo [6, 5]** para todos los mundos (de momento).
4. Tabla de dificultad/progresión propia (un mundo "avanzado" puede empezar en
   una dificultad más alta que el mundo tutorial).
5. (Opcional) Reglas especiales exclusivas del mundo, implementadas como
   extensiones del motor de reglas base (`05-REGLAS-MOTOR-JUEGO.md`), nunca
   sustituyendo la validación común del solver.

## Jefes / niveles especiales

Los "jefes" pueden tratarse como niveles manuales (no procedurales) que:

- Usan una geometría diseñada a mano para ese propósito.
- Pueden introducir una mecánica adicional puntual (ej. dos objetivos, un
  enemigo con patrón único).
- **Pasan exactamente por el mismo validador/solver** que cualquier nivel
  procedural — no hay excepciones, ni siquiera para contenido hecho a mano.

## Recomendación de proceso al añadir un mundo nuevo

1. Diseñar el fondo base del mundo (arte, 1376×768, con tablero 6×5 dibujado).
2. Detectarlo con MobileSAM (`background/sam-detect.py`) → `board-detection.json`.
3. Calibrarlo con la demo visual (`demo-server.ts`).
4. Crear el set de `tileAssets` del mundo (suelo, bordes, esquinas, marco,
   jugador, enemigos, objetivo — mínimo indispensable para el auto-tiling).
5. Definir el `WorldConfig` (tablero [6,5], tabla de dificultad, reglas
   especiales si las hay).
6. Generar por lotes un banco inicial de niveles (ver `03-GENERADOR-NIVELES.md`,
   sección "Generación por lotes") y validarlos.
7. Revisar manualmente una muestra de niveles aceptados para control de calidad
   visual (aunque estén validados matemáticamente, conviene un vistazo humano
   antes de publicar un mundo nuevo).
