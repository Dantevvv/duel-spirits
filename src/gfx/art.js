// Arte original generado por código, en alta resolución y con trazos suaves (sin pixel art).
// El mundo sigue en una grilla de 16 unidades por casilla; las texturas se dibujan S veces más grandes
// y se muestran reducidas. El suelo de cada mapa es una sola imagen pintada entera, y lo que tiene
// altura (árboles, cercas, carteles, hierba alta) va aparte para ordenarse con los personajes.

export const TILE = 16;
export const S = 4;                 // píxeles de textura por unidad de mundo
const T = TILE * S;                 // tamaño de una casilla en la textura
export const CHAR_W = 16, CHAR_H = 24; // tamaño de un personaje en unidades de mundo

const C = {
  ink: "#1c2233", grass: "#74c365", grassL: "#8fd67a", grassD: "#5aa850", tall: "#3f9146", tallL: "#62b85a", tallD: "#2c7438",
  path: "#ecd9a6", pathD: "#cdb37a", pathL: "#f7ecc8", water: "#3f97e6", waterL: "#8fd0ff", waterD: "#2a6fc0", sand: "#e6d7a0",
  trunk: "#8a5a34", trunkD: "#5e3a1e", leaf: "#3d9a4a", leafL: "#63c064", leafD: "#236b34",
  wood: "#c4905a", woodD: "#93643a", woodL: "#dcb080", wall: "#f3ead6", wallD: "#d9ccb0", floor: "#d8a86c", floorD: "#bd8a50", floorL: "#e8bf86",
  paper: "#e9e2d2", paperD: "#cfc6b2", slab: "#2b3148", slabL: "#414a69", glass: "#9fdcff", glassD: "#5aa9e6",
};

function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
// Ruido determinista para repartir detalles
function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function shade(hex, k) { // k < 0 oscurece, k > 0 aclara
  const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function rr(g, x, y, w, h, r, fill, stroke, lw = 3) {
  g.beginPath(); g.roundRect(x, y, w, h, r);
  if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}
function oval(g, x, y, rx, ry, fill, stroke, lw = 3) {
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}
function vgrad(g, y0, y1, a, b) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; }
function softShadow(g, x, y, rx, ry, a = 0.28) { const gr = g.createRadialGradient(x, y, 0, x, y, rx); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, "rgba(0,0,0,0)"); g.save(); g.translate(0, y); g.scale(1, ry / rx); g.translate(0, -y); g.fillStyle = gr; g.fillRect(x - rx, y - rx, rx * 2, rx * 2); g.restore(); }

// ---------------- Suelo del mapa ----------------
/** Rellena la unión de las casillas marcadas con esquinas redondeadas hacia afuera (caminos, agua, mesas). */
function blob(g, is, w, h, grow, r, fill) {
  g.fillStyle = fill; g.beginPath();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (is(x, y)) {
    const n = is(x, y - 1), s = is(x, y + 1), e = is(x + 1, y), o = is(x - 1, y);
    const x0 = x * T - (o ? 0 : grow), y0 = y * T - (n ? 0 : grow), x1 = (x + 1) * T + (e ? 0 : grow), y1 = (y + 1) * T + (s ? 0 : grow);
    g.roundRect(x0, y0, x1 - x0, y1 - y0, [!n && !o ? r : 0, !n && !e ? r : 0, !s && !e ? r : 0, !s && !o ? r : 0]);
  }
  g.fill();
}

