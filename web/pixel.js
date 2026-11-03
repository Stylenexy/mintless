// Pixel art for the town: palette, sprites as tiny text maps, tiles, the
// five districts, and the painters for sky, water, lights and bubbles.
// Everything is drawn from code (no image files), so the whole game stays
// one small bundle and every pixel is ours.

export const TILE = 16;
export const VIEW_H = 180;
export const GROUND_Y = 144; // feet stand on this line
export const DISTRICT_W = 368;
export const WORLD_W = 32 + DISTRICT_W * 5 + 32;
const COLS = Math.ceil(WORLD_W / TILE);
const ROWS = 12;

// One colour per good, chosen to read apart at 8 px: salt white, fish teal,
// rice gold, cloth violet, wood brown.
export const GOOD_COLOR = ["#f4f7fb", "#2ec4b6", "#f2c94c", "#9b5de5", "#b5651d"];

export const DISTRICTS = [
  { good: 0, role: "saltmaker", name: "Salt Flats", plural: "Saltmakers" },
  { good: 1, role: "fisher", name: "Harbor", plural: "Fishers" },
  { good: 2, role: "farmer", name: "Rice Fields", plural: "Farmers" },
  { good: 3, role: "weaver", name: "Weavers' Row", plural: "Weavers" },
  { good: 4, role: "logger", name: "Forest Camp", plural: "Loggers" },
].map((d, k) => ({ ...d, x0: 32 + k * DISTRICT_W }));

// Where the k-th trader of a district stands.
export const spotX = (d, k) => d.x0 + 76 + k * 32;
export const homeX = (d) => d.x0 + 30;

// ------------------------------------------------------------ sprites
const ICON_MAPS = [
  ["........", "...ww...", "..wwWw..", ".wwWwwW.", ".wWwwwWw", "wwwWwWww", "gggggggg", ".gggggg."],
  ["........", "......t.", ".tt..tt.", "tTTttTTt", "tTeTTTt.", ".tTTTTTt", "..tt..t.", "........"],
  ["...bb...", "..yYYy..", ".yyyyyy.", "yyYyyyYy", "yyyyyyyy", "yYyyYyyy", ".yyyyyy.", "..YYYY.."],
  ["........", ".vvvvvv.", "vVvvvvVv", "vvvvvvvv", "vVvvvvVv", "vvvvvvvv", ".VVVVVV.", "........"],
  ["........", "..oooo..", ".oOrroO.", "oOrOOrOo", "oOrOOrOo", ".oOrroO.", "..oooo..", "........"],
];
const ICON_PAL = {
  w: "#f4f7fb", W: "#cfd8e6", g: "#8b97ab", t: "#2ec4b6", T: "#178f86", e: "#141824",
  y: "#f2c94c", Y: "#c79a2b", b: "#8a6a2f", v: "#9b5de5", V: "#6c3fb3", o: "#b5651d", O: "#7a3f12", r: "#e0a060",
};

