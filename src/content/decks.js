// Decks del juego, escritos por nombre de carta (inglés, como en la base de datos).
// [nombre, copias]. tools/build_data.py valida que todos existan.

export const STARTERS = {
  kuriboh: {
    spirit: "Kuriboh",
    title: "Baraja Muralla Kuriboh",
    style: "Defensa",
    blurb: "Muros, trampas que frenan ataques y Kuriboh que te protege. Aguanta y contraataca. Multiply, Marshmallon y Summoned Skull llegan más adelante.",
    beats: "gigobyte", losesTo: "timewizard",
    main: [
      ["Kuriboh", 3], ["Kuribee", 1], ["Kuriboo", 1], ["Big Shield Gardna", 1], ["Diskblade Rider", 1], ["Giant Soldier of Stone", 2],
      ["Mystical Elf", 1], ["Opticlops", 1], ["Wall of Illusion", 1], ["Morphing Jar", 1], ["Mystic Tomato", 2],
      ["Nimble Momonga", 1], ["Beaver Warrior", 1], ["Mystical Sheep #2", 1], ["Silver Fang", 1], ["Des Koala", 1], ["Celtic Guardian", 1], ["Axe Raider", 1],
      ["Multiply", 1], ["Hammer Shot", 1], ["Shield & Sword", 1], ["Dian Keto the Cure Master", 1], ["Goblin's Secret Remedy", 1],
      ["Red Medicine", 1], ["Monster Reborn", 1], ["Fissure", 1], ["Rush Recklessly", 2], ["Mystical Space Typhoon", 1],
      ["Waboku", 1], ["Negate Attack", 1], ["Castle Walls", 1], ["Trap Hole", 1], ["Fake Trap", 1], ["Reinforcements", 1], ["Dust Tornado", 1],
    ],
    extra: [],
  },
  gigobyte: {
    spirit: "Gigobyte",
    title: "Baraja Marea Gagagigo",
    style: "Agua y sacrificios",
    blurb: "Convertí a Gigobyte en robo de cartas con White Elephant's Gift o en eliminación con Order to Charge. Recuperalo con Salvage y apoyá a la familia Gagagigo. No evoluciona automáticamente: Giga y Gogiga Gagagigo se ganan avanzando.",
    beats: "timewizard", losesTo: "kuriboh",
    main: [
      ["Gigobyte", 3], ["Gagagigo", 2], ["Mother Grizzly", 2], ["7 Colored Fish", 2], ["High Tide Gyojin", 2],
      ["Unshaven Angler", 1], ["Mermaid Knight", 1], ["Cure Mermaid", 1], ["Jellyfish", 1], ["Misairuzame", 1], ["Aqua Madoor", 1],
      ["Star Boy", 1], ["Penguin Knight", 1], ["Tongyo", 1],
      ["Umi", 2], ["Salvage", 1], ["Order to Charge", 1], ["Rush Recklessly", 1], ["Red Medicine", 1],
      ["Ookazi", 1], ["Monster Reborn", 1], ["Spiritual Water Art - Aoi", 1], ["Mystical Space Typhoon", 1],
      ["Tornado Wall", 1], ["Trap Hole", 2], ["Reinforcements", 2], ["Waboku", 1], ["Castle Walls", 1], ["Raigeki Break", 1],
      ["Dust Tornado", 1], ["White Elephant's Gift", 1],
    ],
    extra: [],
  },
  timewizard: {
    spirit: "Time Wizard",
    title: "Baraja Ruleta del Tiempo",
    style: "Azar y ruptura",
    blurb: "Monedas y dados: Time Wizard puede barrer el campo rival y fusionarse en Thousand Dragon. Alto riesgo, alta recompensa. Thousand Dragon y Barrel Dragon se ganan avanzando.",
    beats: "kuriboh", losesTo: "gigobyte",
    main: [
      ["Time Wizard", 3], ["Baby Dragon", 3], ["Alligator's Sword", 1], ["Arcana Force 0 - The Fool", 1],
      ["Arcana Force I - The Magician", 2], ["Arcana Force III - The Empress", 1], ["Arcana Force VI - The Lovers", 1],
      ["Petit Dragon", 1], ["Winged Dragon, Guardian of the Fortress #1", 1], ["Sonic Duck", 1], ["Rocket Warrior", 1],
      ["Celtic Guardian", 1], ["Axe Raider", 1], ["Masked Dragon", 1], ["Kojikocy", 1],
      ["Polymerization", 2], ["Fusion Sage", 1], ["Graceful Dice", 1], ["Second Coin Toss", 1],
      ["Lucky Iron Axe", 1], ["Hinotama", 1], ["Monster Reborn", 1], ["Ookazi", 1], ["Sparks", 1], ["Mystical Space Typhoon", 1],
      ["Fairy Box", 1], ["Skull Dice", 1], ["Roulette Barrel", 1], ["Trap Hole", 2], ["Raigeki Break", 1],
      ["Waboku", 1], ["Reckless Greed", 1], ["Dust Tornado", 1],
    ],
    extra: [["Alligator's Sword Dragon", 1]],
  },
};

