// Punto de entrada: carga datos y motor, muestra el título y conecta mundo, historia y duelos.
import { setupInput, Input } from "./input.js";
import { UI, el, esc, sleep } from "./ui/ui.js";
import { game, hasSave, load, wipe, flag, setFlag, addCard, fmt, save } from "./state.js";
import { WorldScene } from "./world/world.js";
import { SCRIPTS } from "./content/story.js";
import { STARTERS, STARTER_ORDER } from "./content/decks.js";
import { OcgCore } from "./engine/core.js";
import { CardDB } from "./duel/cards.js";
import { runDuel } from "./duel/session.js";
import { startMenu, deckEditor, showStarter, hideStarter, setMenuCards } from "./ui/menu.js";
import { ART } from "./duel/duelview.js";
import { Sfx } from "./sfx.js";
import { cardShop } from "./ui/shop.js";
import { updateUntouchedStarter, migrateSave } from "./content/starter-update.js";
import { giveStarterKeys } from "./duel/rewards.js";
import { setPartidaLayer } from "./content/deckbook.js";
import { openDeckBuilder } from "./ui/deckbuilder.js";

const ctx = {};

async function loadAll(progress) {
  const get = async (url, kind = "json") => { const r = await fetch(url); if (!r.ok) throw new Error(`No se pudo cargar ${url} (${r.status})`); return kind === "json" ? r.json() : r.arrayBuffer(); };
  progress("Cargando cartas...");
  // Los textos en español son opcionales: si faltan, las cartas quedan en inglés.
  const [cards, scripts, strings, wasm, cardsEs, profiles] = await Promise.all([get("data/cards.json"), get("data/scripts.json"), get("data/strings.json"), get("engine/ocgcore.wasm", "bin"), get("data/cards.es.json").catch(() => null),
    get("data/profiles.json").catch(() => null)]); // perfiles para la IA: si faltan, se calculan al vuelo
  progress("Iniciando motor de duelos...");
  let core;
  try { core = await OcgCore.load(wasm); }
  catch (e) { throw new Error("Tu navegador no soporta el motor de duelos (WebAssembly con excepciones). Usá Chrome/Edge 137+, Firefox 131+ o Safari 18.4+. Detalle: " + e.message); }
  ctx.core = core; ctx.cards = new CardDB(cards); ctx.strings = strings; ctx.bundle = scripts; ctx.extraScripts = {};
  ctx.cards.setSpanish(cardsEs, () => game.state.options.cardLang);
  if (profiles) ctx.cards.setProfiles(profiles);
  core.onLog = (t, m) => { if (t === 0) console.warn("[motor]", m); };
  // Nombre → id canónico (alias 0): una ilustración alternativa no es la carta del pool.
  ctx.byName = {}; for (const k in cards) { const n = cards[k][9]; if (!(n in ctx.byName) || cards[k][0] === 0) ctx.byName[n] = Number(k); }
  ctx.scripts = (name) => ctx.bundle[name] ?? ctx.extraScripts[name] ?? null;
  // Scripts de cartas fuera del paquete (por ejemplo, cartas nuevas puestas con el editor de mazos, D-45):
  // se piden antes de cada duelo a data/scripts/ y, si no están, a los scripts oficiales de Project Ignis.
  const RAW = "https://raw.githubusercontent.com/ProjectIgnis/CardScripts/master/";
  const fetchScript = async (n) => {
    for (const url of ["data/scripts/" + n, RAW + "official/" + n, RAW + n]) {
      try { const r = await fetch(url); if (r.ok) return await r.text(); } catch {}
    }
    return null;
  };
  ctx.preload = async (ids) => {
    // Los monstruos normales y las fichas no tienen script
    const scripted = [...new Set(ids)].filter((id) => { const c = ctx.cards.get(id); return c && !((c.type & 0x10) && !(c.type & 0x20)) && !(c.type & 0x4000); });
    let need = scripted.map((id) => `c${id}.lua`);
    while (need.length) {
      need = [...new Set(need)].filter((n) => !(n in ctx.bundle) && !(n in ctx.extraScripts));
      const got = await Promise.all(need.map(async (n) => (ctx.extraScripts[n] = await fetchScript(n))));
      // Dependencias que piden los scripts bajados (otras cartas o utilidades)
      need = got.filter(Boolean).flatMap((src) => [...src.matchAll(/Duel\.Load(?:Card)?Script\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1])
        .concat([...src.matchAll(/Duel\.LoadCardScript\(\s*(\d+)\s*\)/g)].map((m) => `c${m[1]}.lua`)));
    }
  };
  ctx.idOf = (name) => { const id = typeof name === "number" ? name : ctx.byName[name]; if (!id) throw new Error("Carta inexistente: " + name); return id; };
  ctx.idsOf = (list) => (list || []).flatMap(([n, q]) => Array(q).fill(ctx.idOf(n)));
  setMenuCards(ctx.cards, ctx);
  Sfx.loadFiles(); // sonidos propios opcionales en assets/sfx/
  // Arte local opcional (generado por tools/download_art.mjs)
  try { const r = await fetch("assets/cards/manifest.json"); if (r.ok) ART.available = new Set(await r.json()); } catch {}
}

