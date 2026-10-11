// Perfil de una carta: qué hace, leído de sus datos y de su texto en inglés con patrones.
// La IA (ai.js) decide con estas categorías, no con listas de nombres: así puede jugar un mazo que nunca vio.
// tools/build_profiles.mjs lo precalcula para todas las cartas en data/profiles.json.

/** Qué hace la carta (campo "a" del perfil). */
export const A = {
  REMOVE_MON: 1 << 0,   // destruye / destierra / manda al Cementerio un monstruo
  WIPE_OPP: 1 << 1,     // todos los monstruos del rival
  WIPE_ALL: 1 << 2,     // todos los monstruos del campo, propios también
  REMOVE_ST: 1 << 3,    // una mágica o trampa
  WIPE_ST: 1 << 4,      // todas las mágicas y trampas
  DRAW: 1 << 5,
  SEARCH: 1 << 6,       // del Deck a la mano
  RECOVER: 1 << 7,      // del Cementerio a la mano
  REVIVE: 1 << 8,       // Invocación Especial desde el Cementerio
  SUMMON: 1 << 9,       // otra Invocación Especial (mano, Deck, fichas)
  BURN: 1 << 10,
  HEAL: 1 << 11,
  NEGATE: 1 << 12,
  PROTECT: 1 << 13,     // evita daño o destrucción en batalla, o niega el ataque
  BUFF: 1 << 14,        // sube ATK/DEF
  DEBUFF: 1 << 15,      // baja ATK/DEF
  CONTROL: 1 << 16,     // toma el control
  BOUNCE: 1 << 17,      // devuelve a la mano o al Deck
  HANDKILL: 1 << 18,    // descarta de la mano rival
  POSITION: 1 << 19,    // cambia la posición de batalla
  LOCK: 1 << 20,        // impide atacar
  FUSION: 1 << 21,
  RITUAL: 1 << 22,
  TOKEN: 1 << 23,
  GAMBLE: 1 << 24,      // moneda o dado
};

/** Cuándo, a qué costo y rasgos del monstruo (campo "t" del perfil). */
export const T = {
  ON_ATTACK: 1 << 0,      // responde a la declaración de ataque rival
  ON_SUMMON: 1 << 1,      // responde a una Invocación
  ON_ACTIVATE: 1 << 2,    // responde a una activación (contraefecto)
  COST_DISCARD: 1 << 3,
  COST_TRIBUTE: 1 << 4,   // sacrifica otro monstruo propio
  SELF_TRIBUTE: 1 << 5,   // se sacrifica a sí misma
  NO_NS: 1 << 6,          // no se puede Invocar de Modo Normal
  BATTLE_IMMUNE: 1 << 7,  // no se destruye en batalla
  FLOATER: 1 << 8,        // deja algo al ser destruida o mandada al Cementerio
  DIRECT: 1 << 9,         // puede atacar directo
  PIERCE: 1 << 10,
  DOUBLE: 1 << 11,        // ataca dos veces
  NO_BP: 1 << 12,         // quien la activa no tiene Battle Phase ese turno
  NO_SUMMON: 1 << 13,     // quien la activa no puede Invocar ese turno
  HEAVY_COST: 1 << 14,    // pierde el resto de sus cartas
  ATTACK_COST: 1 << 15,   // debe sacrificar para atacar
  GIFT: 1 << 16,          // le da algo al rival
  FLIP_SUMMON: 1 << 17,   // efecto al ser Invocada por Volteo
  SELF_FLIPDOWN: 1 << 18, // puede volver a boca abajo
  ALL_FIELD: 1 << 19,     // elige sola entre TODO el campo (puede caer en un monstruo propio)
  SELF_DAMAGE: 1 << 20,   // también daña a quien la usa
  QUICK: 1 << 21,         // efecto rápido de monstruo
  CANT_ATTACK: 1 << 22,   // no puede atacar (o no el turno en que usa su efecto)
  TRIBUTE_OPP: 1 << 23,   // deja sacrificar un monstruo del rival
  LEVEL_DOWN: 1 << 24,    // baja el Nivel de los monstruos de la mano
  ALL_IN: 1 << 25,        // paga casi todos los LP
  ON_NS: 1 << 26,         // efecto al ser Invocada de Modo Normal (se pierde si se coloca boca abajo)
};