const FLAT = new Set(["grass", "grass2", "path", "flowers", "water", "ledge", "tall"]);
const FURNITURE = {
  rug(g, x, y) { rr(g, x + 6, y + 10, T - 12, T - 20, 8, "#b8443e", "#7c2622"); rr(g, x + 12, y + 16, T - 24, T - 32, 5, null, "#f2c75a", 2.5); },
  doormat(g, x, y) { rr(g, x + 4, y + 16, T - 8, T - 26, 6, "#7f9a5c", "#4f6638"); for (let i = 0; i < 4; i++) rr(g, x + 12 + i * 11, y + 22, 5, T - 38, 2, "#a3bd7c"); },
  stairsup(g, x, y) { rr(g, x + 4, y + 2, T - 8, T - 4, 4, C.slab); for (let i = 0; i < 5; i++) rr(g, x + 7, y + 5 + i * 12, T - 14, 9, 2, shade(C.wall, -0.1 * (4 - i))); },
  stairsdown(g, x, y) { rr(g, x + 4, y + 2, T - 8, T - 4, 4, "#10131f"); for (let i = 0; i < 5; i++) rr(g, x + 7, y + 5 + i * 12, T - 14, 9, 2, shade(C.woodD, -0.14 * i)); },
  bed(g, x, y, up) {
    softShadow(g, x + T / 2, y + T - 4, T * 0.55, 10);
    rr(g, x + 5, y + (up ? 0 : 4), T - 10, T - (up ? 2 : 6), up ? [0, 0, 8, 8] : [8, 8, 0, 0], "#5d8fe0", "#2f4f96");
    if (!up) { rr(g, x + 5, y + 4, T - 10, 22, [8, 8, 0, 0], C.wall, "#2f4f96"); rr(g, x + 14, y + 9, T - 28, 13, 6, "#fff", C.paperD, 2); }
    else rr(g, x + 5, y + T - 20, T - 10, 12, 0, "#7fa9ee");
  },
  pc(g, x, y) { softShadow(g, x + T / 2, y + T - 6, 30, 8); rr(g, x + 6, y + 30, T - 12, 28, 5, C.woodD, C.trunkD); rr(g, x + 12, y - 6, T - 24, 36, 5, "#39415a", C.ink); rr(g, x + 16, y - 2, T - 32, 26, 3, vgrad(g, y - 2, y + 24, "#7ff0d0", "#2f9fb0")); rr(g, x + 20, y + 40, T - 40, 8, 3, "#dfe5f2"); },
  tv(g, x, y) { softShadow(g, x + T / 2, y + T - 6, 30, 8); rr(g, x + 8, y + 34, T - 16, 24, 5, C.woodD, C.trunkD); rr(g, x + 6, y - 4, T - 12, 38, 6, "#20263a", C.ink); rr(g, x + 11, y + 1, T - 22, 28, 3, vgrad(g, y, y + 28, "#9fe0ff", "#3f7fd0")); g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.moveTo(x + 14, y + 4); g.lineTo(x + 30, y + 4); g.lineTo(x + 18, y + 26); g.lineTo(x + 14, y + 26); g.fill(); },
  shelf(g, x, y) {
    softShadow(g, x + T / 2, y + T - 4, 34, 8); rr(g, x + 3, y - 18, T - 6, T + 14, 4, C.woodD, C.trunkD);
    for (let r = 0; r < 3; r++) { const sy = y - 13 + r * 25; rr(g, x + 7, sy, T - 14, 20, 2, "#3a2616"); for (let i = 0; i < 6; i++) rr(g, x + 9 + i * 8, sy + 3 + (hash(x + i, y + r, 7) * 4 | 0), 6, 17, 1, ["#d85050", "#4f7fe0", "#e8c84a", "#58b060", "#b060d0", "#e88a3a"][(i + r * 2 + (x / T | 0)) % 6]); }
  },
  plant(g, x, y) { softShadow(g, x + T / 2, y + T - 6, 22, 7); rr(g, x + 20, y + 34, 24, 24, [3, 3, 8, 8], "#c8683e", "#7c3a1e"); for (const [dx, dy, r, c] of [[0, 10, 20, C.leafD], [-10, 18, 14, C.leaf], [11, 16, 15, C.leaf], [0, 2, 14, C.leafL]]) oval(g, x + T / 2 + dx, y + dy + 8, r, r * 0.9, c); },
  display(g, x, y, v) {
    softShadow(g, x + T / 2, y + T - 4, 34, 8); rr(g, x + 3, y + 4, T - 6, T - 8, 5, C.woodD, C.trunkD); rr(g, x + 7, y + 8, T - 14, T - 26, 3, vgrad(g, y + 8, y + T - 18, "#d8f2ff", "#8fc8ee"));
    for (let i = 0; i < 3; i++) { const cx = x + 11 + i * 15; rr(g, cx, y + 13, 12, 17, 2, ["#e8a040", "#a060d8", "#40a8e8"][(i + v) % 3], "#fff", 1.5); }
    g.fillStyle = "rgba(255,255,255,.45)"; g.beginPath(); g.moveTo(x + 9, y + 10); g.lineTo(x + 24, y + 10); g.lineTo(x + 12, y + 44); g.lineTo(x + 9, y + 44); g.fill();
  },
};

