# Runika 2D — Wappo Infinito

Juego de puzle determinista inspirado en Wappo. TypeScript puro + Vitest, Node ≥ 20, ESM.

## Comandos

```bash
npm run typecheck   # tsc --noEmit (strict + noUncheckedIndexedAccess)
npm test            # vitest (300 tests, 13 archivos)
npx tsx demo-server.ts  # demo visual + demo jugable en http://localhost:3000
```

## Demo jugable (`demo-play.html`)

`http://localhost:3000/demo-play.html` — demo jugable que elige una pantalla
**al azar** del tier 1 (endpoint `/api/demo-screen?tier=1`) en cada recarga y un
mundo al azar. **No guarda nada en la bbdd** (solo lectura).

Controles: `Flechas/WASD` mover · `R` otra pantalla · `Espacio` cambiar mundo ·
`Enter` cambiar avatar.

## Detección de tableros

```bash
# Detectar tablero de un mundo (escribe board-detection.json)
.sam-venv\Scripts\python.exe background/sam-detect.py assets/backgrounds/<MUNDO>/bg_01.png <MUNDO> assets/backgrounds/<MUNDO>/board-detection.json

# Informe de casillas (solo lectura)
npx tsx tools/detect-cells.ts [MUNDO]
```

- Modelo: `models/mobile_sam.pt` (MobileSAM TinyViT, ~40MB).
- Entorno Python: `.sam-venv` (torch 2.1.2+cu121, opencv 4.8, numpy 1.26).
- Tablero fijo: **8 columnas × 6 filas** (48 casillas). No se generan tableros nuevos al azar.
- La calibración es **manual por mundo** (no se usa SAM automático de forma fiable):
  abrir `demo.html`, arrastrar el ratón sobre el tablero y pulsar `G`.

## Calibración manual (`demo.html`)

`npx tsx demo-server.ts` → http://localhost:3000. Cada mundo guarda **dos áreas**
normalizadas en su `board-detection.json`:

- `boardArea` — tablero para **losas/obstáculos/trampas**.
- `avatarArea` — tablero para **avatar/enemigos/meta** (puede diferir del anterior).

Controles en `demo.html`:

| Tecla | Acción |
|---|---|
| **Arrastrar ratón** | Definir el tablero del modo activo (esquina sup-izq → inf-der) |
| **Flechas** | Mover todo el conjunto (Shift = paso fino) |
| **+ / −** | Agrandar / reducir el conjunto |
| **G** | Guardar el área del modo activo, solo ese mundo |
| **A** | Alternar modo AVATAR (guarda `avatarArea`) / LOSAS (guarda `boardArea`) |
| **Espacio** | Cambiar de mundo |
| **L** | Mostrar/ocultar rejilla |

Las coordenadas se guardan normalizadas respecto a la **imagen visible** (se
descuenta el letterbox de `object-fit: contain`).

## Mundos

ESPACIO, AGUA, TIERRA, FUEGO, HIELO, VIENTO, INFRAMUNDO, MAZMORRA.

Fondos en `assets/backgrounds/<MUNDO>/bg_01.png` (los antiguos están en
`bg_01_old.png`). Todos están a **7680×4320 (8K)**. Nota: MAZMORRA,
ESPACIO y HIELO fueron reescalados desde resoluciones menores (1672×941 o
1024×576), así que su calidad real es inferior a la de los 8K nativos.

## Arquitectura

- `engine/` — motor de reglas determinista (playTurn, isLevelSolved, etc.).
- `generator/` — generación procedural de niveles por seed (14 tiers de dificultad).
- `solver/` — validador (32 tests) + BFS solver que reutiliza el motor.
- `worlds/` — WorldConfigs, banco de niveles, renderizado ASCII.
- `background/` — detección de tableros con SAM (Python).
- `layout/` — cálculo de rejilla y screen layout.
- `schemas/` — tipos y validadores JSON.
- `assets/backgrounds/` — imágenes de fondo + `board-detection.json`.

## Reglas clave

