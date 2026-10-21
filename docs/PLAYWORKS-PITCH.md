# Runika 2D — Dossier para Play.Works

Documento de presentación para proponer **Runika 2D** al catálogo de
Play.Works (Connected TV). Contacto de ellos: `contact@play.works`
(asunto sugerido: *Game submission — Runika 2D, turn-based puzzle for CTV*).

---

## 1. Ficha rápida

| Campo | Valor |
|---|---|
| **Título** | RUNIKA 2D — *Aventura Infinita* |
| **Género** | Puzle por turnos en rejilla (determinista) |
| **Sesión típica** | niveles cortos de 1–3 min, progresión persistente |
| **Controles** | Flechas + Enter/Escape — **compatible nativamente con mando de TV** |
| **Idiomas** | **10 completos**: español, inglés, francés, alemán, italiano, japonés, chino, ruso, turco y polaco — todo el texto visible es i18n |
| **Puzles** | **~259.000 pantallas únicas** repartidas en 15 niveles de dificultad (de 258 en el tier inicial a ~25.000 por tier alto) — **cada partida juega tableros distintos** |
| **Motor** | HTML5 + TypeScript puro (sin dependencias de motor) |
| **Plataformas ya empaquetadas** | **Samsung Tizen `.wgt` autónomo** · Android `.apk` (Cordova) · Windows (instalador NSIS/Electron) |
| **Salida de vídeo** | 16:9 nativo, arte 8K/4K escalado, `object-fit` con letterbox cinematográfico |
| **Persistencia** | savegame local (progreso, oro, tienda) — sin cuenta ni red |
| **Público** | familiar / todos los públicos (sin sangre, sin texto hostil) |
| **Estado** | contenido completo: 8 mundos × 12 niveles + bonus, tienda y jefes |

## 2. Por qué encaja en CTV

- **Turno a turno, cero reflejos**: el jugador piensa y pulsa una dirección;
  los enemigos actúan después. El ritmo es ideal para mando a distancia —
  nada de doble stick ni precisión de puntero.
- **Input mínimo**: flechas, Enter, Escape y pulsación larga. Es exactamente
  el modelo de los 400+ juegos del catálogo Play.Works.
- **Determinista y rejugable**: cada pantalla tiene un par de movimientos
  óptimo visible; el oro que gana el jugador depende de acercarse al óptimo.
  Rejugar para mejorar la puntuación es el motor de retención.
- **Cada partida es distinta**: los tableros se extraen de bancos de
  **~259.000 pantallas únicas** en 15 niveles de dificultad (hasta ~25.000
  por tier). Dos partidas nuevas no repiten el mismo recorrido — rejugar o
  empezar de cero siempre ofrece puzles que el jugador no ha visto.
- **Multiidioma de serie**: los 10 idiomas (ES, EN, FR, DE, IT, JA, ZH,
  RU, TR, PL) están traducidos al 100% — menús, HUD, tutoriales, tienda,
  créditos — con cambio en caliente desde ajustes. Un JSON = un idioma
  nuevo, ideal para catálogos internacionales.
- **Progresión clara en TV**: mapamundi → mundo → 12 islas → tienda/bonus
  cada 3 niveles → jefe de mundo → siguiente mundo. Sesión media natural
  de 20+ min, alineada con la métrica que Play.Works publicita.
- **Ya corre en TV de verdad**: el `.wgt` Tizen es autónomo (APIs
  simuladas en cliente, guardado en localStorage, mapeo de mando
  Back→Escape). No necesita backend.

## 3. Contenido del juego

- **8 mundos temáticos** (Espacio, Agua, Tierra, Fuego, Hielo, Viento,
  Inframundo, Mazmorra) con arte propio 16:9.
- **~259.000 puzles únicos** en 15 niveles de dificultad creciente: cada
  nivel sortea su tablero del banco correspondiente, así que **ninguna
  partida repite la ruta de otra** — contenido para cientos de horas.
- **96 niveles** + fases bonus (recoger botín en nube, ítems
  positivos/negativos) + tiendas con mejoras (Midas, vidas).
- **Jefes** en el nivel 12 de cada mundo con sprite propio y recompensa ×2;
  cinemática final y créditos.
- **Economía de oro** sensible a la dificultad y a la eficiencia del jugador
  (mínimo garantizado por victoria).
- **Economía de desbloqueos animada**: la siguiente isla se revela con
  animación ~3 s + audio; el mundo conquistado drena a B/N en el mapa.
