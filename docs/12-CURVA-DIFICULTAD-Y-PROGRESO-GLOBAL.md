# 🌐 Estructura Mundo→Subnivel, Curva de Dificultad Global y Progreso

> Este documento **corrige y sustituye** la idea de "un banco de niveles por
> mundo" de `07-MUNDOS-TEMATICAS.md` y ajusta el sistema de progreso de
> `11-ACTUALIZACION-NIVELES-DIFICULTAD-PROGRESO.md` (sección 6). La dificultad
> **no es por mundo**: es una escala **global** de 14 tramos que atraviesa
> todos los mundos, y cada mundo aporta una tanda de pantallas (subniveles)
> que se reparten a lo largo de esa escala.

## 0. Aclaración de la estructura (y una nota sobre tus números)

- Cada mundo tiene **15 subniveles**: 14 "normales" + 1 final tipo
  **castillo/jefe**.
- Con **8 mundos** eso da **8 × 15 = 120 pantallas totales** en una partida
  completa (de principio a fin, mundo 1 subnivel 1 → mundo 8 subnivel 15).
- En tu mensaje mencionas también "180 juegos" en algún punto — puede que te
  refirieras a más mundos (ej. 12 × 15 = 180) o fuera un cálculo de paso.
  Todo lo de este documento está escrito como **fórmula parametrizada** (con
  `W` = nº de mundos, `S` = subniveles por mundo, `T` = 14 tramos de
  dificultad), así que funciona igual con 120, 180 o el número final que
  fijéis — solo cambia el resultado de la tabla, no la lógica.

```
W = número de mundos (ej. 8)
S = subniveles por mundo, incluyendo el castillo (15)
N = W × S = pantallas totales de una partida completa
T = 14 (tramos de dificultad global, fijos)
```

## 1. El problema que describiste

Si repartes `N` pantallas entre `T=14` tramos de forma **lineal** (división
simple), sale una media de `N/T` pantallas por tramo — con `N=120` son ~8-9
pantallas seguidas con exactamente la misma dificultad, y con `N=180` unas 12.
Eso se siente plano y aburrido, sobre todo al principio, que es donde más
importa enganchar.

## 2. La solución: curva no lineal + variación fina dentro de cada tramo

Se combinan dos mecanismos, uno encima del otro:

1. **Curva de asignación de tramo** (no lineal): en vez de repartir las
   pantallas a partes iguales entre los 14 tramos, se usa una curva que avanza
   **más rápido al principio** (pocas pantallas por tramo bajo, así no te
   quedas 10-12 pantallas "aburridas" en el mismo sitio) y **más despacio al
   final** (más pantallas en los tramos altos, que es donde quieres que el
   juego se ponga "muy difícil" de verdad y tenga más contenido).
2. **Variación fina dentro del mismo tramo**: aunque 5-6 pantallas seguidas
   compartan tramo de dificultad (ej. todas tramo 6), cada una usa una
   sub-dificultad distinta dentro del rango de ese tramo, tirando de la
   `difficultyScore` que ya calcula el solver (`04-SOLVER-VALIDADOR.md`) para
   cada nivel del banco. Así, aunque el "tramo" no cambie, la pantalla 3 de
   ese tramo es perceptiblemente más exigente que la pantalla 1.

### 2.1 Fórmula de la curva (asignación de tramo)

Para la pantalla global `g` (1 = primera pantalla del juego, `N` = la última):

```
x = (g - 1) / (N - 1)              // progreso normalizado, va de 0 a 1
y = x ^ p                          // curva; p < 1 = arranque rápido, cola larga arriba
tier = 1 + floor( y * (T - 1) )    // tramo de dificultad final (1 a 14)
```

- `p` es el parámetro que controla la forma de la curva. Recomendado como
  punto de partida: **p = 0.6**.
- Cuanto más bajo sea `p` (ej. 0.45), más rápido subes de tramo al principio
  y más pantallas se concentran en los tramos altos al final (más "grind" en
  la parte difícil). Cuanto más se acerque `p` a 1, más se parece a un
  reparto lineal (menos recomendado, es justo el problema que describiste).
