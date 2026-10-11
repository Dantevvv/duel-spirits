// Base de cartas en memoria (exportada desde BabelCDB por tools/export_cards.py).
import { cardMatchesOpcode } from "../ocg/opcodes.js";
import { profileCard } from "./profile.js";

export const TYPE = { MONSTER: 0x1, SPELL: 0x2, TRAP: 0x4, NORMAL: 0x10, EFFECT: 0x20, FUSION: 0x40, RITUAL: 0x80, TRAPMONSTER: 0x100,
  SPIRIT: 0x200, UNION: 0x400, GEMINI: 0x800, TUNER: 0x1000, SYNCHRO: 0x2000, TOKEN: 0x4000, QUICKPLAY: 0x10000, CONTINUOUS: 0x20000,
  EQUIP: 0x40000, FIELD: 0x80000, COUNTER: 0x100000, FLIP: 0x200000, TOON: 0x400000, XYZ: 0x800000, PENDULUM: 0x1000000, LINK: 0x4000000 };
export const ATTRIBUTE_NAMES = { 0x1: "TIERRA", 0x2: "AGUA", 0x4: "FUEGO", 0x8: "VIENTO", 0x10: "LUZ", 0x20: "OSCURIDAD", 0x40: "DIVINIDAD" };
export const RACE_NAMES = { 0x1: "Guerrero", 0x2: "Lanzador de Conjuros", 0x4: "Hada", 0x8: "Demonio", 0x10: "Zombi", 0x20: "Máquina", 0x40: "Aqua",
  0x80: "Piro", 0x100: "Roca", 0x200: "Bestia Alada", 0x400: "Planta", 0x800: "Insecto", 0x1000: "Trueno", 0x2000: "Dragón", 0x4000: "Bestia",
  0x8000: "Bestia-Guerrero", 0x10000: "Dinosaurio", 0x20000: "Pez", 0x40000: "Serpiente Marina", 0x80000: "Reptil", 0x100000: "Psíquico",
  0x200000: "Bestia Divina", 0x400000: "Dios Creador", 0x800000: "Wyrm", 0x1000000: "Ciberso" };

const NO_PROFILE = Object.freeze({ a: 0, t: 0 });

export class CardDB {
  /** @param {Record<string, any[]>} raw */
  constructor(raw) { this.raw = raw; this.cache = new Map(); this.es = null; this.lang = () => "en"; }
  /** Textos en español (data/cards.es.json: id -> [nombre, texto, frases?]) y de dónde leer el idioma elegido. */
  setSpanish(es, lang) { this.es = es; this.lang = lang; }
  /** Perfiles precalculados (data/profiles.json: id -> perfil). Sin ellos, cada perfil se calcula al pedirlo. */
  setProfiles(p) { this.profiles = p; this.profCache = new Map(); }
  /** Qué hace la carta, para la IA (ver profile.js). */
  profile(code) {
    let p = (this.profCache ??= new Map()).get(code);
    if (!p) { p = this.profiles ? (this.profiles[code] ?? NO_PROFILE) : profileCard(this.raw[code]); this.profCache.set(code, p); }
    return p;
  }
  get(code) {
    let c = this.cache.get(code); if (c) return c;
    const r = this.raw[code]; if (!r) return null;
    const db = this; const es = () => (db.es && db.lang() === "es" && db.es[code]) || null;
    // nameEn es el nombre con el que se escribe el contenido; name, desc y strings siguen el idioma elegido.
    c = { code: Number(code), alias: r[0], setcode: BigInt(r[1]), type: r[2], atk: r[3], def: r[4], level: r[5], race: r[6],
      attribute: r[7], ot: r[8], nameEn: r[9],
      get name() { return es()?.[0] ?? r[9]; }, get desc() { return es()?.[1] ?? r[10]; }, get strings() { return es()?.[2] ?? r[11] ?? []; } };
    c.lv = c.level & 0xff;
    this.cache.set(code, c); return c;
  }
  /** Búsqueda por nombre: acepta el español y el inglés. */
  nameHas(c, q) { return c.name.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q); }
  has(code) { return code in this.raw; }
  isMonster(code) { const c = this.get(code); return !!c && (c.type & TYPE.MONSTER) !== 0; }
  isExtra(code) { const c = this.get(code); return !!c && (c.type & (TYPE.FUSION | TYPE.SYNCHRO | TYPE.XYZ | TYPE.LINK)) !== 0; }
  /** Texto de un "description" del motor (código*16 + índice de string). */
  describe(desc) {
    const d = BigInt(desc); const code = Number(d >> 4n); const idx = Number(d & 0xfn);
    const c = this.get(code); return c ? (c.strings[idx] || c.name) : null;
  }
  firstMatching(opcodes) {
    for (const k in this.raw) {
      const c = this.get(Number(k)); const setcodes = [];
      let sc = c.setcode; while (sc > 0n) { setcodes.push(Number(sc & 0xffffn)); sc >>= 16n; }
      if (cardMatchesOpcode({ code: c.code, type: c.type, race: BigInt(c.race), attribute: c.attribute, setcodes }, opcodes)) return c.code;
    }
    return 0;
  }
}
