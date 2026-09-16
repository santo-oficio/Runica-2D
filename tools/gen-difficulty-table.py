#!/usr/bin/env python3
"""Genera docs/15-TABLA-CURVA-DIFICULTAD-120-JUEGOS.md a partir de la curva.
Ejecutar:  .sam-venv\\Scripts\\python.exe tools/gen-difficulty-table.py
"""
import math
from collections import defaultdict

WORLDS = ['ESPACIO', 'AGUA', 'TIERRA', 'FUEGO', 'HIELO', 'VIENTO', 'INFRAMUNDO', 'MAZMORRA']
W = len(WORLDS)
S = 15
N = W * S
T = 14
P = 0.6

# Rango de dificultad objetivo por tier (docs/11, tabla 2.3)
TIER_RANGE = [
    (0.5, 1.5), (1.0, 2.0), (1.5, 2.5), (2.0, 3.0), (2.5, 3.5), (3.0, 4.0),
    (3.5, 4.5), (4.0, 5.0), (4.5, 5.5), (5.0, 6.0), (5.5, 6.5), (6.0, 7.0),
    (6.5, 7.5), (7.0, 8.0),
]

rows = []
for w in range(W):
    for s in range(1, S + 1):
        g = w * S + s
        x = (g - 1) / (N - 1)
        y = x ** P
        tier = min(T - 1, math.floor(y * T))
        # Banda global estrictamente creciente: 0.5 -> 8.0 siguiendo la misma curva.
        # Como tier y banda comparten y = x^p, cada banda cae dentro del rango de su tier.
        band = 0.5 + y * 7.5
        rows.append(dict(g=g, world=WORLDS[w], sub=s, tier=tier, band=round(band, 2), castle=(s == S)))

groups = defaultdict(list)
for r in rows:
    groups[r['tier']].append(r)

lines = []
lines.append('# 📈 Tabla de curva de dificultad — 120 juegos (8 mundos × 15 subniveles)')
lines.append('')
lines.append('> Generada por `tools/gen-difficulty-table.py`. Parámetros:')
lines.append('> `W=8`, `S=15`, `N=120`, `T=14` tramos, `p=0.6`.')
lines.append('')
lines.append('Esta tabla es la referencia **a fuego** de qué tier y qué banda de')
lines.append('dificultad objetivo le toca a cada pantalla de la partida completa.')
lines.append('')
lines.append('## Reglas "a fuego"')
lines.append('')
lines.append('1. **Sin solapamiento inicial**: al comenzar un nivel, ninguna casilla')
lines.append('   puede contener más de un item (jugador, enemigo, obstáculo, trampa,')
lines.append('   llave o meta son todos únicos por celda).')
lines.append('2. **Sin dificultad baja absurda**: un nivel fácil NO es un nivel vacío.')
lines.append('   La dificultad baja se consigue con menos elementos y patrones más')
lines.append('   simples, nunca con elementos irrelevantes o desconectados del reto.')
lines.append('3. **Máximo 3 enemigos** en cualquier pantalla, en cualquier tier.')
lines.append('4. **Trampa**: aturde 3 turnos a quien la pisa (jugador o enemigo), de')
lines.append('   forma individual por entidad.')
lines.append('5. **Obstáculo (`X`)**: bloquea el 100% de su casilla, igual que una pared.')
lines.append('')
lines.append('## Fórmula')
lines.append('')
lines.append('```')
lines.append('x = (g - 1) / (N - 1)        // progreso global 0..1')
lines.append('y = x ^ p                    // p = 0.6')
lines.append('tier  = 1 + floor(y * 14)    // 1..14 (receta de generación: qué se permite)')
lines.append('banda = 0.5 + y * 7.5        // dificultad global, estrictamente creciente')
lines.append('```')
lines.append('')
lines.append('- **`tier`** decide qué puede generar (máx. enemigos/trampas/obstáculos y')
lines.append('  arquetipos). Es un número entero 1–14.')
lines.append('- **`banda`** es la dificultad objetivo continua (0.5 → 8.0), **siempre')
lines.append('  creciente**: cada pantalla es más difícil que la anterior, sin bajones.')
lines.append('  Como tier y banda comparten `y = x^p`, cada banda cae dentro del rango')
lines.append('  de dificultad de su tier (ver docs/11, tabla 2.3).')
lines.append('- El subnivel 15 (castillo) es la pantalla más difícil de su mundo; no')
lines.append('  introduce picos artificiales, es el máximo natural del mundo en la rampa.')
lines.append('')
lines.append('## Resumen por tier')
lines.append('')
lines.append('| Tier | Juegos | Rango objetivo | Bandas reales |')
lines.append('|---|---|---|---|')
for t in range(T):
    grp = groups[t]
    lo, hi = TIER_RANGE[t]
    lo_b = min(r['band'] for r in grp)
    hi_b = max(r['band'] for r in grp)
    lines.append(f'| {t + 1} | {len(grp)} | {lo:.1f}–{hi:.1f} | {lo_b:.2f}–{hi_b:.2f} |')
lines.append('')
lines.append('## Tabla completa')
lines.append('')
lines.append('| # | Mundo | Sub | Tier | Banda | Nota |')
lines.append('|---|---|---|---|---|---|')
for r in rows:
    mark = '🏰 castillo' if r['castle'] else ''
    lines.append(f"| {r['g']} | {r['world']} | {r['sub']} | {r['tier'] + 1} | {r['band']:.2f} | {mark} |")
lines.append('')

out = '\n'.join(lines)
with open('docs/15-TABLA-CURVA-DIFICULTAD-120-JUEGOS.md', 'w', encoding='utf-8') as f:
    f.write(out)
print(f'Escrito docs/15-TABLA-CURVA-DIFICULTAD-120-JUEGOS.md con {N} juegos.')
