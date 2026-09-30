# 📈 Tabla de progresión — 96 pantallas (8 mundos × 12 islas)

> Generada por `tools/gen-difficulty-table.py`. Parámetros:
> `W=8`, `S=12`, `N=96`, `T=14` niveles, reparto lineal.

El nivel de juego (tier 1–14) depende del **número de pantallas
superadas**, no de la isla/mundo (los mundos se juegan en orden
libre). Con 96 pantallas y 14 niveles salen ~7 pantallas por nivel.

## Reglas "a fuego"

1. **Sin solapamiento inicial**: al comenzar un nivel, ninguna casilla
   puede contener más de un item (jugador, enemigo, obstáculo, trampa,
   llave o meta son todos únicos por celda).
2. **Sin dificultad baja absurda**: un nivel fácil NO es un nivel vacío.
   La dificultad baja se consigue con menos elementos y patrones más
   simples, nunca con elementos irrelevantes o desconectados del reto.
3. **Máximo 3 enemigos** en cualquier pantalla, en cualquier tier.
4. **Trampa**: aturde 3 turnos a quien la pisa (jugador o enemigo), de
   forma individual por entidad.
5. **Obstáculo (`X`)**: bloquea el 100% de su casilla, igual que una pared.
6. **Bosses**: solo la isla 12 de cada mundo usa sprites de boss.

## Fórmula

```
c = pantallas superadas (0..95)
tier  = min(14, floor(c * 14 / 96) + 1)   // nivel de juego
banda = 0.5 + c / 95 * 7.5               // dificultad continua
```

## Resumen por nivel

| Nivel | Pantallas | Rango objetivo | Bandas reales |
|---|---|---|---|
| 1 | 7 | 0.5–1.5 | 0.50–0.97 |
| 2 | 7 | 1.0–2.0 | 1.05–1.53 |
| 3 | 7 | 1.5–2.5 | 1.61–2.08 |
| 4 | 7 | 2.0–3.0 | 2.16–2.63 |
| 5 | 7 | 2.5–3.5 | 2.71–3.18 |
| 6 | 7 | 3.0–4.0 | 3.26–3.74 |
| 7 | 6 | 3.5–4.5 | 3.82–4.21 |
| 8 | 7 | 4.0–5.0 | 4.29–4.76 |
| 9 | 7 | 4.5–5.5 | 4.84–5.32 |
| 10 | 7 | 5.0–6.0 | 5.39–5.87 |
| 11 | 7 | 5.5–6.5 | 5.95–6.42 |
| 12 | 7 | 6.0–7.0 | 6.50–6.97 |
| 13 | 7 | 6.5–7.5 | 7.05–7.53 |
| 14 | 6 | 7.0–8.0 | 7.61–8.00 |

## Tabla completa

| Pantalla nº (orden de superación) | Nivel | Banda |
|---|---|---|
| 1 | 1 | 0.50 |
| 2 | 1 | 0.58 |
| 3 | 1 | 0.66 |
| 4 | 1 | 0.74 |
| 5 | 1 | 0.82 |
| 6 | 1 | 0.89 |
| 7 | 1 | 0.97 |
| 8 | 2 | 1.05 |
| 9 | 2 | 1.13 |
| 10 | 2 | 1.21 |
| 11 | 2 | 1.29 |
| 12 | 2 | 1.37 |
| 13 | 2 | 1.45 |
| 14 | 2 | 1.53 |
| 15 | 3 | 1.61 |
| 16 | 3 | 1.68 |
| 17 | 3 | 1.76 |
| 18 | 3 | 1.84 |
| 19 | 3 | 1.92 |
| 20 | 3 | 2.00 |
| 21 | 3 | 2.08 |
| 22 | 4 | 2.16 |
| 23 | 4 | 2.24 |
| 24 | 4 | 2.32 |
| 25 | 4 | 2.39 |
| 26 | 4 | 2.47 |
| 27 | 4 | 2.55 |
| 28 | 4 | 2.63 |
| 29 | 5 | 2.71 |
| 30 | 5 | 2.79 |
| 31 | 5 | 2.87 |
| 32 | 5 | 2.95 |
| 33 | 5 | 3.03 |
| 34 | 5 | 3.11 |
| 35 | 5 | 3.18 |
| 36 | 6 | 3.26 |
| 37 | 6 | 3.34 |
| 38 | 6 | 3.42 |
| 39 | 6 | 3.50 |
| 40 | 6 | 3.58 |
| 41 | 6 | 3.66 |
| 42 | 6 | 3.74 |
| 43 | 7 | 3.82 |
| 44 | 7 | 3.89 |
| 45 | 7 | 3.97 |
| 46 | 7 | 4.05 |
| 47 | 7 | 4.13 |
| 48 | 7 | 4.21 |
| 49 | 8 | 4.29 |
| 50 | 8 | 4.37 |
| 51 | 8 | 4.45 |
| 52 | 8 | 4.53 |
| 53 | 8 | 4.61 |
| 54 | 8 | 4.68 |
| 55 | 8 | 4.76 |
| 56 | 9 | 4.84 |
| 57 | 9 | 4.92 |
| 58 | 9 | 5.00 |
| 59 | 9 | 5.08 |
| 60 | 9 | 5.16 |
| 61 | 9 | 5.24 |
| 62 | 9 | 5.32 |
| 63 | 10 | 5.39 |
| 64 | 10 | 5.47 |
| 65 | 10 | 5.55 |
| 66 | 10 | 5.63 |
| 67 | 10 | 5.71 |
| 68 | 10 | 5.79 |
| 69 | 10 | 5.87 |
| 70 | 11 | 5.95 |
| 71 | 11 | 6.03 |
| 72 | 11 | 6.11 |
| 73 | 11 | 6.18 |
| 74 | 11 | 6.26 |
| 75 | 11 | 6.34 |
| 76 | 11 | 6.42 |
| 77 | 12 | 6.50 |
| 78 | 12 | 6.58 |
| 79 | 12 | 6.66 |
| 80 | 12 | 6.74 |
| 81 | 12 | 6.82 |
| 82 | 12 | 6.89 |
| 83 | 12 | 6.97 |
| 84 | 13 | 7.05 |
| 85 | 13 | 7.13 |
| 86 | 13 | 7.21 |
| 87 | 13 | 7.29 |
| 88 | 13 | 7.37 |
| 89 | 13 | 7.45 |
| 90 | 13 | 7.53 |
| 91 | 14 | 7.61 |
| 92 | 14 | 7.68 |
| 93 | 14 | 7.76 |
| 94 | 14 | 7.84 |
| 95 | 14 | 7.92 |
| 96 | 14 | 8.00 |