- **Reglas del Wappo original**: ver `docs/11-REGLAS-WAPPO-ORIGINAL.md` (reglas a fuego).
- El solver reutiliza LITERALMENTE el motor de reglas (no hay lógica duplicada).
- Añadir un mundo = solo datos (WorldConfig + BackgroundTemplates).
- Las imágenes de fondo no se recortan ni modifican.
- ESM imports usan `.js` en TypeScript source.
- **Colisión con obstáculos**: el avatar no puede entrar en una casilla ocupada por un obstáculo. Al intentar moverse hacia un obstáculo, el avatar rebota visualmente (efecto rebote) y suena el sonido de choque común (`assets/sounds/comun/choque.wav`). El movimiento se cancela — el avatar se queda en su casilla actual.
- **Movimiento ortogonal**: el avatar solo se mueve en 4 direcciones (arriba, abajo, izquierda, derecha). Está prohibido moverse en diagonal.
- **Choque en bordes**: al intentar salir del tablero, el avatar rebota y suena el sonido de choque común, igual que con los obstáculos.
- **A fuego — sin solapamiento**: al comenzar un nivel, ninguna casilla puede tener más de un item (jugador, enemigo, obstáculo, trampa, llave o meta, cada uno en su celda).
- **A fuego — sin dificultad absurda**: un nivel fácil no es un nivel vacío. La dificultad baja se consigue con menos elementos y patrones simples, nunca con elementos irrelevantes o desconectados del reto.
- **Trampa (`T`)**: aturde 3 turnos a quien la pisa (jugador o enemigo), de forma individual por entidad.
- **Máximo 3 enemigos** en cualquier pantalla.
- **A fuego — los enemigos SIEMPRE se mueven**: no existen enemigos estáticos ni
  "de vigilancia" que se queden quietos. Todo enemigo persigue al jugador
  (`CHASE` / `PERSECUCION_SIMPLE`), 2 pasos por turno, horizontal primero. Un
  enemigo solo deja de moverse temporalmente si queda aturdido por una trampa
  (3 turnos). El patrón `VIGILANCIA`/`VIGILANCIA_ZONA` está prohibido.
- **A fuego — obstáculos visuales por mundo**: en `assets/obstaculos/<MUNDO>/` hay imágenes de obstáculos propias de cada mundo. Al colocar obstáculos en una pantalla:
  - Las **posiciones** vienen determinadas por el nivel generado (el motor/solver decide dónde van); nunca se inventan posiciones.
  - La **imagen** de cada obstáculo se elige al azar de entre las disponibles del mundo actual.
  - Si solo hay una imagen, se usa esa.
  - Si hay varias y hay que poner varios obstáculos, se intenta **no repetir** imagen mientras sea posible (sin reemplazo). Si hacen falta más obstáculos que imágenes disponibles, se repite lo necesario.
  - **No es obligatorio mostrar todas** las imágenes del mundo en cada pantalla; basta con las que el nivel genere.
  - Si un mundo no tiene carpeta de obstáculos, se usa una imagen de marcador (placeholder) y se documenta el faltante.
  - Mapeo de carpetas especiales: `VIENTO` → `assets/obstaculos/AIRE/`.
- **Curva de dificultad**: 8 mundos × 15 subniveles = 120 juegos, repartidos en 14 tiers con curva no lineal (p=0.6). Ver `docs/15-TABLA-CURVA-DIFICULTAD-120-JUEGOS.md`.
- **A fuego — sin textos hardcodeados**: ningún texto visible al usuario puede estar
  escrito directamente en el código (HTML, TS, etc.). Todo texto debe venir de
  archivos de idioma en `i18n/` (`es.json`, `en.json`, `fr.json`, `de.json`,
  `it.json`). El sistema de i18n carga el archivo del idioma activo y expone
  una función `t("clave")` para resolver las traducciones. Si falta una clave en
  un idioma, se usa el español como fallback. Idiomas soportados: español (`es`),
  inglés (`en`), francés (`fr`), alemán (`de`), italiano (`it`).
