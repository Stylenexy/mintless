// The block world: textures painted in code, one island with a river, a lake,
// five villages, your home and a market hall. Every block and every person is
// built here, with no image or model files.
import * as THREE from "three";

export const WIDTH = 176;
export const DEPTH = 176;
const TALL = 34;
export const GROUND = 6;
const WATER = 5.45;

const SOLID = 1, CROSS = 2, GLOW = 4;
const BLOCKS = {
  grass: { top: ["#6fd35e", "#58c04f", "#7fe06c"], side: ["#8a5a38", "#7a4e30", "#96663f"], lip: "#58c04f", flags: SOLID },
  dirt: { top: ["#8a5a38", "#7a4e30", "#96663f"], flags: SOLID },
  rock: { top: ["#8f97a8", "#7d8596", "#a0a8b8"], flags: SOLID },
  sand: { top: ["#efdca6", "#e2cd93", "#f6e7ba"], flags: SOLID },
  salt: { top: ["#f7fafd", "#e4ebf3", "#ffffff"], flags: SOLID },
  path: { top: ["#b8b0a0", "#a39b8b", "#c8c0ae"], flags: SOLID, grid: 8 },
  cobble: { top: ["#9aa3b5", "#7c8598", "#b0b8c8"], flags: SOLID, grid: 5 },
  soil: { top: ["#5e3f2a", "#4e3322", "#6b4a33"], flags: SOLID },
  plank: { top: ["#c48f55", "#a8743f", "#d6a56c"], flags: SOLID, rows: 4 },
  log: { top: ["#6b4422", "#5e3a1a", "#7a4f28"], flags: SOLID, rows: 8 },
  leaf: { top: ["#3f9f4a", "#2f8a3e", "#55b85c"], flags: SOLID },
  pine: { top: ["#23703a", "#1b5c2f", "#2f8a46"], flags: SOLID },
  stone: { top: ["#a8b0c0", "#8f97a8", "#bcc4d2"], flags: SOLID, grid: 8 },
  whitewall: { top: ["#eef2f7", "#dde4ec", "#f8fafc"], flags: SOLID, rows: 8 },
  bluewall: { top: ["#3d7fa8", "#336d92", "#4a90ba"], flags: SOLID, rows: 8 },
  goldwall: { top: ["#c98f45", "#b67e38", "#d9a25a"], flags: SOLID, rows: 8 },
  purplewall: { top: ["#7a5fa8", "#6a5096", "#8a70b8"], flags: SOLID, grid: 8 },
  cabin: { top: ["#8a5730", "#774a28", "#9a653a"], flags: SOLID, rows: 5 },
  roofwhite: { top: ["#cfd8e6", "#b8c4d6", "#e2e8f0"], flags: SOLID, rows: 4 },
  roofblue: { top: ["#00bfff", "#0a9fd8", "#3fd0ff"], flags: SOLID, rows: 4 },
  roofgold: { top: ["#f2c94c", "#d9ae35", "#ffdc6a"], flags: SOLID, rows: 4 },
  roofpurple: { top: ["#9b5de5", "#8349cc", "#b079f0"], flags: SOLID, rows: 4 },
  roofred: { top: ["#e04f3f", "#c43e30", "#ee6a5a"], flags: SOLID, rows: 4 },
  rooforange: { top: ["#ff8a3d", "#e6752b", "#ffa05c"], flags: SOLID, rows: 4 },
  window: { top: ["#ffd98a", "#ffcf6e", "#ffe6ad"], flags: SOLID | GLOW, grid: 8 },
  door: { top: ["#5e3a1a", "#4a2f1a", "#6b4422"], flags: SOLID },
  lamp: { top: ["#ffd166", "#ffc23f", "#ffe08c"], flags: SOLID | GLOW },
  crate: { top: ["#b5824a", "#a06f3a", "#c8955a"], flags: SOLID, grid: 8 },
  chest: { top: ["#00bfff", "#0a7fb8", "#3fd0ff"], flags: SOLID, rows: 8 },
  cloth: { top: ["#9b5de5", "#c86bd6", "#7e57c2"], flags: SOLID, rows: 3 },
  gold: { top: ["#ffd166", "#ffc23f", "#fff0b0"], flags: SOLID | GLOW },
  rice: { top: ["#e8c54a", "#7fb347", "#f2d76a"], flags: CROSS },
  bush: { top: ["#ff7fa8", "#55b85c", "#ffd166"], flags: CROSS },
};
const NAMES = Object.keys(BLOCKS);
const ID = Object.fromEntries(NAMES.map((n, i) => [n, i + 1]));