// ---------------- API para los scripts de historia ----------------
function makeApi(world) {
  const actor = (id) => world.npc(id);
  const api = {
    get state() { return game.state; },
    say: (text, speaker) => UI.say(text, { speaker }),
    ask: (text, options, speaker) => UI.ask(text, options, { speaker }),
    input: (prompt, def, max) => UI.textInput(prompt, def, max),
    toast: (t) => UI.toast(t),
    wait: (ms) => sleep(ms),
    flash: () => UI.flash(2),
    blackScreen: (on) => UI.fade(on, 400),
    flag, setFlag,
    face: (id, dir) => world.face(actor(id), dir),
    pos: (id) => ({ x: actor(id).x, y: actor(id).y }),
    spawn: (def) => world.spawnNpc(def),
    remove: (id) => world.removeNpc(id),
    emote: (id) => world.emote(actor(id)),
    async move(id, dirs) { const a = actor(id); for (const d of [].concat(dirs)) await world.step(a, d, { ms: 220 }); },
    async lead(id, dirs) {
      const a = actor(id), p = world.player;
      for (const d of dirs) {
        const prev = { x: a.x, y: a.y }; await world.step(a, d, { ms: 220 });
        const dx = prev.x - p.x, dy = prev.y - p.y;
        const pd = dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : dy < 0 ? "up" : null;
        if (pd) await world.step(p, pd, { ms: 120 });
      }
    },
    warp: (map, x, y, dir) => world.transition(map, x, y, dir),
    setHeal: (map, x, y, dir) => { game.state.heal = { map, x, y, dir }; },
    toHeal: () => { const h = game.state.heal; return world.transition(h.map, h.x, h.y, h.dir); },
    async heal(anim) {
      game.state.lp = game.state.options.maxLP; updateHud();
      if (anim) { await UI.fade(true, 200, "#fff"); await sleep(250); await UI.fade(false, 300, "#fff"); UI.toast("LP restaurados: " + game.state.lp); }
    },
    giveStarter(key) {
      const s = STARTERS[key];
      game.state.deck = { main: ctx.idsOf(s.main), extra: ctx.idsOf(s.extra) };
      game.state.starterRevision = 3;
    },
    giveStarterKeys: (stage) => giveStarterKeys(game.state, stage, ctx.idOf),
    cardNames: (ids) => ids.map((id) => ctx.cards.get(id).name),
    giveCard: (name, n = 1) => addCard(ctx.idOf(name), n),
    cardName: (name) => ctx.cards.get(ctx.idOf(name)).name, // nombre en el idioma elegido
    weighted(list) { const tot = list.reduce((s, [, w]) => s + w, 0); let r = Math.random() * tot; for (const [n, w] of list) { r -= w; if (r <= 0) return n; } return list[0][0]; },
    async duel(opts) {
      const r = await runDuel(ctx, opts); updateHud();
      if (!r.error && !r.won && !opts.noBlackout) await SCRIPTS.blackout(api);
      if (!r.error && !r.won && opts.noBlackout && game.state.options.persistentLP) game.state.lp = 0;
      updateHud(); save();
      return r;
    },
    showStarter(key) {
      const s = STARTERS[key];
      const ids = [...new Set(ctx.idsOf(s.main))];
      const highlights = ids.filter((id) => ctx.cards.isMonster(id)).sort((a, b) => ctx.cards.get(b).atk - ctx.cards.get(a).atk).slice(0, 3)
        .concat(ids.filter((id) => !ctx.cards.isMonster(id)).slice(0, 3));
      showStarter(key, { spirit: ctx.idOf(s.spirit), highlights });
    },
    hideStarter,
    refresh: () => world.refreshDecos(),
    openDeckEditor: () => deckEditor(),
    openCardShop: (shopId) => cardShop(ctx, shopId),
  };
  return api;
}

// ---------------- HUD ----------------
function updateHud() {
  const h = document.getElementById("hud"); const st = game.state;
  if (!st.flags.hasDeck || !st.options.persistentLP) { h.hidden = true; return; }
  h.hidden = false; const pct = Math.max(0, Math.min(100, (st.lp / st.options.maxLP) * 100));
  h.innerHTML = `<span>LP ${st.lp}</span><div class="hud-bar"><div style="width:${pct}%;background:${pct > 50 ? "#4cd964" : pct > 20 ? "#ffcc00" : "#ff3b30"}"></div></div>`;
}

