// Pantalla de duelo (HTML): dibuja el campo consultando al motor, anima los eventos
// y resuelve las decisiones del jugador humano.
import { OcgMessageType as M } from "../ocg/type_message.js";
import { OcgResponseType as R, SelectIdleCMDAction as IDLE, SelectBattleCMDAction as BATTLE } from "../ocg/type_response.js";
import { OcgLocation as L } from "../ocg/type_core.js";
import { cardMatchesOpcode } from "../ocg/opcodes.js";
import { isSelect } from "./runner.js";
import { DuelAI } from "./ai.js";
import { TYPE, ATTRIBUTE_NAMES, RACE_NAMES } from "./cards.js";
import { Input } from "../input.js";
import { el, esc, sleep } from "../ui/ui.js";
import { game } from "../state.js";
import { Sfx } from "../sfx.js";

const Q_FLAGS = 0x1 | 0x2 | 0x8 | 0x10 | 0x40 | 0x80 | 0x100 | 0x200 | 0x20000; // código, posición, tipo, nivel, atributo, raza, ATK, DEF, contadores
const PHASES = { 0x01: "Robo", 0x02: "Espera", 0x04: "Principal 1", 0x08: "Batalla", 0x10: "Batalla", 0x20: "Batalla", 0x40: "Batalla", 0x80: "Batalla", 0x100: "Principal 2", 0x200: "Final" };
const PHASE_TRACK = [["dp", "Robo"], ["sp", "Espera"], ["m1", "Principal 1"], ["bp", "Batalla"], ["m2", "Principal 2"], ["ep", "Final"]];
const PHASE_KEY = { 0x01: "dp", 0x02: "sp", 0x04: "m1", 0x08: "bp", 0x10: "bp", 0x20: "bp", 0x40: "bp", 0x80: "bp", 0x100: "m2", 0x200: "ep" };
const PHASE_BANNER = { 0x01: "Fase de Robo", 0x04: "Fase Principal 1", 0x08: "Fase de Batalla", 0x100: "Fase Principal 2", 0x200: "Fase Final" };
const PHASE_OF_BUTTON = { "Fase de Batalla": "bp", "Fase Principal 2": "m2", "Terminar turno": "ep" };
const REASON_DESTROY = 0x1, REASON_RELEASE = 0x2;
const SOUND_OF = { [M.NEW_TURN]: "turn", [M.DRAW]: "draw", [M.SHUFFLE_DECK]: "shuffle", [M.SUMMONING]: "summon", [M.SPSUMMONING]: "spsummon", [M.FLIPSUMMONING]: "flip",
  [M.CHAINING]: "activate", [M.CHAIN_NEGATED]: "negate", [M.CHAIN_DISABLED]: "negate", [M.BECOME_TARGET]: "target", [M.SET]: "set", [M.ATTACK]: "attack",
  [M.DAMAGE]: "damage", [M.PAY_LPCOST]: "damage", [M.RECOVER]: "heal", [M.TOSS_COIN]: "coin", [M.TOSS_DICE]: "coin" };
const POS_NAMES = { 0x1: "Ataque boca arriba", 0x2: "Ataque boca abajo", 0x4: "Defensa boca arriba", 0x8: "Defensa boca abajo" };

// Disponibilidad de arte local (assets/cards/<id>.jpg)
const artCache = new Map();
export const ART = { available: null }; // Set de ids con arte local (assets/cards/manifest.json)
export function artUrl(code) { return `assets/cards/${code}.jpg`; }
export function hasArt(code) { return !!ART.available && ART.available.has(Number(code)); }
function probeArt(code) {
  if (!hasArt(code)) return Promise.resolve(false);
  if (artCache.has(code)) return artCache.get(code);
  const p = new Promise((res) => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = artUrl(code); });
  artCache.set(code, p); return p;
}
export function cardClass(c) {
  if (!c) return "";
  const t = c.type;
  if (t & TYPE.TOKEN) return "token"; if (t & TYPE.SPELL) return "spell"; if (t & TYPE.TRAP) return "trap";
  if (t & TYPE.FUSION) return "fusion"; if (t & TYPE.RITUAL) return "ritual"; if (t & TYPE.SYNCHRO) return "synchro";
  if (t & TYPE.XYZ) return "xyz"; if (t & TYPE.LINK) return "link"; if (t & TYPE.EFFECT) return "effect"; return "normal";
}

export class DuelView {
  /** @param {{root:HTMLElement, cards:any, strings:any, names:[string,string], me:number, spiritArt?:string}} o */
  constructor(o) {
    Object.assign(this, o);
    this.helper = new DuelAI({ cards: o.cards });
    this.hintText = ""; this.logLines = []; this.phase = 0; this.turnPlayer = 0;
    this.build();
  }

