// Menús fuera del duelo: menú START, editor de baraja, tarjeta de duelista, opciones y vista de baraja inicial.
import { UI, el, esc } from "./ui.js";
import { Input } from "../input.js";
import { game, save, fmt } from "../state.js";
import { TYPE, ATTRIBUTE_NAMES, RACE_NAMES } from "../duel/cards.js";
import { cardClass, artUrl, hasArt } from "../duel/duelview.js";
import { STARTERS } from "../content/decks.js";
import { SPIRITS } from "../content/spirits.js";
import { openDeckBuilder } from "./deckbuilder.js";

let CARDS = null, CTX = null;
export function setMenuCards(cards, ctx) { CARDS = cards; CTX = ctx; }

function screen(title, cls = "") {
  UI.lock();
  const s = el("div", "screen " + cls); s.innerHTML = `<div class="s-head"><span>${esc(title)}</span><button class="btn ghost s-close">✕</button></div><div class="s-body"></div>`;
  UI.root.appendChild(s);
  const close = () => { s.remove(); UI.unlock(); };
  return { s, body: s.querySelector(".s-body"), closeBtn: s.querySelector(".s-close"), close };
}

export function miniCard(code, extra = "") {
  const c = CARDS.get(code); const e = el("div", "card " + cardClass(c) + " " + extra);
  const isMon = c.type & TYPE.MONSTER;
  e.innerHTML = `<div class="cname">${esc(c.name)}</div>` + (isMon ? `<div class="cstats">${c.atk}/${c.def}</div>` : `<div class="cicon">${c.type & TYPE.SPELL ? "M" : "T"}</div>`);
  if (hasArt(code)) { const img = new Image(); img.onload = () => { e.classList.add("art"); e.style.backgroundImage = `url(${artUrl(code)})`; }; img.src = artUrl(code); }
  return e;
}
export function detailHtml(code) {
  const c = CARDS.get(code); const isMon = c.type & TYPE.MONSTER;
  const line = isMon ? `${"★".repeat(Math.min(12, c.lv))} · ${ATTRIBUTE_NAMES[c.attribute] || ""} · ${RACE_NAMES[c.race] || ""}` : c.type & TYPE.SPELL ? "Carta Mágica" : "Carta de Trampa";
  return `<div class="dd-name">${esc(c.name)}</div><div class="dd-line">${line}</div>${isMon ? `<div class="dd-stats">ATK ${c.atk} · DEF ${c.def}</div>` : ""}<div class="dd-text">${esc(c.desc).replace(/\n/g, "<br>")}</div>`;
}

// ---------------- Menú START ----------------
export async function startMenu(api) {
  const opts = ["Baraja", "Tarjeta", "Guardar", "Opciones", "Mazos (admin)", "Salir"];
  const has = game.state.flags.hasDeck;
  const list = has ? opts : opts.filter((o) => o !== "Baraja");
  const i = await UI.choose(list, { cls: "startmenu", cancel: true });
  const pick = list[i];
  if (pick === "Baraja") await deckEditor();
  else if (pick === "Tarjeta") await trainerCard();
  else if (pick === "Guardar") { const ok = save(); await UI.say(ok ? "{PLAYER} guardó la partida." : "No se pudo guardar (el navegador bloquea el almacenamiento)."); }
  else if (pick === "Opciones") await optionsMenu();
  else if (pick === "Mazos (admin)") await openDeckBuilder(CTX, { mode: "admin", inGame: true });
}

// ---------------- Editor de baraja ----------------
// La baraja del jugador usa el editor completo (ui/deckbuilder.js) limitado a su colección.
export function deckEditor() { return openDeckBuilder(CTX, { mode: "player", inGame: true }); }

