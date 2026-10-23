/**
 * RunikaDB — port a navegador de db/db.ts para la app de TV (Tizen).
 * Misma lógica de progreso/asignaciones sticky; diferencias:
 *  - persistencia en localStorage (runika.player + runika.assignments)
 *  - los bancos db/screens-tier-N.json se cargan con fetch bajo demanda
 *    (cache por tier — varios tiers pueden quedar cargados para re-juegos)
 * Script clásico: expone window.RunikaDB.
 */
(function () {
  "use strict";

  var WORLDS = ["ESPACIO", "AGUA", "TIERRA", "FUEGO", "HIELO", "VIENTO", "INFRAMUNDO", "MAZMORRA"];
  var SUBLEVELS_PER_WORLD = 12;
  var TOTAL_STAGES = WORLDS.length * SUBLEVELS_PER_WORLD; // 96
  var TOTAL_TIERS = 18;
  var FINAL_TIER = 18;
  var FIRST_TIER = 2;
  var ENTRY_TIER = 1;
  var MAP_LEVELS_PER_WORLD = SUBLEVELS_PER_WORLD;
  var FINAL_WORLD = "MAZMORRA";
  var BOSS_LEVEL_IDX = MAP_LEVELS_PER_WORLD - 1;

  var LS_PLAYER = "runika.player";
  var LS_ASSIGN = "runika.assignments";

  var tierCache = {}; // tier -> Screen[] | Promise<Screen[]>
  var player = null;
  var assignments = {}; // key -> {current, completed[]}

  function defaultPlayer() {
    return {
      playerId: "local",
      currentWorld: 1,
      currentSubLevel: 1,
      totalStagesCompleted: 0,
      gold: 0,
      lastWorld: "ESPACIO",
      worldProgress: {},
      gameLevel: FIRST_TIER,
    };
  }

  function stageFor(world, subLevel) { return (world - 1) * SUBLEVELS_PER_WORLD + subLevel; }

  function tierForCompleted(completed) {
    var c = Math.max(0, Math.min(TOTAL_STAGES - 1, completed));
    return Math.min(TOTAL_TIERS, FIRST_TIER + Math.floor((c * (TOTAL_TIERS - FIRST_TIER + 1)) / TOTAL_STAGES));
  }

  function bandForCompleted(completed) {
    var c = Math.max(0, Math.min(TOTAL_STAGES - 1, completed));
    return 0.5 + (c / (TOTAL_STAGES - 1)) * 7.5;
  }

  var usedKeysCache = null;
  function persist() {
    usedKeysCache = null; // las asignaciones cambiaron: huellas se recalculan
    try {
      localStorage.setItem(LS_PLAYER, JSON.stringify(player));
      localStorage.setItem(LS_ASSIGN, JSON.stringify(assignments));
    } catch (e) { /* almacenamiento lleno/bloqueado: se pierde el progreso */ }
  }

  function init() {
    try {
      var p = localStorage.getItem(LS_PLAYER);
      player = p ? Object.assign(defaultPlayer(), JSON.parse(p)) : defaultPlayer();
      player.gameLevel = tierForCompleted(player.totalStagesCompleted || 0);
      var a = localStorage.getItem(LS_ASSIGN);
      assignments = a ? JSON.parse(a) : {};
    } catch (e) {
      player = defaultPlayer();
      assignments = {};
    }
  }

  /** Carga (con cache) el banco de un tier. */
  function ensureTierLoaded(tier) {
    if (tierCache[tier] instanceof Promise) return tierCache[tier];
    if (tierCache[tier]) return Promise.resolve(tierCache[tier]);
    var p = fetch("db/screens-tier-" + tier + ".json").then(function (r) {
      if (!r.ok) throw new Error("banco tier " + tier + " no encontrado");
      return r.json();
    }).then(function (screens) {
      tierCache[tier] = screens;
      return screens;
    });
    tierCache[tier] = p;
    return p;
  }

  function findScreenById(id) {
    var m = /^l(\d+)-/.exec(id || "");
    var tiers = m && Number(m[1]) >= ENTRY_TIER && Number(m[1]) <= FINAL_TIER
      ? [Number(m[1])]
      : Array.from({ length: FINAL_TIER - ENTRY_TIER + 1 }, function (_, i) { return ENTRY_TIER + i; });
    var chain = Promise.resolve(null);
    var _loop = function (i) {
      if (i >= tiers.length) return null;
      return ensureTierLoaded(tiers[i]).then(function (pool) {
        var s = pool.find(function (sc) { return sc.id === id; });
        return s || _loop(i + 1);
      }).catch(function () { return _loop(i + 1); });
    };
    return chain.then(function () { return _loop(0); });
  }

  // ── Jugador ───────────────────────────────────────────────────────────────

  function getPlayer() { return Object.assign({}, player); }
  function hasSaveGame() { return player.started === true; }

  function startNewGame(playerName, avatarIndex) {
    player = Object.assign(defaultPlayer(), {
      started: true,
      playerName: playerName,
      avatarIndex: avatarIndex,
      updatedAt: Date.now(),
    });
    assignments = {};
    persist();
    return getPlayer();
  }

  function currentStage() { return stageFor(player.currentWorld, player.currentSubLevel); }
  function currentTier() { return tierForCompleted(player.totalStagesCompleted); }
  function currentWorldName() { return WORLDS[player.currentWorld - 1] || "ESPACIO"; }

  function mapTierFor(world, level) {
    if (world === FINAL_WORLD && level === BOSS_LEVEL_IDX) return FINAL_TIER;
    var wIdx = WORLDS.indexOf(world);
    // Bienvenida solo en el PRIMER mundo (isla 1 → tier 1, isla 2 → tier 2);
    // en mundos posteriores seria un descenso absurdo.
    if (wIdx === 0 && level === 0) return ENTRY_TIER;
    if (wIdx === 0 && level === 1) return FIRST_TIER;
    // base por mundo (+2 tiers) + rampa por isla (~4-5 dentro del mundo)
    var base = FIRST_TIER + Math.max(0, wIdx) * 2;
    var ramp = Math.floor(level * 0.45);
    return Math.min(TOTAL_TIERS, base + ramp);
  }

  function setLastWorld(world) {
    if (WORLDS.indexOf(world) >= 0) player.lastWorld = world;
    player.updatedAt = Date.now();
    persist();
    return getPlayer();
  }

  function setLevelPosition(world, level) {
    if (WORLDS.indexOf(world) < 0) return getPlayer();
    var wp = Object.assign({}, player.worldProgress || {});
    var w = Object.assign({}, wp[world] || {});
    w.last = Math.max(0, Math.min(MAP_LEVELS_PER_WORLD - 1, level));
    wp[world] = w;
    player.worldProgress = wp;
    player.lastWorld = world;
    player.gameLevel = currentTier();
    player.updatedAt = Date.now();
    persist();
    return getPlayer();
  }

  function usedScreenIds() {
    var used = {};
    for (var k in assignments) {
      var a = assignments[k];
      if (a.current) used[a.current] = true;
      for (var i = 0; i < a.completed.length; i++) used[a.completed[i]] = true;
    }
    return used;
  }

  /** Huella de contenido: mismo puzzle = misma clave aunque viva en dos
      bancos de tier con ids distintos (~950 duplicados entre bancos — el
      dedupe por id no los cazaba y el puzzle "se repetia"). */
  function screenContentKey(s) {
    function cell(p) { return p[0] + "," + p[1]; }
    var en = (s.enemies || []).map(function (e) { return cell(e.pos) + ":" + e.pattern; }).sort().join("|");
    var ob = (s.obstacles || []).map(cell).sort().join("|");
    var tr = (s.traps || []).map(cell).sort().join("|");
    return [(s.grid || []).join("/"), cell(s.player), cell(s.goal), en, ob, tr].join("#");
  }

  /** Huellas de contenido de TODAS las pantallas ya usadas (async: las ids
      antiguas sin `keys` se resuelven por fetch una sola vez por sesión y
      se guardan en la asignacion). */
  function usedContentKeys() {
    if (usedKeysCache) return Promise.resolve(usedKeysCache);
    var keys = {}, pairs = [];
    for (var k in assignments) {
      var a = assignments[k];
      (a.keys || []).forEach(function (kk) { keys[kk] = true; });
      if (a.current) pairs.push([a, a.current]);
      (a.completed || []).forEach(function (id) { pairs.push([a, id]); });
    }
    var migrated = false;
    return pairs.reduce(function (p, pair) {
      return p.then(function () {
        return findScreenById(pair[1]).then(function (s) {
          if (!s) return;
          var key = screenContentKey(s);
          keys[key] = true;
          if ((pair[0].keys || []).indexOf(key) < 0) {
            pair[0].keys = (pair[0].keys || []).concat(key);
            migrated = true;
          }
        });
      });
    }, Promise.resolve()).then(function () {
      if (migrated) persist();
      usedKeysCache = keys;
      return keys;
    });
  }

  /** Pantalla sticky de una isla (misma lógica que getLevelScreen de db.ts). */
  function getLevelScreen(world, level) {
    var tier = mapTierFor(world, level);
    var key = "map:" + world + ":" + level;
    var assign = assignments[key] || { current: null, completed: [] };

    function pick() {
      if (assign.current !== null) {
        return findScreenById(assign.current).then(function (s) {
          if (s) return { screen: s, tier: tier };
          assign.current = null;
          return pickReplayOrNew();
        });
      }
      return pickReplayOrNew();
    }

    function pickReplayOrNew() {
      var replayId = assign.completed[0] || null;
      var after = function () {
        return ensureTierLoaded(tier).then(function (pool) {
          return usedContentKeys().then(function (usedKeys) {
            var used = usedScreenIds();
            // Primera visita: sorteo al azar entre las no usadas — ni por
            // id NI por contenido (un puzzle puede vivir en dos bancos).
            var free = pool.filter(function (s) { return !used[s.id]; });
            var fresh = free.filter(function (s) { return !usedKeys[screenContentKey(s)]; });
            var src = fresh.length ? fresh : (free.length ? free : pool);
            var chosen = src[Math.floor(Math.random() * src.length)];
            assign.current = chosen.id;
            assign.keys = (assign.keys || []).concat(screenContentKey(chosen));
            assignments[key] = assign;
            persist();
            return { screen: chosen, tier: tier };
          });
        });
      };
      if (replayId !== null) {
        return findScreenById(replayId).then(function (s) {
          if (s) return { screen: s, tier: tier };
          return after();
        });
      }
      return after();
    }

    return pick();
  }

  /** Marca isla completada: oro solo la primera vez, tier sube por superadas. */
  function completeLevel(world, level, goldEarned, screenId) {
    var key = "map:" + world + ":" + level;
    var assign = assignments[key] || { current: null, completed: [] };
    if (screenId) {
      if (assign.current === screenId) assign.current = null;
      if (assign.completed.indexOf(screenId) < 0) assign.completed.push(screenId);
    }
    assignments[key] = assign;

    var wp = Object.assign({}, player.worldProgress || {});
    var w = Object.assign({ completed: [] }, wp[world] || {});
    w.completed = w.completed || [];
    var isNew = w.completed.indexOf(level) < 0;
    if (isNew) {
      w.completed.push(level);
      player.totalStagesCompleted += 1;
      player.gold = (player.gold || 0) + (goldEarned || 0);
    }
    w.last = level;
    wp[world] = w;
    player.worldProgress = wp;
    player.lastWorld = world;
    player.gameLevel = tierForCompleted(player.totalStagesCompleted);
    player.updatedAt = Date.now();
    persist();
    return getPlayer();
  }

  function isWorldComplete(world) {
    var c = (player.worldProgress && player.worldProgress[world] && player.worldProgress[world].completed) || [];
    return c.length >= MAP_LEVELS_PER_WORLD;
  }

  /** La isla tienda `index` desaparece al pasar de largo sin entrar (única). */
  function markShopGone(world, index) {
    if (WORLDS.indexOf(world) < 0) return getPlayer();
    index = index || 0;
    var wp = Object.assign({}, player.worldProgress || {});
    var w = Object.assign({}, wp[world] || {});
    var prev = w.shopGone;
    var g = prev === true ? [0] : (Array.isArray(prev) ? prev.slice() : []);
    if (g.indexOf(index) < 0) g.push(index);
    w.shopGone = g;
    wp[world] = w;
    player.worldProgress = wp;
    player.updatedAt = Date.now();
    persist();
    return getPlayer();
  }

  /** Tienda ya visitada: no reaparece (visita única por tienda). */
  function markShopVisited(world, index) {
    if (WORLDS.indexOf(world) < 0) return getPlayer();
    index = index || 0;
    var wp = Object.assign({}, player.worldProgress || {});
    var w = Object.assign({}, wp[world] || {});
    var prev = w.shopGone;
    var g = prev === true ? [0] : (Array.isArray(prev) ? prev.slice() : []);
    if (g.indexOf(index) < 0) g.push(index);
    w.shopGone = g;
    var v = Array.isArray(w.shopVisited) ? w.shopVisited.slice() : [];
    if (v.indexOf(index) < 0) v.push(index);
    w.shopVisited = v;
    wp[world] = w;
    player.worldProgress = wp;
    player.updatedAt = Date.now();
    persist();
    return getPlayer();
  }

  /** Precio efectivo: con `priceGrowth` (>1) cada compra multiplica la
   *  base — p. ej. midas ×1.8 por compra, sin decimales. */
  function itemPrice(itemId, price, priceGrowth) {
    if (!(priceGrowth > 1)) return price;
    var n = (player.itemPurchases || {})[itemId] || 0;
    return Math.round(price * Math.pow(priceGrowth, n));
  }

  /** Compra un ítem: descuenta oro y suma `uses` al inventario.
   *  Falla sin oro o si ya se lleva el máximo (`max` por tipo). */
  function buyItem(itemId, price, uses, max, priceGrowth) {
    var inv0 = player.inventory || {};
    if ((inv0[itemId] || 0) >= (max || 1)) return { ok: false, player: getPlayer() };
    var effPrice = itemPrice(itemId, price, priceGrowth);
    if ((player.gold || 0) < effPrice) return { ok: false, player: getPlayer() };
    player.gold = (player.gold || 0) - effPrice;
    var inv = Object.assign({}, player.inventory || {});
    inv[itemId] = (inv[itemId] || 0) + (uses || 1);
    player.inventory = inv;
    if (priceGrowth > 1) {
      var p = Object.assign({}, player.itemPurchases || {});
      p[itemId] = (p[itemId] || 0) + 1;
      player.itemPurchases = p;
    }
    player.updatedAt = Date.now();
    persist();
    return { ok: true, player: getPlayer() };
  }

  /** Consume un uso de un ítem del inventario. */
  function consumeItem(itemId) {
    var inv = Object.assign({}, player.inventory || {});
    if ((inv[itemId] || 0) <= 0) return { ok: false, player: getPlayer() };
    inv[itemId] -= 1;
    player.inventory = inv;
    player.updatedAt = Date.now();
    persist();
    return { ok: true, player: getPlayer() };
  }

  /** Toque de Midas: todo el oro de las islas posteriores de `world` se
   *  duplica. Consume un uso; falla si el mundo ya tiene el efecto. */
  function activateMidas(world, level) {
    if (WORLDS.indexOf(world) < 0) return { ok: false, player: getPlayer() };
    var wp = Object.assign({}, player.worldProgress || {});
    var w = Object.assign({}, wp[world] || {});
    if (w.midasAt != null) return { ok: false, player: getPlayer() };
    var inv = Object.assign({}, player.inventory || {});
    if ((inv["midas"] || 0) <= 0) return { ok: false, player: getPlayer() };
    inv["midas"] -= 1;
    player.inventory = inv;
    w.midasAt = Math.max(0, Math.min(11, Math.trunc(level)));
    wp[world] = w;
    player.worldProgress = wp;
    player.updatedAt = Date.now();
    persist();
    return { ok: true, player: getPlayer() };
  }

  /** Pantalla bonus: suma/resta el botín al oro del jugador (mínimo 0). */
  function addBonusGold(delta) {
    player.gold = Math.max(0, (player.gold || 0) + Math.trunc(delta || 0));
    player.updatedAt = Date.now();
    persist();
    return getPlayer();
  }

  function isWorldUnlocked(world) {
    if (isWorldComplete(world)) return false;
    if (world !== FINAL_WORLD) return true;
    return WORLDS.filter(function (w) { return w !== FINAL_WORLD; }).every(isWorldComplete);
  }

  /** Flujo libre (sin mapa): pantalla sticky por (mundo, tier). */
  function getNextScreen() {
    var stage = currentStage();
    var tier = currentTier();
    var world = currentWorldName();
    var key = world + ":" + tier;
    var assign = assignments[key] || { current: null, completed: [] };

    function fromPool() {
      return ensureTierLoaded(tier).then(function (pool) {
        var completedSet = {};
        assign.completed.forEach(function (id) { completedSet[id] = true; });
        var unused = pool.filter(function (s) { return !completedSet[s.id]; });
        var chosen;
        if (unused.length > 0) chosen = unused[Math.floor(Math.random() * unused.length)];
        else { assign.completed = []; chosen = pool[Math.floor(Math.random() * pool.length)]; }
        assign.current = chosen.id;
        assignments[key] = assign;
        persist();
        return { screen: chosen, tier: tier, world: world, stage: stage };
      });
    }

    if (assign.current !== null) {
      return ensureTierLoaded(tier).then(function (pool) {
        var s = pool.find(function (sc) { return sc.id === assign.current; });
        if (s) return { screen: s, tier: tier, world: world, stage: stage };
        assign.current = null;
        return fromPool();
      });
    }
    return fromPool();
  }

  function completeScreen(screenId) {
    var tier = currentTier();
    var world = currentWorldName();
    var key = world + ":" + tier;
    var assign = assignments[key] || { current: null, completed: [] };
    if (assign.current === screenId) assign.current = null;
    if (assign.completed.indexOf(screenId) < 0) assign.completed.push(screenId);
    assignments[key] = assign;
    player.totalStagesCompleted += 1;
    if (player.currentSubLevel >= SUBLEVELS_PER_WORLD) {
      if (player.currentWorld < WORLDS.length) { player.currentWorld += 1; player.currentSubLevel = 1; }
      else player.currentSubLevel = SUBLEVELS_PER_WORLD;
    } else {
      player.currentSubLevel += 1;
    }
    player.updatedAt = Date.now();
    persist();
    return getPlayer();
  }

  function getStats() {
    var totalCompleted = 0;
    for (var k in assignments) totalCompleted += assignments[k].completed.length;
    return {
      player: getPlayer(),
      currentStage: currentStage(),
      currentTier: currentTier(),
      currentBand: Number(bandForCompleted(player.totalStagesCompleted).toFixed(2)),
      totalStages: TOTAL_STAGES,
      screensCompleted: totalCompleted,
    };
  }

  function getProgress() {
    var result = [];
    for (var key in assignments) {
      var parts = key.split(":");
      var a = assignments[key];
      result.push({ world: parts[0], tier: Number(parts[1]), current: a.current, completed: a.completed });
    }
    return result;
  }

  function getRandomScreenByTier(tier) {
    return ensureTierLoaded(tier).then(function (pool) {
      if (!pool.length) return null;
      return pool[Math.floor(Math.random() * pool.length)];
    }).catch(function () { return null; });
  }

  function getScreenById(id) {
    var match = /^l(\d+)-s\d+$/.exec(id || "");
    if (!match) return Promise.resolve(null);
    return ensureTierLoaded(Number(match[1])).then(function (pool) {
      return pool.find(function (s) { return s.id === id; }) || null;
    }).catch(function () { return null; });
  }

  function getScreenAt(tier, index) {
    return ensureTierLoaded(tier).then(function (pool) {
      if (!pool.length) return null;
      var i = ((index % pool.length) + pool.length) % pool.length;
      return pool[i] || null;
    }).catch(function () { return null; });
  }

  function indexOfScreen(screen) {
    return ensureTierLoaded(screen.level).then(function (pool) {
      return pool.findIndex(function (s) { return s.id === screen.id; });
    }).catch(function () { return -1; });
  }

  function tierSize(tier) {
    return ensureTierLoaded(tier).then(function (pool) { return pool.length; }).catch(function () { return 0; });
  }

  init();

  window.RunikaDB = {
    WORLDS: WORLDS,
    SUBLEVELS_PER_WORLD: SUBLEVELS_PER_WORLD,
    FIRST_TIER: FIRST_TIER,
    FINAL_TIER: FINAL_TIER,
    FINAL_WORLD: FINAL_WORLD,
    BOSS_LEVEL_IDX: BOSS_LEVEL_IDX,
    getPlayer: getPlayer,
    hasSaveGame: hasSaveGame,
    startNewGame: startNewGame,
    setLastWorld: setLastWorld,
    setLevelPosition: setLevelPosition,
    completeLevel: completeLevel,
    getLevelScreen: getLevelScreen,
    getNextScreen: getNextScreen,
    completeScreen: completeScreen,
    failScreen: function () {},
    isWorldComplete: isWorldComplete,
    markShopGone: markShopGone,
    markShopVisited: markShopVisited,
    isWorldUnlocked: isWorldUnlocked,
    buyItem: buyItem,
    consumeItem: consumeItem,
    activateMidas: activateMidas,
    addBonusGold: addBonusGold,
    itemPrice: itemPrice,
    getStats: getStats,
    getProgress: getProgress,
    currentTier: currentTier,
    mapTierFor: mapTierFor,
    getRandomScreenByTier: getRandomScreenByTier,
    getScreenById: getScreenById,
    getScreenAt: getScreenAt,
    indexOfScreen: indexOfScreen,
    tierSize: tierSize,
  };
})();
