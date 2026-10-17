/**
 * api-shim.js — interceptor de fetch para la app de TV (Tizen).
 *
 * En la TV no hay servidor Node: las llamadas /api/* se resuelven aquí
 * (localStorage + JSONs empaquetados + solver compilado). Las páginas del
 * juego no cambian nada.
 *
 * Se activa cuando: window.tizen existe (TV real), el userAgent es Tizen,
 * el protocolo es file:, o localStorage['runika.tizen']==='1' (pruebas).
 * En el servidor dev (localhost) queda inerte.
 * Cargar ANTES que el resto de scripts de la página.
 */
(function () {
  "use strict";

  var TV_MODE =
    typeof window.tizen !== "undefined" ||
    typeof window.cordova !== "undefined" ||
    /Tizen/i.test(navigator.userAgent || "") ||
    location.protocol === "file:" ||
    localStorage.getItem("runika.tizen") === "1";

  if (!TV_MODE) return; // servidor normal: nada que hacer

  var origFetch = window.fetch.bind(window);
  var WORLDS = ["ESPACIO", "AGUA", "TIERRA", "FUEGO", "HIELO", "VIENTO", "INFRAMUNDO", "MAZMORRA"];
  var LS_SETTINGS = "runika.settings";

  function json(obj, status) {
    return Promise.resolve(new Response(JSON.stringify(obj), {
      status: status || 200,
      headers: { "Content-Type": "application/json" },
    }));
  }

  function fileJson(path) {
    return origFetch(encodeURI(path)).then(function (r) {
      if (!r.ok) return json({ ok: false }, r.status);
      return r;
    });
  }

  // ── Ajustes (localStorage) ───────────────────────────────────────────────
  function readSettings() {
    try {
      var s = localStorage.getItem(LS_SETTINGS);
      return Object.assign({ sound: true, music: true, lang: "es" }, s ? JSON.parse(s) : {});
    } catch (e) { return { sound: true, music: true, lang: "es" }; }
  }

  function writeSettings(body) {
    var next = Object.assign(readSettings(), body || {});
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(next)); } catch (e) {}
    return next;
  }

  // ── Rutas load-* → JSON empaquetado ──────────────────────────────────────
  function loadPathFor(path, u) {
    var w = u.searchParams.get("world") || "";
    switch (path) {
      case "/api/load-glow": return "assets/menu principal/glow-config.json";
      case "/api/load-corners": return "assets/backgrounds/" + w + "/grid-corners.json";
      case "/api/load-losa-size": return "assets/losa-size.json";
      case "/api/load-losas": return "assets/backgrounds/" + w + "/losas.json";
      case "/api/load-cells": return "assets/backgrounds/" + w + "/cells.json";
      case "/api/load-subworld-positions": return "assets/submundos/" + w + "/avatar-positions.json";
      case "/api/load-subworld-text-areas": return "assets/submundos/" + w + "/text-areas.json";
      case "/api/load-shop": return "assets/submundos/" + w + "/shop.json";
      case "/api/shop-items": return "assets/tienda/items.json";
      case "/api/load-world-paths": return "assets/mapamundi/world-paths.json";
      case "/api/load-avatar-positions": return "assets/mapamundi/avatar-positions.json";
      case "/api/load-mapamundi-text-areas": return "assets/mapamundi/text-areas.json";
      case "/api/load-instructions-areas": return "assets/instrucciones/instructions-areas.json";
      case "/api/load-creditos-areas": return "assets/creditos/creditos-areas.json";
      case "/api/load-modal-areas":
        return "assets/comunes/" + (u.searchParams.get("which") === "reintentar"
          ? "modal-reintentar-areas.json" : "modal-areas.json");
      case "/api/load-config-areas": return "assets/configuracion/config-areas.json";
      case "/api/load-fin-areas": return "assets/comunes/fin-areas.json";
      case "/api/load-selection-name": return "assets/menu principal/selection-name-area.json";
      case "/api/load-selection-buttons": return "assets/menu principal/selection-buttons.json";
      case "/api/load-character-positions": return "assets/menu principal/character-positions.json";
      case "/api/load-menu-buttons": return "assets/menu principal/menu-buttons.json";
      case "/api/load-board-sprites": return "assets/backgrounds/" + w + "/sprites.json";
      case "/api/load-board-text-areas": return "assets/backgrounds/" + w + "/text-areas.json";
      case "/api/load-detection": return "assets/backgrounds/" + w + "/board-detection.json";
      default: return null;
    }
  }

  function postBody(init) {
    try { return JSON.parse((init && init.body) || "{}"); } catch (e) { return {}; }
  }

  function handle(path, u, init) {
    var DB = window.RunikaDB;
    var method = (init && init.method) || "GET";

    // ── Estáticos ──────────────────────────────────────────────────────────
    if (path === "/api/assets-manifest") return fileJson("web/manifest.json");
    if (path === "/api/worlds") return fileJson("web/detections.json");
    if (path === "/api/board-sprites-assets") {
      return origFetch("web/sprite-assets.json").then(function (r) { return r.json(); }).then(function (all) {
        var w = u.searchParams.get("world") || "";
        return all[w] ? json(all[w]) : json({ ok: false, error: "Mundo no encontrado" }, 404);
      });
    }
    var lp = loadPathFor(path, u);
    if (lp) {
      return fileJson(lp).then(function (r) {
        // sprites.json ausente → valores por defecto (igual que el servidor)
        if (!r.ok && path === "/api/load-board-sprites") {
          return json({ ok: true, world: u.searchParams.get("world") || "",
            global: { offsetX: 0, offsetY: 0, scale: 1 } });
        }
        return r;
      });
    }

    // ── i18n ───────────────────────────────────────────────────────────────
    if (path === "/api/i18n") {
      var lang = readSettings().lang;
      return fileJson("i18n/" + lang + ".json").then(function (r) {
        return r.ok ? r : fileJson("i18n/es.json");
      });
    }
    var mI18n = path.match(/^\/api\/i18n\/(\w+)$/);
    if (mI18n) return fileJson("i18n/" + mI18n[1] + ".json");

    // ── Versión (la estampa tools/build-tizen.mjs desde package.json) ───────
    if (path === "/api/version") return json({ version: "__RUNIKA_VERSION__" });

    // ── Ajustes ────────────────────────────────────────────────────────────
    if (path === "/api/settings" && method === "GET") return json(readSettings());
    if (path === "/api/settings" && method === "POST") {
      var next = writeSettings(postBody(init));
      return json({ ok: true, settings: next });
    }

    // ── Partida / jugador ──────────────────────────────────────────────────
    if (path === "/api/savegame") return json({ exists: DB.hasSaveGame(), player: DB.getPlayer() });
    if (path === "/api/new-game" && method === "POST") {
      var d = postBody(init);
      return json({ ok: true, player: DB.startNewGame(String(d.name || ""), Number(d.avatar || 0)) });
    }
    if (path === "/api/player") return json({ ok: true, player: DB.getPlayer() });
    if (path === "/api/stats") return json(Object.assign({ ok: true }, DB.getStats()));
    if (path === "/api/progress") return json(DB.getProgress());
    if (path === "/api/map-position" && method === "POST") {
      return json({ ok: true, player: DB.setLastWorld(String(postBody(init).world || "")) });
    }
    if (path === "/api/level-position" && method === "POST") {
      var dl = postBody(init);
      return json({ ok: true, player: DB.setLevelPosition(String(dl.world || ""), Number(dl.level) || 0) });
    }
    if (path === "/api/level-complete" && method === "POST") {
      var dc = postBody(init);
      return json({
        ok: true,
        player: DB.completeLevel(String(dc.world || ""), Number(dc.level) || 0,
          Number(dc.gold) || 0, dc.screenId ? String(dc.screenId) : undefined),
      });
    }
    if (path === "/api/complete-screen" && method === "POST") {
      return json({ ok: true, player: DB.completeScreen(String(postBody(init).screenId || "")) });
    }
    if (path === "/api/fail-screen" && method === "POST") {
      DB.failScreen(String(postBody(init).screenId || ""));
      return json({ ok: true });
    }

    // ── Pantallas / bancos ─────────────────────────────────────────────────
    if (path === "/api/next-screen") {
      return DB.getNextScreen().then(function (r) {
        return json({ ok: true, screen: r.screen, tier: r.tier, world: r.world, stage: r.stage, player: DB.getPlayer() });
      });
    }
    if (path === "/api/level-screen") {
      return DB.getLevelScreen(u.searchParams.get("world") || "", Number(u.searchParams.get("level") || 0))
        .then(function (r) {
          return json({ ok: true, screen: r.screen, tier: r.tier, world: u.searchParams.get("world"), level: Number(u.searchParams.get("level")) });
        })
        .catch(function (e) { return json({ ok: false, error: String(e) }, 500); });
    }
    if (path === "/api/practice-screen") {
      var tier = Math.max(DB.FIRST_TIER, Number(u.searchParams.get("tier") || DB.FIRST_TIER) || DB.FIRST_TIER);
      return DB.getRandomScreenByTier(tier).then(function (s) {
        return s ? json({ ok: true, screen: s, tier: tier }) : json({ ok: false, error: "Tier sin pantallas" }, 404);
      });
    }
    if (path === "/api/screen-nav") {
      var dir = u.searchParams.get("dir") === "prev" ? -1 : 1;
      return DB.getScreenById(u.searchParams.get("id") || "").then(function (cur) {
        if (!cur) return json({ ok: false, error: "Sin pantalla adyacente" }, 404);
        return DB.indexOfScreen(cur).then(function (idx) {
          return DB.getScreenAt(cur.level, idx + dir).then(function (s) {
            return s ? json({ ok: true, screen: s }) : json({ ok: false, error: "Sin pantalla adyacente" }, 404);
          });
        });
      });
    }
    if (path === "/api/screen") {
      var id = u.searchParams.get("id");
      var p = id ? DB.getScreenById(id)
        : DB.getScreenAt(Number(u.searchParams.get("tier")) || 0, Number(u.searchParams.get("index")) || 0);
      return p.then(function (s) {
        return s ? json({ ok: true, screen: s }) : json({ ok: false, error: "Pantalla no encontrada" }, 404);
      });
    }
    if (path === "/api/tier-size") {
      return DB.tierSize(Number(u.searchParams.get("tier")) || 0)
        .then(function (size) { return json({ ok: true, tier: Number(u.searchParams.get("tier")) || 0, size: size }); });
    }

    // ── Solver (bundle web/solver.bundle.js → window.RunikaSolver) ─────────
    if (path === "/api/solve-screen") {
      return DB.getScreenById(u.searchParams.get("id") || "").then(function (screen) {
        var S = window.RunikaSolver;
        if (!screen || !S) return json({ ok: false, error: "Pantalla no encontrada" }, 404);
        var lv = S.screenToLevelData(screen);
        var sol = S.solvePath(lv);
        var spath = sol.solvable && sol.path ? sol.path : null;
        var par = screen.par || sol.length || 0;
        var sols = screen.sols || (sol.solvable
          ? [par, par - 1, par - 2].map(function (len) { return S.countSolutionsOfMinLength(lv, len); })
          : null);
        var moves = [], cells = [];
        if (spath) {
          spath.forEach(function (i) { cells.push([i % 8, Math.floor(i / 8)]); });
          for (var i = 1; i < spath.length; i++) {
            var prev = spath[i - 1], cur = spath[i];
            if (cur !== prev) moves.push([(cur % 8) - (prev % 8), Math.floor(cur / 8) - Math.floor(prev / 8)]);
          }
        }
        return spath
          ? json({ ok: true, par: par, trueMin: screen.trueMin || sol.length, sols: sols, moves: moves, path: cells })
          : json({ ok: false, error: "Sin solución" }, 404);
      });
    }
    if (path === "/api/hint") {
      return DB.getScreenById(u.searchParams.get("id") || "").then(function (screen) {
        var S = window.RunikaSolver;
        var parsePair = function (s) {
          var m = (s || "").match(/^(-?\d+),(-?\d+)$/);
          return m ? [Number(m[1]), Number(m[2])] : null;
        };
        var pp = parsePair(u.searchParams.get("p"));
        var eRaw = (u.searchParams.get("e") || "").split(";").map(parsePair).filter(Boolean);
        var ps = Number(u.searchParams.get("ps") || "0") || 0;
        var es = (u.searchParams.get("es") || "").split(",").map(function (n) { return Number(n) || 0; });
        if (!screen || !pp || !S) return json({ ok: false, error: "Parámetros inválidos" }, 400);
        var lv = S.screenToLevelData(screen);
        var idx = function (cr) { return cr[1] * 8 + cr[0]; };
        var move = S.nextMoveFrom(lv, { p: idx(pp), e: eRaw.map(idx), s: es, ps: ps });
        return move
          ? json({ ok: true, move: [move.dc, move.dr], remaining: move.remaining })
          : json({ ok: false, error: "Sin ruta desde aquí" }, 404);
      });
    }

    // ── Tienda ─────────────────────────────────────────────────────────────
    if (path === "/api/buy-item" && method === "POST") {
      var itemId = String(postBody(init).itemId || "");
      return fileJson("assets/tienda/items.json").then(function (r) {
        return r.json();
      }).then(function (catalog) {
        var items = (catalog && catalog.items) || [];
        var item = items.find(function (i) { return i.id === itemId; });
        if (!item) return json({ ok: false, error: "unknown-item" }, 404);
        var result = DB.buyItem(item.id, item.price, item.uses || 1);
        return json(result, result.ok ? 200 : 409);
      });
    }
    if (path === "/api/consume-item" && method === "POST") {
      var cid = String(postBody(init).itemId || "");
      var cres = DB.consumeItem(cid);
      return json(cres, cres.ok ? 200 : 409);
    }

    // ── Writes de calibración: no-op en TV ─────────────────────────────────
    if (path.indexOf("/api/save-") === 0 && method === "POST") return json({ ok: true });

    return null; // no reconocida → passthrough
  }

  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var path = url;
    try {
      var full = new URL(url, location.origin);
      if (full.origin === location.origin || url.charAt(0) === "/") path = full.pathname;
    } catch (e) {}
    if (path.indexOf("/api/") !== 0) return origFetch(input, init);
    var u;
    try { u = new URL(url, location.origin || "http://localhost"); }
    catch (e) { return origFetch(input, init); }
    var out = handle(u.pathname, u, init);
    if (out === null) return origFetch(input, init);
    return out;
  };
})();
