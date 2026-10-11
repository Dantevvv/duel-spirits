// Ejecuta un duelo completo: carga decks, procesa mensajes del motor y reparte las selecciones
// entre el jugador humano (UI, asíncrono) y la IA (síncrona).
import { OcgMessageType as M } from "../ocg/type_message.js";
import { OcgLocation as L } from "../ocg/type_core.js";
import { DuelAchievements } from "./rewards.js";

const SELECT_TYPES = new Set([M.SELECT_BATTLECMD, M.SELECT_IDLECMD, M.SELECT_EFFECTYN, M.SELECT_YESNO, M.SELECT_OPTION, M.SELECT_CARD,
  M.SELECT_CHAIN, M.SELECT_PLACE, M.SELECT_POSITION, M.SELECT_TRIBUTE, M.SORT_CHAIN, M.SELECT_COUNTER, M.SELECT_SUM, M.SELECT_DISFIELD,
  M.SORT_CARD, M.SELECT_UNSELECT_CARD, M.ANNOUNCE_RACE, M.ANNOUNCE_ATTRIB, M.ANNOUNCE_CARD, M.ANNOUNCE_NUMBER, M.ROCK_PAPER_SCISSORS]);
export const isSelect = (m) => SELECT_TYPES.has(m.type);

const POS_FACEDOWN_DEF = 0x8;
const QUERY_FLAGS = 0x1 | 0x2 | 0x8 | 0x10 | 0x100 | 0x200; // código, posición, tipo, nivel, ATK, DEF
const QUERY_SPELL = 0x1 | 0x2 | 0x8;                         // código, posición, tipo

export class DuelRunner {
  /**
   * @param {{core:any, cards:import('./cards.js').CardDB, scripts:(name:string)=>string|null,
   *  decks:[{main:number[], extra?:number[]}, {main:number[], extra?:number[]}], lp?:[number,number],
   *  controllers:[any, any], onMessage?:(m:any, runner:DuelRunner)=>Promise<void>|void, seed?:number[], mode?:bigint,
   *  maxSteps?:number}} o
   * controllers[i]: objeto IA con respond(msg) o función async (msg) => respuesta para el humano.
   */
  constructor(o) {
    this.o = o; this.cards = o.cards; this.turn = 0; this.phase = 0; this.lp = [...(o.lp || [8000, 8000])];
    this.winner = null; this.log = []; this.achievements = new DuelAchievements(o.cards);
    // Para deshacer: la semilla y el orden de los mazos quedan fijos, y se guarda cada respuesta dada al motor.
    this.seed = o.seed || [1, 2, 3, 4].map(() => (Math.random() * 2 ** 32) >>> 0);
    this.history = []; this.replay = [];
  }

  setup() {
    const o = this.o;
    this.achievements.reset();
    this.duel = o.core.createDuel({ cardDB: (c) => this.cards.get(c), scriptSource: o.scripts, seed: this.seed, mode: o.mode, lp: this.lp });
    if (!this.duel.loadScript("constant.lua") || !this.duel.loadScript("utility.lua")) throw new Error("No cargaron los scripts base");
    // El motor no baraja el mazo inicial: se baraja acá (Fisher-Yates).
    const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    this.order ??= o.decks.map((d) => shuffle(d.main));
    o.decks.forEach((d, team) => {
      for (const code of this.order[team]) this.duel.newCard({ team, code, location: L.DECK, position: POS_FACEDOWN_DEF });
      for (const code of d.extra || []) this.duel.newCard({ team, code, location: L.EXTRA, position: POS_FACEDOWN_DEF });
    });
    o.controllers.forEach((ctl, team) => { if (ctl && ctl.setView) ctl.setView((p) => this.view(p)); });
    this.duel.start();
  }

