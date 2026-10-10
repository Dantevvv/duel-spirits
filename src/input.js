// Entrada unificada: teclado + controles táctiles en pantalla.
// Botones lógicos: up, down, left, right, A, B, START.
const KEYMAP = {
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
  KeyZ: "A", Space: "A", Enter: "A", KeyX: "B", Backspace: "B", ShiftLeft: "B", ShiftRight: "B", Escape: "START", KeyM: "START", KeyC: "START",
};

export const Input = {
  held: new Set(),
  handlers: [],          // pila: el último recibe las pulsaciones (UI encima del mundo)
  push(fn) { this.handlers.push(fn); return () => this.remove(fn); },
  remove(fn) { const i = this.handlers.lastIndexOf(fn); if (i >= 0) this.handlers.splice(i, 1); },
  press(btn) {
    if (!this.held.has(btn)) { this.held.add(btn); const h = this.handlers[this.handlers.length - 1]; if (h) h(btn); }
  },
  release(btn) { this.held.delete(btn); },
  isDown(btn) { return this.held.has(btn); },
  dir() { for (const d of ["up", "down", "left", "right"]) if (this.held.has(d)) return d; return null; },
  running() { return this.held.has("B"); },
};

export function setupInput() {
  window.addEventListener("keydown", (e) => {
    const t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    const b = KEYMAP[e.code]; if (!b) return; e.preventDefault();
    if (e.repeat && b !== "up" && b !== "down" && b !== "left" && b !== "right") return;
    Input.press(b);
  });
  window.addEventListener("keyup", (e) => { const b = KEYMAP[e.code]; if (b) Input.release(b); });
  window.addEventListener("blur", () => Input.held.clear());
  buildTouchControls();
}

function buildTouchControls() {
  const touch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  const pad = document.getElementById("touch");
  if (!touch || !pad) return;
  pad.hidden = false;
  pad.querySelectorAll("[data-btn]").forEach((el) => {
    const b = el.dataset.btn;
    const down = (e) => { e.preventDefault(); el.classList.add("on"); Input.press(b); };
    const up = (e) => { e.preventDefault(); el.classList.remove("on"); Input.release(b); };
    el.addEventListener("pointerdown", down); el.addEventListener("pointerup", up); el.addEventListener("pointerleave", up); el.addEventListener("pointercancel", up);
  });
}
