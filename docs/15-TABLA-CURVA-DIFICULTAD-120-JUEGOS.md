# 📈 Tabla de curva de dificultad — 120 juegos (8 mundos × 15 subniveles)

> Generada por `tools/gen-difficulty-table.py`. Parámetros:
> `W=8`, `S=15`, `N=120`, `T=14` tramos, `p=0.6`.

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
- El subnivel 15 (castillo) es la pantalla más difícil de su mundo; no
  introduce picos artificiales, es el máximo natural del mundo en la rampa.

## Resumen por tier

| Tier | Juegos | Rango objetivo | Bandas reales |
|---|---|---|---|
| 1 | 2 | 0.5–1.5 | 0.50–0.93 |
| 2 | 3 | 1.0–2.0 | 1.15–1.48 |
| 3 | 5 | 1.5–2.5 | 1.62–2.09 |
| 4 | 5 | 2.0–3.0 | 2.20–2.58 |
| 5 | 7 | 2.5–3.5 | 2.66–3.15 |
| 6 | 7 | 3.0–4.0 | 3.22–3.65 |
| 7 | 9 | 3.5–4.5 | 3.71–4.22 |
| 8 | 9 | 4.0–5.0 | 4.28–4.74 |
| 9 | 10 | 4.5–5.5 | 4.80–5.27 |
| 10 | 11 | 5.0–6.0 | 5.32–5.81 |
| 11 | 12 | 5.5–6.5 | 5.86–6.37 |
| 12 | 13 | 6.0–7.0 | 6.41–6.93 |
| 13 | 13 | 6.5–7.5 | 6.97–7.46 |
| 14 | 14 | 7.0–8.0 | 7.50–8.00 |

## Tabla completa

