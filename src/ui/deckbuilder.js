// Editor de mazos (D-45), con Master Duel y EDOPro como referencia:
//   izquierda: la carta elegida en grande · centro: el mazo (Principal y Extra) · derecha: buscador con filtros.
// Dos modos con la misma pantalla:
//   "player": tu baraja de la partida, solo con las cartas de tu colección.
//   "admin": cualquier mazo del juego con todas las cartas del pool; se aplica en la partida o se fija en los archivos.
import { UI, el, esc } from "./ui.js";
import { Input } from "../input.js";
import { game, save, load, hasSave } from "../state.js";
import { TYPE, ATTRIBUTE_NAMES, RACE_NAMES } from "../duel/cards.js";
import { cardClass, artUrl, hasArt } from "../duel/duelview.js";
import { runDuel } from "../duel/session.js";
import { DECKBOOK, DECK_GROUPS, entry, currentDeck, codeDeck, fileDeck, deckSource, fileOverrides, setFileLayer, setPartidaLayer, sameDeck } from "../content/deckbook.js";

const PAGE = 90;
let POOL = null;          // ids del pool completo (data/pool.json), cargado al abrir el modo admin
let INDEX = null;         // datos de búsqueda por carta, armados una sola vez
let serverOk = null;      // ¿está el servidor local de JUGAR (Windows).bat? (para "Definir en el juego")
const lastFilters = {};   // los filtros se recuerdan entre aperturas, por modo

const SUB = {
  m: [["Normal", (t) => (t & TYPE.NORMAL) && !(t & TYPE.EFFECT)], ["Efecto", (t) => t & TYPE.EFFECT], ["Fusión", (t) => t & TYPE.FUSION], ["Ritual", (t) => t & TYPE.RITUAL],
    ["Volteo", (t) => t & TYPE.FLIP], ["Toon", (t) => t & TYPE.TOON], ["Espíritu", (t) => t & TYPE.SPIRIT], ["Unión", (t) => t & TYPE.UNION], ["Géminis", (t) => t & TYPE.GEMINI]],
  s: [["Normal", (t) => t === TYPE.SPELL], ["Rápida", (t) => t & TYPE.QUICKPLAY], ["Continua", (t) => t & TYPE.CONTINUOUS], ["Equipo", (t) => t & TYPE.EQUIP],
    ["Campo", (t) => t & TYPE.FIELD], ["Ritual", (t) => t & TYPE.RITUAL]],
  t: [["Normal", (t) => t === TYPE.TRAP], ["Continua", (t) => t & TYPE.CONTINUOUS], ["Contraataque", (t) => t & TYPE.COUNTER]],
};
const SORTS = [["type", "Tipo"], ["name", "Nombre"], ["atk", "ATK"], ["def", "DEF"], ["lv", "Nivel"]];
const blankFilters = () => ({ q: "", inText: false, kind: "", sub: [], attr: [], race: "", lvMin: "", lvMax: "", atkMin: "", atkMax: "", defMin: "", defMax: "", arch: "", sort: "type", desc: false, onlyDeck: false });

const kindOf = (c) => (c.type & TYPE.MONSTER ? "m" : c.type & TYPE.SPELL ? "s" : "t");
const kindRank = (c) => (c.type & TYPE.MONSTER ? (c.type & (TYPE.FUSION | TYPE.RITUAL) ? 1 : 0) : c.type & TYPE.SPELL ? 2 : 3);
const typeLine = (c) => {
  const t = c.type;
  if (t & TYPE.SPELL || t & TYPE.TRAP) {
    const base = t & TYPE.SPELL ? "Mágica" : "Trampa";
    const sub = SUB[t & TYPE.SPELL ? "s" : "t"].find(([n, f]) => n !== "Normal" && f(t));
    return sub ? `${base} ${sub[0]}` : `${base} Normal`;
  }
  const tags = SUB.m.filter(([n, f]) => n !== "Normal" && n !== "Efecto" && f(t)).map(([n]) => n);
  if (t & TYPE.EFFECT) tags.push("Efecto"); else if (t & TYPE.NORMAL) tags.push("Normal");
  return `${RACE_NAMES[c.race] || "?"} / ${tags.join(" / ")}`;
};

function info(ctx, id) {
  const idx = (INDEX ||= new Map()); let i = idx.get(id); if (i) return i;
  const c = ctx.cards.get(id); const raw = ctx.cards.raw[id] || [];
  const sets = []; let sc = c.setcode; while (sc > 0n) { sets.push(Number(sc & 0xffffn)); sc >>= 16n; }
  i = { id, c, k: kindOf(c), sets, en: String(raw[9] || "").toLowerCase(), enText: String(raw[10] || "").toLowerCase() };
  idx.set(id, i); return i;
}
// El nombre y el texto en español dependen del idioma elegido: se leen en el momento.
const nameL = (i) => i.c.name.toLowerCase() + "\n" + i.en;
const textL = (i) => i.c.desc.toLowerCase() + "\n" + i.enText;
const inArch = (i, s) => i.sets.some((sc) => (sc & 0xfff) === (s & 0xfff) && (sc & s & 0xf000) === (s & 0xf000));

