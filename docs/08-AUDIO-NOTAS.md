# 🔊 Audio y Música (pendiente — notas rápidas)

Este apartado se dejó explícitamente para más adelante. Aquí van solo unas
notas mínimas para que, cuando lo abordéis, encaje con la arquitectura ya
definida sin tener que rediseñar nada.

## Dónde encajará en la arquitectura

- El audio se puede asociar al **mundo** (mismo lugar que `tileAssets` en el
  `WorldConfig`, ver `06-ESQUEMAS-JSON.md`): música ambiente por mundo, set de
  efectos de sonido propio (movimiento, recogida de llave, victoria, derrota,
  enemigo cercano...).
- Los eventos de sonido se disparan desde el **motor de reglas**
  (`05-REGLAS-MOTOR-JUEGO.md`), enganchados a las mismas funciones ya definidas:
  `Player.Move()`, `IsLevelSolved()`, `IsLevelFailed()`, colisión con enemigo,
  recogida de objeto, etc. Así no hace falta tocar el generador ni el solver.
- Como el solver ejecuta el juego "headless" (sin gráficos) para validar
  niveles, hay que asegurarse de que los eventos de sonido **no se disparen**
  durante esa simulación (o que el sistema de audio se pueda desactivar/mockear
  fácilmente en modo validación).

## Ideas a decidir más adelante (sin urgencia)

- Música ambiente por mundo (loop) + variación sutil en niveles "jefe".
- Set mínimo de SFX: paso, choque contra pared, recoger llave, abrir puerta,
  enemigo cercano (aviso), victoria, derrota.
- Si se usa el mismo motor para todos los mundos, plantear un `AudioConfig`
  por mundo análogo al `tileAssets`, para mantener la misma filosofía de
  "cambiar contenido, no lógica".

No hace falta más detalle ahora — este documento es solo un recordatorio de
dónde enganchar el audio cuando llegue el momento, para no romper la separación
de responsabilidades ya definida en el resto de documentos.
