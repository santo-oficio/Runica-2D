# 🔄 Actualización — Tamaño de Tablero, Dificultad, Tests y Progreso

> Este documento **sustituye y amplía** partes de `03-GENERADOR-NIVELES.md`,
> `04-SOLVER-VALIDADOR.md` y `06-ESQUEMAS-JSON.md`. Donde haya conflicto de
> números o reglas entre este documento y los anteriores, **manda este**.
> Está escrito para que una IA de código (Claude Code, GLM 5.2, etc.) lo pueda
> implementar directamente, siguiendo el mismo formato que el resto de la
> documentación del proyecto.

> ⚠️ **Corrección posterior importante**: la sección 6 de este documento
> (progreso del jugador) sigue siendo válida tal cual para el mecanismo de
> "reintento pegajoso" por mundo+tramo. Pero **cómo se decide qué tramo le
> toca a cada subnivel de cada mundo** queda corregido en
> `12-CURVA-DIFICULTAD-Y-PROGRESO-GLOBAL.md`: la dificultad no se reparte
> por mundo, sino como una escala global de 14 tramos que atraviesa todos
> los mundos con una curva no lineal. Lee ese documento junto a este.

## 0. Resumen de qué cambia respecto a la versión anterior

| Concepto | Antes | Ahora |
|---|---|---|
| Tamaño de tablero | 6×6 casillas | **8 columnas × 6 filas** |
| Niveles de dificultad | (variable, ejemplo orientativo) | **14 niveles de dificultad fijos** |
| Niveles válidos por dificultad | ~18.000 | **50.000 por nivel de dificultad** (14 × 50.000 = 700.000 pantallas válidas totales, por mundo) |
| Tests de validación | Checklist de 10 puntos | **30 tests obligatorios** (ver sección 3) — **ampliados a 32** en `13-MECANICAS-OBSTACULOS-TRAMPAS-ATURDIMIENTO.md` |
| Progresión de dificultad | Genérica | **Explícita y anti-degenerada** (ver sección 2) |
| Entidades | P, E, X, G, D, K | Se añade **T = trampa** |
| Máximo de enemigos en pantalla | No definido con tope | **3 enemigos como máximo absoluto, en cualquier nivel** |
| Almacenamiento | Un banco genérico | **Un JSON por nivel de dificultad** (14 archivos), ver sección 5 |
| Progreso del jugador | No definido | **Sistema de reintento "pegajoso"** por nivel/mundo (ver sección 6) |

---

## 1. Tamaño de tablero

- Todas las pantallas usan una rejilla lógica de **8 columnas × 6 filas** (48
  celdas totales, algunas pueden no ser jugables según el arquetipo de forma).
- Esto sustituye cualquier referencia anterior a tableros de 6×6 en
  `03-GENERADOR-NIVELES.md` y en los ejemplos de `06-ESQUEMAS-JSON.md`.
- Todo lo demás de la arquitectura (rejilla alineada, `allowedCellSizes`,
  `boardArea` relativo al fondo, arquetipos de forma) sigue igual — solo
  cambian las dimensiones base de la matriz `grid`.

```json
{
  "width": 8,
  "height": 6
}
```

---

## 2. Los 14 niveles de dificultad — progresión anti-degenerada

### 2.1 Principio rector (importante, es la parte que más te preocupaba)

> Un nivel "fácil" NO es un nivel vacío de reto. Un nivel es degenerado —y se
> descarta aunque técnicamente sea resoluble— cuando la dificultad baja se
> consigue "haciendo trampa estructuralmente": por ejemplo, amontonar todos
> los obstáculos en una esquina y dejar al jugador y al enemigo completamente
> separados sin ninguna interacción real. Eso no es un nivel fácil, es un
> nivel roto. La dificultad debe bajar por **menos elementos y patrones más
> simples**, nunca por **elementos irrelevantes o desconectados del reto**.

Esto ya estaba apuntado en `04-SOLVER-VALIDADOR.md` (puntos "no es trivial" y
"no tiene situaciones absurdas"), pero aquí se concreta con reglas exactas y
tests específicos (sección 3, bloque D).

### 2.2 Qué varía entre niveles de dificultad