// ---------------- Título ----------------
function titleScreen() {
  return new Promise((resolve) => {
    const t = el("div", "title");
    const cont = hasSave();
    t.innerHTML = `<div class="t-logo"><div class="t-small">Proyecto fan</div><div class="t-big">DUEL SPIRITS</div><div class="t-sub">Ciudad Batalla</div></div>
      <div class="t-menu">${cont ? '<button class="btn" data-a="cont">Continuar</button>' : ""}<button class="btn" data-a="new">Nueva partida</button><button class="btn t-admin" data-a="admin">Editor de mazos (admin)</button></div>
      <div class="t-help">Flechas: mover · Z/Enter: A · X/Shift: B (correr) · Esc/M: menú</div>`;
    UI.root.appendChild(t);
    const go = (a) => { off(); t.remove(); resolve(a); };
    t.querySelectorAll("button").forEach((b) => (b.onclick = () => go(b.dataset.a)));
    const off = Input.push((b) => { if (b === "A") go(cont ? "cont" : "new"); });
  });
}

async function boot() {
  window.__booted = true;
  setupInput(); UI.init();
  const loading = document.getElementById("boot") || el("div", "loading", "<div class='l-text'>Cargando...</div>");
  if (!loading.parentNode) UI.root.appendChild(loading);
  try { await loadAll((t) => (loading.querySelector(".l-text").textContent = t)); }
  catch (e) { loading.innerHTML = `<div class="l-text err">${esc(e.message)}</div>`; console.error(e); return; }
  loading.remove(); window.__ready = true;

  const world = new WorldScene();
  const phaser = new Phaser.Game({
    type: Phaser.AUTO, parent: "game", width: 1280, height: 720, antialias: true, backgroundColor: "#05070d",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [world], fps: { target: 60 },
  });
  await new Promise((r) => (world.onReady = r));
  world.scripts = SCRIPTS; world.api = makeApi(world);
  window.__game = { world, ctx, game }; // para depurar desde la consola

  const dev = new URLSearchParams(location.search).get("dev");
  let choice = dev ? "dev" : await titleScreen();
  // Editor de mazos desde el título (D-45): al cerrarlo se vuelve al título.
  while (choice === "admin") { await openDeckBuilder(ctx, { mode: "admin", inGame: false }); choice = await titleScreen(); }
  if (choice === "dev") {
    wipe(); setPartidaLayer({}); const st = game.state; st.player = "Ren"; st.rival = "Leo";
    if (dev === "shop") { st.flags.canChoose = true; world.loadMap("shop", 7, 4, "up"); }
    else {
      // ?dev=town | route1 | verde | gym | yugi. &starter=gigobyte|timewizard cambia la inicial (por defecto Kuriboh).
      const starter = new URLSearchParams(location.search).get("starter") || "kuriboh";
      const rivalStarter = STARTER_ORDER.find((k) => STARTERS[k].beats === starter);
      st.flags = { hasDeck: true, rivalLeftShop: true, beat_rival: true, rivalStarter, ["taken_" + starter]: true, ["taken_" + rivalStarter]: true };
      st.starter = starter; world.api.giveStarter(starter); st.heal = { map: "shop", x: 7, y: 4, dir: "up" };
      if (dev === "verde" || dev === "gym") { st.flags.met_rival_verde = true; giveStarterKeys(st, 1, ctx.idOf); }
      const spot = { town: ["town", 10, 8, "up"], yugi: ["town", 12, 9, "right"], verde: ["verde", 10, 18, "up"], gym: ["gym_verde", 5, 11, "up"], leaders: ["gym_verde", 5, 11, "up"] }[dev] || ["route1", 10, 31, "up"];
      world.loadMap(...spot);
    }
  } else if (choice === "cont" && load()) {
    migrateSave(game.state);
    setPartidaLayer(game.state.deckOverrides);
    if (updateUntouchedStarter(game.state, ctx.idsOf, ctx.idOf)) { save(); UI.toast("Tu mazo inicial recibió el ajuste de balance."); }
    world.loadMap(game.state.map, game.state.x, game.state.y, game.state.dir);
  } else {
    wipe(); setPartidaLayer({});
    world.paused = true;
    await SCRIPTS.intro(world.api);
    world.loadMap("house2f", 4, 3, "down");
    world.paused = false;
    await UI.fade(false, 300);
  }
  updateHud();

  // Entrada del mundo (base de la pila)
  Input.push(async (b) => {
    if (UI.busy || world.scriptRunning) return;
    if (b === "A") world.interact();
    else if (b === "START") { world.scriptRunning = true; try { await startMenu(world.api); } finally { world.scriptRunning = false; updateHud(); } }
  });
  // Tiempo de juego y autoguardado suave
  setInterval(() => { game.state.playTime++; }, 1000);
}

boot();
