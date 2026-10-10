import { STARTERS, TRAINER_DECKS } from "./decks.js";
import { RIVALS } from "./rivals.js";

// Selecciones de 20 cartas de los sets TCG originales (no son los sets completos).
// Cada entrada conserva su rareza de impresión: C / R / SR / UR.
// Fuentes: base oficial de Konami, productos 11101000, 11101001 y 11101002.
export const CLASSIC_PACKS = [
  { id: "lob", name: "Legend of Blue Eyes · selección", price: 200,
    cards: [
      ["Celtic Guardian", "SR"], ["Giant Soldier of Stone", "R"], ["Mystical Elf", "SR"],
      ["Silver Fang", "C"], ["Beaver Warrior", "C"], ["Uraby", "C"], ["Trial of Nightmare", "C"],
      ["Skull Red Bird", "C"], ["Petit Dragon", "C"], ["Flame Manipulator", "C"],
      ["Masaki the Legendary Swordsman", "C"], ["Flame Swordsman", "SR"],
      ["Fissure", "R"], ["Polymerization", "SR"], ["De-Spell", "C"], ["Remove Trap", "C"],
      ["Umi", "C"], ["Sogen", "C"], ["Beast Fangs", "C"], ["Trap Hole", "SR"],
    ] },
  { id: "mrd", name: "Metal Raiders · selección", price: 200,
    cards: [
      ["Feral Imp", "C"], ["Winged Dragon, Guardian of the Fortress #1", "C"], ["Baby Dragon", "C"],
      ["Time Wizard", "UR"], ["Kuriboh", "SR"], ["Sangan", "R"], ["Mask of Darkness", "R"],
      ["7 Colored Fish", "C"], ["Great White", "C"], ["Battle Steer", "C"], ["Two-Headed King Rex", "C"],
      ["Flame Cerebrus", "C"], ["Block Attack", "C"], ["Sword of Deep-Seated", "C"],
      ["Shield & Sword", "R"], ["Tribute to The Doomed", "SR"], ["Reinforcements", "C"],
      ["Castle Walls", "C"], ["Fake Trap", "R"], ["Seven Tools of the Bandit", "UR"],
    ] },
  { id: "srl", name: "Spell Ruler · selección", price: 200,
    cards: [
      ["Penguin Knight", "C"], ["High Tide Gyojin", "C"], ["Whiptail Crow", "C"],
      ["Mystic Tomato", "R"], ["Mother Grizzly", "R"], ["Giant Rat", "R"], ["Shining Angel", "R"],
      ["Nimble Momonga", "R"], ["Senju of the Thousand Hands", "R"], ["Relinquished", "UR"],
      ["Rush Recklessly", "R"], ["Malevolent Nuzzler", "C"], ["Horn of Light", "C"],
      ["Black Pendant", "SR"], ["Mystical Space Typhoon", "UR"], ["Horn of the Unicorn", "R"],
      ["Black Illusion Ritual", "SR"], ["The Reliable Guardian", "C"], ["Snake Fang", "C"], ["Spellbinding Circle", "UR"],
    ] },
];

export const ROUTE_LEADERS = {
  weevil: { icon: "Insect Queen", money: 200, line: "¡Mi enjambre está listo! ¿Te animás a enfrentarlo?" },
  rex: { icon: "Red-Eyes Black Dragon", money: 200, line: "¡Vamos a ver si podés con mis dinosaurios!" },
  mako: { icon: "The Legendary Fisherman", money: 200, line: "¡Un duelo junto al camino! Mostrame tu mejor estrategia." },
};

export function deckNames(deck) {
  return [...new Set([...(deck.main || deck.deck || []), ...(deck.extra || [])].map(([name]) => name))];
}

function themed(id, name, deck, icon, unlocked) {
  return { id, name, price: 200, themed: true, unlocked,
    cards: deckNames(deck).map((n) => [n, n === icon ? "★" : "—"]) };
}

export function shopPacks(st) {
  const packs = CLASSIC_PACKS.map((p) => ({ ...p, unlocked: true }));
  for (const [id, leader] of Object.entries(ROUTE_LEADERS)) {
    const r = RIVALS[id];
    packs.push(themed(id, `Baraja de ${r.name}`, r.early, leader.icon, !!st.leadersBeaten?.[id]));
  }
  packs.push(themed("bugkid", "Baraja de Cazabichos Tomás", TRAINER_DECKS.route1_bug, "Man-Eater Bug", !!st.flags.beat_bugkid));
  const rivalKey = st.flags.rivalStarter;
  if (STARTERS[rivalKey]) packs.push(themed("rival", `Baraja de ${st.rival}`, STARTERS[rivalKey], STARTERS[rivalKey].spirit, !!st.flags.beat_rival));
  return packs;
}

// 8 comunes + 1 rara o superior. Las rarezas se conservan; las probabilidades son del juego.
// Temáticos: 8 cartas distintas posibles del mazo + 1 carta ícono. Se permiten repetidas.
export function openPack(pack, random = Math.random) {
  const base = pack.cards.filter(([, rarity]) => pack.themed || rarity === "C");
  const special = pack.cards.filter(([, rarity]) => pack.themed ? rarity === "★" : rarity !== "C");
  if (!base.length || !special.length) throw new Error("Sobre sin cartas disponibles");
  const pick = (list) => list[Math.min(list.length - 1, Math.floor(random() * list.length))][0];
  return [...Array.from({ length: 8 }, () => pick(base)), pick(special)];
}

export function buyPack(st, packId, idOf, random = Math.random) {
  const pack = shopPacks(st).find((p) => p.id === packId);
  if (!pack?.unlocked) return { error: "Ganale a ese duelista para desbloquear su sobre." };
  if (st.money < pack.price) return { error: "No te alcanza el dinero." };
  const cards = openPack(pack, random).map(idOf); // Validar todo antes de cobrar.
  st.money -= pack.price;
  for (const id of cards) st.collection[id] = (st.collection[id] || 0) + 1;
  return { pack, cards };
}
