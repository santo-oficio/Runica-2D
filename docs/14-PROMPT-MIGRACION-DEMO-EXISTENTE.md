# 🔧 Prompt de Migración — Actualizar demo existente a la especificación nueva

```
Tenéis ya una demo funcionando en este repositorio: movimiento básico sobre
un tablero de 6x6, con obstáculo, enemigo y trampa ya implementados de forma
sencilla. NO vais a reescribir el proyecto desde cero — vais a AUDITAR el
código actual y MIGRARLO para que cumpla la especificación de diseño
completa, que está en la carpeta docs/ (archivos 00 a 13).

IMPORTANTE SOBRE EL ORDEN DE LECTURA:
Los documentos 01 a 09 son la arquitectura base del proyecto. Los documentos
10, 11, 12 y 13 son ACTUALIZACIONES posteriores que corrigen y amplían partes
concretas de esa base. Donde haya conflicto entre un número bajo y uno alto,
manda el número alto. Lee TODOS los documentos, en este orden, antes de tocar
código:

  00-INDICE.md
  01-ARQUITECTURA-GENERAL.md
  02-MOTOR-GRAFICO.md
  10-ANALIZADOR-IA-FONDOS.md
  03-GENERADOR-NIVELES.md
  04-SOLVER-VALIDADOR.md
  05-REGLAS-MOTOR-JUEGO.md
  06-ESQUEMAS-JSON.md
  07-MUNDOS-TEMATICAS.md
  08-AUDIO-NOTAS.md
  09-SUPER-PROMPT-IMPLEMENTACION.md
  11-ACTUALIZACION-NIVELES-DIFICULTAD-PROGRESO.md
  12-CURVA-DIFICULTAD-Y-PROGRESO-GLOBAL.md
  13-MECANICAS-OBSTACULOS-TRAMPAS-ATURDIMIENTO.md

PASO 1 — AUDITORÍA (no toques código todavía)
Recorre el código actual de la demo y escribe un informe (en un archivo
MIGRACION-AUDITORIA.md en la raíz del repo) que compare, punto por punto,
el estado actual contra la especificación de los documentos. Como mínimo,
responde a esto:

- ¿El tablero está hardcodeado a 6x6 en algún sitio? ¿Dónde exactamente?
- ¿Cómo está implementado el obstáculo ahora mismo? ¿Bloquea el 100% de la
  casilla como pared, o es un elemento parcial/decorativo? (según
  13-MECANICAS-OBSTACULOS-TRAMPAS-ATURDIMIENTO.md, sección 1, debe bloquear
  el 100%, igual que una pared)
- ¿Cómo está implementada la trampa ahora mismo? ¿Existe ya algún concepto de
  "aturdimiento" o el enemigo/jugador simplemente no interactúa con ella?
- ¿Existe ya un motor de reglas separado del renderizado (Player.Move,
  IsValidMove, Enemy.Move, IsLevelSolved, IsLevelFailed) o todo está mezclado
  en el mismo sitio?
- ¿Existe algún generador procedural o los niveles de la demo están hechos a
  mano?
- ¿Existe algún solver/validador o todavía no se ha implementado nada de eso?

No sigas al paso 2 hasta haber terminado este informe.

PASO 2 — PLAN DE MIGRACIÓN
A partir del informe del paso 1, escribe un plan de migración por fases
(añádelo al mismo MIGRACION-AUDITORIA.md o en un archivo aparte
MIGRACION-PLAN.md). El plan debe cubrir, como mínimo, estos cambios
obligatorios respecto a la demo actual:

1. Tablero de 6x6 → 8x6 (columnas x filas). Localiza y corrige cualquier
   valor hardcodeado a 6x6.
2. Obstáculo (`X`): debe bloquear el 100% de la casilla igual que una pared,
   en `IsValidMove` y en cualquier lógica de pathfinding/conectividad que ya
   exista. Ver 13-MECANICAS-OBSTACULOS-TRAMPAS-ATURDIMIENTO.md, sección 1.
3. Trampa (`T`): implementar el aturdimiento de 3 turnos tal como se describe
   en 13-MECANICAS-OBSTACULOS-TRAMPAS-ATURDIMIENTO.md, sección 2 — estado
   `stunTurnsRemaining` por entidad (jugador y cada enemigo por separado),
   bucle de turno actualizado, y confirmar que la colisión jugador-enemigo
   se sigue comprobando igual esté alguien aturdido o no.
4. Si el motor de reglas y el renderizado están mezclados: sepáralos. El
   motor de reglas debe poder ejecutarse en modo headless (sin gráficos),
   porque el solver lo va a reutilizar literalmente (no una copia aparte).
   Ver 05-REGLAS-MOTOR-JUEGO.md.
5. Si no existe generador procedural: constrúyelo desde cero siguiendo
   03-GENERADOR-NIVELES.md + las correcciones de 11 (tablero 8x6, tabla de
   14 niveles de dificultad de la sección 2.3) y 12 (curva de dificultad
   global, no por mundo).
6. Si no existe solver/validador: constrúyelo desde cero siguiendo
   04-SOLVER-VALIDADOR.md + los 32 tests totales (30 de 11-...md sección 3,
   más los tests 31 y 32 de 13-...md sección 2.7).
7. Estructura de progreso del jugador: implementar el esquema de
   12-CURVA-DIFICULTAD-Y-PROGRESO-GLOBAL.md, sección 3 (currentWorld,
   currentSubLevel, totalStagesCompleted, tierProgress con cursor por
   mundo+tramo).

Para cada punto del plan, indica: qué archivos hay que tocar, si se puede
hacer sin romper la demo actual, y en qué orden conviene hacerlo (algunos
cambios son prerrequisito de otros — por ejemplo, separar motor de reglas
del renderizado debería ir antes de construir el solver, porque el solver
depende de poder llamar al motor en modo headless).

PASO 3 — EJECUCIÓN EN BUCLE (mismas reglas que el resto del proyecto)
Ejecuta el plan fase por fase. Después de cada fase:

- Corre todos los tests existentes (no solo los nuevos).
- Si algo falla, corrígelo antes de avanzar.
- Escribe un resumen breve de qué se migró y el resultado de los tests.
- No avances a la siguiente fase con tests en rojo.

Al terminar, la demo debe seguir siendo jugable (movimiento, obstáculo,
enemigo, trampa) pero ahora sobre un tablero 8x6, con el obstáculo bloqueando
completamente su casilla, y la trampa aplicando el aturdimiento de 3 turnos
de forma individual por entidad, exactamente como se describe en
13-MECANICAS-OBSTACULOS-TRAMPAS-ATURDIMIENTO.md.

No me digas que la migración está terminada hasta que:
[ ] El tablero de la demo es 8x6, no 6x6
[ ] El obstáculo bloquea el 100% de su casilla (confirmado con un test)
[ ] La trampa aturde 3 turnos, de forma individual por entidad (confirmado
    con un test: dos enemigos, solo uno pisa la trampa, solo ese se congela)
[ ] Un enemigo que alcanza al jugador aturdido dispara derrota igualmente
    (confirmado con un test)
[ ] El motor de reglas puede ejecutarse headless, sin renderizado
[ ] Todos los tests existentes de la demo (los que ya hubiera antes de
    empezar) siguen pasando

Empieza ahora por el PASO 1.
```
