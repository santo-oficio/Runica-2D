# ✅ Solver / Validador

Este es el sistema **más importante** del proyecto: nada llega al jugador sin
pasar por aquí. Convierte "genera posiciones aleatorias" en "genera un puzzle y
comprueba matemáticamente que existe una solución".

## 1. Checklist completo que debe pasar TODO nivel

Antes de aceptar un nivel (manual o generado), se comprueba, en este orden
(fallar rápido: lo barato primero, lo caro al final):

1. **Dentro del área permitida** — ninguna celda del tablero ocupa píxeles/
   coordenadas de la zona protegida (decorativa) del fondo.
2. **Perfectamente alineado** — todas las celdas nacen de la rejilla
   (`originX`, `originY`, `cellWidth`, `cellHeight`), nunca de posiciones
   arbitrarias o desplazadas.
3. **No invade decoración** — ni siquiera con el margen de seguridad extra
   alrededor de la zona jugable (para que el "volumen" visual de un sprite,
   2–3 px de más, nunca toque un elemento decorativo del fondo).
4. **Casillas correctamente encajadas** — el auto-tiling tiene un sprite válido
   para cada combinación de vecinos que aparece en el mapa (sin huecos raros).
5. **Todas las entidades caben** — jugador, enemigos, obstáculos, puertas, etc.
   están dentro de celdas jugables y no se solapan entre sí.
6. **No hay posiciones imposibles** — p. ej. un objetivo completamente rodeado
   de paredes sin ninguna celda adyacente transitable.
7. **Tiene solución** — existe al menos una secuencia de movimientos válida que
   lleva de estado inicial a estado de victoria, cumpliendo las reglas exactas
   de Wappo (ver `05-REGLAS-MOTOR-JUEGO.md`).
8. **Dificultad adecuada** — la solución mínima encontrada por el solver cae
   dentro del rango esperado para la posición de este nivel en la progresión.
9. **No es trivial** — se descartan soluciones triviales (ej. resoluble en 1
   movimiento) salvo que sea intencionadamente un nivel tutorial.
10. **No tiene situaciones absurdas** — ej. un enemigo que nunca puede alcanzar
    al jugador en ningún camino posible cuando la regla del mundo requiere que
    sí pueda amenazarlo, o un enemigo que bloquea el 100% de las rutas de forma
    no resoluble.

Si falla cualquier punto → **descartar y regenerar con otra seed** (o, si es un
nivel manual, devolver el error al editor para que el diseñador lo corrija).

## 2. Cómo funciona el solver de resolubilidad (motor de búsqueda)

El solver simula el juego internamente (headless, sin gráficos) usando
exactamente las mismas reglas que el motor real (`05-REGLAS-MOTOR-JUEGO.md`):

```
Estado inicial (posiciones de jugador, enemigos, objetos)
        ↓
Búsqueda de estados (BFS/A* sobre el espacio de estados del puzzle)
        ↓
¿Se alcanza algún estado de victoria?
    ↙ NO                          SÍ ↘
 nivel inválido            longitud de la solución más corta = dificultad base
```

Notas técnicas recomendadas:

- Usar **BFS** (anchura) si se quiere garantizar la solución más corta
  (métrica de dificultad más fiable). Usar **A\*** con una heurística admisible
  si el espacio de estados es muy grande y BFS es demasiado lento.
- El espacio de estados incluye la posición del jugador y de todo elemento que
  se mueva o cambie (enemigos, si tienen movimiento por turno; puertas
  abiertas/cerradas; llaves recogidas).
- Aplicar **poda** (pruning): descartar ramas simétricas o repetidas
  (posiciones ya visitadas con el mismo estado global).
- Definir un **límite de profundidad/tiempo** de búsqueda por nivel candidato,
  para no bloquear la generación por lotes con casos patológicos; si se supera
  el límite sin encontrar solución, se descarta como "no resoluble en tiempo
  razonable" (tratar igual que "no resoluble").

## 3. Puntuación de dificultad

La dificultad no es solo "cuántos movimientos". Factores recomendados a
combinar en una fórmula ponderada:

- Longitud de la solución mínima (más movimientos → más difícil, con matices).
- Número de enemigos y su capacidad de amenaza (cuántas celdas cubren/vigilan).
- Ramas falsas (caminos que parecen válidos pero no llevan a la victoria):
  cuantas más existan, más "engañoso" y difícil se percibe el nivel.
- Complejidad geométrica del tablero (arquetipo: un laberinto puntúa más que
  un rectángulo abierto).
- Márgenes de error (cuántos movimientos de margen tiene el jugador antes de
  quedar en una posición sin salida).

El resultado se normaliza a una escala (ej. 0–10) y se usa para decidir en qué
franja de progresión encaja el nivel (ver tabla en `03-GENERADOR-NIVELES.md`).

## 4. Registro de resultado por nivel

Cada nivel procesado, pase o no el validador, se puede registrar así (útil para
depurar el generador y medir tasas de éxito):

```
Nivel 48321
Mundo: ESPACIO
Forma: L_IRREGULAR
Dificultad: 7.2
Solución mínima: 23 movimientos
Resultado: VÁLIDO
```

```
Nivel 48322
Mundo: ESPACIO
Forma: LABERINTO
Resultado: RECHAZADO — motivo: objetivo inalcanzable (celda aislada)
```

Guardar el motivo de rechazo permite mejorar el generador con el tiempo (si un
arquetipo falla mucho, se ajustan sus parámetros).

## 5. Regla de oro (repetida a propósito)

> El solver/validador es la única puerta de entrada al banco de niveles.
> Ni los niveles manuales ni los generados se saltan este proceso.