const RACES = { warrior: 0x1, spellcaster: 0x2, fairy: 0x4, fiend: 0x8, zombie: 0x10, machine: 0x20, aqua: 0x40, pyro: 0x80, rock: 0x100,
  "winged beast": 0x200, plant: 0x400, insect: 0x800, thunder: 0x1000, dragon: 0x2000, beast: 0x4000, "beast-warrior": 0x8000,
  dinosaur: 0x10000, fish: 0x20000, "sea serpent": 0x40000, reptile: 0x80000, psychic: 0x100000 };
const ATTRS = { earth: 0x1, water: 0x2, fire: 0x4, wind: 0x8, light: 0x10, dark: 0x20, divine: 0x40 };
const TYPE = { MONSTER: 0x1, SPELL: 0x2, TRAP: 0x4, EFFECT: 0x20, RITUAL: 0x80, QUICKPLAY: 0x10000, CONTINUOUS: 0x20000, EQUIP: 0x40000,
  FIELD: 0x80000, COUNTER: 0x100000, FLIP: 0x200000, TOKEN: 0x4000 };

const EMPTY = Object.freeze({ a: 0, t: 0 });
const num = (m) => (m ? Number(m[1]) : 0);
/** Razas y atributos nombrados en un trozo de texto ("all insect, beast, plant, and beast-warrior monsters"). */
function kinds(s) {
  let race = 0, attr = 0;
  for (const part of s.split(/,| and | or /)) {
    const w = part.replace(/-type/g, "").replace(/\b(all|face-up|monsters?|the)\b/g, "").trim();
    if (RACES[w]) race |= RACES[w]; else if (ATTRS[w]) attr |= ATTRS[w];
  }
  return [race, attr];
}

/**
 * @param {any[]} r fila de cards.json: [alias, setcode, type, atk, def, level, race, attribute, ot, nombre, texto, frases]
 * @returns {{a:number, t:number, burn?:number, heal?:number, up?:number, upDef?:number, down?:number, lp?:number, draw?:number,
 *   trib?:number, pos?:number, swap?:number, race?:number, attr?:number, v?:number}}
 */
