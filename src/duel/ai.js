// IA rival. Responde a cualquier selección del motor, eligiendo siempre entre las opciones que el motor ofrece.
// No hace trampa: solo usa la vista pública del campo (runner.view) y lo que el duelo muestra a los dos jugadores.
// Decide con dos cosas, sin listas de cartas por nombre:
//  - el perfil de cada carta (profile.js): qué hace, leído de su texto. Sirve para un mazo que nunca vio;
//  - una valoración del tablero (monstruos, cartas, LP) y un plan de batalla que prueba los ataques posibles.
// "skill" (0..1): con 1 juega lo mejor que sabe; con menos, se equivoca a propósito (duelistas tempranos).
import { OcgMessageType as M } from "../ocg/type_message.js";
import { OcgResponseType as R, SelectIdleCMDAction as IDLE, SelectBattleCMDAction as BATTLE } from "../ocg/type_response.js";
import { OcgLocation as L } from "../ocg/type_core.js";
import { A, T } from "./profile.js";

const FACEUP_ATK = 0x1, FACEDOWN_ATK = 0x2, FACEUP_DEF = 0x4, FACEDOWN_DEF = 0x8;
const TYPE_MONSTER = 0x1, TYPE_SPELL = 0x2, TYPE_TRAP = 0x4, TYPE_TOKEN = 0x4000, TYPE_QUICKPLAY = 0x10000, TYPE_CONTINUOUS = 0x20000,
  TYPE_EQUIP = 0x40000, TYPE_FIELD = 0x80000, TYPE_FLIP = 0x200000;
const PHASE_MAIN2 = 0x100, PHASE_END = 0x200, PHASE_BATTLE_ANY = 0xf8;
const LETHAL = 1e6;
const EMPTY = Object.freeze({ a: 0, t: 0 });
// Para qué pide elegir el motor (constant.lua, HINTMSG_*).
const H = { RELEASE: 500, DISCARD: 501, DESTROY: 502, REMOVE: 503, TOGRAVE: 504, RTOHAND: 505, ATOHAND: 506, TODECK: 507, SUMMON: 508, SPSUMMON: 509,
  FMATERIAL: 511, FACEUP_OPP: 514, SELF_SIDE: 515, EQUIP: 518, CONTROL: 520, CONFIRM: 526, TOFIELD: 527, POSCHANGE: 528, SELF: 529, OPPO: 530,
  TRIBUTE: 531, ATTACKTARGET: 549, NEGATE: 575, ATKDEF: 576 };
// Probabilidad de destruir a un monstruo boca abajo según el ATK del atacante (DEF típica de lo que se coloca).
const P_KILL = [[0, 0.08], [500, 0.12], [1000, 0.3], [1400, 0.5], [1700, 0.65], [1900, 0.75], [2100, 0.9], [2500, 0.95], [2700, 0.98]];
function pKill(atk) {
  for (let i = 1; i < P_KILL.length; i++) if (atk <= P_KILL[i][0]) { const [x0, y0] = P_KILL[i - 1], [x1, y1] = P_KILL[i]; return y0 + ((y1 - y0) * (atk - x0)) / (x1 - x0); }
  return 0.98;
}

