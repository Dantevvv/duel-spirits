// IA heurística para duelos. Responde a cualquier selección del motor.
// "skill" (0..1) controla qué tan bien juega: los duelistas tempranos cometen más errores.
import { OcgMessageType as M } from "../ocg/type_message.js";
import { OcgResponseType as R, SelectIdleCMDAction as IDLE, SelectBattleCMDAction as BATTLE } from "../ocg/type_response.js";
import { OcgLocation as L, OcgPosition as P } from "../ocg/type_core.js";

const FACEUP_ATK = 0x1, FACEDOWN_ATK = 0x2, FACEUP_DEF = 0x4, FACEDOWN_DEF = 0x8;
// Textos de sistema que acompañan una selección (constant.lua, HINTMSG_*): dicen para qué se elige la carta.
const HINT_HARM = new Set([502, 503, 504, 505, 507, 520]);   // destruir, desterrar, al Cementerio, a la mano, al Deck, tomar control
const HINT_GOOD = new Set([506, 509]);                        // añadir a la mano, Invocar de Modo Especial
const HINT_ATTACK_TARGET = 549;
const TEXT_BUFF = /\bgains?\b|\bincreases?\b|cannot be destroyed|\bdoubles?\b/i;
const TEXT_HARM = /\bloses?\b|\bdecreases?\b|destroy|banish|negate|take control|cannot attack|return (it|that|them|\d)/i;
const TYPE_MONSTER = 0x1, TYPE_SPELL = 0x2, TYPE_TRAP = 0x4, TYPE_CONTINUOUS = 0x20000, TYPE_EQUIP = 0x40000, TYPE_FIELD = 0x80000, TYPE_QUICKPLAY = 0x10000;

export class DuelAI {
  /** @param {{cards: import('./cards.js').CardDB, skill?: number, rng?: () => number}} o */
  constructor(o) {
    this.cards = o.cards; this.skill = o.skill ?? 0.8; this.rng = o.rng || Math.random;
    this.idleCount = 0; this.lastTurnKey = null;
  }

  /** Estado visible del campo, provisto por el runner. */
  setView(fn) { this.view = fn; }

  /** Mensajes del duelo que le sirven de contexto: qué carta se está activando o resolviendo y con qué fin se pide elegir. */
  observe(m) {
    if (m.type === M.HINT && m.hint_type === 3) (this.hints ??= {})[m.player] = Number(m.hint);
    else if (m.type === M.CHAINING) { (this.links ??= [])[m.chain_size] = m.code; this.current = m.code; }
    else if (m.type === M.CHAIN_SOLVING) this.current = this.links?.[m.chain_size] ?? this.current;
    else if (m.type === M.CHAIN_END) { this.links = []; this.current = 0; }
  }
  /** ¿El efecto de esta carta beneficia a quien lo recibe? (por su texto en inglés) */
  isBuff(code) { const t = (this.cards.raw?.[code]?.[10] || "").split(/(?<=\.)\s+/); return TEXT_BUFF.test(t.slice(0, 2).join(" ")) && !TEXT_HARM.test(t[0]); }
  /** Para qué se está eligiendo: "harm" (al rival), "buff" (a un monstruo propio), "good" (la mejor carta, de quien sea) o "attack". */
  intent(player) {
    const h = this.hints?.[player]; if (this.hints) delete this.hints[player];
    if (h === HINT_ATTACK_TARGET) return "attack";
    if (HINT_HARM.has(h)) return "harm"; if (HINT_GOOD.has(h)) return "good";
    return this.current && this.isBuff(this.current) ? "buff" : "harm";
  }

  card(code) { return this.cards.get(code) || { atk: 0, def: 0, type: 0, level: 0, name: "?" }; }
  sloppy() { return this.rng() > this.skill; }

