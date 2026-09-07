# ♾️ Generador de Niveles (Juego Infinito)

## Idea central

No hace falta diseñar miles de fondos. Con **un único aspecto gráfico de
tablero** por mundo, se pueden generar miles o millones de configuraciones de
nivel distintas, cada una validada antes de llegar al jugador.

```
seed = 839271  →  Nivel A (reproducible siempre igual con esa seed)
seed = 839272  →  Nivel B
seed = 839273  →  Nivel C
...
```

La **seed** (semilla) es clave: permite regenerar exactamente el mismo nivel a
partir de un número, sin tener que guardar todo el mapa si no se quiere, y
facilita depurar ("el nivel 48321 falla, seed X").

## 1. Qué decide el generador (mapa lógico, no gráfico)

Para cada seed, el generador decide, en este orden:

1. **Arquetipo de forma**: `RECTÁNGULO`, `L`, `T`, `CRUZ`, `PASILLO`,
   `CÁMARA_CENTRAL`, `ANILLO`, `DOBLE_PASILLO`, `LABERINTO`, `IRREGULAR`
   (pueden combinarse entre sí).
2. **Tamaño del tablero** (columnas × filas), dentro de los límites que permite
   el `boardArea` del fondo elegido.
3. **Posición de las celdas jugables** dentro de esa forma (matriz `.` / `#`).
4. **Población de entidades**: jugador, enemigos, obstáculos, puertas, llaves,
   objetivo — ver sección siguiente.
5. **Metadatos**: mundo, dificultad objetivo, seed, versión de reglas usada.

Todo esto se serializa como el "mapa lógico" (ver `06-ESQUEMAS-JSON.md`), que es
el único dato que consumen el Solver y el Asset Resolver.

## 2. Población de entidades

El generador no coloca enemigos al azar sin criterio. Sigue reglas como:

- Distancia mínima (en casillas) entre jugador y cada enemigo al inicio.
- Número de enemigos según la franja de dificultad (ver tabla más abajo).
- Al menos un camino topológicamente posible entre jugador y objetivo antes
  incluso de pasar al solver completo (pre-filtro rápido y barato).
- Obstáculos y puertas/llaves no deben bloquear el 100% de los caminos (eso lo
  confirma después el solver de forma exacta).

## 3. Progresión de dificultad (ejemplo orientativo)

| Nivel | Dificultad | Elementos típicos |
|---|---|---|
| 1–10 | ⭐ | 1 enemigo, tablero simple (rectángulo) |
| 11–25 | ⭐⭐ | 1 enemigo + obstáculos, formas en L |
| 26–50 | ⭐⭐⭐ | 2 enemigos, pasillos |
| 51–100 | ⭐⭐⭐⭐ | enemigos + puertas/llaves |
| 101–200 | ⭐⭐⭐⭐⭐ | reglas combinadas, laberintos |
| 201+ | 🔥 | generación avanzada, sin techo — el juego es infinito |

No hay un nivel máximo real: se sigue generando y validando bajo demanda o por
lotes, y la tabla de dificultad puede extenderse indefinidamente (ej. escalando
parámetros: nº de enemigos, tamaño de tablero, densidad de obstáculos, longitud
mínima de solución).

## 4. Arquitectura del generador dentro del flujo completo

```
                  ┌──────────────────┐
                  │   TABLERO VISUAL │  (PNG/JPG, plantilla ya analizada)
                  └────────┬─────────┘
                           ▼
                  ┌──────────────────┐
                  │   MAPA LÓGICO    │  (JSON: boardArea + reglas del mundo)
                  └────────┬─────────┘
              ┌────────────┴────────────┐
              ▼                         ▼
       NIVEL MANUAL              GENERADOR PROCEDURAL (seed)
              │                         │
              └────────────┬────────────┘
                           ▼
                  ┌──────────────────┐
                  │ SOLVER/VALIDADOR │  → ver 04-SOLVER-VALIDADOR.md
                  └────────┬─────────┘
                     ¿SOLUCIONABLE Y VÁLIDO?
                       /              \
                     NO                SÍ
                     │                  │
                  descartar/regenerar   ▼
                                 BANCO DE NIVELES VÁLIDOS
```

Importante: el generador admite tanto **niveles manuales** (diseñados a mano,
para tutoriales o jefes especiales) como **niveles procedurales**, y ambos pasan
exactamente por el mismo validador. Nunca hay un "atajo" que salte el solver,
ni siquiera para niveles diseñados a mano — así os garantizáis que nunca se
cuela un nivel roto por error humano.

## 5. Generación por lotes (banco de niveles)

Estrategia recomendada para producción:

1. Generar N seeds por mundo y franja de dificultad (ej. 100.000).
2. Pasar cada una por el validador/solver.
3. Quedarse solo con los niveles que pasan todos los tests (ver `04-SOLVER-VALIDADOR.md`).
4. Guardar el banco de niveles válidos (con su seed, dificultad medida y
   longitud mínima de solución) en una base de datos o archivo indexado.
5. En la partida real, servir niveles del banco en el orden de progresión
   definido, o generar bajo demanda (con timeout y fallback al banco si la
   generación en vivo tarda demasiado).

Esto permite tener "niveles infinitos" con coste de cómputo controlado: la
parte cara (generar y validar masivamente) se hace offline/por lotes, y en la
partida solo se sirven niveles ya garantizados.

## 6. El jugador no necesita saber que es procedural

```
Nivel 1
Nivel 2
Nivel 3
...
Nivel 10.000
```

puede sentirse como una campaña diseñada a mano, aunque detrás haya un
generador + solver descartando automáticamente todo lo que no sirve.
