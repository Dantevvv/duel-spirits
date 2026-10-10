// Scripts de historia. Cada script es una función async que recibe "g" (la API del juego).
// Para seguir la historia, agregá funciones acá y referencialas desde maps.js (npcs, objetos, disparadores).
import { STARTERS, STARTER_ORDER, STARTER_KEYS } from "./decks.js";
import { SPIRITS } from "./spirits.js";
import { RIVALS } from "./rivals.js";
import { GYM_DUELISTS } from "./packs.js";
import { PLAN, GYMS, deckFor } from "./progression.js";

// Diálogos de los entrenadores de ruta. La baraja, los LP, la IA y el premio están en progression.js.
const TRAINER_LINES = {
  route1_bug: { flag: "beat_bugkid", hi: "¡Ey, vos! ¡Los insectos son las mejores cartas que existen!\n\n¡Te lo voy a demostrar!", win: "¡Nooo! Mis pobres bichitos...", after: "Voy a atrapar más bichos para mi baraja. ¡La próxima te gano!" },
  route1_rock: { flag: "beat_route1_rock", hi: "¡Alto, duelista! Mis rocas aguantan cualquier ataque.\n\nA ver si podés con una muralla de piedra.", win: "¡Imposible! ¡Rompiste mi muralla!", after: "Con Gaia Power mis rocas golpean más fuerte. Igual me ganaste... Respeto." },
  route1_sword: { flag: "beat_route1_sword", hi: "¡En guardia! Un espadachín nunca rechaza un duelo.", win: "Mi espada... no fue suficiente.", after: "Reforzá tu baraja con trampas. Los guerreros atacan sin parar." },
  route1_zombie: { flag: "beat_route1_zombie", hi: "Los muertos no descansan en esta ruta...\n\nMis zombis vuelven una y otra vez.", win: "Volverán... siempre vuelven...", after: "Si vas al gimnasio, Weevil juega sucio. Cuidado con sus trampas." },
  route1_chumley: { flag: "beat_route1_chumley", hi: "¡Uf, uf! ¿Vas a Ciudad Verde? Primero tenés que pasar por mí.\n\n¡Mis koalas son imparables!", win: "¡Ay, no! Y yo que quería impresionar a todos...", after: "Ciudad Verde está acá nomás. ¡El gimnasio es el edificio verde grande!" },
};

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
    await g.say("Ah, y una cosa más: tu baraja todavía no tiene todas sus cartas. Las mejores te las voy a ir mandando a medida que avances.\n\nTambién vendo sobres acá, cuando quieras.", TEO);
    g.setHeal("shop", 7, 4, "up");
  },

  async teo(g) {
    if (!g.flag("canChoose") && !g.flag("hasDeck")) return g.say("¡Hola, {PLAYER}!", TEO);
    if (!g.flag("hasDeck")) return g.say("Elegí una de las barajas de la mesa. ¡Tomate tu tiempo!", TEO);
    const r = await g.ask("¿Qué necesitás?", ["Restaurar LP", "Comprar sobres", "Nada"], TEO);
    if (r === 0) { await g.heal(true); await g.say("¡Listo! Tus LP están al máximo. ¡Volvé cuando quieras!", TEO); g.setHeal("shop", 7, 4, "up"); }
    else if (r === 1) await g.openCardShop("teo");
    else await g.say("¡Buena suerte allá afuera!", TEO);
  },
  async rival_shop(g) {
    if (!g.state.starter) return g.say("¡El abuelo me prometió una baraja! ¡Apurate a elegir, que después elijo yo!", "{RIVAL}");
    await g.say("¡Mi baraja es mejor que la tuya!", "{RIVAL}");
  },

  // ---------------- Ruta 1 ----------------
  // Entrenadores con línea de visión: te ven, se acercan y te desafían una vez.
  async trainer(g, id) {
    const step = PLAN[id], lines = TRAINER_LINES[id];
    if (!step || !lines) return;
    if (g.flag(lines.flag)) return g.say(lines.after, step.name);
    if (!g.flag("hasDeck")) return;
    await g.say(lines.hi, step.name);
    const r = await g.duel({ kind: "trainer", name: step.name, deck: deckFor(step), lp: step.lp ?? 8000, money: step.money, skill: step.skill, unlockFlag: lines.flag });
    if (r.won) { g.setFlag(lines.flag); await g.say(lines.win, step.name); }
  },

  // ---------------- Ciudad Verde ----------------
  // El rival te espera en la entrada (D-40): duelo con su baraja reforzada y el paquete de Don Teo.
  async rival_verde(g) {
    g.setFlag("met_rival_verde");
    await g.say("¡{PLAYER}! ¡Por fin llegás!", "{RIVAL}");
    const p = g.pos("player");
    g.spawn({ id: "rival_v", sprite: "rival", x: p.x, y: p.y - 4, dir: "down" });
    await g.move("rival_v", ["down", "down", "down"]);
    g.face("player", "up");
    await g.say("El abuelo me mandó a darte esto. Pero primero... ¡duelo! Quiero ver cuánto mejoraste.", "{RIVAL}");
    const step = PLAN.rival_verde, rkey = g.state.flags.rivalStarter;
    let r;
    do {
      r = await g.duel({ kind: "rival", name: "{RIVAL}", sprite: "rival", deck: deckFor(step, rkey), lp: 8000, money: step.money, skill: step.skill });
      if (r.error && await g.ask("El duelo se interrumpió. ¿Querés reintentarlo?", ["Reintentar", "Seguir sin premio"]) !== 0) break;
    } while (r.error);
    if (r.won) await g.say("¡Grrr! ¡Las cartas nuevas del abuelo me salieron bien a mí también, eh!", "{RIVAL}");
    else if (!r.error) await g.say("¡Ja! Sigo un paso adelante.", "{RIVAL}");
    await g.say("Bueno, tomá. El abuelo dice que tu baraja está lista para crecer.", "{RIVAL}");
    const ids = g.giveStarterKeys(1);
    if (ids.length) {
      await g.say(`¡{PLAYER} recibió el paquete "${STARTER_KEYS[g.state.starter][0].title}"!\n\n${g.cardNames(ids).join(" · ")}`);
      await g.say("Las cartas nuevas están en tu colección. Sumalas desde Baraja en el menú.");
    }
    await g.say("¡Voy a ser el primero en ganarle a Weevil! ¡Nos vemos!", "{RIVAL}");
    await g.move("rival_v", ["up", "up", "up", "up", "up"]);
    g.remove("rival_v");
  },
  async verde_kid(g) { await g.say("¡En el gimnasio hay tres duelistas! Dicen que Weevil no acepta desafíos hasta que les ganes a los otros dos.", "Nena"); },
  async verde_old(g) {
    await g.say("Los sobres de acá traen cartas de Spell Ruler y Pharaoh's Servant.", "Abuelo");
    await g.say("Las cartas más poderosas no salen en los sobres hasta que juntes Tarjetas Localizadoras. Así es el torneo de Kaiba.", "Abuelo");
  },
  async verde_fan(g) { await g.say("Weevil siempre esconde algo boca abajo. Antes de atacar con todo, pensá qué puede ser.", "Fan de los duelos"); },
  async verde_clerk(g) {
    const r = await g.ask("¡Bienvenido al Centro de Duelos! ¿Querés descansar y recuperar tus Puntos de Vida?", ["Sí", "No"], "Recepcionista");
    if (r === 0) { await g.heal(true); g.setHeal("verdeshop", 3, 3, "up"); await g.say("¡Listo! Te esperamos cuando quieras.", "Recepcionista"); }
    else await g.say("¡Mucha suerte en el torneo!", "Recepcionista");
  },

  // ---------------- Gimnasio de Ciudad Verde (D-39) ----------------
  // Rex y Mako te ven al pasar; Weevil, el líder, solo acepta el duelo después de que les ganes a los dos.
  // Se los puede volver a desafiar las veces que quieras (como en D-31): cada revancha da una carta de su mazo.
  async gym_duelist(g, id) {
    const d = GYM_DUELISTS[id], r = RIVALS[id], step = PLAN["gym_" + id], gym = GYMS.verde;
    if (!d || !g.flag("hasDeck")) return;
    const wins = g.state.leadersBeaten[id] || 0;
    if (id === gym.leader) {
      const missing = gym.trainers.filter((t) => !g.state.leadersBeaten[t]);
      if (missing.length) return g.say(`¿Querés enfrentarme a mí? Je. Primero ganale a ${missing.map((t) => RIVALS[t].name).join(" y a ")}.`, r.name);
    }
    if (!wins) await g.say(d.line, r.name);
    const yes = await g.ask(wins ? `¿Revancha? Victorias contra mí: ${wins}. Ganar te da una carta de mi baraja.` : "¿Aceptás el duelo?", ["¡Duelo!", "Ahora no"], r.name);
    if (yes !== 0) return;
    const res = await g.duel({ kind: "leader", leader: id, name: r.name, deck: deckFor(step), lp: step.lp ?? 8000, money: step.money, skill: step.skill });
    if (res.won) g.setFlag("gym_" + id);
    if (res.won && !wins && id === gym.leader) {
      await g.say("¡No puede ser! ¡Mi enjambre...! Tomá, te la ganaste. Es tu primera Tarjeta Localizadora.", r.name);
      await g.say("Ya podés comprar los sobres de Labyrinth of Nightmare en la tienda.\n\nY revisá tu colección: Don Teo te mandó más cartas clave.");
    } else if (res.won && !wins) await g.say("Bien jugado... Weevil te espera al fondo.", r.name);
  },
  async gym_guide(g) {
    await g.say("¡Hola, aspirante! Este gimnasio es de insectos, agua y dinosaurios.", "Guía");
    await g.say("Tus Puntos de Vida no se recuperan entre duelo y duelo. Si estás bajo, salí y descansá en el Centro de Duelos, al lado de la tienda.", "Guía");
  },

  // ---------------- Tiendas ----------------
  async card_shop(g) {
    if (!g.flag("hasDeck")) return;
    await g.openCardShop("verde");
  },

  // ---------------- Playtest (D-42) ----------------
  async test_yugi(g) {
    await g.say("[PRUEBA] Yami Yugi con su baraja de la semifinal: Mago Oscuro y los tres Dioses Egipcios.\n\nNo da premios ni hace perder dinero.", "Playtest");
    const step = PLAN.test_yugi;
    if (await g.ask("¿Duelo de prueba contra Yami Yugi?", ["¡Duelo!", "Ahora no"], "Yami Yugi") !== 0) return;
    const lp = g.state.lp;
    await g.duel({ kind: "test", name: step.name, deck: deckFor(step), lp: 8000, money: 0, skill: step.skill, noBlackout: true, noRewards: true });
    g.state.lp = lp; // la prueba no cuenta para los LP persistentes
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