/** Pinta el suelo completo de un mapa y devuelve qué objetos con altura hay que colocar encima. */
export function paintMap(scene, id, map, LEGEND) {
  const key = "g_" + id; const h = map.rows.length, w = map.rows[0].length;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : LEGEND[map.rows[y][x]] || "grass");
  const is = (...names) => (x, y) => names.includes(at(x, y));
  const props = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = at(x, y); if (["tree", "fence", "sign", "tall"].includes(n)) props.push({ key: "p_" + n + (n === "tree" ? "_" + ((x * 7 + y * 3) % 3) : ""), x, y, name: n }); }
  if (scene.textures.exists(key)) return { key, props };
  const [c, g] = canvas(w * T, h * T);

  if (!map.indoor) {
    // Pasto: base con manchas suaves y briznas
    g.fillStyle = C.grass; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < w * h * 1.2; i++) { const x = hash(i, 1, 11) * c.width, y = hash(i, 2, 11) * c.height, r = 30 + hash(i, 3, 11) * 60; const gr = g.createRadialGradient(x, y, 0, x, y, r); const light = hash(i, 4, 11) > 0.5; gr.addColorStop(0, light ? "rgba(160,230,130,.35)" : "rgba(60,140,70,.28)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.lineCap = "round"; g.lineWidth = 2.5;
    for (let i = 0; i < w * h * 5; i++) { const x = hash(i, 5, 12) * c.width, y = hash(i, 6, 12) * c.height; g.strokeStyle = hash(i, 7, 12) > 0.5 ? "rgba(140,220,120,.6)" : "rgba(70,150,80,.5)"; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y - 7); g.moveTo(x + 5, y); g.lineTo(x + 6, y - 5); g.stroke(); }
    // Matas y flores
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = at(x, y);
      if (n === "grass2") for (let i = 0; i < 3; i++) { const px = x * T + 12 + hash(x, y, i) * 40, py = y * T + 20 + hash(y, x, i) * 34; g.strokeStyle = C.grassD; g.lineWidth = 3; g.beginPath(); for (const d of [-7, -2, 4, 9]) { g.moveTo(px, py); g.quadraticCurveTo(px + d * 0.5, py - 8, px + d, py - 13); } g.stroke(); }
      if (n === "flowers") for (let i = 0; i < 5; i++) { const px = x * T + 9 + hash(x, y, i + 20) * 46, py = y * T + 9 + hash(y, x, i + 20) * 46; const col = ["#ff6a7a", "#ffd84a", "#ffffff", "#c58aff"][(x + y + i) % 4]; for (let p = 0; p < 5; p++) oval(g, px + Math.cos(p * 1.257) * 4.5, py + Math.sin(p * 1.257) * 4.5, 3.6, 3.6, col); oval(g, px, py, 2.6, 2.6, "#f0a020"); }
    }
    // Hierba alta: mancha más oscura debajo de las matas
    blob(g, is("tall"), w, h, 5, 20, C.tallD); blob(g, is("tall"), w, h, 1, 18, C.tall);
    // Camino de tierra con borde
    blob(g, is("path"), w, h, 5, 24, C.pathD); blob(g, is("path"), w, h, 0, 22, C.path);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y) === "path") for (let i = 0; i < 4; i++) oval(g, x * T + 6 + hash(x, y, i + 30) * 52, y * T + 6 + hash(y, x, i + 30) * 52, 2 + hash(x, y, i + 40) * 3, 1.6 + hash(x, y, i + 41) * 2, i % 2 ? C.pathD : C.pathL);
    // Agua con orilla
    blob(g, is("water"), w, h, 7, 26, C.sand); blob(g, is("water"), w, h, 1, 22, C.waterD); blob(g, is("water"), w, h, -4, 18, C.water);
    g.lineWidth = 3;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y) === "water") for (let i = 0; i < 2; i++) { const px = x * T + 8 + hash(x, y, i + 50) * 34, py = y * T + 16 + i * 26; g.strokeStyle = "rgba(190,235,255,.7)"; g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + 8, py - 4, px + 16, py); g.stroke(); }
    // Salientes: escalón de tierra con sombra
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y) === "ledge") { g.fillStyle = vgrad(g, y * T + 26, y * T + 56, "#b98a4c", "#7f5a2c"); g.fillRect(x * T, y * T + 28, T, 26); g.fillStyle = C.grassL; g.fillRect(x * T, y * T + 22, T, 8); g.fillStyle = "rgba(0,0,0,.22)"; g.fillRect(x * T, y * T + 54, T, 8); }
    // Sombras de árboles, carteles y edificios
    for (const p of props) if (p.name === "tree") softShadow(g, p.x * T + T / 2 + 6, p.y * T + T - 8, 40, 16, 0.3); else if (p.name === "sign") softShadow(g, p.x * T + T / 2, p.y * T + T - 6, 22, 7);
    for (const b of map.buildings || []) { g.fillStyle = "rgba(0,0,0,.22)"; g.beginPath(); g.roundRect(b.x * T + 10, (b.y + b.h) * T - 14, b.w * T + 4, 26, 12); g.fill(); }
  } else {
    g.fillStyle = "#0b0d16"; g.fillRect(0, 0, c.width, c.height);
    const solid = (x, y) => { const n = at(x, y); return n && n !== "dark" && n !== "wall" && n !== "window"; };
    // Piso de madera
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (solid(x, y)) {
      g.fillStyle = C.floor; g.fillRect(x * T, y * T, T, T);
      for (let r = 0; r < 4; r++) { g.fillStyle = hash(x, y * 4 + r, 60) > 0.5 ? "rgba(255,230,180,.16)" : "rgba(120,70,20,.1)"; g.fillRect(x * T, y * T + r * 16, T, 16); g.fillStyle = "rgba(90,50,20,.35)"; g.fillRect(x * T, y * T + r * 16, T, 1.5); const jx = x * T + ((hash(y * 4 + r, 0, 61) * 3 | 0) * 24 + (x % 2) * 12) % T; g.fillRect(jx, y * T + r * 16, 1.5, 16); }
    }
    // Paredes: de frente si tienen piso debajo; si no, se ven desde arriba
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = at(x, y); if (n !== "wall" && n !== "window") continue;
      if (solid(x, y + 1)) {
        g.fillStyle = vgrad(g, y * T, y * T + T, C.paper, C.paperD); g.fillRect(x * T, y * T, T, T);
        g.fillStyle = "rgba(170,150,120,.25)"; for (let i = 0; i < 4; i++) g.fillRect(x * T + 6 + i * 16, y * T, 3, T - 12);
        g.fillStyle = C.woodD; g.fillRect(x * T, y * T + T - 12, T, 12); g.fillStyle = C.woodL; g.fillRect(x * T, y * T + T - 12, T, 3); g.fillStyle = C.slab; g.fillRect(x * T, y * T, T, 6);
        if (n === "window") { rr(g, x * T + 9, y * T + 10, T - 18, T - 30, 5, vgrad(g, y * T + 10, y * T + T - 20, "#bfe9ff", "#6fb6ec"), "#fff", 4); g.fillStyle = "#fff"; g.fillRect(x * T + T / 2 - 1.5, y * T + 10, 3, T - 30); g.fillStyle = "rgba(255,255,255,.5)"; g.beginPath(); g.moveTo(x * T + 13, y * T + 14); g.lineTo(x * T + 24, y * T + 14); g.lineTo(x * T + 15, y * T + 38); g.lineTo(x * T + 13, y * T + 38); g.fill(); }
      } else { g.fillStyle = C.slab; g.fillRect(x * T, y * T, T, T); g.fillStyle = C.slabL; g.fillRect(x * T, y * T, T, 5); }
    }
    // Sombra de la pared sobre el piso
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (solid(x, y) && !solid(x, y - 1)) { g.fillStyle = vgrad(g, y * T, y * T + 18, "rgba(0,0,0,.28)", "rgba(0,0,0,0)"); g.fillRect(x * T, y * T, T, 18); }
    // Mesas y mostradores: una sola pieza por grupo de casillas
    for (const [name, top, side] of [["table", C.woodL, C.woodD], ["counter", "#e9e2d2", "#8a6a4a"]]) {
      g.save(); g.translate(0, 10); blob(g, is(name), w, h, -3, 10, "rgba(0,0,0,.25)"); g.restore();
      blob(g, is(name), w, h, -3, 10, side); g.save(); g.translate(0, -10); blob(g, is(name), w, h, -3, 10, C.ink); blob(g, is(name), w, h, -6, 8, top); g.restore();
    }
    // Muebles
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = at(x, y); if (FURNITURE[n]) FURNITURE[n](g, x * T, y * T, n === "bed" ? at(x, y - 1) === "bed" : (x * 7 + y * 3) % 4); }
  }
  scene.textures.addCanvas(key, c);
  return { key, props };
}

