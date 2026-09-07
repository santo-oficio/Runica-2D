# 🏗️ Arquitectura General

## Idea central

Separar completamente **la apariencia del tablero** (tus imágenes de fondo, arte
retro/pixel-art) de **la lógica del tablero** (mapa lógico, reglas, generación,
validación). Esto permite:

- Generar niveles infinitos reutilizando un número reducido de fondos artísticos.
- Adaptar cualquier fondo a pantalla panorámica sin deformar el arte.
- Garantizar matemáticamente que cada nivel generado es resoluble y tiene una
  dificultad coherente, antes de que el jugador lo vea.

> Estado actual: el tablero es **fijo 6×5** y ya está dibujado en cada fondo.
> La `boardArea` se detecta con MobileSAM y está calibrada (los 8 mundos
> comparten la misma). No se generan tableros con otras dimensiones.

## Diagrama de módulos

```
                  ┌────────────────────┐
                  │   FONDO ARTÍSTICO  │  (PNG/JPG, arte retro)
                  └─────────┬──────────┘
                             │
                             ▼
                  ┌────────────────────┐
                  │   SCREEN LAYOUT    │  adapta el fondo a 16:9 / TV
                  └─────────┬──────────┘
                             │
                ┌────────────┴────────────┐
                ▼                          ▼
        BACKGROUND (decorativo)     BOARD AREA (zona jugable segura)
                                            │
                                            ▼
                                  ┌────────────────────┐
                                  │  LEVEL GENERATOR   │  crea la forma del tablero
                                  └─────────┬──────────┘
                                            │
                                            ▼
                                  ┌────────────────────┐
                                  │  SOLVER/VALIDADOR  │  ¿es resoluble? ¿dificultad OK?
                                  └─────────┬──────────┘
                                     NO │        │ SÍ
                                        ▼        ▼
                                  descartar   ┌────────────────────┐
                                              │   AUTO-TILING /    │  elige el sprite
                                              │  ASSET RESOLVER    │  correcto por casilla
                                              └─────────┬──────────┘
                                                         ▼
                                              ┌────────────────────┐
                                              │   MOTOR DE JUEGO   │  reglas Wappo
                                              │ (player/enemy/win) │
                                              └────────────────────┘
```

## Los seis subsistemas

1. **World Background** — el arte, tal cual lo diseñas tú.
2. **Screen Layout** — adapta el fondo y la zona de juego a distintas resoluciones
   y relaciones de aspecto (móvil, tablet, TV panorámica) sin deformar el pixel-art.
3. **Level Generator** — decide la forma del tablero (rectángulo, L, cruz, pasillo,
   laberinto...) dentro del área permitida por el fondo.
4. **Level Solver / Validador** — comprueba matemáticamente que el nivel generado
   se puede resolver, mide su dificultad y descarta lo que no sirve.
5. **Asset Resolver / Auto-tiling** — decide, para cada casilla del mapa lógico
   ya validado, qué sprite gráfico dibujar según sus vecinos y la temática del mundo.
6. **Motor del juego (reglas)** — mueve al jugador y enemigos, aplica las reglas
   de Wappo, comprueba condición de victoria/derrota. **No genera contenido**, solo
   ejecuta reglas ya fijas y programadas (nunca las decide la IA en tiempo real).

## Regla de oro

> La IA puede **proponer** estructuras de nivel (arquetipos, posiciones,
> combinaciones), pero **nunca controla las reglas del juego**. Las reglas
> (`Player.Move()`, `IsValidMove()`, `CanEnemyReachPlayer()`, `IsLevelSolved()`)
> están programadas de forma determinista en el motor. La IA/generador solo
> alimenta datos (el mapa lógico) que el motor y el solver verifican antes de
   usarlos.

## Flujo de vida de un nivel

```
generar semilla (seed)
        ↓
Level Generator produce mapa lógico candidato
        ↓
Validador geométrico (alineación, dentro del área, sin invadir decoración)
        ↓
Solver de reglas (¿tiene solución? ¿en cuántos movimientos?)
        ↓
Puntuador de dificultad
        ↓
¿Cumple el rango de dificultad esperado para su posición en la progresión?
    ↙ NO                                   SÍ ↘
 descartar / regenerar              guardar en el banco de niveles válidos
```

Con este proceso puedes generar por lotes (ej. 100.000 seeds), quedarte solo con
los niveles que pasan **todos** los tests, y servir esos niveles a los jugadores
en el orden y progresión que definas. El jugador nunca necesita saber que el
nivel fue generado — puede parecer una campaña diseñada a mano.

## Documentos relacionados

- Detalle del motor gráfico → `02-MOTOR-GRAFICO.md`
- Detalle del generador → `03-GENERADOR-NIVELES.md`
- Detalle del solver → `04-SOLVER-VALIDADOR.md`
- Reglas del juego → `05-REGLAS-MOTOR-JUEGO.md`
- Formatos de datos → `06-ESQUEMAS-JSON.md`
