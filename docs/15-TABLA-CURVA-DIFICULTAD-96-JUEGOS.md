# 📈 Tabla de curva de dificultad — 96 juegos (8 mundos × 12 subniveles)

> Generada por `tools/gen-difficulty-table.py`. Parámetros:
> `W=8`, `S=12`, `N=96`, `T=14` tramos, `p=0.6`.

Esta tabla es la referencia **a fuego** de qué tier y qué banda de
dificultad objetivo le toca a cada pantalla de la partida completa.

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

## Fórmula

```
x = (g - 1) / (N - 1)        // progreso global 0..1
y = x ^ p                    // p = 0.6
tier  = 1 + floor(y * 14)    // 1..14 (receta de generación: qué se permite)
banda = 0.5 + y * 7.5        // dificultad global, estrictamente creciente
```

- **`tier`** decide qué puede generar (máx. enemigos/trampas/obstáculos y
  arquetipos). Es un número entero 1–14.
- **`banda`** es la dificultad objetivo continua (0.5 → 8.0), **siempre
  creciente**: cada pantalla es más difícil que la anterior, sin bajones.
  Como tier y banda comparten `y = x^p`, cada banda cae dentro del rango
  de dificultad de su tier (ver docs/11, tabla 2.3).
- El subnivel 12 (isla final / boss) es la pantalla más difícil de su mundo; no
  introduce picos artificiales, es el máximo natural del mundo en la rampa.

## Resumen por tier

| Tier | Juegos | Rango objetivo | Bandas reales |
|---|---|---|---|
| 1 | 2 | 0.5–1.5 | 0.50–0.99 |
| 2 | 2 | 1.0–2.0 | 1.24–1.44 |
| 3 | 4 | 1.5–2.5 | 1.62–2.07 |
| 4 | 4 | 2.0–3.0 | 2.20–2.56 |
| 5 | 6 | 2.5–3.5 | 2.67–3.17 |
| 6 | 6 | 3.0–4.0 | 3.26–3.70 |
| 7 | 6 | 3.5–4.5 | 3.79–4.18 |
| 8 | 8 | 4.0–5.0 | 4.26–4.76 |
| 9 | 8 | 4.5–5.5 | 4.83–5.29 |
| 10 | 9 | 5.0–6.0 | 5.35–5.84 |
| 11 | 9 | 5.5–6.5 | 5.90–6.36 |
| 12 | 10 | 6.0–7.0 | 6.42–6.90 |
| 13 | 10 | 6.5–7.5 | 6.96–7.42 |
| 14 | 12 | 7.0–8.0 | 7.47–8.00 |

## Tabla completa