const key = (x, y, z) => x + z * WIDTH + y * WIDTH * DEPTH;
function noise2(x, y) {
  let n = Math.imul(x * 374761393 + y * 668265263, 1274126177);
  n ^= n >>> 13;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function smooth(x, y, size) {
  const fx = x / size, fy = y / size;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = fx - ix, ty = fy - iy;
  const a = noise2(ix, iy), b = noise2(ix + 1, iy), c = noise2(ix, iy + 1), d = noise2(ix + 1, iy + 1);
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

// Where things stand. Goods index: 0 salt, 1 fish, 2 rice, 3 cloth, 4 wood.
export const VILLAGES = [
  { good: 0, role: "saltmaker", name: "Salt Flats", x: 36, z: 42 },
  { good: 1, role: "fisher", name: "Harbor", x: 88, z: 146 },
  { good: 2, role: "farmer", name: "Rice Fields", x: 140, z: 44 },
  { good: 3, role: "weaver", name: "Weavers' Row", x: 32, z: 122 },
  { good: 4, role: "logger", name: "Forest Camp", x: 146, z: 112 },
];
export const riverX = (z) => 98 + Math.sin(z / 21) * 9;
export const HOME = { x: Math.round(riverX(88)) - 20, z: 88 };
export const MARKET = { x: 60, z: 62 };
export const DOCKS = [
  { x: Math.round(riverX(88)) - 3.5, z: 88, face: 1 },
  { x: 88, z: 129.5, face: 2 },
];
export const RELICS = [
  [116, 18], [12, 84], [160, 150], [122, 76], [60, 158],
];

function paintTile(colors, spec) {
  const size = 16;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const n = noise2(x + colors[0].length * 7 + colors[0].charCodeAt(2), y + colors[0].charCodeAt(4));
      ctx.fillStyle = n < 0.62 ? colors[0] : n < 0.84 ? colors[1] : colors[2];
      ctx.fillRect(x, y, 1, 1);
    }
  if (spec.rows) {
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    for (let y = spec.rows - 1; y < size; y += spec.rows) ctx.fillRect(0, y, size, 1);
  }
  if (spec.grid) {
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(0, spec.grid - 1, size, 1);
    ctx.fillRect(0, size - 1, size, 1);
    ctx.fillRect(4, 0, 1, spec.grid - 1);
    ctx.fillRect(12, spec.grid, 1, size - spec.grid);
  }
  if (spec.lip) {
    ctx.fillStyle = spec.lip;
    for (let x = 0; x < size; x++) ctx.fillRect(x, 0, 1, 3 + Math.floor(noise2(x, 91) * 3));
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildWorld(scene) {
  const cells = new Uint8Array(WIDTH * DEPTH * TALL);
  const set = (x, y, z, name) => {
    if (x < 0 || z < 0 || y < 0 || x >= WIDTH || z >= DEPTH || y >= TALL) return;
    cells[key(x, y, z)] = name ? ID[name] : 0;
  };
  const get = (x, y, z) => (x < 0 || z < 0 || y < 0 || x >= WIDTH || z >= DEPTH || y >= TALL ? 0 : cells[key(x, y, z)]);
  const box = (x, y, z, w, h, d, name) => {
    for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) for (let c = 0; c < d; c++) set(x + a, y + b, z + c, name);
  };

  // terrain
  const near = (x, z, px, pz, r) => Math.hypot(x - px, z - pz) < r;
  const flats = [...VILLAGES, HOME, MARKET];
  const heights = new Uint8Array(WIDTH * DEPTH);
  const isWater = new Uint8Array(WIDTH * DEPTH);
  for (let z = 0; z < DEPTH; z++)
    for (let x = 0; x < WIDTH; x++) {
      const edge = Math.min(x, z, WIDTH - 1 - x, DEPTH - 1 - z);
      const river = Math.abs(x - riverX(z)) < 3.2 + smooth(x, z, 9) * 1.8 && z < 132;
      const lake = Math.hypot((x - 88) / 42, (z - 158) / 26) < 1;
      const hill = Math.max(0, smooth(x + 300, z + 90, 24) - 0.5) * 22;
      let mask = 1;
      for (const f of flats) mask = Math.min(mask, Math.min(1, Math.max(0, (Math.hypot(x - f.x, z - f.z) - 26) / 14)));
      let h = GROUND + Math.floor(hill * mask);
      const sea = edge < 3 + smooth(x, z, 11) * 5;
      if (river || lake || sea) {
        isWater[x + z * WIDTH] = 1;
        h = GROUND - 3;
      }
      heights[x + z * WIDTH] = h;
      const shore = !isWater[x + z * WIDTH] && (Math.abs(x - riverX(z)) < 6 || Math.hypot((x - 88) / 46, (z - 158) / 30) < 1 || edge < 9);
      const top = isWater[x + z * WIDTH] ? "sand" : shore ? "sand" : near(x, z, VILLAGES[0].x, VILLAGES[0].z, 24) ? "salt" : near(x, z, VILLAGES[3].x, VILLAGES[3].z, 16) ? "cobble" : h - GROUND > 3 ? "rock" : "grass";
      set(x, h, z, top);
      for (let y = h - 1; y >= Math.max(0, h - 3); y--) set(x, y, z, y < GROUND - 2 ? "rock" : "dirt");
    }
  const ground = (x, z) => heights[x + z * WIDTH];

  const pave = (x0, z0, x1, z1) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
    for (let i = 0; i <= steps; i++) {
      const cx = Math.round(x0 + ((x1 - x0) * i) / steps), cz = Math.round(z0 + ((z1 - z0) * i) / steps);
      for (let a = -1; a <= 1; a++)
        for (let b = -1; b <= 1; b++) {
          const x = cx + a, z = cz + b;
          if (x < 0 || z < 0 || x >= WIDTH || z >= DEPTH) continue;
          if (isWater[x + z * WIDTH]) {
            isWater[x + z * WIDTH] = 0;
            heights[x + z * WIDTH] = GROUND;
            set(x, GROUND, z, "plank");
          } else if (ground(x, z) === GROUND) set(x, GROUND, z, "path");
          else {
            for (let y = GROUND + 1; y <= ground(x, z); y++) set(x, y, z, null);
            heights[x + z * WIDTH] = GROUND;
            set(x, GROUND, z, "path");
          }
        }
    }
  };

  const objects = [];
  const house = (x, z, w, d, h, wall, roof, faceZ = true) => {
    const y0 = GROUND + 1;
    box(x, y0, z, w, h, d, wall);
    for (let k = 2; k < w - 1; k += 3) for (let y = y0 + 1; y < y0 + h - 1; y += 3) {
      set(x + k, y, z, "window");
      set(x + k, y, z + d - 1, "window");
    }
    for (let k = 2; k < d - 1; k += 3) for (let y = y0 + 1; y < y0 + h - 1; y += 3) {
      set(x, y, z + k, "window");
      set(x + w - 1, y, z + k, "window");
    }
    if (faceZ) box(x + (w >> 1), y0, z + d - 1, 1, 2, 1, "door");
    else box(x + (w >> 1), y0, z, 1, 2, 1, "door");
    for (let s = 0; s * 2 < d + 2; s++) box(x - 1, y0 + h + s, z - 1 + s, w + 2, 1, d + 2 - s * 2, roof);
  };
  const tree = (x, z, kind = "oak") => {
    const y0 = ground(x, z) + 1;
    if (kind === "pine") {
      const h = 7 + Math.floor(noise2(x, z) * 5);
      box(x, y0, z, 1, h, 1, "log");
      for (let s = 0; s < 4; s++) {
        const r = 3 - s;
        box(x - r, y0 + 2 + s * 2, z - r, r * 2 + 1, 2, r * 2 + 1, "pine");
      }
      set(x, y0 + h, z, "pine");
    } else {
      const h = 4 + Math.floor(noise2(z, x) * 3);
      box(x, y0, z, 1, h, 1, "log");
      box(x - 2, y0 + h - 1, z - 2, 5, 2, 5, "leaf");
      box(x - 1, y0 + h + 1, z - 1, 3, 2, 3, "leaf");
    }
  };
  const lamp = (x, z) => {
    box(x, GROUND + 1, z, 1, 3, 1, "log");
    set(x, GROUND + 4, z, "lamp");
    lights.push([x + 0.5, GROUND + 4.5, z + 0.5]);
  };
  const stall = (x, z, roof) => {
    box(x - 1, GROUND + 1, z - 2, 3, 1, 1, "crate");
    for (const a of [-1, 1]) box(x + a, GROUND + 2, z - 2, 1, 2, 1, "log");
    box(x - 1, GROUND + 4, z - 2, 3, 1, 2, roof);
  };
  const lights = [];

  // roads and bridges: home and market are the hub
  pave(HOME.x, HOME.z, MARKET.x, MARKET.z);
  pave(MARKET.x, MARKET.z, VILLAGES[0].x, VILLAGES[0].z);
  pave(MARKET.x, MARKET.z, MARKET.x, 24);
  pave(MARKET.x, 24, VILLAGES[2].x, 24);
  pave(VILLAGES[2].x, 24, VILLAGES[2].x, VILLAGES[2].z);
  pave(HOME.x, HOME.z, VILLAGES[3].x, VILLAGES[3].z);
  pave(HOME.x, HOME.z, HOME.x, 118);
  pave(HOME.x, 118, 88, 124);
  pave(88, 124, VILLAGES[1].x, 133);
  pave(HOME.x, HOME.z, HOME.x + 8, 112);
  pave(HOME.x + 8, 112, VILLAGES[4].x, 112);

  // salt flats
  const v = VILLAGES;
  house(v[0].x - 16, v[0].z - 20, 12, 9, 6, "whitewall", "roofwhite");
  house(v[0].x + 6, v[0].z - 20, 10, 8, 5, "whitewall", "roofwhite");
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, r = 14 + (i % 4) * 3;
    const x = Math.round(v[0].x + Math.cos(a) * r), z = Math.round(v[0].z + Math.sin(a) * r);
    for (let s = 0; s < 3; s++) box(x - 2 + s, GROUND + 1 + s, z - 2 + s, 5 - s * 2, 1, 5 - s * 2, "salt");
  }

  // harbor: long pier, boats, warehouses on the shore
  box(84, GROUND, 126, 9, 1, 3, "plank");
  for (let z = 126; z < 150; z++) {
    box(86, GROUND, z, 5, 1, 1, "plank");
    isWater[86 + z * WIDTH] = isWater[87 + z * WIDTH] = isWater[88 + z * WIDTH] = isWater[89 + z * WIDTH] = isWater[90 + z * WIDTH] = 0;
    for (let x = 86; x <= 90; x++) heights[x + z * WIDTH] = GROUND;
  }
  box(74, GROUND, 146, 30, 1, 5, "plank");
  for (let z = 146; z < 151; z++) for (let x = 74; x < 104; x++) {
    isWater[x + z * WIDTH] = 0;
    heights[x + z * WIDTH] = GROUND;
  }
  for (let x = 74; x < 104; x += 5) for (const z of [145, 151]) box(x, 3, z, 1, 3, 1, "log");
  const boat = (x, z) => {
    box(x, GROUND - 1, z, 11, 1, 4, "plank");
    box(x - 1, GROUND, z, 13, 1, 4, "cabin");
    box(x + 5, GROUND + 1, z + 1, 1, 7, 1, "log");
    box(x + 2, GROUND + 3, z + 1, 7, 3, 1, "whitewall");
  };
  boat(62, 136);
  boat(108, 138);
  boat(112, 156);
  house(64, 118, 11, 8, 6, "bluewall", "roofblue", false);
  house(104, 118, 12, 8, 7, "bluewall", "rooforange", false);

  // rice fields: rows of rice, barns, a scarecrow
  for (let x = v[2].x - 26; x < v[2].x + 26; x++)
    for (let z = v[2].z - 26; z < v[2].z + 26; z++) {
      const r = Math.hypot(x - v[2].x, z - v[2].z);
      if (r > 13 && r < 28 && ground(x, z) === GROUND && !isWater[x + z * WIDTH] && get(x, GROUND, z) !== ID.path) {
        if (x % 4 === 0) set(x, GROUND, z, "dirt");
        else {
          set(x, GROUND, z, "soil");
          set(x, GROUND + 1, z, "rice");
        }
      }
    }
  house(v[2].x - 10, v[2].z - 30, 14, 9, 6, "goldwall", "roofgold");
  house(v[2].x + 16, v[2].z + 4, 10, 8, 5, "goldwall", "rooforange");

  // weavers' row: tall workshops, cloth on the line
  house(v[3].x - 20, v[3].z - 18, 9, 9, 12, "purplewall", "roofpurple");
  house(v[3].x + 10, v[3].z - 18, 9, 9, 10, "purplewall", "roofpurple");
  house(v[3].x - 18, v[3].z + 11, 11, 8, 7, "stone", "roofpurple", false);
  for (const x of [v[3].x - 10, v[3].x + 10]) box(x, GROUND + 1, v[3].z + 14, 1, 7, 1, "log");
  box(v[3].x - 10, GROUND + 8, v[3].z + 14, 21, 1, 1, "log");
  for (let x = v[3].x - 8; x < v[3].x + 9; x += 3) box(x, GROUND + 4, v[3].z + 14, 2, 4, 1, "cloth");

  // forest camp: cabins, pines, log piles
  house(v[4].x - 8, v[4].z - 22, 12, 9, 5, "cabin", "roofred");
  house(v[4].x + 12, v[4].z + 2, 9, 8, 4, "cabin", "roofred");
  for (let i = 0; i < 6; i++) box(v[4].x - 18 + i * 2, GROUND + 1, v[4].z + 16, 2, 2 + (i % 2), 5, "log");

  // market hall in the middle of the island
  const mx = MARKET.x, mz = MARKET.z;
  for (let x = mx - 13; x <= mx + 13; x++) for (let z = mz - 13; z <= mz + 13; z++) if (ground(x, z) === GROUND) set(x, GROUND, z, "cobble");
  box(mx - 7, GROUND + 1, mz - 11, 15, 1, 8, "stone");
  for (const [a, b] of [[-7, -11], [7, -11], [-7, -4], [7, -4]]) box(mx + a, GROUND + 2, mz + b, 1, 6, 1, "stone");
  for (let s = 0; s < 5; s++) box(mx - 8 + s, GROUND + 8 + s, mz - 12 + s, 17 - s * 2, 1, 10 - s * 2, s % 2 ? "rooforange" : "roofblue");
  box(mx - 3, GROUND + 2, mz - 5, 7, 1, 1, "crate");
  box(mx + 1, GROUND + 13, mz - 8, 1, 4, 1, "log");
  box(mx + 1, GROUND + 15, mz - 8, 4, 2, 1, "cloth");
  objects.push({ type: "shop", x: mx + 0.5, z: mz - 2.5, label: "Open the market" });

  // home by the river: blue roof, chest, a small dock
  const hx = HOME.x, hz = HOME.z;
  house(hx - 5, hz - 9, 10, 8, 4, "cabin", "roofblue");
  box(hx + 2, GROUND + 1, hz - 1, 2, 1, 1, "chest");
  box(hx - 3, GROUND + 1, hz - 1, 1, 1, 1, "lamp");
  lights.push([hx - 2.5, GROUND + 1.5, hz - 0.5]);
  objects.push({ type: "chest", x: hx + 3, z: hz + 0.5, label: "Open your chest" });
  objects.push({ type: "bed", x: hx + 0.5, z: hz + 0.5, label: "Go to sleep" });
  const dockX = Math.floor(DOCKS[0].x);
  pave(hx + 5, hz + 1, dockX - 2, hz + 1);
  for (let x = dockX - 2; x <= dockX + 1; x++)
    for (let z = hz; z <= hz + 2; z++) {
      set(x, GROUND, z, "plank");
      heights[x + z * WIDTH] = GROUND;
      isWater[x + z * WIDTH] = 0;
    }
  objects.push({ type: "dock", x: DOCKS[0].x, z: hz + 1.5, face: 1, label: "Fish here" });
  objects.push({ type: "dock", x: 88.5, z: 148.5, face: 2, label: "Fish here" });
  DOCKS[0].z = hz + 1.5;
  DOCKS[1].z = 148.5;

  // stalls in each village
  const spots = {};
  for (const vil of VILLAGES) {
    spots[vil.role] = [];
    const pier = vil.role === "fisher";
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.3;
      const x = pier ? (k < 4 ? 77 + k * 8 : 42 + k * 6) : Math.round(vil.x + Math.cos(a) * 10);
      const z = pier ? (k < 4 ? 148 : 128) : Math.round(vil.z + Math.sin(a) * 10);
      const roof = { saltmaker: "roofwhite", fisher: "roofblue", farmer: "roofgold", weaver: "roofpurple", logger: "roofred" }[vil.role];
      if (!pier) {
        for (let aa = -2; aa <= 2; aa++) for (let bb = -3; bb <= 2; bb++) if (ground(x + aa, z + bb) === GROUND) {
          set(x + aa, GROUND + 1, z + bb, null);
        }
        stall(x, z, roof);
      }
      spots[vil.role].push({ x: x + 0.5, z: z + 0.5, y: GROUND + 1 });
    }
    lamp(vil.x + 3, vil.z + 3);
    lamp(vil.x - 4, vil.z - 4);
  }
  lamp(mx - 9, mz + 2);
  lamp(mx + 9, mz + 2);
  lamp(hx + 7, hz + 3);

  // parkour towers with a gold shell on top
  const relicSpots = [];
  for (const [x, z] of RELICS) {
    const y0 = ground(x, z) + 1;
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    let px = x, pz = z, py = y0;
    box(x - 1, y0, z - 1, 3, 11, 3, "stone");
    for (let s = 0; s < 11; s++) {
      const [dx, dz] = dirs[Math.floor(s / 3) % 4];
      const ring = [[2, 0], [0, 2], [-2, 0], [0, -2]][Math.floor(s / 3) % 4];
      px = x + ring[0] + dx * ((s % 3) - 1);
      pz = z + ring[1] + dz * ((s % 3) - 1);
      py = y0 + s;
      set(px, py, pz, "plank");
    }
    set(x, y0 + 11, z, "gold");
    relicSpots.push({ x: x + 0.5, y: y0 + 13, z: z + 0.5 });
  }

  // trees and flowers, away from anything built
  for (let z = 6; z < DEPTH - 6; z += 2)
    for (let x = 6; x < WIDTH - 6; x += 2) {
      if (isWater[x + z * WIDTH]) continue;
      const clear = [...flats].every((f) => !near(x, z, f.x, f.z, f.role ? 22 : 15));
      const h = ground(x, z);
      const free = get(x, h, z) === ID.grass || get(x, h, z) === ID.rock;
      const n = noise2(x * 3, z * 5);
      const forest = near(x, z, v[4].x, v[4].z, 42);
      if (clear && free) {
        if (forest && n < 0.34) tree(x, z, "pine");
        else if (n < 0.05) tree(x, z, noise2(z, x) > 0.5 ? "pine" : "oak");
      }
      if (get(x, h, z) === ID.grass && !get(x, h + 1, z) && n > 0.93) set(x, h + 1, z, "bush");
    }

  // solid columns the player cannot stand on: water
  const blocked = (x, z) => x < 0 || z < 0 || x >= WIDTH || z >= DEPTH || isWater[Math.floor(x) + Math.floor(z) * WIDTH] === 1;
  const solid = (x, y, z) => {
    const c = get(Math.floor(x), Math.floor(y), Math.floor(z));
    return c > 0 && (BLOCKS[NAMES[c - 1]].flags & SOLID) !== 0;
  };

  // one merged mesh per material, holding only the faces that can be seen
  const opaque = (x, y, z) => {
    const n = get(x, y, z);
    return n !== 0 && (BLOCKS[NAMES[n - 1]].flags & SOLID) !== 0;
  };
  const buckets = {};
  const bucket = (id) => (buckets[id] ||= { pos: [], norm: [], uv: [], col: [], idx: [] });
  const glowMats = [];
  const plants = [];
  for (let y = 2; y < TALL; y++)
    for (let z = 0; z < DEPTH; z++)
      for (let x = 0; x < WIDTH; x++) {
        const c = get(x, y, z);
        if (!c) continue;
        const name = NAMES[c - 1];
        const spec = BLOCKS[name];
        if (spec.flags & CROSS) {
          plants.push([name, x, y, z]);
          continue;
        }
        const shade = 0.92 + noise2(x, z) * 0.12;
        for (const f of FACES) {
          if (opaque(x + f.n[0], y + f.n[1], z + f.n[2])) continue;
          const b = bucket(spec.side && !f.top ? `${name}|side` : name);
          const base = b.pos.length / 3;
          for (const v of f.v) {
            b.pos.push(x + v[0], y + v[1], z + v[2]);
            b.norm.push(...f.n);
            b.col.push(shade, shade, shade);
          }
          b.uv.push(0, 0, 1, 0, 1, 1, 0, 1);
          b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
  for (const [id, b] of Object.entries(buckets)) {
    const [name, part] = id.split("|");
    const spec = BLOCKS[name];
    const tex = part ? paintTile(spec.side, spec) : paintTile(spec.top, spec.side ? { flags: 0 } : spec);
    const opts = { map: tex, vertexColors: true };
    if (spec.flags & GLOW) Object.assign(opts, { emissive: 0xffc070, emissiveMap: tex, emissiveIntensity: 0.15 });
    const material = new THREE.MeshLambertMaterial(opts);
    if (spec.flags & GLOW) glowMats.push(material);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(b.norm, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(b.col, 3));
    geo.setIndex(b.idx);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
  const m4 = new THREE.Matrix4();
  for (const name of ["rice", "bush"]) {
    const list = plants.filter((p) => p[0] === name);
    if (!list.length) continue;
    const material = new THREE.MeshLambertMaterial({ map: plantTile(name), side: THREE.DoubleSide, alphaTest: 0.5 });
    const mesh = new THREE.InstancedMesh(crossGeometry(), material, list.length);
    list.forEach((p, i) => mesh.setMatrixAt(i, m4.makeTranslation(p[1] + 0.5, p[2] + 0.5, p[3] + 0.5)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
  }

  // water
  const waterCv = document.createElement("canvas");
  waterCv.width = waterCv.height = 32;
  const wc = waterCv.getContext("2d");
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const n = noise2(x, y + 40);
      wc.fillStyle = n > 0.93 ? "#bfeaff" : n > 0.6 ? "#2b9fe0" : "#1f8fd0";
      wc.fillRect(x, y, 1, 1);
    }
  const waterTex = new THREE.CanvasTexture(waterCv);
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(WIDTH / 8, DEPTH / 8);
  waterTex.magFilter = THREE.NearestFilter;
  waterTex.colorSpace = THREE.SRGBColorSpace;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH + 400, DEPTH + 400), new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: 0.86 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(WIDTH / 2, WATER, DEPTH / 2);
  water.receiveShadow = true;
  scene.add(water);

  const lampGlow = lights.map(([x, y, z]) => {
    const l = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb060, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    l.position.set(x, y, z);
    l.scale.setScalar(9);
    scene.add(l);
    return l;
  });

  return { solid, blocked, spots, objects, relicSpots, waterTex, glowMats, lampGlow, groundAt: (x, z) => heights[Math.floor(x) + Math.floor(z) * WIDTH], blockCount: plants.length };
}

const FACES = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], top: true },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

