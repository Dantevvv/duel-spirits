import { STARTERS, TRAINER_DECKS } from "./decks.js";
import { RIVALS } from "./rivals.js";
import { SETS, THEMES } from "./sets.js";

// ---------------- Sobres de sets reales (D-41) ----------------
// Listas completas TCG-EN (sets.js, generado desde Yugipedia). 9 cartas: 8 comunes y 1 rara o superior.
// Probabilidades propias del juego, inspiradas en el TCG de la época:
//   comunes: C peso 1 · Short Print 0,5 · Super Short Print 0,25
//   carta 9: Rara 72 % · Súper 17 % · Ultra 8 % · Secreta 3 % (si el set no tiene esa rareza, se baja a la siguiente)
const COMMON_WEIGHT = { C: 1, SP: 0.5, SSP: 0.25 };
const RARE_ROLL = [["ScR", 0.03], ["UR", 0.08], ["SR", 0.17], ["R", 0.72]];
const RARE_ORDER = ["ScR", "UR", "SR", "R"];

// Lista prohibida progresiva de los sobres (D-09, PROVISIONAL): estas cartas no salen en ningún sobre
// hasta tener esa cantidad de Tarjetas Localizadoras. Los temáticos de duelistas las respetan también.
export const POWER_LOCK = {
  "Pot of Greed": 3, "Raigeki": 4, "Dark Hole": 3, "Change of Heart": 3, "Mirror Force": 3, "Heavy Storm": 3, "Imperial Order": 5,
  "Monster Reborn": 2, "Snatch Steal": 4, "Delinquent Duo": 4, "Confiscation": 4, "Painful Choice": 5, "Jinzo": 4, "Call of the Haunted": 2,
  "Premature Burial": 2, "Torrential Tribute": 3, "Magic Cylinder": 3, "Ceasefire": 4, "Solemn Judgment": 3, "Card of Safe Return": 5,
  "Thousand-Eyes Restrict": 5, "Black Luster Soldier": 6, "Exodia the Forbidden One": 6, "Right Leg of the Forbidden One": 6,
  "Left Leg of the Forbidden One": 6, "Right Arm of the Forbidden One": 6, "Left Arm of the Forbidden One": 6, "Royal Command": 4,
  "Mage Power": 2, "United We Stand": 2, "Megamorph": 2, "Giant Trunade": 3, "Magic Jammer": 2, "Seven Tools of the Bandit": 2,
  "Graceful Charity": 3, "Summoned Skull": 1, "The Last Warrior from Another Planet": 4,
  "Fiber Jar": 5, "Sangan": 1, "Witch of the Black Forest": 2, "Cyber Jar": 3, "Spellbinding Circle": 2,
};
export const allowed = (st, name) => (st.locators?.length || 0) >= (POWER_LOCK[name] || 0);

// Cada tienda vende sobres distintos (D-41). "locators": Localizadoras necesarias para que aparezca el sobre.
export const SHOPS = {
  teo: { name: "Tienda de Don Teo", sets: [["lob", 0], ["mrd", 0]], themed: false },
  verde: { name: "Tienda de Ciudad Verde", sets: [["mrd", 0], ["srl", 0], ["psv", 0], ["lon", 1]], themed: true },
};

// ---------------- Sobres temáticos de duelistas ----------------
// Las cartas del mazo del duelista más las afines de los sets (mismo Tipo + soporte). Se desbloquean al ganarle.
// 8 cartas del conjunto + 1 carta ícono. Pueden salir repetidas.
export const GYM_DUELISTS = {
  rex: { icon: "Red-Eyes Black Dragon", money: 250, theme: "dino", line: "¡Mis dinosaurios te van a pasar por encima!" },
  mako: { icon: "The Legendary Fisherman", money: 250, theme: "water", line: "El mar no perdona. ¿Estás listo para el duelo?" },
  weevil: { icon: "Insect Queen", money: 400, theme: "insect", line: "Je, je... Llegaste hasta mí. Mi enjambre te va a devorar." },
};
export const ROUTE_LEADERS = GYM_DUELISTS; // nombre anterior (guardados y pruebas viejas)
const TRAINER_PACKS = [
  { id: "bugkid", name: "Baraja de Cazabichos Tomás", deck: "route1_bug", icon: "Man-Eater Bug", theme: "insect", flag: "beat_bugkid" },
  { id: "rock", name: "Baraja de Montañista Bruno", deck: "route1_rock", icon: "Millennium Golem", theme: "rock", flag: "beat_route1_rock" },
  { id: "sword", name: "Baraja de Espadachín Nico", deck: "route1_sword", icon: "Sword Hunter", theme: "warrior", flag: "beat_route1_sword" },
  { id: "zombie", name: "Baraja de Ocultista Sara", deck: "route1_zombie", icon: "Pumpking the King of Ghosts", theme: "zombie", flag: "beat_route1_zombie" },
];
const RIVAL_THEME = { kuriboh: "fairy", gigobyte: "water", timewizard: "dragon" };

export function deckNames(deck) {
  return [...new Set([...(deck.main || deck.deck || []), ...(deck.extra || [])].map(([name]) => name))];
}

