# Tabla de progresión — 96 pantallas (8 mundos × 12 islas)

> Regenerada para la curva a fuego del usuario: tiers **2..18**.
> Fórmula en `db/db.ts` (`tierForCompleted`).

El nivel de juego (tier 2–18) depende del **número de pantallas
superadas**, no de la isla/mundo (los mundos se juegan en orden
libre). La partida siempre empieza en el **tier 2** y llega al **18**;
los 96 escenarios se reparten de forma uniforme entre los 17 tiers
(~5-6 islas por tier).

## Reglas "a fuego"

1. **Sin solapamiento inicial**: al comenzar un nivel, ninguna casilla
   puede contener más de un item (jugador, enemigo, obstáculo, trampa,
   llave o meta son todos únicos por celda).
2. **Sin dificultad baja absurda**: un nivel fácil NO es un nivel vacío.
   La dificultad baja se consigue con menos elementos y patrones más
   simples, nunca con elementos irrelevantes o desconectados del reto.
3. **Separación avatar↔salida ≥ 6 columnas** (`MIN_PLAYER_EXIT_COLDIST`):
   la salida nunca queda cerca del avatar.
4. **Máximo 3 enemigos** en cualquier pantalla (1 en tiers 2–4,
   2 en 5–16, 3 desde el tier 17).
5. **Trampa**: aturde 3 turnos a quien la pisa (jugador o enemigo), de
   forma individual por entidad.
6. **Obstáculo (`X`)**: bloquea el 100% de su casilla, igual que una pared.
7. **Bosses**: solo la isla 12 de cada mundo usa sprites de boss.

## Fórmula

```
c = pantallas superadas (0..95)
tier  = min(18, 2 + floor(c × 17 / 96))
banda = 0.5 + c / 95 × 7.5              // dificultad continua
```

## Resumen por nivel

| Nivel | Pantallas | Rango c | Bandas reales |
|---|---|---|---|
| 2 | 6 | 0–5 | 0.50–0.89 |
| 3 | 6 | 6–11 | 0.97–1.37 |
| 4 | 5 | 12–16 | 1.45–1.76 |
| 5 | 6 | 17–22 | 1.84–2.24 |
| 6 | 6 | 23–28 | 2.32–2.71 |
| 7 | 5 | 29–33 | 2.79–3.11 |
| 8 | 6 | 34–39 | 3.18–3.58 |
| 9 | 6 | 40–45 | 3.66–4.05 |
| 10 | 5 | 46–50 | 4.13–4.45 |
| 11 | 6 | 51–56 | 4.53–4.92 |
| 12 | 6 | 57–62 | 5.00–5.39 |
| 13 | 5 | 63–67 | 5.47–5.79 |
| 14 | 6 | 68–73 | 5.87–6.26 |
| 15 | 6 | 74–79 | 6.34–6.74 |
| 16 | 5 | 80–84 | 6.82–7.13 |
| 17 | 6 | 85–90 | 7.21–7.61 |
| 18 | 5 | 91–95 | 7.68–8.00 |

## Tabla completa

| Pantalla nº (orden de superación) | Nivel | Banda |
|---|---|---|
| 1 | 2 | 0.50 |
| 2 | 2 | 0.58 |
| 3 | 2 | 0.66 |
| 4 | 2 | 0.74 |
| 5 | 2 | 0.82 |
| 6 | 2 | 0.89 |
| 7 | 3 | 0.97 |
| 8 | 3 | 1.05 |
| 9 | 3 | 1.13 |
| 10 | 3 | 1.21 |
| 11 | 3 | 1.29 |
| 12 | 3 | 1.37 |
| 13 | 4 | 1.45 |
| 14 | 4 | 1.53 |
| 15 | 4 | 1.61 |
| 16 | 4 | 1.68 |
| 17 | 4 | 1.76 |
| 18 | 5 | 1.84 |
| 19 | 5 | 1.92 |
| 20 | 5 | 2.00 |
| 21 | 5 | 2.08 |
| 22 | 5 | 2.16 |
| 23 | 5 | 2.24 |
| 24 | 6 | 2.32 |
| 25 | 6 | 2.39 |
| 26 | 6 | 2.47 |
| 27 | 6 | 2.55 |
| 28 | 6 | 2.63 |
| 29 | 6 | 2.71 |
| 30 | 7 | 2.79 |
| 31 | 7 | 2.87 |
| 32 | 7 | 2.95 |
| 33 | 7 | 3.03 |
| 34 | 7 | 3.11 |
| 35 | 8 | 3.18 |
| 36 | 8 | 3.26 |
| 37 | 8 | 3.34 |
| 38 | 8 | 3.42 |
| 39 | 8 | 3.50 |
| 40 | 8 | 3.58 |
| 41 | 9 | 3.66 |
| 42 | 9 | 3.74 |
| 43 | 9 | 3.82 |
| 44 | 9 | 3.89 |
| 45 | 9 | 3.97 |
| 46 | 9 | 4.05 |
| 47 | 10 | 4.13 |
| 48 | 10 | 4.21 |
| 49 | 10 | 4.29 |
| 50 | 10 | 4.37 |
| 51 | 10 | 4.45 |
| 52 | 11 | 4.53 |
| 53 | 11 | 4.61 |
| 54 | 11 | 4.68 |
| 55 | 11 | 4.76 |
| 56 | 11 | 4.84 |
| 57 | 11 | 4.92 |
| 58 | 12 | 5.00 |
| 59 | 12 | 5.08 |
| 60 | 12 | 5.16 |
| 61 | 12 | 5.24 |
| 62 | 12 | 5.32 |
| 63 | 12 | 5.39 |
| 64 | 13 | 5.47 |
| 65 | 13 | 5.55 |
| 66 | 13 | 5.63 |
| 67 | 13 | 5.71 |
| 68 | 13 | 5.79 |
| 69 | 14 | 5.87 |
| 70 | 14 | 5.95 |
| 71 | 14 | 6.03 |
| 72 | 14 | 6.11 |
| 73 | 14 | 6.18 |
| 74 | 14 | 6.26 |
| 75 | 15 | 6.34 |
| 76 | 15 | 6.42 |
| 77 | 15 | 6.50 |
| 78 | 15 | 6.58 |
| 79 | 15 | 6.66 |
| 80 | 15 | 6.74 |
| 81 | 16 | 6.82 |
| 82 | 16 | 6.89 |
| 83 | 16 | 6.97 |
| 84 | 16 | 7.05 |
| 85 | 16 | 7.13 |
| 86 | 17 | 7.21 |
| 87 | 17 | 7.29 |
| 88 | 17 | 7.37 |
| 89 | 17 | 7.45 |
| 90 | 17 | 7.53 |
| 91 | 17 | 7.61 |
| 92 | 18 | 7.68 |
| 93 | 18 | 7.76 |
| 94 | 18 | 7.84 |
| 95 | 18 | 7.92 |
| 96 | 18 | 8.00 |
