// Decks del juego, escritos por nombre de carta (inglés, como en la base de datos).
// [nombre, copias]. tools/build_data.py valida que todos existan.

export const STARTERS = {
  kuriboh: {
    spirit: "Kuriboh",
    title: "Baraja Muralla Kuriboh",
    style: "Defensa",
    blurb: "Muros, trampas que frenan ataques y Kuriboh que te protege. Aguanta y contraataca.",
    beats: "gigobyte", losesTo: "timewizard",
    main: [
      ["Kuriboh", 3], ["Kuribee", 1], ["Kuriboo", 1], ["Big Shield Gardna", 1], ["Diskblade Rider", 1], ["Giant Soldier of Stone", 2],
      ["Mystical Elf", 1], ["Opticlops", 1], ["Wall of Illusion", 1], ["Morphing Jar", 1], ["Mystic Tomato", 2],
      ["Nimble Momonga", 1], ["Marshmallon", 1], ["Summoned Skull", 1], ["Kuribabylon", 1], ["Des Koala", 1], ["Celtic Guardian", 1], ["Axe Raider", 1],
      ["Multiply", 2], ["Hammer Shot", 1], ["Scapegoat", 1], ["Shield & Sword", 1], ["Dian Keto the Cure Master", 1],
      ["Red Medicine", 1], ["Monster Reborn", 1], ["Fissure", 1], ["Rush Recklessly", 2],
      ["Waboku", 1], ["Negate Attack", 1], ["Castle Walls", 1], ["Trap Hole", 1], ["Fake Trap", 1], ["Reinforcements", 1], ["Sakuretsu Armor", 1],
    ],
    extra: [],
  },
  gigobyte: {
    spirit: "Gigobyte",
    title: "Baraja Marea Gagagigo",
    style: "Agua y sacrificios",
    blurb: "Convertí a Gigobyte en robo de cartas con White Elephant's Gift o en eliminación con Order to Charge. Recuperalo con Salvage y apoyá a la familia Gagagigo. No evoluciona automáticamente.",
    beats: "timewizard", losesTo: "kuriboh",
    main: [
      ["Gigobyte", 3], ["Gagagigo", 2], ["Giga Gagagigo", 1], ["Gogiga Gagagigo", 1], ["Mother Grizzly", 2], ["7 Colored Fish", 1], ["High Tide Gyojin", 2],
      ["Unshaven Angler", 1], ["Mermaid Knight", 1], ["Cure Mermaid", 1], ["The Legendary Fisherman", 1], ["Aqua Madoor", 1],
      ["Star Boy", 1], ["Penguin Knight", 1], ["Hyozanryu", 1],
      ["Umi", 2], ["A Legendary Ocean", 1], ["Salvage", 1], ["Order to Charge", 1], ["Rush Recklessly", 1], ["Red Medicine", 1],
      ["Ookazi", 1], ["Monster Reborn", 1], ["Spiritual Water Art - Aoi", 1],
      ["Tornado Wall", 1], ["Trap Hole", 2], ["Reinforcements", 2], ["Waboku", 1], ["Castle Walls", 1], ["Raigeki Break", 1],
      ["Sakuretsu Armor", 1], ["White Elephant's Gift", 1],
    ],
    extra: [],
  },
  timewizard: {
    spirit: "Time Wizard",
    title: "Baraja Ruleta del Tiempo",
    style: "Azar y ruptura",
    blurb: "Monedas y dados: Time Wizard puede barrer el campo rival y fusionarse en Thousand Dragon. Alto riesgo, alta recompensa.",
    beats: "kuriboh", losesTo: "gigobyte",
    main: [
      ["Time Wizard", 3], ["Baby Dragon", 3], ["Alligator's Sword", 1], ["Arcana Force 0 - The Fool", 1],
      ["Arcana Force I - The Magician", 2], ["Arcana Force III - The Empress", 1], ["Arcana Force VI - The Lovers", 1],
      ["Arcana Force VII - The Chariot", 1], ["Barrel Dragon", 1], ["Blowback Dragon", 1], ["Rocket Warrior", 1],
      ["Celtic Guardian", 1], ["Axe Raider", 1], ["Masked Dragon", 1],
      ["Polymerization", 2], ["Fusion Sage", 1], ["Graceful Dice", 1], ["Light Barrier", 1], ["Second Coin Toss", 1],
      ["Lucky Iron Axe", 1], ["Hinotama", 1], ["Monster Reborn", 1], ["Ookazi", 1], ["Sparks", 1],
      ["Fairy Box", 1], ["Skull Dice", 1], ["Roulette Barrel", 1], ["Sakuretsu Armor", 2], ["Trap Hole", 2], ["Raigeki Break", 1],
      ["Waboku", 1], ["Reckless Greed", 1],
    ],
    extra: [["Thousand Dragon", 2], ["Alligator's Sword Dragon", 1]],
  },
};

export const STARTER_ORDER = ["kuriboh", "gigobyte", "timewizard"];

// Duelistas entrenadores (no salvajes). "money": premio al ganar, como en Pokémon.
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
};