| # | Mundo | Sub | Tier | Banda | Nota |
|---|---|---|---|---|---|
| 1 | ESPACIO | 1 | 1 | 0.50 |  |
| 2 | ESPACIO | 2 | 1 | 0.93 |  |
| 3 | ESPACIO | 3 | 2 | 1.15 |  |
| 4 | ESPACIO | 4 | 2 | 1.32 |  |
| 5 | ESPACIO | 5 | 2 | 1.48 |  |
| 6 | ESPACIO | 6 | 3 | 1.62 |  |
| 7 | ESPACIO | 7 | 3 | 1.75 |  |
| 8 | ESPACIO | 8 | 3 | 1.87 |  |
| 9 | ESPACIO | 9 | 3 | 1.98 |  |
| 10 | ESPACIO | 10 | 3 | 2.09 |  |
| 11 | ESPACIO | 11 | 4 | 2.20 |  |
| 12 | ESPACIO | 12 | 4 | 2.30 |  |
| 13 | ESPACIO | 13 | 4 | 2.39 |  |
| 14 | ESPACIO | 14 | 4 | 2.49 |  |
| 15 | ESPACIO | 15 | 4 | 2.58 | 🏰 castillo |
| 16 | AGUA | 1 | 5 | 2.66 |  |
| 17 | AGUA | 2 | 5 | 2.75 |  |
| 18 | AGUA | 3 | 5 | 2.83 |  |
| 19 | AGUA | 4 | 5 | 2.91 |  |
| 20 | AGUA | 5 | 5 | 2.99 |  |
| 21 | AGUA | 6 | 5 | 3.07 |  |
| 22 | AGUA | 7 | 5 | 3.15 |  |
| 23 | AGUA | 8 | 6 | 3.22 |  |
| 24 | AGUA | 9 | 6 | 3.30 |  |
| 25 | AGUA | 10 | 6 | 3.37 |  |
| 26 | AGUA | 11 | 6 | 3.44 |  |
| 27 | AGUA | 12 | 6 | 3.51 |  |
| 28 | AGUA | 13 | 6 | 3.58 |  |
| 29 | AGUA | 14 | 6 | 3.65 |  |
| 30 | AGUA | 15 | 7 | 3.71 | 🏰 castillo |
| 31 | TIERRA | 1 | 7 | 3.78 |  |
| 32 | TIERRA | 2 | 7 | 3.85 |  |
| 33 | TIERRA | 3 | 7 | 3.91 |  |
| 34 | TIERRA | 4 | 7 | 3.97 |  |
| 35 | TIERRA | 5 | 7 | 4.04 |  |
| 36 | TIERRA | 6 | 7 | 4.10 |  |
| 37 | TIERRA | 7 | 7 | 4.16 |  |
| 38 | TIERRA | 8 | 7 | 4.22 |  |
| 39 | TIERRA | 9 | 8 | 4.28 |  |
| 40 | TIERRA | 10 | 8 | 4.34 |  |
| 41 | TIERRA | 11 | 8 | 4.40 |  |
| 42 | TIERRA | 12 | 8 | 4.46 |  |
| 43 | TIERRA | 13 | 8 | 4.51 |  |
| 44 | TIERRA | 14 | 8 | 4.57 |  |
| 45 | TIERRA | 15 | 8 | 4.63 | 🏰 castillo |
| 46 | FUEGO | 1 | 8 | 4.68 |  |
| 47 | FUEGO | 2 | 8 | 4.74 |  |
| 48 | FUEGO | 3 | 9 | 4.80 |  |
| 49 | FUEGO | 4 | 9 | 4.85 |  |
| 50 | FUEGO | 5 | 9 | 4.90 |  |
| 51 | FUEGO | 6 | 9 | 4.96 |  |
| 52 | FUEGO | 7 | 9 | 5.01 |  |
| 53 | FUEGO | 8 | 9 | 5.06 |  |
| 54 | FUEGO | 9 | 9 | 5.12 |  |
| 55 | FUEGO | 10 | 9 | 5.17 |  |
| 56 | FUEGO | 11 | 9 | 5.22 |  |
| 57 | FUEGO | 12 | 9 | 5.27 |  |
| 58 | FUEGO | 13 | 10 | 5.32 |  |
| 59 | FUEGO | 14 | 10 | 5.37 |  |
| 60 | FUEGO | 15 | 10 | 5.42 | 🏰 castillo |
| 61 | HIELO | 1 | 10 | 5.47 |  |
| 62 | HIELO | 2 | 10 | 5.52 |  |
| 63 | HIELO | 3 | 10 | 5.57 |  |
| 64 | HIELO | 4 | 10 | 5.62 |  |
| 65 | HIELO | 5 | 10 | 5.67 |  |
| 66 | HIELO | 6 | 10 | 5.72 |  |
| 67 | HIELO | 7 | 10 | 5.77 |  |
| 68 | HIELO | 8 | 10 | 5.81 |  |
| 69 | HIELO | 9 | 11 | 5.86 |  |
| 70 | HIELO | 10 | 11 | 5.91 |  |
| 71 | HIELO | 11 | 11 | 5.95 |  |
| 72 | HIELO | 12 | 11 | 6.00 |  |
| 73 | HIELO | 13 | 11 | 6.05 |  |
| 74 | HIELO | 14 | 11 | 6.09 |  |
| 75 | HIELO | 15 | 11 | 6.14 | 🏰 castillo |
| 76 | VIENTO | 1 | 11 | 6.19 |  |
| 77 | VIENTO | 2 | 11 | 6.23 |  |
| 78 | VIENTO | 3 | 11 | 6.28 |  |
| 79 | VIENTO | 4 | 11 | 6.32 |  |
| 80 | VIENTO | 5 | 11 | 6.37 |  |
| 81 | VIENTO | 6 | 12 | 6.41 |  |
| 82 | VIENTO | 7 | 12 | 6.45 |  |
| 83 | VIENTO | 8 | 12 | 6.50 |  |
| 84 | VIENTO | 9 | 12 | 6.54 |  |
| 85 | VIENTO | 10 | 12 | 6.59 |  |
| 86 | VIENTO | 11 | 12 | 6.63 |  |
| 87 | VIENTO | 12 | 12 | 6.67 |  |
| 88 | VIENTO | 13 | 12 | 6.72 |  |
| 89 | VIENTO | 14 | 12 | 6.76 |  |
| 90 | VIENTO | 15 | 12 | 6.80 | 🏰 castillo |
| 91 | INFRAMUNDO | 1 | 12 | 6.84 |  |
| 92 | INFRAMUNDO | 2 | 12 | 6.88 |  |
| 93 | INFRAMUNDO | 3 | 12 | 6.93 |  |
| 94 | INFRAMUNDO | 4 | 13 | 6.97 |  |
| 95 | INFRAMUNDO | 5 | 13 | 7.01 |  |
| 96 | INFRAMUNDO | 6 | 13 | 7.05 |  |
| 97 | INFRAMUNDO | 7 | 13 | 7.09 |  |
| 98 | INFRAMUNDO | 8 | 13 | 7.13 |  |
| 99 | INFRAMUNDO | 9 | 13 | 7.18 |  |
| 100 | INFRAMUNDO | 10 | 13 | 7.22 |  |
| 101 | INFRAMUNDO | 11 | 13 | 7.26 |  |
| 102 | INFRAMUNDO | 12 | 13 | 7.30 |  |
| 103 | INFRAMUNDO | 13 | 13 | 7.34 |  |
| 104 | INFRAMUNDO | 14 | 13 | 7.38 |  |
| 105 | INFRAMUNDO | 15 | 13 | 7.42 | 🏰 castillo |
| 106 | MAZMORRA | 1 | 13 | 7.46 |  |
| 107 | MAZMORRA | 2 | 14 | 7.50 |  |
| 108 | MAZMORRA | 3 | 14 | 7.54 |  |
| 109 | MAZMORRA | 4 | 14 | 7.58 |  |
| 110 | MAZMORRA | 5 | 14 | 7.62 |  |
| 111 | MAZMORRA | 6 | 14 | 7.65 |  |
| 112 | MAZMORRA | 7 | 14 | 7.69 |  |
| 113 | MAZMORRA | 8 | 14 | 7.73 |  |
| 114 | MAZMORRA | 9 | 14 | 7.77 |  |
| 115 | MAZMORRA | 10 | 14 | 7.81 |  |
| 116 | MAZMORRA | 11 | 14 | 7.85 |  |
| 117 | MAZMORRA | 12 | 14 | 7.89 |  |
| 118 | MAZMORRA | 13 | 14 | 7.92 |  |
| 119 | MAZMORRA | 14 | 14 | 7.96 |  |
| 120 | MAZMORRA | 15 | 14 | 8.00 | 🏰 castillo |