function plantTile(name) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 16;
  const ctx = cv.getContext("2d");
  for (let x = 1; x < 15; x += 3) {
    const h = 8 + Math.floor(noise2(x, 7) * 6);
    ctx.fillStyle = "#4f9a3a";
    ctx.fillRect(x, 16 - h, 1, h);
    ctx.fillStyle = name === "rice" ? "#f2c94c" : ["#ff7fa8", "#ffd166", "#ffffff"][x % 3];
    ctx.fillRect(x - 1, 15 - h, 3, 3);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function crossGeometry() {
  const a = new THREE.PlaneGeometry(1, 1);
  a.rotateY(Math.PI / 4);
  const b = new THREE.PlaneGeometry(1, 1);
  b.rotateY(-Math.PI / 4);
  const g = new THREE.BufferGeometry();
  const join = (attr, n) => {
    const out = new Float32Array(a.attributes[attr].array.length * 2);
    out.set(a.attributes[attr].array);
    out.set(b.attributes[attr].array, a.attributes[attr].array.length);
    g.setAttribute(attr, new THREE.BufferAttribute(out, n));
  };
  join("position", 3);
  join("normal", 3);
  join("uv", 2);
  g.setIndex([0, 2, 1, 2, 3, 1, 4, 6, 5, 6, 7, 5]);
  return g;
}

function glowTexture() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 32;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(cv);
}

