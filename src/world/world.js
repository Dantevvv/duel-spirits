// Escena del mundo: mapas por tiles, movimiento en grilla, NPCs, carteles, puertas,
// hierba alta con espíritus y entrenadores que te ven y te desafían.
import { TILE, S, CHAR_H, buildTextures, buildBuilding, paintMap } from "../gfx/art.js";
import { MAPS, LEGEND, BLOCKING } from "../content/maps.js";
import { ENCOUNTERS } from "../content/spirits.js";
import { Input } from "../input.js";
import { UI, sleep } from "../ui/ui.js";
import { game, check, fmt, save } from "../state.js";

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const FRAME = { down: 0, up: 3, right: 6, left: 9 };
const OPP = { up: "down", down: "up", left: "right", right: "left" };
const WALK_MS = 210, RUN_MS = 120;
const K = 1 / S;                 // las texturas están dibujadas S veces más grandes que el mundo
const CH_OFF = CHAR_H - TILE;    // cuánto sobresale un personaje por encima de su casilla

export class WorldScene extends Phaser.Scene {
  constructor() { super("world"); this.scripts = {}; }

  create() {
    buildTextures(this);
    buildBuilding(this, "b_house", 5, 4, { roof: "#d0504a", roofB: "#b03a36", roofC: "#e0706a", door: 2, windows: [0.4, 3.6], chimney: true });
    buildBuilding(this, "b_house2", 5, 4, { roof: "#4a7ad0", roofB: "#3a5ab0", roofC: "#6a9ae0", door: 2, windows: [0.4, 3.6], chimney: true });
    buildBuilding(this, "b_house3", 5, 4, { roof: "#58a058", roofB: "#3e7e3e", roofC: "#78c078", door: 2, windows: [0.4, 3.6], chimney: true });
    buildBuilding(this, "b_gym", 7, 5, { roof: "#4a9a5a", roofB: "#2e7a40", roofC: "#6aba7a", door: 3, windows: [0.6, 5.4], sign: "GIMNASIO", signColor: "#2e7a40" });
    buildBuilding(this, "b_shop", 7, 5, { roof: "#e0a040", roofB: "#c08020", roofC: "#f0c060", door: 2, windows: [4, 5.4], sign: "TIENDA", signColor: "#7a3ab0" });
    this.layer = this.add.container(0, 0); this.objLayer = this.add.container(0, 0);
    this.cameras.main.setZoom(S);
    this.ready = true;
    if (this.onReady) this.onReady();
  }

