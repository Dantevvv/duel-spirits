// Arma y ejecuta un duelo completo del jugador contra un rival (IA), con pantalla de resultado.
import { DuelRunner } from "./runner.js";
import { OcgMessageType as M } from "../ocg/type_message.js";
import { Sfx } from "../sfx.js";
import { DuelAI } from "./ai.js";
import { DuelView } from "./duelview.js";
import { Input } from "../input.js";
import { UI, el, esc, sleep } from "../ui/ui.js";
import { game, fmt, save } from "../state.js";
import { moneyBreakdown, victoryRewards } from "./rewards.js";

/**
 * @param {{core:any, cards:any, strings:any, scripts:(n:string)=>string|null, preload:(ids:number[])=>Promise<void>, idsOf:(list:any)=>number[]}} ctx
 * @param {{name:string, deck:any, lp:number, skill?:number, kind:string, spirit?:string}} opts
 */
export async function runDuel(ctx, opts) {
  const st = game.state;
  const playerDeck = { main: [...st.deck.main], extra: [...st.deck.extra] };
  const oppDeck = { main: ctx.idsOf(opts.deck.main || opts.deck.deck), extra: ctx.idsOf(opts.deck.extra || []) };
  await ctx.preload([...playerDeck.main, ...playerDeck.extra, ...oppDeck.main, ...oppDeck.extra]);

  const maxLP = st.options.maxLP;
  const myLP = st.options.persistentLP ? (st.lp > 0 ? st.lp : maxLP) : maxLP;
  const playerFirst = Math.random() < 0.5;
  const me = playerFirst ? 0 : 1;
  const decks = me === 0 ? [playerDeck, oppDeck] : [oppDeck, playerDeck];
  const lp = me === 0 ? [myLP, opts.lp] : [opts.lp, myLP];

  UI.lock();
  await UI.fade(true, 250);
  const root = el("div", "duel-root"); UI.root.appendChild(root);
  const view = new DuelView({ root, cards: ctx.cards, strings: ctx.strings, names: [fmt(st.player), fmt(opts.name)], me });
  view.lpMax = me === 0 ? [maxLP, opts.lp] : [opts.lp, maxLP];
  const ai = new DuelAI({ cards: ctx.cards, skill: opts.skill ?? 0.7 });
  // El rival "piensa" medio segundo antes de cada jugada, para que se pueda seguir lo que hace.
  const THINKS = new Set([M.SELECT_IDLECMD, M.SELECT_BATTLECMD]);
  const rivalCtl = async (m) => { const r = ai.respond(m); if (THINKS.has(m.type) || (m.type === M.SELECT_CHAIN && r && r.index != null)) await view.wait(500); return r; };
  rivalCtl.ai = true; rivalCtl.setView = (f) => ai.setView(f); rivalCtl.observe = (m) => ai.observe(m);
  const controllers = []; controllers[me] = (m, r, again) => view.respond(m, again); controllers[1 - me] = rivalCtl;
  // Modo de prueba: ?autoduel en la URL hace que la IA juegue por vos (para testear flujos)
  if (/[?&]autoduel/.test(location.search)) { const auto = new DuelAI({ cards: ctx.cards, skill: 0.9 }); controllers[me] = auto; }
  const runner = new DuelRunner({ core: ctx.core, cards: ctx.cards, scripts: ctx.scripts, decks, lp, controllers, fallback: new DuelAI({ cards: ctx.cards }),
    onMessage: (m, r, silent) => view.onMessage(m, silent) });
  view.runner = runner;
  await UI.fade(false, 250);

  let result, error = null;
  try {
    runner.setup(); view.render();
    Sfx.play("start"); await view.banner("¡Duelo!", 1300, "gold");
    await view.banner(playerFirst ? "Vas primero" : "Vas segundo", 1000, playerFirst ? "" : "opp", playerFirst ? "Empezás vos" : `Empieza ${fmt(opts.name)}`);
    result = await runner.run();
  } catch (e) {
    console.error(e); error = e;
    if (runner.duel?.ptr) runner.duel.destroy();
    result = { winner: null, lp: runner.lp, turns: runner.turn };
  }
  const won = result.winner === me;
  const finalLP = result.lp[me];

  // Pantalla de resultado
  const rewards = won && !error && !opts.noRewards ? victoryRewards(st, opts, (name) => ctx.idsOf([[name, 1]])[0]) : { cards: [], money: [], notices: [] };
  const rows = error || opts.noRewards ? [] : [...moneyBreakdown(opts, result, me, runner.achievements.players[me]), ...rewards.money];
  const money = rows.reduce((sum, row) => sum + row.amount, 0);
  if (!error && !opts.noRewards) {
    if (won) { st.stats.wins++; st.money += money; }
    else if (result.winner === 1 - me) st.stats.losses++;
    if (st.options.persistentLP) st.lp = won ? Math.min(maxLP, Math.max(1, finalLP)) : 0;
    if (!save()) UI.toast("No se pudo guardar. La partida sigue en esta ventana.");
  }
  const cards = new Map(); for (const id of rewards.cards) cards.set(id, (cards.get(id) || 0) + 1);
  const panel = el("div", "d-result " + (won ? "win" : "lose"));
  panel.innerHTML = error
    ? `<div class="r-title">Duelo interrumpido</div><div class="r-line">${esc(error.message)}</div><div class="r-hint">Tocá o presioná A para continuar</div>`
    : `<div class="r-title">${won ? "VICTORIA" : result.winner === null || result.winner === 2 ? "EMPATE" : "DERROTA"}</div>
       <div class="r-line">${result.turns} turnos · LP restantes: ${finalLP}</div>
       <div class="r-summary"><div class="r-money">
       ${rows.length ? rows.map((row) => `<div class="r-pay"><span>${esc(row.label)}</span><b>+$${row.amount}</b></div>`).join("") : '<div class="r-pay">Sin premios en este duelo</div>'}
       <div class="r-pay r-total"><span>Total ganado</span><b>$${money}</b></div>
       <div class="r-wallet">Dinero: $${st.money}</div></div>
       ${rewards.notices.map((n) => `<div class="r-notice">${esc(n)}</div>`).join("")}
       ${cards.size ? `<div class="r-cards"><b>Cartas obtenidas</b>${[...cards].map(([id, n]) => `<div>${esc(ctx.cards.get(id).name)} ×${n}</div>`).join("")}</div>` : ""}</div>
       <button class="btn r-continue">Continuar</button>`;
  view.scr.appendChild(panel); if (!error) Sfx.play(won ? "win" : "lose");
  await new Promise((resolve) => { const done = () => { off(); resolve(); }; const off = Input.push((b) => { if (b === "A" || b === "B") done(); }); (panel.querySelector(".r-continue") || panel).onclick = done; });

  await UI.fade(true, 250);
  view.destroy(); root.remove();
  await UI.fade(false, 250);
  UI.unlock();

  // Consecuencias
  if (error) return { won: false, error };
  return { won, lp: finalLP, money, rewards };
}
