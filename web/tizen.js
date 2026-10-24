/**
 * tizen.js — puente nativo: TV Samsung (Tizen) y Android (Cordova/WebView).
 *
 * Tizen:
 *  - Registra las teclas del mando (si no, Back sale de la app).
 *  - Back (10009) → Escape: las páginas ya lo tratan como "volver".
 *  - En el menú, Back sale de la app; en otras páginas, si nada navegó
 *    tras Escape, vuelve al menú.
 *
 * Android (Cordova):
 *  - Evento 'backbutton' → Escape (misma lógica que arriba).
 *  - Gestos táctiles: swipe = flechas, pulsación larga = Escape. El tap
 *    actúa sobre el control tocado mediante los eventos pointer/click
 *    reales del navegador (nada de Enter sintético: duplicaba acciones y
 *    activaba el elemento enfocado equivocado al fallar el puntero).
 *    Una página puede definir window.touchTapMove(x, y) → true para
 *    interpretar ella misma los taps sobre su tablero/mapa.
 *  - Sin teclado del sistema: la máquina de escribir de la pantalla de
 *    selección ya es táctil; el <input> oculto solo se crea en Tizen.
 *
 * Solo actúa con window.tizen o window.cordova presentes.
 */
(function () {
  "use strict";

  var IS_TIZEN = typeof window.tizen !== "undefined";
  var IS_ANDROID = typeof window.cordova !== "undefined" ||
    /Android/i.test(navigator.userAgent || "");
  if (!IS_TIZEN && !IS_ANDROID) return;

  // Televisor (overscan: la tele recorta los bordes de la imagen): Tizen
  // siempre es TV; en Android lo delatan los modelos AFT* (Fire TV) y las
  // UAs de Android TV. Móviles y tablets NO llevan escala (pantalla completa,
  // táctil intacto — escalar rompería además sus coordenadas de toque).
  var IS_TV = IS_TIZEN || /AFT|Android ?TV|BRAVIA|SmartTV|CrKey/i.test(navigator.userAgent || "");
  // Factor de escala del body en TV (~3% de margen por lado). Las páginas
  // lo compensan con AssetsCache.layoutRect: getBoundingClientRect devuelve
  // coords visuales pero style.left/top se escribe en coords de layout.
  var TV_SCALE = 0.94;
  window.RUNIKA_UI_SCALE = IS_TV ? TV_SCALE : 1;

  var NAV_TIMEOUT = 1400; // > duración de AssetsCache.transitionTo (450 ms)

  function sendKey(key, keyCode) {
    try {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: key, keyCode: keyCode, bubbles: true }));
    } catch (err) {}
  }

  function sendEscape() {
    sendKey("Escape", 27);
    // Fallback: si la página no navegó sola, ir al menú
    var href = location.href;
    setTimeout(function () {
      if (location.href === href) location.href = "menu.html";
    }, NAV_TIMEOUT);
  }

  function exitApp() {
    if (IS_TIZEN) {
      try { window.tizen.application.getCurrentApplication().exit(); return; } catch (e) {}
    }
    if (navigator.app && navigator.app.exitApp) { navigator.app.exitApp(); return; }
    window.close();
  }
  // Expuesto para que las páginas (menú → Salir) cierren la app nativa
  // directamente, sin pasar por exit.html ni texto de "cerrar la ventana".
  window.runikaExit = exitApp;

  // ── GPU débil (móvil/TV): quitar el blur(45px) del fillbg. Repintar un
  // bitmap enorme difuminado en cada frame/keypress es el lag típico; en
  // nativo el relleno de letterbox va solo oscurecido.
  try {
    var lite = document.createElement("style");
    lite.textContent =
      "#fillbg{filter:brightness(.4) saturate(1.15)!important;transform:scale(1.02)!important}" +
      // Móvil/TV panorámico (19-21:9): la imagen de fondo cubre todo el
      // viewport con cover centrado — una sola imagen, sin bandas ni
      // fillbg "repetido". Las zonas calibradas viven en el interior
      // (y .10-.90) y siguen visibles. Las funciones *Rect de cada página
      // son fit-aware (leen objectFit/object-position).
      ".runika-native #fillbg{display:none!important}" +
      // fill (no cover): la imagen entera cubre el viewport sin recortar
      // arriba/abajo ni repetir — una sola imagen panorámica. El estirado
      // horizontal (~9% en 19.5:9) es imperceptible. Las funciones *Rect
      // de cada página leen objectFit y usan el rect del elemento.
      ".runika-native #bg,.runika-native #image,.runika-native #board-bg,.runika-native .bgimg{" +
      "object-fit:fill!important}" +
      // Selección de menú ligera: el active lleva 5 text-shadow (hasta
      // 60px blur) + 4 box-shadow — a 4K cada tecla repintaba una zona
      // enorme y el highlight llegaba tarde ("a saltos"). Un solo glow
      // corto; el rombo dorado SVG ya marca la opción.
      ".runika-native .btn,.runika-native .btn-text{transition:none!important}" +
      ".runika-native .btn.active,.runika-native .btn:hover{box-shadow:none!important}" +
      ".runika-native .btn.active .btn-text,.runika-native .btn:hover .btn-text{" +
      "text-shadow:1px 1px 2px rgba(0,0,0,.9),0 0 12px rgba(255,220,120,.95)!important}" +
      // El aura del avatar (#avatar::before) anima box-shadow+border-radius
      // en bucle INFINITO en mapamundi y submundo: rasteriza cada frame para
      // siempre (~80fps medidos en reposo en Fire TV) — la causa del lag
      // continuo. En nativo queda estatica; sigue siendo una aura dorada.
      ".runika-native #avatar::before{animation:none!important}" +
      // El letrero de la tienda "invita" oscilando en bucle infinito: ~60fps
      // de repaint perpetuo en el WebView de la TV. Estatico en nativo.
      ".runika-native .shop-ladder-path.inviting .sign-anim{animation:none!important}" +
      // Tablero (medido en Fire TV con SurfaceFlinger): cada sprite en capa
      // propia con drop-shadow obliga a la GPU a re-desenfocarlo en CADA
      // frame — ~8% de frames perdidos en reposo y ~16% al mover. Sin esos
      // filtros: 0%. El halo de la meta pasa a un degradado de fondo (se
      // rasteriza una vez; el pulso escala la capa sin recalcular nada).
      ".runika-native .entity:not(.defeated):not(.stunned),.runika-native #selector:not(.hero) #avatar," +
      ".runika-native .flycoin{filter:none!important}" +
      ".runika-native .entity.stunned:not(.defeated){filter:brightness(.55) saturate(.4)!important}" +
      ".runika-native .entity.goal:not(.defeated){background:radial-gradient(circle,rgba(255,255,0,.42) 0%,rgba(255,240,0,.18) 45%,rgba(255,240,0,0) 70%)}" +
      // Fondo del tablero en capa propia: si no, cada cambio del HUD o de
      // las pistas re-rasterizaba la capa raiz con el fondo 1920x1080
      // (tareas de raster de ~100ms → tirones de 150-180ms al mover).
      ".runika-native #image{will-change:transform}" +
      // Cuenta atras del tablero: digito de ~260px con 4 sombras (una de
      // 60px de blur) — cada numero nuevo costaba 100-150ms de raster.
      ".runika-native #countdown{text-shadow:3px 3px 0 #4a2c00,0 0 14px rgba(255,170,0,.85)!important}" +
      // Bonus: misma causa — drop-shadow en cada objeto que cae, en la
      // cesta y en la nube (con su hijo flotando en bucle = re-filtrado por
      // frame). Medido: ~8.5% de frames perdidos (~30% al final de la
      // ronda, con mas objetos) → 0% sin ellos. El brillo al atrapar se
      // conserva (dura 0.3s).
      ".runika-native #cloud,.runika-native #cloud~#avatar,.runika-native .fall-item:not(.caught){" +
      "filter:none!important;transition:none!important}" +
      // Final del juego: 130 estrellas parpadeando a la vez = 130 capas
      // animadas → ~16% de frames perdidos en la escena final. En nativo
      // brillan estáticas con opacidad variada y solo 1 de cada 8 parpadea
      // (medido: 0% de frames perdidos, mismo efecto visual).
      ".runika-native .star{animation:none!important;opacity:.35}" +
      ".runika-native .star:nth-child(3n){opacity:.6}" +
      ".runika-native .star:nth-child(7n){opacity:.85}" +
      ".runika-native .star:nth-child(8n){animation:twinkle 2.6s ease-in-out infinite!important}" +
      ".runika-native .star:nth-child(16n){animation-duration:3.7s!important}" +
      // Margen seguro de TV (overscan: la tele recorta ~3% del marco):
      // el body se encoge al 94% dejando un marco uniforme. OJO: NO usar en
      // táctil (rompe clientX/Y). Todas las páginas leen rects con
      // AssetsCache.layoutRect, que des-escala a coords de layout — por eso
      // esta vez botones y arte quedan alineados (el intento anterior leía
      // getBoundingClientRect ya escalado y todo quedaba ~3% desplazado).
      ".runika-tv body{transform:scale(" + TV_SCALE + ")!important;transform-origin:center center!important}" +
      ".runika-native #version-tag{right:48px!important;bottom:28px!important}" +
      // Capas que viajan por transform: promoción a capa de compositor para
      // que WAAPI/transform no rasterice el sprite en el main thread.
      ".runika-native #avatar,.runika-native .shop-ladder-path," +
      ".runika-native .entity,.runika-native #selector," +
      ".runika-native .fall-item{will-change:transform}";
    document.head.appendChild(lite);
    document.documentElement.classList.add("runika-native");
    if (IS_TV) document.documentElement.classList.add("runika-tv");
  } catch (e) {}

  function onBack() {
    var page = location.pathname.split("/").pop() || "menu.html";
    if (page === "menu.html" || page === "index.html" || page === "") { exitApp(); return; }
    sendEscape();
  }

  // ── Tizen: mando ─────────────────────────────────────────────────────────
  if (IS_TIZEN) {
    try {
      ["0","1","2","3","4","5","6","7","8","9","Back","Exit","Info",
        "MediaPlay","MediaPause","MediaPlayPause","MediaStop",
        "MediaRewind","MediaFastForward",
        "ColorF0Red","ColorF1Green","ColorF2Yellow","ColorF3Blue",
        "ChannelUp","ChannelDown"].forEach(function (k) {
          try { window.tizen.tvinputdevice.registerKey(k); } catch (e) {}
        });
    } catch (e) {}
    window.addEventListener("keydown", function (e) {
      if (e.keyCode === 10009) { e.preventDefault(); onBack(); }
    }, true);
  }

  // ── Filtro de keydown duplicados (TV) ────────────────────────────────────
  // La cadena mando→CEC/IR→WebView a veces entrega el MISMO keydown dos
  // veces a unos ms de distancia: una sola pulsación movía dos opciones o
  // un Enter descartaba la pantalla de carga y activaba el botón marcado.
  // Regla: si llega un keydown de una tecla que ya está "abajo" (sin keyup
  // intermedio, sin e.repeat) a <60 ms del anterior, es un duplicado físico
  // imposible — una pulsación real siempre suelta la tecla primero.
  var _keyDown = {}, _keyAt = {};
  document.addEventListener("keydown", function (e) {
    var k = e.key || e.keyCode, now = performance.now();
    if (!e.repeat && _keyDown[k] && now - (_keyAt[k] || 0) < 60) {
      e.preventDefault(); e.stopImmediatePropagation(); return;
    }
    _keyDown[k] = true; _keyAt[k] = now;
  }, true);
  document.addEventListener("keyup", function (e) { _keyDown[e.key || e.keyCode] = false; }, true);
  window.addEventListener("blur", function () { _keyDown = {}; }, true);

  // ── Android: botón atrás + gestos táctiles ───────────────────────────────
  if (IS_ANDROID) {
    document.addEventListener("deviceready", function () {
      document.addEventListener("backbutton", onBack, false);
    });

    // Pantalla de juego fija: sin scroll/zoom ni gestos del navegador que
    // cancelen el touchend, sin resaltado de tap ni menú de selección de
    // texto en la pulsación larga.
    var touchCss = document.createElement("style");
    touchCss.textContent =
      "*{-webkit-tap-highlight-color:transparent;touch-action:none;" +
      "user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}";
    (document.head || document.documentElement).appendChild(touchCss);

    // ¿El punto tocado es un control interactivo? Los controles del juego
    // llevan cursor:pointer (hotspots, polígonos de botones, slots…) o son
    // formas SVG/elementos de formulario.
    function isInteractive(el) {
      for (; el && el !== document.documentElement; el = el.parentElement) {
        var tag = el.tagName || "";
        if (/^(BUTTON|A|INPUT|TEXTAREA|SELECT|polygon|circle|rect|path)$/i.test(tag)) return true;
        try { if (getComputedStyle(el).cursor === "pointer") return true; } catch (err) {}
      }
      return false;
    }

    // Gestos: swipe → flecha, pulsación larga → Escape (salvo que empiece
    // sobre un control), tap → el control bajo el dedo o, si la página lo
    // define, window.touchTapMove(x, y).
    // Si la página declara window.touchNative=true, gestiona ella el tacto
    // con eventos pointer reales (p.ej. bonus.html: arrastre del avatar) —
    // el puente no interpone swipes ni pulsaciones largas.
    var t0 = 0, x0 = 0, y0 = 0, longTimer = null, startEl = null;
    var SWIPE = 48, TAP_MS = 300, LONG_MS = 700;
    window.addEventListener("touchstart", function (e) {
      if (window.touchNative === true) return;
      var t = e.touches[0];
      t0 = Date.now(); x0 = t.clientX; y0 = t.clientY;
      startEl = document.elementFromPoint(x0, y0);
      longTimer = setTimeout(function () {
        longTimer = null;
        if (!isInteractive(startEl)) sendEscape();
      }, LONG_MS);
    }, { passive: true });
    window.addEventListener("touchend", function (e) {
      if (window.touchNative === true) return;
      if (longTimer) { clearTimeout(longTimer); longTimer = null; }
      var t = e.changedTouches[0];
      var dx = t.clientX - x0, dy = t.clientY - y0;
      var adx = Math.abs(dx), ady = Math.abs(dy);
      if (Math.max(adx, ady) >= SWIPE) {
        if (adx >= ady) sendKey(dx > 0 ? "ArrowRight" : "ArrowLeft", dx > 0 ? 39 : 37);
        else sendKey(dy > 0 ? "ArrowDown" : "ArrowUp", dy > 0 ? 40 : 38);
        return;
      }
      if (Date.now() - t0 >= TAP_MS) return;
      // El tap ya disparó pointerdown/click sobre el control tocado; solo
      // falta dejar que la página consuma los taps "en vacío" (tablero,
      // mapa de islas…) en vez de mandar un Enter al elemento equivocado.
      try {
        if (window.touchTapMove) window.touchTapMove(t.clientX, t.clientY);
      } catch (err) {}
    }, { passive: true });
    window.addEventListener("touchmove", function () {
      if (longTimer) { clearTimeout(longTimer); longTimer = null; }
    }, { passive: true });
    window.addEventListener("touchcancel", function () {
      if (longTimer) { clearTimeout(longTimer); longTimer = null; }
    }, { passive: true });
  }

  // ── Puente IME para el nombre del jugador (solo Tizen) ──────────────────
  // En Android la máquina de escribir dibujada en la pantalla de selección
  // ya responde al tacto: el teclado del sistema solo taparía la interfaz.
  var page = location.pathname.split("/").pop();
  if (IS_TIZEN && page === "seleccion-personaje.html") {
    window.addEventListener("DOMContentLoaded", function () {
      var ime = document.createElement("input");
      ime.id = "tv-ime";
      ime.type = "text";
      ime.maxLength = 12;
      ime.autocomplete = "off";
      ime.setAttribute("style",
        "position:fixed;top:0;left:0;width:2px;height:2px;opacity:0.01;z-index:-1;border:0;");
      document.body.appendChild(ime);
      var prev = "";
      ime.addEventListener("input", function () {
        var v = ime.value;
        if (v.length < prev.length) {
          sendKey("Backspace", 8);
        } else {
          for (var i = prev.length; i < v.length; i++) {
            sendKey(v[i], 0);
          }
        }
        prev = v;
        ime.value = "";
        prev = "";
      });
      // Al tocar la zona del nombre se enfoca el input → teclado en pantalla
      window.addEventListener("touchend", function () {
        var f = window.focusNameField || null;
        ime.focus();
      }, { passive: true });
      setTimeout(function () { ime.focus(); }, 800);
    });
  }
})();