Por cada uno de los 14 niveles se define, como mínimo:

- **Nº de enemigos permitido** (rango min–max, nunca por encima de 3 en total).
- **Nº de trampas permitido** (rango min–max; puede ser 0 en los primeros niveles).
- **Nº de obstáculos permitido** (rango min–max).
- **Arquetipos de forma permitidos** para ese nivel (de la lista de
  `03-GENERADOR-NIVELES.md`: RECTÁNGULO, L, T, CRUZ, PASILLO, CÁMARA_CENTRAL,
  ANILLO, DOBLE_PASILLO, LABERINTO, IRREGULAR).
- **Rango de dificultad numérica objetivo** (para el puntuador del solver).
- **Longitud mínima de solución aproximada** (nº de movimientos).

### 2.3 Tabla de progresión propuesta (orientativa — ajustable en el `WorldConfig`)

| Nivel | Enemigos | Trampas | Obstáculos | Arquetipos permitidos | Dificultad objetivo |
|---|---|---|---|---|---|
| 1 | 0–1 | 0 | 0–2 | RECTÁNGULO | 0.5–1.5 |
| 2 | 0–1 | 0 | 1–3 | RECTÁNGULO, L | 1.0–2.0 |
| 3 | 1 | 0–1 | 2–3 | L, T | 1.5–2.5 |
| 4 | 1 | 1 | 2–4 | T, CRUZ | 2.0–3.0 |
| 5 | 1 | 1–2 | 3–4 | CRUZ, PASILLO | 2.5–3.5 |
| 6 | 1–2 | 1–2 | 3–5 | PASILLO, CÁMARA_CENTRAL | 3.0–4.0 |
| 7 | 2 | 2 | 4–5 | CÁMARA_CENTRAL, ANILLO | 3.5–4.5 |
| 8 | 2 | 2–3 | 4–6 | ANILLO, DOBLE_PASILLO | 4.0–5.0 |
| 9 | 2 | 2–3 | 5–6 | DOBLE_PASILLO, IRREGULAR | 4.5–5.5 |
| 10 | 2 | 3 | 5–7 | IRREGULAR, LABERINTO | 5.0–6.0 |
| 11 | 2–3 | 3–4 | 6–7 | LABERINTO | 5.5–6.5 |
| 12 | 3 | 3–4 | 6–8 | LABERINTO, combinado | 6.0–7.0 |
| 13 | 3 | 4–5 | 7–8 | combinado | 6.5–7.5 |
| 14 | 3 | 4–5 | 7–9 | combinado (máxima variedad) | 7.0–8.0 |

**Notas sobre la tabla:**

- El **nivel 1** nunca tiene 2 enemigos ni trampas — es literalmente "muévete
  y esquiva/alcanza el objetivo", con como mucho un par de obstáculos sueltos.
  Esto responde directamente a tu ejemplo: en nivel 1 no debe aparecer un
  segundo enemigo porque eso ya es más difícil de lo que ese nivel debe ser.
- El límite de **3 enemigos es absoluto**: ningún nivel, ni siquiera el 14,
  lo supera.
- Los rangos son intencionalmente **solapados entre niveles consecutivos**
  (ej. nivel 5 y 6 comparten el arquetipo PASILLO) para que la transición se
  sienta progresiva y no a saltos bruscos.
- Estos números son un punto de partida razonable, no un dogma: ajústalos
  jugando y midiendo con el solver real cuánto tarda un jugador medio en
  resolver cada tier.

### 2.4 Variedad dentro del mismo nivel de dificultad

Dentro de un mismo nivel (por ejemplo, el nivel 6), las 50.000 pantallas no
deben sentirse iguales. Para lograrlo:

- El generador combina el rango de enemigos/trampas/obstáculos de forma
  variable dentro del rango permitido (no siempre el máximo): una pantalla
  del nivel 6 puede tener 1 enemigo + 2 trampas + 3 obstáculos, y otra puede
  tener 2 enemigos + 1 trampa + 5 obstáculos — ambas dentro de las reglas de
  ese nivel, pero con "sabor" distinto.
