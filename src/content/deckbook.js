// Registro de todos los mazos del juego para el editor de mazos (modo admin, D-45).
// Cada mazo tiene una clave ("starter:kuriboh", "trainer:route1_bug", "rival:weevil:early", "spirit:watapon", "starterkey:kuriboh:0").
// Capas, de abajo hacia arriba:
//   1. Código: lo escrito en decks.js, rivals.js y spirits.js.
//   2. Archivos: deck-overrides.js, que escribe "Definir en el juego" (tools/serve.mjs). Sale con PUBLICAR.
//   3. Partida: game.state.deckOverrides, que escribe "Aplicar en la partida". Solo vale en esa partida guardada.
// El registro cambia en el lugar las listas de decks.js, rivals.js y spirits.js, así todo el juego (historia,
// recompensas, herramientas) usa el mazo vigente sin saber que existe el editor.
import { STARTERS, STARTER_KEYS, TRAINER_DECKS } from "./decks.js";
import { RIVALS } from "./rivals.js";
import { SPIRITS } from "./spirits.js";
import { ROUTE_PLAN } from "./progression.js";
import { DECK_OVERRIDES } from "./deck-overrides.js";

const DECK_RULES = { min: 40, max: 60, extraMax: 15, copies: 3 };
const trainerName = (id) => ROUTE_PLAN.find((s) => s.deck[0] === "trainer" && s.deck[1] === id)?.name || id;

/** @typedef {{key:string, group:string, name:string, sub:string, rules:{min:number,max:number,extraMax:number,copies:number}, hasExtra:boolean, read:()=>{main:any[],extra:any[]}, write:(d:{main:any[],extra:any[]})=>void}} DeckEntry */
/** @type {DeckEntry[]} */
export const DECKBOOK = [];
const add = (e) => DECKBOOK.push({ hasExtra: true, rules: DECK_RULES, ...e });
const setList = (obj, field, list) => { obj[field].length = 0; obj[field].push(...list.map(([n, q]) => [n, q])); };

for (const [k, s] of Object.entries(STARTERS)) {
  add({ key: "starter:" + k, group: "Iniciales", name: s.title, sub: `Inicial de ${s.spirit}`,
    read: () => ({ main: s.main, extra: s.extra }), write: (d) => { setList(s, "main", d.main); setList(s, "extra", d.extra); } });
  STARTER_KEYS[k].forEach((stage, i) => add({ key: `starterkey:${k}:${i}`, group: "Cartas clave de las iniciales", name: `${s.spirit} · ${stage.title}`,
    sub: i === 0 ? "Etapa 1: paquete de Don Teo" : "Etapa 2: al ganarle al líder", hasExtra: false, rules: { min: 0, max: 12, extraMax: 0, copies: 3 },
    read: () => ({ main: stage.cards, extra: [] }), write: (d) => { stage.cards.length = 0; stage.cards.push(...[...d.main, ...d.extra].map(([n, q]) => [n, q])); } }));
}
for (const [k, t] of Object.entries(TRAINER_DECKS)) {
  if (!t.extra) t.extra = [];
  add({ key: "trainer:" + k, group: "Entrenadores", name: trainerName(k), sub: k,
    read: () => ({ main: t.main, extra: t.extra }), write: (d) => { setList(t, "main", d.main); setList(t, "extra", d.extra); } });
}
for (const [k, r] of Object.entries(RIVALS)) for (const v of ["early", "strong"]) {
  const d = r[v]; if (!d) continue; if (!d.extra) d.extra = [];
  add({ key: `rival:${k}:${v}`, group: "Personajes de la serie", name: `${r.name} · ${v === "early" ? "temprano" : "fuerte"}`, sub: `${d.label} · ${r.role}`,
    read: () => ({ main: d.main, extra: d.extra }), write: (x) => { setList(d, "main", x.main); setList(d, "extra", x.extra); } });
}
for (const [k, sp] of Object.entries(SPIRITS)) {
  if (!sp.extra) sp.extra = [];
  add({ key: "spirit:" + k, group: "Espíritus salvajes", name: sp.name, sub: `${sp.lp} LP · da ${sp.card}`, rules: { min: 10, max: 60, extraMax: 15, copies: 3 },
    read: () => ({ main: sp.deck, extra: sp.extra }), write: (d) => { setList(sp, "deck", d.main); setList(sp, "extra", d.extra); } });
}
export const DECK_GROUPS = [...new Set(DECKBOOK.map((e) => e.group))];
export const entry = (key) => DECKBOOK.find((e) => e.key === key);

const clone = (d) => ({ main: d.main.map(([n, q]) => [n, q]), extra: (d.extra || []).map(([n, q]) => [n, q]) });
const CODE = Object.fromEntries(DECKBOOK.map((e) => [e.key, clone(e.read())]));
let fileLayer = { ...DECK_OVERRIDES };
let partidaLayer = {};

function refresh() {
  for (const e of DECKBOOK) e.write(clone(partidaLayer[e.key] || fileLayer[e.key] || CODE[e.key]));
}
/** Mazo original del código, sin cambios del editor. */
export const codeDeck = (key) => clone(CODE[key]);
/** Mazo fijado en los archivos (o el del código si no hay). */
export const fileDeck = (key) => clone(fileLayer[key] || CODE[key]);
/** Mazo vigente en este momento (partida > archivos > código). */
export const currentDeck = (key) => clone(entry(key).read());
/** De dónde sale el mazo vigente: "partida", "archivos" o "codigo". */
export const deckSource = (key) => (partidaLayer[key] ? "partida" : fileLayer[key] ? "archivos" : "codigo");
export const fileOverrides = () => ({ ...fileLayer });

/** Capa de la partida: se llama al cargar o empezar una partida con game.state.deckOverrides. Claves viejas que ya no existen se ignoran. */
export function setPartidaLayer(overrides) {
  partidaLayer = Object.fromEntries(Object.entries(overrides || {}).filter(([k]) => entry(k)));
  refresh();
}
/** Capa de archivos: después de que el servidor local escribió deck-overrides.js. */
export function setFileLayer(overrides) {
  fileLayer = Object.fromEntries(Object.entries(overrides || {}).filter(([k]) => entry(k)));
  refresh();
}
/** Mismo contenido, sin importar el orden ni cómo se agruparon las copias. */
export function sameDeck(a, b) {
  const norm = (d) => JSON.stringify(["main", "extra"].map((f) => {
    const m = {}; for (const [n, q] of d[f] || []) m[n] = (m[n] || 0) + q; return Object.entries(m).sort();
  }));
  return norm(a) === norm(b);
}
refresh();
