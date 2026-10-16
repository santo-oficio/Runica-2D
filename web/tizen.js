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
 *  - Gestos táctiles → teclas: swipe = flechas, tap = Enter,
 *    pulsación larga = Escape. Así todo el juego es jugable sin teclado.
 *  - El <input> invisible también invoca el teclado en pantalla Android.
 *
 * Solo actúa con window.tizen o window.cordova presentes.
 */
(function () {
  "use strict";

  var IS_TIZEN = typeof window.tizen !== "undefined";
  var IS_ANDROID = typeof window.cordova !== "undefined" ||
    /Android/i.test(navigator.userAgent || "");
  if (!IS_TIZEN && !IS_ANDROID) return;

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

  // ── Android: botón atrás + gestos táctiles ───────────────────────────────
  if (IS_ANDROID) {
    document.addEventListener("deviceready", function () {
      document.addEventListener("backbutton", onBack, false);
    });

    // Gestos: swipe → flecha, tap → Enter, long-press → Escape
    var t0 = 0, x0 = 0, y0 = 0, longTimer = null, SWIPE = 48, TAP_MS = 300;
    window.addEventListener("touchstart", function (e) {
      var t = e.touches[0];
      t0 = Date.now(); x0 = t.clientX; y0 = t.clientY;
      longTimer = setTimeout(function () { sendEscape(); longTimer = null; }, 700);
    }, { passive: true });
    window.addEventListener("touchend", function (e) {
      if (longTimer) { clearTimeout(longTimer); longTimer = null; }
      var t = e.changedTouches[0];
      var dx = t.clientX - x0, dy = t.clientY - y0;
      var adx = Math.abs(dx), ady = Math.abs(dy);
      if (Math.max(adx, ady) >= SWIPE) {
        if (adx >= ady) sendKey(dx > 0 ? "ArrowRight" : "ArrowLeft", dx > 0 ? 39 : 37);
        else sendKey(dy > 0 ? "ArrowDown" : "ArrowUp", dy > 0 ? 40 : 38);
      } else if (Date.now() - t0 < TAP_MS) {
        sendKey("Enter", 13);
      }
    }, { passive: true });
    window.addEventListener("touchmove", function () {
      if (longTimer) { clearTimeout(longTimer); longTimer = null; }
    }, { passive: true });
  }

  // ── Puente IME para el nombre del jugador (Tizen y Android) ─────────────
  var page = location.pathname.split("/").pop();
  if (page === "seleccion-personaje.html") {
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