// ------------------------------------------------------------ people
// Merge coloured boxes into one geometry: [w, h, d, x, y, z, color].
export function mergeBoxes(list) {
  const positions = [], normals = [], colors = [], indices = [];
  const c = new THREE.Color();
  for (const [w, h, d, x, y, z, color] of list) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    c.set(color);
    const base = positions.length / 3;
    positions.push(...g.attributes.position.array);
    normals.push(...g.attributes.normal.array);
    for (let i = 0; i < g.attributes.position.count; i++) colors.push(c.r, c.g, c.b);
    indices.push(...Array.from(g.index.array, (v) => v + base));
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  out.setIndex(indices);
  return out;
}

const SKIN = ["#f1c7a0", "#d9a066", "#a86b45"];
const HATS = {
  saltmaker: (c) => [[0.86, 0.22, 0.86, 0, 1.92, 0, c.h], [0.5, 0.06, 0.3, 0, 1.82, 0.52, c.h]],
  fisher: (c) => [[0.8, 0.26, 0.8, 0, 1.94, 0, c.h], [1.16, 0.06, 1.16, 0, 1.82, 0, c.h]],
  farmer: (c) => [[1.4, 0.08, 1.4, 0, 1.84, 0, c.h], [0.9, 0.1, 0.9, 0, 1.92, 0, c.h], [0.5, 0.1, 0.5, 0, 2.02, 0, c.h], [0.2, 0.1, 0.2, 0, 2.12, 0, c.h]],
  weaver: (c) => [[0.88, 0.3, 0.88, 0, 1.88, 0, c.h], [0.88, 0.5, 0.2, 0, 1.54, -0.36, c.h]],
  logger: (c) => [[0.84, 0.26, 0.84, 0, 1.9, 0, c.h], [0.2, 0.16, 0.2, 0, 2.11, 0, "#f4f7fb"]],
};
const OUTFIT = {
  saltmaker: { h: "#eef3f8", c: "#7a8ba6", p: "#3a3f58" },
  fisher: { h: "#f2c94c", c: "#2ec4b6", p: "#2f4a6b" },
  farmer: { h: "#e6c77f", c: "#5baa4a", p: "#6b5236" },
  weaver: { h: "#9b5de5", c: "#e07ab8", p: "#3a3f58" },
  logger: { h: "#e04f3f", c: "#8b5a2b", p: "#2f3a4a" },
  keeper: { h: "#ff8a3d", c: "#ffd166", p: "#3a3f58" },
};
const hatFor = (role, o) => (HATS[role] ? HATS[role](o) : HATS.farmer(o));