  // ---------------- Estructura ----------------
  build() {
    const r = this.root; r.innerHTML = "";
    this.scr = el("div", "duel"); r.appendChild(this.scr);
    const bar = (side) => `<div class="d-bar ${side}"><span class="d-name"></span><span class="d-lp"></span><div class="d-lpbar"><div class="d-lpfill"></div></div></div>`;
    this.scr.innerHTML = `
      <div class="d-side">
        <div class="d-detail"><div class="d-empty">Tocá una carta para ver su texto</div></div>
        <div class="d-log"></div>
      </div>
      <div class="d-main">
        <div class="d-hand opp"></div>
        <div class="d-field"><div class="d-mat">
          <div class="d-row opp st"></div><div class="d-row opp mz"></div>
          <div class="d-mid"></div>
          <div class="d-row me mz"></div><div class="d-row me st"></div>
        </div></div>
        <div class="d-hand me"></div>
        ${bar("opp")}${bar("me")}
        <div class="d-phases"><div class="d-turn"></div>${PHASE_TRACK.map(([k, n]) => `<button class="ph" data-p="${k}">${n}</button>`).join("")}</div>
        <button class="d-undo" title="Volver a tu decisión anterior (solo para probar)" disabled>↩ Deshacer</button>
        <button class="d-chainmode" title="Cuándo preguntarte si querés activar cartas en respuesta"></button>
        <div class="d-instr" hidden></div>
      </div>
      <div class="d-toasts"></div>
      <div class="d-prompt" hidden></div>
      <div class="d-banner" hidden></div>`;
    this.q = (s) => this.scr.querySelector(s);
    this.q(".d-bar.opp .d-name").textContent = this.names[1];
    this.q(".d-bar.me .d-name").textContent = this.names[0];
    this.lpMax = [8000, 8000];
    this.chainLinks = []; this.dying = new Set(); this.oppActed = false;
    this.q(".d-undo").onclick = () => this.undoNow?.();
    // Clic derecho: atrás (cierra el visor o el menú, o cancela / no activa)
    this.scr.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (this.viewer) { this.closeViewer(); Sfx.play("cancel"); return; }
      if (this.menuEl) { this.closeMenu(); Sfx.play("cancel"); return; }
      const b = this.scr.querySelector(".d-prompt:not([hidden]) .btn.ghost, .d-instr:not([hidden]) .btn.ghost"); if (b) { Sfx.play("cancel"); b.click(); }
    });
    // La rueda desplaza el texto de la carta desde cualquier parte de la pantalla
    this.scr.addEventListener("wheel", (e) => { if (e.target.closest(".plist, .d-log")) return; this.q(".d-detail").scrollTop += e.deltaY; }, { passive: true });
    this.scr.addEventListener("click", (e) => { if (e.target.closest(".btn, .ph.go")) Sfx.play("click"); }, true);
    // Como el botón de cadena de Master Duel: Auto pregunta solo cuando el rival hizo algo.
    const cm = this.q(".d-chainmode"); const modes = ["smart", "always", "never"], labels = { smart: "Auto", always: "Siempre", never: "No" };
    const drawCm = () => { const v = game.state.options.askChain || "smart"; cm.textContent = "Responder: " + labels[v]; cm.dataset.mode = v; };
    cm.onclick = () => { const o = game.state.options; o.askChain = modes[(modes.indexOf(o.askChain || "smart") + 1) % 3]; drawCm(); };
    drawCm();
  }
  destroy() { this.root.innerHTML = ""; }

  // ---------------- Lectura del estado ----------------
  team(side) { return side === "me" ? this.me : 1 - this.me; }
  snapshot() {
    const d = this.runner.duel; const S = {};
    for (const side of ["me", "opp"]) {
      const t = this.team(side);
      S[side] = {
        mz: d.queryLocation(t, L.MZONE, Q_FLAGS), st: d.queryLocation(t, L.SZONE, Q_FLAGS), hand: d.queryLocation(t, L.HAND, Q_FLAGS),
        grave: d.queryLocation(t, L.GRAVE, 0x1), removed: d.queryLocation(t, L.REMOVED, 0x1 | 0x2), extra: d.queryLocation(t, L.EXTRA, 0x1 | 0x2),
        deck: d.count(t, L.DECK), lp: this.runner.lp[t],
      };
    }
    return S;
  }

  // ---------------- Dibujo ----------------
  render() {
    if (!this.runner?.duel?.ptr) return;
    const S = this.snapshot(); this.S = S;
    for (const side of ["me", "opp"]) {
      const s = S[side]; const mine = side === "me";
      // Zonas de monstruo (5) y de mágicas/trampas (5) + campo y pilas
      const mz = this.q(`.d-row.${side}.mz`); mz.innerHTML = "";
      const st = this.q(`.d-row.${side}.st`); st.innerHTML = "";
      const order = mine ? [0, 1, 2, 3, 4] : [4, 3, 2, 1, 0];
      // Fila de monstruos: [campo] m m m m m [cementerio]
      mz.appendChild(this.slot(s.st[5], side, L.SZONE, 5, "field"));
      for (const i of order) mz.appendChild(this.slot(s.mz[i], side, L.MZONE, i));
      mz.appendChild(this.pile("Cementerio", s.grave, side, L.GRAVE, "grave"));
      // Fila de mágicas: [extra] s s s s s [deck]
      st.appendChild(this.pile("Extra", s.extra, side, L.EXTRA, "extra"));
      for (const i of order) st.appendChild(this.slot(s.st[i], side, L.SZONE, i));
      const deckEl = el("div", "slot pile deck", `${s.deck ? '<div class="cback"></div>' : ""}<span class="pcount">${s.deck}</span>`); deckEl.title = "Deck"; st.appendChild(deckEl);
      // Desterradas (contador junto al cementerio)
      if (s.removed.filter(Boolean).length) { const b = el("span", "removed-count", `🚫${s.removed.filter(Boolean).length}`); mz.lastChild.appendChild(b); b.onclick = (e) => { e.stopPropagation(); this.viewList("Desterradas", s.removed.filter(Boolean), side); }; }
      // Mano (se superpone cuando hay muchas cartas)
      const h = this.q(`.d-hand.${side}`); h.innerHTML = ""; h.style.setProperty("--n", s.hand.filter(Boolean).length);
      s.hand.forEach((c, i) => { if (!c) return; const ce = mine ? this.cardEl(c, side, L.HAND, i) : el("div", "card back"); h.appendChild(ce); });
      // LP
      const t = this.team(side); const lp = s.lp; this.lpMax[t] = Math.max(this.lpMax[t], lp);
      this.setLP(side, lp);
      this.q(`.d-bar.${side} .d-lpfill`).style.width = Math.max(0, Math.min(100, (lp / this.lpMax[t]) * 100)) + "%";
    }
    this.scr.style.setProperty("--k", String(1 / this.speed()));
    this.q(".d-turn").textContent = this.runner.turn ? `Turno ${this.runner.turn}` : "";
    const ph = this.q(".d-phases"); ph.classList.toggle("mine", this.turnPlayer === this.me); ph.classList.toggle("theirs", this.turnPlayer !== this.me);
    for (const b of ph.querySelectorAll(".ph")) b.classList.toggle("on", b.dataset.p === PHASE_KEY[this.phase]);
    // Números de cadena sobre las cartas que la forman
    for (const k of this.chainLinks) { const e = this.node(k.loc); if (e) e.appendChild(el("span", "chainno", String(k.n))); }
    this.decorate();
  }

  slot(c, side, loc, seq, extraCls = "") {
    const s = el("div", "slot " + extraCls);
    if (c && c.code !== undefined && c.position) {
      s.appendChild(this.cardEl(c, side, loc, seq));
      // ATK/DEF actuales al pie de cada monstruo boca arriba
      if (loc === L.MZONE && c.position & 0x5) {
        const base = this.cards.get(c.code) || {}; const cls = (v, b) => (b >= 0 && v > b ? "up" : b >= 0 && v < b ? "down" : "");
        const atk = c.attack ?? base.atk ?? 0, def = c.defense ?? base.def ?? 0, inDef = !!(c.position & 0xC);
        s.appendChild(el("div", "zstat", `<i class="${inDef ? "" : "act"} ${cls(atk, base.atk)}">${atk}</i><i> / </i><i class="${inDef ? "act" : ""} ${cls(def, base.def)}">${def}</i>`));
      }
    }
    s.dataset.loc = loc; s.dataset.seq = seq; s.dataset.side = side;
    return s;
  }
  pile(label, list, side, loc, cls) {
    const cards = list.filter(Boolean);
    const p = el("div", "slot pile " + cls); p.title = label + " (tocá para ver las cartas)";
    const top = cards[cards.length - 1];
    const open = () => { if (loc === L.EXTRA && side !== "me") return; this.viewList(`${label}${side === "me" ? "" : " del rival"}`, cards, side); };
    if (top && (loc !== L.EXTRA || side === "me")) { const ce = this.cardEl({ ...this.cards.get(top.code), code: top.code, position: 1 }, side, loc, cards.length - 1, true); ce.addEventListener("click", open); p.appendChild(ce); }
    else if (top) p.appendChild(el("div", "card back"));
    p.appendChild(el("span", "pcount", String(cards.length)));
    p.onclick = open;
    return p;
  }

  cardEl(q, side, loc, seq, mini = false) {
    const data = this.cards.get(q.code) || { name: "?", type: 0 };
    const faceDown = q.position && (q.position & 0xA) && loc !== L.HAND && !(q.position & 0x5);
    const hiddenFromMe = faceDown && side !== "me";
    const e = el("div", "card " + (hiddenFromMe ? "back" : cardClass(data)));
    if (q.position & 0xC && loc === L.MZONE) e.classList.add("def");
    if (faceDown && !hiddenFromMe) e.classList.add("fd");
    if (!hiddenFromMe) {
      const atk = q.attack ?? data.atk, def = q.defense ?? data.def;
      const isMon = data.type & TYPE.MONSTER;
      e.innerHTML = `<div class="cname">${esc(data.name)}</div>` + (isMon ? `<div class="cstats">${atk < 0 ? "?" : atk}/${def < 0 ? "?" : def}</div>` : `<div class="cicon">${data.type & TYPE.SPELL ? "M" : "T"}</div>`);
      probeArt(q.code).then((ok) => { if (ok) { e.classList.add("art"); e.style.backgroundImage = `url(${artUrl(q.code)})`; } });
      e.onmouseenter = () => this.showDetail(q.code, q);
    }
    e.dataset.code = q.code; e.dataset.loc = loc; e.dataset.seq = seq; e.dataset.side = side;
    e.addEventListener("click", (ev) => { ev.stopPropagation(); if (!hiddenFromMe) this.showDetail(q.code, q); this.onCardClick?.(e, ev); });
    return e;
  }

  async showDetail(code, q = {}) {
    const c = this.cards.get(code); if (!c) return;
    const d = this.q(".d-detail");
    const isMon = c.type & TYPE.MONSTER;
    const line = isMon
      ? `${"★".repeat(Math.min(12, c.lv))} · ${ATTRIBUTE_NAMES[c.attribute] || ""} · ${RACE_NAMES[c.race] || ""}${c.type & TYPE.EFFECT ? " / Efecto" : ""}${c.type & TYPE.FUSION ? " / Fusión" : ""}${c.type & TYPE.RITUAL ? " / Ritual" : ""}`
      : (c.type & TYPE.SPELL ? "Carta Mágica" : "Carta de Trampa") + (c.type & TYPE.QUICKPLAY ? " · Rápida" : c.type & TYPE.CONTINUOUS ? " · Continua" : c.type & TYPE.EQUIP ? " · Equipo" : c.type & TYPE.FIELD ? " · Campo" : c.type & TYPE.COUNTER ? " · Contraefecto" : "");
    const atk = q.attack ?? c.atk, def = q.defense ?? c.def;
    const face = isMon ? `<div class="dd-face"><b>${esc(c.name)}</b><span>${"★".repeat(Math.min(12, c.lv))}</span><em>${atk < 0 ? "?" : atk} / ${def < 0 ? "?" : def}</em></div>`
      : `<div class="dd-face"><b>${esc(c.name)}</b><span class="big">${c.type & TYPE.SPELL ? "MÁGICA" : "TRAMPA"}</span></div>`;
    d.innerHTML = `<div class="dd-card ${cardClass(c)}"><div class="dd-art">${face}</div></div>
      <div class="dd-name">${esc(c.name)}</div><div class="dd-line">${line}</div>
      ${isMon ? `<div class="dd-stats">ATK ${atk < 0 ? "?" : atk} · DEF ${def < 0 ? "?" : def}</div>` : ""}
      <div class="dd-text">${esc(c.desc).replace(/\n/g, "<br>")}</div>`;
    if (await probeArt(code)) { const a = d.querySelector(".dd-art"); a.style.backgroundImage = `url(${artUrl(code)})`; a.classList.add("on"); a.innerHTML = ""; }
  }

  /** Visor de una pila (Cementerio, Desterradas, Extra). Va en su propia capa: se puede abrir en cualquier momento. */
  viewList(title, list, side) {
    this.closeViewer(); Sfx.play("click");
    const v = el("div", "d-viewer", `<div class="pbox"><div class="ptitle">${esc(title)} <small>(${list.length})</small></div><div class="plist"></div><div class="pbtns"><button class="btn ghost">Cerrar</button></div></div>`);
    const lst = v.querySelector(".plist");
    if (!list.length) lst.appendChild(el("div", "d-empty", "No hay cartas."));
    [...list].reverse().forEach((c, i) => lst.appendChild(this.cardEl({ ...c, position: 1 }, side, 0, i)));
    v.querySelector("button").onclick = () => this.closeViewer();
    v.onclick = (e) => { if (e.target === v) this.closeViewer(); };
    this.scr.appendChild(v); this.viewer = v;
  }
  closeViewer() { if (this.viewer) { this.viewer.remove(); this.viewer = null; } }

  log(text) {
    this.logLines.push(text); if (this.logLines.length > 60) this.logLines.shift();
    const lg = this.q(".d-log"); lg.innerHTML = this.logLines.map((l) => `<div>${esc(l)}</div>`).join(""); lg.scrollTop = lg.scrollHeight;
  }
  toast(text, cls = "") {
    const t = el("div", "d-toast " + cls, esc(text)); this.q(".d-toasts").appendChild(t);
    setTimeout(() => t.classList.add("out"), 1400 / this.speed()); setTimeout(() => t.remove(), 1800 / this.speed());
    this.log(text);
  }
  /** Banda que cruza la pantalla (turno, fase, inicio del duelo). */
  async banner(text, ms = 900, cls = "", sub = "") {
    const b = this.q(".d-banner"); const d = ms / this.speed();
    b.className = "d-banner " + cls; b.style.setProperty("--bt", d + "ms");
    b.innerHTML = `<span>${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ""}</span>`; b.hidden = false;
    await sleep(d); b.hidden = true;
  }
  turnBanner(player) { return this.banner(player === this.me ? "Tu turno" : "Turno rival", 1100, player === this.me ? "" : "opp", `Turno ${this.runner.turn}`); }
  async phaseBanner(phase) {
    const name = PHASE_BANNER[phase]; if (!name) return;
    Sfx.play("phase");
    await this.banner(name, 620, "phase" + (this.turnPlayer === this.me ? "" : " opp"));
  }
  speed() { return [1, 0.7, 1, 1.8][game.state.options.duelSpeed || 2]; }
  wait(ms) { return sleep(ms / this.speed()); }
  who(p) { return p === this.me ? this.names[0] : this.names[1]; }
  name(code) { return this.cards.get(code)?.name || "?"; }
  str(desc) {
    const d = BigInt(desc ?? 0);
    if (d < 10000n) return this.strings.system?.[String(d)] || "";
    return this.cards.describe(d) || "";
  }
  floatNum(player, text, cls) {
    const side = player === this.me ? "me" : "opp"; const bar = this.q(`.d-bar.${side}`);
    const f = el("div", "d-float " + cls, esc(text)); bar.appendChild(f); setTimeout(() => f.remove(), 1200);
  }

  // ---------------- Eventos del motor ----------------
  async onMessage(m, silent) {
    if (silent) { // solo se actualiza el estado, sin dibujar ni animar
      if (m.type === M.NEW_TURN) { this.turnPlayer = m.player; this.phase = 0; this.chainLinks = []; }
      else if (m.type === M.NEW_PHASE) this.phase = m.phase;
      else if (m.type === M.HINT && m.hint_type === 3) this.hintText = this.str(m.hint);
      else if (m.type === M.CHAINING) this.chainLinks.push({ n: m.chain_size, loc: { controller: m.controller, location: m.location, sequence: m.sequence } });
      else if (m.type === M.CHAIN_SOLVED) this.chainLinks = this.chainLinks.filter((x) => x.n !== m.chain_size);
      else if (m.type === M.CHAIN_END) this.chainLinks = [];
      return;
    }
    const snd = SOUND_OF[m.type]; if (snd) Sfx.play(snd);
    // Acciones del rival a las que tiene sentido responder
    if ((m.type === M.SUMMONING || m.type === M.SPSUMMONING || m.type === M.FLIPSUMMONING || m.type === M.CHAINING || m.type === M.SET) && m.controller !== this.me) this.oppActed = true;
    if (m.type === M.ATTACK && m.card.controller !== this.me) this.oppActed = true;
    switch (m.type) {
      case M.NEW_TURN: this.turnPlayer = m.player; this.phase = 0; this.chainLinks = []; this.render(); await this.turnBanner(m.player); break;
      case M.NEW_PHASE: this.phase = m.phase; this.render(); await this.phaseBanner(m.phase); break;
      case M.HINT:
        if (m.hint_type === 3) this.hintText = this.str(m.hint);        // SELECTMSG
        else if (m.hint_type === 2 && m.player === this.me) { const s = this.str(m.hint); if (s) this.toast(s); } // MESSAGE
        else if (m.hint_type === 4 && m.player === this.me) { const s = this.str(m.hint); if (s) this.toast("Rival eligió: " + s); }
        break;
      case M.DRAW: await this.anim(() => this.animDraw(m)); if (m.player === this.me) this.log(`Robaste ${m.drawn.length} carta(s).`); await this.wait(180); break;
      case M.SHUFFLE_DECK: this.fx(this.q(`.d-row.${m.player === this.me ? "me" : "opp"} .pile.deck`), "shuffle"); await this.wait(380); break;
      case M.MOVE: await this.anim(() => this.animMove(m)); break;
      case M.SUMMONING: case M.SPSUMMONING: case M.FLIPSUMMONING:
        this.render(); this.log(`${this.who(m.controller)} invoca ${this.name(m.code)}.`); this.showDetail(m.code);
        this.fx(this.node(m), m.type === M.FLIPSUMMONING ? "flipup" : m.type === M.SPSUMMONING ? "spsummon" : "summon"); this.burst(this.anchor(m), m.type === M.SPSUMMONING ? "sp" : "sum");
        await this.wait(750); break;
      case M.CHAINING:
        this.chainLinks.push({ n: m.chain_size, loc: { controller: m.controller, location: m.location, sequence: m.sequence } });
        this.render(); this.log(`${m.chain_size > 1 ? `Cadena ${m.chain_size}: ` : ""}${this.who(m.controller)} activa ${this.name(m.code)}.`);
        this.showDetail(m.code); await this.anim(() => this.showcase(m)); await this.wait(150); break;
      case M.CHAIN_SOLVING: { const k = this.chainLinks.find((x) => x.n === m.chain_size); if (k && this.chainLinks.length > 1) { this.flashCard(k.loc); await this.wait(380); } break; }
      case M.CHAIN_NEGATED: case M.CHAIN_DISABLED: { const k = this.chainLinks.find((x) => x.n === m.chain_size); if (k) this.fx(this.node(k.loc), "targeted"); this.toast("¡Efecto negado!", "neg"); await this.wait(650); break; }
      case M.CHAIN_SOLVED: this.chainLinks = this.chainLinks.filter((x) => x.n !== m.chain_size); this.render(); break;
      case M.CHAIN_END: this.chainLinks = []; this.render(); break;
      case M.BECOME_TARGET: this.render(); for (const c of m.cards) this.fx(this.node(c), "targeted"); await this.wait(450); break;
      case M.SET: this.render(); this.fx(this.node(m), "drop"); this.log(`${this.who(m.controller)} coloca una carta.`); await this.wait(350); break;
      case M.ATTACK: {
        this.render(); const tgt = m.target && m.target.location ? this.cardAt(m.target) : null;
        this.log(`${this.name(this.cardAt(m.card)?.code)} ataca ${tgt ? "a " + this.name(tgt.code) : "directamente"}.`);
        const a = this.anchor(m.card), b = tgt ? this.anchor(m.target) : this.center(this.q(`.d-hand.${m.card.controller === this.me ? "opp" : "me"}`));
        this.flashCard(m.card); this.beam(a, b); if (tgt) this.fx(this.node(m.target), "targeted");
        await this.wait(600); break;
      }
      case M.BATTLE:
        for (const c of [m.card, m.target]) if (c && c.location && c.destroyed) this.dying.add(`${c.controller}:${c.location}:${c.sequence}`);
        await this.anim(() => this.animBattle(m)); break;
      case M.DAMAGE: this.render(); this.floatNum(m.player, `-${m.amount}`, "dmg"); this.hit(m.player, m.amount); this.log(`${this.who(m.player)} recibe ${m.amount} de daño.`); await this.wait(850); break;
      case M.PAY_LPCOST: this.render(); this.floatNum(m.player, `-${m.amount}`, "dmg"); this.fx(this.q(`.d-bar.${m.player === this.me ? "me" : "opp"}`), "hit"); await this.wait(600); break;
      case M.RECOVER: this.render(); this.floatNum(m.player, `+${m.amount}`, "heal"); this.fx(this.q(`.d-bar.${m.player === this.me ? "me" : "opp"}`), "healed"); this.log(`${this.who(m.player)} gana ${m.amount} LP.`); await this.wait(750); break;
      case M.TOSS_COIN: this.toast("Moneda: " + m.results.map((r) => (r ? "Cara" : "Cruz")).join(", "), "coin"); await this.wait(900); break;
      case M.TOSS_DICE: this.toast("Dado: " + m.results.join(", "), "coin"); await this.wait(900); break;
      case M.POS_CHANGE: this.render(); await this.anim(() => this.animPos(m)); break;
      case M.SWAP: this.render(); break;
      case M.WIN: this.render(); break;
    }
    if (isSelect(m)) this.render();
  }
  cardAt(loc) {
    if (!loc) return null; const side = loc.controller === this.me ? "me" : "opp"; const s = this.S?.[side]; if (!s) return null;
    const arr = loc.location === L.MZONE ? s.mz : loc.location === L.SZONE ? s.st : loc.location === L.HAND ? s.hand : null;
    return arr ? arr[loc.sequence] : null;
  }
  flashCard(loc) {
    if (!loc || loc.location === undefined) return;
    const side = loc.controller === this.me ? "me" : "opp";
    const e = this.scr.querySelector(`.card[data-side="${side}"][data-loc="${loc.location}"][data-seq="${loc.sequence}"]`);
    if (e) { e.classList.remove("flash"); void e.offsetWidth; e.classList.add("flash"); }
  }

  // ---------------- Animaciones ----------------
  // Un error de animación no tiene que cortar el duelo: se vuelve a dibujar y se sigue.
  async anim(fn) { try { await fn(); } catch (e) { console.warn("[animación]", e); this.render(); } }
  fx(e, cls) { if (e) { e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); } }
  play(e, frames, ms, o = {}) {
    const duration = ms / this.speed(), delay = (o.delay || 0) / this.speed();
    const a = e.animate(frames, { duration, delay, easing: o.easing || "ease-out", fill: "backwards" });
    return Promise.race([a.finished.catch(() => {}), sleep(duration + delay + 80)]); // el respaldo cubre la pestaña en segundo plano
  }
  node(loc) {
    if (!loc || loc.location === undefined) return null;
    return this.scr.querySelector(`.card[data-side="${loc.controller === this.me ? "me" : "opp"}"][data-loc="${loc.location}"][data-seq="${loc.sequence}"]`);
  }
  center(e, scale = 1) {
    if (!e) return null; const r = e.getBoundingClientRect(), s = this.scr.getBoundingClientRect();
    const persp = e.classList.contains("slot") && e.offsetHeight ? r.height / e.offsetHeight : 1;
    return { x: r.left + r.width / 2 - s.left, y: r.top + r.height / 2 - s.top, scale: scale * persp, el: e };
  }
  /** Centro de una zona, pila o carta de la mano, en coordenadas de la pantalla de duelo. */
  anchor(l) {
    const side = l.controller === this.me ? "me" : "opp";
    if (l.location === L.HAND) { const h = this.q(`.d-hand.${side}`); return this.center(h.children[l.sequence] || h, side === "opp" ? 0.7 : 1.2); }
    if (l.location === L.MZONE || l.location === L.SZONE) return this.center(this.scr.querySelector(`.slot[data-side="${side}"][data-loc="${l.location}"][data-seq="${l.sequence}"]`));
    const pile = l.location === L.DECK ? "deck" : l.location === L.EXTRA ? "extra" : l.location === L.GRAVE || l.location === L.REMOVED ? "grave" : null;
    return pile ? this.center(this.q(`.d-row.${side} .pile.${pile}`)) : null;
  }
  ghost(code, faceUp) {
    const g = faceUp && this.cards.get(code) ? this.cardEl({ code, position: 1 }, "me", 0, 0) : el("div", "card back");
    g.classList.add("ghost"); this.scr.appendChild(g); return g;
  }
  async fly(g, a, b, o = {}) {
    const at = (p, extra = "") => `translate(${p.x}px, ${p.y}px) scale(${p.scale})${extra}`;
    await this.play(g, [{ transform: at(a), opacity: 1 }, { transform: at(b, o.rot ? " rotate(90deg)" : ""), opacity: o.fade ?? 1 }], o.ms || 300, { delay: o.delay, easing: "cubic-bezier(.3,.7,.3,1)" });
    g.remove();
  }
  async animMove(m) {
    const { card: code, from, to } = m;
    const a = this.anchor(from); this.render(); const b = this.anchor(to);
    if (!a || !b || (a.x === b.x && a.y === b.y)) return;
    // La carta viaja boca arriba solo si es pública o es del jugador.
    const pub = (l) => ((l.location === L.MZONE || l.location === L.SZONE) && l.position & 0x5) || l.location === L.GRAVE || (l.location === L.REMOVED && l.position & 0x5);
    const mine = (l) => l.controller === this.me && (l.location === L.HAND || l.location === L.MZONE || l.location === L.SZONE);
    const face = code && (pub(from) || pub(to) || mine(from) || mine(to));
    const onField = to.location === L.MZONE || to.location === L.SZONE, fromField = from.location === L.MZONE || from.location === L.SZONE;
    const key = `${from.controller}:${from.location}:${from.sequence}`;
    const destroyed = fromField && (m.reason & REASON_DESTROY || this.dying.has(key)); this.dying.delete(key);
    const dest = b.el.classList.contains("card") ? b.el : onField ? b.el.querySelector(".card") : null;
    if (dest) dest.style.visibility = "hidden";
    const at = (p, k = 1, extra = "") => `translate(${p.x}px, ${p.y}px) scale(${p.scale * k})${extra}`;
    if (destroyed) {
      // Destruida: se quiebra en su lugar antes de irse al Cementerio.
      const g = this.ghost(code, face); this.burst(a, "break"); Sfx.play("destroy");
      await this.play(g, [{ transform: at(a), filter: "none", opacity: 1 }, { transform: at(a, 1.12, " rotate(-4deg)"), filter: "brightness(3) saturate(0)", opacity: 1, offset: 0.35 },
        { transform: at(a, 0.7, " rotate(9deg)"), filter: "brightness(.5) blur(3px)", opacity: 0 }], 520);
      g.remove();
    } else if (fromField && m.reason & REASON_RELEASE && !onField) {
      // Sacrificada: se disuelve en luz hacia arriba.
      const g = this.ghost(code, face); Sfx.play("tribute");
      await this.play(g, [{ transform: at(a), filter: "none", opacity: 1 }, { transform: at({ ...a, y: a.y - 26 }, 1.1), filter: "brightness(3.5)", opacity: 0 }], 450);
      g.remove();
    } else {
      const toPile = !onField && to.location !== L.HAND; Sfx.play("move");
      await this.fly(this.ghost(code, face), a, toPile ? { ...b, scale: b.scale * 0.8 } : b, { rot: to.location === L.MZONE && to.position & 0xC, fade: toPile ? 0.35 : 1, ms: onField ? 380 : 320 });
    }
    if (dest) dest.style.visibility = "";
  }
  async animDraw(m) {
    const side = m.player === this.me ? "me" : "opp";
    const a = this.center(this.q(`.d-row.${side} .pile.deck`)); this.render();
    const hand = [...this.q(`.d-hand.${side}`).children].slice(-m.drawn.length);
    if (!a || !hand.length) return;
    for (const c of hand) c.style.visibility = "hidden";
    await Promise.all(hand.map(async (c, i) => {
      await this.fly(this.ghost(0, false), a, this.center(c, side === "opp" ? 0.7 : 1.2), { ms: 300, delay: i * 110 });
      c.style.visibility = ""; if (side === "me") this.fx(c, "flipup");
    }));
  }
  async animPos(m) {
    const e = this.node(m); if (!e) return;
    if (m.prev_position & 0xA && m.position & 0x5) { this.fx(e, "flipup"); await this.wait(300); }
    else if (!!(m.prev_position & 0xC) !== !!(m.position & 0xC)) {
      const turned = "rotate(90deg)";
      await this.play(e, [{ transform: m.position & 0xC ? "none" : turned }, { transform: m.position & 0xC ? turned : "none" }], 260);
    }
  }
  /** El atacante embiste al objetivo (o al rival, si es directo) y vuelve a su lugar. */
  async animBattle(m) {
    this.render();
    const e = this.node(m.card), a = e && this.anchor(m.card); if (!a) return;
    const tgt = m.target && m.target.location ? this.node(m.target) : null;
    const b = tgt ? this.anchor(m.target) : this.center(this.q(`.d-hand.${m.card.controller === this.me ? "opp" : "me"}`));
    if (!b) return;
    const dx = (b.x - a.x) * 0.8, dy = (b.y - a.y) * 0.8;
    e.style.zIndex = 6;
    const lunge = this.play(e, { translate: ["0 0", `${dx}px ${dy}px`, "0 0"], offset: [0, 0.45, 1], easing: ["ease-in", "ease-out"] }, 560, { easing: "linear" });
    await this.wait(250);
    this.burst(b, "hit"); Sfx.play("hit");
    if (tgt) this.play(tgt, { translate: ["0 0", "-6px 0", "6px 0", "-4px 0", "0 0"] }, 260);
    await lunge; e.style.zIndex = "";
  }
  /** La carta activada se agranda un instante sobre el campo. */
  async showcase(m) {
    const a = this.anchor(m), c = this.center(this.q(".d-field")); if (!a || !c || !this.cards.get(m.code)) return;
    const g = this.ghost(m.code, true); const at = (p, k) => `translate(${p.x}px, ${p.y}px) scale(${k})`;
    await this.play(g, [{ transform: at(a, a.scale), opacity: 1 }, { transform: at(c, 2.3), opacity: 1, offset: 0.3 }, { transform: at(c, 2.3), opacity: 1, offset: 0.8 }, { transform: at(c, 2.6), opacity: 0 }], 1000);
    g.remove();
  }
  /** Trazo de luz del atacante al objetivo al declarar el ataque. */
  beam(a, b) {
    if (!a || !b) return; const e = el("div", "d-beam"); const dx = b.x - a.x, dy = b.y - a.y;
    e.style.width = Math.hypot(dx, dy) + "px"; e.style.transform = `translate(${a.x}px, ${a.y}px) rotate(${Math.atan2(dy, dx)}rad)`;
    this.scr.appendChild(e); setTimeout(() => e.remove(), 600 / this.speed());
  }
  burst(p, cls) {
    if (!p) return; const b = el("div", "d-burst " + cls); b.style.translate = `${p.x}px ${p.y}px`;
    this.scr.appendChild(b); setTimeout(() => b.remove(), 600 / this.speed());
  }
  hit(player, amount) {
    this.fx(this.q(`.d-bar.${player === this.me ? "me" : "opp"}`), "hit");
    const k = Math.min(3, 1 + amount / 1500); // más daño, más sacudida
    this.play(this.q(".d-main"), { translate: ["0 0", `${-4 * k}px ${2 * k}px`, `${4 * k}px ${-2 * k}px`, `${-3 * k}px 0`, `${2 * k}px ${k}px`, "0 0"] }, 320);
  }
  setLP(side, lp) {
    const e = this.q(`.d-bar.${side} .d-lp`); const st = (this.lpShown ??= {})[side] ??= { v: lp, to: lp, raf: 0 };
    if (st.to === lp) { if (!st.raf) e.textContent = String(lp); return; }
    const from = st.v, t0 = performance.now(), dur = 600 / this.speed(); st.to = lp; cancelAnimationFrame(st.raf);
    const tick = (now) => { const k = Math.min(1, (now - t0) / dur); st.v = Math.round(from + (lp - from) * k); e.textContent = String(st.v); st.raf = k < 1 ? requestAnimationFrame(tick) : 0; };
    st.raf = requestAnimationFrame(tick);
  }
  decorate() { /* reservado para resaltar cartas accionables durante un prompt */ }

  // ---------------- Decisiones del jugador ----------------
  async respond(m) {
    this.render(); this.asked = false;
    const r = await Promise.race([this.decide(m), new Promise((res) => { this.undoNow = () => res({ undo: true }); this.q(".d-undo").disabled = false; })]);
    this.undoNow = null; this.q(".d-undo").disabled = true;
    if (r.undo) { this.resetPromptUI(); Sfx.play("cancel"); this.log("↩ Volviste a tu jugada anterior."); return r; }
    if (!this.asked) r.auto = true;
    return r;
  }
  resetPromptUI() {
    const p = this.q(".d-prompt"); p.hidden = true; p.innerHTML = ""; this.closeViewer();
    this.promptCleanup?.(); this.promptCleanup = null; this.onCardClick = null; this.decorate = () => {}; this.closeMenu(); this.setHint("");
    this.scr.querySelectorAll(".card.can, .card.chosen").forEach((c) => c.classList.remove("can", "chosen"));
  }
  async decide(m) {
    const H = this.helper; const oppActed = this.oppActed; this.oppActed = false;
    if (m.type === M.SELECT_CHAIN && !m.forced && m.selects.length) {
      const mode = game.state.options.askChain || "smart";
      if (mode === "never" || (mode === "smart" && !oppActed && !m.spe_count)) return { type: R.SELECT_CHAIN, index: null };
    }
    switch (m.type) {
      case M.SELECT_IDLECMD: return this.idle(m);
      case M.SELECT_BATTLECMD: return this.battle(m);
      case M.SELECT_EFFECTYN: {
        const s = this.str(m.description); const txt = `¿Activar el efecto de ${this.name(m.code)}?` + (s && !s.includes("%") ? `\n${s}` : "");
        this.showDetail(m.code); return { type: R.SELECT_EFFECTYN, yes: (await this.buttons(txt, ["Sí", "No"])) === 0 };
      }
      case M.SELECT_YESNO: return { type: R.SELECT_YESNO, yes: (await this.buttons(this.str(m.description) || "¿Confirmar?", ["Sí", "No"])) === 0 };
      case M.SELECT_OPTION: return { type: R.SELECT_OPTION, index: await this.buttons(this.hintText || "Elegí una opción", m.options.map((o) => this.str(o) || "Opción")) };
      case M.SELECT_CARD: { const r = await (this.pickOnField(this.hintText || "Seleccioná carta(s)", m.selects, m.min, m.max, m.can_cancel) ?? this.pickCards(this.hintText || "Seleccioná carta(s)", m.selects, m.min, m.max, m.can_cancel)); return { type: R.SELECT_CARD, indicies: r }; }
      case M.SELECT_TRIBUTE: { const t = this.hintText || "Seleccioná monstruos para Sacrificar", v = (sel) => sel.reduce((s, i) => s + (m.selects[i].release_param || 1), 0) >= m.min;
        const r = await (this.pickOnField(t, m.selects, m.min, m.max, m.can_cancel, v) ?? this.pickCards(t, m.selects, m.min, m.max, m.can_cancel, v)); return { type: R.SELECT_TRIBUTE, indicies: r }; }
      case M.SELECT_UNSELECT_CARD: return this.unselect(m);
      case M.SELECT_CHAIN: return this.chain(m);
      case M.SELECT_PLACE: case M.SELECT_DISFIELD: return H.respond(m);
      case M.SELECT_POSITION: {
        const opts = [0x1, 0x2, 0x4, 0x8].filter((p) => m.positions & p); this.showDetail(m.code);
        if (opts.length === 1) return { type: R.SELECT_POSITION, position: opts[0] };
        const i = await this.buttons(`Posición para ${this.name(m.code)}`, opts.map((p) => POS_NAMES[p])); return { type: R.SELECT_POSITION, position: opts[i] };
      }
      case M.SELECT_COUNTER: case M.SORT_CARD: case M.SORT_CHAIN: return H.respond(m);
      case M.SELECT_SUM: return this.sum(m);
      case M.ANNOUNCE_RACE: return { type: R.ANNOUNCE_RACE, races: (await this.pickFlags("Declará un Tipo", RACE_NAMES, Number(m.available), m.count)).map(BigInt) };
      case M.ANNOUNCE_ATTRIB: return { type: R.ANNOUNCE_ATTRIB, attributes: await this.pickFlags("Declará un Atributo", ATTRIBUTE_NAMES, Number(m.available), m.count) };
      case M.ANNOUNCE_CARD: return { type: R.ANNOUNCE_CARD, card: await this.announceCard(m) };
      case M.ANNOUNCE_NUMBER: return { type: R.ANNOUNCE_NUMBER, value: await this.buttons(this.hintText || "Declará un número", m.options.map((o) => String(o))) };
      case M.ROCK_PAPER_SCISSORS: return { type: R.ROCK_PAPER_SCISSORS, value: 1 + (await this.buttons("¡Piedra, papel o tijera!", ["Tijera", "Piedra", "Papel"])) };
    }
    return H.respond(m);
  }

  // Fase principal: acciones sobre cartas + botones de fase
  idle(m) {
    return new Promise((resolve) => {
      const actions = new Map(); // clave carta -> [{label, resp}]
      const add = (c, label, action, i) => { const k = `${c.controller}:${c.location}:${c.sequence}`; if (!actions.has(k)) actions.set(k, []); actions.get(k).push({ label, resp: { type: R.SELECT_IDLECMD, action, index: i } }); };
      m.summons.forEach((c, i) => add(c, "Invocar", IDLE.SELECT_SUMMON, i));
      m.special_summons.forEach((c, i) => add(c, "Invocación Especial", IDLE.SELECT_SPECIAL_SUMMON, i));
      m.monster_sets.forEach((c, i) => add(c, "Colocar", IDLE.SELECT_MONSTER_SET, i));
      m.spell_sets.forEach((c, i) => add(c, "Colocar", IDLE.SELECT_SPELL_SET, i));
      m.pos_changes.forEach((c, i) => add(c, "Cambiar posición", IDLE.SELECT_POS_CHANGE, i));
      m.activates.forEach((c, i) => { const s = this.str(c.description); add(c, "Activar" + (s && m.activates.filter((x) => x.code === c.code).length > 1 ? `: ${s}` : ""), IDLE.SELECT_ACTIVATE, i); });
      const buttons = [];
      if (m.to_bp) buttons.push(["Fase de Batalla", { type: R.SELECT_IDLECMD, action: IDLE.TO_BP, index: 0 }]);
      if (m.to_ep) buttons.push(["Terminar turno", { type: R.SELECT_IDLECMD, action: IDLE.TO_EP, index: 0 }]);
      this.interactive(actions, buttons, resolve, "Tocá una carta brillante para jugarla, o elegí la fase siguiente a la derecha");
    });
  }
  battle(m) {
    return new Promise((resolve) => {
      const actions = new Map();
      const add = (c, label, resp) => { const k = `${c.controller}:${c.location}:${c.sequence}`; if (!actions.has(k)) actions.set(k, []); actions.get(k).push({ label, resp }); };
      m.attacks.forEach((c, i) => add(c, "Atacar", { type: R.SELECT_BATTLECMD, action: BATTLE.SELECT_BATTLE, index: i }));
      m.chains.forEach((c, i) => add(c, "Activar", { type: R.SELECT_BATTLECMD, action: BATTLE.SELECT_CHAIN, index: i }));
      const buttons = [];
      if (m.to_m2) buttons.push(["Fase Principal 2", { type: R.SELECT_BATTLECMD, action: BATTLE.TO_M2, index: 0 }]);
      if (m.to_ep) buttons.push(["Terminar turno", { type: R.SELECT_BATTLECMD, action: BATTLE.TO_EP, index: 0 }]);
      this.interactive(actions, buttons, resolve, "Tocá el monstruo que ataca, o elegí la fase siguiente a la derecha");
    });
  }
  interactive(actions, buttons, resolve, hint) {
    this.asked = true;
    const finish = (resp) => { cleanup(); resolve(resp); };
    const tracks = [];
    const cleanup = () => { for (const b of tracks) { b.classList.remove("go"); b.onclick = null; } this.onCardClick = null; this.decorate = () => {}; this.scr.querySelectorAll(".card.can").forEach((c) => c.classList.remove("can")); this.closeMenu(); this.setHint(""); offKey(); this.promptCleanup = null; };
    this.promptCleanup = cleanup;
    // Las fases a las que se puede pasar se eligen en la barra de fases.
    for (const [label, resp] of buttons) {
      const b = this.q(`.ph[data-p="${PHASE_OF_BUTTON[label]}"]`); if (!b) continue;
      b.classList.add("go"); b.onclick = () => finish(resp); tracks.push(b);
    }
    const mark = () => this.scr.querySelectorAll(".card").forEach((c) => {
      const k = `${this.team(c.dataset.side)}:${c.dataset.loc}:${c.dataset.seq}`; c.classList.toggle("can", actions.has(k));
    });
    mark();
    this.decorate = mark;
    this.onCardClick = (cardEl) => {
      const k = `${this.team(cardEl.dataset.side)}:${cardEl.dataset.loc}:${cardEl.dataset.seq}`; const acts = actions.get(k);
      if (!acts) return this.closeMenu();
      Sfx.play("select"); this.openMenu(cardEl, acts.map((a) => [a.label, () => finish(a.resp)]));
    };
    this.setHint(hint);
    // Atajo de teclado: START = terminar turno
    const offKey = Input.push((b) => { if (b === "START") { const end = buttons.find((x) => x[0] === "Terminar turno"); if (end) finish(end[1]); } });
  }
  /** Línea de instrucciones arriba del campo, con botones opcionales. */
  setHint(t, btns = []) {
    const e = this.q(".d-instr"); e.innerHTML = ""; e.hidden = !t; e.classList.remove("ask"); if (!t) return;
    e.appendChild(el("span", "", esc(t)));
    for (const [label, fn, cls] of btns) { const b = el("button", "btn " + (cls || ""), esc(label)); b.onclick = fn; if (fn === null) b.disabled = true; e.appendChild(b); }
  }
  /** Elegir cartas tocándolas en el campo o la mano (sin ventana), como objetivos de ataque o de efectos. */
  pickOnField(title, selects, min, max, canCancel, valid) {
    const nodes = selects.map((s) => (s.location === L.MZONE || s.location === L.SZONE || (s.location === L.HAND && s.controller === this.me) ? this.node(s) : null));
    if (!nodes.length || nodes.some((n) => !n) || new Set(nodes).size !== nodes.length) return null;
    this.asked = true;
    return new Promise((resolve) => {
      const chosen = new Set(); const ok = () => (valid ? valid([...chosen]) : chosen.size >= min && chosen.size <= max);
      const done = (v) => { this.onCardClick = null; this.decorate = () => {}; nodes.forEach((n) => n.classList.remove("can", "chosen")); this.setHint(""); resolve(v); };
      const draw = () => {
        nodes.forEach((n, i) => { n.classList.add("can"); n.classList.toggle("chosen", chosen.has(i)); });
        const btns = []; if (!(min === 1 && max === 1)) btns.push(["Confirmar", ok() ? () => done([...chosen]) : null]);
        if (canCancel) btns.push(["Cancelar", () => done(null), "ghost"]);
        this.setHint(`${title}${min === 1 && max === 1 ? "" : ` (${chosen.size}/${min === max ? min : min + "–" + max})`}`, btns);
      };
      this.onCardClick = (cardEl) => {
        const i = nodes.indexOf(cardEl); if (i < 0) return;
        if (chosen.has(i)) chosen.delete(i); else { if (chosen.size >= max) { if (max === 1) chosen.clear(); else return; } chosen.add(i); }
        Sfx.play("select");
        if (min === 1 && max === 1 && chosen.size === 1) return done([...chosen]);
        draw();
      };
      draw();
    });
  }
  openMenu(anchor, items) {
    this.closeMenu();
    const menu = el("div", "d-menu"); this.menuEl = menu;
    for (const [label, fn] of items) { const b = el("button", "btn", esc(label)); b.onclick = (e) => { e.stopPropagation(); fn(); }; menu.appendChild(b); }
    const cancel = el("button", "btn ghost", "Cancelar"); cancel.onclick = (e) => { e.stopPropagation(); this.closeMenu(); }; menu.appendChild(cancel);
    this.scr.appendChild(menu);
    const r = anchor.getBoundingClientRect(), sr = this.scr.getBoundingClientRect();
    menu.style.left = Math.min(sr.width - menu.offsetWidth - 4, Math.max(4, r.left + r.width / 2 - sr.left - menu.offsetWidth / 2)) + "px";
    menu.style.top = Math.max(4, r.top - sr.top - menu.offsetHeight - 4) + "px";
  }
  closeMenu() { if (this.menuEl) { this.menuEl.remove(); this.menuEl = null; } }

  // Diálogo con botones
  buttons(text, labels) {
    this.asked = true;
    return new Promise((resolve) => {
      const p = this.q(".d-prompt"); p.hidden = false;
      p.innerHTML = `<div class="pbox small"><div class="ptitle">${esc(text).replace(/\n/g, "<br>")}</div><div class="pbtns"></div></div>`;
      const box = p.querySelector(".pbtns");
      labels.forEach((l, i) => { const b = el("button", "btn", esc(l)); b.onclick = () => { p.hidden = true; p.innerHTML = ""; resolve(i); }; box.appendChild(b); });
    });
  }

  // Selección de cartas con mínimo y máximo
  pickCards(title, selects, min, max, canCancel, valid) {
    this.asked = true;
    return new Promise((resolve) => {
      const p = this.q(".d-prompt"); p.hidden = false; const chosen = new Set();
      const draw = () => {
        p.innerHTML = `<div class="pbox"><div class="ptitle">${esc(title)} <small>(${min === max ? min : min + "–" + max})</small></div><div class="plist"></div><div class="pbtns"></div></div>`;
        const lst = p.querySelector(".plist");
        selects.forEach((s, i) => {
          const side = s.controller === this.me ? "me" : "opp";
          const known = this.cards.get(s.code);
          const ce = this.cardEl({ code: s.code, position: s.position && !(s.location & (L.HAND | L.GRAVE | L.REMOVED | L.DECK | L.EXTRA)) ? s.position : 1, attack: known?.atk, defense: known?.def }, side, s.location, s.sequence);
          ce.classList.toggle("chosen", chosen.has(i)); ce.classList.add("can");
          const wrap = el("div", "pitem"); wrap.appendChild(ce); wrap.appendChild(el("div", "ploc", locName(s, this.me)));
          ce.onclick = (e) => { e.stopPropagation(); this.showDetail(s.code, s);
            if (chosen.has(i)) chosen.delete(i); else { if (chosen.size >= max) { if (max === 1) chosen.clear(); else return; } chosen.add(i); }
            Sfx.play("click"); draw(); };
          lst.appendChild(wrap);
        });
        const btns = p.querySelector(".pbtns");
        const ok = el("button", "btn", "Confirmar"); ok.disabled = !(valid ? valid([...chosen]) : chosen.size >= min && chosen.size <= max); ok.onclick = () => done([...chosen]); btns.appendChild(ok);
        if (canCancel) { const c = el("button", "btn ghost", "Cancelar"); c.onclick = () => done(null); btns.appendChild(c); }
      };
      const done = (v) => { p.hidden = true; p.innerHTML = ""; resolve(v); };
      draw();
    });
  }
  async unselect(m) {
    this.asked = true;
    const all = [...m.select_cards, ...m.unselect_cards];
    return new Promise((resolve) => {
      const p = this.q(".d-prompt"); p.hidden = false;
      p.innerHTML = `<div class="pbox"><div class="ptitle">${esc(this.hintText || "Seleccioná carta(s)")} <small>(${m.min}–${m.max})</small></div><div class="plist"></div><div class="pbtns"></div></div>`;
      const lst = p.querySelector(".plist");
      all.forEach((s, i) => {
        const side = s.controller === this.me ? "me" : "opp";
        const ce = this.cardEl({ code: s.code, position: 1 }, side, s.location, s.sequence); ce.classList.add("can");
        if (i >= m.select_cards.length) ce.classList.add("chosen");
        const wrap = el("div", "pitem"); wrap.appendChild(ce); wrap.appendChild(el("div", "ploc", locName(s, this.me)));
        ce.onclick = (e) => { e.stopPropagation(); done({ type: R.SELECT_UNSELECT_CARD, index: i }); };
        lst.appendChild(wrap);
      });
      const btns = p.querySelector(".pbtns");
      if (m.can_finish) { const b = el("button", "btn", "Terminar"); b.onclick = () => done({ type: R.SELECT_UNSELECT_CARD, index: null }); btns.appendChild(b); }
      if (m.can_cancel && !m.can_finish) { const b = el("button", "btn ghost", "Cancelar"); b.onclick = () => done({ type: R.SELECT_UNSELECT_CARD, index: null }); btns.appendChild(b); }
      const done = (v) => { p.hidden = true; p.innerHTML = ""; resolve(v); };
    });
  }
  /** "¿Activar?" sobre el tablero: brillan las cartas que pueden responder y un cartel chico pregunta. Solo si todas están en el campo o la mano. */
  chainOnBoard(m) {
    const nodes = m.selects.map((s) => (s.location === L.MZONE || s.location === L.SZONE || (s.location === L.HAND && s.controller === this.me) ? this.node(s) : null));
    if (nodes.some((n) => !n)) return null;
    return new Promise((resolve) => {
      const done = (index) => { this.onCardClick = null; this.decorate = () => {}; nodes.forEach((n) => n.classList.remove("can")); this.closeMenu(); this.setHint(""); this.q(".d-instr").classList.remove("ask"); resolve({ type: R.SELECT_CHAIN, index }); };
      nodes.forEach((n) => n.classList.add("can"));
      this.setHint(m.forced ? "Tenés que activar un efecto: tocá una carta brillante" : "¿Activar una carta o efecto?", m.forced ? [] : [["No activar", () => done(null), "ghost"]]);
      this.q(".d-instr").classList.add("ask");
      this.onCardClick = (cardEl) => {
        const idx = nodes.map((n, i) => (n === cardEl ? i : -1)).filter((i) => i >= 0);
        if (!idx.length) return this.closeMenu();
        Sfx.play("select");
        this.openMenu(cardEl, idx.map((i) => { const d = this.str(m.selects[i].description); return [idx.length > 1 && d && !d.includes("%") ? `Activar: ${d}` : "Activar", () => done(i)]; }));
      };
      if (m.selects.length === 1) this.showDetail(m.selects[0].code);
    });
  }
  /** "¿Activar?": muestra las cartas que pueden responder. Se toca una para verla y elegirla, y después Activar. */
  async chain(m) {
    if (!m.selects.length) return { type: R.SELECT_CHAIN, index: null };
    this.asked = true;
    const onBoard = this.chainOnBoard(m); if (onBoard) return onBoard;
    return new Promise((resolve) => {
      const p = this.q(".d-prompt"); p.hidden = false; let pick = m.selects.length === 1 ? 0 : -1;
      const done = (index) => { p.hidden = true; p.innerHTML = ""; resolve({ type: R.SELECT_CHAIN, index }); };
      const draw = () => {
        p.innerHTML = `<div class="pbox"><div class="ptitle">${m.forced ? "Tenés que activar un efecto" : "¿Activar una carta o efecto?"}</div><div class="plist"></div><div class="pbtns"></div></div>`;
        const lst = p.querySelector(".plist");
        m.selects.forEach((s, i) => {
          const side = s.controller === this.me ? "me" : "opp"; const d = this.str(s.description);
          const ce = this.cardEl({ code: s.code, position: 1 }, side, 0, i); ce.classList.add("can"); ce.classList.toggle("chosen", i === pick);
          ce.onclick = (e) => { e.stopPropagation(); this.showDetail(s.code); Sfx.play("click"); pick = i; draw(); };
          const wrap = el("div", "pitem"); wrap.appendChild(ce); wrap.appendChild(el("div", "ploc", esc(d && !d.includes("%") && d !== this.name(s.code) ? d : locName(s, this.me))));
          lst.appendChild(wrap);
        });
        const btns = p.querySelector(".pbtns");
        const ok = el("button", "btn", "Activar"); ok.disabled = pick < 0; ok.onclick = () => done(pick); btns.appendChild(ok);
        if (!m.forced) { const b = el("button", "btn ghost", "No activar"); b.onclick = () => done(null); btns.appendChild(b); }
      };
      draw(); if (pick >= 0) this.showDetail(m.selects[pick].code);
    });
  }
  async sum(m) {
    const amt = (s) => [s.amount & 0xffff, (s.amount >>> 16) & 0xffff].filter(Boolean);
    const mustSum = m.selects_must.reduce((a, s) => a + amt(s)[0], 0);
    const valid = (sel) => {
      let sums = [mustSum]; for (const i of sel) sums = sums.flatMap((x) => amt(m.selects[i]).map((o) => x + o));
      return m.select_max ? sums.some((x) => x >= m.amount) : sums.includes(m.amount);
    };
    const r = await this.pickCards(this.hintText || `Seleccioná cartas que sumen ${m.amount}`, m.selects, 1, m.selects.length, false, valid);
    return { type: R.SELECT_SUM, indicies: [...m.selects_must.map((_, i) => i), ...r.map((i) => i + m.selects_must.length)] };
  }
  pickFlags(title, names, avail, count) {
    const opts = Object.keys(names).map(Number).filter((f) => avail & f);
    this.asked = true;
    return new Promise((resolve) => {
      const chosen = new Set(); const p = this.q(".d-prompt"); p.hidden = false;
      const draw = () => {
        p.innerHTML = `<div class="pbox small"><div class="ptitle">${esc(title)} (${count})</div><div class="pbtns wrap"></div></div>`;
        const box = p.querySelector(".pbtns");
        opts.forEach((f) => { const b = el("button", "btn" + (chosen.has(f) ? " on" : ""), esc(names[f])); b.onclick = () => { chosen.has(f) ? chosen.delete(f) : chosen.add(f); if (chosen.size === count) { p.hidden = true; resolve([...chosen]); } else draw(); }; box.appendChild(b); });
      };
      draw();
    });
  }
  announceCard(m) {
    this.asked = true;
    return new Promise((resolve) => {
      const p = this.q(".d-prompt"); p.hidden = false;
      p.innerHTML = `<div class="pbox"><div class="ptitle">Declará el nombre de una carta</div><input class="tinput" placeholder="Escribí parte del nombre"><div class="plist names"></div></div>`;
      const inp = p.querySelector("input"); const lst = p.querySelector(".plist");
      const matches = (code) => { const c = this.cards.get(code); const setcodes = []; let sc = c.setcode; while (sc > 0n) { setcodes.push(Number(sc & 0xffffn)); sc >>= 16n; } return cardMatchesOpcode({ code: c.code, type: c.type, race: BigInt(c.race), attribute: c.attribute, setcodes }, m.opcodes); };
      const search = () => {
        const q = inp.value.toLowerCase(); lst.innerHTML = ""; let n = 0;
        for (const k in this.cards.raw) { if (n >= 40) break; const c = this.cards.get(Number(k)); if (q && !this.cards.nameHas(c, q)) continue; if (!matches(c.code)) continue; n++;
          const b = el("button", "btn", esc(c.name)); b.onclick = () => { p.hidden = true; resolve(c.code); }; lst.appendChild(b); }
      };
      inp.addEventListener("input", search); inp.addEventListener("keydown", (e) => e.stopPropagation()); inp.focus(); search();
    });
  }
}

function locName(s, me) {
  const who = s.controller === me ? "" : " rival";
  const map = { [L.HAND]: "Mano", [L.MZONE]: "Campo", [L.SZONE]: "Campo", [L.GRAVE]: "Cementerio", [L.REMOVED]: "Desterrada", [L.DECK]: "Deck", [L.EXTRA]: "Extra" };
  return (map[s.location] || "") + who;
}