  // ---------------- Carga de mapas ----------------
  loadMap(id, x, y, dir = "down", opts = {}) {
    const m = MAPS[id]; if (!m) throw new Error("Mapa inexistente: " + id);
    this.map = m; this.mapId = id;
    const st = game.state; st.map = id; st.x = x; st.y = y; st.dir = dir;
    this.layer.removeAll(true); this.objLayer.removeAll(true);
    this.h = m.rows.length; this.w = m.rows[0].length;
    this.blocked = new Set(); this.doors = new Map();
    for (let ty = 0; ty < this.h; ty++) for (let tx = 0; tx < this.w; tx++) if (BLOCKING.has(m.rows[ty][tx])) this.blocked.add(tx + "," + ty);
    // El suelo es una sola imagen; árboles, cercas, carteles y hierba alta se ordenan con los personajes.
    const art = paintMap(this, id, m, LEGEND);
    this.layer.add(this.add.image(0, 0, art.key).setOrigin(0).setScale(K));
    for (const p of art.props) {
      const img = this.add.image(p.x * TILE + TILE / 2, (p.y + 1) * TILE, p.key).setOrigin(0.5, 1).setScale(K).setDepth(p.y + (p.name === "tall" ? 0.6 : 0.45));
      this.objLayer.add(img);
      if (p.name === "tall") this.tweens.add({ targets: img, scaleX: K * 1.06, duration: 900 + ((p.x * 37 + p.y * 53) % 500), yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    for (const b of m.buildings || []) {
      this.objLayer.add(this.add.image(b.x * TILE, b.y * TILE, b.key).setOrigin(0).setScale(K).setDepth(b.y + b.h));
      for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) this.blocked.add((b.x + i) + "," + (b.y + j));
      this.doors.set((b.x + b.door) + "," + (b.y + b.h - 1), b.warp);
    }
    // Decoraciones (objetos con sprite propio)
    this.decos = [];
    this.refreshDecos();
    // NPCs
    this.npcs = [];
    for (const n of m.npcs || []) if (check(n.showIf)) this.spawnNpc(n);
    // Jugador
    this.player = this.makeActor("player", x, y, dir);
    this.player.isPlayer = true;
    // Cámara
    const cam = this.cameras.main; const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom; const mw = this.w * TILE, mh = this.h * TILE;
    cam.setBounds(Math.min(0, (mw - vw) / 2), Math.min(0, (mh - vh) / 2), Math.max(mw, vw), Math.max(mh, vh));
    cam.startFollow(this.player.sprite, true, 1, 1, -TILE / 2, -(CH_OFF + TILE / 2));
    this.sortDepth();
    if (m.name && !opts.silent) UI.mapBanner(m.name);
  }

  refreshDecos() {
    for (const d of this.decos || []) d.destroy();
    this.decos = [];
    for (const o of this.map.objects || []) if (o.deco && check(o.showIf)) {
      const img = this.add.image(o.x * TILE, o.y * TILE - 3, o.deco).setOrigin(0).setScale(K).setDepth(o.y + 0.3);
      this.objLayer.add(img); this.decos.push(img);
    }
  }
  makeActor(spriteKey, x, y, dir) {
    const shadow = this.add.image(x * TILE + 8, y * TILE + 14, "shadow").setScale(K);
    const sprite = this.add.sprite(x * TILE, y * TILE - CH_OFF, `ch_${spriteKey}`, FRAME[dir]).setOrigin(0).setScale(K);
    this.objLayer.add(shadow); this.objLayer.add(sprite);
    return { sprite, shadow, x, y, dir, key: spriteKey, moving: false };
  }
  spawnNpc(def) {
    const a = this.makeActor(def.sprite, def.x, def.y, def.dir || "down");
    Object.assign(a, { id: def.id, def }); this.npcs.push(a); this.sortDepth(); return a;
  }
  removeNpc(id) { const i = this.npcs.findIndex((n) => n.id === id); if (i >= 0) { const n = this.npcs[i]; n.sprite.destroy(); n.shadow.destroy(); this.npcs.splice(i, 1); } }
  npc(id) { return id === "player" ? this.player : this.npcs.find((n) => n.id === id); }
  sortDepth() { for (const a of [this.player, ...(this.npcs || [])]) if (a) { a.sprite.setDepth(a.y + 0.5); a.shadow.setDepth(a.y + 0.4); } this.objLayer.sort("depth"); }

  // ---------------- Colisiones ----------------
  tileAt(x, y) { return this.map.rows[y]?.[x]; }
  isBlocked(x, y, self) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return true;
    if (this.blocked.has(x + "," + y)) return true;
    if (self !== this.player && this.player && this.player.x === x && this.player.y === y) return true;
    return this.npcs.some((n) => n !== self && n.x === x && n.y === y);
  }

  // ---------------- Movimiento ----------------
  face(actor, dir) { actor.dir = dir; actor.sprite.setFrame(FRAME[dir]); }

  /** Mueve un actor un tile (o 2 si salta un saliente). Devuelve una promesa. */
  step(actor, dir, { jump = false, ms } = {}) {
    const [dx, dy] = DIRS[dir]; const dist = jump ? 2 : 1;
    actor.dir = dir; actor.moving = true;
    const nx = actor.x + dx * dist, ny = actor.y + dy * dist;
    actor.x = nx; actor.y = ny; this.sortDepth();
    const dur = (ms || (Input.running() && actor === this.player ? RUN_MS : WALK_MS)) * (jump ? 1.6 : 1);
    actor.walkPhase = ((actor.walkPhase || 0) + 1) % 2;
    const base = FRAME[dir]; const wf = base + 1 + actor.walkPhase;
    actor.sprite.setFrame(wf);
    return new Promise((resolve) => {
      this.tweens.add({ targets: actor.sprite, x: nx * TILE, y: ny * TILE - CH_OFF, duration: dur, onComplete: () => { actor.sprite.setFrame(base); actor.moving = false; resolve(); } });
      this.tweens.add({ targets: actor.shadow, x: nx * TILE + 8, y: ny * TILE + 14, duration: dur });
      if (jump) this.tweens.add({ targets: actor.sprite, y: `-=${8}`, duration: dur / 2, yoyo: true, ease: "Quad.easeOut" });
      setTimeout(() => actor.sprite.setFrame(base + 1 + ((actor.walkPhase + 1) % 2)), dur / 2);
    });
  }

  update() {
    if (!this.player || this.player.moving || UI.busy || this.scriptRunning || this.paused) return;
    const d = Input.dir();
    if (!d) { this.holdStart = 0; return; }
    const p = this.player;
    if (d !== p.dir && !this.holdStart) { this.face(p, d); this.holdStart = performance.now(); return; }
    if (d !== p.dir) this.face(p, d);
    if (this.holdStart && performance.now() - this.holdStart < 70) return;
    this.tryMove(d);
  }

  async tryMove(dir) {
    const p = this.player; const [dx, dy] = DIRS[dir]; const nx = p.x + dx, ny = p.y + dy;
    const target = this.tileAt(nx, ny);
    // Bordes de mapa que conectan con otro mapa
    for (const e of this.map.edges || []) if (ny === e.y && nx >= e.x0 && nx <= e.x1) {
      this.scriptRunning = true; await this.step(p, dir);
      await this.transition(e.map, nx, e.ty, e.dir); this.scriptRunning = false; return;
    }
    // Puerta de edificio
    const door = this.doors.get(nx + "," + ny);
    if (door && dir === "up") { this.scriptRunning = true; await this.transition(door.map, door.tx, door.ty, door.dir, true); this.scriptRunning = false; return; }
    // Saliente: solo se baja
    if (target === "v") {
      if (dir === "down" && !this.isBlocked(nx, ny + 1, p)) { this.scriptRunning = true; await this.step(p, "down", { jump: true }); this.scriptRunning = false; await this.afterStep(); }
      return;
    }
    // Salida por alfombra estando parado encima
    const here = (this.map.warps || []).find((w) => w.x === p.x && w.y === p.y && w.mat);
    if (here && dir === "down" && this.isBlocked(nx, ny, p)) { this.scriptRunning = true; await this.transition(here.map, here.tx, here.ty, here.dir, true); this.scriptRunning = false; return; }
    if (this.isBlocked(nx, ny, p)) { this.bump(); return; }
    this.scriptRunning = true;
    await this.step(p, dir);
    this.scriptRunning = false;
    game.state.x = p.x; game.state.y = p.y; game.state.dir = p.dir; game.state.stats.steps++;
    await this.afterStep(true);
  }
  bump() { if (this._bumpT && performance.now() - this._bumpT < 300) return; this._bumpT = performance.now(); }

  async afterStep(walked = true) {
    const p = this.player;
    // Warps (escaleras / alfombras)
    const w = (this.map.warps || []).find((w) => w.x === p.x && w.y === p.y);
    if (w && walked) { this.scriptRunning = true; await this.transition(w.map, w.tx, w.ty, w.dir, true); this.scriptRunning = false; return; }
    // Disparadores de historia
    for (const t of this.map.triggers || []) {
      if (p.x >= t.x && p.x < t.x + t.w && p.y >= t.y && p.y < t.y + t.h && check(t.if)) { await this.run(t.script); return; }
    }
    // Entrenadores que te ven
    if (await this.checkTrainers()) return;
    // Hierba alta
    if (this.tileAt(p.x, p.y) === "g" && this.map.grass) {
      const enc = ENCOUNTERS[this.map.grass];
      if (enc && Math.random() < enc.rate && game.state.flags.hasDeck) {
        const total = enc.table.reduce((s, e) => s + e.w, 0); let r = Math.random() * total; let pick = enc.table[0].id;
        for (const e of enc.table) { r -= e.w; if (r <= 0) { pick = e.id; break; } }
        await this.run("wild_spirit", pick);
      }
    }
  }

  async checkTrainers() {
    for (const n of this.npcs) {
      const tr = n.def.trainer; if (!tr || game.state.flags[tr.flag]) continue;
      const [dx, dy] = DIRS[n.dir];
      for (let i = 1; i <= tr.sight; i++) {
        const x = n.x + dx * i, y = n.y + dy * i;
        if (this.player.x === x && this.player.y === y) {
          this.scriptRunning = true;
          await this.emote(n);
          // Camina hasta quedar al lado
          for (let k = 1; k < i; k++) await this.step(n, n.dir, { ms: 240 });
          this.face(this.player, OPP[n.dir]);
          this.scriptRunning = false;
          await this.run(n.def.script, n.id);
          return true;
        }
        if (this.blocked.has(x + "," + y)) break;
      }
    }
    return false;
  }

  async emote(actor) {
    const e = this.add.image(actor.x * TILE, actor.y * TILE - CH_OFF - 14, "emote_alert").setOrigin(0).setScale(K).setDepth(999);
    this.objLayer.add(e);
    this.tweens.add({ targets: e, y: e.y - 3, duration: 120, yoyo: true });
    await sleep(700); e.destroy();
  }

  async transition(map, x, y, dir, door = false) {
    await UI.fade(true, 180);
    this.loadMap(map, x, y, dir, { silent: MAPS[map].indoor && this.map.indoor });
    await UI.fade(false, 180);
  }

  // ---------------- Interacción ----------------
  async interact() {
    if (!this.player || this.player.moving || UI.busy || this.scriptRunning) return;
    const p = this.player; const [dx, dy] = DIRS[p.dir]; let x = p.x + dx, y = p.y + dy;
    // Hablar por encima de mostradores/mesas
    let n = this.npcs.find((n) => n.x === x && n.y === y);
    const objHere = (this.map.objects || []).some((o) => o.x === x && o.y === y);
    if (!n && !objHere && ["t", "c"].includes(this.tileAt(x, y))) n = this.npcs.find((q) => q.x === x + dx && q.y === y + dy);
    if (n) {
      if (n.def.trainer && !game.state.flags[n.def.trainer.flag]) this.face(n, OPP[p.dir]);
      else if (!n.def.fixedDir) this.face(n, OPP[p.dir]);
      return this.run(n.def.script, n.id);
    }
    const sign = (this.map.signs || []).find((s) => s.x === x && s.y === y);
    if (sign) { this.scriptRunning = true; await UI.say(sign.text); this.scriptRunning = false; return; }
    const obj = (this.map.objects || []).find((o) => o.x === x && o.y === y);
    if (obj) {
      if (obj.script) return this.run(obj.script, obj.arg);
      this.scriptRunning = true; await UI.say(obj.text); this.scriptRunning = false;
    }
  }

  /** Ejecuta un script de historia (async). */
  async run(name, arg) {
    const fn = this.scripts[name];
    if (!fn) { console.warn("script inexistente", name); return; }
    this.scriptRunning = true;
    try { await fn(this.api, arg); if (!save()) UI.toast("No se pudo guardar. La partida sigue en esta ventana."); }
    catch (e) { console.error(e); await UI.say("[Error en el script " + name + ": " + e.message + "]"); }
    finally { this.scriptRunning = false; }
  }
}