const peopleMat = new THREE.MeshLambertMaterial({ vertexColors: true });

function headBoxes(skin) {
  return [
    [0.8, 0.72, 0.8, 0, 1.5, 0, skin],
    [0.12, 0.14, 0.04, -0.18, 1.56, 0.41, "#141824"],
    [0.12, 0.14, 0.04, 0.18, 1.56, 0.41, "#141824"],
    [0.24, 0.05, 0.04, 0, 1.34, 0.41, "#8a3b3b"],
  ];
}

export function makeTrader(role, skinIndex) {
  const o = OUTFIT[role];
  const skin = SKIN[skinIndex % SKIN.length];
  const geo = mergeBoxes([
    ...headBoxes(skin),
    ...hatFor(role, o),
    [0.66, 0.6, 0.38, 0, 0.86, 0, o.c],
    [0.18, 0.56, 0.2, -0.43, 0.88, 0, o.c],
    [0.18, 0.56, 0.2, 0.43, 0.88, 0, o.c],
    [0.18, 0.12, 0.2, -0.43, 0.56, 0, skin],
    [0.18, 0.12, 0.2, 0.43, 0.56, 0, skin],
    [0.28, 0.56, 0.3, -0.17, 0.28, 0, o.p],
    [0.28, 0.56, 0.3, 0.17, 0.28, 0, o.p],
  ]);
  const mesh = new THREE.Mesh(geo, peopleMat);
  mesh.castShadow = true;
  return mesh;
}

