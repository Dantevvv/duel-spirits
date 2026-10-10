import { UI, el, esc } from "./ui.js";
import { Input } from "../input.js";
import { game, save } from "../state.js";
import { miniCard, detailHtml } from "./menu.js";
import { shopPacks, buyPack } from "../content/packs.js";
import { ownedCopies } from "../duel/rewards.js";

export function cardShop(ctx) {
  UI.lock();
  return new Promise((resolve) => {
    const st = game.state, packs = shopPacks(st);
    let selected = 0, opening = null, buying = false;
    const root = el("div", "screen card-shop");
    root.innerHTML = `<div class="s-head"><span>Tienda de cartas</span><span class="shop-wallet"></span><button class="btn ghost shop-close">Salir</button></div>
      <div class="s-body"><nav class="shop-packs" aria-label="Sobres"></nav><section class="shop-main"></section><aside class="shop-detail">Elegí una carta para leer su efecto.</aside></div>`;
    UI.root.appendChild(root);
    const list = root.querySelector(".shop-packs"), main = root.querySelector(".shop-main"), detail = root.querySelector(".shop-detail");
    const cardGrid = (entries, received = false) => {
      const grid = el("div", "shop-grid");
      for (const [id, badge] of entries) {
        const button = el("button", "shop-card"); button.type = "button";
        button.setAttribute("aria-label", ctx.cards.get(id).name);
        button.appendChild(miniCard(id));
        button.appendChild(el("span", "shop-card-name", esc(ctx.cards.get(id).name)));
        button.appendChild(el("small", "", received ? "Obtenida" : `${esc(badge)} · Tenés ${ownedCopies(st, id)}`));
        button.onclick = () => { detail.innerHTML = detailHtml(id); };
        button.onmouseenter = () => { detail.innerHTML = detailHtml(id); };
        grid.appendChild(button);
      }
      return grid;
    };
    const draw = () => {
      root.querySelector(".shop-wallet").textContent = `$${st.money}`;
      list.innerHTML = "";
      packs.forEach((p, i) => {
        const button = el("button", "btn shop-pack" + (selected === i ? " on" : ""), `${esc(p.name)}<small>${p.unlocked ? "$" + p.price : "Ganale para desbloquear"}</small>`);
        button.onclick = () => { selected = i; opening = null; detail.textContent = "Elegí una carta para leer su efecto."; draw(); };
        list.appendChild(button);
      });
      main.innerHTML = "";
      if (opening) {
        main.appendChild(el("h2", "", "¡Tus nueve cartas!"));
        main.appendChild(el("p", "", "Se agregaron a tu colección. Podés usarlas desde Baraja."));
        main.appendChild(cardGrid(opening.map((id) => [id, ""]), true));
        const back = el("button", "btn", "Volver a los sobres"); back.onclick = () => { opening = null; draw(); }; main.appendChild(back);
        return;
      }
      const pack = packs[selected];
      main.appendChild(el("h2", "", esc(pack.name)));
      main.appendChild(el("p", "", pack.themed ? "9 cartas: 8 del mazo y 1 carta ícono. Pueden salir repetidas." : "9 cartas: 8 comunes y 1 rara o superior. Selección del set original; pueden salir repetidas."));
      const buy = el("button", "btn shop-buy", pack.unlocked ? `Comprar sobre · $${pack.price}` : "Sobre bloqueado");
      buy.disabled = !pack.unlocked || st.money < pack.price;
      buy.onclick = () => {
        if (buying) return;
        buying = true;
        try {
          const result = buyPack(st, pack.id, ctx.idOf);
          if (result.error) return UI.toast(result.error);
          opening = result.cards;
          if (!save()) UI.toast("Compra realizada. No se pudo guardar: mantené esta ventana abierta.");
          draw();
        } finally { buying = false; }
      };
      main.appendChild(buy);
      if (pack.unlocked && st.money < pack.price) main.appendChild(el("p", "shop-short", `Te faltan $${pack.price - st.money}.`));
      main.appendChild(el("p", "", `Contenido posible: ${pack.cards.length} cartas`));
      main.appendChild(cardGrid(pack.cards.map(([name, rarity]) => [ctx.idOf(name), rarity])));
    };
    const close = () => { off(); root.remove(); UI.unlock(); resolve(); };
    root.querySelector(".shop-close").onclick = close;
    const off = Input.push((b) => {
      if (b === "B" || b === "START") { if (opening) { opening = null; draw(); } else close(); }
      else if ((b === "up" || b === "down") && !opening) { selected = (selected + (b === "up" ? -1 : 1) + packs.length) % packs.length; draw(); }
      else if (b === "A") root.querySelector(".shop-buy:not(:disabled)")?.click();
    });
    draw();
  });
}
