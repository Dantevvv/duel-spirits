// Envoltorio del motor de reglas (ygopro-core compilado a WebAssembly).
// Funciona en navegador y en Node. Las cartas y scripts se entregan por callbacks síncronos.
import { BufferReader, BufferWriter } from "../ocg/internal/buffer.js";
import { readMessage } from "../ocg/messages.js";
import { readField, readQueryLocation, readQuery } from "../ocg/queries.js";
import { createResponse } from "../ocg/responses.js";
import { OcgDuelMode } from "../ocg/type_core.js";

const enc = new TextEncoder();
const dec = new TextDecoder();

// Stubs mínimos de WASI: el motor no usa archivos ni entorno.
function wasiImports(getMem) {
  const noop = () => 0;
  return {
    environ_get: noop,
    environ_sizes_get: (countPtr, sizePtr) => { const v = new DataView(getMem().buffer); v.setUint32(countPtr, 0, true); v.setUint32(sizePtr, 0, true); return 0; },
    clock_time_get: (id, prec, out) => { new DataView(getMem().buffer).setBigUint64(out, BigInt(Math.round(Date.now() * 1e6)), true); return 0; },
    fd_close: noop, fd_fdstat_get: () => 8, fd_fdstat_set_flags: () => 8, fd_prestat_get: () => 8, fd_prestat_dir_name: () => 8,
    fd_read: () => 8, fd_renumber: () => 8, fd_seek: () => 8, path_open: () => 44,
    fd_write: (fd, iovs, iovsLen, nwritten) => {
      const mem = getMem(); const v = new DataView(mem.buffer); let total = 0; let s = "";
      for (let i = 0; i < iovsLen; i++) { const p = v.getUint32(iovs + i * 8, true), l = v.getUint32(iovs + i * 8 + 4, true); s += dec.decode(new Uint8Array(mem.buffer, p, l)); total += l; }
      v.setUint32(nwritten, total, true); if (s.trim()) console.log("[ocgcore]", s.trim()); return 0;
    },
    proc_exit: (c) => { throw new Error("ocgcore exit " + c); },
  };
}

export class OcgCore {
  /** @param {ArrayBuffer|Uint8Array} wasmBytes */
  static async load(wasmBytes) {
    const core = new OcgCore();
    const env = {
      js_card_reader: (code, dataPtr, setPtr, maxSet) => core._readCard(code, dataPtr, setPtr, maxSet),
      js_script_reader: (duelPtr, namePtr) => core._readScript(duelPtr, namePtr),
      js_log: (strPtr, type) => core._log(strPtr, type),
    };
    const { instance } = await WebAssembly.instantiate(wasmBytes, { env, wasi_snapshot_preview1: wasiImports(() => core.mem) });
    core.x = instance.exports;
    core.x._initialize();
    return core;
  }

  get mem() { return this.x.memory; }
  view() { return new DataView(this.mem.buffer); }
  cstr(ptr) { const u = new Uint8Array(this.mem.buffer); let e = ptr; while (u[e]) e++; return dec.decode(u.subarray(ptr, e)); }
  allocStr(s) { const b = enc.encode(s); const p = this.x.ygo_malloc(b.length + 1); const u = new Uint8Array(this.mem.buffer); u.set(b, p); u[p + b.length] = 0; return [p, b.length]; }

  // ---- callbacks ----
  _readCard(code, p, setPtr, maxSet) {
    const c = this.cardDB(code);
    const v = this.view();
    v.setUint32(p + 0, code, true);
    if (!c) return;
    v.setUint32(p + 4, c.alias || 0, true);
    // setcodes: hasta 4 de 16 bits empaquetados en un entero de 64 bits
    let sc = BigInt(c.setcode || 0); let n = 0;
    while (sc > 0n && n < maxSet) { const s = Number(sc & 0xffffn); if (s) v.setUint16(setPtr + 2 * n++, s, true); sc >>= 16n; }
    v.setUint32(p + 12, c.type >>> 0, true);
    v.setUint32(p + 16, c.level & 0xff, true);
    v.setUint32(p + 20, c.attribute >>> 0, true);
    v.setBigUint64(p + 24, BigInt(c.race || 0), true);
    v.setInt32(p + 32, c.atk, true);
    const isLink = (c.type & 0x4000000) !== 0;
    v.setInt32(p + 36, isLink ? 0 : c.def, true);
    v.setUint32(p + 40, (c.level >>> 24) & 0xff, true);
    v.setUint32(p + 44, (c.level >>> 16) & 0xff, true);
    v.setUint32(p + 48, isLink ? c.def : 0, true);
  }
  _readScript(duelPtr, namePtr) {
    const name = this.cstr(namePtr);
    const src = this.scriptSource(name);
    if (src == null) { if (this.verbose) console.warn("script no encontrado:", name); return 0; }
    const [bp, bl] = this.allocStr(src); const [np] = this.allocStr(name);
    const r = this.x.ygo_load_script(duelPtr, bp, bl, np);
    this.x.ygo_free(bp); this.x.ygo_free(np);
    return r;
  }
  _log(strPtr, type) { const s = this.cstr(strPtr); (this.onLog || ((t, m) => console.warn("[ocg log " + t + "]", m)))(type, s); }

