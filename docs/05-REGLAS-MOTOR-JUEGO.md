# 🎮 Reglas del Motor de Juego

El motor de juego es el único componente que ejecuta la partida en tiempo real.
Es **determinista y programado explícitamente** — nunca improvisado por una IA
en vivo. La IA/generador solo produce datos (mapas lógicos) que este motor
consume.

> Nota: define aquí, en detalle, las reglas exactas de tu variante de Wappo
> (movimiento del jugador, cómo se mueven los enemigos, condiciones de victoria
> y derrota). A continuación se propone un esqueleto estándar que puedes ajustar
> a tu diseño concreto — sustituye/completa lo que no coincida con "tu" Wappo.

> ⚠️ **Ampliado en `13-MECANICAS-OBSTACULOS-TRAMPAS-ATURDIMIENTO.md`**: los
> obstáculos (`X`) ocupan la casilla completa (bloquean igual que una pared,
> a diferencia del Wappo original) y las trampas (`T`) aturden 3 turnos a
> quien las pisa, de forma individual por entidad. Lee ese documento para el
> detalle del bucle de turno actualizado y el estado de aturdimiento.

## 1. Entidades del mapa lógico

| Símbolo | Significado |
|---|---|
| `#` | Pared / celda no transitable |
| `.` | Celda transitable |
| `P` | Posición inicial del jugador |
| `E` | Enemigo |
| `X` | Obstáculo — ocupa la casilla completa, bloquea el movimiento igual que una pared (`#`), pero es una entidad propia a efectos de sprite y de recuento de dificultad. Ver `13-MECANICAS-OBSTACULOS-TRAMPAS-ATURDIMIENTO.md`, sección 1 |
| `G` | Objetivo / meta |
| `D` | Puerta (puede requerir llave) |
| `K` | Llave |
| `T` | Trampa (ver detalle del efecto y reglas en `11-ACTUALIZACION-NIVELES-DIFICULTAD-PROGRESO.md`, sección 4) — **efecto exacto de aturdimiento de 3 turnos definido en `13-MECANICAS-OBSTACULOS-TRAMPAS-ATURDIMIENTO.md`, sección 2** |

Se puede ampliar esta tabla por mundo (ej. `L` = lava en el mundo Fuego, `W` =
agua profunda en el mundo Agua) siempre que el motor tenga la regla programada.

## 2. API mínima del motor (funciones que deben existir y ser deterministas)

```
Player.Move(direction)         // mueve al jugador si la casilla destino es válida
Enemy.Move()                   // aplica el patrón de movimiento del enemigo
IsValidMove(pos, direction)    // valida colisiones, límites, paredes, obstáculos
CanEnemyReachPlayer(enemy)     // usado por el solver para medir amenaza
IsLevelSolved(state)           // condición de victoria
IsLevelFailed(state)           // condición de derrota (si aplica en tu variante)
GenerateLevel(seed, params)    // delega en el Level Generator (03)
ValidateLevel(level)           // delega en el Solver/Validador (04)
```

Estas funciones son las que el **Solver** reutiliza para simular partidas sin
gráficos, garantizando que "lo que se valida" es exactamente "lo que se juega"
(nunca dos implementaciones distintas de las mismas reglas).

## 3. Bucle de turno / tiempo real (a definir según tu variante)

Wappo clásico suele funcionar por turnos discretos (el jugador se mueve, luego
los enemigos). Esqueleto recomendado:

```
1. Input del jugador → Player.Move(direction)
2. ¿Movimiento válido? → aplicar; si no, ignorar input
3. Comprobar recogida de objetos (llaves, power-ups) en la nueva celda
4. Enemy.Move() para cada enemigo (según su patrón: persecución, patrulla, aleatorio…)
5. Comprobar colisión jugador-enemigo → IsLevelFailed()
6. Comprobar IsLevelSolved()
7. Si ni victoria ni derrota → volver a 1
```

## 4. Patrones de movimiento de enemigos (definir uno o varios)

- **Patrulla fija**: recorre una ruta predefinida en el mapa lógico.
- **Persecución simple**: se mueve un paso hacia el jugador cada turno (con o
  sin capacidad de bordear obstáculos).
- **Aleatorio acotado**: se mueve a una celda transitable adyacente al azar.
- **Vigilancia de zona**: no se mueve, pero bloquea/amenaza celdas en su rango.

El patrón elegido para cada enemigo debe ser **el mismo** en el motor real y en
la simulación del solver, para que la validación de resolubilidad sea fiel a
lo que el jugador experimenta.

## 5. Condición de victoria / derrota (ejemplo a ajustar)

- **Victoria**: el jugador alcanza la celda `G` (objetivo), habiendo cumplido
  requisitos previos si los hay (ej. recoger llave `K` antes de cruzar puerta `D`).
- **Derrota** (si tu variante la tiene): colisión con un enemigo `E`, o
  agotar un número máximo de turnos/movimientos si el diseño incluye límite.

## 6. Por qué esto va en un documento separado del generador

Separar reglas del generador permite:

- Cambiar/ajustar reglas de juego sin tener que rehacer el generador de niveles.
- Reutilizar exactamente las mismas reglas en el solver (validación) y en el
  motor real (partida), evitando el bug clásico de "el nivel se valida con
  unas reglas pero se juega con otras ligeramente distintas".
- Añadir mecánicas nuevas por mundo (ej. lava que mata en el mundo Fuego) como
  extensiones de esta capa, sin tocar el generador ni el motor gráfico.