const HEAD = [
  "................",
  "................",
  "................",
  "....ssssssss....",
  "...ssssssssss...",
  "..ssssssssssss..",
  "..ssssssssssss..",
  "..sssKssssKsss..",
  "..sssKssssKsss..",
  "..SssssssssssS..",
  "...SsssmmsssS...",
  "....SSssssSS....",
  ".....cccccc.....",
  "...cccccccccc...",
  "..cccccccccccc..",
  "..cCccccccccCc..",
  "..sCccccccccCs..",
  "....cccccccc....",
  "....CCCCCCCC....",
  "....pppppppp....",
];
const LEGS = [
  ["....ppp..ppp....", "....ppp..ppp....", "....PPP..PPP....", "...ffff..ffff..."],
  ["....ppp..ppp....", "...ppp....ppp...", "...PPP....PPP...", "..ffff....ffff.."],
];
const HATS = {
  cap: ["................", "................", ".....hhhhhh.....", "....hhhhhhhh....", "...hhhhhhhhhh...", "...hhhhhhhhhhHH."],
  souwester: ["................", "................", ".....hhhhhh.....", "....hhhhhhhh....", "...hhhhhhhhhh...", ".HHHHHHHHHHHHHH."],
  caping: [".......hh.......", "......hhhh......", ".....hhhhhh.....", "....hhhhhhhh....", "..hhhhhhhhhhhh..", "HHHHHHHHHHHHHHHH"],
  scarf: ["................", "................", "....hhhhhhhh....", "...hhhhhhhhhh...", "..hhhhhhhhhhhh..", "..hH........Hh..", "..hH........Hh..", "..hh........hh.."],
  beanie: ["................", ".......xx.......", ".....hhhhhh.....", "....hhhhhhhh....", "...hhhhhhhhhh...", "...HHHHHHHHHH..."],
  spiky: ["................", "....h..h..h.....", "...hhhhhhhhhh...", "..hhhhhhhhhhhh..", "..hhhhhhhhhhhh..", "..hH........Hh.."],
};
const LOOKS = {
  saltmaker: { hat: "cap", h: "#eef3f8", H: "#aab6c8", c: "#7a8ba6", C: "#55657e", p: "#3a3f58", P: "#2a2e42", f: "#2a1c12" },
  fisher: { hat: "souwester", h: "#f2c94c", H: "#c79a2b", c: "#2ec4b6", C: "#178f86", p: "#2f4a6b", P: "#22374f", f: "#2a1c12" },
  farmer: { hat: "caping", h: "#e6c77f", H: "#b08a3f", c: "#5baa4a", C: "#3f7f33", p: "#6b5236", P: "#4f3c27", f: "#2a1c12" },
  weaver: { hat: "scarf", h: "#9b5de5", H: "#6c3fb3", c: "#e07ab8", C: "#b0568e", p: "#3a3f58", P: "#2a2e42", f: "#2a1c12" },
  logger: { hat: "beanie", h: "#e04f3f", H: "#9a2f25", x: "#f4f7fb", c: "#8b5a2b", C: "#5e3a1a", p: "#2f3a4a", P: "#222b38", f: "#1a120c" },
  you: { hat: "spiky", h: "#00bfff", H: "#0a7fb8", c: "#f4f7fb", C: "#b8c8dc", p: "#1d2a52", P: "#141c3a", f: "#0b0e18" },
};
const SKINS = [["#f1c7a0", "#d49a72"], ["#d9a066", "#b07a45"], ["#a86b45", "#7f4f31"]];

function paintMap(map, pal, outline = "#0b0e18") {
  const w = map[0].length + 2;
  const h = map.length + 2;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  const on = (x, y) => y >= 0 && y < map.length && x >= 0 && x < map[0].length && map[y][x] !== ".";
  if (outline) {
    ctx.fillStyle = outline;
    for (let y = -1; y <= map.length; y++)
      for (let x = -1; x <= map[0].length; x++)
        if (!on(x, y) && (on(x + 1, y) || on(x - 1, y) || on(x, y + 1) || on(x, y - 1))) ctx.fillRect(x + 1, y + 1, 1, 1);
  }
  for (let y = 0; y < map.length; y++)
    for (let x = 0; x < map[y].length; x++) {
      const ch = map[y][x];
      if (ch === ".") continue;
      ctx.fillStyle = pal[ch] || "#ff00ff";
      ctx.fillRect(x + 1, y + 1, 1, 1);
    }
  return cv;
}

const spriteCache = new Map();
export function iconSprite(good) {
  const key = `i${good}`;
  if (!spriteCache.has(key)) spriteCache.set(key, paintMap(ICON_MAPS[good], ICON_PAL));
  return spriteCache.get(key);
}
export function iconURL(good, scale = 4) {
  const src = iconSprite(good);
  const cv = document.createElement("canvas");
  cv.width = src.width * scale;
  cv.height = src.height * scale;
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, cv.width, cv.height);
  return cv.toDataURL();
}

// 18x26 canvas: a 16x24 person plus a one-pixel outline.
export function personSprite(look, frame = 0, skin = 0) {
  const key = `p${look}${frame}${skin}`;
  if (!spriteCache.has(key)) {
    const L = LOOKS[look];
    const map = [...HEAD, ...LEGS[frame]].map((row, y) => {
      const hat = HATS[L.hat][y];
      if (!hat) return row;
      let out = "";
      for (let x = 0; x < 16; x++) out += hat[x] !== "." ? hat[x] : row[x];
      return out;
    });
    const [s, S] = SKINS[skin % SKINS.length];
    spriteCache.set(key, paintMap(map, { ...L, s, S, K: "#0b0e18", m: "#8a3b3b" }));
  }
  return spriteCache.get(key);
}