// ---------------- Tarjeta de duelista ----------------
export function trainerCard() {
  return new Promise((resolve) => {
    const st = game.state; const { body, closeBtn, close } = screen("Tarjeta de Duelista", "tcard");
    const found = Object.keys(st.spiritsBeaten).length;
    body.innerHTML = `<div class="tc">
      <div class="tc-row"><b>Nombre</b><span>${esc(st.player)}</span></div>
      <div class="tc-row"><b>Dinero</b><span>$${st.money}</span></div>
      <div class="tc-row"><b>Puntos de Vida</b><span>${st.options.persistentLP ? st.lp + " / " + st.options.maxLP : "Se recargan cada duelo"}</span></div>
      <div class="tc-row"><b>Baraja</b><span>${st.starter ? STARTERS[st.starter].title : "—"}</span></div>
      <div class="tc-row"><b>Espíritus vencidos</b><span>${found} / ${Object.keys(SPIRITS).length}</span></div>
      <div class="tc-row"><b>Duelos</b><span>${st.stats.wins} ganados · ${st.stats.losses} perdidos</span></div>
      <div class="tc-row"><b>Tarjetas Localizadoras</b><span>${st.locators.length} / 8</span></div>
    </div>`;
    const done = () => { off(); close(); resolve(); };
    closeBtn.onclick = done; const off = Input.push((b) => { if (b === "B" || b === "A" || b === "START") done(); });
  });
}

// ---------------- Opciones ----------------
export function optionsMenu() {
  return new Promise((resolve) => {
    const o = game.state.options; const { body, closeBtn, close } = screen("Opciones", "opts");
    const rows = [
      ["LP persistentes entre duelos", "persistentLP", [[true, "Sí"], [false, "No"]]],
      ["Velocidad del texto", "textSpeed", [[1, "Lenta"], [2, "Normal"], [3, "Rápida"]]],
      ["Velocidad de los duelos", "duelSpeed", [[1, "Lenta"], [2, "Normal"], [3, "Rápida"]]],
      ["Efectos de sonido", "sound", [[true, "Sí"], [false, "No"]]],
      ["Idioma de las cartas", "cardLang", [["es", "Español"], ["en", "Inglés"]]],
    ];
    const draw = () => {
      body.innerHTML = "";
      for (const [label, key, vals] of rows) {
        const r = el("div", "opt-row", `<span>${esc(label)}</span>`); const g = el("div", "opt-vals");
        for (const [v, name] of vals) { const b = el("button", "btn" + (o[key] === v ? " on" : ""), esc(name)); b.onclick = () => { o[key] = v; if (key === "persistentLP" && v && game.state.lp > o.maxLP) game.state.lp = o.maxLP; draw(); }; g.appendChild(b); }
        r.appendChild(g); body.appendChild(r);
      }
      body.appendChild(el("div", "opt-note", "Controles: flechas/WASD para moverte · Z/Espacio/Enter = A · X/Shift = B (correr) · Esc/M = menú."));
    };
    const done = () => { off(); close(); resolve(); };
    closeBtn.onclick = done; const off = Input.push((b) => { if (b === "B" || b === "START") done(); });
    draw();
  });
}

// ---------------- Vista de baraja inicial ----------------
let starterPanel = null;
export function showStarter(key, ids) {
  hideStarter();
  const s = STARTERS[key]; const p = el("div", "starter");
  const spiritId = ids.spirit;
  p.innerHTML = `<div class="st-head">${esc(s.title)}</div><div class="st-spirit"></div><div class="st-info"><div><b>Espíritu:</b> ${esc(CARDS.get(spiritId).name)}</div><div><b>Estilo:</b> ${esc(s.style)}</div><p>${esc(s.blurb)}</p></div><div class="st-cards"></div>`;
  p.querySelector(".st-spirit").appendChild(miniCard(spiritId, "big"));
  const box = p.querySelector(".st-cards"); for (const id of ids.highlights) box.appendChild(miniCard(id));
  UI.root.appendChild(p); starterPanel = p;
}
export function hideStarter() { if (starterPanel) { starterPanel.remove(); starterPanel = null; } }