  /**
   * Vista del campo desde la perspectiva de "player", para la IA. Solo información pública:
   * de las cartas boca abajo del rival no se da ni el código ni los valores, y de su mano y su Deck, solo la cantidad.
   */
  view(player) {
    const codes = (p, loc) => this.duel.queryLocation(p, loc, 0x1 | 0x2).filter((q) => q && q.code && !(q.position & 0xa)).map((q) => q.code);
    const side = (p) => {
      const own = p === player;
      const mons = this.duel.queryLocation(p, L.MZONE, QUERY_FLAGS).map((q, seq) => {
        if (!q || !q.code) return null;
        const faceup = (q.position & 0x5) !== 0, attackPos = (q.position & 0x3) !== 0;
        if (!faceup && !own) return { code: 0, atk: 0, def: 0, level: 0, position: q.position, faceup, attackPos, seq };
        return { code: q.code, atk: q.attack | 0, def: q.defense | 0, level: (q.level | 0) & 0xff, position: q.position, faceup, attackPos, seq };
      });
      const szone = this.duel.queryLocation(p, L.SZONE, QUERY_SPELL).map((q, seq) => {
        if (!q || !q.position) return null;
        const faceup = (q.position & 0x5) !== 0;
        return { code: faceup || own ? q.code : 0, faceup, seq };
      });
      return { monsters: mons, spells: szone.slice(0, 5).filter(Boolean), spellCount: szone.slice(0, 5).filter(Boolean).length,
        field: !!szone[5], fieldCode: szone[5]?.code || 0, hand: this.duel.count(p, L.HAND), deck: this.duel.count(p, L.DECK), lp: this.lp[p],
        grave: codes(p, L.GRAVE), banished: codes(p, L.REMOVED), handCodes: own ? this.duel.queryLocation(p, L.HAND, 0x1).filter(Boolean).map((q) => q.code) : null };
    };
    return { turn: this.turn, phase: this.phase, me: side(player), opp: side(1 - player) };
  }

  /** Vuelve a la decisión humana anterior: reinicia el duelo y repite en silencio las respuestas previas. */
  rewind() {
    let i = this.history.length - 1; while (i >= 0 && !this.history[i].human) i--;
    if (i < 0) return false;
    this.replay = this.history.slice(0, i); this.history = [];
    this.duel.destroy(); this.turn = 0; this.phase = 0; this.winner = null; this.lp = [...(this.o.lp || [8000, 8000])];
    this.catchUp = true; this.setup(); return true;
  }
  answer(resp, human) { this.history.push({ resp, human }); this.duel.respond(resp); }

  track(m) {
    this.achievements.observe(m);
    switch (m.type) {
      case M.NEW_TURN: this.turn++; break;
      case M.NEW_PHASE: this.phase = m.phase; break;
      case M.DAMAGE: this.lp[m.player] = Math.max(0, this.lp[m.player] - m.amount); break;
      case M.PAY_LPCOST: this.lp[m.player] = Math.max(0, this.lp[m.player] - m.amount); break;
      case M.RECOVER: this.lp[m.player] += m.amount; break;
      case M.LPUPDATE: this.lp[m.player] = m.lp; break;
      case M.WIN: this.winner = m.player; this.winReason = m.reason; break;
    }
  }

  async run() {
    if (!this.duel) this.setup();
    const max = this.o.maxSteps ?? 20000; let steps = 0; let lastSelect = null; let retries = 0;
    while (steps++ < max) {
      const st = this.duel.process();
      const msgs = this.duel.messages();
      let rewound = false;
      for (const m of msgs) {
        this.track(m);
        for (const c of this.o.controllers) c?.observe?.(m); // la IA mira qué se activa y qué se le pide elegir
        // Mientras se repiten jugadas ya hechas, la interfaz solo actualiza su estado (sin animar).
        const silent = this.replay.length > 0 || (this.catchUp && !isSelect(m));
        if (this.o.onMessage) await this.o.onMessage(m, this, silent);
        if (m.type === M.RETRY) {
          // Respuesta inválida: se reintenta con la IA de respaldo para no trabar el duelo.
          if (++retries > 5 || !lastSelect) throw new Error("El motor rechazó respuestas repetidas: " + JSON.stringify(lastSelect, (k, v) => typeof v === "bigint" ? String(v) : v));
          if (this.replay.length) { const h = this.replay.shift(); this.answer(h.resp, h.human); continue; }
          const fb = this.o.fallback || this.o.controllers[1];
          this.answer(fb.respond(lastSelect), false); continue;
        }
        if (isSelect(m)) {
          retries = 0; lastSelect = m;
          if (this.replay.length) { const h = this.replay.shift(); this.answer(h.resp, h.human); continue; }
          this.catchUp = false;
          const ctl = this.o.controllers[m.player]; let human = typeof ctl === "function" && !ctl.ai;
          let resp = typeof ctl === "function" ? await ctl(m, this) : ctl.respond(m);
          if (resp && resp.undo) {
            if (this.rewind()) { rewound = true; break; }
            resp = await ctl(m, this, true); // no hay nada antes: se vuelve a preguntar
          }
          if (!resp) throw new Error("Sin respuesta para mensaje " + m.type);
          if (resp.auto) { human = false; delete resp.auto; } // respondida sola por la interfaz: no es un punto al que volver
          this.answer(resp, human);
        }
      }
      if (rewound) { lastSelect = null; retries = 0; continue; }
      if (this.winner !== null || st === 0) break;
    }
    const result = { winner: this.winner, reason: this.winReason, lp: [...this.lp], turns: this.turn };
    this.duel.destroy();
    return result;
  }
}