- **Música generada por mundo** + SFX; sonido y música desactivables en
  ajustes.

## 4. Tecnología

- HTML5 + TypeScript estricto, ESM, cero dependencias de engine.
- Pipeline de builds ya existente: `npm run wgt` (Tizen), `npm run apk`
  (Cordova Android), `npm run dist` (NSIS Windows).
- 344 tests Vitest sobre la lógica (solver determinista, progresión).
- Todas las coordenadas calibradas son data-driven (JSON por mundo) —
  reencuadrar para otros ratios/resoluciones no requiere tocar código.
- i18n por `/api/i18n` con fallback español; **10 locales ya traducidos**
  (es/en/fr/de/it/ja/zh/ru/tr/pl), añadir un idioma = 1 JSON.

## 5. Material para adjuntar al correo

- [ ] **Vídeo** 60–90 s del flujo: menú → mapamundi → nivel → bonus → boss.
      **Grabación manual** (OBS o similar sobre la ventana del juego —
      `npm run app` o Chrome a pantalla completa). Alternativa sin intervención:
      `npm run record:demo` genera `recordings/runika-demo-<ts>.mp4`
      (autopiloto `?auto=1`, 1920×1080, **sin audio** — superponer una
      pista de `assets/music/`).
- [x] **Screenshots 16:9** ya generados en `docs/pitch-screens/`:
      `menu`, `seleccion`, `mapamundi`, `submundo-inframundo`, `nivel`
      (tablero con avatar/enemigo/portal) y `bonus` (nube + botín).
      Regenerables con `.tmp_chk/cdp-pitch-screens.mjs` (servidor temporal
      con save sembrado — no toca la partida real).
- [ ] **`.wgt` de demostración** o acceso al APK (`npm run wgt` /
      `npm run apk`).
- [x] **Keyart provisional** en `docs/pitch-screens/`: `icon-512.png`
      (calavera) y `cover-1920x1080.png` (calavera sobre tablero
      difuminado).
- [ ] Este documento traducido (el bloque de abajo va en inglés).

## 6. Pitch en inglés (listo para el correo a contact@play.works)

> **Subject: Game submission — Runika 2D (turn-based puzzle, CTV-ready)**
>
> Hi Play.Works team,
>
> I'd like to submit **Runika 2D — Infinite Adventure**, a turn-based
> deterministic puzzle game built for the living room from day one.
>
> - **Remote-first gameplay**: pure arrow-key + OK/Back input, zero
>   twitch mechanics. Each move advances the whole board — perfect for
>   TV remotes and relaxed couch sessions.
> - **Content-complete**: 8 themed worlds × 12 islands, shop and bonus
>   stages every 3 levels, a boss at each world's end, final cinematic.
> - **Every playthrough is different**: boards are drawn from banks of
>   **~259,000 unique puzzles across 15 difficulty tiers** (up to ~25,000
>   per tier) — no two runs share the same route, and replaying never
>   repeats a board the player has already solved.
> - **Fully localized in 10 languages**: English, Spanish, French,
>   German, Italian, Japanese, Chinese, Russian, Turkish and Polish —
>   every user-facing string is translated, switchable in settings.
> - **Already packaged for TV**: an autonomous Samsung Tizen `.wgt`
>   (client-side API shim, localStorage saves, remote Back key mapped),
>   plus Android `.apk` and Windows builds from the same HTML5 codebase.
> - **Retention loop**: every board shows its optimal move count; gold
>   rewards scale with difficulty and how close the player gets to the
>   optimal path — replay value built in.
> - **Fully offline**: no accounts, no network required, persistent
>   local save.
>
> Tech: plain HTML5/TypeScript, no engine dependency, deterministic
> solver with a 344-test suite. Happy to adapt to your SDK/framework
> and provide builds in whatever shape your pipeline prefers.
>
> Attachments: 90-second gameplay video, screenshots, Tizen wgt demo.
>
> Looking forward to hearing from you.
> — Javier Q. (creator, Runika 2D)

## 7. Huecos que probablemente pidan

- **SDK propietario**: su catálogo integra juegos en su framework; la app
  ya corre como web autónoma, así que la adaptación consiste en empaquetar
  `webdist/` y mapear su remote/input SDK a los keydown actuales.
- **PEGI/ESRB**: pendiente — contenido apto para todos los públicos
  (violencia de caricatura mínima en combates por turnos).
- **Analítica/anuncios**: hoy no hay ninguna; si piden AVOD o tracking,
  el shim de `api-shim.js` es el punto natural donde enchufarlo.