  respond(msg) {
    switch (msg.type) {
      case M.SELECT_IDLECMD: return this.idle(msg);
      case M.SELECT_BATTLECMD: return this.battle(msg);
      case M.SELECT_EFFECTYN: return { type: R.SELECT_EFFECTYN, yes: true };
      case M.SELECT_YESNO: return { type: R.SELECT_YESNO, yes: true };
      case M.SELECT_OPTION: return { type: R.SELECT_OPTION, index: 0 };
      case M.SELECT_CARD: return { type: R.SELECT_CARD, indicies: this.pickCards(msg.selects, msg.min, msg.max, msg.player) };
      case M.SELECT_TRIBUTE: return { type: R.SELECT_TRIBUTE, indicies: this.pickTributes(msg) };
      case M.SELECT_UNSELECT_CARD: return this.selectUnselect(msg);
      case M.SELECT_CHAIN: return this.chain(msg);
      case M.SELECT_PLACE: case M.SELECT_DISFIELD: return { type: msg.type === M.SELECT_PLACE ? R.SELECT_PLACE : R.SELECT_DISFIELD, places: this.pickPlaces(msg) };
      case M.SELECT_POSITION: return { type: R.SELECT_POSITION, position: this.pickPosition(msg) };
      case M.SELECT_COUNTER: return { type: R.SELECT_COUNTER, counters: this.pickCounters(msg) };
      case M.SELECT_SUM: return { type: R.SELECT_SUM, indicies: this.pickSum(msg) };
      case M.SORT_CARD: case M.SORT_CHAIN: return { type: R.SORT_CARD, order: null };
      case M.ANNOUNCE_RACE: return { type: R.ANNOUNCE_RACE, races: this.bits(BigInt(msg.available), msg.count).map(BigInt) };
      case M.ANNOUNCE_ATTRIB: return { type: R.ANNOUNCE_ATTRIB, attributes: this.bits(Number(msg.available), msg.count) };
      case M.ANNOUNCE_CARD: return { type: R.ANNOUNCE_CARD, card: this.announceCard(msg) };
      case M.ANNOUNCE_NUMBER: return { type: R.ANNOUNCE_NUMBER, value: 0 };
      case M.ROCK_PAPER_SCISSORS: return { type: R.ROCK_PAPER_SCISSORS, value: 1 + Math.floor(this.rng() * 3) };
    }
    return null;
  }

  // ---------- Fase principal ----------
  idle(msg) {
    const v = this.view(msg.player);
    const key = v.turn + ":" + v.phase;
    if (key !== this.lastTurnKey) { this.lastTurnKey = key; this.idleCount = 0; this.triedActivate = new Set(); }
    if (++this.idleCount > 25) return this.endIdle(msg, v);
    const oppBest = Math.max(0, ...v.opp.monsters.filter(Boolean).map(m => m.faceup ? (m.attackPos ? m.atk : m.def) : 1500));
    const isMain2 = (v.phase & 0x100) !== 0;

    // 1) Activar efectos/mágicas útiles
    for (let i = 0; i < msg.activates.length; i++) {
      const a = msg.activates[i]; const c = this.card(a.code); const k = a.code + ":" + a.location + ":" + a.sequence + ":" + a.description;
      if (this.triedActivate.has(k)) continue;
      if (!this.wantActivate(a, c, v)) continue;
      this.triedActivate.add(k);
      return { type: R.SELECT_IDLECMD, action: IDLE.SELECT_ACTIVATE, index: i };
    }
    // 2) Invocación especial
    if (msg.special_summons.length) {
      let best = -1, bestAtk = -1;
      msg.special_summons.forEach((s, i) => { const a = this.card(s.code).atk; if (a > bestAtk) { bestAtk = a; best = i; } });
      return { type: R.SELECT_IDLECMD, action: IDLE.SELECT_SPECIAL_SUMMON, index: best };
    }
    // 3) Invocación normal / colocar monstruo
    if (!isMain2 || !v.me.summonedThisTurn) {
      const cand = [];
      msg.summons.forEach((s, i) => cand.push({ i, s, kind: "summon" }));
      msg.monster_sets.forEach((s, i) => cand.push({ i, s, kind: "set" }));
      const scored = cand.map(o => ({ ...o, score: this.summonScore(o, oppBest, v) })).filter(o => o.score > 0).sort((a, b) => b.score - a.score);
      if (scored.length) {
        const pick = this.sloppy() && scored.length > 1 ? scored[1] : scored[0];
        return { type: R.SELECT_IDLECMD, action: pick.kind === "summon" ? IDLE.SELECT_SUMMON : IDLE.SELECT_MONSTER_SET, index: pick.i };
      }
    }
    // 4) Cambiar posición: defensa boca arriba -> ataque si gana
    for (let i = 0; i < msg.pos_changes.length; i++) {
      const pc = msg.pos_changes[i]; const m = v.me.monsters[pc.sequence];
      if (m && !m.attackPos && m.faceup && m.atk > oppBest && !isMain2) return { type: R.SELECT_IDLECMD, action: IDLE.SELECT_POS_CHANGE, index: i };
    }
    // 5) Colocar trampas (y mágicas rápidas)
    for (let i = 0; i < msg.spell_sets.length; i++) {
      const c = this.card(msg.spell_sets[i].code);
      if ((c.type & TYPE_TRAP) || (c.type & TYPE_QUICKPLAY)) {
        if (v.me.spellCount >= 4) break;
        return { type: R.SELECT_IDLECMD, action: IDLE.SELECT_SPELL_SET, index: i };
      }
    }
    return this.endIdle(msg, v);
  }
  endIdle(msg, v) {
    const isMain2 = (v.phase & 0x100) !== 0;
    if (msg.to_bp && !isMain2 && v.turn > 1 && v.me.monsters.some(m => m && m.attackPos)) return { type: R.SELECT_IDLECMD, action: IDLE.TO_BP, index: 0 };
    if (msg.to_ep) return { type: R.SELECT_IDLECMD, action: IDLE.TO_EP, index: 0 };
    return { type: R.SELECT_IDLECMD, action: IDLE.TO_BP, index: 0 };
  }
  wantActivate(a, c, v) {
    if (a.location === L.HAND && (c.type & TYPE_TRAP)) return false;
    if (a.location === L.HAND && (c.type & TYPE_SPELL)) {
      if (c.type & TYPE_EQUIP) return v.me.monsters.some(m => m && m.faceup);
      if ((c.type & TYPE_FIELD) && v.me.field) return false;
      return true;
    }
    return true; // efectos de monstruos en el campo, mágicas ya colocadas, etc.
  }
  summonScore(o, oppBest, v) {
    const c = this.card(o.s.code); const lvl = c.level & 0xff;
    const tributes = lvl >= 7 ? 2 : lvl >= 5 ? 1 : 0;
    if (tributes > v.me.monsters.filter(Boolean).length) return 0;
    let score = 1 + c.atk / 100;
    if (tributes) { const lost = v.me.monsters.filter(Boolean).sort((a, b) => a.atk - b.atk).slice(0, tributes).reduce((s, m) => s + m.atk, 0); score += (c.atk - lost) / 100 - 5; }
    const flipEffect = (c.type & 0x200000) !== 0;
    if (o.kind === "summon") { if (flipEffect) score -= 15; if (c.atk < oppBest) score -= 8; }
    else { score = 1 + c.def / 120 + (flipEffect ? 12 : 0); if (c.atk >= oppBest && !flipEffect) score -= 6; if (tributes) score -= 10; }
    return score;
  }