// ------------------------------------------------------------ world
function noise(x, y) {
  let n = Math.imul(x * 374761393 + y * 668265263, 1274126177);
  n ^= n >>> 13;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function rect(ctx, c, x, y, w, h) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}

const TOPS = {
  grass: { top: "#5fcf5a", mid: "#3fa34a", dark: "#2f7f3a" },
  forest: { top: "#3f9f4a", mid: "#2f7f3a", dark: "#22602c" },
  salt: { top: "#f4f7fb", mid: "#d8e0ea", dark: "#b8c4d6" },
  sand: { top: "#ecd9a0", mid: "#d8c07f", dark: "#bfa465" },
  cobble: { top: "#9aa3b5", mid: "#7c8598", dark: "#5f677a" },
};

function topTile(ctx, kind, x, y) {
  const t = TOPS[kind];
  dirtTile(ctx, x, y);
  if (kind === "cobble") {
    rect(ctx, t.dark, x, y, 16, 11);
    for (let r = 0; r < 2; r++)
      for (let c = -1; c < 2; c++) {
        const ox = x + c * 8 + (r % 2 ? 4 : 0);
        const sx = Math.max(x, ox);
        const ex = Math.min(x + 16, ox + 7);
        if (ex <= sx) continue;
        rect(ctx, t.mid, sx, y + r * 5 + 1, ex - sx, 4);
        rect(ctx, t.top, sx, y + r * 5 + 1, ex - sx, 1);
      }
    return;
  }
  rect(ctx, t.mid, x, y, 16, 4);
  rect(ctx, t.top, x, y, 16, 2);
  for (let i = 0; i < 16; i++) {
    if (noise(x + i, y) > 0.55) rect(ctx, t.mid, x + i, y + 4, 1, 1 + Math.floor(noise(i, x) * 2));
    if (kind !== "salt" && noise(x + i, y + 7) > 0.8) rect(ctx, t.top, x + i, y - 1, 1, 1);
  }
  if (kind === "salt") for (let i = 0; i < 3; i++) rect(ctx, t.dark, x + Math.floor(noise(x, i) * 14), y + 1 + i, 2, 1);
}

function dirtTile(ctx, x, y, deep = false) {
  rect(ctx, deep ? "#6b4a35" : "#8a5a38", x, y, 16, 16);
  for (let i = 0; i < 7; i++) {
    const nx = Math.floor(noise(x + i, y) * 15);
    const ny = Math.floor(noise(y + i, x) * 15);
    rect(ctx, deep ? "#55392a" : "#6f472c", x + nx, y + ny, 2, 1);
  }
  if (noise(x, y + 3) > 0.7) {
    rect(ctx, "#8f98a8", x + 4, y + 7, 4, 3);
    rect(ctx, "#b4bccb", x + 4, y + 7, 3, 1);
  }
}

function plank(ctx, x, y, w) {
  rect(ctx, "#a8743f", x, y, w, 5);
  rect(ctx, "#c48f55", x, y, w, 1);
  rect(ctx, "#6b4422", x, y + 5, w, 1);
  for (let i = x + 7; i < x + w; i += 12) rect(ctx, "#6b4422", i, y + 1, 1, 4);
}

function house(ctx, lights, x, w, h, wall, wallDark, roof, roofDark) {
  const y = GROUND_Y - h;
  rect(ctx, wall, x, y, w, h);
  for (let r = y + 3; r < GROUND_Y; r += 5) rect(ctx, wallDark, x, r, w, 1);
  // stepped roof
  for (let s = 0; s < 6; s++) {
    rect(ctx, s % 2 ? roof : roofDark, x - 4 + s * 3, y - 6 - s * 3, w + 8 - s * 6, 4);
  }
  rect(ctx, roofDark, x - 4, y - 3, w + 8, 3);
  // door and window
  rect(ctx, "#4a2f1a", x + 6, GROUND_Y - 16, 9, 16);
  rect(ctx, "#6b4422", x + 7, GROUND_Y - 15, 7, 14);
  rect(ctx, "#ffd166", x + 12, GROUND_Y - 8, 1, 1);
  rect(ctx, "#1d2333", x + w - 17, y + 8, 11, 9);
  rect(ctx, wallDark, x + w - 12, y + 8, 1, 9);
  lights.push({ x: x + w - 12, y: y + 12, r: 22 });
}