| # | Mundo | Sub | Tier | Banda | Nota |
|---|---|---|---|---|---|
| 1 | ESPACIO | 1 | 1 | 0.50 |  |
| 2 | ESPACIO | 2 | 1 | 0.99 |  |
| 3 | ESPACIO | 3 | 2 | 1.24 |  |
| 4 | ESPACIO | 4 | 2 | 1.44 |  |
| 5 | ESPACIO | 5 | 3 | 1.62 |  |
| 6 | ESPACIO | 6 | 3 | 1.78 |  |
| 7 | ESPACIO | 7 | 3 | 1.93 |  |
| 8 | ESPACIO | 8 | 3 | 2.07 |  |
| 9 | ESPACIO | 9 | 4 | 2.20 |  |
| 10 | ESPACIO | 10 | 4 | 2.32 |  |
| 11 | ESPACIO | 11 | 4 | 2.44 |  |
| 12 | ESPACIO | 12 | 4 | 2.56 | 🏰 castillo |
| 13 | AGUA | 1 | 5 | 2.67 |  |
| 14 | AGUA | 2 | 5 | 2.77 |  |
| 15 | AGUA | 3 | 5 | 2.88 |  |
| 16 | AGUA | 4 | 5 | 2.98 |  |
| 17 | AGUA | 5 | 5 | 3.08 |  |
| 18 | AGUA | 6 | 5 | 3.17 |  |
| 19 | AGUA | 7 | 6 | 3.26 |  |
| 20 | AGUA | 8 | 6 | 3.36 |  |
| 21 | AGUA | 9 | 6 | 3.44 |  |
| 22 | AGUA | 10 | 6 | 3.53 |  |
| 23 | AGUA | 11 | 6 | 3.62 |  |
| 24 | AGUA | 12 | 6 | 3.70 | 🏰 castillo |
| 25 | TIERRA | 1 | 7 | 3.79 |  |
| 26 | TIERRA | 2 | 7 | 3.87 |  |
| 27 | TIERRA | 3 | 7 | 3.95 |  |
| 28 | TIERRA | 4 | 7 | 4.03 |  |
| 29 | TIERRA | 5 | 7 | 4.10 |  |
| 30 | TIERRA | 6 | 7 | 4.18 |  |
| 31 | TIERRA | 7 | 8 | 4.26 |  |
| 32 | TIERRA | 8 | 8 | 4.33 |  |
| 33 | TIERRA | 9 | 8 | 4.40 |  |
| 34 | TIERRA | 10 | 8 | 4.48 |  |
| 35 | TIERRA | 11 | 8 | 4.55 |  |
| 36 | TIERRA | 12 | 8 | 4.62 | 🏰 castillo |
| 37 | FUEGO | 1 | 8 | 4.69 |  |
| 38 | FUEGO | 2 | 8 | 4.76 |  |
| 39 | FUEGO | 3 | 9 | 4.83 |  |
| 40 | FUEGO | 4 | 9 | 4.90 |  |
| 41 | FUEGO | 5 | 9 | 4.96 |  |
| 42 | FUEGO | 6 | 9 | 5.03 |  |
| 43 | FUEGO | 7 | 9 | 5.10 |  |
| 44 | FUEGO | 8 | 9 | 5.16 |  |
| 45 | FUEGO | 9 | 9 | 5.23 |  |
| 46 | FUEGO | 10 | 9 | 5.29 |  |
| 47 | FUEGO | 11 | 10 | 5.35 |  |
| 48 | FUEGO | 12 | 10 | 5.42 | 🏰 castillo |
| 49 | HIELO | 1 | 10 | 5.48 |  |
| 50 | HIELO | 2 | 10 | 5.54 |  |
| 51 | HIELO | 3 | 10 | 5.60 |  |
| 52 | HIELO | 4 | 10 | 5.66 |  |
| 53 | HIELO | 5 | 10 | 5.72 |  |
| 54 | HIELO | 6 | 10 | 5.78 |  |
| 55 | HIELO | 7 | 10 | 5.84 |  |
| 56 | HIELO | 8 | 11 | 5.90 |  |
| 57 | HIELO | 9 | 11 | 5.96 |  |
| 58 | HIELO | 10 | 11 | 6.02 |  |
| 59 | HIELO | 11 | 11 | 6.08 |  |
| 60 | HIELO | 12 | 11 | 6.14 | 🏰 castillo |
| 61 | VIENTO | 1 | 11 | 6.19 |  |
| 62 | VIENTO | 2 | 11 | 6.25 |  |
| 63 | VIENTO | 3 | 11 | 6.31 |  |
| 64 | VIENTO | 4 | 11 | 6.36 |  |
| 65 | VIENTO | 5 | 12 | 6.42 |  |
| 66 | VIENTO | 6 | 12 | 6.47 |  |
| 67 | VIENTO | 7 | 12 | 6.53 |  |
| 68 | VIENTO | 8 | 12 | 6.58 |  |
| 69 | VIENTO | 9 | 12 | 6.64 |  |
| 70 | VIENTO | 10 | 12 | 6.69 |  |
| 71 | VIENTO | 11 | 12 | 6.74 |  |
| 72 | VIENTO | 12 | 12 | 6.80 | 🏰 castillo |
| 73 | INFRAMUNDO | 1 | 12 | 6.85 |  |
| 74 | INFRAMUNDO | 2 | 12 | 6.90 |  |
| 75 | INFRAMUNDO | 3 | 13 | 6.96 |  |
| 76 | INFRAMUNDO | 4 | 13 | 7.01 |  |
| 77 | INFRAMUNDO | 5 | 13 | 7.06 |  |
| 78 | INFRAMUNDO | 6 | 13 | 7.11 |  |
| 79 | INFRAMUNDO | 7 | 13 | 7.16 |  |
| 80 | INFRAMUNDO | 8 | 13 | 7.21 |  |
| 81 | INFRAMUNDO | 9 | 13 | 7.27 |  |
| 82 | INFRAMUNDO | 10 | 13 | 7.32 |  |
| 83 | INFRAMUNDO | 11 | 13 | 7.37 |  |
| 84 | INFRAMUNDO | 12 | 13 | 7.42 | 🏰 castillo |
| 85 | MAZMORRA | 1 | 14 | 7.47 |  |
| 86 | MAZMORRA | 2 | 14 | 7.52 |  |
| 87 | MAZMORRA | 3 | 14 | 7.57 |  |
| 88 | MAZMORRA | 4 | 14 | 7.61 |  |
| 89 | MAZMORRA | 5 | 14 | 7.66 |  |
| 90 | MAZMORRA | 6 | 14 | 7.71 |  |
| 91 | MAZMORRA | 7 | 14 | 7.76 |  |
| 92 | MAZMORRA | 8 | 14 | 7.81 |  |
| 93 | MAZMORRA | 9 | 14 | 7.86 |  |
| 94 | MAZMORRA | 10 | 14 | 7.90 |  |
| 95 | MAZMORRA | 11 | 14 | 7.95 |  |
| 96 | MAZMORRA | 12 | 14 | 8.00 | 🏰 castillo |