- Ajusta `p` jugando y viendo cómo se siente — no hay un valor matemáticamente
  "correcto", es una decisión de diseño.

### 2.2 Ejemplo real con W=8, S=15 (N=120), T=14, p=0.6

Así quedan repartidas las primeras pantallas (nº de pantallas seguidas en
cada tramo, calculado con la fórmula de arriba):

| Tramo | Pantallas seguidas en ese tramo |
|---|---|
| 1 | 2 |
| 2 | 4 |
| 3 | 5 |
| 4 | 6 |
| 5 | 8 |
| 6 | 8 |
| ... | ... (sube progresivamente) |
| 11 | 14 |
| 12 | 14 |
| 13 | 14 |
| 14 | 1 (la pantalla 120, el final absoluto del juego) |

Compara con el reparto lineal (p=1): ahí el tramo 1 dura **10 pantallas
seguidas** y el tramo 2 otras 9 — justo el problema de "las primeras 12 o 24
partidas iguales" que querías evitar. Con p=0.6 solo hay 2 pantallas en el
tramo 1 antes de subir, y el "grueso" de contenido repetido se concentra al
final, en los tramos difíciles, que es donde quieres que el juego tenga
más chicha.

> Nota técnica: esta tabla se genera una vez (es pura matemática sobre `W`,
> `S`, `T` y `p`), no depende de seeds ni de aleatoriedad — se puede calcular
> en el momento o precalcular una tabla de 120/180 entradas `pantalla → tramo`
> y guardarla como configuración fija del juego.

### 2.3 Variación fina dentro de un mismo tramo (bandas de dificultad)

Cuando varias pantallas seguidas caen en el mismo tramo (ej. las 8 pantallas
del tramo 6), se reparten en **bandas** dentro del rango de dificultad de ese
tramo (ver la tabla de rangos de `11-ACTUALIZACION-NIVELES-DIFICULTAD-PROGRESO.md`,
sección 2.3):

```
Dentro del tramo, con k pantallas asignadas a él:
  pantalla local 1 de k  → banda baja  del rango de dificultad de ese tramo
  pantalla local k de k  → banda alta  del rango de dificultad de ese tramo
  (las intermedias se interpolan linealmente entre ambas)
```

Por ejemplo, si el tramo 6 tiene rango de dificultad 3.0–4.0 (según la tabla
de `11-...md`) y le tocan 8 pantallas seguidas, la banda objetivo de cada una
sería aproximadamente: 3.0, 3.14, 3.28, 3.43, 3.57, 3.71, 3.86, 4.0.

Para elegir qué nivel concreto del banco de 50.000 de ese tramo mostrar en
cada pantalla:

1. Se filtra el banco del tramo a los niveles cuya `difficultyScore` esté
   cerca de la banda objetivo de esa pantalla (ej. ± 0.1).
2. Sobre ese sub-conjunto filtrado, se aplica el mismo mecanismo de
   "reintento pegajoso" (cursor + permutación determinista por jugador) que
   ya definía `11-ACTUALIZACION-NIVELES-DIFICULTAD-PROGRESO.md`, sección 6 —
   no cambia nada de esa lógica, solo se aplica sobre el sub-conjunto en vez
   de sobre el banco entero del tramo.

Esto te da lo mejor de ambos mundos: variedad de contenido (banco de 50.000
por tramo) **y** una sensación de progresión continua incluso dentro del
mismo tramo de dificultad global.

### 2.4 El castillo (subnivel 15) como "pico" de cada mundo

Para que el castillo de cada mundo se sienta como un evento especial y no
simplemente "la siguiente pantalla del mismo tramo":

- El castillo de un mundo siempre toma la **banda más alta** del tramo que le
  corresponda por la fórmula (nunca la banda baja), aunque el resto de
  pantallas de ese tramo usen bandas intermedias.
- Opcionalmente, se le puede permitir usar el **límite superior de
  enemigos/trampas/obstáculos del siguiente tramo** (sin cambiar de tramo
  oficialmente, solo tomando prestado el extremo alto de esos rangos) para
  darle un empujón de dificultad perceptible sin descuadrar la curva general.