// ---------------- Objetos con altura ----------------
function buildProps(scene) {
  // Árboles (3 variantes): 1,5 casillas de ancho por 2 de alto, apoyados en la base de su casilla
  for (let v = 0; v < 3; v++) {
    const [c, g] = canvas(T * 1.5, T * 2); const cx = c.width / 2;
    rr(g, cx - 8, 78, 16, 44, 6, vgrad(g, 78, 122, C.trunk, C.trunkD), C.trunkD, 2.5);
    const blobs = [[0, 70, 38], [-22, 58, 26], [22, 60, 27], [-10, 38, 27], [14, 36, 26], [0, 22 + v * 3, 22]];
    for (const [dx, y, r] of blobs) oval(g, cx + dx, y, r, r * 0.92, C.leafD);
    for (const [dx, y, r] of blobs) oval(g, cx + dx - 2, y - 4, r - 5, (r - 5) * 0.9, C.leaf);
    for (const [dx, y, r] of blobs.slice(2)) oval(g, cx + dx - 6, y - 9, r * 0.45, r * 0.38, C.leafL);
    if (v === 1) for (const [dx, y] of [[-16, 50], [12, 34], [20, 66]]) oval(g, cx + dx, y, 4, 4, "#ff6a5a", "#a02a20", 1.5);
    scene.textures.addCanvas("p_tree_" + v, c);
  }
  { // Cerca
    const [c, g] = canvas(T, T * 1.25);
    for (const y of [34, 52]) rr(g, -4, y, T + 8, 9, 3, vgrad(g, y, y + 9, "#fffaf0", "#d6cdbc"), "#9a917f", 2);
    for (const x of [8, 40]) rr(g, x, 16, 14, 56, [7, 7, 2, 2], vgrad(g, 16, 72, "#fffaf0", "#cfc5b2"), "#9a917f", 2);
    scene.textures.addCanvas("p_fence", c);
  }
  { // Cartel
    const [c, g] = canvas(T, T * 1.25);
    rr(g, 28, 40, 8, 36, 2, C.trunk, C.trunkD, 2); rr(g, 6, 14, 52, 34, 5, vgrad(g, 14, 48, C.woodL, C.wood), C.trunkD, 2.5);
    g.fillStyle = C.trunkD; for (const y of [23, 30, 37]) g.fillRect(14, y, y === 37 ? 24 : 36, 3);
    scene.textures.addCanvas("p_sign", c);
  }
  { // Hierba alta: matas que tapan los pies
    const [c, g] = canvas(T, T);
    for (let i = 0; i < 9; i++) { const x = 5 + (i % 5) * 13 + (i > 4 ? 6 : 0), y = i > 4 ? 62 : 44, hh = 26 + hash(i, 0, 70) * 10; g.fillStyle = i % 2 ? C.tallL : C.tall; g.strokeStyle = C.tallD; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x - 7, y); g.quadraticCurveTo(x - 6, y - hh * 0.6, x - 2 + (i % 3 - 1) * 4, y - hh); g.quadraticCurveTo(x + 4, y - hh * 0.5, x + 7, y); g.closePath(); g.fill(); g.stroke(); }
    scene.textures.addCanvas("p_tall", c);
  }
}

