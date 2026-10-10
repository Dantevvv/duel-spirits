import { STARTERS } from "./decks.js";
import { GYMS } from "./progression.js";

// Solo migra el inicial intacto. Una baraja editada por el jugador nunca se reemplaza.
// Revisión 2 (D-33, D-34) y revisión 3 (D-40: cartas clave fuera, se ganan avanzando).
const REV1_SWAPS = {
  kuriboh: [["Big Shield Gardna", "Diskblade Rider"], ["Spirit of the Harp", "Opticlops"], ["Castle Walls", "Rush Recklessly"]],
  gigobyte: [["7 Colored Fish", "High Tide Gyojin"], ["Mermaid Knight", "High Tide Gyojin"], ["Fake Trap", "White Elephant's Gift"], ["Hammer Shot", "Order to Charge"]],
};
// Barajas exactas de la revisión 2 (antes de D-40).
const REV2 = {
  kuriboh: { main: [
    ["Kuriboh", 3], ["Kuribee", 1], ["Kuriboo", 1], ["Big Shield Gardna", 1], ["Diskblade Rider", 1], ["Giant Soldier of Stone", 2],
    ["Mystical Elf", 1], ["Opticlops", 1], ["Wall of Illusion", 1], ["Morphing Jar", 1], ["Mystic Tomato", 2],
    ["Nimble Momonga", 1], ["Marshmallon", 1], ["Summoned Skull", 1], ["Kuribabylon", 1], ["Des Koala", 1], ["Celtic Guardian", 1], ["Axe Raider", 1],
    ["Multiply", 2], ["Hammer Shot", 1], ["Scapegoat", 1], ["Shield & Sword", 1], ["Dian Keto the Cure Master", 1],
    ["Red Medicine", 1], ["Monster Reborn", 1], ["Fissure", 1], ["Rush Recklessly", 2],
    ["Waboku", 1], ["Negate Attack", 1], ["Castle Walls", 1], ["Trap Hole", 1], ["Fake Trap", 1], ["Reinforcements", 1], ["Sakuretsu Armor", 1]], extra: [] },
  gigobyte: { main: [
    ["Gigobyte", 3], ["Gagagigo", 2], ["Giga Gagagigo", 1], ["Gogiga Gagagigo", 1], ["Mother Grizzly", 2], ["7 Colored Fish", 1], ["High Tide Gyojin", 2],
    ["Unshaven Angler", 1], ["Mermaid Knight", 1], ["Cure Mermaid", 1], ["The Legendary Fisherman", 1], ["Aqua Madoor", 1],
    ["Star Boy", 1], ["Penguin Knight", 1], ["Hyozanryu", 1],
    ["Umi", 2], ["A Legendary Ocean", 1], ["Salvage", 1], ["Order to Charge", 1], ["Rush Recklessly", 1], ["Red Medicine", 1],
    ["Ookazi", 1], ["Monster Reborn", 1], ["Spiritual Water Art - Aoi", 1],
    ["Tornado Wall", 1], ["Trap Hole", 2], ["Reinforcements", 2], ["Waboku", 1], ["Castle Walls", 1], ["Raigeki Break", 1],
    ["Sakuretsu Armor", 1], ["White Elephant's Gift", 1]], extra: [] },
  timewizard: { main: [
    ["Time Wizard", 3], ["Baby Dragon", 3], ["Alligator's Sword", 1], ["Arcana Force 0 - The Fool", 1],
    ["Arcana Force I - The Magician", 2], ["Arcana Force III - The Empress", 1], ["Arcana Force VI - The Lovers", 1],
    ["Arcana Force VII - The Chariot", 1], ["Barrel Dragon", 1], ["Blowback Dragon", 1], ["Rocket Warrior", 1],
    ["Celtic Guardian", 1], ["Axe Raider", 1], ["Masked Dragon", 1],
    ["Polymerization", 2], ["Fusion Sage", 1], ["Graceful Dice", 1], ["Light Barrier", 1], ["Second Coin Toss", 1],
    ["Lucky Iron Axe", 1], ["Hinotama", 1], ["Monster Reborn", 1], ["Ookazi", 1], ["Sparks", 1],
    ["Fairy Box", 1], ["Skull Dice", 1], ["Roulette Barrel", 1], ["Sakuretsu Armor", 2], ["Trap Hole", 2], ["Raigeki Break", 1],
    ["Waboku", 1], ["Reckless Greed", 1]], extra: [["Thousand Dragon", 2], ["Alligator's Sword Dragon", 1]] },
};
const same = (a, b) => {
  const x = [...a].sort((p, q) => p - q), y = [...b].sort((p, q) => p - q);
  return x.length === y.length && x.every((n, i) => n === y[i]);
};

export function updateUntouchedStarter(st, idsOf, idOf) {
  const key = st.starter; if (!STARTERS[key] || (st.starterRevision || 1) >= 3) return false;
  // Revisión 1 → 2: reconstruye la lista anterior desde la de la revisión 2.
  if ((st.starterRevision || 1) < 2 && REV1_SWAPS[key]) {
    const rev2 = idsOf(REV2[key].main), rev1 = [...rev2];
    for (const [oldName, newName] of REV1_SWAPS[key]) rev1[rev1.indexOf(idOf(newName))] = idOf(oldName);
    if (!same(st.deck.main, rev1) || !same(st.deck.extra, idsOf(REV2[key].extra))) return false;
  } else if (!same(st.deck.main, idsOf(REV2[key].main)) || !same(st.deck.extra, idsOf(REV2[key].extra))) return false;
  st.deck = { main: idsOf(STARTERS[key].main), extra: idsOf(STARTERS[key].extra) };
  st.starterRevision = 3;
  return true;
}

/** Ajustes de guardados anteriores a Ciudad Verde: solo los líderes de gimnasio dan Localizadora (D-39). */
export function migrateSave(st) {
  const leaders = new Set(Object.values(GYMS).map((g) => g.leader));
  st.locators = [...new Set((st.locators || []).filter((id) => leaders.has(id)))];
  if (st.leadersBeaten?.rex) st.flags.gym_rex = true;
  if (st.leadersBeaten?.mako) st.flags.gym_mako = true;
  if (st.leadersBeaten?.weevil) st.flags.gym_weevil = true;
  // Quien estaba parado donde ya no hay nada (norte de la vieja Ruta 1) sigue igual: el mapa es el mismo.
}