  // ---------- Batalla ----------
  battle(msg) {
    const v = this.view(msg.player);
    const opp = v.opp.monsters.filter(Boolean);
    for (let i = 0; i < msg.attacks.length; i++) {
      const at = msg.attacks[i]; const me = v.me.monsters[at.sequence]; if (!me) continue;
      if (opp.length === 0 && at.can_direct) return { type: R.SELECT_BATTLECMD, action: BATTLE.SELECT_BATTLE, index: i };
      const beatable = opp.some(o => this.beats(me.atk, o)); this.attackerAtk = me.atk;
      if (beatable || (at.can_direct && opp.length === 0) || (this.sloppy() && me.atk >= 1500)) return { type: R.SELECT_BATTLECMD, action: BATTLE.SELECT_BATTLE, index: i };
    }
    for (let i = 0; i < msg.chains.length; i++) { if (this.rng() < 0.3) return { type: R.SELECT_BATTLECMD, action: BATTLE.SELECT_CHAIN, index: i }; }
    if (msg.to_m2) return { type: R.SELECT_BATTLECMD, action: BATTLE.TO_M2, index: 0 };
    return { type: R.SELECT_BATTLECMD, action: BATTLE.TO_EP, index: 0 };
  }
  beats(atk, o) {
    if (!o.faceup) return atk > (o.attackPos ? 1500 : 1300);
    return o.attackPos ? atk > o.atk : atk > o.def;
  }