- El castillo del **último mundo** (pantalla `N`, tramo 14) es, por
  construcción de la fórmula, siempre el tramo más difícil del juego — el
  final real.

## 3. Progreso del jugador — qué debe guardar la base de datos

Confirmando lo que pediste explícitamente: **sí, hace falta guardar tanto la
posición dentro del mundo actual como el total de pantallas superadas en
toda la partida.** Son dos contadores distintos con propósitos distintos:

| Campo | Para qué sirve |
|---|---|
| `currentWorld` | En qué mundo está ahora mismo (1 a `W`) |
| `currentSubLevel` | En qué subnivel de ese mundo está (1 a `S`, siendo `S` el castillo) |
| `totalStagesCompleted` | **Contador global**: cuántas pantallas ha superado en total en toda la partida/carrera, independientemente del mundo. Es el que necesitas para saber, en cualquier momento, "cuánto ha avanzado este jugador en general" — por ejemplo para estadísticas, comparativas entre jugadores, logros, etc. |

El **tramo de dificultad** (`tier`) de la pantalla actual **no se guarda**:
se calcula siempre a partir de `currentWorld` + `currentSubLevel` con la
fórmula de la sección 2.1 (o directamente desde `totalStagesCompleted` si
`totalStagesCompleted + 1` coincide con la pantalla global actual, que
debería ser siempre el caso salvo que permitas rejugar mundos ya superados).

### 3.1 Esquema de progreso actualizado

```json
{
  "playerId": "abc123",
  "currentWorld": 3,
  "currentSubLevel": 7,
  "totalStagesCompleted": 37,
  "tierProgress": {
    "ESPACIO": {
      "6": { "cursor": 4213, "status": "in_progress" }
    },
    "FUEGO": {
      "3": { "cursor": 12, "status": "not_started" }
    }
  }
}
```

- `tierProgress` es exactamente el mecanismo de `11-...md` sección 6
  (cursor + estado por mundo+tramo), sin cambios — solo que ahora convive con
  los dos contadores nuevos (`currentWorld`/`currentSubLevel` y
  `totalStagesCompleted`) que dan la posición macro del jugador en la
  partida completa.
- `totalStagesCompleted` se incrementa en +1 cada vez que se completa
  **cualquier** pantalla, de cualquier mundo. Es un contador simple,
  monótono, y no se resetea al cambiar de mundo.
- Si en el futuro permitís "rejugar" mundos ya completados (ej. modo libre),
  ese contador seguiría sumando cada superación adicional — decide vosotros
  si eso es lo que queréis o si preferís un segundo contador separado tipo
  `totalStagesCompletedFirstPlaythrough` para no mezclar ambas cosas.

## 4. Checklist para la IA de código (añadido al de `11-...md`)

- [ ] Implementar la función `tier = f(world, subLevel)` (o `f(globalStage)`)
      según la fórmula de la sección 2.1, parametrizada por `W`, `S`, `T`, `p`.
- [ ] Precalcular y loguear la tabla completa `pantalla → tramo` al arrancar
      el proyecto, para poder revisarla y ajustar `p` antes de generar los
      700.000 niveles definitivos.
- [ ] Implementar el filtrado por banda de dificultad dentro de un tramo
      (sección 2.3) antes de aplicar el cursor/permutación de `11-...md`.
- [ ] Marcar el subnivel 15 (castillo) de cada mundo para que siempre tome la
      banda alta del tramo correspondiente (sección 2.4).
- [ ] Añadir `currentWorld`, `currentSubLevel` y `totalStagesCompleted` al
      esquema de progreso del jugador, incrementando este último en cada
      pantalla superada de cualquier mundo.
- [ ] Escribir un test que, con los `W`/`S`/`T`/`p` reales del proyecto,
      confirme que ningún tramo de dificultad se repite más de X pantallas
      seguidas al principio del juego (define tú el umbral "aceptable", ej.
      no más de 4-5 pantallas seguidas en el mismo tramo dentro de las
      primeras 2 mundos).
