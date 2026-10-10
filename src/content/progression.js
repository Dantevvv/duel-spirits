// Plan del recorrido hasta el primer gimnasio, en orden de dificultad.
// Lo leen los scripts de historia (story.js) y la herramienta de balance (tools/balance.mjs),
// así los LP, la habilidad de la IA y el premio son los mismos en el juego y en la medición.
//   deck: ["trainer", id] (decks.js) · ["rival", id, "early"|"strong"] (rivals.js) · ["starter", etapa] (baraja del rival, D-40)
import { TRAINER_DECKS, STARTERS, starterAtStage } from "./decks.js";
import { RIVALS } from "./rivals.js";

export const ROUTE_PLAN = [
  { id: "route1_bug", name: "Cazabichos Tomás", deck: ["trainer", "route1_bug"], skill: 0.5, money: 120 },
  { id: "route1_rock", name: "Montañista Bruno", deck: ["trainer", "route1_rock"], skill: 0.6, money: 150 },
  { id: "route1_sword", name: "Espadachín Nico", deck: ["trainer", "route1_sword"], skill: 0.65, money: 170 },
  { id: "route1_zombie", name: "Ocultista Sara", deck: ["trainer", "route1_zombie"], skill: 0.7, money: 200 },
  { id: "route1_chumley", name: "Chumley Huffington", deck: ["rival", "chumley", "early"], skill: 0.7, money: 250 },
  { id: "rival_verde", name: "{RIVAL}", deck: ["starter", 1], skill: 0.7, money: 300 },
  { id: "gym_rex", name: "Rex Raptor", deck: ["rival", "rex", "early"], skill: 0.75, money: 250 },
  { id: "gym_mako", name: "Mako Tsunami", deck: ["rival", "mako", "early"], skill: 0.75, money: 250 },
  { id: "gym_weevil", name: "Weevil Underwood", deck: ["rival", "weevil", "early"], skill: 0.85, money: 400 },
  // Solo para playtest (D-42): la semifinal real, para medir la curva contra el final del juego.
  { id: "test_yugi", name: "Yami Yugi", deck: ["rival", "yugi", "strong"], skill: 0.9, money: 0 },
];
export const PLAN = Object.fromEntries(ROUTE_PLAN.map((s) => [s.id, s]));

/** Deck de un paso del plan. rivalStarter: la inicial del rival (solo para ["starter", n]); por defecto, la de Agua. */
export function deckFor(step, rivalStarter = "gigobyte") {
  const [kind, a, b] = step.deck;
  if (kind === "trainer") return TRAINER_DECKS[a];
  if (kind === "rival") return RIVALS[a][b];
  if (kind === "starter") return STARTERS[rivalStarter] ? starterAtStage(rivalStarter, a) : null;
  throw new Error("Deck desconocido: " + step.deck);
}

// Gimnasio de Ciudad Verde (D-39): hay que ganarles a los dos primeros para poder desafiar al líder.
export const GYMS = {
  verde: { name: "Gimnasio de Ciudad Verde", trainers: ["rex", "mako"], leader: "weevil" },
};