function themed(id, name, deck, icon, theme, unlocked, st) {
  const own = new Set(deckNames(deck));
  const extra = (THEMES[theme] || []).filter((n) => !own.has(n));
  const cards = [...[...own].map((n) => [n, n === icon ? "★" : "Mazo"]), ...extra.map((n) => [n, "Afín"])]
    .filter(([n, r]) => r === "★" || allowed(st, n));
  return { id, name, price: 200, themed: true, unlocked, cards };
}

function setPack(id, locators, st) {
  const s = SETS[id];
  return { id, name: s.name, code: s.code, price: 200, themed: false, unlocked: (st.locators?.length || 0) >= locators,
    lockText: locators ? `Necesitás ${locators} Tarjeta${locators > 1 ? "s" : ""} Localizadora${locators > 1 ? "s" : ""}` : "",
    cards: s.cards.filter(([n]) => allowed(st, n)) };
}

/** Sobres de una tienda. Sin shopId: todos los sobres temáticos (para premios y pruebas). */
export function shopPacks(st, shopId) {
  const shop = SHOPS[shopId];
  const packs = shop ? shop.sets.map(([id, n]) => setPack(id, n, st)) : [];
  if (shop && !shop.themed) return packs;
  for (const [id, d] of Object.entries(GYM_DUELISTS)) {
    const r = RIVALS[id];
    packs.push(themed(id, `Baraja de ${r.name}`, r.early, d.icon, d.theme, !!st.leadersBeaten?.[id], st));
  }
  for (const t of TRAINER_PACKS) packs.push(themed(t.id, t.name, TRAINER_DECKS[t.deck], t.icon, t.theme, !!st.flags?.[t.flag], st));
  const chumley = RIVALS.chumley;
  packs.push(themed("chumley", `Baraja de ${chumley.name}`, chumley.early, "Master of Oz", "beast", !!st.flags?.beat_route1_chumley, st));
  const rivalKey = st.flags?.rivalStarter;
  if (STARTERS[rivalKey]) packs.push(themed("rival", `Baraja de ${st.rival}`, STARTERS[rivalKey], STARTERS[rivalKey].spirit, RIVAL_THEME[rivalKey], !!st.flags.beat_rival, st));
  return packs;
}

function weighted(list, random) {
  const total = list.reduce((s, [, w]) => s + w, 0); let r = random() * total;
  for (const [item, w] of list) { r -= w; if (r < 0) return item; }
  return list.at(-1)[0];
}

// Sets: 8 comunes (C/SP/SSP con sus pesos) + 1 rara o superior. Temáticos: 8 del conjunto + 1 ícono.
export function openPack(pack, random = Math.random) {
  const pick = (list) => list[Math.min(list.length - 1, Math.floor(random() * list.length))][0];
  if (pack.themed) {
    const base = pack.cards.filter(([, r]) => r !== "★"), icon = pack.cards.filter(([, r]) => r === "★");
    if (!base.length || !icon.length) throw new Error("Sobre sin cartas disponibles");
    return [...Array.from({ length: 8 }, () => pick(base)), pick(icon)];
  }
  const commons = pack.cards.filter(([, r]) => r in COMMON_WEIGHT).map(([n, r]) => [n, COMMON_WEIGHT[r]]);
  if (!commons.length) throw new Error("Sobre sin cartas comunes");
  const out = Array.from({ length: 8 }, () => weighted(commons, random));
  const want = weighted(RARE_ROLL, random);
  for (const r of RARE_ORDER.slice(RARE_ORDER.indexOf(want))) {
    const list = pack.cards.filter(([, x]) => x === r);
    if (list.length) { out.push(pick(list)); return out; }
  }
  out.push(weighted(commons, random));
  return out;
}

export function buyPack(st, packId, idOf, random = Math.random, shopId) {
  const pack = shopPacks(st, shopId).find((p) => p.id === packId) || (shopId ? null : allPacks(st).find((p) => p.id === packId));
  if (!pack) return { error: "Ese sobre no se vende acá." };
  if (!pack.unlocked) return { error: pack.themed ? "Ganale a ese duelista para desbloquear su sobre." : pack.lockText || "Sobre bloqueado." };
  if (st.money < pack.price) return { error: "No te alcanza el dinero." };
  const cards = openPack(pack, random).map(idOf); // Validar todo antes de cobrar.
  st.money -= pack.price;
  for (const id of cards) st.collection[id] = (st.collection[id] || 0) + 1;
  return { pack, cards };
}

/** Todos los sobres de todas las tiendas (sin repetir), para pruebas. */
export function allPacks(st) {
  const seen = new Map();
  for (const id of [...Object.keys(SHOPS), undefined]) for (const p of shopPacks(st, id)) if (!seen.has(p.id)) seen.set(p.id, p);
  return [...seen.values()];
}

// Compatibilidad: las tres selecciones de 20 cartas de D-32 quedan reemplazadas por los sets completos (D-41).
export const CLASSIC_PACKS = ["lob", "mrd", "srl"].map((id) => ({ id, name: SETS[id].name, price: 200, cards: SETS[id].cards }));