- Se alterna el arquetipo de forma entre los permitidos para ese nivel.
- Se aplica el test de similitud estructural (ver sección 3, test #25) para
  evitar que el banco acumule miles de pantallas casi idénticas.
- Regla práctica que pediste explícitamente: **no saturar el tablero**. Como
  máximo, en cualquier nivel de dificultad, la suma de "elementos activos"
  (trampas + obstáculos + enemigos) no debería superar aproximadamente el
  40–50% de las celdas jugables totales, para que siempre quede espacio de
  maniobra real. Esto se comprueba en el test #23.

---

## 3. Los 30 tests obligatorios (ampliados a 32 en `13-MECANICAS-OBSTACULOS-TRAMPAS-ATURDIMIENTO.md`)

Toda pantalla (manual o generada) debe pasar los 30 tests base de aquí **más
los tests 31 y 32** de `13-MECANICAS-OBSTACULOS-TRAMPAS-ATURDIMIENTO.md`
(sección 2.7) para entrar al
banco de niveles válidos. Se agrupan en 6 bloques. Si un test falla, se
descarta la seed y se prueba con otra (o se corrige, si es un nivel manual).

### Bloque A — Geometría y alineación (tests 1–6)

1. Todas las celdas jugables están dentro del `boardArea` del fondo.
2. Todas las celdas están alineadas a la rejilla (`originX`/`originY` +
   `cellWidth`/`cellHeight`), sin desplazamientos.
3. El tablero respeta las dimensiones base de 8×6 (las celdas jugables son un
   subconjunto válido de esa rejilla, según el arquetipo de forma).
4. Ninguna celda invade una `decorativeArea` no extendible ni la `safeArea`.
5. Se respeta el margen de seguridad (`marginPx`) en todos los bordes del
   área jugable.
6. No existen celdas jugables "huérfanas" (sin ninguna conexión ortogonal a
   otra celda jugable), salvo que estén intencionadamente detrás de una
   puerta (`D`).

### Bloque B — Entidades y colocación (tests 7–13)

7. El jugador (`P`) existe y es único.
8. El objetivo (`G`) existe y es único.
9. Ninguna entidad (enemigo, obstáculo, trampa, llave) se solapa con otra ni
   con el jugador/objetivo.
10. El número de enemigos está dentro del máximo permitido para ese nivel de
    dificultad, y nunca supera 3 en total.
11. La distancia mínima inicial entre el jugador y cada enemigo cumple el
    mínimo definido para ese nivel de dificultad.
12. El número de trampas y obstáculos está dentro del rango de la tabla de
    dificultad de ese nivel (sección 2.3).
13. Ninguna combinación de entidades bloquea el 100% de las celdas
    transitables alrededor del jugador o del objetivo (evita encierros
    absolutos no intencionados).

### Bloque C — Resolubilidad (tests 14–19)

14. Existe al menos una secuencia de movimientos que lleva del estado inicial
    al estado de victoria.
15. La solución mínima se calcula con el mismo motor de reglas que usa el
    juego real (no una reimplementación paralela).
16. La longitud de la solución mínima cae dentro del rango de movimientos
    esperado para ese nivel de dificultad.
17. Ningún enemigo, con su patrón de movimiento asignado, puede generar un
    softlock (un estado desde el que ya no es posible ganar).
18. El nivel no se resuelve en 1–2 movimientos triviales, salvo que esté
    marcado explícitamente como tutorial.
19. No existen "callejones sin salida" no intencionados que atrapen al
    jugador sin una vía de derrota o reintento clara.

### Bloque D — Anti-degenerado / calidad de diseño (tests 20–25)

> Este es el bloque que responde directamente a tu preocupación de "niveles
> fáciles de mentira".

20. Si hay al menos un enemigo, debe poder representar una amenaza real en
    algún punto del camino de solución (no está aislado del jugador por una
    región de obstáculos que lo vuelva irrelevante).
21. Los obstáculos no están todos agrupados en un único bloque compacto sin
    aportar reto real (se mide una dispersión espacial mínima).
22. La combinación de trampas + obstáculos + enemigos no supera el límite de
    "elementos activos simultáneos" definido para ese nivel (evita saturar
    el tablero, ver sección 2.4).
23. Los niveles de dificultad baja cumplen **exactamente** el rango de
    enemigos de su tier (ej. el nivel 1 nunca cuela 2 enemigos aunque el
    generador lo permitiera "por accidente").
24. El layout generado no es casi idéntico (por debajo de un umbral de
    similitud estructural) a otra pantalla ya aceptada en el banco del mismo
    nivel de dificultad — evita que 50.000 niveles se sientan repetidos.
25. El jugador no puede alcanzar el objetivo simplemente ignorando por
    completo trampas/obstáculos/enemigos colocados (si están en el tablero,
    deben formar parte real del reto en al menos una ruta razonable).

### Bloque E — Dificultad y puntuación (tests 26–28)

26. La puntuación de dificultad calculada cae dentro del rango numérico de su
    nivel (columna "Dificultad objetivo" de la tabla 2.3).
27. El nivel no resulta accidentalmente mucho más difícil de lo esperado por
    una combinación no anticipada de reglas (ej. trampa + enemigo que se
    refuerzan de forma imprevista).
28. El nivel no resulta accidentalmente más fácil de lo esperado para su
    tier (evita niveles triviales colados en dificultades altas).

### Bloque F — Integridad de datos (tests 29–30)

29. El JSON del nivel cumple el esquema (campos obligatorios, tipos
    correctos, sin referencias a celdas fuera de rango).
30. El `levelId` y la `seed` son únicos dentro de su archivo de dificultad
    (no hay duplicados en el banco).

---

## 4. Nueva entidad: Trampa (`T`)

Se añade a la tabla de entidades de `05-REGLAS-MOTOR-JUEGO.md`:

| Símbolo | Significado |
|---|---|
| `T` | Trampa — casilla que aplica un efecto negativo al jugador (ej. lo devuelve al inicio, le hace perder, o le penaliza según definas la regla exacta de tu Wappo) |

La trampa es una casilla del mapa lógico (no una entidad que se mueve, a
diferencia del enemigo). Debe pasar por las mismas reglas de colocación que
cualquier otra entidad (tests 9, 12, 13, 20–25).

> Define en `05-REGLAS-MOTOR-JUEGO.md` el efecto exacto de pisar una trampa
> (derrota inmediata, vuelta al inicio, pérdida de un intento, etc.) para que
> el solver la simule igual que el motor real.

---

## 5. Almacenamiento: un JSON por nivel de dificultad

**Recomendación: sí, un archivo JSON por nivel de dificultad — 14 archivos en
total por mundo.**

```
levels/
  espacio/
    tier_01.json   (50.000 niveles válidos de dificultad 1)
    tier_02.json
    ...
    tier_14.json
  fuego/
    tier_01.json
    ...
  castillo/
    tier_01.json
    ...
```

### Por qué así y no un único JSON gigante

- Un solo archivo con 700.000 niveles (14 tiers × 50.000) sería pesado de
  cargar entero en memoria sin necesidad: normalmente solo necesitas los
  niveles del tier que el jugador está jugando ahora mismo.
- Separar por tier permite generar/regenerar/parchear un nivel de dificultad
  concreto sin tocar los demás.
- Separar además por mundo (como ya definía `07-MUNDOS-TEMATICAS.md`) mantiene
  cada archivo en un tamaño manejable.

### Qué guardar dentro de cada archivo (versión ligera recomendada)

No hace falta guardar la matriz `grid` completa de los 50.000 niveles si la
generación es determinista por seed — basta con guardar lo necesario para
regenerar el nivel exacto más los metadatos de validación:

```json
{
  "world": "ESPACIO",
  "tier": 6,
  "levels": [
    {
      "levelId": 480321,
      "seed": 9182734,
      "archetype": "PASILLO",
      "difficultyScore": 3.4,
      "minMoves": 14,
      "enemyCount": 1,
      "trapCount": 2,
      "obstacleCount": 3
    }
  ]
}
```

- El `grid` completo, si hace falta, se regenera en el momento a partir de la
  `seed` con el mismo generador determinista (ver `03-GENERADOR-NIVELES.md`).
- Si tu generación es cara de recalcular en tiempo real y prefieres evitar
  ese coste, puedes guardar el `grid` ya calculado también — es una decisión
  de rendimiento vs. tamaño de archivo, no una regla fija. Con 50.000 niveles
  por tier, la versión ligera (solo seed + metadatos) debería pesar unos
  pocos MB por archivo; con `grid` completo incluido, más (a estimar según tu
  formato final).

---

## 6. Sistema de progreso del jugador ("reintento pegajoso")

### 6.1 Comportamiento pedido (resumen de lo que describiste)

- Si el jugador **empieza** una pantalla de un nivel de dificultad y **no la
  completa**, esa misma pantalla debe volver a salirle la próxima vez que
  juegue ese nivel de dificultad en ese mundo.
- Si la **completa**, esa pantalla concreta **no debe volver a salirle
  nunca más** en ese mundo (mientras no haya agotado las 50.000 de ese tier,
  algo estadísticamente irrelevante).

### 6.2 Cómo implementarlo sin guardar listas enormes por jugador

En vez de guardar un set con miles de IDs de niveles completados por
jugador (pesado e innecesario), se recomienda un **cursor sobre una
secuencia barajada determinista**:

```
Para cada (jugador, mundo, tier):

  seedBarajado = hash(jugadorId + mundo + tier)
  secuencia = permutación_determinista(0..49999, seedBarajado)

  estado guardado:
    cursor: int            // posición actual en la secuencia (empieza en 0)
    status: "not_started" | "in_progress"
```

### 6.3 Flujo

```
1. Jugador entra al mundo+tier
        ↓
2. levelId = tier_XX.levels[ secuencia[cursor] ]
        ↓
3. ¿status == "in_progress"?
      SÍ → servir el MISMO levelId otra vez (no se avanza el cursor)
      NO → servir ese levelId y marcar status = "in_progress"
        ↓
4. Jugador completa el nivel
        ↓
   cursor += 1
   status = "not_started"
        ↓
5. Jugador abandona sin completar
        ↓
   status permanece "in_progress"
   (la próxima vez se le repite el mismo nivel, tal como pediste)
```

### 6.4 Caso límite: el jugador agota los 50.000 niveles de un tier

Prácticamente irrealizable en la práctica, pero por completitud: si
`cursor == 50000`, se considera el tier "agotado" para ese jugador en ese
mundo. Opciones (a decidir por vosotros, no hay una única respuesta
correcta):

- Volver a barajar con una nueva seed derivada (ej. `hash(jugadorId + mundo +
  tier + "ciclo2")`) y empezar de nuevo desde cursor 0 sobre el nuevo orden.
- O simplemente marcar el mundo+tier como "100% completado" y no ofrecer más
  pantallas nuevas de ese tier (mostrando algún tipo de insignia/logro).

### 6.5 Esquema de datos de progreso (por jugador)

```json
{
  "playerId": "abc123",
  "worlds": {
    "ESPACIO": {
      "tiers": {
        "6": { "cursor": 4213, "status": "in_progress" },
        "7": { "cursor": 0, "status": "not_started" }
      }
    }
  }
}
```

Con esto, guardar el progreso de un jugador en cualquier mundo y cualquier
tier cuesta solo dos números y un string por combinación mundo+tier — nada de
listas de miles de IDs.

---

## 7. Checklist para la IA de código

Al implementar esto, la IA debe:

- [ ] Actualizar el generador para producir tableros de 8×6, no 6×6.
- [ ] Implementar la tabla de 14 niveles de dificultad de la sección 2.3 como
      configuración de datos (no hardcodeada en el código del generador).
- [ ] Implementar los 30 tests como funciones independientes y testeables,
      agrupadas en los 6 bloques de la sección 3.
- [ ] Añadir la entidad `T` (trampa) al motor de reglas y al solver.
- [ ] Generar por lotes hasta reunir 50.000 niveles válidos por tier y por
      mundo, guardando un archivo `tier_XX.json` por cada uno.
- [ ] Implementar el sistema de cursor/permutación determinista de la
      sección 6 para el progreso del jugador.
- [ ] Verificar con un test de integración que, generando cientos de miles de
      seeds, el nivel 1 nunca produce 2 enemigos, y que ningún nivel de
      ningún tier supera nunca los 3 enemigos.