function tree(ctx, x, h, dark) {
  rect(ctx, "#5e3a1a", x - 2, GROUND_Y - h, 5, h);
  rect(ctx, "#7a4a22", x - 2, GROUND_Y - h, 2, h);
  const leaf = dark ? ["#22602c", "#2f7f3a", "#3f9f4a"] : ["#2f7f3a", "#3fa34a", "#5fcf5a"];
  const blobs = [[0, -h - 4, 14], [-9, -h + 4, 10], [9, -h + 4, 10], [0, -h + 8, 12]];
  for (const [dx, dy, r] of blobs) {
    for (let yy = -r; yy <= r; yy++) {
      const ww = Math.round(Math.sqrt(r * r - yy * yy));
      rect(ctx, leaf[yy < -r / 3 ? 2 : yy < r / 3 ? 1 : 0], x + dx - ww, GROUND_Y + dy + yy, ww * 2, 1);
    }
  }
}

function saltPile(ctx, x, r) {
  for (let yy = 0; yy < r; yy++) {
    const ww = Math.round(r * 1.6 - yy * 1.5);
    if (ww <= 0) break;
    rect(ctx, yy > r * 0.6 ? "#f4f7fb" : "#dfe6ef", x - ww, GROUND_Y - 1 - yy, ww * 2, 1);
  }
  rect(ctx, "#ffffff", x - 2, GROUND_Y - r + 1, 2, 1);
}

function rice(ctx, x) {
  for (let i = 0; i < 3; i++) {
    const sx = x + i * 3;
    const h = 9 + Math.floor(noise(sx, 3) * 5);
    rect(ctx, "#4f9a3a", sx, GROUND_Y - h, 1, h);
    rect(ctx, "#f2c94c", sx - 1, GROUND_Y - h - 1, 2, 3);
  }
}

function crateBox(ctx, x, y) {
  rect(ctx, "#8b5a2b", x, y, 16, 16);
  rect(ctx, "#a8743f", x + 1, y + 1, 14, 14);
  rect(ctx, "#6b4422", x + 1, y + 7, 14, 2);
  rect(ctx, "#6b4422", x + 7, y + 1, 2, 14);
  rect(ctx, "#c48f55", x + 1, y + 1, 14, 1);
}

function lampPost(ctx, lights, x) {
  rect(ctx, "#2a2e42", x, GROUND_Y - 30, 2, 30);
  rect(ctx, "#2a2e42", x - 2, GROUND_Y - 33, 6, 3);
  rect(ctx, "#ffd166", x - 1, GROUND_Y - 36, 4, 3);
  lights.push({ x: x + 1, y: GROUND_Y - 35, r: 30 });
}

function signPost(ctx, x, good) {
  rect(ctx, "#4a2f1a", x, GROUND_Y - 22, 2, 22);
  rect(ctx, "#2a1c12", x - 7, GROUND_Y - 32, 16, 12);
  rect(ctx, "#f4e3c1", x - 6, GROUND_Y - 31, 14, 10);
  ctx.drawImage(iconSprite(good), x - 4, GROUND_Y - 31);
}

