# 📚 Índice — Documentación del proyecto Wappo Infinito

Este conjunto de documentos define la arquitectura completa de un juego de puzzles
tipo **Wappo** con **niveles infinitos generados proceduralmente**, manteniendo la
estética retro/pixel-art de tus fondos artísticos, adaptados a pantalla panorámica
(ideal para TV).

## Cómo usar estos documentos

1. Léelos en orden la primera vez (del 01 al 08) para entender la arquitectura completa.
2. El documento **09-SUPER-PROMPT-IMPLEMENTACION.md** es el que le vas a dar a una IA
   de código (Claude Code, Cursor, Windsurf, etc.) para que empiece a construir el
   proyecto real, iterando en bucle hasta que todo pase los tests.
3. Cada documento es independiente y puede evolucionar por separado (por ejemplo,
   puedes cambiar las reglas del solver sin tocar el motor gráfico).

## Lista de documentos

| Archivo | Contenido |
|---|---|
| `01-ARQUITECTURA-GENERAL.md` | Visión global del sistema, diagrama de módulos y flujo de datos |
| `02-MOTOR-GRAFICO.md` | Cómo se generan/adaptan fondos, casillas, sprites y auto-tiling |
| `10-ANALIZADOR-IA-FONDOS.md` | Cómo una IA de visión analiza tus fondos ya creados y propone la plantilla automáticamente |
| `03-GENERADOR-NIVELES.md` | Generación procedural de niveles, arquetipos, seeds, infinitud |
| `04-SOLVER-VALIDADOR.md` | Validación matemática y de dificultad antes de aceptar un nivel |
| `05-REGLAS-MOTOR-JUEGO.md` | Reglas de juego tipo Wappo: movimiento, enemigos, condiciones de victoria |
| `06-ESQUEMAS-JSON.md` | Formatos de datos (JSON) para tableros, niveles, mundos y plantillas |
| `07-MUNDOS-TEMATICAS.md` | Cómo organizar mundos (Espacio, Fuego, Agua...) y sus assets |
| `08-AUDIO-NOTAS.md` | Notas rápidas para cuando abordéis sonido y música (pendiente) |
| `09-SUPER-PROMPT-IMPLEMENTACION.md` | Prompt maestro de "loop engineering" para construir todo esto con una IA de código |
| `11-ACTUALIZACION-NIVELES-DIFICULTAD-PROGRESO.md` | ⚠️ Actualización que manda sobre 03/04/06: tablero 8×6, 14 niveles de dificultad, 30 tests, 50.000 niveles por tier, y el sistema de progreso "pegajoso" del jugador |
| `12-CURVA-DIFICULTAD-Y-PROGRESO-GLOBAL.md` | ⚠️ Corrige cómo se reparten los 14 tramos de dificultad entre mundos y subniveles (curva no lineal, no por mundo), y añade el contador global de progreso del jugador |
| `13-MECANICAS-OBSTACULOS-TRAMPAS-ATURDIMIENTO.md` | ⚠️ Precisa dos mecánicas propias de vuestro Wappo: los obstáculos ocupan 1 casilla completa, y las trampas aturden 2 turnos (individual por entidad) — amplía los tests a 32 |
| `14-PROMPT-MIGRACION-DEMO-EXISTENTE.md` | 🔧 El prompt a usar en Windsurf cuando ya hay una demo empezada (no un proyecto nuevo): audita el código actual y lo migra a la especificación 00–13 |
| `15-TABLA-CURVA-DIFICULTAD-120-JUEGOS.md` | 📈 Tabla generada `juego → tier → banda de dificultad` para los 120 juegos (8 mundos × 15 subniveles), con curva no lineal p=0.6 y las reglas "a fuego" |
| `16-DISENADOR-NIVELES-TIERS.md` | 🎯 Definición de los 14 tiers de dificultad, reglas del generador (pruning, validación funcional) y formato del banco de pantallas |

> Nota de orden de lectura: `10-ANALIZADOR-IA-FONDOS.md` amplía el punto 1 de
> `02-MOTOR-GRAFICO.md`, así que léelos juntos. `11-ACTUALIZACION-NIVELES-DIFICULTAD-PROGRESO.md`
> actualiza y manda por encima de partes de `03`, `04`, `05` y `06` (tablero
> 8×6, 14 niveles de dificultad, 30 tests, 50.000 niveles por tier, y el
> sistema de progreso "pegajoso" del jugador) — léelo justo después de esos
> cuatro documentos. `12-CURVA-DIFICULTAD-Y-PROGRESO-GLOBAL.md` va justo
> después de `11`: corrige que la dificultad no se reparte "por mundo" sino
> como una escala global de 14 tramos que atraviesa todos los mundos.

## Principio rector del proyecto

> La IA/el generador **proponen**. El motor de reglas y el solver **deciden**.
> Ningún nivel llega al jugador sin haber pasado, de forma automática y matemática,
> todos los tests de geometría, alineación y resolubilidad.

Esto es la base de todo: separar **apariencia** (arte, fondos, estética retro) de
**lógica** (mapa lógico, reglas, validación), para poder generar contenido infinito
sin perder ni la coherencia visual ni la jugabilidad garantizada.
