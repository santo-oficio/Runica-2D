#!/usr/bin/env python3
"""Genera docs/15-TABLA-CURVA-DIFICULTAD-96-JUEGOS.md a partir de la progresión.
Ejecutar:  .sam-venv\\Scripts\\python.exe tools/gen-difficulty-table.py
"""
import math
from collections import defaultdict

WORLDS = ['ESPACIO', 'AGUA', 'TIERRA', 'FUEGO', 'HIELO', 'VIENTO', 'INFRAMUNDO', 'MAZMORRA']
W = len(WORLDS)
S = 12
N = W * S  # 96
T = 14

# El nivel de juego NO depende de la isla/mundo: los mundos se juegan en orden
# libre. Depende del Nº DE PANTALLAS SUPERADAS. Niveles 1-3 cortos (3 cada
# uno, son muy fáciles); el resto reparte lineal las 87 restantes (4..14).
def tier_for(c):  # c = pantallas superadas 0..95
    if c < 9:
        return c // 3 + 1
    return min(T, math.floor((c - 9) * (T - 3) / (N - 9)) + 4)

def band_for(c):
    return 0.5 + (c / (N - 1)) * 7.5

# Rango de dificultad objetivo por tier (docs/11, tabla 2.3)
TIER_RANGE = [
    (0.5, 1.5), (1.0, 2.0), (1.5, 2.5), (2.0, 3.0), (2.5, 3.5), (3.0, 4.0),
    (3.5, 4.5), (4.0, 5.0), (4.5, 5.5), (5.0, 6.0), (5.5, 6.5), (6.0, 7.0),
    (6.5, 7.5), (7.0, 8.0),
]

rows = []
for c in range(N):  # c = 0..95 pantallas superadas → la pantalla nº c+1 que juegas
    rows.append(dict(n=c + 1, tier=tier_for(c), band=round(band_for(c), 2)))

groups = defaultdict(list)
for r in rows:
    groups[r['tier']].append(r)

lines = []
lines.append('# 📈 Tabla de progresión — 96 pantallas (8 mundos × 12 islas)')
lines.append('')
lines.append('> Generada por `tools/gen-difficulty-table.py`. Parámetros:')
lines.append('> `W=8`, `S=12`, `N=96`, `T=14` niveles, reparto lineal.')
lines.append('')
lines.append('El nivel de juego (tier 1–14) depende del **número de pantallas')
lines.append('superadas**, no de la isla/mundo (los mundos se juegan en orden')
lines.append('libre). Los niveles 1-3 son cortos (3 pantallas cada uno, son')
lines.append('muy fáciles); del 4 al 14 se reparten las 87 restantes (~8).')
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
lines.append('6. **Bosses**: solo la isla 12 de cada mundo usa sprites de boss.')
lines.append('')
lines.append('## Fórmula')
lines.append('')
lines.append('```')
lines.append('c = pantallas superadas (0..95)')
lines.append('c < 9  → tier = floor(c/3) + 1                       // niveles 1-3 cortos')
lines.append('c >= 9 → tier = floor((c-9) * 11 / 87) + 4           // niveles 4..14')
lines.append('banda = 0.5 + c / 95 * 7.5               // dificultad continua')
lines.append('```')
lines.append('')
lines.append('## Resumen por nivel')
lines.append('')
lines.append('| Nivel | Pantallas | Rango objetivo | Bandas reales |')
lines.append('|---|---|---|---|')
for t in range(1, T + 1):
    grp = groups.get(t, [])
    if not grp:
        continue
    lo, hi = TIER_RANGE[t - 1]
    lo_b = min(r['band'] for r in grp)
    hi_b = max(r['band'] for r in grp)
    lines.append(f'| {t} | {len(grp)} | {lo:.1f}–{hi:.1f} | {lo_b:.2f}–{hi_b:.2f} |')
lines.append('')
lines.append('## Tabla completa')
lines.append('')
lines.append('| Pantalla nº (orden de superación) | Nivel | Banda |')
lines.append('|---|---|---|')
for r in rows:
    lines.append(f"| {r['n']} | {r['tier']} | {r['band']:.2f} |")
lines.append('')

out = '\n'.join(lines)
with open('docs/15-TABLA-CURVA-DIFICULTAD-96-JUEGOS.md', 'w', encoding='utf-8') as f:
    f.write(out)
print(f'Escrito docs/15-TABLA-CURVA-DIFICULTAD-96-JUEGOS.md con {N} pantallas.')
