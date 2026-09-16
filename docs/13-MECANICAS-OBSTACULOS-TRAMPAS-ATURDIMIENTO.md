# 🧱⚡ Mecánicas: Obstáculos de 1 Casilla y Aturdimiento por Trampa

> Este documento **amplía y precisa** `05-REGLAS-MOTOR-JUEGO.md` (motor de
> reglas), `03-GENERADOR-NIVELES.md` (generador) y
> `11-ACTUALIZACION-NIVELES-DIFICULTAD-PROGRESO.md` (los 30 tests). Recoge dos
> variantes propias de vuestro Wappo respecto al original, que hay que tener
> en cuenta tanto al generar niveles como al validarlos.

> Nota: esto es la versión 1 de estas mecánicas. Es probable que más adelante
> se añadan variantes nuevas (otros tipos de trampa, obstáculos destructibles,
> etc.) — cuando llegue ese momento, este documento se ampliará igual que se
> ha hecho con el resto. De momento, se implementa tal cual está aquí.

## 0. Resumen de las dos variantes

| Mecánica | Wappo original | Vuestra variante |
|---|---|---|
| Obstáculo (`X`) | No ocupa una casilla completa (es más un elemento parcial/decorativo dentro de la celda) | **Ocupa la casilla completa**: bloquea el movimiento exactamente igual que una pared (`#`) |
| Trampa (`T`) | (no aplica, es mecánica propia vuestra) | Al pisarla, la entidad (jugador o enemigo) queda **3 turnos sin poder moverse** |
| Colisión durante aturdimiento | — | Si un enemigo alcanza al jugador mientras este está aturdido en una trampa, **el jugador pierde igual** (el aturdimiento no protege) |

---

## 1. Obstáculos (`X`) — ocupan 1 casilla completa

### 1.1 Regla

A diferencia del Wappo clásico, en vuestra variante un obstáculo **bloquea el
100% de la casilla** donde está. A efectos de movimiento y de pathfinding es
funcionalmente idéntico a una pared (`#`):

```
IsValidMove(pos, direction):
    destino = pos + direction
    si destino es pared (#)      → inválido
    si destino es obstáculo (X)  → inválido   ← igual que una pared
    si destino fuera del tablero → inválido
    en otro caso                 → válido
```

### 1.2 Por qué sigue siendo una entidad distinta de la pared (`#`) y no lo mismo

Aunque bloquean igual, se mantienen como símbolos distintos porque:

- **Visualmente** son sprites distintos (el Asset Resolver, `02-MOTOR-GRAFICO.md`,
  necesita saber cuál pintar).
- **Para el generador y las estadísticas de dificultad**, se cuentan por
  separado: el nº de obstáculos es uno de los parámetros de la tabla de
  progresión de dificultad (`11-...md`, sección 2.3), mientras que las
  paredes del contorno del tablero no cuentan como "elemento de dificultad".
- **Pueden tener reglas futuras distintas** (ver nota de extensibilidad al
  final): si en el futuro añadís obstáculos destructibles, empujables, etc.,
  necesitáis que sigan siendo una entidad propia en el mapa lógico.

### 1.3 Impacto en el generador (`03-GENERADOR-NIVELES.md`)

- Al colocar obstáculos, el generador debe tratarlos como **celdas no
  transitables** desde el primer momento del pre-filtro de conectividad (el
  chequeo rápido y barato antes de pasar al solver completo), exactamente
  igual que las paredes del contorno.
- Esto significa que el "presupuesto" de celdas jugables disponibles se
  reduce por cada obstáculo colocado — hay que tenerlo en cuenta para no
  generar tableros demasiado pequeños en dificultades altas donde también hay
  muchos obstáculos (riesgo de que no quede espacio transitable suficiente).

### 1.4 Impacto en los 30 tests (`11-...md`, sección 3)

No hace falta añadir un test nuevo específico para esto — se aclara cómo se
interpretan los ya existentes:

- **Test 1 y 6** (Bloque A, geometría/conectividad): al comprobar que no hay
  celdas jugables "huérfanas", los obstáculos cuentan como no transitables,
  igual que las paredes.