  /**
   * Crea un duelo.
   * @param {{cardDB:(code:number)=>any, scriptSource:(name:string)=>string|null, seed?:number[], mode?:bigint,
   *   lp?:[number,number], startDraw?:number, drawPerTurn?:number}} o
   */
  createDuel(o) {
    this.cardDB = o.cardDB; this.scriptSource = o.scriptSource;
    const seed = o.seed || [1, 2, 3, 4].map(() => (Math.random() * 2 ** 32) >>> 0);
    const mode = o.mode ?? OcgDuelMode.MODE_MR5;
    const lp = o.lp || [8000, 8000];
    const ptr = this.x.ygo_create_duel(seed[0], seed[1], seed[2], seed[3], Number(mode & 0xffffffffn), Number(mode >> 32n),
      lp[0], lp[1], o.startDraw ?? 5, o.drawPerTurn ?? 1);
    if (!ptr) throw new Error("No se pudo crear el duelo (estado " + this.x.ygo_last_len() + ")");
    return new Duel(this, ptr);
  }
}

export class Duel {
  constructor(core, ptr) { this.core = core; this.ptr = ptr; }
  /** Carga un script global (constant.lua / utility.lua). */
  loadScript(name) {
    const src = this.core.scriptSource(name); if (src == null) throw new Error("falta " + name);
    const c = this.core; const [bp, bl] = c.allocStr(src); const [np] = c.allocStr(name);
    const r = c.x.ygo_load_script(this.ptr, bp, bl, np); c.x.ygo_free(bp); c.x.ygo_free(np); return r === 1;
  }
  newCard({ team, duelist = 0, code, controller, location, sequence = 0, position }) {
    this.core.x.ygo_new_card(this.ptr, team, duelist, code, controller ?? team, location, sequence, position);
  }
  start() { this.core.x.ygo_start_duel(this.ptr); }
  /** @returns {0|1|2} 0=fin, 1=esperando respuesta, 2=continuar */
  process() { return this.core.x.ygo_process(this.ptr); }
  messages() {
    const c = this.core; const p = c.x.ygo_get_message(this.ptr); const len = c.x.ygo_last_len();
    const r = new BufferReader(new DataView(c.mem.buffer, p, len)); const out = [];
    while (r.avail > 0) {
      const l = r.i32(); const sub = r.sub(l);
      let m = null; try { m = readMessage(sub); } catch (e) { m = null; }
      if (m) out.push(m); else { sub.reset(); out.push({ type: -1, raw: sub.u8() }); }
    }
    return out;
  }
  respond(response) {
    const b = createResponse(response); const c = this.core;
    const p = c.x.ygo_malloc(b.length); new Uint8Array(c.mem.buffer).set(b, p);
    c.x.ygo_set_response(this.ptr, p, b.length); c.x.ygo_free(p);
  }
  queryLocation(controller, location, flags) {
    const c = this.core; const p = c.x.ygo_query_location(this.ptr, flags, controller, location); const len = c.x.ygo_last_len();
    return readQueryLocation(new BufferReader(new DataView(c.mem.buffer, p, len)));
  }
  query(controller, location, sequence, flags) {
    const c = this.core; const p = c.x.ygo_query(this.ptr, flags, controller, location, sequence, 0); const len = c.x.ygo_last_len();
    return readQuery(new BufferReader(new DataView(c.mem.buffer, p, len)));
  }
  field() {
    const c = this.core; const p = c.x.ygo_query_field(this.ptr); const len = c.x.ygo_last_len();
    return readField(new BufferReader(new DataView(c.mem.buffer, p, len)));
  }
  count(team, location) { return this.core.x.ygo_query_count(this.ptr, team, location); }
  destroy() { this.core.x.ygo_destroy_duel(this.ptr); this.ptr = 0; }
}
