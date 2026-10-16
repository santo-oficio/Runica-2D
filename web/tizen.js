/**
 * tizen.js — adaptación del mando Samsung para la app de TV.
 *
 * - Registra las teclas del mando en tvinputdevice (si no, Back sale de la app).
 * - Back (10009) → evento Escape: todas las páginas ya lo tratan como "volver".
 * - Si una página no navega tras Escape, vuelve al menú; en el menú, Back sale.
 * - En seleccion-personaje.html, un <input> invisible hace de puente con el
 *   teclado en pantalla de Tizen: el texto IME se reenvía como keydown.
 * Solo actúa con window.tizen presente (no estorba en PC/navegador).
 */
(function () {
  "use strict";
  if (typeof window.tizen === "undefined") return;

  // Teclas del mando a distancia que la app quiere recibir
  try {
    var keys = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
      "Back", "Exit", "Info",
      "MediaPlay", "MediaPause", "MediaPlayPause", "MediaStop",
      "MediaRewind", "MediaFastForward",
      "ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue",
      "ChannelUp", "ChannelDown"];
    keys.forEach(function (k) {
      try { window.tizen.tvinputdevice.registerKey(k); } catch (e) {}
    });
  } catch (e) {}

  var NAV_TIMEOUT = 1400; // > duración de AssetsCache.transitionTo (450 ms)

  window.addEventListener("keydown", function (e) {
    if (e.keyCode !== 10009) return; // no es Back
    e.preventDefault();

    var page = location.pathname.split("/").pop() || "menu.html";
    if (page === "menu.html" || page === "index.html" || page === "") {
      try { window.tizen.application.getCurrentApplication().exit(); }
      catch (err) { window.close(); }
      return;
    }

    // Reenviar como Escape: las páginas ya saben qué hacer con él
    try {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true }));
    } catch (err) {}

    // Fallback: si la página no navegó sola, ir al menú
    var href = location.href;
    setTimeout(function () {
      if (location.href === href) location.href = "menu.html";
    }, NAV_TIMEOUT);
  }, true);

  // ── Puente IME para el nombre del jugador ────────────────────────────────
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
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", keyCode: 8, bubbles: true }));
        } else {
          for (var i = prev.length; i < v.length; i++) {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: v[i], keyCode: 0, bubbles: true }));
          }
        }
        prev = v;
        ime.value = "";
        prev = "";
      });
      // El foco va al input al cargar para que Enter del mando abra el IME;
      // las flechas/Enter burbujean igualmente hasta los handlers de la página.
      setTimeout(function () { ime.focus(); }, 800);
    });
  }
})();