- **Test 9** (Bloque B, solapamiento): un obstáculo no puede compartir celda
  con ninguna otra entidad, exactamente igual que ya se exigía.
- **Test 14–19** (Bloque C, resolubilidad): el solver, al reutilizar
  literalmente las mismas funciones del motor de reglas (`IsValidMove`),
  automáticamente trata los obstáculos como bloqueo total sin necesidad de
  lógica adicional en el solver.

---

## 2. Trampas (`T`) — aturdimiento de 3 turnos

### 2.1 Regla exacta

Cuando una entidad (jugador o un enemigo) entra en una casilla de trampa:

- Esa entidad queda **aturdida durante 3 turnos**: no puede moverse aunque
  reciba input (jugador) o le toque mover (enemigo).
- El aturdimiento es **individual por entidad**, no global. Si hay dos
  enemigos en el tablero y solo uno de ellos pisa la trampa, únicamente ese
  enemigo se queda sin moverse; el otro sigue actuando con normalidad en sus
  turnos.
- La misma regla aplica al jugador: si el jugador pisa una trampa, el
  jugador pierde el control de movimiento durante 3 turnos (los enemigos
  siguen moviéndose con normalidad mientras tanto).

### 2.2 Estado necesario en el motor (`05-REGLAS-MOTOR-JUEGO.md`)

Se añade un contador de aturdimiento a **cada entidad que se mueve** (jugador
y cada enemigo por separado):

```
Entity.stunTurnsRemaining: int   // 0 = no aturdido; 3 = recién aturdido
```

### 2.3 Bucle de turno actualizado

Se amplía el bucle de turno definido en `05-REGLAS-MOTOR-JUEGO.md` (sección 3):

```
1. Input del jugador → Player.Move(direction)
2. Si Player.stunTurnsRemaining > 0:
       ignorar el movimiento solicitado (el jugador no se mueve este turno)
       Player.stunTurnsRemaining -= 1
   Si no:
       aplicar IsValidMove / mover al jugador
       si la celda destino es una trampa (T) → Player.stunTurnsRemaining = 3
3. Comprobar recogida de objetos (llaves, power-ups) en la nueva celda
4. Para cada enemigo E:
       Si E.stunTurnsRemaining > 0:
           E no se mueve este turno
           E.stunTurnsRemaining -= 1
       Si no:
           aplicar Enemy.Move() según su patrón
           si la celda destino es una trampa (T) → E.stunTurnsRemaining = 3
5. Comprobar colisión jugador-enemigo (en cualquier orden, esté o no
   aturdida cualquiera de las dos entidades) → IsLevelFailed()
6. Comprobar IsLevelSolved()
7. Si ni victoria ni derrota → volver a 1
```

### 2.4 Colisión durante aturdimiento — el jugador pierde igual

Este es el punto que remarcaste explícitamente: **el aturdimiento no protege
de nada.** Si un enemigo se mueve hacia la casilla donde está el jugador
mientras el jugador está aturdido (2 turnos sin moverse), la colisión se
comprueba exactamente igual que en cualquier otro turno (paso 5 del bucle de
arriba) y el jugador pierde. No hace falta ninguna regla especial adicional
para esto — es una consecuencia directa de que la comprobación de colisión
del paso 5 no depende de si alguna de las dos entidades está aturdida o no.

De hecho, quedarse aturdido junto a un enemigo cercano es precisamente lo que
hace que las trampas sean peligrosas de verdad para el jugador, y no solo un
estorbo cosmético.

### 2.5 ¿La trampa se "gasta" al usarse o es reutilizable?

No lo especificaste, así que se deja como **reutilizable por defecto** (la
casilla de trampa sigue activa después de aturdir a una entidad, y puede
volver a aturdir a la misma u otra entidad si vuelve a pisarla más adelante
en la partida). Si preferís que sea de un solo uso (se "gasta" y luego pasa a
ser suelo normal), es un cambio pequeño y aislado en `IsValidMove`/`Enemy.Move`
— avísame y lo documentamos como variante alternativa.

