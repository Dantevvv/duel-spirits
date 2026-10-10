// Efectos de sonido originales, sintetizados con Web Audio (no usa archivos).
// Si existe game/assets/sfx/<nombre>.mp3 o .wav, ese archivo reemplaza al sonido sintetizado.
import { game } from "./state.js";

let ctx = null, master = null; const files = {};
function audio() {
  if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
function tone(f, dur, o = {}) {
  const t = ctx.currentTime + (o.at || 0), osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = o.type || "sine"; osc.frequency.setValueAtTime(f, t); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.3, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master); osc.start(t); osc.stop(t + dur + 0.02);
}
function noise(dur, o = {}) {
  const t = ctx.currentTime + (o.at || 0), n = Math.ceil(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf; const flt = ctx.createBiquadFilter(), g = ctx.createGain();
  flt.type = o.type || "bandpass"; flt.Q.value = o.q || 0.8; flt.frequency.setValueAtTime(o.from || 1200, t); flt.frequency.exponentialRampToValueAtTime(o.to || o.from || 1200, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.3, t + (o.attack || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt).connect(g).connect(master); src.start(t);
}

const SYNTH = {
  click() { tone(880, 0.06, { type: "triangle", vol: 0.15 }); },
  select() { tone(660, 0.07, { type: "triangle", vol: 0.18 }); tone(990, 0.09, { type: "triangle", vol: 0.15, at: 0.05 }); },
  cancel() { tone(420, 0.1, { type: "triangle", vol: 0.16, to: 260 }); },
  draw() { noise(0.14, { from: 2600, to: 6000, vol: 0.16 }); },
  move() { noise(0.16, { from: 900, to: 2600, vol: 0.14 }); },
  set() { noise(0.1, { from: 500, to: 250, vol: 0.25 }); tone(140, 0.12, { vol: 0.25, to: 80 }); },
  summon() { tone(110, 0.3, { vol: 0.45, to: 50 }); noise(0.22, { from: 300, to: 100, vol: 0.35, type: "lowpass" }); tone(520, 0.3, { type: "triangle", vol: 0.14, to: 1040, at: 0.05 }); },
  spsummon() { tone(300, 0.5, { type: "sawtooth", vol: 0.1, to: 1400 }); tone(1320, 0.4, { type: "triangle", vol: 0.16, at: 0.3 }); noise(0.5, { from: 800, to: 5000, vol: 0.14 }); },
  flip() { noise(0.12, { from: 1500, to: 4000, vol: 0.2 }); tone(700, 0.12, { type: "triangle", vol: 0.12, at: 0.05 }); },
  activate() { tone(784, 0.14, { type: "triangle", vol: 0.2 }); tone(1175, 0.16, { type: "triangle", vol: 0.2, at: 0.08 }); tone(1568, 0.3, { type: "triangle", vol: 0.16, at: 0.16 }); },
  chain() { tone(520, 0.09, { type: "square", vol: 0.08 }); tone(780, 0.14, { type: "square", vol: 0.08, at: 0.07 }); },
  negate() { tone(300, 0.3, { type: "sawtooth", vol: 0.16, to: 90 }); },
  target() { tone(1200, 0.08, { type: "square", vol: 0.07 }); tone(1200, 0.08, { type: "square", vol: 0.07, at: 0.12 }); },
  attack() { noise(0.3, { from: 400, to: 3600, vol: 0.28, attack: 0.15 }); },
  hit() { noise(0.28, { from: 1800, to: 120, vol: 0.5, type: "lowpass" }); tone(90, 0.3, { vol: 0.5, to: 40 }); },
  destroy() { noise(0.45, { from: 5000, to: 500, vol: 0.32 }); tone(200, 0.35, { type: "sawtooth", vol: 0.14, to: 50 }); },
  tribute() { tone(500, 0.45, { type: "sine", vol: 0.16, to: 1800 }); noise(0.4, { from: 3000, to: 7000, vol: 0.08 }); },
  damage() { tone(160, 0.4, { type: "sawtooth", vol: 0.22, to: 55 }); noise(0.2, { from: 700, to: 200, vol: 0.25, type: "lowpass" }); },
  heal() { for (const [i, f] of [523, 659, 784, 1047].entries()) tone(f, 0.22, { type: "sine", vol: 0.16, at: i * 0.07 }); },
  coin() { tone(1900, 0.5, { type: "triangle", vol: 0.14, to: 2300 }); },
  shuffle() { for (let i = 0; i < 4; i++) noise(0.07, { from: 2500, to: 4500, vol: 0.14, at: i * 0.08 }); },
  phase() { noise(0.3, { from: 600, to: 3000, vol: 0.12, attack: 0.1 }); tone(440, 0.18, { type: "triangle", vol: 0.1, at: 0.08 }); },
  turn() { noise(0.45, { from: 300, to: 2400, vol: 0.18, attack: 0.2 }); tone(392, 0.2, { type: "triangle", vol: 0.16, at: 0.1 }); tone(587, 0.35, { type: "triangle", vol: 0.16, at: 0.25 }); },
  start() { tone(196, 0.5, { type: "sawtooth", vol: 0.14 }); tone(294, 0.5, { type: "sawtooth", vol: 0.12, at: 0.12 }); tone(392, 0.8, { type: "sawtooth", vol: 0.12, at: 0.24 }); noise(0.8, { from: 400, to: 5000, vol: 0.14, attack: 0.4 }); },
  win() { for (const [i, f] of [523, 659, 784, 1047, 784, 1047, 1319].entries()) tone(f, 0.3, { type: "triangle", vol: 0.2, at: i * 0.13 }); },
  lose() { for (const [i, f] of [392, 349, 311, 262, 196].entries()) tone(f, 0.45, { type: "triangle", vol: 0.2, at: i * 0.22 }); },
};

export const Sfx = {
  names: Object.keys(SYNTH),
  /** Busca archivos propios en assets/sfx/ (opcional). */
  async loadFiles() {
    await Promise.all(this.names.flatMap((n) => ["mp3", "wav"].map(async (ext) => {
      try { const r = await fetch(`assets/sfx/${n}.${ext}`); if (r.ok && !files[n]) files[n] = URL.createObjectURL(await r.blob()); } catch {}
    })));
  },
  play(name) {
    if (game.state.options.sound === false) return;
    try {
      if (files[name]) { const a = new Audio(files[name]); a.volume = 0.6; a.play().catch(() => {}); return; }
      if (SYNTH[name] && audio()) SYNTH[name]();
    } catch {}
  },
};