// ---------------- Personajes ----------------
// Figuras de 64x96 por cuadro. dir: 0 abajo, 1 arriba, 2 lado (derecha). frame: 0 quieto, 1 y 2 caminando.
function drawCharFrame(g, ox, oy, dir, frame, p) {
  g.save(); g.translate(ox, oy);
  const line = (col) => shade(col, -0.45); const bob = frame ? 2 : 0;
  const lift = [frame === 1 ? 6 : 0, frame === 2 ? 6 : 0]; const swing = frame === 1 ? 4 : frame === 2 ? -4 : 0;
  const side = dir === 2;
  // Piernas y zapatos
  const legs = side ? [[25 - swing, 0], [31 + swing, 1]] : [[21, 0], [33, 1]];
  for (const [x, i] of legs) { rr(g, x, 66, 10, 22 - lift[i], 4, i && side ? shade(p.pants, -0.15) : p.pants, line(p.pants), 2.5); rr(g, x - 1 + (side ? 2 : 0), 85 - lift[i], side ? 14 : 12, 8, 4, p.shoes, line(p.shoes), 2.5); }
  // Brazo de atrás (de costado)
  if (side) rr(g, 28 + swing * 1.5, 46 + bob, 9, 22, 4.5, shade(p.shirtB || p.shirt, -0.15), line(p.shirt), 2.5);
  // Torso
  const bw = side ? 20 : 26, bx = 32 - bw / 2;
  if (p.dress) { g.beginPath(); g.moveTo(bx + 2, 44 + bob); g.lineTo(bx + bw - 2, 44 + bob); g.lineTo(bx + bw + 5, 78); g.lineTo(bx - 5, 78); g.closePath(); g.fillStyle = vgrad(g, 44, 78, p.shirt, p.shirtB || p.shirt); g.fill(); g.strokeStyle = line(p.shirt); g.lineWidth = 2.5; g.lineJoin = "round"; g.stroke(); }
  else { rr(g, bx, 43 + bob, bw, 28, 7, vgrad(g, 43, 71, p.shirt, p.shirtB || p.shirt), line(p.shirt), 2.5); if (p.belt) rr(g, bx + 1, 65 + bob, bw - 2, 5, 2, p.belt); }
  // Brazos y manos
  const arm = (x, dy) => { rr(g, x, 45 + bob + dy, 9, 21, 4.5, p.shirtB || p.shirt, line(p.shirt), 2.5); oval(g, x + 4.5, 68 + bob + dy, 4.5, 4.5, p.skin, line(p.skin), 2); };
  if (side) arm(27 - swing * 1.5, 0); else { arm(bx - 7, frame === 1 ? -3 : 0); arm(bx + bw - 2, frame === 2 ? -3 : 0); }
  // Cabeza
  const hy = 26 + bob, hx = 32 + (side ? 2 : 0), R = 18;
  if (p.hairStyle === "long" && dir !== 1) rr(g, hx - R - 2, hy - 6, R * 2 + 4 - (side ? 12 : 0), 34, 10, p.hair, line(p.hair), 2.5);
  oval(g, hx, hy, R, R - 1, p.skin, line(p.skin), 2.5);
  if (dir === 0) {
    for (const ex of [-7, 7]) { oval(g, hx + ex, hy + 3, 3, 4.2, "#1c2233"); oval(g, hx + ex + 1, hy + 1.5, 1.2, 1.4, "#fff"); }
    oval(g, hx - 11, hy + 8, 3.2, 2, "rgba(255,120,120,.4)"); oval(g, hx + 11, hy + 8, 3.2, 2, "rgba(255,120,120,.4)");
    g.strokeStyle = "#7a3a2a"; g.lineWidth = 1.8; g.lineCap = "round"; g.beginPath(); g.arc(hx, hy + 9, 3, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    if (p.beard) { g.beginPath(); g.arc(hx, hy + 5, R - 3, 0.05 * Math.PI, 0.95 * Math.PI); g.quadraticCurveTo(hx, hy + 8, hx + R - 3.4, hy + 7.6); g.fillStyle = p.beard; g.fill(); }
    if (p.glasses) { g.strokeStyle = p.glasses; g.lineWidth = 2.2; for (const ex of [-7, 7]) { g.beginPath(); g.arc(hx + ex, hy + 3, 5.5, 0, Math.PI * 2); g.stroke(); } g.beginPath(); g.moveTo(hx - 1.5, hy + 3); g.lineTo(hx + 1.5, hy + 3); g.stroke(); }
  } else if (side) {
    oval(g, hx + 9, hy + 3, 2.6, 4, "#1c2233"); oval(g, hx + 9.8, hy + 1.6, 1, 1.3, "#fff");
    if (p.beard) { g.beginPath(); g.arc(hx + 3, hy + 6, R - 6, 0, 0.8 * Math.PI); g.fillStyle = p.beard; g.fill(); }
    if (p.glasses) { g.strokeStyle = p.glasses; g.lineWidth = 2.2; g.beginPath(); g.arc(hx + 9, hy + 3, 5.5, 0, Math.PI * 2); g.moveTo(hx + 3.5, hy + 3); g.lineTo(hx - 8, hy + 1); g.stroke(); }
  }
  // Pelo, gorra o calva
  const hair = p.hair, hl = line(hair);
  g.lineJoin = "round"; g.lineWidth = 2.5;
  const cap = (from, to, drop) => { g.beginPath(); g.arc(hx, hy, R + 1, from, to); if (drop != null) g.quadraticCurveTo(hx, hy + drop, hx + Math.cos(from) * (R + 1), hy + Math.sin(from) * (R + 1)); g.closePath(); };
  if (p.hairStyle === "bald") {
    g.fillStyle = hair; if (dir === 1) { cap(0.05 * Math.PI, 0.95 * Math.PI, -2); g.fill(); } else if (!side) { for (const s of [-1, 1]) oval(g, hx + s * (R - 1), hy + 1, 4, 8, hair); } else oval(g, hx - R + 3, hy + 2, 5, 9, hair);
    oval(g, hx - 5, hy - 10, 5, 2.5, "rgba(255,255,255,.35)");
  } else {
    if (dir === 1) { oval(g, hx, hy, R + 1, R, hair, hl); }
    else if (side) { cap(0.75 * Math.PI, 1.9 * Math.PI, -4); g.fillStyle = hair; g.fill(); g.strokeStyle = hl; g.stroke(); oval(g, hx - 8, hy + 2, 11, 15, hair); }
    else { cap(Math.PI * 0.98, Math.PI * 2.02, -7); g.fillStyle = hair; g.fill(); g.strokeStyle = hl; g.stroke(); }
    if (p.hairStyle === "spiky") { g.fillStyle = hair; g.strokeStyle = hl; for (const [a, len] of [[-2.5, 13], [-2.0, 16], [-1.57, 18], [-1.1, 16], [-0.6, 13]]) { const bx0 = hx + Math.cos(a) * (R - 3), by0 = hy + Math.sin(a) * (R - 3); g.beginPath(); g.moveTo(bx0 - 6, by0 + 3); g.lineTo(hx + Math.cos(a) * (R + len), hy + Math.sin(a) * (R + len)); g.lineTo(bx0 + 6, by0 + 3); g.closePath(); g.fill(); g.stroke(); } oval(g, hx, hy - 9, R - 3, 8, hair); if (dir === 0) { g.beginPath(); g.moveTo(hx - 12, hy - 8); g.lineTo(hx - 6, hy - 1); g.lineTo(hx - 1, hy - 8); g.lineTo(hx + 5, hy - 2); g.lineTo(hx + 12, hy - 8); g.closePath(); g.fill(); } }
    if (p.hairStyle === "long" && dir === 1) rr(g, hx - R - 2, hy - 4, R * 2 + 4, 34, 10, hair, hl, 2.5);
    if (p.hairStyle === "cap") { cap(Math.PI, Math.PI * 2, -3); g.fillStyle = p.cap; g.fill(); g.strokeStyle = line(p.cap); g.stroke(); if (dir === 0) rr(g, hx - 15, hy - 6, 30, 7, 3.5, p.capB || p.cap, line(p.cap), 2); if (side) rr(g, hx + 4, hy - 6, 22, 6, 3, p.capB || p.cap, line(p.cap), 2); }
    if (p.hairStyle === "bandana") { g.fillStyle = p.cap; g.fillRect(hx - R, hy - 9, R * 2, 6); }
    oval(g, hx - 6, hy - 12, 6, 3, "rgba(255,255,255,.22)");
  }
  g.restore();
}

export const CHARACTERS = {
  player: { skin: "#f6c99a", hair: "#4a3020", hairStyle: "spiky", shirt: "#3a6ae0", shirtB: "#274aa8", belt: "#1c2233", pants: "#3a3f54", shoes: "#d84040" },
  rival: { skin: "#f6c99a", hair: "#8a5ad0", hairStyle: "spiky", shirt: "#eef0f6", shirtB: "#c2c6d6", pants: "#2a2e3e", shoes: "#2a2e3e" },
  mom: { skin: "#f6c99a", hair: "#c06a3a", hairStyle: "long", shirt: "#ee86a4", shirtB: "#c85a7c", dress: true, pants: "#f6c99a", shoes: "#7a4a3a" },
  shopkeeper: { skin: "#eabb8a", hair: "#d8d8d8", hairStyle: "bald", beard: "#f0f0f0", glasses: "#2a2e3e", shirt: "#4f9a66", shirtB: "#37744a", belt: "#6a4a2a", pants: "#6f5f4f", shoes: "#3a2a20" },
  rivalmom: { skin: "#f6c99a", hair: "#3a2a5a", hairStyle: "long", shirt: "#74aede", shirtB: "#4a84b8", dress: true, pants: "#f6c99a", shoes: "#3a3a48" },
  bugkid: { skin: "#f0c090", hair: "#3a2a1a", hairStyle: "cap", cap: "#ecc840", capB: "#c09a20", shirt: "#ecc840", shirtB: "#c0a020", pants: "#4f7240", shoes: "#5a3a2a" },
  worker: { skin: "#e0b080", hair: "#3a3a3a", hairStyle: "cap", cap: "#f6902a", capB: "#c86c10", shirt: "#f6902a", shirtB: "#c86c10", belt: "#3a3a3a", pants: "#3f5078", shoes: "#3a2a20" },
  oldman: { skin: "#eabb8a", hair: "#bbbbbb", hairStyle: "bald", beard: "#d8d8d8", shirt: "#94724e", shirtB: "#6e5030", pants: "#4c4c54", shoes: "#2a2a2a" },
  girl: { skin: "#f6c99a", hair: "#f2d264", hairStyle: "long", shirt: "#62c8a6", shirtB: "#40a080", dress: true, pants: "#f6c99a", shoes: "#c84a4a" },
  // Figuras genéricas (D-12): solo colores, ningún diseño de la serie.
  hiker: { skin: "#d8a070", hair: "#5a3a1a", hairStyle: "bandana", cap: "#8a5a2a", shirt: "#a0703a", shirtB: "#7a5028", belt: "#3a2a1a", pants: "#5a6a3a", shoes: "#3a2a20" },
  swordsman: { skin: "#f0c090", hair: "#202838", hairStyle: "spiky", shirt: "#c8ccd8", shirtB: "#9aa0b4", belt: "#7a3a2a", pants: "#3a4060", shoes: "#2a2a2a" },
  occultist: { skin: "#e8d0c0", hair: "#3a1a4a", hairStyle: "long", shirt: "#4a2a6a", shirtB: "#2e1a46", dress: true, pants: "#e8d0c0", shoes: "#1a1a22" },
  chumley: { skin: "#f0c090", hair: "#7a5a3a", hairStyle: "spiky", shirt: "#e8c040", shirtB: "#c09a20", belt: "#3a3a3a", pants: "#3a3f54", shoes: "#5a3a2a" },
  dinofan: { skin: "#e8b888", hair: "#a03a2a", hairStyle: "cap", cap: "#3a8a4a", capB: "#2a6a38", shirt: "#d05a3a", shirtB: "#a8402a", pants: "#3a3a48", shoes: "#2a2a2a" },
  sailor: { skin: "#d89a68", hair: "#2a2a3a", hairStyle: "bandana", cap: "#3a6ad0", shirt: "#f0f0f0", shirtB: "#c0c6d6", belt: "#3a6ad0", pants: "#2a4a8a", shoes: "#2a2a2a" },
  bugleader: { skin: "#f0d0b0", hair: "#3a6a3a", hairStyle: "spiky", glasses: "#2a2e3e", shirt: "#6aa040", shirtB: "#4a7a2a", belt: "#2a3a2a", pants: "#e8e0c8", shoes: "#3a3a2a" },
  clerk: { skin: "#f6c99a", hair: "#e07090", hairStyle: "long", shirt: "#f4f4f8", shirtB: "#d0d4e0", dress: true, pants: "#f6c99a", shoes: "#e07090" },
  duelist: { skin: "#f0c8a0", hair: "#2a2030", hairStyle: "spiky", shirt: "#2a2a3a", shirtB: "#1a1a26", belt: "#c8a040", pants: "#2a2a3a", shoes: "#1a1a1a" },
};

/** Registra todas las texturas en Phaser. */
export function buildTextures(scene) {
  buildProps(scene);
  // Personajes: hoja de 12 cuadros (abajo x3, arriba x3, derecha x3, izquierda x3)
  for (const [key, pal] of Object.entries(CHARACTERS)) addCharacter(scene, key, pal);
  // Emote "!"
  { const [c, g] = canvas(T, T); g.beginPath(); g.moveTo(26, 52); g.lineTo(32, 62); g.lineTo(38, 52); g.closePath(); g.fillStyle = "#fff"; g.fill(); rr(g, 12, 4, 40, 50, 12, "#fff", C.ink, 3); rr(g, 28, 12, 8, 22, 4, "#e03a3a"); oval(g, 32, 43, 4.5, 4.5, "#e03a3a"); scene.textures.addCanvas("emote_alert", c); }
  // Cajas de baraja (decoración sobre la mesa)
  for (const [k, col] of [["kuriboh", "#9a6a40"], ["gigobyte", "#2f9fb4"], ["timewizard", "#8a54d0"]]) {
    const [c, g] = canvas(T, T); softShadow(g, 32, 54, 24, 7); rr(g, 14, 12, 36, 44, 5, vgrad(g, 12, 56, shade(col, 0.25), shade(col, -0.25)), C.ink, 2.5); rr(g, 20, 20, 24, 28, 3, "#fff8e0", shade(col, -0.5), 2); oval(g, 32, 34, 7, 7, "#ffd24a", "#a06a00", 2);
    scene.textures.addCanvas("deco_deck_" + k, c);
  }
  // Sombra de personaje
  { const [c, g] = canvas(T, 24); softShadow(g, 32, 12, 26, 9, 0.4); scene.textures.addCanvas("shadow", c); }
  // Espíritu (orbe brillante genérico)
  { const [c, g] = canvas(128, 128); const grd = g.createRadialGradient(64, 64, 6, 64, 64, 60); grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.4, "rgba(255,255,200,0.8)"); grd.addColorStop(1, "rgba(255,255,200,0)"); g.fillStyle = grd; g.fillRect(0, 0, 128, 128); scene.textures.addCanvas("spirit_orb", c); }
}

