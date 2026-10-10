import { OcgMessageType as M } from "../ocg/type_message.js";
import { SPIRITS } from "../content/spirits.js";
import { RIVALS } from "../content/rivals.js";
import { ROUTE_LEADERS, shopPacks, openPack } from "../content/packs.js";

export class DuelAchievements {
  constructor(cards) { this.cards = cards; this.reset(); }
  reset() {
    this.players = [0, 1].map(() => ({ damage: 0, recovered: 0, bigHit: false, fusion: false }));
    this.pending = [];
  }
  observe(m) {
    if (m.type === M.DAMAGE) {
      this.players[m.player].damage += m.amount;
      if (m.amount >= 2000) this.players[1 - m.player].bigHit = true;
    }
    if (m.type === M.RECOVER) this.players[m.player].recovered += m.amount;
    if (m.type === M.SPSUMMONING) this.pending.push(m);
    // Si la invocación se niega, el monstruo sale de su zona antes de SPSUMMONED.
    if (m.type === M.MOVE && m.from.location === 4) {
      this.pending = this.pending.filter((p) => p.controller !== m.from.controller || p.sequence !== m.from.sequence);
    }
    if (m.type === M.SPSUMMONED) {
      for (const p of this.pending) if (this.cards.get(p.code)?.type & 0x40) this.players[p.controller].fusion = true;
      this.pending = [];
    }
  }
}

export function moneyBreakdown(opts, result, me, achievement) {
  if (result.winner !== me) return [];
  const rows = [{ label: "Premio por victoria", amount: opts.money ?? (opts.kind === "wild" ? 30 : 100) }];
  if (achievement.damage === 0) rows.push({ label: "Sin recibir daño", amount: 10 });
  if (achievement.recovered > 0) rows.push({ label: "Recuperaste Puntos de Vida", amount: 10 });
  if (achievement.fusion) rows.push({ label: "Invocaste un monstruo de Fusión", amount: 20 });
  if (achievement.bigHit) rows.push({ label: "2000 o más de daño de una vez", amount: 15 });
  if (result.turns > 0 && result.turns <= 6) rows.push({ label: "Victoria en hasta 6 turnos", amount: 10 });
  return rows;
}

export function ownedCopies(st, id) {
  return (st.collection[id] || 0) + st.deck.main.filter((n) => n === id).length + st.deck.extra.filter((n) => n === id).length;
}

export function spiritPool(sp) {
  const weights = new Map([...(sp.deck || []), ...(sp.extra || []), ...(sp.drops || [])]);
  weights.set(sp.card, 3);
  return [...weights];
}

export function giveDrop(st, pool, idOf, random = Math.random, guaranteed, maxCopies = 3) {
  const choices = pool.map(([name, weight]) => ({ id: idOf(name), weight })).filter(({ id }) => ownedCopies(st, id) < maxCopies);
  let chosen = guaranteed ? choices.find(({ id }) => id === idOf(guaranteed)) : null;
  if (!chosen && choices.length) {
    let r = random() * choices.reduce((sum, c) => sum + c.weight, 0);
    chosen = choices.find((c) => (r -= c.weight) < 0) || choices.at(-1);
  }
  if (!chosen) return { cards: [], money: [{ label: "Colección de recompensas completa", amount: 50 }], notices: [] };
  st.collection[chosen.id] = (st.collection[chosen.id] || 0) + 1;
  return { cards: [chosen.id], money: [], notices: [] };
}

// Se llama exactamente una vez después de una victoria real, antes de guardar y mostrar el resultado.
export function victoryRewards(st, opts, idOf, random = Math.random) {
  const reward = { cards: [], money: [], notices: [] };
  if (opts.kind === "wild" && SPIRITS[opts.spirit]) {
    const sp = SPIRITS[opts.spirit];
    const first = !st.spiritsBeaten[opts.spirit];
    Object.assign(reward, giveDrop(st, spiritPool(sp), idOf, random, first ? sp.card : null));
    st.spiritsBeaten[opts.spirit] = (st.spiritsBeaten[opts.spirit] || 0) + 1;
  }
  if (opts.leader && ROUTE_LEADERS[opts.leader]) {
    const id = opts.leader, first = !st.leadersBeaten[id], r = RIVALS[id];
    Object.assign(reward, giveDrop(st, [...r.early.main, ...(r.early.extra || [])], idOf, random, first ? ROUTE_LEADERS[id].icon : null, Infinity));
    st.leadersBeaten[id] = (st.leadersBeaten[id] || 0) + 1;
    if (first) {
      st.locators.push(id);
      const pack = shopPacks(st).find((p) => p.id === id);
      const cards = openPack(pack, random).map(idOf);
      for (const card of cards) st.collection[card] = (st.collection[card] || 0) + 1;
      reward.cards.push(...cards);
      reward.notices.push(`Tarjeta Localizadora: ${st.locators.length} / 8`, `Sobre de ${r.name} desbloqueado. ¡El primero es de regalo!`);
    }
  }
  if (opts.unlockFlag && !st.flags[opts.unlockFlag]) {
    st.flags[opts.unlockFlag] = true;
    reward.notices.push(`Desbloqueaste el sobre de ${opts.name === "{RIVAL}" ? st.rival : opts.name}.`);
  }
  return reward;
}