export function profileCard(r) {
  if (!r) return EMPTY;
  const type = r[2], isMon = (type & TYPE.MONSTER) !== 0;
  if (isMon && !(type & TYPE.EFFECT)) return (type & TYPE.TOKEN) ? { a: A.TOKEN, t: 0 } : EMPTY;
  const s = String(r[10] || "").toLowerCase().replace(/\s+/g, " ").replace(/life points?/g, "lp").replace(/graveyards?/g, "gy")
    .replace(/removed? from play/g, "banished").replace(/remove from play/g, "banish").replace(/on your opponent's side of the field/g, "your opponent controls")
    .replace(/on your side of the field/g, "you control").replace(/spell (and|or|\/) trap cards?/g, "spell/trap").replace(/spells? (and|or|\/) traps?/g, "spell/trap")
    .replace(/(spell|trap|monster) cards?/g, "$1").replace(/-type monster/g, " monster")
    // Cláusulas de mantenimiento que no son el efecto ("cuando esta carta deja el campo, destruye ese monstruo").
    .replace(/when (?:this card|it|that monster) (?:leaves the field|is destroyed), destroy (?:that monster|this card|it|the equipped monster)\.?/g, "")
    .replace(/\(excluding special summon\)/g, "");
  const p = { a: 0, t: 0 }; const has = (re) => re.test(s);
  // En mágicas y trampas el costo va al principio; más adelante suele ser un efecto secundario u opcional.
  const head = isMon ? s : s.replace(/^\([^)]*\) ?/, "").slice(0, 95); const hasHead = (re) => re.test(head);
  const SS = "special summons? (?:\\d|an? |this card|it\\b|that|as many|up to|any|them|the |all |both|\")";
  const OPP = "(?:your opponent controls|your opponent's|they control)";

  // ---- quitar monstruos ----
  if (has(/destroy all (?:face-up |attack position |defense position )*monsters on the field/)) p.a |= A.WIPE_ALL;
  if (has(new RegExp(`destroy all (?:face-up |attack position |defense position )*monsters ${OPP}|destroy all your opponent's (?:attack position |face-up )*monsters|destroy all of their monsters`))) p.a |= A.WIPE_OPP;
  if (has(/target (?:\d|up to \d|that|the|the attacking|that attacking) [^.;]*?(?:monsters?|cards?)[^.;]*?; (?:destroy|banish|send)/)
    || has(new RegExp(`destroy (?:the )?(?:1|one|that|the attacking|that attacking) [^.;]*?monsters? (?:${OPP}|on the field)`))
    || has(/destroy (?:the|that) (?:attacking|opponent's|face-up|summoned) monster|the monster is destroyed|destroy that monster|banish that monster|destroy (?:that|the) attack target/)
    || has(new RegExp(`destroy \\d monsters? ${OPP}|destroy the [^.;]*?monster ${OPP}`))
    || has(/destroy that monster\(s\)|destroy the monsters among them/)) p.a |= A.REMOVE_MON;
  if (has(/destroy the 1 [^.;]*?monster on the field|destroy (?:1|one) monster on the field whose/)) { p.a |= A.REMOVE_MON; p.t |= T.ALL_FIELD; }
  if ((p.a & A.REMOVE_MON) && has(/in (?:your|either|any|their) gy; (?:destroy|banish)/) && !has(/on the field|your opponent controls/)) p.a &= ~A.REMOVE_MON;

  // ---- quitar mágicas y trampas ----
  if (has(/destroy all spell\/trap|return all spell\/trap/)) p.a |= A.WIPE_ST;
  else if (has(/target (?:\d|up to \d) (?![^.;]*?\bgy\b)[^.;]*?(?:spell\/trap|spell|trap|card)s? [^.;]*?; (?:destroy|banish)/) || has(/destroy (?:1|one|that) [^.;]*?(?:spell\/trap|spell|trap)(?! monster)/)) p.a |= A.REMOVE_ST;

  // ---- ventaja de cartas ----
  let m = s.match(/draws? (\d+) cards?/) || (has(/draw until you have/) ? ["", 2] : null);
  if (m && !has(/each time you draw/)) { p.a |= A.DRAW; p.draw = Number(m[1]); }
  if (has(/from your deck to (?:your|the) hand|add (?:it|1 of them) to your hand/)) p.a |= A.SEARCH;
  if (has(/in your gy[^.]*?(?:add|return) (?:it|them|that target|those targets|this card) to (?:your|the) hand/) || has(/if this card is in your gy: you can return it to (?:your|the) hand/)) p.a |= A.RECOVER;
  if (has(new RegExp(`(?<!your opponent can )${SS}[^.]*?from (?:your|either|their|any|your opponent's|the) gy`)) || has(new RegExp(`in (?:your|either|any|your opponent's) gy[^.]*?; ${SS}`))
    || has(/special summon (?:it|that target|this card)(?: in [a-z-]+ position)? during your next standby/)) p.a |= A.REVIVE;
  else if (has(new RegExp(`(?<!your opponent can )${SS}`))) p.a |= A.SUMMON;
  if (has(/tokens?"? \(/)) p.a |= A.TOKEN | A.SUMMON;
  if (has(/fusion summon (?:1|a|one)/)) p.a |= A.FUSION;
  if ((type & TYPE.RITUAL) && (type & TYPE.SPELL)) p.a |= A.RITUAL;

  // ---- LP ----
  m = s.match(/inflict (\d+) (?:points of )?damage to your opponent/);
  if (m || has(/inflict damage to your opponent|your opponent takes? \d+ (?:points of )?damage|inflict \d+ (?:points of )?damage to the player/)) { p.a |= A.BURN; p.burn = num(m); }
  m = s.match(/(?:increase your lp by|(?<!opponent |they )gain) (\d+)(?: lp| points)/);
  if (m || has(/(?<!opponent |they )gain lp equal/)) { p.a |= A.HEAL; p.heal = num(m); }
  if (has(/(?:and|you take) \d+ (?:points of )?damage to your lp|you take \d+ (?:points of )?damage|take damage equal to/)) p.t |= T.SELF_DAMAGE;

  // ---- batalla ----
  if (has(/negate (?:the|its|that|their|your opponent's) (?:activation|summon|effects?)|negate all/)) p.a |= A.NEGATE;
  if (has(/take no (?:battle )?damage|cannot be destroyed by battle this turn|negate (?:the|that) attack|end the battle phase/)) p.a |= A.PROTECT;
  m = s.match(/gains? (\d+) atk/) || s.match(/increases? (?:its|their|the|a selected monster's)? ?atk(?: and def)?(?: of [^.]*?)? by (\d+)/) || s.match(/atk increases by (\d+)/);
  if (m) { p.a |= A.BUFF; p.up = Number(m[1]); }
  m = s.match(/gains? \d+ atk(?:\/| and )def/) ? [0, p.up] : s.match(/increases? (?:its|their|the|a selected monster's)? ?def(?: of [^.]*?)? by (\d+)/) || s.match(/gains? (\d+) def/);
  if (m) { p.a |= A.BUFF; p.upDef = Number(m[1]); }
  if (has(/switch the original atk and def/)) { p.a |= A.BUFF; p.swap = 1; }
  if (has(/gain atk\/def equal to the result x 100/)) { p.a |= A.BUFF; p.up = p.upDef = 350; }
  if (!(p.a & A.BUFF) && has(/gains? atk|gain atk\/def equal|atk becomes double/)) p.a |= A.BUFF;
  m = s.match(/loses? (\d+) atk/) || s.match(/decreases? (?:its|their|the)? ?atk(?: of [^.]*?)? by (\d+)/);
  if (m || has(/atk becomes 0|lose atk|loses that much atk/)) { p.a |= A.DEBUFF; p.down = m ? Number(m[1]) : has(/result x 100|that much/) ? 350 : 9999; }
  if (has(/take control of/)) p.a |= A.CONTROL;
  if (has(/return (?:it|that target|those targets|that monster|that card|them) to (?:the|its owner's|their owner's|your opponent's) hand|return it to its owner's hand|shuffle (?:it|that target) into the deck/) && !(p.a & A.RECOVER)) p.a |= A.BOUNCE;
  if (has(/your opponent discards?|discard \d (?:random )?cards? from (?:their|your opponent's) hand|send \d cards? from their hand to the gy|make your opponent discard|discard 1 random card from their hand/)) p.a |= A.HANDKILL;
  const toAtk = has(/change (?:it|that target|that monster) to (?:face-up )?attack position/), toDef = has(/change (?:it|that target|that monster) to (?:face-up |face-down )?defense position/);
  if (toAtk || toDef || has(/(?<!or )change (?:that target's|its|the) battle position|change the battle position of (?:1|that)/)) { p.a |= A.POSITION; p.pos = toAtk ? 1 : toDef ? 2 : 3; }
  if (has(/(?:your opponent's monsters|monsters your opponent controls|monsters with [^.]*?|level \d or higher monsters|; it|, also it) cannot (?:declare an )?attack|it cannot attack or change/)) p.a |= A.LOCK;
  if (has(/toss a coin|roll a (?:six-sided )?die/)) p.a |= A.GAMBLE;

  // ---- cuándo y a qué costo ----
  if (has(/when (?:an|your) opponent'?s? monster (?:declares an attack|attacks)|if an opponent's monster declares an attack/)) p.t |= T.ON_ATTACK;
  if (has(/when (?:your opponent|a monster\(?s?\)?|a monster) [^.:]*?summon|summoned by your opponent|when a monster\(s\) would be summoned/) && !isMon) p.t |= T.ON_SUMMON;
  if (!isMon && ((type & TYPE.COUNTER) || has(/when (?:a|your opponent activates a) (?:spell|trap|spell\/trap)(?: or [a-z ]+)? is activated|when your opponent activates/))) p.t |= T.ON_ACTIVATE;
  if (hasHead(/(?<!opponent )discard (?:\d|a|one) [^.;:]*?(?:;|, then|to target|to the gy to|\. return)/)) p.t |= T.COST_DISCARD;
  if (has(/tribute this card/)) p.t |= T.SELF_TRIBUTE;
  if (hasHead(/(?:^|[.:;●] ?|you can |by )(?:tribute|tributing|offer) (?:\d|a|one|\d or more) (?!"petit moth")[^.;]*?(?:monsters?|"[^"]+")[^.;]*?(?:;|,| to |\.| as )/)) p.t |= T.COST_TRIBUTE;
  m = head.match(/pay(?:ing)? (\d+) lp/);
  if (m) p.lp = Number(m[1]); else if (hasHead(/pay half your lp/)) p.lp = -1;
  if (has(/pay lp so that you only have/)) p.t |= T.ALL_IN;
  if (has(/if you tribute a monster, you must tribute that target/)) p.t |= T.TRIBUTE_OPP;
  if (has(/reduce the levels? of all monsters in your hand/)) p.t |= T.LEVEL_DOWN;
  if (has(/cannot conduct your battle phase/)) p.t |= T.NO_BP;
  if (has(/you cannot (?:normal |special )?summon other monsters|you cannot summon other monsters/)) p.t |= T.NO_SUMMON;
  if (has(/banish all other cards you control|send your entire hand|discard your entire hand/)) p.t |= T.HEAVY_COST;
  if (has(/your opponent can special summon|to your opponent's field|your opponent draws|(?:your opponent|they) gains? \d+ lp|give control of|(?:both|each) players? special summons?/)) p.t |= T.GIFT;
  if (has(/in (?:either|any|your opponent's|their) gy/)) p.any = 1;

  // ---- rasgos del monstruo ----
  if (isMon) {
    if (has(/cannot be normal summoned/)) p.t |= T.NO_NS;
    m = s.match(/requires? (\d) tributes/); if (m) p.trib = Number(m[1]);
    if (has(/^(?:\([^)]*\) )?(?:this card )?cannot be destroyed by battle|\. (?:this card )?cannot be destroyed by battle\./)) p.t |= T.BATTLE_IMMUNE;
    if (has(/when this card is destroyed|if this card is destroyed|when this card (?:you control |in your possession )?(?:is|has been) sent (?:from the field )?to (?:the|your) gy|if this card is sent from the field to the gy|when this card you control is sent to your gy/)) p.t |= T.FLOATER;
    if (has(/(?:can|may) attack (?:your opponent(?:'s lp)?) directly/)) p.t |= T.DIRECT;
    if (has(/piercing|inflict the difference as battle damage/)) p.t |= T.PIERCE;
    if (has(/second attack|attack twice/)) p.t |= T.DOUBLE;
    if (has(/cannot declare an attack unless/)) p.t |= T.ATTACK_COST;
    if (has(/if this card is flip summoned/)) p.t |= T.FLIP_SUMMON;
    m = s.match(/gains (\d+) atk(?:\/def)? for each card in your hand/); if (m) p.perHand = Number(m[1]);
    if (has(/(?:when|if) this (?:card|monster) is (?:normal )?summoned|(?:when|if) this (?:card|monster) is normal(?:,| or) /)) p.t |= T.ON_NS;
    if (has(/change this card to face-down defense position|flip this card into face-down defense position/)) p.t |= T.SELF_FLIPDOWN;
    if (has(/\(quick effect\)|during either player's turn/)) p.t |= T.QUICK;
    if (has(/this card cannot (?:declare an )?attack|cannot attack the turn|this card cannot attack/)) p.t |= T.CANT_ATTACK;
  } else {
    // A quién ayuda un campo o a qué se puede equipar.
    m = s.match(/(?:all|of all) ([a-z ,-]+?) monsters/) || s.match(/equip only to an? ([a-z -]+?) monster/) || s.match(/^an? ([a-z-]+) monster equipped/);
    if (m) { const [race, attr] = kinds(m[1]); if (race) p.race = race; if (attr) p.attr = attr; }
  }

  // Valor del efecto, en la misma escala que usa la IA (una carta ≈ 1000).
  const a = p.a; let v = 0;
  if (a & (A.WIPE_OPP | A.WIPE_ALL)) v += 700;
  if (a & A.REMOVE_MON) v += 500;
  if (a & (A.REMOVE_ST | A.WIPE_ST)) v += 300;
  if (a & A.DRAW) v += 250 * Math.min(3, p.draw || 1);
  if (a & (A.SEARCH | A.RECOVER)) v += 350;
  if (a & (A.REVIVE | A.CONTROL)) v += 500;
  if (a & A.SUMMON) v += 250;
  if (a & (A.NEGATE | A.LOCK | A.HANDKILL | A.BOUNCE)) v += 300;
  if (a & A.PROTECT) v += 200;
  if (a & A.BURN) v += Math.min(400, (p.burn || 500) / 3);
  if (a & A.HEAL) v += Math.min(200, (p.heal || 500) / 8);
  if (a & A.BUFF) v += Math.min(300, (p.up || p.upDef || 300) / 3);
  if (isMon) {
    if (p.t & (T.BATTLE_IMMUNE | T.FLOATER)) v += 300;
    if (p.t & (T.DIRECT | T.PIERCE | T.DOUBLE)) v += 200;
    if (p.t & (T.CANT_ATTACK | T.ATTACK_COST)) v -= 200;
    v = Math.min(v, 900);
  }
  if (v) p.v = Math.round(v);
  return p;
}

/** Nombres de las categorías de un perfil, para leerlo o depurarlo. */
export function describeProfile(p) {
  const out = [];
  for (const [k, bit] of Object.entries(A)) if (p.a & bit) out.push(k);
  for (const [k, bit] of Object.entries(T)) if (p.t & bit) out.push(k.toLowerCase());
  for (const k of ["burn", "heal", "up", "upDef", "down", "lp", "draw", "trib", "pos", "swap", "any", "perHand", "race", "attr", "v"]) if (p[k]) out.push(k + "=" + p[k]);
  return out.join(" ");
}