function sortCompare(ctx, key, desc) {
  const by = {
    type: (a, b) => kindRank(a.c) - kindRank(b.c) || (b.c.lv || 0) - (a.c.lv || 0) || a.c.name.localeCompare(b.c.name),
    name: (a, b) => a.c.name.localeCompare(b.c.name),
    atk: (a, b) => (a.k === "m") - (b.k === "m") || a.c.atk - b.c.atk || a.c.name.localeCompare(b.c.name),
    def: (a, b) => (a.k === "m") - (b.k === "m") || a.c.def - b.c.def || a.c.name.localeCompare(b.c.name),
    lv: (a, b) => (a.k === "m") - (b.k === "m") || (a.c.lv || 0) - (b.c.lv || 0) || a.c.name.localeCompare(b.c.name),
  }[key];
  // "type" y "name" van de menor a mayor por defecto; ATK, DEF y Nivel, de mayor a menor (como en Master Duel).
  const flip = (key === "type" || key === "name") ? desc : !desc;
  return (a, b) => (flip ? -by(a, b) : by(a, b));
}

/** Arma la carta chica (con ilustración si existe, si no el marco con nombre y ATK/DEF). */
function tile(ctx, id, badge = "") {
  const c = ctx.cards.get(id); const isMon = c.type & TYPE.MONSTER;
  const t = el("div", "db-tile card " + cardClass(c));
  t.innerHTML = `<div class="cname">${esc(c.name)}</div>${isMon ? `<div class="cstats">${c.atk}/${c.def}</div>` : `<div class="cicon">${c.type & TYPE.SPELL ? "M" : "T"}</div>`}${badge}`;
  if (hasArt(id)) {
    const img = new Image(); img.loading = "lazy"; img.alt = ""; img.className = "db-art";
    img.onload = () => t.classList.add("art"); img.onerror = () => img.remove(); img.src = artUrl(id); t.prepend(img);
  }
  t.dataset.id = id; t.title = c.name;
  return t;
}

const toNames = (ctx, ids) => {
  const m = new Map(); for (const id of ids) { const n = ctx.cards.get(id).nameEn; m.set(n, (m.get(n) || 0) + 1); }
  return [...m.entries()];
};
const toIds = (ctx, list) => ctx.idsOf(list);

async function checkServer() {
  if (serverOk !== null) return serverOk;
  try { const r = await fetch("__admin/ping", { cache: "no-store" }); serverOk = r.ok && (await r.json()).ok === true; } catch { serverOk = false; }
  return serverOk;
}
async function loadPool(ctx) {
  if (POOL) return POOL;
  try {
    const r = await fetch("data/pool.json"); const raw = await r.json();
    const ids = (Array.isArray(raw) ? raw : Object.values(raw)).map(Number).filter((id) => ctx.cards.has(id));
    // Una sola entrada por carta: el id canónico (alias 0), como el resto del juego.
    POOL = [...new Set(ids.map((id) => ctx.byName[ctx.cards.get(id).nameEn] || id))];
  } catch { POOL = Object.keys(ctx.cards.raw).map(Number).filter((id) => !ctx.cards.get(id).alias); }
  return POOL;
}

/**
 * Abre el editor. Devuelve una promesa que se cumple al cerrarlo.
 * @param {any} ctx contexto del juego (cartas, motor, idOf...)
 * @param {{mode:"player"|"admin", inGame?:boolean, startKey?:string}} opts
 */
