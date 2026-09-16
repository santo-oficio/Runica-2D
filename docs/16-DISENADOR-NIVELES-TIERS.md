# Diseñador de Niveles — 14 Tiers de Dificultad

> Documento de referencia para el sistema de generación de pantallas.
> Sustituye a los scripts Python originales (`wappo_generator.py`,
> `wappo_simulator.py`, `wappo_solver.py`) que fueron portados a TypeScript
> en `generator/generate-screens.ts`.

## 1. Visión general

El generador produce pantallas para un banco local de 21.000 niveles
(1.500 por tier × 14 tiers). Cada pantalla pasa por un pipeline de
**generación → pruning → validación** antes de aceptarse:

1. **Generación**: coloca jugador, salida, enemigos, obstáculos y trampas
   aleatoriamente, con bias hacia el camino directo jugador→salida.
2. **Pruning**: elimina cualquier obstáculo, trampa o enemigo cuya
   eliminación no cambie la resolubilidad, la longitud óptima, ni la
   libertad del jugador a profundidad óptima.
3. **Validación**: verifica que la longitud de solución cae en el rango
   del tier, que queda al menos un enemigo, y que todos los elementos
   restantes son funcionales.

## 2. Los 14 tiers

Cada tier define:
- `numEnemies`: nº de enemigos (1–3).
- `numObstacles`: rango (min, max) de obstáculos.
- `numTraps`: rango (min, max) de trampas.
- `minSolutionLen`: rango aceptable de longitud de solución óptima.
- `minEnemyPlayerDist`: distancia Manhattan mínima entre enemigo y jugador.

| Tier | Enemigos | Obstáculos | Trampas | Solución óptima | Dist. mín. E-P |
|------|----------|------------|---------|-----------------|----------------|
| 1    | 1        | 0–1        | 0       | 4–7             | 4              |
| 2    | 1        | 1–2        | 0       | 5–8             | 4              |
| 3    | 1        | 1–2        | 0–1     | 6–9             | 4              |
| 4    | 2        | 1–2        | 0–1     | 6–10            | 3              |
| 5    | 2        | 1–3        | 1       | 7–11            | 3              |
| 6    | 2        | 2–3        | 1       | 8–12            | 3              |
| 7    | 2        | 2–3        | 1–2     | 9–13            | 3              |
| 8    | 3        | 2–3        | 1–2     | 9–13            | 3              |
| 9    | 3        | 2–4        | 1–2     | 10–14           | 3              |
| 10   | 3        | 2–4        | 1–2     | 10–15           | 3              |
| 11   | 3        | 3–4        | 2–3     | 11–16           | 3              |
| 12   | 3        | 3–4        | 2–3     | 12–17           | 3              |
| 13   | 3        | 3–5        | 2–3     | 13–18           | 3              |
| 14   | 3        | 3–5        | 2–3     | 14–20           | 3              |

## 3. Reglas del motor (idénticas a `engine/rules.ts`)

- **Jugador**: 1 casilla/turno, ortogonal. Si choca con pared/obstáculo/
  límite, el movimiento se cancela (no cuenta como turno).
- **Enemigo CHASE**: 2 sub-pasos por turno, horizontal primero, luego
  vertical. Recalcula dx/dy en cada sub-paso.
- **Obstáculo (X)**: bloquea a jugador y enemigos.
- **Trampa (T)**: aturde 3 turnos a quien la pisa (jugador o enemigo),
  de forma individual por entidad.
- **Salida (G)**: victoria inmediata al llegar (antes del movimiento
  enemigo).
- **Contacto con enemigo**: derrota.
- **Aturdimiento**: decrementa 1 vez por turno completo (no por sub-paso).
  Un enemigo aturdido salta sus 2 sub-pasos.
- **Máximo 3 enemigos** por pantalla.
- **Sin solapamiento inicial**: ninguna casilla con más de un item.

## 4. Funcionalidad de elementos (pruning)

Un elemento (obstáculo, trampa o enemigo) es **funcional** si su
elimación produce al menos uno de estos cambios:

1. La pantalla deja de ser resoluble.
2. La longitud de solución óptima cambia.
3. La libertad del jugador (nº de soluciones distintas de longitud óptima)
   aumenta.

Si un elemento no es funcional, se elimina durante el pruning. Esto
garantiza que no haya elementos decorativos o irrelevantes: cada
obstáculo, trampa y enemigo justifica su presencia.

## 5. Formato de una pantalla en `db/screens.json`

```json
{
  "id": "l1-s1",
  "level": 1,
  "world": "AGUA",
  "grid": ["......G.", ".P.......", ...],
  "player": [1, 1],
  "goal": [7, 0],
  "enemies": [{ "pos": [5, 3], "pattern": "CHASE" }],
  "obstacles": [[3, 2]],
  "traps": [[4, 4]],
  "minMoves": 6
}
```

Caracteres del grid:
- `.` — suelo
- `#` — pared (no usada por el generador, pero soportada por el motor)
- `X` — obstáculo
- `T` — trampa
- `P` — posición inicial del jugador
- `G` — salida
- `E` — posición inicial del enemigo

## 6. Generación

```bash
npx tsx generator/generate-screens.ts
```

Genera 21.000 pantallas (1.500 × 14 tiers) en `db/screens.json`.
Tiempo aproximado: ~160s. Tasa de éxito: 100% en todos los tiers.
