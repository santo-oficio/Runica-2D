# 🎮 Reglas del Wappo — Referencia Original y Adaptación a Runika 2D

Este documento define **a fuego** las reglas del juego. Runika 2D hereda las reglas
del Wappo original (Siemens M50, 2003) y las adapta a su temática de 8 mundos.

> **Principio rector**: lo que se valida (solver) es lo que se juega (motor).
> Nunca dos implementaciones de las mismas reglas.

---

## 1. Objetivo del juego

El jugador (Wappo/avatar) debe llegar a la **salida** (escalera en el perímetro
del tablero) sin ser atrapado por los enemigos. Es un puzle por turnos: no hay
tiempo real ni reflejos — solo lógica y planificación.

---

## 2. Tablero

- Tablero fijo: **6 columnas × 5 filas** (30 casillas).
- No se generan tableros al azar — el tamaño es siempre el mismo.
- La **salida** está en una casilla del perímetro.

---

## 3. Movimiento del jugador (Wappo)

- El jugador se mueve **1 casilla por turno**.
- Solo movimiento **ortogonal** (arriba, abajo, izquierda, derecha).
  **Prohibido moverse en diagonal.**
- Si el jugador intenta moverse a una casilla no transitable (pared, obstáculo,
  fuera del tablero), **el movimiento se cancela** — el jugador se queda donde
  está. **NO cuenta como movimiento**: el turno no avanza, los enemigos no se
  mueven, y el contador de movimientos no incrementa. Se produce un **efecto
  rebote** visual y suena el **sonido de choque común**
  (`assets/sounds/comun/choque.wav`).
- El jugador **no tiene ataques**. No puede golpear, empujar ni destruir nada.
  Su única herramienta es la lógica.

---

## 4. Movimiento de los enemigos (YumChak)

Esta es la regla más importante y la que define el puzle:

- **El enemigo se mueve 2 casillas por turno** (el jugador solo 1).
  Esto significa que tras cada movimiento del jugador, el enemigo hace **2
  pasos** hacia él.
- **Persecución por camino más corto**: el enemigo siempre va directamente hacia
  el jugador por la ruta más corta.
- **Preferencia horizontal**: el enemigo **siempre intenta moverse primero en
  horizontal** (eje X). Si no puede avanzar en horizontal, entonces se mueve en
  vertical (eje Y).
- El enemigo **no puede cruzar barras/obstáculos** — estos le bloquean igual que
  al jugador.
- Si el enemigo **cae en un pozo de arena/trampa**, pierde **3 turnos** (se queda
  quieto 3 turnos). El jugador puede explotar esto para escapar.
- Si el enemigo alcanza la casilla del jugador → **game over** (el jugador es
  capturado).

### Orden de un turno completo

```
1. El jugador se mueve 1 casilla (o intenta y rebota)
2. ¿Jugador en salida? → VICTORIA
3. El enemigo hace su 1er paso hacia el jugador
4. ¿Enemigo en casilla del jugador? → DERROTA
5. El enemigo hace su 2º paso hacia el jugador
6. ¿Enemigo en casilla del jugador? → DERROTA
7. ¿Jugador en salida? → VICTORIA (por si el jugador se movió a salida)
8. Si no victoria ni derrota → siguiente turno
```

---

## 5. Elementos del tablero

### 5.1 Barras / Obstáculos (`X`)

- Bloquean tanto al jugador como al enemigo.
- El jugador **no puede entrar** en una casilla con obstáculo → rebote + sonido
  de choque.
- El enemigo **no puede cruzar** obstáculos — debe bordearlos.
- Estrategia: poner obstáculos entre el jugador y el enemigo para ralentizar la
  persecución.

### 5.2 Pozos de arena / Trampas (`T`)

- **El jugador puede entrar** en una trampa (no le bloquea el paso).
- Al caer en la trampa: efecto visual (remolino) + sonido de trampa
  (`assets/sounds/comun/trampa.wav`).
- **Quien pisa la trampa queda inmovilizado 3 turnos** — tanto el jugador como
  el enemigo. El aturdimiento es **individual por entidad**: si hay dos
  enemigos y solo uno pisa la trampa, solo ese se congela; el otro sigue
  moviéndose con normalidad.