### 2.6 Impacto en el solver (`04-SOLVER-VALIDADOR.md`)

Esto es importante para quien implemente el solver: **el estado que explora
la búsqueda (BFS/A\*) ahora incluye el contador de aturdimiento de cada
entidad**, no solo su posición. Dos estados con el jugador y los enemigos en
las mismas casillas pero con contadores de aturdimiento distintos son
**estados diferentes** para el solver (uno permite moverse, el otro no).

```
Estado del solver (ampliado):
  posición del jugador
  stunTurnsRemaining del jugador
  posición de cada enemigo
  stunTurnsRemaining de cada enemigo
  llaves recogidas / puertas abiertas (si aplica)
```

Esto **aumenta el tamaño del espacio de búsqueda** (cada entidad aturdible
multiplica los estados posibles por 4: aturdido-3, aturdido-2, aturdido-1,
no-aturdido).
Con un máximo de 3 enemigos + el jugador, es perfectamente manejable para
BFS, pero conviene tenerlo en cuenta en el límite de profundidad/tiempo del
solver (`04-SOLVER-VALIDADOR.md`, sección 2) para que no se dispare el coste
de validar los 700.000 niveles del banco.

### 2.7 Tests adicionales (extienden los 30 de `11-...md`)

Se añaden dos tests más al Bloque C (resolubilidad) — pasan a ser **32 tests
en total**, no 30:

**31.** El solver simula el aturdimiento exactamente igual que el motor real
(contador de 3 turnos, independiente por entidad) — no hay una versión
simplificada del aturdimiento solo para validar más rápido; sería una
divergencia entre "lo que se valida" y "lo que se juega", el mismo riesgo que
ya se advertía en `05-REGLAS-MOTOR-JUEGO.md`.

**32.** Ningún nivel se acepta si la única forma de perder es un aturdimiento
"inevitable" que garantice la derrota sin que el jugador haya podido evitarlo
razonablemente (ej. una trampa colocada justo en el único camino posible,
inmediatamente antes de la única celda por la que puede pasar un enemigo en
persecución). El solver debe encontrar **al menos una solución que evite ese
softlock/derrota forzada**, no basta con que el nivel sea "técnicamente"
resoluble ignorando que la ruta obligatoria pase por una trampa peligrosa sin
alternativa.

> Actualiza el recuento en `11-ACTUALIZACION-NIVELES-DIFICULTAD-PROGRESO.md`:
> donde dice "30 tests obligatorios", pasa a decir "32 tests obligatorios",
> añadiendo estos dos al Bloque C.

---

## 3. Checklist para la IA de código

- [ ] Actualizar `IsValidMove` para que trate `X` (obstáculo) como bloqueo
      total, igual que `#` (pared).
- [ ] Añadir `stunTurnsRemaining` como estado de cada entidad móvil (jugador
      y cada enemigo), inicializado a 0.
- [ ] Actualizar el bucle de turno del motor real según la sección 2.3.
- [ ] Confirmar que la comprobación de colisión jugador-enemigo (paso 5 del
      bucle) no depende del estado de aturdimiento de ninguna de las dos
      entidades — debe dispararse igual estén o no aturdidas.
- [ ] Ampliar el estado que explora el solver para incluir
      `stunTurnsRemaining` de cada entidad (sección 2.6), reutilizando
      literalmente las mismas funciones del motor real.
- [ ] Añadir los tests 31 y 32 (sección 2.7) al conjunto de tests del
      proyecto, y actualizar cualquier referencia a "30 tests" a "32 tests".
- [ ] Revisar el pre-filtro de conectividad del generador para que los
      obstáculos (`X`) cuenten como celdas no transitables desde el primer
      momento (sección 1.3).
- [ ] Escribir un test unitario específico: dos enemigos, uno pisa una
      trampa y el otro no → solo el primero deja de moverse 2 turnos; el
      segundo se mueve con normalidad.
- [ ] Escribir un test unitario específico: jugador aturdido en una trampa,
      un enemigo se mueve a su casilla → se dispara derrota (`IsLevelFailed`).