// The player: limbs on pivots so they can swing, skins as toggled parts.
export function makePlayer() {
  const root = new THREE.Group();
  const skin = "#f1c7a0";
  const sky = "#00bfff";
  const add = (list, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(mergeBoxes(list), peopleMat);
    m.position.set(x, y, z);
    m.castShadow = true;
    root.add(m);
    return m;
  };
  add([
    ...headBoxes(skin),
    [0.86, 0.26, 0.86, 0, 1.9, 0, sky],
    [0.3, 0.14, 0.3, -0.2, 2.08, 0.1, sky],
    [0.3, 0.14, 0.3, 0.2, 2.1, -0.1, sky],
    [0.68, 0.62, 0.4, 0, 0.86, 0, "#f4f7fb"],
    [0.68, 0.1, 0.4, 0, 0.82, 0, sky],
  ]);
  const armL = add([[0.2, 0.62, 0.22, 0, -0.26, 0, "#f4f7fb"], [0.2, 0.12, 0.22, 0, -0.62, 0, skin]], -0.44, 1.14, 0);
  const armR = add([[0.2, 0.62, 0.22, 0, -0.26, 0, "#f4f7fb"], [0.2, 0.12, 0.22, 0, -0.62, 0, skin]], 0.44, 1.14, 0);
  const legL = add([[0.3, 0.56, 0.32, 0, -0.28, 0, "#1d2a52"]], -0.17, 0.56, 0);
  const legR = add([[0.3, 0.56, 0.32, 0, -0.28, 0, "#1d2a52"]], 0.17, 0.56, 0);
  const wear = {
    hat: add(HATS.farmer({ h: "#e6c77f" }).map((b) => [b[0], b[1], b[2], b[3], b[4] + 0.2, b[5], b[6]])),
    cape: add([[0.66, 1.0, 0.08, 0, 0.72, -0.26, "#00bfff"], [0.7, 0.1, 0.1, 0, 1.2, -0.25, "#ffd166"]]),
    crown: add([[0.7, 0.12, 0.7, 0, 2.3, 0, "#f4f7fb"], [0.12, 0.16, 0.12, -0.26, 2.42, 0, "#ffd166"], [0.12, 0.2, 0.12, 0, 2.44, 0, "#ffd166"], [0.12, 0.16, 0.12, 0.26, 2.42, 0, "#ffd166"]]),
    sash: add([[0.72, 0.14, 0.44, 0, 1.06, 0, "#ffd166"]]),
    boots: add([[0.32, 0.14, 0.36, -0.17, 0.08, 0.02, "#ff8a3d"], [0.32, 0.14, 0.36, 0.17, 0.08, 0.02, "#ff8a3d"]]),
  };
  for (const w of Object.values(wear)) w.visible = false;
  return { root, armL, armR, legL, legR, wear };
}