export const STARTER_ORDER = ["kuriboh", "gigobyte", "timewizard"];

// Cartas clave que salieron de las iniciales (D-40) y se recuperan avanzando en la historia.
// Etapa 1: el paquete de Don Teo que te da el rival al llegar a Ciudad Verde. Etapa 2: ganarle al líder del gimnasio.
// El rival recibe las mismas cartas de su baraja en las mismas etapas.
export const STARTER_KEYS = {
  kuriboh: [
    { title: "Refuerzos de la muralla", cards: [["Multiply", 1], ["Marshmallon", 1], ["Kuribeh", 1]] },
    { title: "El poder de los Kuriboh", cards: [["Summoned Skull", 1], ["Scapegoat", 1], ["Kuribabylon", 1], ["Kuribah", 1]] },
  ],
  gigobyte: [
    { title: "Primera evolución", cards: [["Giga Gagagigo", 1], ["A Legendary Ocean", 1], ["Hyozanryu", 1]] },
    { title: "Evolución final", cards: [["Gogiga Gagagigo", 1], ["The Legendary Fisherman", 1]] },
  ],
  timewizard: [
    { title: "Magia del tiempo", cards: [["Thousand Dragon", 1], ["Blowback Dragon", 1], ["Light Barrier", 1]] },
    { title: "Fortuna desatada", cards: [["Thousand Dragon", 1], ["Barrel Dragon", 1], ["Arcana Force VII - The Chariot", 1]] },
  ],
};
/** Baraja inicial con las cartas clave de las etapas ya ganadas (para el rival). Cambia filler por clave, siempre 40. */
export function starterAtStage(key, stage) {
  const s = STARTERS[key], main = s.main.map(([n, q]) => [n, q]), extra = s.extra.map(([n, q]) => [n, q]);
  const add = (list, name) => { const e = list.find(([n]) => n === name); if (e) e[1]++; else list.push([name, 1]); };
  const fillers = [...(STARTER_FILLERS[key] || [])];
  for (let i = 0; i < stage; i++) for (const [name] of STARTER_KEYS[key][i].cards) {
    if (EXTRA_KEYS.has(name)) { add(extra, name); continue; }
    const drop = fillers.shift(); const e = main.find(([n]) => n === drop);
    if (e) { e[1]--; } add(main, name);
  }
  return { ...s, main: main.filter(([, q]) => q > 0), extra };
}
const EXTRA_KEYS = new Set(["Thousand Dragon"]);
// Cartas de relleno que el rival saca al sumar sus claves, en orden.
const STARTER_FILLERS = {
  kuriboh: ["Mystical Sheep #2", "Silver Fang", "Goblin's Secret Remedy", "Beaver Warrior", "Axe Raider", "Des Koala", "Celtic Guardian"],
  gigobyte: ["Misairuzame", "Jellyfish", "Penguin Knight", "Aqua Madoor", "Star Boy"],
  timewizard: ["Kojikocy", "Sonic Duck", "Winged Dragon, Guardian of the Fortress #1", "Petit Dragon"],
};