export function addCharacter(scene, key, pal) {
  const fw = CHAR_W * S, fh = CHAR_H * S; const [c, g] = canvas(fw * 12, fh);
  let i = 0;
  for (const dir of [0, 1, 2]) for (const f of [0, 1, 2]) drawCharFrame(g, fw * i++, 0, dir, f, pal);
  // Izquierda = espejo del lado
  for (const f of [0, 1, 2]) { g.save(); g.translate(fw * (i + 1), 0); g.scale(-1, 1); g.drawImage(c, fw * (6 + f), 0, fw, fh, 0, 0, fw, fh); g.restore(); i++; }
  scene.textures.addSpriteSheet(`ch_${key}`, c, { frameWidth: fw, frameHeight: fh });
}

// ---------------- Edificios ----------------
/** Dibuja un edificio de w x h casillas. door: columna de la puerta (relativa). */
export function buildBuilding(scene, key, w, h, opts) {
  const W = w * T, H = h * T; const [c, g] = canvas(W, H); const roofH = Math.round(H * 0.5);
  // Pared
  rr(g, 10, roofH - 8, W - 20, H - roofH + 6, [0, 0, 6, 6], vgrad(g, roofH, H, C.wall, C.wallD), shade(C.wallD, -0.4), 3);
  g.fillStyle = "#b9ab94"; g.fillRect(12, H - 16, W - 24, 13);
  g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(12, roofH, W - 24, 14);
  // Chimenea
  if (opts.chimney) { rr(g, W - 84, 4, 30, 44, 3, "#a8604c", "#5e2e22", 3); rr(g, W - 88, 2, 38, 10, 3, "#c47a62", "#5e2e22", 3); }
  // Techo a dos aguas con tejas
  g.beginPath(); g.moveTo(26, 12); g.lineTo(W - 26, 12); g.lineTo(W - 2, roofH + 6); g.lineTo(2, roofH + 6); g.closePath();
  g.fillStyle = vgrad(g, 12, roofH + 6, opts.roofC || opts.roof, opts.roofB); g.fill(); g.strokeStyle = shade(opts.roofB, -0.45); g.lineWidth = 3.5; g.lineJoin = "round"; g.stroke();
  g.save(); g.clip(); g.strokeStyle = "rgba(0,0,0,.16)"; g.lineWidth = 2.5;
  for (let y = 30; y < roofH + 6; y += 17) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); for (let x = (y / 17 | 0) % 2 ? 16 : 0; x < W; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 17); g.stroke(); } }
  g.fillStyle = "rgba(255,255,255,.22)"; g.fillRect(0, 12, W, 8); g.restore();
  // Ventanas
  for (const wx of opts.windows || []) {
    const x = wx * T + 8, y = roofH + 20;
    rr(g, x, y, 48, 46, 5, vgrad(g, y, y + 46, "#c8ecff", "#6fb6ec"), "#fff", 5); rr(g, x - 1, y - 1, 50, 48, 6, null, "#7a6a55", 2);
    g.fillStyle = "#fff"; g.fillRect(x + 22, y, 4, 46); g.fillRect(x, y + 21, 48, 4);
    g.fillStyle = "rgba(255,255,255,.5)"; g.beginPath(); g.moveTo(x + 5, y + 5); g.lineTo(x + 17, y + 5); g.lineTo(x + 7, y + 19); g.lineTo(x + 5, y + 19); g.fill();
    rr(g, x - 4, y + 46, 56, 9, 3, C.woodD, C.trunkD, 2); for (let i = 0; i < 4; i++) oval(g, x + 5 + i * 13, y + 45, 5, 5, ["#ff6a7a", "#ffd84a", "#ff9ad0", "#fff"][i]);
  }
  // Puerta
  const dx = opts.door * T + 8;
  rr(g, dx - 4, H - 64, 56, 62, [8, 8, 0, 0], "#fff", "#7a6a55", 2.5); rr(g, dx, H - 60, 48, 58, [6, 6, 0, 0], vgrad(g, H - 60, H, C.wood, C.woodD), C.trunkD, 2.5);
  rr(g, dx + 7, H - 52, 34, 20, 3, null, "rgba(0,0,0,.25)", 2); rr(g, dx + 7, H - 26, 34, 18, 3, null, "rgba(0,0,0,.25)", 2); oval(g, dx + 39, H - 28, 3.5, 3.5, "#ffd24a", "#8a6200", 1.5);
  // Cartel de tienda
  if (opts.sign) {
    g.font = `700 30px Bahnschrift, "Segoe UI", Arial, sans-serif`; const tw = g.measureText(opts.sign).width; const sw = tw + 78, sx = Math.round((W - sw) / 2), sy = roofH - 34;
    rr(g, sx, sy, sw, 46, 10, vgrad(g, sy, sy + 46, shade(opts.signColor || "#3a62c8", 0.2), shade(opts.signColor || "#3a62c8", -0.25)), "#fff", 4); rr(g, sx - 2, sy - 2, sw + 4, 50, 12, null, C.ink, 2);
    rr(g, sx + 14, sy + 8, 21, 30, 3, "#fff8e0", C.ink, 2); rr(g, sx + 18, sy + 12, 13, 12, 2, "#e8a040");
    g.fillStyle = "#fff"; g.textBaseline = "middle"; g.fillText(opts.sign, sx + 50, sy + 25);
  }
  scene.textures.addCanvas(key, c);
}

/** Retrato/arte genérico para un espíritu cuando no hay arte de carta local. */
export function spiritPortrait(color) {
  const [c, g] = canvas(192, 192);
  const col = "#" + color.toString(16).padStart(6, "0");
  const grd = g.createRadialGradient(96, 96, 8, 96, 96, 92); grd.addColorStop(0, "#ffffff"); grd.addColorStop(0.35, col); grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 192, 192);
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, r = 60 + (i % 3) * 12; oval(g, 96 + Math.cos(a) * r, 96 + Math.sin(a) * r, 2.5, 2.5, "rgba(255,255,255,0.8)"); }
  return c.toDataURL();
}
