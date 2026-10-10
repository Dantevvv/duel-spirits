// Capa de interfaz en HTML sobre el canvas: diálogos, menús, entradas de texto, avisos y fundidos.
import { Input } from "../input.js";
import { game, fmt } from "../state.js";

const $ = (sel, root = document) => root.querySelector(sel);
export const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const UI = {
  root: null, busy: 0,
  init() { this.root = $("#ui"); },
  lock() { this.busy++; }, unlock() { this.busy = Math.max(0, this.busy - 1); },

  /** Muestra texto con efecto máquina de escribir. Páginas separadas por línea en blanco. */
  async say(text, opts = {}) {
    this.lock();
    const pages = fmt(text).split(/\n\s*\n/);
    const box = el("div", "dialog"); this.root.appendChild(box);
    if (opts.speaker) box.appendChild(el("div", "speaker", esc(fmt(opts.speaker))));
    const body = el("div", "dtext"); box.appendChild(body);
    const arrow = el("div", "darrow", "▼"); box.appendChild(arrow);
    try {
      for (let i = 0; i < pages.length; i++) {
        await this.type(body, pages[i], arrow);
        if (opts.keepLast && i === pages.length - 1) { arrow.hidden = true; break; }
        await this.waitA(box);
      }
    } finally {
      if (!opts.keepLast) box.remove(); else this._kept = box;
      this.unlock();
    }
  },
  clearKept() { if (this._kept) { this._kept.remove(); this._kept = null; } },

  type(body, text, arrow) {
    return new Promise((resolve) => {
      arrow.hidden = true; body.textContent = "";
      const speed = [0, 45, 22, 6][game.state.options.textSpeed || 2];
      let i = 0, done = false;
      const finish = () => { if (done) return; done = true; clearInterval(t); body.textContent = text; arrow.hidden = false; off(); resolve(); };
      const off = Input.push((b) => { if (b === "A" || b === "B") finish(); });
      const t = setInterval(() => { i += 1; body.textContent = text.slice(0, i); if (i >= text.length) finish(); }, speed);
      body.parentElement.onclick = finish;
    });
  },
  waitA(box) {
    return new Promise((resolve) => {
      const done = () => { off(); box.onclick = null; resolve(); };
      const off = Input.push((b) => { if (b === "A" || b === "B") done(); });
      box.onclick = done;
    });
  },

  /** Lista de opciones. Devuelve el índice elegido o -1 si se cancela (cancelable). */
  choose(options, opts = {}) {
    this.lock();
    return new Promise((resolve) => {
      const box = el("div", "choices" + (opts.cls ? " " + opts.cls : "")); this.root.appendChild(box);
      if (opts.title) box.appendChild(el("div", "ctitle", esc(fmt(opts.title))));
      let idx = opts.start || 0;
      const items = options.map((o, i) => { const it = el("div", "citem", esc(fmt(o))); it.onclick = () => { idx = i; pick(); }; it.onmouseenter = () => { idx = i; draw(); }; box.appendChild(it); return it; });
      const draw = () => items.forEach((it, i) => it.classList.toggle("sel", i === idx));
      const close = (v) => { off(); box.remove(); this.unlock(); resolve(v); };
      const pick = () => close(idx);
      const off = Input.push((b) => {
        if (b === "up") idx = (idx + items.length - 1) % items.length;
        else if (b === "down") idx = (idx + 1) % items.length;
        else if (b === "A") return pick();
        else if (b === "B" && opts.cancel !== false) return close(-1);
        draw();
      });
      draw();
    });
  },

  async ask(text, options = ["Sí", "No"], opts = {}) {
    await this.say(text, { ...opts, keepLast: true });
    const r = await this.choose(options, { cancel: opts.cancel ?? true });
    this.clearKept(); return r;
  },

  textInput(prompt, def = "", max = 10) {
    this.lock();
    return new Promise((resolve) => {
      const box = el("div", "modal small");
      box.innerHTML = `<div class="mtitle">${esc(prompt)}</div><input class="tinput" maxlength="${max}" value="${esc(def)}"><button class="btn">OK</button>`;
      this.root.appendChild(box);
      const inp = $("input", box); inp.focus(); inp.select();
      const done = () => { const v = inp.value.trim() || def; box.remove(); off(); this.unlock(); resolve(v); };
      const off = Input.push(() => {});
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); done(); } e.stopPropagation(); });
      $("button", box).onclick = done;
    });
  },

  toast(text, ms = 1600) {
    const t = el("div", "toast", esc(fmt(text))); this.root.appendChild(t);
    setTimeout(() => t.classList.add("out"), ms); setTimeout(() => t.remove(), ms + 400);
  },
  async fade(out = true, ms = 250, color = "#000") {
    let f = $(".fader", this.root);
    if (!f) { f = el("div", "fader"); this.root.appendChild(f); }
    f.style.background = color; f.style.transition = `opacity ${ms}ms`;
    await sleep(16); f.style.opacity = out ? "1" : "0"; await sleep(ms + 20);
    if (!out) f.remove();
  },
  async flash(times = 3) {
    for (let i = 0; i < times; i++) { await this.fade(true, 70, "#fff"); await this.fade(false, 70, "#fff"); }
  },
  /** Muestra el nombre del mapa al entrar (como en Rojo Fuego). */
  mapBanner(name) {
    const b = el("div", "mapbanner", esc(fmt(name))); this.root.appendChild(b);
    setTimeout(() => b.classList.add("out"), 1600); setTimeout(() => b.remove(), 2100);
  },
};