// Probabilidad de que el rival ponga en juego un atacante con más ATK que este valor (para medir qué tan expuesto queda un monstruo).
const P_OVER = [[0, 0.95], [800, 0.85], [1200, 0.7], [1500, 0.5], [1800, 0.28], [2000, 0.15], [2400, 0.07], [3000, 0.02]];
function pOver(x) {
  for (let i = 1; i < P_OVER.length; i++) if (x <= P_OVER[i][0]) { const [x0, y0] = P_OVER[i - 1], [x1, y1] = P_OVER[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return 0.02;
}

/** Pesos de la valoración. Escala: una carta ≈ 1000 y 1 LP ≈ 0,5 con los LP llenos. La Fase 3 los ajusta con el simulador. */
export const DEFAULT_WEIGHTS = {
  monBase: 450, monAtk: 0.45, monDef: 0.12, effect: 1, token: 200, unknownMon: 900, spell: 700,
  boss: 1500,           // extra de un monstruo de 3 sacrificios: suele decidir el duelo
  bigAtk: 0.5,          // extra por cada punto de ATK por encima de 2000: casi nada lo vence en batalla
  dmg: 0.45,            // valor de 1 punto de daño con 8000 LP; crece cuando quedan pocos
  tempo: 250,           // tener el monstruo en el campo y no en la mano
  tributeLoss: 1,       // cuánto pesa lo sacrificado al invocar (menos de 1: sacrifica con más ganas)
  unclog: 400,          // extra por bajar un monstruo de sacrificio: en la mano es una carta muerta
  flipGain: 0, flipExpose: 0.2, // cuánto tiene que rendir pasar un monstruo a ataque, y cuánto pesa dejarlo expuesto
  tradeBias: 60,        // lo que cuesta cambiar monstruo por monstruo
  flipRisk: 150,        // riesgo de atacar a un boca abajo (efectos de Volteo)
  removeMin: 1100,      // valor mínimo de un monstruo para gastarle una carta
  reviveMin: 1500,      // ATK mínimo para gastar una carta de revivir
  trapMin: 1400,        // ATK mínimo para gastar una trampa de Invocación
  protectDmg: 1000,     // daño que justifica una carta de protección
  kuribohDmg: 1000,     // daño que justifica descartar un protector de la mano
  healBelow: 7000,      // se cura por debajo de estos LP
  exposeKnown: 0.6, exposeUnknown: 0.5, hiddenBonus: 0.8, // riesgo de dejar un monstruo donde lo pueden destruir
};

export class DuelAI {
  /** @param {{cards: import('./cards.js').CardDB, skill?: number, rng?: () => number, weights?: Partial<typeof DEFAULT_WEIGHTS>}} o */
  constructor(o) {
    this.cards = o.cards; this.skill = o.skill ?? 0.8; this.rng = o.rng || Math.random;
    this.w = { ...DEFAULT_WEIGHTS, ...(o.weights || {}) };
    this.idleCount = 0; this.lastTurnKey = null; this.tried = new Set(); this.links = []; this.me = 0;
  }

  /** Estado visible del campo, provisto por el runner. */
  setView(fn) { this.view = fn; }
  V() { return (this._v ??= this.view ? this.view(this.me) : null); }

  /** Mensajes del duelo que ven los dos jugadores: qué se activa, quién ataca a quién, qué se invoca. */
  observe(m) {
    switch (m.type) {
      case M.HINT: if (m.hint_type === 3) (this.hints ??= {})[m.player] = Number(m.hint); break;
      case M.NEW_TURN: this.turnPlayer = m.player; this.attack = null; this.lastSummon = null; this.links = []; this.chainTop = null; break;
      case M.NEW_PHASE: this.attack = null; this.lastSummon = null; break;
      case M.SUMMONING: case M.SPSUMMONING: case M.FLIPSUMMONING:
        this.lastSummon = { code: m.code, controller: m.controller, seq: m.sequence, special: m.type === M.SPSUMMONING }; break;
      case M.CHAINING: this.chainTop = this.links[m.chain_size] = { code: m.code, player: m.triggering_controller }; this.current = m.code; this.currentPlayer = m.triggering_controller; this.solving = false; break;
      case M.CHAIN_SOLVING: { const l = this.links[m.chain_size]; if (l) { this.current = l.code; this.currentPlayer = l.player; } this.solving = true; this.chainTop = null; break; }
      case M.CHAIN_END: this.links = []; this.current = 0; this.chainTop = null; this.solving = false; this.pendingAct = 0; this.lastSummon = null; break;
      case M.ATTACK: this.attack = { attacker: m.card, target: m.target, handled: false, resolved: false }; this.lastSummon = null; break;
      case M.BATTLE: if (this.attack) this.attack.resolved = true; break;
      case M.ATTACK_DISABLED: case M.DAMAGE_STEP_END: this.attack = null; break;
      case M.TOSS_COIN: this.coinBad = this.coinFresh ? (m.results[0] ? 0 : 1) !== this.coinCall : !m.results[0]; this.coinFresh = false; break;
    }
  }

  card(code) { return this.cards.get(code) || { atk: 0, def: 0, type: 0, level: 0, race: 0, attribute: 0, name: "?" }; }
  /** ATK y DEF de la carta impresa. Si es "?" (depende de su efecto), se estima por lo que cuesta invocarla. */
  stats(code) {
    const c = this.card(code); if (c.atk >= 0 && c.def >= 0) return { atk: c.atk, def: c.def };
    const p = this.prof(code), v = this.V();
    const est = p.perHand ? p.perHand * Math.max(0, (v ? v.me.hand : 3) - 1) : (p.t & T.ALL_IN) ? 0 : 1000 * Math.max(1, this.tributesFor(code));
    return { atk: c.atk < 0 ? est : c.atk, def: c.def < 0 ? est : c.def };
  }
  prof(code) { return (code && this.cards.profile?.(code)) || EMPTY; }
  /** Error a propósito: más probable cuanto menor es la habilidad. Con skill 1 no ocurre nunca. */
  blunder(k = 1) { return this.rng() < (1 - this.skill) * k; }

  respond(msg) {
    this.me = msg.player; this._v = null;
    switch (msg.type) {
      case M.SELECT_IDLECMD: return this.idle(msg);
      case M.SELECT_BATTLECMD: return this.battle(msg);
      case M.SELECT_EFFECTYN: return { type: R.SELECT_EFFECTYN, yes: this.effectYN(msg) };
      case M.SELECT_YESNO: return { type: R.SELECT_YESNO, yes: this.yesNo(msg) };
      case M.SELECT_OPTION: return { type: R.SELECT_OPTION, index: this.option(msg) };
      case M.SELECT_CARD: return { type: R.SELECT_CARD, indicies: this.pickCards(msg.selects, msg.min, msg.max, msg.player) };
      case M.SELECT_TRIBUTE: return { type: R.SELECT_TRIBUTE, indicies: this.pickTributes(msg) };
      case M.SELECT_UNSELECT_CARD: return this.selectUnselect(msg);
      case M.SELECT_CHAIN: return this.chain(msg);
      case M.SELECT_PLACE: case M.SELECT_DISFIELD: return { type: msg.type === M.SELECT_PLACE ? R.SELECT_PLACE : R.SELECT_DISFIELD, places: this.pickPlaces(msg) };
      case M.SELECT_POSITION: return { type: R.SELECT_POSITION, position: this.pickPosition(msg) };
      case M.SELECT_COUNTER: return { type: R.SELECT_COUNTER, counters: this.pickCounters(msg) };
      case M.SELECT_SUM: return { type: R.SELECT_SUM, indicies: this.pickSum(msg) };
      case M.SORT_CARD: case M.SORT_CHAIN: return { type: R.SORT_CARD, order: null };
      case M.ANNOUNCE_RACE: return { type: R.ANNOUNCE_RACE, races: this.announceRace(msg) };
      case M.ANNOUNCE_ATTRIB: return { type: R.ANNOUNCE_ATTRIB, attributes: this.announceAttrib(msg) };
      case M.ANNOUNCE_CARD: return { type: R.ANNOUNCE_CARD, card: this.announceCard(msg) };
      case M.ANNOUNCE_NUMBER: return { type: R.ANNOUNCE_NUMBER, value: this.announceNumber(msg) };
      case M.ROCK_PAPER_SCISSORS: return { type: R.ROCK_PAPER_SCISSORS, value: 1 + Math.floor(this.rng() * 3) };
    }
    return null;
  }

  // ---------- Valoración ----------
  /** Cuánto vale un monstruo en el campo (objeto de la vista). */
  monValue(m) {
    if (!m) return 0; const W = this.w;
    if (!m.code) return W.unknownMon;
    const c = this.card(m.code); if (c.type & TYPE_TOKEN) return W.token;
    return W.monBase + W.monAtk * Math.max(0, m.atk) + W.bigAtk * Math.max(0, m.atk - 2000) + W.monDef * Math.max(0, m.def) + (this.prof(m.code).v || 0) * W.effect;
  }
  /** Cuánto vale una carta fuera del campo (mano, Deck, Cementerio). */
  cardValue(code) {
    const c = this.card(code), W = this.w, v = (this.prof(code).v || 0) * W.effect;
    if (!(c.type & TYPE_MONSTER)) return W.spell + v;
    if (c.type & TYPE_TOKEN) return W.token;
    const st = this.stats(code);
    return W.monBase + W.monAtk * st.atk + W.bigAtk * Math.max(0, st.atk - 2000) + W.monDef * st.def + v + (this.tributesFor(code) >= 3 ? W.boss : 0);
  }
  /** Sacrificios que pide la Invocación Normal. */
  tributesFor(code) { const c = this.card(code), lv = c.level & 0xff; return this.prof(code).trib ?? (lv >= 7 ? 2 : lv >= 5 ? 1 : 0); }
  /** Cuánto vale conservar una carta en la mano: un monstruo que no se puede invocar pronto vale menos. */
  handValue(code, v) {
    const c = this.card(code); let x = this.cardValue(code);
    if (c.type & TYPE_MONSTER) { const need = this.tributesFor(code), have = v ? v.me.monsters.filter(Boolean).length : 0; if (need > have) x -= 350 * (need - have); if (this.prof(code).t & T.NO_NS) x -= 300; }
    return x;
  }
  /** Valor de 1 punto de daño según los LP que le quedan a quien lo recibe. */
  dmgValue(d, lp) { return d <= 0 ? 0 : d >= lp ? LETHAL : (d * this.w.dmg * 9000) / (lp + 1000); }
  /** Valor de una carta ofrecida en una selección, esté donde esté. */
  selWorth(s, player, v) {
    const mine = s.controller === player, W = this.w;
    if (s.location & L.MZONE) { const m = v && (mine ? v.me : v.opp).monsters[s.sequence]; return m ? this.monValue(m) : this.cardValue(s.code); }
    if (s.location & L.SZONE) {
      const faceup = (s.position & 0x5) !== 0, p = this.prof(s.code);
      if (!mine) return faceup ? 650 + (p.v || 0) + ((p.a & (A.LOCK | A.CONTROL)) ? 500 : 0) : 850;
      return (faceup ? 450 : 700) + (p.v || 0);
    }
    if (s.location & L.HAND) return mine && s.code ? this.handValue(s.code, v) : 800;
    return s.code ? this.cardValue(s.code) : 500;
  }

  // ---------- Plan de batalla ----------
  attackerOf(m) {
    const p = this.prof(m.code);
    return { seq: m.seq, atk: m.atk, def: m.def, val: this.monValue(m), direct: false, pierce: !!(p.t & T.PIERCE), immune: !!(p.t & T.BATTLE_IMMUNE), cost: !!(p.t & T.ATTACK_COST) };
  }
  defenderOf(m) {
    if (!m.faceup) return { seq: m.seq, hidden: true, val: this.w.unknownMon, attackPos: m.attackPos };
    const p = this.prof(m.code);
    // Destruir en batalla a un monstruo que deja algo al morir rinde menos.
    return { seq: m.seq, atk: m.atk, def: m.def, attackPos: m.attackPos, val: this.monValue(m) - ((p.t & T.FLOATER) ? 500 : 0), immune: !!(p.t & T.BATTLE_IMMUNE) };
  }
  /** Resultado esperado de un ataque: ganancia y qué cambia en el tablero. null = no conviene ni considerarlo. */
  fight(a, t, olp, mlp) {
    const W = this.w;
    if (t.hidden) {
      const p = pKill(a.atk), fail = Math.max(150, 1900 - a.atk) * 0.5;
      const gain = p * t.val - (1 - p) * this.dmgValue(fail, mlp) - W.flipRisk * (a.val / 1500);
      return gain > 0 ? { gain, kill: p >= 0.5, die: false, dOpp: 0, dMe: 0 } : null;
    }
    if (t.attackPos) {
      if (a.atk > t.atk) { const d = a.atk - t.atk, dv = this.dmgValue(d, olp); return { gain: (t.immune ? 0 : t.val) + dv, kill: !t.immune, die: false, dOpp: d, dMe: 0, lethal: dv >= LETHAL }; }
      if (a.atk === t.atk && a.atk > 0) { const g = (t.immune ? 0 : t.val) - (a.immune ? 0 : a.val) - W.tradeBias; return { gain: g, kill: !t.immune, die: !a.immune, dOpp: 0, dMe: 0 }; }
      return null;
    }
    if (a.atk > t.def) { const d = a.pierce ? a.atk - t.def : 0, dv = this.dmgValue(d, olp); return { gain: (t.immune ? 0 : t.val) + dv, kill: !t.immune, die: false, dOpp: d, dMe: 0, lethal: dv >= LETHAL }; }
    return null;
  }
  /**
   * Prueba las secuencias de ataques posibles y devuelve la mejor: { value, first: {i, j} } (j = -1 es ataque directo).
   * fodder: valor del monstruo propio más barato, para los atacantes que deben sacrificar para atacar.
   */
  planBattle(atk, def, oppLp, myLp, fodder = Infinity) {
    let nodes = 0; const n = atk.length, k = def.length;
    const dfs = (used, alive, olp, mlp) => {
      let best = 0, first = null;
      if (++nodes > 6000) return [best, first];
      for (let i = 0; i < n; i++) {
        if (used & (1 << i)) continue; const a = atk[i]; if (a.atk <= 0) continue;
        const cost = a.cost ? fodder : 0; if (cost === Infinity) continue;
        if (!alive || a.direct) {
          const dv = this.dmgValue(a.atk, olp);
          const tot = dv >= LETHAL ? LETHAL : dv - cost + dfs(used | (1 << i), alive, olp - a.atk, mlp)[0];
          if (tot > best) { best = tot; first = { i, j: -1 }; }
          if (!alive) break; // sin monstruos enfrente, el orden de los ataques directos da igual
        }
        for (let j = 0; j < k; j++) {
          if (!(alive & (1 << j))) continue;
          const r = this.fight(a, def[j], olp, mlp); if (!r) continue;
          const tot = r.lethal ? LETHAL : r.gain - cost + dfs(used | (1 << i), r.kill ? alive & ~(1 << j) : alive, olp - r.dOpp, mlp - r.dMe)[0];
          if (tot > best) { best = tot; first = { i, j }; }
        }
      }
      return [best, first];
    };
    const [value, first] = dfs(0, (1 << k) - 1, oppLp, myLp);
    return { value, first };
  }
  /** Plan de batalla sobre el tablero actual con cambios hipotéticos (invocar, potenciar, quitar un monstruo rival...). */
  simPlan(v, o = {}) {
    const mine = v.me.monsters.filter(Boolean).filter((m) => !o.remove?.includes(m.seq));
    const fodder = mine.length + (o.add ? o.add.length : 0) > 1 ? Math.min(...mine.map((m) => this.monValue(m))) : Infinity;
    let atk = mine.filter((m) => (m.faceup && m.attackPos) || o.toAtk === m.seq).filter((m) => !(this.prof(m.code).t & T.CANT_ATTACK)).map((m) => this.attackerOf(m));
    if (o.add) atk = atk.concat(o.add);
    let def = v.opp.monsters.filter(Boolean).filter((m) => !o.removeOpp?.includes(m.seq)).map((m) => this.defenderOf(m));
    if (o.up) for (const a of atk) if (o.upSeq == null || o.upSeq === a.seq) a.atk += o.up;
    if (o.down) for (const d of def) if (!d.hidden) { d.atk = Math.max(0, d.atk - o.down); d.def = Math.max(0, d.def - o.down); }
    if (o.swap) { for (const a of atk) [a.atk, a.def] = [a.def, a.atk]; for (const d of def) if (!d.hidden) [d.atk, d.def] = [d.def, d.atk]; }
    if (o.pos) for (const d of def) if (d.seq === o.pos.seq && !d.hidden) d.attackPos = o.pos.attack;
    return this.planBattle(atk, def, v.opp.lp, v.me.lp, fodder);
  }

  // ---------- Fase principal ----------
  mainCtx(msg, v) {
    const my = v.me.monsters.filter(Boolean), op = v.opp.monsters.filter(Boolean);
    const isMain2 = (v.phase & PHASE_MAIN2) !== 0, canBattle = !!msg.to_bp && !isMain2 && this.noBP !== v.turn;
    const opUp = op.filter((m) => m.faceup);
    const oppBest = Math.max(0, ...opUp.map((m) => m.atk));                                   // el ATK más alto que se ve enfrente
    const oppWall = Math.max(0, ...opUp.map((m) => (m.attackPos ? m.atk : m.def)));          // lo más duro de vencer en batalla
    const myBestAtk = Math.max(0, ...my.filter((m) => m.faceup).map((m) => m.atk));
    const myVal = my.reduce((s, m) => s + this.monValue(m), 0), oppVal = op.reduce((s, m) => s + this.monValue(m), 0);
    const oppBestVal = Math.max(0, ...op.map((m) => this.monValue(m)));
    const plan = canBattle ? this.simPlan(v) : { value: 0, first: null };
    const oppST = v.opp.spellCount + (v.opp.field ? 1 : 0);
    return { my, op, opUp, isMain2, canBattle, oppBest, oppWall, myBestAtk, myVal, oppVal, oppBestVal, plan, oppST,
      nsFree: this.nsUsed !== v.turn, hand: v.me.handCodes || [] };
  }
  idle(msg) {
    const v = this.V(); const key = v.turn + ":" + v.phase;
    if (key !== this.lastTurnKey) { this.lastTurnKey = key; this.idleCount = 0; this.tried = new Set(); this.sloppyTurn = this.blunder(0.9); }
    if (++this.idleCount > 30) return this.endIdle(msg);
    const ctx = this.mainCtx(msg, v);
    const act = (action, index) => ({ type: R.SELECT_IDLECMD, action, index });

    // 1) Activar cartas y efectos, del más valioso al menos.
    let best = null;
    msg.activates.forEach((a, i) => {
      const k = a.code + ":" + a.location + ":" + a.sequence + ":" + a.description; if (this.tried.has(k)) return;
      let s = this.actScore(a, msg, v, ctx);
      // En un turno torpe gasta las mágicas de la mano aunque no convenga (nunca las que lo dañan).
      if (s === 0 && this.sloppyTurn && a.location === L.HAND) s = 1;
      if (s > 0 && (!best || s > best.s)) best = { i, s, k, code: a.code };
    });
    if (best) { this.tried.add(best.k); this.pendingAct = best.code; return act(IDLE.SELECT_ACTIVATE, best.i); }

    // 2) Invocaciones Especiales propias de la carta.
    let sp = null;
    msg.special_summons.forEach((s, i) => { const x = this.specialScore(s, v, ctx); if (x > 0 && (!sp || x > sp.x)) sp = { i, x, code: s.code }; });
    if (sp) { this.pendingAct = sp.code; return act(IDLE.SELECT_SPECIAL_SUMMON, sp.i); }

    // 3) Efectos de Volteo que ya tienen sobre qué caer: antes de invocar, porque cambian el campo.
    for (let i = 0; i < msg.pos_changes.length; i++) {
      const m = v.me.monsters[msg.pos_changes[i].sequence]; if (!m || m.faceup) continue;
      if (this.wantFlip(m, v, ctx)) return act(IDLE.SELECT_POS_CHANGE, i);
    }
    // Invocación Normal o colocar un monstruo.
    const sm = this.summonChoice(msg, v, ctx);
    if (sm) { this.nsUsed = v.turn; this.pendingAct = sm.code; return act(sm.kind === "summon" ? IDLE.SELECT_SUMMON : IDLE.SELECT_MONSTER_SET, sm.i); }

    // 4) Voltear o pasar a ataque lo que sirva antes de la batalla.
    const willBattle = ctx.canBattle && ctx.plan.value > 0;
    for (let i = 0; i < msg.pos_changes.length; i++) {
      const m = v.me.monsters[msg.pos_changes[i].sequence]; if (!m || (m.faceup && m.attackPos)) continue;
      if (this.wantToAttackPos(m, v, ctx)) return act(IDLE.SELECT_POS_CHANGE, i);
    }
    // 5) Batalla.
    if (willBattle && !(this.sloppyTurn && this.blunder(0.3))) return act(IDLE.TO_BP, 0);
    if (ctx.canBattle && this.sloppyTurn && ctx.my.some((m) => m.faceup && m.attackPos && m.atk >= 1500)) return act(IDLE.TO_BP, 0);

    // 6) Sin más ataques este turno: poner en defensa lo que quedaría expuesto y colocar trampas.
    if (!this.sloppyTurn) for (let i = 0; i < msg.pos_changes.length; i++) {
      const m = v.me.monsters[msg.pos_changes[i].sequence]; if (!m || !m.faceup || !m.attackPos) continue;
      if (this.wantDefense(m, ctx)) return act(IDLE.SELECT_POS_CHANGE, i);
    }
    let set = null;
    if (v.me.spellCount < 4) msg.spell_sets.forEach((s, i) => {
      const c = this.card(s.code); if (!(c.type & TYPE_TRAP) && !(c.type & TYPE_QUICKPLAY)) return;
      const x = 1 + (this.prof(s.code).v || 0); if (!set || x > set.x) set = { i, x };
    });
    if (set) return act(IDLE.SELECT_SPELL_SET, set.i);
    return this.endIdle(msg);
  }
  endIdle(msg) {
    if (msg.to_ep) return { type: R.SELECT_IDLECMD, action: IDLE.TO_EP, index: 0 };
    return { type: R.SELECT_IDLECMD, action: IDLE.TO_BP, index: 0 };
  }
  /** ¿Puede pagar el costo en LP sin quedar al borde? */
  canPay(p, v, ctx) {
    if (!p.lp) return true; const lp = v.me.lp;
    if (p.lp > 0) return lp - p.lp >= 1500;
    return lp > 1500 && (lp / 2 <= 3000 || (ctx ? ctx.oppVal > ctx.myVal : true)); // mitad de los LP: solo barato o yendo atrás
  }
  /** Monstruos propios (campo y mano) y rivales a los que ayuda un campo o un equipo con restricción. */
  matches(p, code) { const c = this.card(code); return (p.race ? (Number(c.race) & p.race) !== 0 : false) || (p.attr ? (c.attribute & p.attr) !== 0 : false) || (!p.race && !p.attr); }
  /** Mejor monstruo para revivir: ATK más alto en mi Cementerio (y en el del rival si la carta lo permite). */
  bestRevive(p, v) {
    let best = 0;
    for (const code of v.me.grave.concat(p.any ? v.opp.grave : [])) { const c = this.card(code), atk = this.stats(code).atk; if ((c.type & TYPE_MONSTER) && !(this.prof(code).t & T.NO_NS) && atk > best) best = atk; }
    return best;
  }
  /** ¿Hay un monstruo rival que no puedo vencer en batalla y vale una carta? */
  needRemoval(v, ctx) {
    if (!ctx.op.length) return false;
    if (ctx.oppWall >= ctx.myBestAtk && ctx.oppBestVal >= this.w.removeMin) return true;
    // O quitando al mejor monstruo rival gano este turno.
    if (ctx.canBattle) { const top = ctx.op.reduce((a, b) => (this.monValue(a) >= this.monValue(b) ? a : b)); if (this.simPlan(v, { removeOpp: [top.seq] }).value >= LETHAL) return true; }
    return false;
  }
  /**
   * Cuánto conviene activar ahora esta carta o efecto en mi fase principal.
   * > 0: activar (más alto, antes). 0: guardarla. -1: nunca (me perjudica).
   */
  actScore(a, msg, v, ctx) {
    const c = this.card(a.code), p = this.prof(a.code), W = this.w;
    const fromHand = a.location === L.HAND, isMon = (c.type & TYPE_MONSTER) !== 0;
    if (fromHand && (c.type & TYPE_TRAP)) return -1;
    if (!this.canPay(p, v, ctx)) return -1;
    if (isMon) return this.monEffectScore(a, c, p, v, ctx);
    const { my, op } = ctx; const weakest = my.length ? Math.min(...my.map((m) => this.monValue(m))) : Infinity;
    const st = a.location === L.SZONE ? v.me.spells.find((s) => s.seq === a.sequence) : null;
    const pa = p.a, pt = p.t;

    // --- razones para no activarla ahora ---
    if (pt & (T.ON_ATTACK | T.ON_SUMMON | T.ON_ACTIVATE)) return 0;
    if ((pt & T.HEAVY_COST) && v.me.hand + my.length + v.me.spellCount > 3) return -1;
    if ((pt & T.NO_SUMMON) && ctx.nsFree && msg.summons.length + msg.monster_sets.length > 0) return 0;
    if ((pt & T.COST_TRIBUTE) && weakest > 1300) return 0;
    if ((pt & T.COST_DISCARD) && v.me.hand < (fromHand ? 2 : 1)) return 0;
    if ((pt & T.SELF_DAMAGE) && v.me.lp <= 2000) return -1;
    if (pt & T.TRIBUTE_OPP) {
      const boss = ctx.hand.some((h) => { const n = this.tributesFor(h); return n >= 1 && n <= 1 + my.length && !(this.prof(h).t & T.NO_NS); });
      if (!boss || !ctx.nsFree || !op.length) return 0;
      if (ctx.canBattle && ctx.plan.value > ctx.oppBestVal + 500) return 0; // la batalla rinde más que perderla por el sacrificio
      return 780;
    }
    if (pt & T.NO_BP) { if (ctx.canBattle && ctx.plan.value > 0) return 0; }
    if (pt & T.LEVEL_DOWN) {
      const helps = ctx.nsFree && ctx.hand.some((h) => { const n = this.tributesFor(h), lv = this.card(h).level & 0xff; return n > my.length && lv >= 5 && (lv <= 6 || my.length >= 1) && !(this.prof(h).t & T.NO_NS); });
      return helps && v.me.hand >= 3 ? 760 : 0;
    }
    if (pa & A.WIPE_ALL) return ctx.oppVal - ctx.myVal > 500 ? 880 : -1;
    if (pa & A.WIPE_OPP) {
      if (!op.length) return 0;
      const strong = op.length >= 2 || ctx.oppBestVal >= W.removeMin + 200 || this.needRemoval(v, ctx);
      return strong ? 870 : 0;
    }
    if (pa & A.REMOVE_MON) {
      if (!op.length) return (pa & A.REMOVE_ST) && ctx.oppST ? 600 : 0;
      if (pt & T.ALL_FIELD) { // la carta elige sola al de más ATK del campo: que sea del rival
        const mineMax = Math.max(-1, ...my.filter((m) => m.faceup && m.attackPos).map((m) => m.atk)), oppMax = Math.max(-1, ...op.filter((m) => m.faceup && m.attackPos).map((m) => m.atk));
        if (oppMax <= mineMax) return -1;
      }
      if (pt & T.GIFT) { if (!my.length || weakest > 1000) return 0; }
      if ((pt & T.COST_DISCARD) && ctx.oppBest < 1800) return 0;
      return this.needRemoval(v, ctx) ? 860 : 0;
    }
    if (pa & A.WIPE_ST) return ctx.oppST >= 2 || (ctx.oppST >= 1 && v.me.spellCount <= 1) ? 840 : 0;
    if (pa & A.REMOVE_ST) return ctx.oppST ? 830 : 0;
    if (pa & A.CONTROL) {
      const tgt = Math.max(0, ...ctx.opUp.map((m) => m.atk));
      if (!ctx.opUp.length || tgt < 1400) return 0;
      if (!(c.type & TYPE_EQUIP) && !ctx.canBattle) return 0; // control por un turno: solo si puedo atacar con él
      return 850;
    }
    if (pa & A.REVIVE) {
      if (pt & T.GIFT) { const mine = Math.max(0, ...v.me.grave.map((g) => this.card(g).atk || 0)), theirs = Math.max(0, ...v.opp.grave.map((g) => this.card(g).atk || 0)); return mine > theirs && mine >= 1400 ? 700 : 0; }
      const b = this.bestRevive(p, v);
      return b >= W.reviveMin || (!my.length && b >= 1000 && op.length) ? 800 + b / 100 : 0;
    }
    if (pa & (A.DRAW | A.SEARCH | A.RECOVER)) {
      if (/skip your next/i.test(this.cards.raw?.[a.code]?.[10] || "") && v.me.hand > 2) return 0; // roba ahora, no roba después: solo con la mano vacía
      return 900 + (p.v || 0) / 10;
    }
    if (pa & (A.FUSION | A.RITUAL)) return 820;
    if (pa & A.HANDKILL) return v.opp.hand > 0 ? 650 : 0;
    if (pa & A.LOCK) { const threatened = ctx.oppBest > ctx.myBestAtk || (!my.length && op.length > 0); return threatened ? 640 : 0; }
    if (pa & A.TOKEN) { // fichas: para defenderse o para pagar ataques con sacrificio
      const needsFodder = my.some((m) => this.prof(m.code).t & T.ATTACK_COST);
      return (!my.length && op.length) || needsFodder ? 500 : 0;
    }
    if (pa & A.SUMMON) {
      if (pt & T.GIFT) return v.me.banished.length > v.opp.banished.length ? 700 : 0;
      return 790;
    }
    if (pa & A.POSITION) {
      if (!ctx.canBattle) return 0;
      let g = 0;
      for (const m of ctx.opUp) { if (p.pos === 1 && m.attackPos) continue; if (p.pos === 2 && !m.attackPos) continue; g = Math.max(g, this.simPlan(v, { pos: { seq: m.seq, attack: !m.attackPos } }).value - ctx.plan.value); }
      return g >= 400 ? 720 : 0;
    }
    if (pa & A.BUFF) {
      if (c.type & TYPE_FIELD) {
        if (v.me.field && v.me.fieldCode === a.code) return 0;
        const mine = my.filter((m) => m.faceup && this.matches(p, m.code)).length + ctx.hand.filter((h) => (this.card(h).type & TYPE_MONSTER) && this.matches(p, h)).length;
        const theirs = ctx.opUp.filter((m) => this.matches(p, m.code)).length;
        return mine > 0 && mine >= theirs ? 600 : 0;
      }
      if (c.type & TYPE_EQUIP) return my.some((m) => m.faceup && this.matches(p, m.code)) ? 560 + (p.up || 0) / 10 : -1;
      if (!ctx.canBattle) return 0;
      const g = (p.swap ? this.simPlan(v, { swap: 1 }) : this.bestBuff(v, p.up || 0)).value - ctx.plan.value;
      return g >= 400 ? 730 : 0;
    }
    if (pa & A.DEBUFF) { if (!ctx.canBattle) return 0; return this.simPlan(v, { down: Math.min(p.down || 0, 3000) }).value - ctx.plan.value >= 400 ? 730 : 0; }
    if (pa & A.BURN) return 620 + (p.burn || 0) / 10;
    if (pa & A.HEAL) return v.me.lp <= W.healBelow || v.me.hand >= 6 ? 400 : 0;
    if (pa & (A.PROTECT | A.NEGATE)) return 0;
    if (pt & (T.COST_DISCARD | T.COST_TRIBUTE)) return 0;       // efecto desconocido y con costo: no
    if (p.lp && v.me.lp < 4000) return 0;
    if (st && st.faceup && p.lp) return ctx.hand.some((h) => this.card(h).type & TYPE_MONSTER) ? 300 : 0;
    return 350;                                                    // sin categoría conocida: se usa (como antes)
  }
  /** El mejor resultado de sumarle ATK a uno de mis atacantes. */
  bestBuff(v, up) {
    let best = { value: 0, first: null };
    for (const m of v.me.monsters) { if (!m || !m.faceup || !m.attackPos) continue; const r = this.simPlan(v, { up, upSeq: m.seq }); if (r.value > best.value) best = r; }
    return best;
  }
  /** Efectos de monstruos que se activan a mano en la fase principal. */
  monEffectScore(a, c, p, v, ctx) {
    const { my, op } = ctx; const pa = p.a, pt = p.t;
    const self = a.location === L.MZONE ? v.me.monsters[a.sequence] : null, selfVal = self ? this.monValue(self) : 0;
    const others = my.filter((m) => m !== self), weakest = others.length ? Math.min(...others.map((m) => this.monValue(m))) : Infinity;
    if (pa & A.GAMBLE) {
      // Apuestas que pueden salir en mi contra: solo yendo atrás en el campo.
      if (pa & (A.WIPE_OPP | A.WIPE_ALL)) return op.length && ctx.oppVal > ctx.myVal + 300 && (!(pt & T.SELF_DAMAGE) || v.me.lp > 2500) ? 700 : 0;
      if (pt & T.ALL_FIELD) return op.length ? 500 : 0;
    }
    if (pt & T.SELF_FLIPDOWN) {
      if (ctx.canBattle && ctx.plan.value > 0) return 0;
      return (pt & T.FLIP_SUMMON) || (c.type & TYPE_FLIP) || (self && self.atk < ctx.oppBest) ? 380 : 0;
    }
    if (pt & T.SELF_TRIBUTE) {
      if (pa & A.SUMMON) return 800;
      if (pa & A.REMOVE_MON) return op.length && ctx.oppBestVal > selfVal ? 700 : 0;
      return 0;
    }
    if (pt & T.COST_TRIBUTE) {
      const k = pa & A.WIPE_OPP ? 2 : 1; if (others.length < k) return 0;
      const cost = others.map((m) => this.monValue(m)).sort((x, y) => x - y).slice(0, k).reduce((s, x) => s + x, 0);
      const gain = pa & A.WIPE_OPP ? ctx.oppVal : pa & A.REMOVE_MON ? ctx.oppBestVal : pa & A.SUMMON ? 1200 : 0;
      return gain - cost > 300 ? 650 : 0;
    }
    if ((pt & T.COST_DISCARD) && v.me.hand < 1) return 0;
    if (pa & (A.REMOVE_MON | A.WIPE_OPP | A.BOUNCE)) {
      if (!op.length) return 0;
      // Si usar el efecto le impide atacar, solo contra lo que no vence en batalla.
      if ((pt & (T.CANT_ATTACK | T.COST_DISCARD)) && self && ctx.oppWall < self.atk && ctx.canBattle) return 0;
      return 750;
    }
    if (pa & A.REMOVE_ST) return ctx.oppST ? 740 : 0;
    if (pa & A.BUFF) return ctx.canBattle || a.location !== L.MZONE ? 420 : 0;
    return 400;
  }
  /** Invocaciones Especiales que la carta trae de fábrica (desde la mano). */
  specialScore(s, v, ctx) {
    const p = this.prof(s.code), c = this.card(s.code);
    if (p.t & T.GIFT) {
      if (p.t & T.COST_TRIBUTE) { // se la doy al rival a cambio de sus monstruos
        const vals = ctx.op.map((m) => this.monValue(m)).sort((x, y) => y - x);
        return vals.length >= 2 && vals[0] + vals[1] - this.cardValue(s.code) > 300 && ctx.oppBest >= ctx.myBestAtk ? 500 : 0;
      }
      // Le deja revivir un monstruo al rival: solo si no tiene nada bueno, o si me habilita un sacrificio.
      const gift = Math.max(0, ...v.opp.grave.map((g) => ((this.card(g).type & TYPE_MONSTER) ? this.card(g).atk : 0)));
      const boss = ctx.nsFree && ctx.hand.some((h) => { const n = this.tributesFor(h); return n >= 1 && n <= ctx.my.length + 1 && !(this.prof(h).t & T.NO_NS); });
      if (gift > c.atk && !(boss && gift < 2000)) return 0;
    }
    return 500 + c.atk / 10;
  }
  /** Elige qué monstruo invocar o colocar, comparando lo que gana cada opción con lo que arriesga. */
  summonChoice(msg, v, ctx) {
    const W = this.w, my = ctx.my; const opts = [];
    const fodderVals = my.map((m) => ({ seq: m.seq, val: this.monValue(m) })).sort((a, b) => a.val - b.val);
    const unknownThreat = v.opp.hand > 0 || ctx.op.some((m) => !m.faceup);
    const add = (s, i, kind) => {
      const c0 = this.card(s.code), p = this.prof(s.code), c = { type: c0.type, ...this.stats(s.code) };
      let need = Math.min(this.tributesFor(s.code), my.length);
      const tributed = fodderVals.slice(0, need); let lost = tributed.reduce((x, f) => x + f.val, 0);
      if (need && this.soulExchange === v.turn) lost -= tributed[tributed.length - 1].val; // ese sacrificio lo pone el rival
      const val = this.cardValue(s.code); let score = val - lost * W.tributeLoss + W.tempo + (need ? W.unclog : 0);
      if (kind === "summon") {
        if (c.type & TYPE_FLIP) score -= (p.v || 0) + 200;
        if (p.t & T.ON_NS) score += (p.v || 0) * 0.5;
        if (ctx.canBattle && !(p.t & T.CANT_ATTACK)) {
          const me = { seq: -1, atk: c.atk, def: c.def, val, direct: false, pierce: !!(p.t & T.PIERCE), immune: !!(p.t & T.BATTLE_IMMUNE), cost: !!(p.t & T.ATTACK_COST) };
          score += this.simPlan(v, { add: [me], remove: tributed.map((f) => f.seq) }).value - ctx.plan.value;
        }
        // Riesgo: queda en ataque frente a algo más fuerte.
        const over = ctx.opUp.filter((m) => m.atk > c.atk).map((m) => m.atk);
        if (over.length && !(p.t & T.BATTLE_IMMUNE)) score -= W.exposeKnown * (val + Math.min(1500, this.dmgValue(Math.max(...over) - c.atk, v.me.lp)));
        else if (over.length) score -= W.exposeKnown * Math.min(1500, this.dmgValue(Math.max(...over) - c.atk, v.me.lp));
        else if (unknownThreat && !(p.t & T.BATTLE_IMMUNE)) score -= W.exposeUnknown * pOver(c.atk) * (val + this.dmgValue(300, v.me.lp));
      } else {
        if (need) score -= 300;
        if (c.type & TYPE_FLIP) score += (p.v || 0) * 0.5;
        if (p.t & T.ON_NS) score -= (p.v || 0) * 0.5;
        if (c.def >= 1800) score += 150;
        const over = ctx.opUp.some((m) => m.atk > c.def);
        if (over && !(p.t & T.BATTLE_IMMUNE)) score -= W.exposeKnown * val * 0.75;
        else if (!over && unknownThreat && !(p.t & T.BATTLE_IMMUNE)) score -= W.exposeUnknown * W.hiddenBonus * pOver(c.def) * val;
        if (!ctx.op.length && ctx.canBattle && c.atk >= 1000) score -= 200; // con el campo rival vacío conviene pegar
      }
      opts.push({ i, kind, code: s.code, score });
    };
    msg.summons.forEach((s, i) => add(s, i, "summon"));
    msg.monster_sets.forEach((s, i) => add(s, i, "set"));
    const good = opts.filter((o) => o.score > 0).sort((a, b) => b.score - a.score);
    if (!good.length) return null;
    if (this.sloppyTurn) {                                          // turno torpe: baja lo de más ATK en ataque, sin medir el riesgo
      const naive = opts.filter((o) => o.kind === "summon").sort((a, b) => this.stats(b.code).atk - this.stats(a.code).atk)[0];
      if (naive) return naive;
    }
    return this.blunder(0.6) && good.length > 1 ? good[1 + Math.floor(this.rng() * (good.length - 1))] : good[0];
  }
  /** Efecto de Volteo de un monstruo propio boca abajo: ¿tiene sobre qué caer ahora? */
  wantFlip(m, v, ctx) {
    const p = this.prof(m.code), c = this.card(m.code), pa = p.a;
    if (m.faceup || !((c.type & TYPE_FLIP) || (p.t & T.FLIP_SUMMON))) return false;
    if ((pa & (A.REMOVE_MON | A.BOUNCE | A.CONTROL)) && ctx.op.length) return true;
    if ((pa & A.REMOVE_ST) && ctx.oppST) return true;
    if ((pa & A.RECOVER) && v.me.grave.some((g) => !(this.card(g).type & TYPE_MONSTER))) return true;
    if ((pa & A.DRAW) && v.me.hand <= 2) return true;
    if (pa & A.BURN) return v.opp.hand >= 2 || v.opp.lp <= 2000;
    return (pa & (A.SUMMON | A.SEARCH)) !== 0;
  }
  /** ¿Conviene voltear o pasar a ataque este monstruo antes de la batalla? */
  wantToAttackPos(m, v, ctx) {
    const p = this.prof(m.code), c = this.card(m.code);
    if (this.wantFlip(m, v, ctx)) return true;
    if (!ctx.canBattle || m.atk <= 0 || (p.t & T.CANT_ATTACK)) return false;
    if (!m.faceup && (c.type & TYPE_FLIP)) return false;          // no se desperdicia un Volteo para pegar
    const gain = this.simPlan(v, { toAtk: m.seq }).value - ctx.plan.value;
    if (gain >= LETHAL / 2) return true;
    const exposed = ctx.opUp.some((o) => o.atk > m.atk) ? this.monValue(m) * this.w.flipExpose : 0;
    return gain - exposed >= this.w.flipGain;
  }
  /** ¿Conviene pasar a defensa un monstruo que quedaría expuesto en el turno rival? */
  wantDefense(m, ctx) {
    const p = this.prof(m.code);
    if (ctx.oppBest > m.atk) return true;                         // lo destruyen igual, pero sin daño
    if (!ctx.opUp.length) return m.atk <= 1000 && m.def >= m.atk && !(p.t & T.BATTLE_IMMUNE) && (ctx.op.length > 0);
    return false;
  }

  // ---------- Batalla ----------
  battle(msg) {
    const v = this.V(); const res = (action, index = 0) => ({ type: R.SELECT_BATTLECMD, action, index });
    const defs = v.opp.monsters.filter(Boolean).map((m) => this.defenderOf(m));
    const mine = v.me.monsters.filter(Boolean);
    const fodder = mine.length > 1 ? Math.min(...mine.map((m) => this.monValue(m))) : Infinity;
    const atk = [], idx = [];
    msg.attacks.forEach((at, i) => { const m = v.me.monsters[at.sequence]; if (!m) return; const a = this.attackerOf(m); a.direct = at.can_direct && defs.length > 0; atk.push(a); idx.push(i); });
    const plan = atk.length ? this.planBattle(atk, defs, v.opp.lp, v.me.lp, fodder) : { value: 0, first: null };
    if (plan.first && !(plan.value < LETHAL && this.blunder(0.3))) {
      const a = atk[plan.first.i]; this.planned = { seq: a.seq, target: plan.first.j < 0 ? "direct" : defs[plan.first.j].seq };
      return res(BATTLE.SELECT_BATTLE, idx[plan.first.i]);
    }
    // Ataque torpe: se tira con algo fuerte aunque no le convenga.
    if (!plan.first && atk.length && this.blunder(0.7)) {
      const i = atk.findIndex((a) => a.atk >= 1500);
      if (i >= 0) { this.planned = null; return res(BATTLE.SELECT_BATTLE, idx[i]); }
    }
    // Cartas activables entre ataques: solo las que no dependen de un ataque en curso.
    const key = v.turn + ":b";
    for (let i = 0; i < msg.chains.length; i++) {
      const s = msg.chains[i], p = this.prof(s.code), k = key + s.code + ":" + s.location + ":" + s.sequence; if (this.tried.has(k)) continue;
      const oppST = v.opp.spellCount + (v.opp.field ? 1 : 0);
      if (((p.a & (A.REMOVE_ST | A.WIPE_ST)) && oppST && !(p.a & A.REMOVE_MON)) || ((p.a & A.DRAW) && !(p.t & (T.COST_DISCARD | T.COST_TRIBUTE)) && this.canPay(p, v))) {
        this.tried.add(k); this.pendingAct = s.code; return res(BATTLE.SELECT_CHAIN, i);
      }
    }
    return msg.to_m2 ? res(BATTLE.TO_M2) : res(BATTLE.TO_EP);
  }

  // ---------- Cadenas y respuestas ----------
  /** Qué pasaría con el ataque rival en curso: daño que recibo y valor del monstruo que pierdo. */
  threat(v) {
    const at = this.attack; if (!at || at.resolved || at.attacker.controller === this.me) return null;
    const a = v.opp.monsters[at.attacker.sequence]; if (!a) return null;
    const t = at.target ? v.me.monsters[at.target.sequence] : null;
    const out = { a, t, dmg: 0, lose: 0, harmless: false };
    if (!t) out.dmg = a.atk;
    else if (t.attackPos) { if (a.atk > t.atk) { out.dmg = a.atk - t.atk; out.lose = this.monValue(t); } else if (a.atk === t.atk) out.lose = this.monValue(t) * 0.3; else out.harmless = true; }
    else { if (a.atk > t.def) { out.lose = this.monValue(t); if (this.prof(a.code).t & T.PIERCE) out.dmg = a.atk - t.def; } else out.harmless = true; }
    if (t && (this.prof(t.code).t & T.BATTLE_IMMUNE)) out.lose = 0;
    out.lethal = out.dmg >= v.me.lp;
    out.harmful = out.lethal || out.dmg >= this.w.protectDmg || out.lose >= 900 || (out.dmg > 0 && out.dmg >= v.me.lp * 0.2);
    return out;
  }
  /** ¿Sumar ATK/DEF a mi monstruo (o restarle al rival) da vuelta la batalla en curso? */
  flipsBattle(v, up, upDef, down) {
    const at = this.attack; if (!at || at.resolved) return false;
    const iAttack = at.attacker.controller === this.me;
    const mineLoc = iAttack ? at.attacker : at.target, oppLoc = iAttack ? at.target : at.attacker;
    if (!mineLoc) return false;                                    // ataque directo del rival: potenciar no ayuda
    const m = v.me.monsters[mineLoc.sequence]; if (!m || !m.faceup) return false;
    if (!oppLoc) return iAttack && up > 0 && m.atk < v.opp.lp && m.atk + up >= v.opp.lp;  // mi ataque directo: solo si lo vuelve letal
    const o = v.opp.monsters[oppLoc.sequence]; if (!o) return false;
    if (!o.faceup) return false;
    // Resultado para mí: 1 gano, 0 nadie pierde nada, -1 pierdo el monstruo o recibo daño.
    const result = (ma, md, oa, od) => {
      if (iAttack) { if (o.attackPos) return ma > oa ? 1 : ma === oa ? -0.5 : -1; return ma > od ? 1 : ma === od ? 0 : -0.5; }
      if (m.attackPos) return ma > oa ? 1 : ma === oa ? -0.5 : -1;
      return md >= oa ? 0.5 : -1;
    };
    const before = result(m.atk, m.def, o.atk, o.def), after = result(m.atk + up, m.def + upDef, Math.max(0, o.atk - down), Math.max(0, o.def - down));
    return after > before && after >= 0;
  }
  chain(msg) {
    const none = { type: R.SELECT_CHAIN, index: null };
    if (!msg.selects.length) return none;
    const v = this.V(); if (!v) return msg.forced ? { type: R.SELECT_CHAIN, index: 0 } : none;
    let best = -1, bs = 0;
    for (let i = 0; i < msg.selects.length; i++) { const s = this.chainScore(msg.selects[i], v); if (s > bs) { bs = s; best = i; } }
    if (msg.forced && best < 0) best = 0;
    else if (!msg.forced && this.blunder(0.7)) {                   // error a propósito: responde (o no) al azar, como un novato
      best = this.rng() < 0.5 ? Math.floor(this.rng() * msg.selects.length) : -1;
      if (best >= 0 && this.chainScore(msg.selects[best], v) < 0) best = -1;
    }
    if (best < 0) return none;
    const p = this.prof(msg.selects[best].code);
    if (this.attack && (p.a & (A.PROTECT | A.REMOVE_MON | A.WIPE_OPP | A.NEGATE | A.LOCK | A.BOUNCE | A.CONTROL | A.POSITION))) this.attack.handled = true;
    this.pendingAct = msg.selects[best].code;
    return { type: R.SELECT_CHAIN, index: best };
  }
  /** Cuánto conviene responder ahora con esta carta o efecto. > 0: activarla. 0: guardarla. -1: nunca. */
  chainScore(sel, v) {
    const c = this.card(sel.code), p = this.prof(sel.code), W = this.w; const pa = p.a, pt = p.t;
    const isMon = (c.type & TYPE_MONSTER) !== 0, myTurn = this.turnPlayer === this.me;
    const top = this.solving ? null : this.chainTop, topMine = top && top.player === this.me, topOpp = top && top.player !== this.me;
    const my = v.me.monsters.filter(Boolean), op = v.opp.monsters.filter(Boolean), opUp = op.filter((m) => m.faceup);
    const oppBest = Math.max(0, ...opUp.map((m) => m.atk)), myBestAtk = Math.max(0, ...my.filter((m) => m.faceup).map((m) => m.atk));
    const oppST = v.opp.spellCount + (v.opp.field ? 1 : 0);
    const th = this.threat(v), oppEnd = !myTurn && (v.phase & PHASE_END) !== 0;
    if (!this.canPay(p, v)) return -1;
    if ((pt & T.SELF_DAMAGE) && v.me.lp <= 2000) return -1;
    // Efectos disparados de monstruos (no rápidos): casi siempre convienen.
    if (isMon && !(pt & (T.QUICK | T.ON_ATTACK)) && !(pa & (A.PROTECT | A.NEGATE))) return this.triggerWanted(sel.code, sel, v) ? 500 : 0;
    if (topMine) return 0;                                         // no se encadena a un efecto propio
    if ((pt & T.COST_DISCARD) && v.me.hand < 1) return 0;

    // Contraefectos: negar algo que valga la pena.
    if (!(pt & T.ON_ATTACK) && ((pt & T.ON_ACTIVATE) || ((pa & A.NEGATE) && topOpp))) {
      if (!topOpp) return (pt & T.ON_SUMMON) && this.lastSummon && this.lastSummon.controller !== this.me && this.card(this.lastSummon.code).atk >= 2400 ? 700 : 0;
      const tp = this.prof(top.code), tc = this.card(top.code);
      const big = (tp.v || 0) >= 300 || (tp.a & (A.WIPE_OPP | A.WIPE_ALL | A.REMOVE_MON | A.CONTROL | A.REVIVE | A.DRAW | A.WIPE_ST)) || ((tc.type & TYPE_MONSTER) && tc.atk >= 2000);
      const cheap = !(pt & T.COST_DISCARD) && !p.lp;
      return big || (cheap && (tp.v || 0) >= 150) ? 800 : 0;
    }
    // Respuestas a un ataque rival.
    if (th && !this.attack.handled) {
      const atkCount = opUp.filter((m) => m.attackPos).length;
      if (pa & A.WIPE_OPP) return th.harmful || atkCount >= 2 || th.a.atk >= 1800 ? 900 : th.harmless ? 0 : 300;
      if (pa & A.WIPE_ALL) return th.harmful && v.opp.monsters.filter(Boolean).reduce((s, m) => s + this.monValue(m), 0) > my.reduce((s, m) => s + this.monValue(m), 0) ? 850 : 0;
      if (pa & (A.REMOVE_MON | A.BOUNCE | A.CONTROL | A.LOCK)) {
        if ((pt & T.COST_DISCARD) && !(th.harmful && (th.a.atk >= 1800 || th.lethal))) return 0;
        // Si el ataque fracasa solo contra mi monstruo en ataque, el atacante ya se pierde: no se gasta la carta.
        if (th.harmless) return th.t && !th.t.attackPos && this.monValue(th.a) >= W.removeMin ? 800 : 0;
        return th.harmful || th.a.atk >= 1600 ? 820 : 0;
      }
      if (pa & A.PROTECT) {
        if (sel.location === L.HAND) return th.lethal || th.dmg >= Math.max(W.kuribohDmg, v.me.lp * 0.25) ? 700 : 0;
        if (pa & A.BURN) return th.harmless ? 0 : 780;             // devuelve el daño: siempre que el ataque no fracase solo
        return th.harmful ? 760 : 0;
      }
      if ((pa & A.POSITION) && !(pa & A.REMOVE_MON)) return th.harmful ? 740 : 0;
      if ((pa & A.TOKEN) || ((pa & A.SUMMON) && !isMon)) return !th.t && (th.harmful || th.dmg >= 800) ? 720 : 0;
      if ((pa & A.REVIVE) && !th.t) return this.bestRevive(p, v) >= th.a.atk ? 730 : 0;
    }
    // Potenciar o debilitar en la batalla en curso (propia o rival).
    if ((pa & (A.BUFF | A.DEBUFF)) && !(pa & (A.REMOVE_MON | A.LOCK)) && !(c.type & (TYPE_EQUIP | TYPE_FIELD | TYPE_CONTINUOUS))) {
      if (p.swap) return 0;
      return this.flipsBattle(v, p.up || 0, p.upDef || 0, (pa & A.DEBUFF) && !(pa & A.BUFF) ? Math.min(p.down || 0, 3000) : 0) ? 750 : 0;
    }
    if ((pa & A.PROTECT) && !(c.type & TYPE_CONTINUOUS)) return 0; // protección sin ataque dañino: se guarda
    if (pt & T.ON_ATTACK) return th && !th.harmless ? 600 : 0;
    // Respuestas a una Invocación.
    if (pt & T.ON_SUMMON) {
      const ls = this.lastSummon; const mon = ls && ls.controller !== this.me ? v.opp.monsters[ls.seq] : null;
      if (pa & A.WIPE_ALL) { const o = op.reduce((s, m) => s + this.monValue(m), 0), mv = my.reduce((s, m) => s + this.monValue(m), 0); return o - mv > 800 ? 850 : 0; }
      if (!mon) return ls && ls.controller === this.me ? 0 : 500;
      // El motor ya comprobó que la trampa le cae a ese monstruo: se usa si vale una carta o si amenaza lo mío.
      const dangerous = (this.prof(mon.code).v || 0) >= 500;
      return this.monValue(mon) >= W.removeMin || mon.atk >= myBestAtk || dangerous || !my.length ? 840 : 0;
    }
    // Sin momento fijo.
    if (pa & (A.REMOVE_ST | A.WIPE_ST)) {
      if (pa & A.REMOVE_MON) { // sirve para las dos cosas (descarta y destruye 1 carta): contra un monstruo que pese
        const big = opUp.some((m) => m.atk >= 1900 && m.atk >= myBestAtk);
        return big && (!(pt & T.COST_DISCARD) || v.me.hand >= 1) && (th ? th.harmful : true) ? 700 : 0;
      }
      if (!oppST) return 0;
      const faceupThreat = v.opp.spells.some((s) => s.faceup) || v.opp.field;
      const topStays = topOpp && (this.card(top.code).type & (TYPE_CONTINUOUS | TYPE_EQUIP | TYPE_FIELD));
      return faceupThreat || topStays || oppEnd || (myTurn && !(v.phase & PHASE_END)) ? 700 : 0;
    }
    if (pa & A.REMOVE_MON) {
      if (!op.length) return 0;
      const big = opUp.some((m) => m.atk >= 1800 && m.atk >= myBestAtk);
      if (pt & T.COST_DISCARD) return big && opUp.some((m) => m.atk >= 2000) ? 650 : 0;
      return big || (th && th.harmful) ? 680 : 0;
    }
    if (pa & A.DRAW) return !(pt & (T.COST_DISCARD | T.COST_TRIBUTE)) && !(/skip your next/i.test(this.cards.raw?.[sel.code]?.[10] || "") && v.me.hand > 1) ? 600 : 0;
    if (pa & A.REVIVE) return this.bestRevive(p, v) >= W.reviveMin && (oppEnd || (myTurn && !(v.phase & PHASE_BATTLE_ANY) && !(v.phase & PHASE_END))) ? 650 : 0;
    if (pa & A.LOCK) return oppBest >= 1600 && oppBest >= myBestAtk && !myTurn ? 640 : 0;
    if (pa & A.HANDKILL) return v.opp.hand > 0 && (!(pt & T.COST_TRIBUTE) || my.some((m) => this.monValue(m) <= 900)) ? 560 : 0;
    if ((pa & A.BURN) && !(pt & (T.COST_TRIBUTE | T.COST_DISCARD))) return 550;
    if ((pa & A.HEAL) && !(c.type & TYPE_CONTINUOUS)) return v.me.lp <= W.healBelow ? 400 : 0;
    if (pt & T.COST_TRIBUTE) return my.some((m) => this.monValue(m) <= 1000) && (pa & (A.SUMMON | A.WIPE_OPP)) ? 500 : 0;
    if ((pa & A.SUMMON) && !isMon) return oppEnd || (th && !th.t) ? 600 : 0;
    if (c.type & TYPE_CONTINUOUS) return 450;                      // continuas sin objetivo: cuanto antes
    if (pt & T.COST_DISCARD) return 0;
    return topOpp || th || oppEnd ? 300 : 0;                       // desconocida: solo como respuesta a algo del rival
  }
  /** Efecto opcional de un monstruo o de una carta ya activa: ¿lo quiere? */
  triggerWanted(code, loc, v) {
    const p = this.prof(code); if (!v) return true;
    if (p.t & T.ALL_IN) return false;
    if (!this.canPay(p, v)) return false;
    const my = v.me.monsters.filter(Boolean), op = v.opp.monsters.filter(Boolean);
    const opUp = op.filter((m) => m.faceup), oppBest = Math.max(0, ...opUp.map((m) => m.atk));
    if ((p.a & A.GAMBLE) && (p.a & (A.WIPE_OPP | A.WIPE_ALL))) return op.reduce((s, m) => s + this.monValue(m), 0) > my.reduce((s, m) => s + this.monValue(m), 0) + 300;
    // Cambiar su propia posición (al final del turno): según lo que tenga enfrente.
    if ((p.a & A.POSITION) && loc && (loc.location & L.MZONE) && loc.controller === this.me && !(p.a & (A.REMOVE_MON | A.CONTROL | A.NEGATE))) {
      const m = v.me.monsters[loc.sequence]; if (!m || !m.faceup) return true;
      const wantDef = oppBest > m.atk || (!opUp.length && m.def > m.atk);
      return m.attackPos === wantDef;
    }
    if ((p.t & T.COST_DISCARD) && v.me.hand < 1) return false;
    return true;
  }
  effectYN(msg) {
    const v = this.V();
    const p = this.prof(msg.code);
    // "¿Rehacer la moneda?": solo si salió mal.
    if (/redo your coin toss/i.test(this.cards.raw?.[msg.code]?.[10] || "")) return !!this.coinBad;
    const yes = this.triggerWanted(msg.code, msg, v);
    if (yes && p.a) this.pendingAct = msg.code;
    return this.blunder(0.15) ? !yes : yes;
  }
  yesNo(msg) {
    const d = BigInt(msg.description), sys = d < 100000n ? Number(d) : 0, v = this.V();
    if (sys === 30) {                                              // Replay: ¿seguir atacando?
      const at = this.attack; if (!v || !at) return false;
      const m = v.me.monsters[at.attacker.sequence]; if (!m) return false;
      const a = this.attackerOf(m), defs = v.opp.monsters.filter(Boolean).map((x) => this.defenderOf(x));
      const plan = this.planBattle([a], defs, v.opp.lp, v.me.lp);
      this.planned = plan.first ? { seq: a.seq, target: plan.first.j < 0 ? "direct" : defs[plan.first.j].seq } : null;
      return !!plan.first;
    }
    if (sys === 31) return !this.planned || this.planned.target === "direct" || !v || !v.opp.monsters.some(Boolean);
    if (sys === 93 || sys === 210) return false;                   // "¿seguir eligiendo?": con lo mínimo alcanza
    if (sys) return true;
    // Pregunta de una carta. Si es del rival y me ofrece destruir o descartar cartas mías, no.
    if (this.current && this.currentPlayer !== this.me && /your opponent can (?:destroy|discard|send|banish)/i.test(this.cards.raw?.[this.current]?.[10] || "")) return false;
    return true;
  }
  option(msg) {
    const sys = msg.options.map((o) => { const d = BigInt(o); return d < 100000n ? Number(d) : 0; });
    if (sys.includes(60) || sys.includes(61)) { const i = this.rng() < 0.5 ? 0 : 1; this.coinCall = sys[i] === 61 ? 1 : 0; this.coinFresh = true; return i; }
    const v = this.V(); let best = 0, bs = -1;
    msg.options.forEach((o, i) => {
      const d = BigInt(o), code = Number(d >> 4n), idx = Number(d & 0xfn); const t = String(this.cards.raw?.[code]?.[11]?.[idx] || "").toLowerCase();
      let s = 0;
      if (/special summon/.test(t)) s += 3;
      if (/destroy|banish|take control/.test(t) && v && v.opp.monsters.some(Boolean)) s += 2;
      if (/draw|add/.test(t)) s += 2;
      if (/position/.test(t)) s += 1;
      if (s > bs) { bs = s; best = i; }
    });
    return best;
  }

  // ---------- Selecciones ----------
  /** Para qué se está eligiendo: lo dice el motor (HINT) o, si no, lo que hace la carta que se está resolviendo. */
  intent(player, selects) {
    const h = this.hints?.[player]; if (this.hints) delete this.hints[player];
    const cur = this.current || this.pendingAct, p = this.prof(cur);
    const harmish = (p.a & (A.CONTROL | A.LOCK)) || ((p.a & A.DEBUFF) && !(p.a & A.BUFF));
    const opps = selects.some((s) => s.controller !== player);
    switch (h) {
      case H.ATTACKTARGET: return "attack";
      case H.RELEASE: case H.TRIBUTE: return "tribute";
      case H.DISCARD: case H.CONFIRM: case H.FMATERIAL: return "cost";
      case H.DESTROY: case H.REMOVE: case H.TOGRAVE: case H.CONTROL: case H.OPPO: case H.FACEUP_OPP: case H.NEGATE: return "harm";
      case H.RTOHAND: case H.TODECK: return opps ? "harm" : selects.every((s) => s.location & (L.GRAVE | L.REMOVED)) ? "good" : "cost";
      case H.ATOHAND: case H.SPSUMMON: case H.SUMMON: case H.TOFIELD: return "good";
      case H.EQUIP: case H.ATKDEF: return harmish ? "harm" : "buff";
      case H.POSCHANGE: return "position";
      case H.SELF: case H.SELF_SIDE: return (p.a & (A.BUFF | A.PROTECT)) ? "buff" : "cost";
    }
    if ((p.a & A.POSITION) && !(p.a & (A.REMOVE_MON | A.CONTROL | A.LOCK))) return "position";
    if ((p.a & (A.REMOVE_MON | A.REMOVE_ST | A.BOUNCE | A.WIPE_OPP)) || harmish) return "harm";
    if (p.a & (A.REVIVE | A.SEARCH | A.RECOVER | A.SUMMON)) return "good";
    if (p.a & (A.BUFF | A.PROTECT)) return "buff";
    if (selects.every((s) => s.location & (L.DECK | L.GRAVE | L.EXTRA | L.REMOVED))) return "good";
    return opps ? "harm" : "cost";
  }
  pickCards(selects, min, max, player) {
    const intent = this.intent(player, selects); const v = this.V();
    const at = this.attack; const inFight = (s) => at && !at.resolved && (s.location & L.MZONE) &&
      ((at.attacker.controller === s.controller && at.attacker.sequence === s.sequence) || (at.target && at.target.controller === s.controller && at.target.sequence === s.sequence));
    const score = (s) => {
      const mine = s.controller === player, w = this.selWorth(s, player, v);
      const m = v && (s.location & L.MZONE) ? (mine ? v.me : v.opp).monsters[s.sequence] : null;
      switch (intent) {
        case "good": return w;                                     // revivir, buscar: la mejor carta
        case "buff": return mine ? (inFight(s) ? 1e5 : 0) + (m ? m.atk + (m.attackPos ? 500 : 0) : w) : -1e6 - w;
        case "tribute": return mine ? -w : 1e6 + w;                // sacrificar: lo propio más barato; del rival, lo mejor
        case "cost": return mine ? -w : w;
        case "position": {
          if (mine || !m) return -1e6;
          return (inFight(s) ? 1e5 : 0) + (m.faceup ? (m.attackPos ? m.atk - m.def : m.def - m.atk) : 0);
        }
        case "attack": {
          const o = v?.opp.monsters[s.sequence]; if (!o) return 0;
          if (this.planned && this.planned.target === s.sequence) return 1e6;
          const me = v.me.monsters[this.planned?.seq ?? at?.attacker.sequence]; if (!me) return -this.monValue(o);
          const r = this.fight(this.attackerOf(me), this.defenderOf(o), v.opp.lp, v.me.lp);
          return r ? r.gain : -1e5 - (o.faceup ? (o.attackPos ? o.atk : o.def) : 1500);
        }
      }
      return mine ? -1e6 - w : w + (inFight(s) ? 400 : 0);         // dañar: lo más valioso del rival; propio, lo menos valioso
    };
    const idx = selects.map((s, i) => ({ i, v: score(s) })).sort((a, b) => b.v - a.v);
    // Error a propósito: elige mal el objetivo (nunca en contra propia cuando hay una opción del rival).
    if (idx.length > 1 && intent !== "cost" && intent !== "tribute" && this.blunder(0.35)) { const ok = idx.filter((x) => x.v > -1e5); if (ok.length > 1) { const j = Math.floor(this.rng() * ok.length); const k = idx.indexOf(ok[j]); [idx[0], idx[k]] = [idx[k], idx[0]]; } }
    let n = Math.max(1, min);
    // Si se puede elegir más de una, se toman todas las que convienen (traer más cartas, destruir más del rival).
    if (max > n && (intent === "good" || intent === "harm")) n = Math.min(max, Math.max(n, idx.filter((x) => x.v > 0 && (intent === "good" || selects[x.i].controller !== player)).length));
    return idx.slice(0, Math.min(n, max, idx.length)).map((x) => x.i);
  }
  pickTributes(msg) {
    const v = this.V();
    const items = msg.selects.map((s, i) => {
      const mine = s.controller === msg.player, m = v && (mine ? v.me : v.opp).monsters[s.sequence], r = s.release_param || 1;
      const w = m ? this.monValue(m) : this.cardValue(s.code);
      return { i, r, key: mine ? w / r : -1e6 - w };               // primero los del rival (el mejor); después, lo propio más barato
    }).sort((a, b) => a.key - b.key);
    if (items.some((x) => x.key < -1e5)) this.soulExchange = null;
    const out = []; let sum = 0;
    for (const s of items) { if (sum >= msg.min) break; out.push(s.i); sum += s.r; }
    return out;
  }
  selectUnselect(msg) {
    if (msg.can_finish && (msg.unselect_cards.length >= msg.min || msg.select_cards.length === 0)) return { type: R.SELECT_UNSELECT_CARD, index: null };
    if (msg.select_cards.length) {
      const keep = this.hints?.[msg.player];
      const pick = this.pickCards(msg.select_cards, 1, 1, msg.player)[0];
      if (keep != null) (this.hints ??= {})[msg.player] = keep;    // la misma pista vale para las siguientes cartas de esta elección
      return { type: R.SELECT_UNSELECT_CARD, index: pick };
    }
    return { type: R.SELECT_UNSELECT_CARD, index: null };
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
    const c = this.stats(msg.code), opts = msg.positions, v = this.V();
    const first = (order) => order.find((p) => opts & p) || FACEUP_ATK;
    const ATK = [FACEUP_ATK, FACEUP_DEF, FACEDOWN_DEF, FACEDOWN_ATK], DEF = [FACEUP_DEF, FACEDOWN_DEF, FACEUP_ATK, FACEDOWN_ATK];
    if (!v || this.blunder(0.4)) return first(c.atk >= c.def ? ATK : DEF);
    const opUp = v.opp.monsters.filter((m) => m && m.faceup), oppBest = Math.max(0, ...opUp.map((m) => m.atk));
    if (c.atk <= 0) return first(DEF);
    // Invocación con Ultimate Offering y similares: boca arriba en ataque o boca abajo en defensa.
    if ((opts & FACEDOWN_DEF) && !(opts & FACEUP_DEF)) return c.atk >= oppBest && c.atk >= 1000 ? first(ATK) : first([FACEDOWN_DEF, FACEUP_ATK]);
    if (oppBest > c.atk) return first(DEF);
    if (!opUp.length) return first(c.atk >= c.def || c.atk >= 1500 ? ATK : DEF);
    return first(ATK);
  }
  pickCounters(msg) {
    let left = msg.count; return msg.cards.map((c) => { const t = Math.min(c.count, left); left -= t; return t; });
  }
  pickSum(msg) {
    const must = msg.selects_must.map((s) => s.amount & 0xffff).reduce((a, b) => a + b, 0);
    const target = msg.amount - must; const items = msg.selects;
    const amt = (s) => [s.amount & 0xffff, (s.amount >>> 16) & 0xffff].filter(Boolean);
    const n = items.length; let best = null;
    for (let mask = 1; mask < (1 << Math.min(n, 16)); mask++) {
      const chosen = []; let sums = [0];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) { chosen.push(i); const opts = amt(items[i]); sums = sums.flatMap((s) => opts.map((o) => s + o)); }
      const ok = msg.select_max ? sums.some((s) => s >= target) : sums.includes(target);
      if (ok && (!best || chosen.length < best.length)) best = chosen;
    }
    const mustIdx = msg.selects_must.map((_, i) => i);
    return [...mustIdx, ...(best || [0]).map((i) => i + msg.selects_must.length)];
  }
  bits(avail, count) {
    const out = [];
    if (typeof avail === "bigint") { for (let b = 0n; b < 64n && out.length < count; b++) if (avail & (1n << b)) out.push(Number(1n << b)); }
    else { for (let b = 0; b < 32 && out.length < count; b++) if (avail & (1 << b)) out.push(1 << b); }
    return out;
  }
  /** Declara el Tipo que más tienen mis monstruos (los efectos que piden un Tipo suelen ayudar a los propios). */
  announceRace(msg) {
    const avail = BigInt(msg.available), v = this.V(); const count = {};
    if (v) for (const code of [...v.me.monsters.filter(Boolean).map((m) => m.code), ...(v.me.handCodes || []), ...v.me.grave]) { const c = this.card(code); if (c.type & TYPE_MONSTER) { const r = BigInt(c.race || 0); if (r && (avail & r)) count[r] = (count[r] || 0) + 1; } }
    const ranked = Object.entries(count).sort((a, b) => b[1] - a[1]).map(([r]) => BigInt(r));
    const out = ranked.slice(0, msg.count);
    for (const b of this.bits(avail, msg.count)) if (out.length < msg.count && !out.includes(BigInt(b))) out.push(BigInt(b));
    return out;
  }
  /** Declara los Atributos que más dañan al rival y menos a mí. */
  announceAttrib(msg) {
    const avail = Number(msg.available), v = this.V(); const score = {};
    for (let b = 1; b <= 0x40; b <<= 1) if (avail & b) score[b] = 0;
    if (v) {
      for (const m of v.opp.monsters) if (m && m.faceup) { const a = this.card(m.code).attribute; if (a in score) score[a] += this.monValue(m); }
      for (const m of v.me.monsters) if (m && m.faceup) { const a = this.card(m.code).attribute; if (a in score) score[a] -= this.monValue(m); }
    }
    return Object.entries(score).sort((a, b) => b[1] - a[1]).slice(0, msg.count).map(([a]) => Number(a));
  }
  announceCard(msg) {
    // Declara una carta conocida del pool que cumpla los opcodes; por simplicidad, la primera carta registrada.
    return this.cards.firstMatching ? this.cards.firstMatching(msg.opcodes) : 0;
  }
  announceNumber(msg) {
    const opts = msg.options.map(Number), v = this.V(), p = this.prof(this.current || this.pendingAct);
    if (!v) return 0;
    if (p.a & A.REMOVE_MON) {                                       // un número que es un Nivel: el del mejor monstruo rival, nunca el de uno mío
      let best = 0, bs = -Infinity;
      opts.forEach((n, i) => {
        const s = v.opp.monsters.filter((m) => m && m.faceup && m.level === n).reduce((x, m) => Math.max(x, this.monValue(m)), 0)
          - v.me.monsters.filter((m) => m && m.level === n).reduce((x, m) => Math.max(x, this.monValue(m)), 0);
        if (s > bs) { bs = s; best = i; }
      });
      return best;
    }
    if ((p.a & A.DEBUFF) && this.attack) {                         // pagar LP para bajar ATK: lo justo para ganar la batalla
      const at = this.attack, iAttack = at.attacker.controller === this.me;
      const mine = v.me.monsters[(iAttack ? at.attacker : at.target)?.sequence ?? -1], opp = v.opp.monsters[(iAttack ? at.target : at.attacker)?.sequence ?? -1];
      if (mine && opp) {
        const need = opp.atk - (mine.attackPos ? mine.atk : mine.def) + 100;
        const i = opts.findIndex((n) => n >= need && v.me.lp - n >= 1500);
        if (i >= 0) return i;
      }
    }
    return 0;
  }
}