// First-person arms and rod, parented to the camera while fishing.
export function makeRod() {
  const g = new THREE.Group();
  const skin = "#f1c7a0";
  const arms = new THREE.Mesh(
    mergeBoxes([
      [0.22, 0.22, 0.9, -0.5, -0.5, -0.6, "#f4f7fb"],
      [0.22, 0.22, 0.26, -0.5, -0.5, -1.14, skin],
      [0.22, 0.22, 0.9, 0.5, -0.5, -0.6, "#f4f7fb"],
      [0.22, 0.22, 0.26, 0.5, -0.5, -1.14, skin],
    ]),
    peopleMat,
  );
  g.add(arms);
  const rod = new THREE.Group();
  rod.position.set(0.4, -0.46, -1.16);
  rod.add(new THREE.Mesh(mergeBoxes([[0.06, 0.06, 2.6, 0, 0.5, -1.1, "#8b5a2b"], [0.09, 0.09, 0.3, 0, 0.02, 0, "#141824"], [0.16, 0.16, 0.12, 0.08, 0.04, 0.1, "#ffd166"]]), peopleMat));
  rod.rotation.x = 0.42;
  g.add(rod);
  return { group: g, rod };
}

// ------------------------------------------------------------ sky
const SKY_KEYS = [
  [0, "#58c8ff"],
  [0.2, "#ffb36b"],
  [0.3, "#6b4bd8"],
  [0.4, "#141a46"],
  [0.5, "#070a1f"],
  [0.65, "#141a46"],
  [0.8, "#ffb36b"],
  [1, "#58c8ff"],
];
const tmpA = new THREE.Color(), tmpB = new THREE.Color();
export function skyColor(phase, out) {
  for (let i = 1; i < SKY_KEYS.length; i++) {
    if (phase <= SKY_KEYS[i][0]) {
      tmpA.set(SKY_KEYS[i - 1][1]);
      tmpB.set(SKY_KEYS[i][1]);
      return out.copy(tmpA).lerp(tmpB, (phase - SKY_KEYS[i - 1][0]) / (SKY_KEYS[i][0] - SKY_KEYS[i - 1][0]));
    }
  }
  return out.set(SKY_KEYS[0][1]);
}
export const nightness = (phase) => Math.max(0, Math.min(1, 1 - Math.abs(phase - 0.5) / 0.2));

