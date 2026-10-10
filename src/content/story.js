// Scripts de historia. Cada script es una función async que recibe "g" (la API del juego).
// Para seguir la historia, agregá funciones acá y referencialas desde maps.js (npcs, objetos, disparadores).
import { STARTERS, STARTER_ORDER, TRAINER_DECKS } from "./decks.js";
import { SPIRITS } from "./spirits.js";
import { RIVALS } from "./rivals.js";
import { ROUTE_LEADERS } from "./packs.js";

const TEO = "Don Teo";

export const SCRIPTS = {
  // ---------------- Introducción ----------------
  async intro(g) {
    await g.blackScreen(true);
    await g.say("¡Atención, duelistas de todo el país!", "???");
    await g.say("Les habla Seto Kaiba, presidente de KaibaCorp.\n\nHoy anuncio oficialmente el torneo CIUDAD BATALLA.", "Kaiba");
    await g.say("Ocho Tarjetas Localizadoras están en manos de los duelistas más fuertes de cada ciudad.\n\nQuien consiga las ocho podrá entrar a las finales en Ciudad Kaiba. Y el campeón... tendrá el honor de enfrentarse a mí.", "Kaiba");
    await g.say("Aunque dudo que alguno esté a la altura.", "Kaiba");
    await g.say("...");
    const name = await g.input("¿Cómo te llamás?", "Ren", 10);
    g.state.player = name;
    await g.say(`Así que te llamás ${name}.`);
    await g.say("Este es tu vecino. Se conocen desde la cuna y siempre compiten en todo.");
    const rival = await g.input("¿Cómo se llamaba tu rival?", "Leo", 10);
    g.state.rival = rival;
    await g.say(`¡Eso! Se llamaba ${rival}.`);
    await g.say("{PLAYER}: tu leyenda como duelista está a punto de comenzar.\n\n¡Un mundo de cartas, espíritus y desafíos te espera!");
    await g.blackScreen(false);
  },

  // ---------------- Casa ----------------
  async tv_bedroom(g) { await g.say("En la tele repiten el anuncio de Kaiba.\n\n\"...el torneo Ciudad Batalla empieza HOY.\""); },
  async tv_living(g) { await g.say("Un programa de duelos: \"¡Hoy, cómo armar tu primera baraja!\""); },
  async pc(g) {
    await g.say("{PLAYER} encendió la PC.");
    if (!g.flag("hasDeck")) return g.say("Almacén de cartas: no tenés cartas guardadas todavía.");
    await g.openDeckEditor();
  },
  async mom(g) {
    if (!g.flag("hasDeck")) {
      await g.say("¡Buen día, {PLAYER}! ¿Viste el anuncio de Kaiba? Medio pueblo no habla de otra cosa.", "Mamá");
      await g.say("Don Teo, el de la tienda de cartas, preguntó por vos. ¿Por qué no pasás a verlo?", "Mamá");
      return;
    }
    await g.say("¡{PLAYER}! Tenés cara de cansado. Descansá un poco.", "Mamá");
    await g.heal(true);
    await g.say("¡Listo! Ya estás como nuevo. ¡Mucha suerte en el torneo!", "Mamá");
  },
  async rivalmom(g) {
    if (!g.flag("hasDeck")) return g.say("¿Buscás a {RIVAL}? Salió temprano para la tienda de su abuelo. ¡No para de hablar del torneo!", "Mamá de {RIVAL}");
    await g.say("¡Vos y mi {RIVAL}, rivales desde la cuna! Cuídense mucho, ¿sí?", "Mamá de {RIVAL}");
  },

  // ---------------- Don Teo te frena ----------------
  async teo_stops_you(g) {
    await g.say("¡Ey! ¡Esperá! ¡No salgas!", TEO);
    g.face("player", "down");
    const p = g.pos("player");
    g.spawn({ id: "teo_walk", sprite: "shopkeeper", x: p.x, y: p.y + 5, dir: "up" });
    await g.move("teo_walk", ["up", "up", "up", "up"]);
    await g.say("¡Uf! Llegué a tiempo...\n\nLa hierba alta está llena de espíritus de duelo. Si te cruzás con uno sin baraja, ¡no vas a poder defenderte!", TEO);
    await g.say("Vení conmigo a la tienda.", TEO);
    // Don Teo guía al jugador hasta la tienda (el jugador lo sigue)
    const down = Array(15 - p.y).fill("down");
    await g.lead("teo_walk", [...down, ...Array(14 - p.x).fill("right")]);
    g.remove("teo_walk");
    await g.warp("shop", 6, 8, "up");
    await g.move("player", ["up", "up", "up", "right", "up"]);
    g.face("player", "up");
    await g.say("¡Abuelo! ¡Ya me cansé de esperar!", "{RIVAL}");
    await g.say("¿{RIVAL}? Ah, cierto, te pedí que vinieras. Esperá un momento.", TEO);
    await g.say("{PLAYER}, sobre esa mesa hay tres barajas de estructura.\n\nCada una lleva un espíritu de duelo: un compañero que vive dentro de su carta.", TEO);
    await g.say("Quiero que ustedes dos participen del torneo de Kaiba. Elegí la tuya. ¡Vamos, la que quieras!", TEO);
    await g.say("¡Ey! ¿Y yo qué, abuelo?", "{RIVAL}");
    await g.say("Paciencia, {RIVAL}. Vos también vas a tener la tuya.", TEO);
    g.setFlag("canChoose");
  },

  async deckbox(g, i) {
    const key = STARTER_ORDER[i]; const s = STARTERS[key];
    if (!g.flag("canChoose")) return g.say("Tres barajas de estructura relucientes. Mejor esperar a Don Teo.");
    if (g.state.starter) {
      if (key === g.state.starter) return g.say("Este es el lugar donde estaba tu baraja.");
      return g.say("La mesa está vacía.");
    }
    await g.showStarter(key);
    const yes = await g.ask(`¿Elegís la ${s.title}, con el espíritu ${s.spirit}?`);
    g.hideStarter();
    if (yes !== 0) return;
    g.state.starter = key; g.giveStarter(key); g.setFlag("taken_" + key); g.refresh();
    g.setFlag("hasDeck"); g.setFlag("canChoose", false);
    await g.say(`¡${s.spirit} parece contento de estar con vos!`);
    await g.say(`¡{PLAYER} recibió la ${s.title}!`);
    // El rival elige la que le gana a la tuya (como en Pokémon)
    const rkey = STARTER_ORDER.find((k) => STARTERS[k].beats === key);
    g.state.flags.rivalStarter = rkey;
    await g.say("¡Entonces yo me quedo con esta!", "{RIVAL}");
    await g.move("rival", ["up"]);
    g.setFlag("taken_" + rkey); g.refresh();
    await g.say(`¡{RIVAL} recibió la ${STARTERS[rkey].title}!`);
    await g.move("rival", ["down"]);
    g.face("rival", "right"); g.face("player", "left");
    await g.say("¡Esperá, {PLAYER}! Don Teo nos dio barajas, ¿no?\n\n¡Probémoslas! ¡Te desafío!", "{RIVAL}");
    let r;
    do {
      r = await g.duel({ kind: "rival", name: "{RIVAL}", sprite: "rival", deck: STARTERS[rkey], lp: 8000, noBlackout: true, skill: 0.55, unlockFlag: "beat_rival" });
      if (r.error && await g.ask("El duelo se interrumpió. ¿Querés reintentarlo?", ["Reintentar", "Seguir sin premio"]) !== 0) break;
    } while (r.error);
    if (r.won) await g.say("¡¿Qué?! ¡Elegí la baraja equivocada!", "{RIVAL}");
    else if (!r.error) await g.say("¡Ja! ¡Sabía que era mejor que vos!", "{RIVAL}");
    await g.say("¡Me voy a entrenar! ¡Nos vemos en Ciudad Kaiba, {PLAYER}!", "{RIVAL}");
    await g.move("rival", ["down", "down", "down", "right", "down"]);
    g.remove("rival"); g.setFlag("rivalLeftShop");
    g.face("player", "up");
    await g.say("Ese nieto mío... Siempre tan apurado.", TEO);
    await g.heal(false);
    await g.say("Escuchá bien, {PLAYER}. En el torneo, tus Puntos de Vida no se recuperan solos entre duelo y duelo.\n\nSi bajan mucho, volvé a la tienda o a tu casa y te los restauro.", TEO);
    await g.say("Los espíritus de la hierba alta te van a desafiar. Si les ganás, se unen a vos como cartas.\n\nY cada vez que les vuelvas a ganar, te van a dar cartas parecidas a ellos.", TEO);
    await g.say("Con START (tecla Esc o M) abrís el menú: ahí podés armar tu baraja con las cartas nuevas.\n\n¡Andá, {PLAYER}! ¡Ciudad Verde queda al norte, pasando la Ruta 1!", TEO);
    g.setHeal("shop", 7, 4, "up");
  },

  async teo(g) {
    if (!g.flag("canChoose") && !g.flag("hasDeck")) return g.say("¡Hola, {PLAYER}!", TEO);
    if (!g.flag("hasDeck")) return g.say("Elegí una de las barajas de la mesa. ¡Tomate tu tiempo!", TEO);
    const r = await g.ask("¿Querés que restaure tus Puntos de Vida?", ["Sí", "No"], TEO);
    if (r === 0) { await g.heal(true); await g.say("¡Listo! Tus LP están al máximo. ¡Volvé cuando quieras!", TEO); g.setHeal("shop", 7, 4, "up"); }
    else await g.say("¡Buena suerte allá afuera!", TEO);
  },
  async rival_shop(g) {
    if (!g.state.starter) return g.say("¡El abuelo me prometió una baraja! ¡Apurate a elegir, que después elijo yo!", "{RIVAL}");
    await g.say("¡Mi baraja es mejor que la tuya!", "{RIVAL}");
  },

  // ---------------- Ruta 1 ----------------
  async bugkid(g) {
    if (g.flag("beat_bugkid")) return g.say("Voy a atrapar más bichos para mi baraja. ¡La próxima te gano!", "Cazabichos Tomás");
    await g.say("¡Ey, vos! ¡Los insectos son las mejores cartas que existen!\n\n¡Te lo voy a demostrar!", "Cazabichos Tomás");
    const r = await g.duel({ kind: "trainer", name: "Cazabichos Tomás", sprite: "bugkid", deck: TRAINER_DECKS.route1_bug, lp: 8000, money: 120, skill: 0.5, unlockFlag: "beat_bugkid" });
    if (r.won) { g.setFlag("beat_bugkid"); await g.say("¡Nooo! Mis pobres bichitos...", "Cazabichos Tomás"); }
  },
  async worker(g) { await g.say("Más adelante está Ciudad Verde, pero el puente está en obras.\n\n¡Volvé más tarde!", "Obrero"); },
  async route1_blocked(g) {
    await g.say("¡Alto ahí! El puente a Ciudad Verde está en obras.", "Obrero");
    await g.say("Weevil, Rex y Mako están entrenando acá. Podés desafiarlos las veces que quieras, en cualquier orden. El vendedor tiene sobres y suma los de cada duelista que derrotes.");
    await g.move("player", ["down"]);
  },

  async route_leader(g, id) {
    const leader = ROUTE_LEADERS[id], rival = RIVALS[id];
    if (!leader || !g.flag("hasDeck")) return;
    const wins = g.state.leadersBeaten[id] || 0;
    const yes = await g.ask(`${leader.line}\nVictorias contra mí: ${wins}. Ganar te da una carta de mi baraja.`, ["¡Duelo!", "Ahora no"], rival.name);
    if (yes !== 0) return;
    await g.duel({ kind: "leader", leader: id, name: rival.name, deck: rival.early, lp: 8000, money: leader.money, skill: 0.7 });
  },

  async card_shop(g) {
    if (!g.flag("hasDeck")) return;
    await g.openCardShop();
  },

  // ---------------- Encuentros ----------------
  async wild_spirit(g, id) {
    const sp = SPIRITS[id];
    await g.flash();
    await g.say(`¡Un espíritu de duelo salvaje apareció: ${sp.name}!`);
    await g.duel({ kind: "wild", name: sp.name, spirit: id, deck: sp, lp: sp.lp, skill: 0.4 });
  },

  async blackout(g) {
    await g.say("¡A {PLAYER} no le quedan Puntos de Vida!");
    const lost = Math.floor(g.state.money / 2); g.state.money -= lost;
    await g.say(`{PLAYER} perdió ${lost} de dinero en el apuro...\n\n...y volvió corriendo a un lugar seguro.`);
    await g.toHeal();
    await g.heal(false);
  },
};
