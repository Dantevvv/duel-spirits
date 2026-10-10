// Espíritus de duelo salvajes (aparecen en la hierba alta).
// La primera victoria da la carta del espíritu; las siguientes dan una carta al azar de "drops".
// lp: vida del espíritu (pocos LP). deck: 20 cartas temáticas.

export const SPIRITS = {
  watapon: {
    name: "Watapon", card: "Watapon", lp: 1000, color: 0xf6e7a1,
    deck: [["Watapon", 3], ["Petit Angel", 2], ["Happy Lover", 3], ["Dancing Fairy", 1], ["Shining Angel", 2],
      ["Gift of The Mystical Elf", 2], ["Dian Keto the Cure Master", 1], ["Red Medicine", 2], ["Waboku", 2], ["Soul of Purity and Light", 2]],
    drops: [["Petit Angel", 3], ["Happy Lover", 3], ["Red Medicine", 3], ["Gift of The Mystical Elf", 2], ["Shining Angel", 2], ["Dancing Fairy", 1], ["Dian Keto the Cure Master", 1]],
  },
  maneater: {
    name: "Insecto Comehombres", card: "Man-Eater Bug", lp: 1000, color: 0x8fb35a,
    deck: [["Man-Eater Bug", 2], ["Basic Insect", 3], ["Leghul", 3], ["Cockroach Knight", 2], ["Pinch Hopper", 1], ["Killer Needle", 2],
      ["Giant Flea", 2], ["Insect Soldiers of the Sky", 1], ["Hinotama", 2], ["Waboku", 2]],
    drops: [["Basic Insect", 3], ["Leghul", 3], ["Killer Needle", 2], ["Cockroach Knight", 2], ["Pinch Hopper", 1], ["Insect Barrier", 1], ["Giant Flea", 2]],
  },
  hanehane: {
    name: "Hane-Hane", card: "Hane-Hane", lp: 1000, color: 0xd9a066,
    deck: [["Hane-Hane", 3], ["Nimble Momonga", 2], ["Leghul", 2], ["Big Koala", 1], ["Rabid Horseman", 1], ["Hiro's Shadow Scout", 2],
      ["Ookazi", 2], ["Rush Recklessly", 2], ["Castle Walls", 2], ["Fake Trap", 1], ["Wild Nature's Release", 2]],
    drops: [["Nimble Momonga", 3], ["Hiro's Shadow Scout", 2], ["Rush Recklessly", 3], ["Wild Nature's Release", 2], ["Ookazi", 2], ["Rabid Horseman", 1]],
  },
  penguin: {
    name: "Guerrero Pingüino", card: "Penguin Soldier", lp: 1200, color: 0x6aa6d6,
    deck: [["Penguin Soldier", 3], ["Penguin Knight", 2], ["Star Boy", 2], ["Unshaven Angler", 2], ["7 Colored Fish", 2], ["Aqua Madoor", 1],
      ["Umi", 2], ["Salvage", 1], ["Tornado Wall", 1], ["Hammer Shot", 1], ["Waboku", 2], ["Trap Hole", 1]],
    drops: [["Penguin Knight", 3], ["Star Boy", 3], ["Umi", 2], ["Salvage", 2], ["Unshaven Angler", 2], ["Hammer Shot", 1], ["Tornado Wall", 1]],
  },
  mokey: {
    name: "Mokey Mokey", card: "Mokey Mokey", lp: 800, color: 0xf2f2f2,
    deck: [["Mokey Mokey", 3], ["Mokey Mokey Smackdown", 2], ["Petit Angel", 2], ["Happy Lover", 3], ["Shining Angel", 2], ["Polymerization", 1],
      ["Red Medicine", 2], ["Waboku", 2], ["Fake Trap", 1], ["Castle Walls", 2]],
    extra: [["Mokey Mokey King", 1]],
    drops: [["Mokey Mokey Smackdown", 3], ["Mokey Mokey King", 1], ["Polymerization", 2], ["Happy Lover", 2], ["Petit Angel", 2]],
  },
  // Definidos para rutas posteriores (todavía no aparecen en la Ruta 1)
  armeddragon: {
    name: "Dragón Armado", card: "Armed Dragon LV3", lp: 2500, color: 0xb5651d,
    deck: [["Armed Dragon LV3", 3], ["Armed Dragon LV5", 2], ["Armed Dragon LV7", 1], ["Petit Dragon", 3], ["Masked Dragon", 2], ["Spear Dragon", 1],
      ["Element Dragon", 1], ["Dragon's Mirror", 1], ["Stamping Destruction", 2], ["Rush Recklessly", 2], ["Trap Hole", 2]],
    drops: [["Armed Dragon LV5", 1], ["Armed Dragon LV7", 1], ["Petit Dragon", 3], ["Masked Dragon", 2], ["Stamping Destruction", 2], ["Element Dragon", 1]],
  },
  silentmagician: {
    name: "Mago Silencioso", card: "Silent Magician LV4", lp: 2500, color: 0xbfd7ff,
    deck: [["Silent Magician LV4", 3], ["Silent Magician LV8", 1], ["Celtic Guardian", 2], ["Gemini Elf", 2], ["Mystical Elf", 2], ["Magical Dimension", 1],
      ["Book of Secret Arts", 2], ["Swords of Revealing Light", 1], ["Waboku", 2], ["Negate Attack", 2], ["Trap Hole", 2]],
    drops: [["Silent Magician LV8", 1], ["Book of Secret Arts", 2], ["Magical Dimension", 1], ["Gemini Elf", 2], ["Negate Attack", 2]],
  },
  ojama: {
    name: "Ojama Amarillo", card: "Ojama Yellow", lp: 2000, color: 0xffe14a,
    deck: [["Ojama Yellow", 3], ["Ojama Green", 2], ["Ojama Black", 2], ["Ojama Delta Hurricane!!", 1], ["Polymerization", 2], ["Scapegoat", 1],
      ["Castle Walls", 2], ["Waboku", 2], ["Fake Trap", 1], ["Nimble Momonga", 2], ["Rush Recklessly", 2]],
    extra: [["Ojama King", 1]],
    drops: [["Ojama Green", 2], ["Ojama Black", 2], ["Ojama King", 1], ["Ojama Delta Hurricane!!", 1], ["Polymerization", 2]],
  },
  babydragon: {
    name: "Bebé Dragón", card: "Baby Dragon", lp: 2000, color: 0x7fbf7f,
    deck: [["Baby Dragon", 3], ["Petit Dragon", 3], ["Masked Dragon", 2], ["Luster Dragon", 2], ["Sonic Duck", 2], ["Time Wizard", 1], ["Polymerization", 1],
      ["Stamping Destruction", 1], ["Rush Recklessly", 2], ["Trap Hole", 2], ["Sakuretsu Armor", 1]],
    extra: [["Thousand Dragon", 1]],
    drops: [["Petit Dragon", 3], ["Luster Dragon", 1], ["Sonic Duck", 2], ["Masked Dragon", 2], ["Stamping Destruction", 1]],
  },
};

// Tablas de aparición por zona de hierba (pesos, como las tablas de encuentros de Pokémon).
export const ENCOUNTERS = {
  route1: { rate: 0.12, table: [{ id: "watapon", w: 30 }, { id: "maneater", w: 25 }, { id: "hanehane", w: 20 }, { id: "penguin", w: 15 }, { id: "mokey", w: 10 }] },
};
