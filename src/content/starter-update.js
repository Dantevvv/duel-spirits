import { STARTERS } from "./decks.js";

// Solo migra el inicial intacto. Una baraja editada por el jugador nunca se reemplaza.
const SWAPS = {
  kuriboh: [["Big Shield Gardna", "Diskblade Rider"], ["Spirit of the Harp", "Opticlops"], ["Castle Walls", "Rush Recklessly"]],
  gigobyte: [["7 Colored Fish", "High Tide Gyojin"], ["Mermaid Knight", "High Tide Gyojin"], ["Fake Trap", "White Elephant's Gift"], ["Hammer Shot", "Order to Charge"]],
};
export function updateUntouchedStarter(st, idsOf, idOf) {
  if (st.starterRevision === 2 || !SWAPS[st.starter]) return false;
  const starter = STARTERS[st.starter], current = idsOf(starter.main), previous = [...current];
  for (const [oldName, newName] of SWAPS[st.starter]) previous[previous.indexOf(idOf(newName))] = idOf(oldName);
  const same = (a, b) => {
    const sorted = [...b].sort((x, y) => x - y);
    return a.length === b.length && [...a].sort((x, y) => x - y).every((n, i) => n === sorted[i]);
  };
  if (!same(st.deck.main, previous) || !same(st.deck.extra, idsOf(starter.extra))) return false;
  st.deck.main = current; st.starterRevision = 2;
  return true;
}
