# Tabla de progresión — 96 pantallas (8 mundos × 12 islas)

> Regenerada para la curva a fuego del usuario: tiers **6..18**.
> Fórmula en `db/db.ts` (`tierForCompleted`).

El nivel de juego (tier 6–18) depende del **número de pantallas
superadas**, no de la isla/mundo (los mundos se juegan en orden
libre). La partida siempre empieza en el **tier 6** y llega al **18**;
los 96 escenarios se reparten de forma uniforme entre los 13 tiers
(~7-8 islas por tier).

## Reglas "a fuego"

1. **Sin solapamiento inicial**: al comenzar un nivel, ninguna casilla
   puede contener más de un item (jugador, enemigo, obstáculo, trampa,
   llave o meta son todos únicos por celda).
2. **Sin dificultad baja absurda**: un nivel fácil NO es un nivel vacío.
   La dificultad baja se consigue con menos elementos y patrones más
   simples, nunca con elementos irrelevantes o desconectados del reto.
3. **Separación avatar↔salida ≥ 6 columnas** (`MIN_PLAYER_EXIT_COLDIST`):
   la salida nunca queda cerca del avatar.
4. **Máximo 3 enemigos** en cualquier pantalla (2 hasta el tier 16,
   3 desde el tier 17).
5. **Trampa**: aturde 3 turnos a quien la pisa (jugador o enemigo), de
   forma individual por entidad.
6. **Obstáculo (`X`)**: bloquea el 100% de su casilla, igual que una pared.
7. **Bosses**: solo la isla 12 de cada mundo usa sprites de boss.

## Fórmula

```
c = pantallas superadas (0..95)
tier  = min(18, 6 + floor(c × 13 / 96))
banda = 0.5 + c / 95 × 7.5              // dificultad continua
```

## Resumen por nivel

| Nivel | Pantallas | Rango c | Bandas reales |
|---|---|---|---|
| 6 | 8 | 0–7 | 0.50–1.05 |
| 7 | 7 | 8–14 | 1.13–1.61 |
| 8 | 8 | 15–22 | 1.68–2.24 |
| 9 | 7 | 23–29 | 2.32–2.79 |
| 10 | 7 | 30–36 | 2.87–3.34 |
| 11 | 8 | 37–44 | 3.42–3.97 |
| 12 | 7 | 45–51 | 4.05–4.53 |
| 13 | 8 | 52–59 | 4.61–5.16 |
| 14 | 7 | 60–66 | 5.24–5.71 |
| 15 | 7 | 67–73 | 5.79–6.26 |
| 16 | 8 | 74–81 | 6.34–6.89 |
| 17 | 7 | 82–88 | 6.97–7.45 |
| 18 | 7 | 89–95 | 7.53–8.00 |

## Tabla completa

| Pantalla nº (orden de superación) | Nivel | Banda |
|---|---|---|
| 1 | 6 | 0.50 |
| 2 | 6 | 0.58 |
| 3 | 6 | 0.66 |
| 4 | 6 | 0.74 |
| 5 | 6 | 0.82 |
| 6 | 6 | 0.89 |
| 7 | 6 | 0.97 |
| 8 | 6 | 1.05 |
| 9 | 7 | 1.13 |
| 10 | 7 | 1.21 |
| 11 | 7 | 1.29 |
| 12 | 7 | 1.37 |
| 13 | 7 | 1.45 |
| 14 | 7 | 1.53 |
| 15 | 7 | 1.61 |
| 16 | 8 | 1.68 |
| 17 | 8 | 1.76 |
| 18 | 8 | 1.84 |
| 19 | 8 | 1.92 |
| 20 | 8 | 2.00 |
| 21 | 8 | 2.08 |
| 22 | 8 | 2.16 |
| 23 | 8 | 2.24 |
| 24 | 9 | 2.32 |
| 25 | 9 | 2.39 |
| 26 | 9 | 2.47 |
| 27 | 9 | 2.55 |
| 28 | 9 | 2.63 |
| 29 | 9 | 2.71 |
| 30 | 9 | 2.79 |
| 31 | 10 | 2.87 |
| 32 | 10 | 2.95 |
| 33 | 10 | 3.03 |
| 34 | 10 | 3.11 |
| 35 | 10 | 3.18 |
| 36 | 10 | 3.26 |
| 37 | 10 | 3.34 |
| 38 | 11 | 3.42 |
| 39 | 11 | 3.50 |
| 40 | 11 | 3.58 |
| 41 | 11 | 3.66 |
| 42 | 11 | 3.74 |
| 43 | 11 | 3.82 |
| 44 | 11 | 3.89 |
| 45 | 11 | 3.97 |
| 46 | 12 | 4.05 |
| 47 | 12 | 4.13 |
| 48 | 12 | 4.21 |
| 49 | 12 | 4.29 |
| 50 | 12 | 4.37 |
| 51 | 12 | 4.45 |
| 52 | 12 | 4.53 |
| 53 | 13 | 4.61 |
| 54 | 13 | 4.68 |
| 55 | 13 | 4.76 |
| 56 | 13 | 4.84 |
| 57 | 13 | 4.92 |
| 58 | 13 | 5.00 |
| 59 | 13 | 5.08 |
| 60 | 13 | 5.16 |
| 61 | 14 | 5.24 |
| 62 | 14 | 5.32 |
| 63 | 14 | 5.39 |
| 64 | 14 | 5.47 |
| 65 | 14 | 5.55 |
| 66 | 14 | 5.63 |
| 67 | 14 | 5.71 |
| 68 | 15 | 5.79 |
| 69 | 15 | 5.87 |
| 70 | 15 | 5.95 |
| 71 | 15 | 6.03 |
| 72 | 15 | 6.11 |
| 73 | 15 | 6.18 |
| 74 | 15 | 6.26 |
| 75 | 16 | 6.34 |
| 76 | 16 | 6.42 |
| 77 | 16 | 6.50 |
| 78 | 16 | 6.58 |
| 79 | 16 | 6.66 |
| 80 | 16 | 6.74 |
| 81 | 16 | 6.82 |
| 82 | 16 | 6.89 |
| 83 | 17 | 6.97 |
| 84 | 17 | 7.05 |
| 85 | 17 | 7.13 |
| 86 | 17 | 7.21 |
| 87 | 17 | 7.29 |
| 88 | 17 | 7.37 |
| 89 | 17 | 7.45 |
| 90 | 18 | 7.53 |
| 91 | 18 | 7.61 |
| 92 | 18 | 7.68 |
| 93 | 18 | 7.76 |
| 94 | 18 | 7.84 |
| 95 | 18 | 7.92 |
| 96 | 18 | 8.00 |