// Build the static world once: solid tiles, the painted terrain layer,
// parallax backdrops, lights and water spans.
export function buildWorld() {
  const solid = new Uint8Array(COLS * ROWS);
  for (let c = 0; c < COLS; c++) for (let r = GROUND_Y / TILE; r < ROWS; r++) solid[r * COLS + c] = 1;
  const lights = [];
  const water = [];
  const cv = document.createElement("canvas");
  cv.width = WORLD_W;
  cv.height = VIEW_H;
  const ctx = cv.getContext("2d");

  const kinds = ["salt", "sand", "grass", "cobble", "forest"];
  for (let c = 0; c < COLS; c++) {
    const x = c * TILE;
    const d = DISTRICTS.find((dd) => x >= dd.x0 && x < dd.x0 + DISTRICT_W) || DISTRICTS[x < WORLD_W / 2 ? 0 : 4];
    topTile(ctx, kinds[d.good], x, GROUND_Y);
    dirtTile(ctx, x, GROUND_Y + TILE, true);
    dirtTile(ctx, x, GROUND_Y + TILE * 2, true);
  }

  const [salt, harbor, fields, weavers, forest] = DISTRICTS;
  // Salt Flats: stone salt house, drying pans, white heaps
  house(ctx, lights, salt.x0 + 4, 52, 40, "#8b97ab", "#6d7891", "#eef3f8", "#aab6c8");
  for (let i = 0; i < 6; i++) saltPile(ctx, salt.x0 + 80 + i * 46 + Math.floor(noise(i, 9) * 12), 5 + (i % 3) * 2);
  for (let i = 0; i < 4; i++) rect(ctx, "#cfe8f5", salt.x0 + 90 + i * 64, GROUND_Y + 1, 30, 2);
  lampPost(ctx, lights, salt.x0 + 340);

  // Harbor: your home, a pier over the water, a moored boat, a fish rack
  const pierFrom = harbor.x0 + 196;
  const pierTo = harbor.x0 + 340;
  water.push({ x0: pierFrom, x1: pierTo, y: GROUND_Y + 4 });
  ctx.clearRect(pierFrom, GROUND_Y, pierTo - pierFrom, VIEW_H - GROUND_Y);
  plank(ctx, pierFrom - 4, GROUND_Y, pierTo - pierFrom + 8);
  for (let x = pierFrom + 6; x < pierTo; x += 24) rect(ctx, "#5e3a1a", x, GROUND_Y + 6, 3, VIEW_H - GROUND_Y);
  house(ctx, lights, harbor.x0 + 6, 48, 34, "#3d6b8a", "#2f5670", "#00bfff", "#0a7fb8");
  rect(ctx, "#4a2f1a", harbor.x0 + 120, GROUND_Y - 26, 2, 26);
  rect(ctx, "#4a2f1a", harbor.x0 + 160, GROUND_Y - 26, 2, 26);
  rect(ctx, "#4a2f1a", harbor.x0 + 120, GROUND_Y - 26, 42, 2);
  for (let i = 0; i < 4; i++) ctx.drawImage(iconSprite(1), harbor.x0 + 124 + i * 9, GROUND_Y - 24);
  lampPost(ctx, lights, harbor.x0 + 186);

  // Rice Fields: barn, rows of rice, scarecrow
  house(ctx, lights, fields.x0 + 4, 54, 38, "#a5652e", "#7f4a1f", "#f2c94c", "#c79a2b");
  for (let x = fields.x0 + 70; x < fields.x0 + 350; x += 11) if (noise(x, 4) > 0.15) rice(ctx, x);
  rect(ctx, "#5e3a1a", fields.x0 + 330, GROUND_Y - 24, 2, 24);
  rect(ctx, "#5e3a1a", fields.x0 + 322, GROUND_Y - 18, 18, 2);
  rect(ctx, "#e6c77f", fields.x0 + 326, GROUND_Y - 30, 10, 4);
  rect(ctx, "#5baa4a", fields.x0 + 327, GROUND_Y - 20, 8, 7);
  lampPost(ctx, lights, fields.x0 + 300);

  // Weavers' Row: workshop, looms, cloth on a line
  house(ctx, lights, weavers.x0 + 4, 56, 42, "#6b4f8f", "#56407a", "#9b5de5", "#6c3fb3");
  rect(ctx, "#4a2f1a", weavers.x0 + 80, GROUND_Y - 44, 2, 44);
  rect(ctx, "#4a2f1a", weavers.x0 + 330, GROUND_Y - 44, 2, 44);
  rect(ctx, "#2a2e42", weavers.x0 + 80, GROUND_Y - 44, 252, 1);
  for (let x = weavers.x0 + 92; x < weavers.x0 + 320; x += 26) {
    const col = ["#9b5de5", "#e07ab8", "#6c3fb3", "#00bfff"][Math.floor(noise(x, 2) * 4)];
    rect(ctx, col, x, GROUND_Y - 43, 12, 14);
    rect(ctx, "rgba(0,0,0,0.2)", x, GROUND_Y - 31, 12, 2);
  }
  lampPost(ctx, lights, weavers.x0 + 210);

  // Forest Camp: cabin, tall trees, log pile
  for (const [dx, h] of [[90, 46], [170, 58], [250, 50], [340, 62], [-10, 54]]) tree(ctx, forest.x0 + dx, h, true);
  house(ctx, lights, forest.x0 + 4, 50, 36, "#7a4a22", "#5e3a1a", "#e04f3f", "#9a2f25");
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) ctx.drawImage(iconSprite(4), forest.x0 + 300 + j * 9 + i * 4, GROUND_Y - 10 - i * 8);
  lampPost(ctx, lights, forest.x0 + 130);

  // District gates: a sign and one crate to hop over
  const crates = [];
  DISTRICTS.forEach((d, k) => {
    signPost(ctx, d.x0 + 62, d.good);
    if (k > 0) crates.push(d.x0 - 8);
  });
  for (const x of crates) {
    const c = Math.floor(x / TILE);
    solid[(GROUND_Y / TILE - 1) * COLS + c] = 1;
    crateBox(ctx, c * TILE, GROUND_Y - TILE);
  }
  // world edges
  for (let r = 0; r < ROWS; r++) {
    solid[r * COLS] = 1;
    solid[r * COLS + COLS - 1] = 1;
  }

  return { solid, terrain: cv, lights, water, far: backdrop(0.25, 1), mid: backdrop(0.5, 2) };
}

