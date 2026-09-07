# 🌍 Mundos y Temáticas

## Estructura general

```
ESPACIO
  ├── plantillas de fondo: SPACE_01, SPACE_02, SPACE_03
  ├── set de assets de casillas propio
  ├── enemigos propios (estética + patrones que tengan sentido temático)
  ├── reglas especiales (opcional, ej. gravedad, "planetas" que teletransportan)
  └── banco de ~20.000 niveles válidos

FUEGO
  ├── plantillas de fondo propias
  ├── assets propios (lava, brasas, marco de piedra...)
  ├── posible regla especial: celdas de lava = derrota instantánea
  └── banco de niveles propio

AGUA
  ├── plantillas de fondo propias
  ├── assets propios (corrientes, burbujas...)
  ├── posible regla especial: corrientes que empujan al jugador un paso extra
  └── banco de niveles propio
```

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
3. Tamaños de tablero permitidos para ese mundo (pueden variar entre mundos).
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

1. Diseñar 2–3 fondos base del mundo (arte).
2. Pasarlos por el analizador/editor → generar sus `BackgroundTemplate`.
3. Crear el set de `tileAssets` del mundo (suelo, bordes, esquinas, marco,
   jugador, enemigos, objetivo — mínimo indispensable para el auto-tiling).
4. Definir el `WorldConfig` (tamaños de tablero, tabla de dificultad, reglas
   especiales si las hay).
5. Generar por lotes un banco inicial de niveles (ver `03-GENERADOR-NIVELES.md`,
   sección "Generación por lotes") y validarlos.
6. Revisar manualmente una muestra de niveles aceptados para control de calidad
   visual (aunque estén validados matemáticamente, conviene un vistazo humano
   antes de publicar un mundo nuevo).
