// Estado de la partida y guardado en el navegador.
const KEY = "yugipoke_save_v1";

export const DEFAULT_OPTIONS = {
  persistentLP: true,   // los LP no se recargan entre duelos (prueba de diseño)
  maxLP: 8000,
  textSpeed: 2,         // 1 lento, 2 normal, 3 rápido
  duelSpeed: 2,         // velocidad de animaciones de duelo
  askChain: "smart",    // "always" | "smart" (solo cuando hay algo para activar)
  sound: true,          // efectos de sonido
  cardLang: "es",       // idioma de nombres y textos de cartas: "es" | "en"
};

export function newState() {
  return {
    version: 1,
    player: "Yusei", rival: "Kai",
    map: "house2f", x: 4, y: 3, dir: "down",
    flags: {},
    starter: null,            // "kuriboh" | "gigobyte" | "timewizard"
    deck: { main: [], extra: [] }, // ids de carta
    collection: {},           // id -> copias fuera del deck
    money: 500,
    lp: 8000,
    heal: { map: "house1f", x: 6, y: 4, dir: "up" }, // último punto de curación
    spiritsBeaten: {},        // id espíritu -> victorias
    leadersBeaten: {},        // líderes disponibles para revanchas y sobres
    locators: [],
    keyStage: 0,              // etapas de cartas clave de la inicial ya entregadas (D-40)
    stats: { wins: 0, losses: 0, steps: 0 },
    options: { ...DEFAULT_OPTIONS },
    playTime: 0,
  };
}

export const game = { state: newState() };

export function hasSave() { try { return !!localStorage.getItem(KEY); } catch { return false; } }
export function save() { try { localStorage.setItem(KEY, JSON.stringify(game.state)); return true; } catch { return false; } }
export function load() {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return false;
    const s = JSON.parse(raw); game.state = { ...newState(), ...s, options: { ...DEFAULT_OPTIONS, ...(s.options || {}) } }; return true;
  } catch { return false; }
}
export function wipe() { try { localStorage.removeItem(KEY); } catch {} game.state = newState(); }

export const flag = (name) => !!game.state.flags[name];
export const setFlag = (name, v = true) => { game.state.flags[name] = v; };
/** Evalúa condiciones simples tipo "hasDeck" o "!rivalLeftShop". */
export function check(cond) { if (!cond) return true; return cond.startsWith("!") ? !flag(cond.slice(1)) : flag(cond); }

export function addCard(id, n = 1) { game.state.collection[id] = (game.state.collection[id] || 0) + n; }
export function fmt(text) {
  return text.replaceAll("{PLAYER}", game.state.player).replaceAll("{RIVAL}", game.state.rival);
}