function backdrop(factor, layer) {
  const w = Math.ceil(WORLD_W * factor + 420);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = VIEW_H;
  const ctx = cv.getContext("2d");
  if (layer === 1) {
    for (let x = 0; x < w; x += 2) {
      const h = 46 + Math.sin(x / 41) * 18 + Math.sin(x / 13) * 6 + Math.sin(x / 97) * 14;
      const top = Math.round(GROUND_Y - 12 - h);
      rect(ctx, "#6f86b8", x, top, 2, GROUND_Y - top);
      if (h > 62) rect(ctx, "#e8eef8", x, top, 2, 3);
    }
  } else {
    for (let x = 0; x < w; x += 2) {
      const h = 22 + Math.sin(x / 29) * 8 + Math.sin(x / 11) * 3;
      const top = Math.round(GROUND_Y - h);
      rect(ctx, "#4f9a6a", x, top, 2, GROUND_Y - top);
    }
    for (let x = 6; x < w; x += 18 + Math.floor(noise(x, 1) * 20)) {
      const h = 10 + Math.floor(noise(x, 5) * 10);
      rect(ctx, "#3f7f55", x, GROUND_Y - 20 - h, 6, h + 8);
      rect(ctx, "#3f7f55", x - 2, GROUND_Y - 16 - h, 10, h);
    }
  }
  return cv;
}

export function solidAt(world, x, y) {
  const c = Math.floor(x / TILE);
  const r = Math.floor(y / TILE);
  if (c < 0 || c >= COLS) return true;
  if (r < 0) return false;
  if (r >= ROWS) return true;
  return world.solid[r * COLS + c] === 1;
}

// ------------------------------------------------------------ sky and light
const SKY_STOPS = [
  [0, "#00bfff", "#a8ecff"],
  [0.18, "#3aa0f0", "#ffb36b"],
  [0.27, "#5a3fb8", "#ff8a3d"],
  [0.36, "#141a46", "#3b2a78"],
  [0.5, "#070a1f", "#1a1a44"],
  [0.7, "#141a46", "#4a3488"],
  [0.82, "#5a7ff0", "#ffb36b"],
  [1, "#00bfff", "#a8ecff"],
];
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function mixHex(a, b, t) {
  const x = hexRgb(a), y = hexRgb(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
}
function skyColors(phase) {
  for (let i = 1; i < SKY_STOPS.length; i++) {
    if (phase <= SKY_STOPS[i][0]) {
      const [p0, a0, b0] = SKY_STOPS[i - 1];
      const [p1, a1, b1] = SKY_STOPS[i];
      const t = (phase - p0) / (p1 - p0);
      return [mixHex(a0, a1, t), mixHex(b0, b1, t)];
    }
  }
  return [SKY_STOPS[0][1], SKY_STOPS[0][2]];
}
export function darkness(phase) {
  return Math.max(0, 1 - Math.abs(phase - 0.5) / 0.22);
}

function disc(ctx, cx, cy, r, fill, rim) {
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(r * r - y * y));
    rect(ctx, Math.abs(y) > r - 2 ? rim : fill, cx - w, cy + y, w * 2, 1);
  }
}