  // ---------- Selecciones ----------
  value(sel, player) {
    const c = this.card(sel.code);
    const onField = sel.location & (L.MZONE | L.SZONE);
    const base = (c.type & TYPE_MONSTER) ? Math.max(c.atk, c.def) : 1200;
    return (sel.controller === player ? 1 : -1) * base + (onField ? 0 : -1);
  }
  pickCards(selects, min, max, player) {
    const intent = this.intent(player); const v = this.view ? this.view(player) : null;
    const worth = (s) => { const c = this.card(s.code); return (c.type & TYPE_MONSTER) ? Math.max(c.atk, c.def) : 1200; };
    const score = (s) => {
      const mine = s.controller === player, w = worth(s);
      if (intent === "good") return w;                         // revivir, buscar: la mejor carta
      if (intent === "buff") return mine ? this.card(s.code).atk : -1e6 - w; // potenciar: mi monstruo más fuerte, nunca uno del rival
      if (intent === "attack") {                               // el objetivo más fuerte que el atacante puede vencer; si no hay, el más débil
        const o = v?.opp.monsters[s.sequence]; if (!o) return 0;
        return this.beats(this.attackerAtk ?? 0, o) ? 1e5 + (o.faceup ? (o.attackPos ? o.atk : o.def) : 1000) : -(o.faceup ? (o.attackPos ? o.atk : o.def) : 1500);
      }
      return mine ? -1e6 - w : w;                              // dañar: lo más valioso del rival; propias (costos, descartes), la menos valiosa
    };
    const idx = selects.map((s, i) => ({ i, v: score(s) })).sort((a, b) => b.v - a.v);
    const n = Math.max(1, min);
    return idx.slice(0, Math.min(n, max, idx.length)).map(x => x.i);
  }
  pickTributes(msg) {
    const sorted = msg.selects.map((s, i) => ({ i, a: this.card(s.code).atk, r: s.release_param || 1 })).sort((a, b) => a.a - b.a);
    const out = []; let sum = 0;
    for (const s of sorted) { if (sum >= msg.min) break; out.push(s.i); sum += s.r; }
    return out;
  }
  selectUnselect(msg) {
    if (msg.can_finish && (msg.unselect_cards.length >= msg.min || msg.select_cards.length === 0)) return { type: R.SELECT_UNSELECT_CARD, index: null };
    if (msg.select_cards.length) {
      const pick = this.pickCards(msg.select_cards, 1, 1, msg.player)[0];
      return { type: R.SELECT_UNSELECT_CARD, index: pick };
    }
    return { type: R.SELECT_UNSELECT_CARD, index: null };
  }
  chain(msg) {
    if (!msg.selects.length) return { type: R.SELECT_CHAIN, index: null };
    if (msg.forced) return { type: R.SELECT_CHAIN, index: 0 };
    // Cadena simple: activar cartas propias con buena probabilidad (trampas, efectos rápidos)
    // Las cartas que potencian a un monstruo propio solo sirven en batalla y con un monstruo boca arriba.
    const v = this.view ? this.view(msg.player) : null; const inBattle = v && (v.phase & 0xF8) !== 0;
    const ok = msg.selects.map((s, i) => i).filter((i) => !this.isBuff(msg.selects[i].code) || (inBattle && v.me.monsters.some((m) => m && m.faceup)));
    const p = 0.55 + this.skill * 0.35;
    if (ok.length && this.rng() < p) return { type: R.SELECT_CHAIN, index: ok[Math.floor(this.rng() * ok.length)] };
    return { type: R.SELECT_CHAIN, index: null };
  }
  pickPlaces(msg) {
    const out = []; const taken = new Set();
    const order = msg.type === M.SELECT_DISFIELD ? [16, 0] : [0, 16];
    for (const base of order) for (const [loc, from, n] of [[L.MZONE, 0, 7], [L.SZONE, 8, 8]]) for (let s = 0; s < n; s++) {
      const bit = base + from + s;
      if (out.length >= msg.count) return out;
      if (!(msg.field_mask & (1 << bit)) && !taken.has(bit)) {
        taken.add(bit);
        const player = base === 0 ? msg.player : 1 - msg.player;
        out.push({ player, location: loc, sequence: s });
      }
    }
    return out;
  }
  pickPosition(msg) {
    const c = this.card(msg.code); const opts = msg.positions;
    const prefAtk = c.atk >= c.def;
    const order = prefAtk ? [FACEUP_ATK, FACEUP_DEF, FACEDOWN_DEF, FACEDOWN_ATK] : [FACEUP_DEF, FACEUP_ATK, FACEDOWN_DEF, FACEDOWN_ATK];
    return order.find(p => opts & p) || FACEUP_ATK;
  }
  pickCounters(msg) {
    let left = msg.count; return msg.cards.map(c => { const t = Math.min(c.count, left); left -= t; return t; });
  }
  pickSum(msg) {
    const must = msg.selects_must.map(s => s.amount & 0xffff).reduce((a, b) => a + b, 0);
    const target = msg.amount - must; const items = msg.selects;
    const amt = (s) => [s.amount & 0xffff, (s.amount >>> 16) & 0xffff].filter(Boolean);
    const n = items.length; let best = null;
    for (let mask = 1; mask < (1 << Math.min(n, 16)); mask++) {
      const chosen = []; let sums = [0];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) { chosen.push(i); const opts = amt(items[i]); sums = sums.flatMap(s => opts.map(o => s + o)); }
      const ok = msg.select_max ? sums.some(s => s >= target) : sums.includes(target);
      if (ok && (!best || chosen.length < best.length)) best = chosen;
    }
    const mustIdx = msg.selects_must.map((_, i) => i);
    return [...mustIdx, ...(best || [0]).map(i => i + msg.selects_must.length)];
  }
  bits(avail, count) {
    const out = [];
    if (typeof avail === "bigint") { for (let b = 0n; b < 64n && out.length < count; b++) if (avail & (1n << b)) out.push(Number(1n << b)); }
    else { for (let b = 0; b < 32 && out.length < count; b++) if (avail & (1 << b)) out.push(1 << b); }
    return out;
  }
  announceCard(msg) {
    // Declara una carta conocida del pool que cumpla los opcodes; por simplicidad, la primera carta registrada.
    return this.cards.firstMatching ? this.cards.firstMatching(msg.opcodes) : 0;
  }
}
