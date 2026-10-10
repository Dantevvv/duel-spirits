// Duelistas de la serie, en el orden del recorrido. Cada uno tiene una versión temprana y una fuerte.
// Fuentes: decks de los videojuegos de la época según Yugipedia
//   (Duel Monsters: Nightmare Troubadour · GX: Tag Force, con su escala de estrellas ★).
// Los decks "propios" (Yugi y Kaiba de la Liga) son armados para este juego.
// [nombre de carta en inglés, copias]. tools/validate_rivals.mjs revisa tamaño, nombres y pool.

export const RIVALS = {
  // ---------------- Ciudad 1 ----------------
  weevil: {
    name: "Weevil Underwood", role: "Líder · Ciudad 1", theme: "Insectos", source: "Nightmare Troubadour",
    early: { label: "Insect Deck (inicio)", main: [
      ["Basic Insect", 1], ["Big Insect", 1], ["Giant Flea", 2], ["Gokibore", 1], ["Petit Moth", 3],
      ["Cocoon of Evolution", 3], ["Drill Bug", 1], ["Great Moth", 1], ["Insect Queen", 2], ["Man-Eater Bug", 1], ["Parasite Paracide", 1],
      ["Perfectly Ultimate Great Moth", 1], ["Pinch Hopper", 1], ["Sangan", 1], ["Skull-Mark Ladybug", 2], ["Swarm of Locusts", 1], ["Swarm of Scarabs", 1],
      ["Forest", 1], ["Insect Armor with Laser Cannon", 1], ["Insect Barrier", 1], ["Laser Cannon Armor", 1], ["Multiplication of Ants", 2],
      ["Mystical Space Typhoon", 1], ["Pot of Greed", 1], ["Tribute Doll", 2],
      ["Call of the Haunted", 1], ["DNA Surgery", 1], ["Kozaky's Self-Destruct Button", 1], ["Michizure", 1], ["Pineapple Blast", 1], ["Trap Hole", 1]] },
    strong: { label: "Bug Queen", main: [
      ["A Cat of Ill Omen", 1], ["Cocoon of Evolution", 2], ["Giant Rat", 1], ["Insect Queen", 3], ["Jirai Gumo", 2], ["Magician of Faith", 1],
      ["Man-Eater Bug", 2], ["Parasite Paracide", 2], ["Pinch Hopper", 3], ["Sangan", 1], ["Swarm of Locusts", 1], ["Swarm of Scarabs", 1],
      ["Forest", 1], ["Graceful Charity", 1], ["Insect Barrier", 3], ["Jade Insect Whistle", 1], ["Mage Power", 1], ["Mystical Space Typhoon", 1],
      ["Pot of Greed", 1], ["Premature Burial", 1], ["Scapegoat", 2], ["Tribute Doll", 1], ["United We Stand", 1],
      ["Call of the Haunted", 1], ["DNA Surgery", 3], ["Dust Tornado", 1], ["Sixth Sense", 1]] },
  },
  chumley: {
    name: "Chumley Huffington", role: "Duelista · Ruta a Ciudad 1", theme: "Koalas y canguros", source: "Tag Force",
    early: { label: "Wrath of Nature ★3", main: [
      ["Big Koala", 3], ["Frenzied Panda", 3], ["Bubonic Vermin", 3], ["Des Kangaroo", 3], ["Des Koala", 3], ["Kangaroo Champ", 2], ["Maji-Gire Panda", 3],
      ["Second Goblin", 1], ["De-Fusion", 1], ["Dian Keto the Cure Master", 1], ["Forest", 2], ["Mystical Space Typhoon", 1], ["Polymerization", 3],
      ["Pot of Greed", 1], ["Premature Burial", 1], ["Silent Doom", 2], ["Stray Lambs", 2], ["Call of the Haunted", 1], ["Castle Walls", 2],
      ["Destruction Punch", 2], ["Michizure", 2]], extra: [["Master of Oz", 3]] },
    strong: { label: "Animal Mayhem ★4", main: [
      ["Big Koala", 3], ["Bubonic Vermin", 3], ["Des Kangaroo", 3], ["Des Koala", 3], ["Kangaroo Champ", 2], ["Maji-Gire Panda", 3], ["Nimble Momonga", 3],
      ["De-Fusion", 1], ["Dian Keto the Cure Master", 1], ["Forest", 2], ["Last Will", 1], ["Mystical Space Typhoon", 1], ["Polymerization", 3],
      ["Pot of Greed", 1], ["Premature Burial", 1], ["Scapegoat", 1], ["Silent Doom", 2], ["United We Stand", 1], ["Call of the Haunted", 1],
      ["Castle Walls", 2], ["Destruction Punch", 2], ["Michizure", 2]], extra: [["Master of Oz", 3]] },
  },
  // ---------------- Ciudad 2 ----------------
  rex: {
    name: "Rex Raptor", role: "Líder · Ciudad 2", theme: "Dinosaurios", source: "Nightmare Troubadour",
    early: { label: "Dino Destruction", main: [
      ["Crawling Dragon #2", 3], ["Megazowler", 2], ["Red-Eyes Black Dragon", 1], ["Sword Arm of Dragon", 2], ["Two-Headed King Rex", 3], ["Tyhone", 3], ["Uraby", 3],
      ["Giant Rat", 2], ["Gilasaurus", 2], ["Mad Sword Beast", 2], ["Polymerization", 2], ["Pot of Greed", 1], ["Raise Body Heat", 3], ["Red Medicine", 2],
      ["Stim-Pack", 1], ["Wasteland", 2], ["Eatgaboon", 2], ["House of Adhesive Tape", 2], ["Jar of Greed", 1], ["Negate Attack", 1]],
      extra: [["Bracchio-raidus", 3]] },
    strong: { label: "Raptor Rampage", main: [
      ["Crawling Dragon #2", 3], ["Megazowler", 2], ["Red-Eyes Black Dragon", 1], ["Sword Arm of Dragon", 2], ["Two-Headed King Rex", 3], ["Tyhone", 1], ["Uraby", 3],
      ["Giant Rat", 3], ["Gilasaurus", 3], ["Mad Sword Beast", 2], ["Mystical Space Typhoon", 1], ["Ookazi", 2], ["Polymerization", 2], ["Pot of Greed", 1],
      ["Raise Body Heat", 3], ["Wasteland", 2], ["Adhesion Trap Hole", 2], ["Jar of Greed", 1], ["Negate Attack", 1], ["Trap Hole", 2]],
      extra: [["Bracchio-raidus", 3]] },
  },
  // ---------------- Ciudad 3 ----------------
  mako: {
    name: "Mako Tsunami", role: "Líder · Ciudad 3", theme: "Agua y peces", source: "Nightmare Troubadour",
    early: { label: "Big Catch", main: [
      ["Amphibian Beast", 3], ["Fiend Kraken", 3], ["Great White", 3], ["Jellyfish", 3], ["Kairyu-Shin", 1], ["Abyss Soldier", 1],
      ["Manju of the Ten Thousand Hands", 2], ["Mother Grizzly", 2], ["Sangan", 1], ["Sinister Serpent", 1], ["The Legendary Fisherman", 2], ["Fortress Whale", 1],
      ["Fortress Whale's Oath", 1], ["Graceful Charity", 1], ["Mystical Space Typhoon", 1], ["Pot of Greed", 1], ["Return of the Doomed", 1], ["Salvage", 2],
      ["Steel Shell", 2], ["Umi", 3], ["Call of the Haunted", 1], ["Raigeki Break", 1], ["Respect Play", 2], ["Tornado Wall", 1], ["Torrential Tribute", 1]] },
    strong: { label: "Legendary Ocean", main: [
      ["Amphibian Beast", 1], ["Giant Red Seasnake", 2], ["Abyss Soldier", 2], ["Catapult Turtle", 2], ["Maiden of the Aqua", 1], ["Mother Grizzly", 3],
      ["Penguin Soldier", 2], ["Revival Jam", 2], ["Sangan", 1], ["Sinister Serpent", 1], ["Star Boy", 1], ["The Legendary Fisherman", 2], ["Tribe-Infecting Virus", 1],
      ["A Legendary Ocean", 3], ["Spatial Collapse", 1], ["Graceful Charity", 1], ["Lightning Vortex", 1], ["Mystical Space Typhoon", 1], ["Pot of Greed", 1], ["Salvage", 1],
      ["Snatch Steal", 1], ["Terraforming", 1], ["United We Stand", 1], ["Call of the Haunted", 1], ["Divine Wrath", 1], ["Dust Tornado", 1], ["Raigeki Break", 1],
      ["Tornado Wall", 2], ["Torrential Tribute", 1]] },
  },
  // ---------------- Ciudad 4 ----------------
  mai: {
    name: "Mai Valentine", role: "Líder · Ciudad 4", theme: "Harpías", source: "Nightmare Troubadour",
    early: { label: "Lady Sanctuary", main: [
      ["Gemini Elf", 3], ["Amazoness Archer", 2], ["Birdface", 2], ["D.D. Assailant", 2], ["D.D. Warrior Lady", 1], ["Flying Kamakiri #1", 2],
      ["Harpie Lady 1", 1], ["Harpie Lady 2", 1], ["Harpie Lady 3", 1], ["Harpie Lady Sisters", 2], ["Harpie's Pet Dragon", 1], ["Magician of Faith", 2],
      ["Cyber Shield", 2], ["Elegant Egotist", 3], ["Harpies' Hunting Ground", 2], ["Malevolent Nuzzler", 1], ["Mystical Space Typhoon", 1], ["Pot of Greed", 1],
      ["Reload", 1], ["Triangle Ecstasy Spark", 3], ["Call of the Haunted", 1], ["Mirror Wall", 2], ["Shadow of Eyes", 2], ["Solomon's Lawbook", 2]] },
    strong: { label: "Shining Lady", main: [
      ["Gemini Elf", 3], ["Birdface", 2], ["Cyber Harpie Lady", 1], ["D.D. Assailant", 3], ["D.D. Warrior Lady", 1], ["Flying Kamakiri #1", 2],
      ["Harpie Lady 2", 1], ["Harpie Lady 3", 1], ["Harpie Lady Sisters", 2], ["Injection Fairy Lily", 1], ["Magician of Faith", 2], ["Elegant Egotist", 3],
      ["Graceful Charity", 1], ["Harpie's Feather Duster", 1], ["Harpies' Hunting Ground", 2], ["Mage Power", 1], ["Mystical Space Typhoon", 1], ["Pot of Greed", 1],
      ["Reload", 1], ["Snatch Steal", 1], ["Triangle Ecstasy Spark", 3], ["United We Stand", 1], ["Call of the Haunted", 1], ["Fairy Box", 1], ["Mirror Wall", 2],
      ["Solomon's Lawbook", 1]] },
  },
  // ---------------- Ciudad 5 ----------------
  keith: {
    name: "Bandit Keith", role: "Líder · Ciudad 5", theme: "Máquinas", source: "Nightmare Troubadour",
    early: { label: "Machine Mayhem", main: [
      ["Gradius", 3], ["Launcher Spider", 1], ["Mechanicalchaser", 3], ["Machine King", 1], ["Robotic Knight", 3], ["Slot Machine", 1], ["Zoa", 1],
      ["Barrel Dragon", 2], ["Blast Sphere", 3], ["Metalzoa", 1], ["Sangan", 1], ["7 Completed", 2], ["Cyclon Laser", 1], ["Dark Factory of Mass Production", 1],
      ["Fissure", 1], ["Germ Infection", 1], ["Graceful Charity", 1], ["Limiter Removal", 1], ["Machine Conversion Factory", 2], ["Pot of Greed", 1],
      ["Scapegoat", 2], ["Stop Defense", 1], ["Tribute Doll", 2], ["Metalmorph", 2], ["Time Machine", 2]] },
    strong: { label: "Machine Mayhem (tras la Copa Experta)", main: [
      ["Gradius", 2], ["Launcher Spider", 1], ["Mechanicalchaser", 3], ["Machine King", 1], ["Robotic Knight", 2], ["Slot Machine", 1], ["Zoa", 1],
      ["Barrel Dragon", 2], ["Blast Sphere", 3], ["Gear Golem the Moving Fortress", 2], ["Metalzoa", 1], ["Sangan", 1], ["7 Completed", 2],
      ["Dark Factory of Mass Production", 1], ["Fissure", 1], ["Graceful Charity", 1], ["Limiter Removal", 2], ["Machine Conversion Factory", 2],
      ["Pot of Greed", 1], ["Scapegoat", 2], ["Stop Defense", 1], ["Tribute Doll", 2], ["Metalmorph", 3], ["Time Machine", 2]] },
  },
  // ---------------- Ciudad 6 ----------------
  chazz: {
    name: "Chazz Princeton", role: "Líder · Ciudad 6", theme: "Ojamas y Dragón Armado", source: "Tag Force",
    early: { label: "The Weak and Strong ★6", main: [
      ["Ojama Black", 2], ["Ojama Green", 2], ["Ojama Yellow", 2], ["Armed Dragon LV3", 3], ["Armed Dragon LV5", 3], ["Armed Dragon LV7", 2], ["Cyber Jar", 1],
      ["Flying Kamakiri #1", 3], ["Masked Dragon", 3], ["Creature Swap", 1], ["Dark Hole", 1], ["Heavy Storm", 1], ["Level Modulation", 1], ["Level Up!", 1],
      ["Lightning Vortex", 1], ["Mystical Space Typhoon", 1], ["Ojamagic", 2], ["Ojamuscle", 1], ["Polymerization", 1], ["Pot of Avarice", 1], ["Pot of Greed", 1],
      ["Premature Burial", 1], ["Snatch Steal", 1], ["Stamping Destruction", 1], ["Swords of Revealing Light", 1], ["Call of the Haunted", 1], ["Magic Jammer", 2],
      ["Ojama Trio", 1], ["Raigeki Break", 1]], extra: [["Ojama King", 3]] },
    strong: { label: "Resurrected Dragon ★7", main: [
      ["Luster Dragon", 3], ["Armed Dragon LV10", 2], ["Armed Dragon LV3", 3], ["Armed Dragon LV5", 3], ["Armed Dragon LV7", 2], ["Flying Kamakiri #1", 3],
      ["Masked Dragon", 3], ["Creature Swap", 2], ["Dark Hole", 1], ["Heavy Storm", 1], ["Level Up!", 1], ["Lightning Vortex", 1], ["Megamorph", 1],
      ["Mystical Space Typhoon", 1], ["Pot of Avarice", 1], ["Pot of Greed", 1], ["Premature Burial", 1], ["Snatch Steal", 1], ["Stamping Destruction", 3],
      ["Swords of Revealing Light", 1], ["Call of the Haunted", 1], ["Light of Intervention", 2], ["Raigeki Break", 2]] },
  },
  // ---------------- Ciudad 7 ----------------
  joey: {
    name: "Joey Wheeler", role: "Líder · Ciudad 7", theme: "Red-Eyes y azar", source: "Nightmare Troubadour",
    early: { label: "Dice Power", main: [
      ["Alligator's Sword", 2], ["Axe Raider", 2], ["Baby Dragon", 3], ["Battle Warrior", 2], ["Garoozis", 1], ["Red-Eyes Black Dragon", 1], ["Tiger Axe", 2],
      ["Gilford the Lightning", 1], ["Little-Winguard", 1], ["Panther Warrior", 1], ["Red-Eyes Black Metal Dragon", 1], ["Rocket Warrior", 1], ["Time Wizard", 3],
      ["Versago the Destroyer", 1], ["Dangerous Machine Type-6", 2], ["Emergency Provisions", 1], ["Graceful Dice", 2], ["Polymerization", 2], ["Pot of Greed", 1],
      ["Blind Destruction", 1], ["Graverobber", 1], ["Kunai with Chain", 1], ["Magical Arm Shield", 1], ["Metalmorph", 2], ["Needle Wall", 2], ["Skull Dice", 2]],
      extra: [["Alligator's Sword Dragon", 3], ["Black Skull Dragon", 3], ["Thousand Dragon", 3]] },
    strong: { label: "Warrior Max", main: [
      ["Alligator's Sword", 1], ["Axe Raider", 1], ["Baby Dragon", 1], ["Red-Eyes Black Dragon", 1], ["D.D. Assailant", 2], ["D.D. Warrior Lady", 1],
      ["Gearfried the Iron Knight", 1], ["Gilford the Lightning", 1], ["Goblin Attack Force", 1], ["Jinzo", 1], ["Marauding Captain", 2], ["Panther Warrior", 1],
      ["Rocket Warrior", 2], ["Sasuke Samurai #4", 1], ["Time Wizard", 1], ["Versago the Destroyer", 1], ["Zombyra the Dark", 2], ["Cost Down", 1],
      ["Dangerous Machine Type-6", 1], ["Fusion Gate", 1], ["Graceful Charity", 1], ["Graceful Dice", 2], ["Pot of Greed", 1], ["Reinforcement of the Army", 2],
      ["Scapegoat", 2], ["The A. Forces", 1], ["Call of the Haunted", 1], ["Fairy Box", 1], ["Graverobber", 1], ["Magical Arm Shield", 1], ["Metalmorph", 1],
      ["Sixth Sense", 1], ["Skull Dice", 1]], extra: [["Alligator's Sword Dragon", 3], ["Black Skull Dragon", 3], ["Thousand Dragon", 3]] },
  },
  // ---------------- Ciudad 8 ----------------
  zane: {
    name: "Zane Truesdale", role: "Líder · Ciudad 8", theme: "Cyber Dragon", source: "Tag Force",
    early: { label: "Ultimate Mecha-Dragon ★6", main: [
      ["Blowback Dragon", 2], ["Cyber Dragon", 3], ["Cyber Jar", 1], ["Cyber Raider", 2], ["Drillago", 2], ["Jinzo", 1], ["Nanobreaker", 2], ["Reflect Bounder", 1],
      ["The Light - Hex-Sealed Fusion", 2], ["Heavy Mech Support Platform", 2], ["Dark Hole", 1], ["De-Fusion", 1], ["Different Dimension Capsule", 2], ["Heavy Storm", 1],
      ["Limiter Removal", 1], ["Mystical Space Typhoon", 1], ["Nobleman of Crossout", 2], ["Polymerization", 2], ["Pot of Greed", 1], ["Power Bond", 1],
      ["Premature Burial", 1], ["Snatch Steal", 1], ["Swords of Revealing Light", 1], ["Call of the Haunted", 1], ["Dust Tornado", 2], ["Magic Cylinder", 1],
      ["Magic Jammer", 2], ["Raigeki Break", 2]], extra: [["Cyber End Dragon", 3], ["Cyber Twin Dragon", 3], ["Gatling Dragon", 1]] },
    strong: { label: "New Mecha-Dragon ★8", main: [
      ["Blowback Dragon", 2], ["Cyber Dragon", 3], ["Cyber Jar", 1], ["Cyber Phoenix", 1], ["Cyber-Stein", 1], ["Jinzo", 1], ["Magician of Faith", 1],
      ["Proto-Cyber Dragon", 3], ["Reflect Bounder", 1], ["The Light - Hex-Sealed Fusion", 2], ["Dark Hole", 1], ["De-Fusion", 1], ["Future Fusion", 2],
      ["Heavy Storm", 1], ["Lightning Vortex", 1], ["Limiter Removal", 1], ["Metamorphosis", 1], ["Mystical Space Typhoon", 1], ["Nobleman of Crossout", 2],
      ["Polymerization", 1], ["Pot of Greed", 1], ["Power Bond", 2], ["Premature Burial", 1], ["Swords of Revealing Light", 1], ["Call of the Haunted", 1],
      ["Metal Reflect Slime", 3], ["Raigeki Break", 1], ["Solemn Judgment", 2]], extra: [["Cyber End Dragon", 3], ["Cyber Twin Dragon", 3], ["Gatling Dragon", 1]] },
  },
  // ---------------- Liga ----------------
  bakura: {
    name: "Yami Bakura", role: "Liga", theme: "Ocultismo y Necrofear", source: "Nightmare Troubadour",
    early: { label: "Horror Countdown", main: [
      ["A Cat of Ill Omen", 2], ["Breaker the Magical Warrior", 1], ["D.D. Assailant", 3], ["D.D. Warrior Lady", 1], ["Giant Germ", 3], ["Kryuel", 1],
      ["Kycoo the Ghost Destroyer", 3], ["Mystic Tomato", 1], ["Night Assailant", 2], ["Sangan", 1], ["Spell Canceller", 2], ["Wall of Illusion", 3],
      ["Headless Knight", 1], ["Graceful Charity", 1], ["Pot of Greed", 1], ["Reload", 2], ["Scapegoat", 1], ["Spirit Message \"A\"", 1], ["Spirit Message \"I\"", 1],
      ["Spirit Message \"L\"", 1], ["Spirit Message \"N\"", 1], ["Swords of Revealing Light", 1], ["Call of the Haunted", 1], ["Destiny Board", 2],
      ["Mirror Force", 1], ["Ring of Destruction", 1], ["Waboku", 1]] },
    strong: { label: "Underworld Ruler", main: [
      ["Headless Knight", 1], ["The Earl of Demise", 1], ["The Portrait's Secret", 1], ["Dark Necrofear", 3], ["Giant Germ", 3], ["Kryuel", 2], ["Mask of Darkness", 1],
      ["Night Assailant", 2], ["Sangan", 1], ["Slate Warrior", 3], ["Wall of Illusion", 3], ["Delinquent Duo", 1], ["Dimension Fusion", 2], ["Eternal Rest", 2],
      ["Graceful Charity", 1], ["Monster Reborn", 1], ["Mystical Space Typhoon", 1], ["Pot of Greed", 1], ["The Shallow Grave", 1], ["Bark of Dark Ruler", 2],
      ["Call of the Haunted", 1], ["Magic Jammer", 1], ["Mirror Force", 1], ["Return from the Different Dimension", 1], ["Seven Tools of the Bandit", 1],
      ["Solemn Wishes", 2]] },
  },
  marik: {
    name: "Yami Marik", role: "Liga", theme: "Dragón Alado de Ra", source: "Nightmare Troubadour",
    strong: { label: "God Phoenix", main: [
      ["Gil Garth", 1], ["Dark Jeroid", 1], ["Gilasaurus", 2], ["Goblin Attack Force", 1], ["Granadora", 1], ["Helpoemer", 1], ["Lava Golem", 1], ["Mystic Tomato", 1],
      ["Newdoria", 1], ["Revival Jam", 1], ["Sangan", 1], ["Slate Warrior", 3], ["Spirit Reaper", 2], ["The Winged Dragon of Ra", 1], ["Twin-Headed Behemoth", 1],
      ["Vampire Lord", 1], ["Viser Des", 1], ["Brain Control", 1], ["Delinquent Duo", 1], ["Graceful Charity", 1], ["Mystical Space Typhoon", 1], ["Pot of Greed", 1],
      ["Premature Burial", 1], ["Snatch Steal", 1], ["Soul Exchange", 1], ["United We Stand", 1], ["Call of the Haunted", 1], ["Dust Tornado", 1],
      ["Metal Reflect Slime", 1], ["Mirror Force", 1], ["Nightmare Wheel", 2], ["Ring of Destruction", 1], ["Sakuretsu Armor", 1], ["Solemn Wishes", 1],
      ["Ultimate Offering", 1]] },
  },
  yugi: {
    name: "Yami Yugi", role: "Semifinal", theme: "Mago Oscuro y los tres Dioses Egipcios", source: "Armado para este juego",
    strong: { label: "Los Tres Dioses", main: [
      ["Dark Magician", 2], ["Dark Magician Girl", 2], ["Slifer the Sky Dragon", 1], ["Obelisk the Tormentor", 1], ["The Winged Dragon of Ra", 1],
      ["Kuriboh", 1], ["Big Shield Gardna", 1], ["Magician of Faith", 1], ["Skilled Dark Magician", 2], ["Breaker the Magical Warrior", 1], ["Buster Blader", 1],
      ["Marshmallon", 1], ["Sangan", 1], ["Gilasaurus", 2],
      ["Scapegoat", 1], ["Multiply", 1], ["Dark Magic Curtain", 1], ["Soul Exchange", 2], ["Monster Reborn", 1], ["Swords of Revealing Light", 1],
      ["Graceful Charity", 1], ["Pot of Greed", 1], ["Thousand Knives", 1], ["Dark Magical Circle", 1], ["Polymerization", 1],
      ["Magic Cylinder", 1], ["Mirror Force", 1], ["Call of the Haunted", 1], ["Magical Hats", 1], ["Eternal Soul", 1], ["Magician Navigation", 1], ["Dark Magic Attack", 1], ["Mystic Box", 1], ["Card of Sanctity", 1], ["Spellbinding Circle", 1]],
      extra: [["Dark Paladin", 2]] },
  },
  kaiba: {
    name: "Seto Kaiba", role: "Final", theme: "Dragón Blanco de Ojos Azules y Obelisk", source: "Nightmare Troubadour + soporte moderno",
    strong: { label: "Blue-Eyes Burst", main: [
      ["Blue-Eyes White Dragon", 3], ["Obelisk the Tormentor", 1], ["La Jinn the Mystical Genie of the Lamp", 2], ["Vorse Raider", 3], ["Kaibaman", 1],
      ["Blue-Eyes Alternative White Dragon", 1], ["D.D. Warrior Lady", 1], ["Gilasaurus", 2], ["Sangan", 1], ["Spirit Reaper", 2], ["Versago the Destroyer", 1],
      ["Cost Down", 1], ["Trade-In", 2], ["Return of the Dragon Lords", 1], ["Soul Exchange", 1], ["Polymerization", 1], ["Graceful Charity", 1],
      ["Mystical Space Typhoon", 1], ["Pot of Greed", 1], ["Premature Burial", 1], ["Raigeki", 1], ["Snatch Steal", 1], ["Burst Stream of Destruction", 1],
      ["Call of the Haunted", 1], ["Crush Card Virus", 1], ["Mirror Force", 1], ["Ring of Destruction", 1], ["Trap Jammer", 1], ["Enemy Controller", 1], ["Lord of D.", 1], ["The Flute of Summoning Dragon", 1], ["Battle Ox", 1]],
      extra: [["Blue-Eyes Ultimate Dragon", 3]] },
  },
};

// Orden del recorrido (líderes) y Liga
export const ROUTE_ORDER = ["chumley", "weevil", "rex", "mako", "mai", "keith", "chazz", "joey", "zane"];
export const LEAGUE_ORDER = ["bakura", "marik", "yugi", "kaiba"];