// Duelistas entrenadores (no salvajes). "money": premio al ganar, como en Pokémon.
// Del más fácil al más difícil, en el orden en que aparecen (ver content/progression.js).
export const TRAINER_DECKS = {
  route1_bug: {
    main: [
      ["Basic Insect", 3], ["Leghul", 3], ["Cockroach Knight", 3], ["Man-Eater Bug", 1], ["Killer Needle", 2], ["Pinch Hopper", 1],
      ["Flying Kamakiri #1", 2], ["Hercules Beetle", 1], ["Giant Flea", 3], ["Kiseitai", 1], ["Insect Soldiers of the Sky", 2],
      ["Neko Mane King", 1],
      ["Insect Barrier", 1], ["Hinotama", 2], ["Sparks", 2], ["Red Medicine", 1], ["Rush Recklessly", 2], ["Castle Walls", 1],
      ["Fake Trap", 1], ["Waboku", 2], ["Trap Hole", 1], ["Goblin's Secret Remedy", 1], ["Dark Bat", 2], ["Ookazi", 1],
    ],
    extra: [],
  },
  // Ruta 1, tercer duelista: guerreros con espadas. Un poco más de ataque que los insectos.
  route1_sword: {
    main: [
      ["Kojikocy", 2], ["Dark Blade", 1], ["Warrior Dai Grepher", 1], ["Little-Winguard", 2], ["Masaki the Legendary Swordsman", 2],
      ["Battle Warrior", 2], ["The Little Swordsman of Aile", 2], ["Swordsman of Landstar", 2], ["Hayabusa Knight", 1], ["Armed Ninja", 1],
      ["Beaver Warrior", 2], ["Sword Hunter", 1], ["Celtic Guardian", 1],
      ["Legendary Sword", 2], ["Rush Recklessly", 2], ["Mystical Space Typhoon", 1], ["Red Medicine", 1], ["Sparks", 2], ["Shield & Sword", 1], ["Sword of Deep-Seated", 1], ["Goblin's Secret Remedy", 1], ["Hinotama", 1],
      ["Trap Hole", 2], ["Waboku", 1], ["Backup Soldier", 1], ["Reinforcements", 2], ["Castle Walls", 1], ["Fake Trap", 1],
    ],
    extra: [],
  },
  // Ruta 1, segundo duelista: rocas que aguantan y Gaia Power.
  route1_rock: {
    main: [
      ["Giant Soldier of Stone", 3], ["Stone Statue of the Aztecs", 2], ["Grand Tiki Elder", 2], ["Sand Stone", 2], ["Stone Ogre Grotto", 2],
      ["Dissolverock", 2], ["Rock Ogre Grotto #1", 2], ["Stone Armadiller", 1], ["Millennium Golem", 1], ["Giant Turtle Who Feeds on Flames", 1],
      ["Gaia Power", 2], ["Stop Defense", 1], ["Shield & Sword", 1], ["Fissure", 1], ["Mystical Space Typhoon", 1], ["Hammer Shot", 1], ["Dian Keto the Cure Master", 1], ["Red Medicine", 1], ["Ookazi", 1],
      ["Rock Bombardment", 2], ["Block Attack", 1], ["Fake Trap", 1], ["Earthshaker", 1], ["Trap Hole", 2], ["Castle Walls", 2], ["Waboku", 1], ["Negate Attack", 1], ["Reinforcements", 1],
    ],
    extra: [],
  },
  // Ruta 1, cuarto duelista: zombis que vuelven del Cementerio.
  route1_zombie: {
    main: [
      ["Pyramid Turtle", 2], ["Wandering Mummy", 2], ["Armored Zombie", 2], ["Dragon Zombie", 2], ["Clown Zombie", 2], ["Skull Servant", 3],
      ["The 13th Grave", 2], ["Vampire Baby", 1], ["Mask of Darkness", 1], ["Castle of Dark Illusions", 1], ["Pumpking the King of Ghosts", 1], ["Dark Gray", 1],
      ["Book of Life", 1], ["Call of the Mummy", 1], ["Mystic Plasma Zone", 1], ["Mystical Space Typhoon", 1], ["Monster Reborn", 1], ["Rush Recklessly", 2], ["Hinotama", 1], ["Ookazi", 1], ["Red Medicine", 1],
      ["Trap Hole", 2], ["Castle Walls", 1], ["Fake Trap", 1], ["Michizure", 1], ["Waboku", 1], ["Reinforcements", 2], ["Graverobber's Retribution", 1], ["Dust Tornado", 1],
    ],
    extra: [],
  },
};