export function drawBackground(ctx, world, cam, viewW, t, phase, rainy) {
  const [top, bottom] = skyColors(phase);
  const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, viewW, VIEW_H);
  const night = darkness(phase);
  if (night > 0) {
    for (let i = 0; i < 80; i++) {
      const sx = Math.floor((noise(i, 1) * 900 - cam * 0.05) % viewW + viewW) % viewW;
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
      ctx.fillStyle = `rgba(255,255,255,${(night * (0.35 + 0.65 * tw)).toFixed(2)})`;
      ctx.fillRect(sx, Math.floor(noise(i, 2) * 100), 1, 1);
    }
  }
  const ang = phase * Math.PI * 2;
  if (!rainy) disc(ctx, Math.round(viewW / 2 + Math.sin(ang) * viewW * 0.38), Math.round(64 - Math.cos(ang) * 46), 9, "#fff2b0", "#ffd166");
  if (phase > 0.25 && phase < 0.75) disc(ctx, Math.round(viewW / 2 - Math.sin(ang) * viewW * 0.38), Math.round(64 + Math.cos(ang) * 46), 7, "#e8ecff", "#b8c0e8");
  for (let i = 0; i < 7; i++) {
    const span = viewW + 120;
    const x = Math.floor(((noise(i, 7) * 2000 + t * (3 + i) - cam * 0.15) % span + span) % span) - 60;
    cloud(ctx, x, 10 + Math.floor(noise(i, 3) * 50), night, rainy);
  }
  ctx.drawImage(world.far, -Math.round(cam * 0.25), 0);
  ctx.drawImage(world.mid, -Math.round(cam * 0.5), 0);
  if (rainy) rect(ctx, "rgba(40,48,70,0.4)", 0, 0, viewW, GROUND_Y);
}

function cloud(ctx, x, y, night, rainy) {
  const c = rainy ? "#8a94ab" : night > 0.3 ? "#2a3466" : "#ffffff";
  const s = rainy ? "#6d7790" : night > 0.3 ? "#202857" : "#d8eefa";
  rect(ctx, c, x + 8, y, 16, 5);
  rect(ctx, c, x + 3, y + 4, 30, 5);
  rect(ctx, c, x, y + 8, 40, 5);
  rect(ctx, s, x + 1, y + 12, 38, 2);
}

export function drawWater(ctx, world, cam, t) {
  for (const w of world.water) {
    const x0 = w.x0 - cam;
    rect(ctx, "#1c6fa8", x0, w.y, w.x1 - w.x0, VIEW_H - w.y);
    rect(ctx, "#2b8fd0", x0, w.y, w.x1 - w.x0, 3);
    for (let x = w.x0; x < w.x1; x += 2) {
      const k = Math.sin(x / 6 + t * 3);
      if (k > 0.6) rect(ctx, "#8fd6ff", x - cam, w.y + (k > 0.85 ? 0 : 1), 2, 1);
    }
  }
}

export function drawLights(ctx, world, cam, viewW, dark) {
  if (dark <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const l of world.lights) {
    const x = l.x - cam;
    if (x < -l.r || x > viewW + l.r) continue;
    for (let r = l.r; r > 2; r -= 5) {
      ctx.fillStyle = `rgba(255,170,70,${(0.05 * dark).toFixed(3)})`;
      ctx.fillRect(Math.round(x - r), Math.round(l.y - r * 0.7), r * 2, Math.round(r * 1.4));
    }
  }
  ctx.restore();
}

const DROPS = Array.from({ length: 110 }, (_, i) => [noise(i, 11), noise(i, 12), 0.6 + noise(i, 13) * 0.6]);
export function drawRain(ctx, viewW, t) {
  ctx.fillStyle = "rgba(170,200,255,0.55)";
  for (const [a, b, s] of DROPS) ctx.fillRect(Math.floor((a * viewW + t * 20 * s) % viewW), Math.floor((b * VIEW_H + t * 170 * s) % VIEW_H), 1, 4);
}

