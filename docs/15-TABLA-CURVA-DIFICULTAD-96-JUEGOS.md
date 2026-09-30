# 📈 Tabla de progresión — 96 pantallas (8 mundos × 12 islas)

> Generada por `tools/gen-difficulty-table.py`. Parámetros:
> `W=8`, `S=12`, `N=96`, `T=14` niveles, reparto lineal.

El nivel de juego (tier 1–14) depende del **número de pantallas
superadas**, no de la isla/mundo (los mundos se juegan en orden
libre). Los niveles 1-3 son cortos (3 pantallas cada uno, son
muy fáciles); del 4 al 14 se reparten las 87 restantes (~8).

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
c < 9  → tier = floor(c/3) + 1                       // niveles 1-3 cortos
c >= 9 → tier = floor((c-9) * 11 / 87) + 4           // niveles 4..14
banda = 0.5 + c / 95 * 7.5               // dificultad continua
```

## Resumen por nivel

| Nivel | Pantallas | Rango objetivo | Bandas reales |
|---|---|---|---|
| 1 | 3 | 0.5–1.5 | 0.50–0.66 |
| 2 | 3 | 1.0–2.0 | 0.74–0.89 |
| 3 | 3 | 1.5–2.5 | 0.97–1.13 |
| 4 | 8 | 2.0–3.0 | 1.21–1.76 |
| 5 | 8 | 2.5–3.5 | 1.84–2.39 |
| 6 | 8 | 3.0–4.0 | 2.47–3.03 |
| 7 | 8 | 3.5–4.5 | 3.11–3.66 |
| 8 | 8 | 4.0–5.0 | 3.74–4.29 |
| 9 | 8 | 4.5–5.5 | 4.37–4.92 |
| 10 | 8 | 5.0–6.0 | 5.00–5.55 |
| 11 | 8 | 5.5–6.5 | 5.63–6.18 |
| 12 | 8 | 6.0–7.0 | 6.26–6.82 |
| 13 | 8 | 6.5–7.5 | 6.89–7.45 |
| 14 | 7 | 7.0–8.0 | 7.53–8.00 |

## Tabla completa

| Pantalla nº (orden de superación) | Nivel | Banda |
|---|---|---|
| 1 | 1 | 0.50 |
| 2 | 1 | 0.58 |
| 3 | 1 | 0.66 |
| 4 | 2 | 0.74 |
| 5 | 2 | 0.82 |
| 6 | 2 | 0.89 |
| 7 | 3 | 0.97 |
| 8 | 3 | 1.05 |
| 9 | 3 | 1.13 |
| 10 | 4 | 1.21 |
| 11 | 4 | 1.29 |
| 12 | 4 | 1.37 |
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
| 24 | 5 | 2.32 |
| 25 | 5 | 2.39 |
| 26 | 6 | 2.47 |
| 27 | 6 | 2.55 |
| 28 | 6 | 2.63 |
| 29 | 6 | 2.71 |
| 30 | 6 | 2.79 |
| 31 | 6 | 2.87 |
| 32 | 6 | 2.95 |
| 33 | 6 | 3.03 |
| 34 | 7 | 3.11 |
| 35 | 7 | 3.18 |
| 36 | 7 | 3.26 |
| 37 | 7 | 3.34 |
| 38 | 7 | 3.42 |
| 39 | 7 | 3.50 |
| 40 | 7 | 3.58 |
| 41 | 7 | 3.66 |
| 42 | 8 | 3.74 |
| 43 | 8 | 3.82 |
| 44 | 8 | 3.89 |
| 45 | 8 | 3.97 |
| 46 | 8 | 4.05 |
| 47 | 8 | 4.13 |
| 48 | 8 | 4.21 |
| 49 | 8 | 4.29 |
| 50 | 9 | 4.37 |
| 51 | 9 | 4.45 |
| 52 | 9 | 4.53 |
| 53 | 9 | 4.61 |
| 54 | 9 | 4.68 |
| 55 | 9 | 4.76 |
| 56 | 9 | 4.84 |
| 57 | 9 | 4.92 |
| 58 | 10 | 5.00 |
| 59 | 10 | 5.08 |
| 60 | 10 | 5.16 |
| 61 | 10 | 5.24 |
| 62 | 10 | 5.32 |
| 63 | 10 | 5.39 |
| 64 | 10 | 5.47 |
| 65 | 10 | 5.55 |
| 66 | 11 | 5.63 |
| 67 | 11 | 5.71 |
| 68 | 11 | 5.79 |
| 69 | 11 | 5.87 |
| 70 | 11 | 5.95 |
| 71 | 11 | 6.03 |
| 72 | 11 | 6.11 |
| 73 | 11 | 6.18 |
| 74 | 12 | 6.26 |
| 75 | 12 | 6.34 |
| 76 | 12 | 6.42 |
| 77 | 12 | 6.50 |
| 78 | 12 | 6.58 |
| 79 | 12 | 6.66 |
| 80 | 12 | 6.74 |
| 81 | 12 | 6.82 |
| 82 | 13 | 6.89 |
| 83 | 13 | 6.97 |
| 84 | 13 | 7.05 |
| 85 | 13 | 7.13 |
| 86 | 13 | 7.21 |
| 87 | 13 | 7.29 |
| 88 | 13 | 7.37 |
| 89 | 13 | 7.45 |
| 90 | 14 | 7.53 |
| 91 | 14 | 7.61 |
| 92 | 14 | 7.68 |
| 93 | 14 | 7.76 |
| 94 | 14 | 7.84 |
| 95 | 14 | 7.92 |
| 96 | 14 | 8.00 |