export async function openDeckBuilder(ctx, opts) {
  const admin = opts.mode === "admin";
  const st = game.state;
  UI.lock();
  const s = el("div", "screen deckbuilder" + (admin ? " admin" : ""));
  UI.root.appendChild(s);
  s.innerHTML = `<div class="s-head db-head"><div class="db-title"></div><button class="btn ghost s-close" aria-label="Cerrar">✕</button></div>
    <div class="db-body">
      <aside class="db-detail"><div class="db-empty">Elegí una carta para ver su texto.</div></aside>
      <section class="db-deck">
        <div class="db-bar"></div>
        <div class="db-zone db-main" data-zone="main"><div class="db-zlabel"></div><div class="db-grid"></div></div>
        <div class="db-zone db-extra" data-zone="extra"><div class="db-zlabel"></div><div class="db-grid"></div></div>
      </section>
      <section class="db-search">
        <div class="db-srow"><input class="tinput db-q" id="db-q" placeholder="Buscar carta..." autocomplete="off"><button class="btn ghost db-intext" title="Buscar también en el texto de la carta">Texto</button></div>
        <div class="db-kinds"></div>
        <div class="db-srow db-sortrow"><button class="btn ghost db-ftoggle">Filtros</button><select class="tinput db-sort" id="db-sort"></select><button class="btn ghost db-dir" title="Invertir el orden">↓</button></div>
        <div class="db-filters" hidden></div>
        <div class="db-count"></div>
        <div class="db-results"><div class="db-rgrid"></div></div>
      </section>
    </div>`;
  const $ = (q) => s.querySelector(q);
  s.addEventListener("keydown", (e) => { if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) e.stopPropagation(); });
  s.addEventListener("contextmenu", (e) => e.preventDefault());

  // ---------- Datos del mazo en edición ----------
  let key = admin ? (opts.startKey && entry(opts.startKey) ? opts.startKey : DECKBOOK[0].key) : null;
  let rules = admin ? entry(key).rules : { min: 40, max: 60, extraMax: 15, copies: 3 };
  let work, base, undo = [];
  // Modo partida: lo que tenés en total = colección + baraja.
  const owned = new Map();
  if (!admin) {
    for (const id of [...st.deck.main, ...st.deck.extra]) owned.set(id, (owned.get(id) || 0) + 1);
    for (const [id, n] of Object.entries(st.collection)) if (n > 0) owned.set(Number(id), (owned.get(Number(id)) || 0) + n);
  }
  const loadDeck = () => {
    if (admin) { const d = currentDeck(key); work = { main: toIds(ctx, d.main), extra: toIds(ctx, d.extra) }; rules = entry(key).rules; }
    else work = { main: [...st.deck.main], extra: [...st.deck.extra] };
    base = JSON.stringify(sorted(work)); undo = [];
  };
  const sorted = (w) => ({ main: [...w.main].sort((a, b) => a - b), extra: [...w.extra].sort((a, b) => a - b) });
  const dirty = () => JSON.stringify(sorted(work)) !== base;
  const countOf = (id) => work.main.filter((x) => x === id).length + work.extra.filter((x) => x === id).length;
  const zoneOf = (id) => (entry(key)?.hasExtra === false ? "main" : ctx.cards.isExtra(id) ? "extra" : "main");
  const remember = () => { undo.push(JSON.stringify(work)); if (undo.length > 80) undo.shift(); };

  const pool = admin ? await loadPool(ctx) : [...owned.keys()];
  const filters = (lastFilters[opts.mode] ||= blankFilters());

  function addCard(id, quiet) {
    const z = zoneOf(id), list = work[z];
    if (countOf(id) >= rules.copies) return quiet || UI.toast(`Máximo ${rules.copies} copias por carta`);
    if (!admin && countOf(id) >= (owned.get(id) || 0)) return quiet || UI.toast("No tenés más copias de esta carta");
    if (z === "main" && list.length >= rules.max) return quiet || UI.toast(`Máximo ${rules.max} cartas en el mazo`);
    if (z === "extra" && list.length >= rules.extraMax) return quiet || UI.toast(`Máximo ${rules.extraMax} cartas en el Deck Extra`);
    remember(); list.push(id); drawDeck(); drawResultsBadges(); select(id);
    return true;
  }
  function removeCard(id) {
    const z = work.main.includes(id) ? "main" : "extra"; const k = work[z].lastIndexOf(id); if (k < 0) return;
    remember(); work[z].splice(k, 1); drawDeck(); drawResultsBadges(); select(id);
  }

  // ---------- Cabecera ----------
  function drawHead() {
    const t = $(".db-title");
    if (!admin) { t.innerHTML = `<span>Tu baraja</span>`; return; }
    const e = entry(key); const src = deckSource(key);
    const badge = { codigo: ["Original", ""], archivos: ["Cambiado en el juego", "file"], partida: ["Cambiado en esta partida", "game"] }[src];
    t.innerHTML = `<span class="db-tag">Admin</span><select class="tinput db-pick" id="db-pick" aria-label="Mazo">${DECK_GROUPS.map((g) => `<optgroup label="${esc(g)}">${DECKBOOK.filter((x) => x.group === g).map((x) => `<option value="${x.key}"${x.key === key ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</optgroup>`).join("")}</select>
      <span class="db-src ${badge[1]}">${badge[0]}</span><span class="db-sub">${esc(e.sub)}</span>`;
    t.querySelector(".db-pick").onchange = async (ev) => {
      const next = ev.target.value;
      if (dirty() && !(await confirmBox("Tenés cambios sin guardar en este mazo. ¿Los descartás?", "Descartar", "Seguir editando"))) { ev.target.value = key; return; }
      key = next; loadDeck(); drawAll();
    };
  }

  // ---------- Barra de acciones y contadores ----------
  function drawBar() {
    const bar = $(".db-bar");
    const n = (k) => work.main.filter((id) => kindOf(ctx.cards.get(id)) === k).length;
    const okMain = work.main.length >= rules.min && work.main.length <= rules.max;
    const acts = admin
      ? [["undo", "Deshacer"], ["clear", "Vaciar"], ["restore", "Restaurar"], ["text", "Lista"], ["test", "Probar duelo"], ["game", "Aplicar en la partida"], ["file", "Definir en el juego"]]
      : [["undo", "Deshacer"], ["clear", "Vaciar"], ["text", "Lista"], ["done", "Listo"]];
    bar.innerHTML = `<div class="db-stats">
        <span class="db-total ${okMain ? "ok" : "bad"}" title="Mínimo ${rules.min}, máximo ${rules.max}">${work.main.length}<small>/${rules.min}${rules.max !== rules.min ? "–" + rules.max : ""}</small></span>
        <span class="db-k m">Monstruos <b>${n("m")}</b></span><span class="db-k s">Mágicas <b>${n("s")}</b></span><span class="db-k t">Trampas <b>${n("t")}</b></span>
        ${entry(key)?.hasExtra === false ? "" : `<span class="db-k x">Extra <b>${work.extra.length}</b></span>`}
        ${dirty() ? '<span class="db-dirty">Sin guardar</span>' : ""}
      </div>
      <div class="db-acts">${acts.map(([a, l]) => `<button class="btn ghost db-act${a === "file" || a === "done" ? " primary" : ""}" data-a="${a}"${a === "undo" && !undo.length ? " disabled" : ""}>${l}</button>`).join("")}</div>`;
    bar.querySelectorAll(".db-act").forEach((b) => (b.onclick = () => action(b.dataset.a)));
  }

  // ---------- Mazo ----------
  const deckOrder = (a, b) => { const A = info(ctx, a), B = info(ctx, b); return sortCompare(ctx, "type", false)(A, B) || a - b; };
  function drawDeck() {
    const one = entry(key)?.hasExtra === false;
    for (const z of ["main", "extra"]) {
      const zone = $(".db-" + z), grid = zone.querySelector(".db-grid");
      zone.hidden = z === "extra" && one;
      zone.querySelector(".db-zlabel").innerHTML = z === "main" ? (one ? `Cartas de esta etapa <b>${work.main.length}</b>` : `Deck Principal <b>${work.main.length}</b>`) : `Deck Extra <b>${work.extra.length}</b><small>/${rules.extraMax}</small>`;
      grid.innerHTML = "";
      const ids = [...work[z]].sort(deckOrder);
      if (!ids.length) grid.innerHTML = `<div class="db-hint">${z === "main" ? "Arrastrá cartas acá, o hacé doble clic o clic derecho en el buscador." : "Las Fusiones van acá."}</div>`;
      for (const id of ids) {
        const t = tile(ctx, id); t.draggable = true;
        t.onclick = () => select(id);
        t.ondblclick = () => removeCard(id);
        t.oncontextmenu = (e) => { e.preventDefault(); removeCard(id); };
        t.ondragstart = (e) => { e.dataTransfer.setData("text/plain", "rem:" + id); e.dataTransfer.effectAllowed = "move"; };
        if (id === selected) t.classList.add("sel");
        grid.appendChild(t);
      }
    }
    drawBar();
  }

  // ---------- Detalle ----------
  let selected = null;
  function select(id) {
    selected = id;
    const c = ctx.cards.get(id); const isMon = c.type & TYPE.MONSTER;
    const d = $(".db-detail");
    const have = admin ? null : owned.get(id) || 0;
    const stars = isMon ? `<span class="db-lv">${c.type & TYPE.MONSTER ? "★" + (c.lv || 0) : ""}</span>` : "";
    d.innerHTML = `<div class="db-big"></div>
      <div class="dd-name">${esc(c.name)}</div>${c.name !== c.nameEn ? `<div class="db-en">${esc(c.nameEn)}</div>` : ""}
      <div class="dd-line">${isMon ? `${stars} ${ATTRIBUTE_NAMES[c.attribute] || ""} · ` : ""}${esc(typeLine(c))}</div>
      ${isMon ? `<div class="dd-stats">ATK ${c.atk} · DEF ${c.def}</div>` : ""}
      <div class="db-qty"><button class="btn ghost db-minus" ${countOf(id) ? "" : "disabled"}>−</button><span>En el mazo <b>${countOf(id)}</b>/${rules.copies}${have !== null ? ` · tenés <b>${have}</b>` : ""}</span><button class="btn db-plus">+</button></div>
      <div class="db-text">${esc(c.desc).replace(/\n/g, "<br>")}</div>`;
    const big = tile(ctx, id); big.classList.add("db-bigcard"); d.querySelector(".db-big").appendChild(big);
    d.querySelector(".db-plus").onclick = () => addCard(id);
    d.querySelector(".db-minus").onclick = () => removeCard(id);
    s.querySelectorAll(".db-tile.sel").forEach((x) => x.classList.remove("sel"));
    s.querySelectorAll(`.db-grid .db-tile[data-id="${id}"], .db-results .db-tile[data-id="${id}"]`).forEach((x) => x.classList.add("sel"));
  }

  // ---------- Buscador ----------
  const q = $(".db-q"); q.value = filters.q;
  q.addEventListener("input", () => { filters.q = q.value; schedule(); });
  const inText = $(".db-intext");
  inText.onclick = () => { filters.inText = !filters.inText; inText.classList.toggle("on", filters.inText); schedule(); };
  inText.classList.toggle("on", filters.inText);
  const sortSel = $(".db-sort"); sortSel.innerHTML = SORTS.map(([v, l]) => `<option value="${v}">Orden: ${l}</option>`).join(""); sortSel.value = filters.sort;
  sortSel.onchange = () => { filters.sort = sortSel.value; schedule(0); };
  const dirBtn = $(".db-dir"); const drawDir = () => (dirBtn.textContent = filters.desc ? "↑" : "↓"); drawDir();
  dirBtn.onclick = () => { filters.desc = !filters.desc; drawDir(); schedule(0); };
  $(".db-ftoggle").onclick = () => { const f = $(".db-filters"); f.hidden = !f.hidden; $(".db-ftoggle").classList.toggle("on", !f.hidden); };

  function drawKinds() {
    const k = $(".db-kinds");
    k.innerHTML = [["", "Todas"], ["m", "Monstruos"], ["s", "Mágicas"], ["t", "Trampas"]].map(([v, l]) => `<button class="db-chip ${v}${filters.kind === v ? " on" : ""}" data-k="${v}">${l}</button>`).join("");
    k.querySelectorAll(".db-chip").forEach((b) => (b.onclick = () => { filters.kind = b.dataset.k; filters.sub = []; if (filters.kind !== "m" && filters.kind !== "") { filters.attr = []; filters.race = ""; } drawKinds(); drawFilters(); schedule(0); }));
  }
  // Arquetipos presentes en el pool, con su nombre en español (strings de EDOPro).
  let archList = null;
  const archs = () => {
    if (archList) return archList;
    const names = ctx.strings.setname || {}; const seen = new Set();
    for (const id of pool) for (const sc of info(ctx, id).sets) seen.add(sc);
    archList = [...seen].filter((sc) => names[sc]).map((sc) => [sc, names[sc]]).sort((a, b) => a[1].localeCompare(b[1]));
    return archList;
  };
  function drawFilters() {
    const f = $(".db-filters"); const kind = filters.kind;
    const subs = kind ? SUB[kind] : [];
    const mon = kind === "" || kind === "m";
    const range = (label, a, b, max) => `<label class="db-range"><span>${label}</span><input class="tinput" type="number" min="0" max="${max}" data-f="${a}" id="db-${a}" value="${filters[a]}" placeholder="mín"><input class="tinput" type="number" min="0" max="${max}" data-f="${b}" id="db-${b}" value="${filters[b]}" placeholder="máx"></label>`;
    f.innerHTML = `${subs.length ? `<div class="db-fl"><span>Subtipo</span><div class="db-chips">${subs.map(([n]) => `<button class="db-chip${filters.sub.includes(n) ? " on" : ""}" data-sub="${n}">${n}</button>`).join("")}</div></div>` : ""}
      ${mon ? `<div class="db-fl"><span>Atributo</span><div class="db-chips">${Object.entries(ATTRIBUTE_NAMES).map(([v, n]) => `<button class="db-chip${filters.attr.includes(Number(v)) ? " on" : ""}" data-attr="${v}">${n}</button>`).join("")}</div></div>
      <label class="db-fl"><span>Tipo de monstruo</span><select class="tinput" data-f="race" id="db-race"><option value="">Cualquiera</option>${Object.entries(RACE_NAMES).map(([v, n]) => `<option value="${v}"${String(filters.race) === v ? " selected" : ""}>${n}</option>`).join("")}</select></label>
      ${range("Nivel", "lvMin", "lvMax", 12)}${range("ATK", "atkMin", "atkMax", 5000)}${range("DEF", "defMin", "defMax", 5000)}` : ""}
      <label class="db-fl"><span>Arquetipo</span><input class="tinput" list="db-archs" data-f="arch" id="db-arch" value="${esc(filters.arch)}" placeholder="Ej.: Dragón Blanco de Ojos Azules"><datalist id="db-archs">${archs().map(([, n]) => `<option value="${esc(n)}"></option>`).join("")}</datalist></label>
      <label class="db-check"><input type="checkbox" data-f="onlyDeck" id="db-onlydeck"${filters.onlyDeck ? " checked" : ""}> Solo las que están en el mazo</label>
      <button class="btn ghost db-reset">Quitar filtros</button>`;
    f.querySelectorAll("[data-sub]").forEach((b) => (b.onclick = () => { const n = b.dataset.sub; filters.sub = filters.sub.includes(n) ? filters.sub.filter((x) => x !== n) : [...filters.sub, n]; b.classList.toggle("on"); schedule(0); }));
    f.querySelectorAll("[data-attr]").forEach((b) => (b.onclick = () => { const v = Number(b.dataset.attr); filters.attr = filters.attr.includes(v) ? filters.attr.filter((x) => x !== v) : [...filters.attr, v]; b.classList.toggle("on"); schedule(0); }));
    f.querySelectorAll("[data-f]").forEach((i) => i.addEventListener(i.type === "checkbox" || i.tagName === "SELECT" ? "change" : "input", () => { filters[i.dataset.f] = i.type === "checkbox" ? i.checked : i.value; schedule(); }));
    f.querySelector(".db-reset").onclick = () => { Object.assign(filters, blankFilters(), { sort: filters.sort, desc: filters.desc }); q.value = ""; inText.classList.remove("on"); drawKinds(); drawFilters(); schedule(0); };
    $(".db-ftoggle").textContent = activeFilterCount() ? `Filtros (${activeFilterCount()})` : "Filtros";
  }
  const activeFilterCount = () => filters.sub.length + filters.attr.length + ["race", "lvMin", "lvMax", "atkMin", "atkMax", "defMin", "defMax", "arch"].filter((k) => filters[k] !== "").length + (filters.onlyDeck ? 1 : 0);

  let results = [], shown = 0, timer = null;
  function schedule(ms = 140) { clearTimeout(timer); timer = setTimeout(runSearch, ms); }
  function runSearch() {
    const fq = filters.q.trim().toLowerCase();
    const num = (v) => (v === "" || v == null ? null : Number(v));
    const lvMin = num(filters.lvMin), lvMax = num(filters.lvMax), atkMin = num(filters.atkMin), atkMax = num(filters.atkMax), defMin = num(filters.defMin), defMax = num(filters.defMax);
    const archName = filters.arch.trim().toLowerCase();
    const arch = archName ? archs().find(([, n]) => n.toLowerCase() === archName)?.[0] ?? archs().find(([, n]) => n.toLowerCase().includes(archName))?.[0] ?? -1 : null;
    const subs = filters.kind ? SUB[filters.kind].filter(([n]) => filters.sub.includes(n)).map(([, f]) => f) : [];
    const ranged = lvMin !== null || lvMax !== null || atkMin !== null || atkMax !== null || defMin !== null || defMax !== null || filters.attr.length || filters.race !== "";
    const inDeck = filters.onlyDeck ? new Set([...work.main, ...work.extra]) : null;
    const out = [];
    for (const id of pool) {
      const i = info(ctx, id), c = i.c;
      if (filters.kind && i.k !== filters.kind) continue;
      if (inDeck && !inDeck.has(id)) continue;
      if (subs.length && !subs.some((f) => f(c.type))) continue;
      if (ranged) {
        if (i.k !== "m") continue;
        if (filters.attr.length && !filters.attr.includes(c.attribute)) continue;
        if (filters.race !== "" && c.race !== Number(filters.race)) continue;
        if (lvMin !== null && c.lv < lvMin) continue; if (lvMax !== null && c.lv > lvMax) continue;
        if (atkMin !== null && c.atk < atkMin) continue; if (atkMax !== null && c.atk > atkMax) continue;
        if (defMin !== null && c.def < defMin) continue; if (defMax !== null && c.def > defMax) continue;
      }
      if (arch !== null && (arch === -1 || !inArch(i, arch))) continue;
      if (fq && !nameL(i).includes(fq) && !(filters.inText && textL(i).includes(fq))) continue;
      out.push(i);
    }
    out.sort(sortCompare(ctx, filters.sort, filters.desc));
    results = out.map((i) => i.id); shown = 0;
    const box = $(".db-rgrid"); box.innerHTML = ""; $(".db-results").scrollTop = 0;
    $(".db-count").textContent = `${results.length.toLocaleString("es-AR")} carta${results.length === 1 ? "" : "s"}${admin ? "" : " en tu colección"}`;
    if (!results.length) box.innerHTML = `<div class="db-hint">${admin ? "Ninguna carta coincide con la búsqueda y los filtros." : pool.length ? "Ninguna carta de tu colección coincide." : "Todavía no tenés cartas. ¡Vencé espíritus en la hierba alta!"}</div>`;
    more();
    drawFilters();
  }
  function badgeFor(id) {
    const n = countOf(id);
    if (admin) return n ? `<span class="db-n">${n}</span>` : "";
    const left = (owned.get(id) || 0) - n;
    return `<span class="db-n${left ? "" : " zero"}">${left}</span>`;
  }
  function more() {
    const box = $(".db-rgrid"); box.querySelector(".db-more")?.remove();
    const end = Math.min(results.length, shown + PAGE);
    for (let k = shown; k < end; k++) {
      const id = results[k]; const t = tile(ctx, id, badgeFor(id)); t.draggable = true;
      if (!admin && (owned.get(id) || 0) - countOf(id) <= 0) t.classList.add("used");
      t.onclick = () => select(id);
      t.ondblclick = () => addCard(id);
      t.oncontextmenu = (e) => { e.preventDefault(); addCard(id); };
      t.ondragstart = (e) => { e.dataTransfer.setData("text/plain", "add:" + id); e.dataTransfer.effectAllowed = "copy"; };
      if (id === selected) t.classList.add("sel");
      box.appendChild(t);
    }
    shown = end;
    if (shown < results.length) { const m = el("div", "db-more", `Mostrando ${shown} de ${results.length}…`); box.appendChild(m); observer.observe(m); }
  }
  const observer = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { observer.disconnect(); more(); } }, { root: $(".db-results"), rootMargin: "200px" });
  function drawResultsBadges() {
    s.querySelectorAll(".db-results .db-tile").forEach((t) => {
      const id = Number(t.dataset.id); t.querySelector(".db-n")?.remove();
      const b = badgeFor(id); if (b) t.insertAdjacentHTML("beforeend", b);
      if (!admin) t.classList.toggle("used", (owned.get(id) || 0) - countOf(id) <= 0);
    });
  }

  // ---------- Arrastrar y soltar ----------
  const dropTarget = (zoneEl, fn) => {
    zoneEl.addEventListener("dragover", (e) => { e.preventDefault(); zoneEl.classList.add("over"); });
    zoneEl.addEventListener("dragleave", () => zoneEl.classList.remove("over"));
    zoneEl.addEventListener("drop", (e) => { e.preventDefault(); zoneEl.classList.remove("over"); const [op, id] = e.dataTransfer.getData("text/plain").split(":"); fn(op, Number(id)); });
  };
  dropTarget($(".db-deck"), (op, id) => { if (op === "add") addCard(id); });
  dropTarget($(".db-search"), (op, id) => { if (op === "rem") removeCard(id); });

  // ---------- Ventanitas dentro del editor ----------
  function modal(html, cls = "") {
    const m = el("div", "db-modal " + cls); m.innerHTML = `<div class="db-mbox">${html}</div>`; s.appendChild(m);
    m.addEventListener("pointerdown", (e) => { if (e.target === m) m.remove(); });
    return m;
  }
  function confirmBox(text, yes, no) {
    return new Promise((res) => {
      const m = modal(`<p>${esc(text)}</p><div class="db-mrow"><button class="btn ghost" data-r="0">${esc(no)}</button><button class="btn" data-r="1">${esc(yes)}</button></div>`);
      m.querySelectorAll("[data-r]").forEach((b) => (b.onclick = () => { m.remove(); res(b.dataset.r === "1"); }));
    });
  }
  function infoBox(title, text) {
    const m = modal(`<h3>${esc(title)}</h3><p>${text}</p><div class="db-mrow"><button class="btn">Entendido</button></div>`);
    m.querySelector(".btn").onclick = () => m.remove();
  }

  // ---------- Lista en texto (exportar e importar) ----------
  const listText = () => {
    const line = (ids) => toNames(ctx, [...ids].sort(deckOrder)).map(([n, k]) => `${k} ${n}`).join("\n");
    return `#main\n${line(work.main)}${work.extra.length ? `\n#extra\n${line(work.extra)}` : ""}\n`;
  };
  function parseList(text) {
    const byLower = new Map(); for (const id of pool) { const i = info(ctx, id); byLower.set(i.en, id); byLower.set(i.c.name.toLowerCase(), id); }
    const out = [], unknown = [];
    for (let raw of text.split(/\r?\n/)) {
      raw = raw.trim(); if (!raw || raw.startsWith("#") || raw.startsWith("!") || raw.startsWith("//")) continue;
      let qty = 1, name = raw, m;
      if ((m = raw.match(/^(\d+)\s*[x×]?\s+(.+)$/i))) { qty = Number(m[1]); name = m[2]; }
      else if ((m = raw.match(/^(.+?)\s+[x×]\s*(\d+)$/i))) { qty = Number(m[2]); name = m[1]; }
      let id = /^\d+$/.test(raw) && ctx.cards.has(Number(raw)) ? Number(raw) : byLower.get(name.trim().toLowerCase());
      if (id && ctx.cards.get(id).alias) id = ctx.byName[ctx.cards.get(id).nameEn] || id;
      if (!id || !pool.includes(id)) { unknown.push(raw); continue; }
      for (let k = 0; k < Math.min(qty, 3); k++) out.push(id);
    }
    return { ids: out, unknown };
  }
  function textModal() {
    const m = modal(`<h3>Lista del mazo</h3><p class="db-mnote">Copiala para guardarla o pegá una lista para reemplazar el mazo. Acepta “3 Kuriboh”, “Kuriboh x3”, un nombre por línea o un archivo .ydk de EDOPro.</p>
      <textarea class="tinput db-ta" id="db-ta" spellcheck="false"></textarea><div class="db-mrow"><button class="btn ghost" data-a="copy">Copiar</button>${admin ? '<button class="btn" data-a="load">Reemplazar el mazo con esta lista</button>' : ""}<button class="btn ghost" data-a="close">Cerrar</button></div><div class="db-merr"></div>`, "wide");
    const ta = m.querySelector("textarea"); ta.value = listText();
    m.querySelector('[data-a="close"]').onclick = () => m.remove();
    m.querySelector('[data-a="copy"]').onclick = async () => {
      try { await navigator.clipboard.writeText(ta.value); UI.toast("Lista copiada"); } catch { ta.select(); UI.toast("Seleccionada: copiala con Ctrl+C"); }
    };
    const loadBtn = m.querySelector('[data-a="load"]');
    if (loadBtn) loadBtn.onclick = () => {
      const { ids, unknown } = parseList(ta.value);
      if (!ids.length) { m.querySelector(".db-merr").textContent = "No encontré ninguna carta del pool en esa lista."; return; }
      remember(); work = { main: [], extra: [] };
      let skipped = 0; for (const id of ids) { const z = zoneOf(id); if (countOf(id) < rules.copies && work[z].length < (z === "main" ? rules.max : rules.extraMax)) work[z].push(id); else skipped++; }
      drawDeck(); drawResultsBadges(); m.remove();
      if (unknown.length) infoBox("Lista cargada con avisos", `No encontré ${unknown.length} línea${unknown.length > 1 ? "s" : ""} en el pool:<br><br>${unknown.slice(0, 12).map(esc).join("<br>")}${unknown.length > 12 ? "<br>…" : ""}`);
      else UI.toast(skipped ? `Lista cargada (${skipped} copias de más quedaron afuera)` : "Lista cargada");
    };
  }

  // ---------- Guardar ----------
  const workNames = () => ({ main: toNames(ctx, work.main), extra: toNames(ctx, work.extra) });
  // La partida: dentro del juego es la que está abierta; desde el título, la partida guardada.
  function partida() {
    if (opts.inGame) return game.state;
    if (hasSave() && load()) return game.state;
    return null;
  }
  function applyToGame() {
    if (work.main.length < rules.min) return infoBox("Faltan cartas", `Este mazo necesita al menos ${rules.min} cartas para usarse en un duelo.`);
    const p = partida(); if (!p) return infoBox("No hay partida guardada", "Empezá o cargá una partida para aplicar el mazo ahí, o usá “Definir en el juego”.");
    p.deckOverrides ||= {};
    const d = workNames();
    if (sameDeck(d, fileDeck(key))) delete p.deckOverrides[key]; else p.deckOverrides[key] = d;
    setPartidaLayer(p.deckOverrides); save();
    base = JSON.stringify(sorted(work)); drawHead(); drawBar();
    UI.toast("Aplicado en tu partida guardada");
  }
  async function defineInFiles() {
    if (work.main.length < rules.min) return infoBox("Faltan cartas", `Este mazo necesita al menos ${rules.min} cartas para usarse en un duelo.`);
    if (!(await checkServer())) return infoBox("Solo jugando en tu compu", "“Definir en el juego” escribe el mazo en los archivos del juego, y eso solo se puede con el juego abierto desde <b>JUGAR (Windows).bat</b>.<br><br>Desde el link podés usar “Aplicar en la partida” para probarlo.");
    const d = workNames(); const all = fileOverrides();
    if (sameDeck(d, codeDeck(key))) delete all[key]; else all[key] = d;
    const btns = s.querySelectorAll(".db-act"); btns.forEach((b) => (b.disabled = true)); UI.toast("Guardando en los archivos del juego...");
    let r;
    try { r = await (await fetch("__admin/decks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ overrides: all }) })).json(); }
    catch (e) { r = { ok: false, error: e.message }; }
    if (!r.ok) { drawBar(); return infoBox("No se pudo guardar", esc(r.error || "Error desconocido")); }
    setFileLayer(all);
    // Fijado en el juego: la partida deja de pisarlo.
    const p = opts.inGame ? game.state : (hasSave() && load() ? game.state : null);
    if (p?.deckOverrides?.[key]) { delete p.deckOverrides[key]; save(); }
    setPartidaLayer(p?.deckOverrides);
    base = JSON.stringify(sorted(work)); drawHead(); drawBar();
    infoBox("Mazo definido en el juego", `Quedó guardado en los archivos del juego.${r.scripts?.ok === false ? `<br><br>Ojo: no pude bajar los efectos de alguna carta nueva (${esc(r.scripts.detail || "")}). Avisale a Claude.` : ""}<br><br>Para que se vea en el link público, hacé doble clic en <b>PUBLICAR (Windows).bat</b>.`);
  }
  async function restoreModal() {
    const src = deckSource(key);
    const m = modal(`<h3>Restaurar</h3><div class="db-mcol">
      <button class="btn ghost" data-r="current">Descartar lo que no guardé</button>
      ${src !== "codigo" ? '<button class="btn ghost" data-r="code">Cargar el mazo original del código</button>' : ""}
      ${src === "partida" ? '<button class="btn ghost" data-r="unpartida">Quitar el cambio de la partida</button>' : ""}
      </div><p class="db-mnote">Cargar el original solo lo pone en el editor: después elegí dónde guardarlo.</p><div class="db-mrow"><button class="btn ghost" data-r="x">Cancelar</button></div>`);
    m.querySelectorAll("[data-r]").forEach((b) => (b.onclick = () => {
      m.remove(); const r = b.dataset.r;
      if (r === "current") { loadDeck(); drawAll(); }
      if (r === "code") { remember(); const d = codeDeck(key); work = { main: toIds(ctx, d.main), extra: toIds(ctx, d.extra) }; drawDeck(); drawResultsBadges(); }
      if (r === "unpartida") { const p = partida(); if (p?.deckOverrides) { delete p.deckOverrides[key]; setPartidaLayer(p.deckOverrides); save(); } loadDeck(); drawAll(); UI.toast("Se quitó el cambio de la partida"); }
    }));
  }

  // ---------- Duelo de prueba ----------
  function testModal() {
    if (work.main.length < Math.min(rules.min, 20)) return infoBox("Faltan cartas", "Agregá más cartas antes de probar el mazo.");
    const hasMine = st.deck.main.length >= 40;
    const decks = DECKBOOK.filter((e) => e.hasExtra !== false && e.key !== key);
    const defLP = key.startsWith("spirit:") ? parseInt(entry(key).sub, 10) || 8000 : 8000;
    const m = modal(`<h3>Probar ${esc(entry(key).name)}</h3><p class="db-mnote">El rival usa el mazo tal como está en el editor, aunque no lo hayas guardado. No da premios ni cambia tus LP.</p>
      <label class="db-fl"><span>Tu mazo</span><select class="tinput" id="db-mine">${hasMine ? '<option value="">Mi baraja de la partida</option>' : ""}${DECK_GROUPS.map((g) => { const xs = decks.filter((x) => x.group === g); return xs.length ? `<optgroup label="${esc(g)}">${xs.map((x) => `<option value="${x.key}">${esc(x.name)}</option>`).join("")}</optgroup>` : ""; }).join("")}</select></label>
      <label class="db-fl"><span>LP del rival</span><input class="tinput" type="number" id="db-lp" min="100" max="16000" step="100" value="${defLP}"></label>
      <label class="db-fl"><span>Nivel de la IA rival</span><select class="tinput" id="db-skill"><option value="0.4">Fácil</option><option value="0.7" selected>Normal</option><option value="0.9">Difícil</option></select></label>
      <label class="db-check"><input type="checkbox" id="db-auto"> Que la IA juegue también por mí (para mirar)</label>
      <div class="db-mrow"><button class="btn ghost" data-a="x">Cancelar</button><button class="btn" data-a="go">¡Duelo!</button></div>`);
    m.querySelector('[data-a="x"]').onclick = () => m.remove();
    m.querySelector('[data-a="go"]').onclick = async () => {
      const mine = m.querySelector("#db-mine").value, lp = Math.max(100, Number(m.querySelector("#db-lp").value) || 8000);
      const skill = Number(m.querySelector("#db-skill").value), auto = m.querySelector("#db-auto").checked;
      m.remove();
      const saved = { deck: st.deck, lp: st.lp };
      if (mine) { const d = entry(mine).read(); st.deck = { main: toIds(ctx, d.main), extra: toIds(ctx, d.extra) }; }
      s.hidden = true; offInput();
      try { await runDuel(ctx, { kind: "test", name: entry(key).name.split(" · ")[0], deck: workNames(), lp, skill, money: 0, noRewards: true, autoPlayer: auto }); }
      catch (e) { console.error(e); UI.toast("El duelo falló: " + e.message); }
      finally { st.deck = saved.deck; st.lp = saved.lp; s.hidden = false; offInput = Input.push(onKey); }
    };
  }

  // ---------- Acciones ----------
  async function action(a) {
    if (a === "undo" && undo.length) { work = JSON.parse(undo.pop()); drawDeck(); drawResultsBadges(); if (selected) select(selected); }
    if (a === "clear" && work.main.length + work.extra.length && (await confirmBox("¿Sacar todas las cartas del mazo?", "Vaciar", "Cancelar"))) { remember(); work = { main: [], extra: [] }; drawDeck(); drawResultsBadges(); }
    if (a === "restore") restoreModal();
    if (a === "text") textModal();
    if (a === "test") testModal();
    if (a === "game") applyToGame();
    if (a === "file") defineInFiles();
    if (a === "done") tryClose();
  }

  function drawAll() { drawHead(); drawDeck(); drawKinds(); runSearch(); if (selected && ctx.cards.has(selected)) select(selected); }

  // ---------- Cerrar ----------
  let resolveClose;
  const closed = new Promise((r) => (resolveClose = r));
  async function tryClose() {
    if (s.querySelector(".db-modal")) { s.querySelectorAll(".db-modal").forEach((m) => m.remove()); return; }
    if (!admin) {
      if (work.main.length < rules.min) return UI.toast(`Tu baraja necesita al menos ${rules.min} cartas`);
      // La colección es lo que tenés menos lo que quedó en la baraja.
      const left = new Map(owned); for (const id of [...work.main, ...work.extra]) left.set(id, left.get(id) - 1);
      st.deck = { main: [...work.main], extra: [...work.extra] };
      st.collection = Object.fromEntries([...left.entries()].filter(([, n]) => n > 0));
    } else if (dirty() && !(await confirmBox("Tenés cambios sin guardar en este mazo. ¿Salís igual?", "Salir sin guardar", "Seguir editando"))) return;
    observer.disconnect(); offInput(); s.remove(); UI.unlock(); resolveClose();
  }
  const onKey = (b) => { if (b === "START") tryClose(); };
  let offInput = Input.push(onKey);
  $(".s-close").onclick = tryClose;

  loadDeck(); drawAll();
  if (!admin && st.deck.main.length) select([...st.deck.main].sort(deckOrder)[0]);
  if (admin) checkServer();
  return closed;
}