- El jugador aturdido **no puede moverse** durante 3 turnos, pero los enemigos
  sí siguen moviéndose — y si un enemigo alcanza al jugador aturdido, el
  jugador pierde igual (el aturdimiento no protege de la captura).
- Esto es la mecánica clave del puzle: atraer al enemigo hacia trampas para
  ganar ventaja, pero con el riesgo de que el jugador también quede expuesto
  si pisa una.
- En la temática de Runika 2D, las trampas son específicas por mundo (ej. remolino
  de agua en AGUA).

### 5.3 Salida / Meta (`G`)

- Casilla objetivo en el perímetro del tablero.
- El jugador gana al llegar a la salida.
- Si el jugador llega a la salida en su movimiento, gana **inmediatamente**
  (antes de que se mueva el enemigo).

### 5.4 Puertas y llaves (`D`, `K`) — extensión opcional

- Algunos niveles pueden tener puertas que requieren llaves.
- El jugador recoge la llave al pasar por su casilla.
- Al tener una llave y estar adyacente a una puerta, esta se abre
  automáticamente (consume la llave).
- No es una mecánica del Wappo original — es una extensión de Runika 2D.

---

## 6. Condiciones de victoria y derrota

### Victoria
- El jugador alcanza la casilla de salida (`G`).
- La victoria se comprueba **inmediatamente después del movimiento del jugador**,
  antes de que se mueva el enemigo.

### Derrota
- Un enemigo alcanza la casilla del jugador (tras cualquiera de sus 2 pasos).
- No hay límite de turnos — el jugador puede intentarlo las veces que quiera.

---

## 7. Diferencias con el motor actual (`engine/rules.ts`)

El motor actual del proyecto tiene diferencias con el Wappo original que deben
corregirse:

| Aspecto | Motor actual | Wappo original | Acción |
|---|---|---|---|
| Pasos del enemigo | 1 paso/turno | **2 pasos/turno** | Cambiar |
| Preferencia del enemigo | Eje con mayor distancia | **Horizontal primero** | Cambiar |
| Trampas/pozos | No implementado | Enemigo pierde 3 turnos | Implementar |
| Salida en perímetro | `G` en cualquier sitio | Perímetro del tablero | Restringir |
| Rebote visual/sonido | No en motor | Efecto + sonido | Ya en demo |

### Prioridad de implementación
1. **Enemigo 2 pasos/turno** — cambiar `playTurn` para que el enemigo se mueva 2 veces.
2. **Preferencia horizontal** — cambiar `moveChase` para priorizar eje X.
3. **Trampas** — añadir tipo `T` al grid, efecto de 3 turnos en enemigo.
4. **Salida en perímetro** — validar al generar niveles.

---

## 8. Adaptación a mundos de Runika 2D

Cada mundo (ESPACIO, AGUA, TIERRA, FUEGO, HIELO, VIENTO, INFRAMUNDO,
MAZMORRA) puede tener:

- **Enemigos visuales distintos** (`assets/enemys/<MUNDO>/`).
- **Obstáculos visuales distintos** (`assets/obstaculos/<MUNDO>/`).
- **Trampas visuales distintas** (`assets/trampas/<MUNDO>/`).
- **Sonido de paso distinto** (`assets/sounds/<MUNDO>/paso.mp3`).
- **Mecánicas especiales** opcionales (ej. lava en FUEGO, hielo resbaladizo en
  HIELO) — siempre como extensión de las reglas base, nunca rompiéndolas.

Las **reglas del juego son las mismas** en todos los mundos. Solo cambia la
estética y, opcionalmente, mecánicas adicionales.

---

## 9. Sonidos

| Evento | Archivo | Carpeta |
|---|---|---|
| Paso del jugador | `paso.mp3` | `assets/sounds/<MUNDO>/` |
| Choque (no puede pasar) | `choque.wav` | `assets/sounds/comun/` |
| Trampa (cae en trampa) | `trampa.wav` | `assets/sounds/comun/` |

- El sonido de paso es **por mundo** (ej. burbuja en AGUA, crujido en HIELO).
- El sonido de choque y trampa son **comunes** a todos los mundos.
- El sonido de paso se **reinicia** en cada movimiento (interrumpe y vuelve a
  empezar).