- **A fuego — prohibido literales en HTML/UI**: ningún texto visible en
  pantallas HTML (menu, juego, instrucciones, creditos, etc.) puede estar
  escrito directamente en el HTML o JS. Todo texto debe obtenerse en tiempo de
  ejecucion desde los archivos de idioma (`i18n/<lang>.json`) mediante la
  funcion `t("clave")`. Los unicos literales permitidos son claves de i18n
  (ej: `data-i18n="menu.newGame"` o `t("menu.newGame")`), nunca el texto final
  en ningun idioma. Idiomas soportados: espanol (`es`), ingles (`en`), frances
  (`fr`), italiano (`it`), aleman (`de`).
- **A fuego — fuente del juego**: la fuente tipografica para TODO el texto del
  juego (menus, botones, instrucciones, creditos, HUD, etc.) es
  **MedievalSharp** (Google Fonts). No se usa Cinzel ni ninguna otra fuente para
  texto visible. La fuente se carga desde Google Fonts con
  `family=MedievalSharp&display=swap`.
- **A fuego — texto sobre pergamino**: cuando el fondo sea un pergamino claro
  (ej: pantalla de instrucciones, opciones), el texto debe ser oscuro
  (`#3a2810` / `#4a3018` / `#5a3a18`) para que se lea sobre el fondo claro.
  Nunca usar texto claro sobre pergamino claro.
- **A fuego — cache de assets antes de lanzar la app**: las imagenes (fondos 8K,
  obstaculos, avatares, enemigos, trampas, salida, mapamundi, menus) y los
  sonidos (movimiento, seleccion, choque, trampa, victoria, derrota, pergamino)
  son archivos pesados. Antes de mostrar la aplicacion al usuario, TODO debe
  estar precargado en cache (memoria del navegador / Cache API / Service Worker)
  para que la experiencia sea fluida, sin tirones ni tiempos de carga en medio
  del juego. El proceso de carga debe:
  1. Mostrar una pantalla de carga (loading) al iniciar.
  2. Precargar todas las imagenes y sonidos necesarios.
  3. Solo mostrar el menu / juego cuando todo este en cache.
  4. Usar Service Worker + Cache API para persistencia entre sesiones.
  5. En ejecucion, servir todo desde cache, nunca desde red en caliente.
- **A fuego — transiciones entre pantallas**: todos los cambios de pantalla
  (menu → instrucciones, menu → juego, juego → victoria/derrota, etc.) deben
  tener una transicion fluida, nunca un corte seco. Las transiciones deben:
  1. Fundido (fade out / fade in) o deslizamiento suave entre pantallas.
  2. Duracion entre 300-600ms, suficientemente rapido para no aburrir.
  3. Sonido de transicion si aplica.
  4. La pantalla anterior se desvanece mientras la nueva aparece.
  5. Usar CSS transitions/animations o un overlay de fundido negro/pergamino.
  6. Nunca mostrar un parpadeo en blanco ni carga brusca de contenido.
- **A fuego — movimiento lineal por submundos**: el avatar se mueve por los 12
  niveles de cada submundo de forma **lineal y secuencial** (1→2→3→...→12).
  Desde el nivel N solo se puede ir al N+1 o al N-1, nunca a otro nivel no
  adyacente. Aunque el movimiento es lineal, se usan las **4 direcciones**
  (arriba, abajo, izquierda, derecha) segun la disposicion fisica de las
  casillas en la rejilla en serpiente 4×3:
  ```
   8  9 10 11
   7  6  5  4
   0  1  2  3
  ```
  La direccion para avanzar de N a N+1 depende de la posicion relativa en la
  rejilla (ej: 3→4 es arriba, 4→5 es izquierda, 7→8 es arriba). La direccion
  para retroceder de N a N-1 es la **inversa de la direccion de llegada**
  (ej: 5→4 es derecha, 4→3 es abajo, 8→7 es abajo). Cualquier direccion que no
  corresponda al avance o retroceso produce rebote. El avatar siempre empieza
  en el nivel 1 al entrar a un submundo (salvo que haya progreso guardado).