// ------------------------------------------------------------ bubbles and markers
// A trade bubble over a trader: the goods they take, an arrow, the good they give.
// A mini bubble (far traders) shows only the good they give.
export function drawBubble(ctx, cx, bottom, wants, gives, mood, mini = false) {
  const n = Math.max(1, wants.length);
  const w = mood === "keep" ? 20 : mini ? 14 : 4 + n * 10 + 6 + 10;
  const h = 14;
  const x = Math.round(cx - w / 2);
  const y = bottom - h;
  const edge = mood === "ok" ? "#2f9e4f" : mood === "goal" ? "#d9a520" : "#0b0e18";
  const fill = mood === "ok" ? "#e4fbe8" : mood === "goal" ? "#fff6d6" : "#ffffff";
  rect(ctx, edge, x + 1, y, w - 2, h);
  rect(ctx, edge, x, y + 1, w, h - 2);
  rect(ctx, fill, x + 1, y + 1, w - 2, h - 2);
  rect(ctx, edge, Math.round(cx) - 2, y + h, 5, 1);
  rect(ctx, edge, Math.round(cx) - 1, y + h + 1, 3, 1);
  rect(ctx, fill, Math.round(cx) - 1, y + h - 1, 3, 1);
  if (mood === "keep") {
    rect(ctx, "#8b97ab", x + 5, y + 4, 4, 1);
    rect(ctx, "#8b97ab", x + 7, y + 5, 1, 2);
    rect(ctx, "#8b97ab", x + 5, y + 8, 4, 1);
    rect(ctx, "#8b97ab", x + 11, y + 6, 3, 1);
    rect(ctx, "#8b97ab", x + 12, y + 7, 1, 1);
    rect(ctx, "#8b97ab", x + 11, y + 8, 3, 1);
    return;
  }
  if (mini) return ctx.drawImage(iconSprite(gives), x + 2, y + 2);
  wants.forEach((g, k) => ctx.drawImage(iconSprite(g), x + 2 + k * 10, y + 2));
  const ax = x + 3 + n * 10;
  rect(ctx, "#0b0e18", ax, y + 6, 4, 1);
  rect(ctx, "#0b0e18", ax + 2, y + 4, 1, 5);
  rect(ctx, "#0b0e18", ax + 3, y + 5, 1, 3);
  ctx.drawImage(iconSprite(gives), ax + 6, y + 2);
}

export function drawGlint(ctx, x, y, t, seed) {
  if ((t * 1.5 + seed * 0.37) % 3 > 0.35) return;
  rect(ctx, "#ffd166", x, y - 1, 1, 3);
  rect(ctx, "#ffd166", x - 1, y, 3, 1);
}

// Gold chevron bouncing over the next trader on your errand.
export function drawGoalArrow(ctx, x, y, t) {
  const b = Math.round(Math.sin(t * 6) * 1.5);
  rect(ctx, "#0b0e18", x - 4, y - 7 + b, 9, 6);
  rect(ctx, "#ffd166", x - 3, y - 6 + b, 7, 1);
  rect(ctx, "#ffd166", x - 2, y - 5 + b, 5, 1);
  rect(ctx, "#ffd166", x - 1, y - 4 + b, 3, 1);
  rect(ctx, "#ffd166", x, y - 3 + b, 1, 1);
}

// Arrow at the screen edge pointing to an off-screen goal.
export function drawEdgeArrow(ctx, viewW, side, good, t) {
  const pulse = Math.round(Math.sin(t * 5) * 1.5);
  const x = side < 0 ? 4 + pulse : viewW - 26 - pulse;
  const y = 98;
  rect(ctx, "#0b0e18", x, y, 22, 14);
  rect(ctx, "#ffd166", x + 1, y + 1, 20, 12);
  ctx.drawImage(iconSprite(good), side < 0 ? x + 10 : x + 2, y + 2);
  const ax = side < 0 ? x + 3 : x + 17;
  for (let k = 0; k < 4; k++) rect(ctx, "#0b0e18", side < 0 ? ax + k : ax - k, y + 7 - k, 1, k * 2 + 1);
}