export function makeClouds(scene) {
  const list = [];
  for (let i = 0; i < 26; i++) {
    const w = 16 + noise2(i, 3) * 26, d = 10 + noise2(i, 4) * 16;
    list.push([w, 1.4, d, noise2(i, 1) * 320 - 70, 84 + noise2(i, 5) * 8, noise2(i, 2) * 320 - 70, "#ffffff"]);
    list.push([w * 0.6, 1.4, d * 0.6, list[list.length - 1][3] + 2, list[list.length - 1][4] + 1.2, list[list.length - 1][5] + 1, "#ffffff"]);
  }
  const m = new THREE.Mesh(mergeBoxes(list), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }));
  scene.add(m);
  return m;
}

export function makeStars(scene) {
  const pts = new Float32Array(900);
  for (let i = 0; i < 300; i++) {
    const a = noise2(i, 21) * Math.PI * 2, b = noise2(i, 22) * 1.3 + 0.2;
    pts[i * 3] = 88 + Math.cos(a) * Math.cos(b) * 300;
    pts[i * 3 + 1] = Math.sin(b) * 300;
    pts[i * 3 + 2] = 88 + Math.sin(a) * Math.cos(b) * 300;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
  scene.add(m);
  return m;
}

export function makeRain(scene) {
  const n = 700;
  const pts = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pts[i * 3] = noise2(i, 31) * 60 - 30;
    pts[i * 3 + 1] = noise2(i, 32) * 30;
    pts[i * 3 + 2] = noise2(i, 33) * 60 - 30;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xa8c8ff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.75 }));
  m.visible = false;
  m.frustumCulled = false;
  scene.add(m);
  return m;
}
