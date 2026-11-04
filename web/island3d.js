// The island: a soft painted landscape, a river, five villages, a market
// square and the beach where you washed up. The ground is painted once on a
// canvas, everything else is lofted in kit.js and merged, so the whole place
// costs a handful of draw calls.
import * as THREE from "three";
import { U, toon, ink, hex, brush, noise2, smooth, sstep, mixc } from "./kit.js";

export const SIZE = 128;
const CX = 64, CZ = 64;

// Goods index: 0 salt, 1 fish, 2 rice, 3 cloth, 4 wood.
export const VILLAGES = [
  { good: 0, role: "saltmaker", name: "Salt Flats", x: 24, z: 84 },
  { good: 1, role: "fisher", name: "Harbor", x: 106, z: 94 },
  { good: 2, role: "farmer", name: "Rice Fields", x: 108, z: 44 },
  { good: 3, role: "weaver", name: "Weavers' Row", x: 25, z: 42 },
  { good: 4, role: "logger", name: "Forest Camp", x: 60, z: 19 },
];
export const SQUARE = { x: 58, z: 64, name: "Market Square" };
export const CAMP = { x: 50, z: 107, name: "Wreck Beach" };
export const WRECK = { x: 37, z: 114 };
export const riverX = (z) => 83 + Math.sin(z / 17) * 5;
export const BRIDGES = [
  { x: riverX(46), z: 46 },
  { x: riverX(90), z: 90 },
];
export const DOCKS = [
  { x: 62, z: 114, dx: 0, dz: 1, name: "Beach pier", len: 12 },
  { x: riverX(66) - 5.4, z: 66, dx: 1, dz: 0, name: "River steps", len: 3.4 },
  { x: 112, z: 104, dx: 0.5, dz: 0.87, name: "Harbor pier", len: 13 },
];

// Road network, for painting and for the golden trail.
export const NODES = {
  camp: [CAMP.x, CAMP.z], square: [SQUARE.x, SQUARE.z + 6], salt: [24, 84], weaver: [25, 42], forest: [60, 19],
  rice: [108, 44], harbor: [106, 94], north: [BRIDGES[0].x, 46], south: [BRIDGES[1].x, 90], pier: [62, 112], steps: [DOCKS[1].x - 1, 66],
  northW: [BRIDGES[0].x - 9, 46], northE: [BRIDGES[0].x + 9, 46], southW: [BRIDGES[1].x - 9, 90], southE: [BRIDGES[1].x + 9, 90],
  wreck: [WRECK.x + 5, 105], hp: [108, 100],
};
export const EDGES = [
  ["camp", "square"], ["camp", "salt"], ["camp", "pier"], ["camp", "wreck"], ["camp", "southW"], ["square", "salt"], ["square", "weaver"], ["square", "forest"],
  ["square", "northW"], ["square", "southW"], ["square", "steps"], ["northW", "north"], ["north", "northE"], ["southW", "south"], ["south", "southE"],
  ["northE", "rice"], ["southE", "harbor"], ["rice", "harbor"], ["salt", "weaver"], ["weaver", "forest"], ["forest", "northW"], ["harbor", "hp"],
];

const shore = (x, z) => {
  const a = Math.atan2(z - CZ, x - CX), d = Math.hypot(x - CX, z - CZ);
  return 54 + 4.5 * Math.sin(a * 3 + 1.2) + 3 * Math.sin(a * 5 - 0.7) + (smooth(x + 40, z + 9, 20) - 0.5) * 9 - d;
};

const PADS = [
  ...VILLAGES.map((v) => [v.x, v.z, 13, 1.35]),
  [SQUARE.x, SQUARE.z, 13, 1.5],
  [CAMP.x, CAMP.z, 7, 0.82],
];

function rawHeight(x, z) {
  const l = shore(x, z);
  let h;
  if (l < 0) h = Math.max(-7, l > -5 ? l * 0.42 : -2.1 + (l + 5) * 1.1);
  else if (l < 13) h = sstep(0, 13, l) * 1.15;
  else {
    const hill = Math.max(0, smooth(x + 300, z + 90, 22) * 0.7 + smooth(x + 7, z + 51, 9) * 0.3 - 0.5);
    h = 1.15 + hill * sstep(13, 22, l) * 15;
  }
  const peak = Math.hypot(x - 94, z - 17);
  if (l > 0) h += sstep(16, 3, peak) * 5.2;
  for (const [px, pz, r, y] of PADS) {
    const w = sstep(r + 8, r, Math.hypot(x - px, z - pz));
    h += (y - h) * w;
  }
  const d = Math.abs(x - riverX(z));
  const wide = 2.9 + Math.sin(z * 0.21) * 0.5;
  const carve = sstep(wide + 2.4, wide - 0.2, d) * sstep(18, 27, z);
  h += (-1.5 - h) * carve;
  return h;
}

const N = SIZE + 1;
const H = new Float32Array(N * N);
for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) H[x + z * N] = rawHeight(x, z);

export function heightAt(x, z) {
  if (x < 0 || z < 0 || x >= SIZE || z >= SIZE) return -7;
  const ix = x | 0, iz = z | 0, fx = x - ix, fz = z - iz;
  const a = H[ix + iz * N], b = H[ix + 1 + iz * N], c = H[ix + (iz + 1) * N], d = H[ix + 1 + (iz + 1) * N];
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

// Decks you can walk on: bridges and piers.
const DECKS = [];
for (const b of BRIDGES) DECKS.push({ x0: b.x - 8.5, x1: b.x + 8.5, z0: b.z - 2.3, z1: b.z + 2.3, y: (x) => 1.25 + (1 - ((x - b.x) / 8.5) ** 2) * 1.05 });
for (const d of DOCKS) {
  const e = { x0: Math.min(d.x, d.x + d.dx * d.len) - 1.5, x1: Math.max(d.x, d.x + d.dx * d.len) + 1.5, z0: Math.min(d.z, d.z + d.dz * d.len) - 1.5, z1: Math.max(d.z, d.z + d.dz * d.len) + 1.5, y: () => 1.05, on: d };
  DECKS.push(e);
}

function onDeck(x, z) {
  for (const k of DECKS) {
    if (x < k.x0 || x > k.x1 || z < k.z0 || z > k.z1) continue;
    if (k.on) {
      const d = k.on, t = (x - d.x) * d.dx + (z - d.z) * d.dz;
      const off = Math.abs((x - d.x) * -d.dz + (z - d.z) * d.dx);
      if (t < -1 || t > d.len + 0.6 || off > 1.45) continue;
    }
    return k;
  }
  return null;
}

export function groundAt(x, z) {
  const h = heightAt(x, z);
  const k = onDeck(x, z);
  return k ? Math.max(h, k.y(x)) : h;
}
export const isWater = (x, z) => heightAt(x, z) < -0.3 && !onDeck(x, z);

// Round obstacles, bucketed so a step checks only a few.
const solids = new Map();
const cell = (x, z) => ((x >> 3) & 255) + ((z >> 3) & 255) * 256;
function addSolid(x, z, r) {
  const o = { x, z, r };
  const r8 = Math.ceil(r / 8);
  for (let a = -r8; a <= r8; a++)
    for (let b = -r8; b <= r8; b++) {
      const k = cell(Math.floor(x) + a * 8, Math.floor(z) + b * 8);
      if (!solids.has(k)) solids.set(k, []);
      solids.get(k).push(o);
    }
}
export function hitSolid(x, z, r) {
  const list = solids.get(cell(Math.floor(x), Math.floor(z)));
  if (!list) return null;
  for (const o of list) {
    const d = Math.hypot(x - o.x, z - o.z);
    if (d < o.r + r) return o;
  }
  return null;
}

// -------------------------------------------------------------- the props
const C = {
  bark: hex("#9a6a48"), bark2: hex("#7c5238"), leaf: hex("#49c77a"), leaf2: hex("#2fae6c"), leaf3: hex("#7fe08a"), pine: hex("#2c9a78"), pine2: hex("#1f8270"),
  palm: hex("#55cf72"), rock: hex("#b9b4c2"), rock2: hex("#918ea6"), plank: hex("#d8a56b"), plank2: hex("#b98352"), rope: hex("#e9d8b0"),
  white: hex("#fbfdff"), salt: hex("#eef5fc"), trim: hex("#00bfff"), straw: hex("#f2cf6b"), straw2: hex("#d9a94a"), red: hex("#ff6b5a"), orange: hex("#ff9a45"),
  violet: hex("#8f6bef"), pink: hex("#ff8fc2"), teal: hex("#2ec4b6"), cream: hex("#fff1d6"), door: hex("#7a4a30"), win: hex("#ffe08a"), navy: hex("#2a3560"),
  blue: hex("#3f9ff0"), wall: hex("#f6e7cf"), wall2: hex("#e8c9a0"), mud: hex("#c6a06e"),
};

export function buildIsland(scene, tier) {
  const rich = tier > 0;
  const b = brush();
  const soft = brush();
  const shadows = [];
  const lamps = [];
  const objects = [];
  const paint = [];
  const spots = {};

  const solid = (x, z, r) => addSolid(x, z, r);
  const shade = (x, z, r) => shadows.push([x, z, r]);

  function tree(x, z, s = 1) {
    const y = heightAt(x, z) - 0.1;
    const v = noise2(x * 3, z * 3);
    const c1 = v < 0.5 ? C.leaf : C.leaf2;
    b.at(x, y, z, v * 6, s).sway(0).loft([{ y: 0, x: 0.42 }, { y: 0.9, x: 0.28 }, { y: 2.1, x: 0.2 }], C.bark, { seg: 6 });
    b.sway(0.55);
    b.ball(0, 2.85, 0, 1.4, 1.2, 1.4, C.leaf2, { seg: 8, rows: 5, lump: 0.12 });
    for (let i = 0; i < 5; i++) {
      const a = i * 1.257 + v * 6;
      b.ball(Math.cos(a) * 1.15, 2.45 + (i % 2) * 0.6, Math.sin(a) * 1.15, 0.95, 0.8, 0.95, i % 2 ? c1 : C.leaf, { seg: 7, rows: 4, lump: 0.14 });
    }
    b.ball(-0.15, 3.8, 0.1, 0.95, 0.74, 0.95, C.leaf3, { seg: 7, rows: 4, lump: 0.14 });
    b.sway(0);
    solid(x, z, 0.5 * s);
    shade(x, z, 2 * s);
  }
  function pine(x, z, s = 1) {
    const y = heightAt(x, z) - 0.1;
    b.at(x, y, z, noise2(x, z) * 6, s).sway(0).loft([{ y: 0, x: 0.34 }, { y: 1.1, x: 0.24 }], C.bark2, { seg: 6 });
    b.sway(0.4);
    for (let i = 0; i < 3; i++) {
      const by = 0.9 + i * 1.25, r = 1.9 - i * 0.48;
      b.loft([{ y: by, x: r * 0.82 }, { y: by + 0.14, x: r }, { y: by + 1.7, x: 0.08 }], i === 2 ? C.pine : C.pine2, { seg: 9, lump: 0.1 });
    }
    b.sway(0);
    solid(x, z, 0.45 * s);
    shade(x, z, 1.7 * s);
  }
  function palm(x, z, s = 1) {
    const y = heightAt(x, z) - 0.1;
    const lean = noise2(x, z) * 6.3;
    const lx = Math.cos(lean) * 0.26, lz = Math.sin(lean) * 0.26;
    const rings = [];
    for (let i = 0; i <= 5; i++) rings.push({ y: i * 0.95, x: 0.3 - i * 0.025, dx: (i * i * lx) / 2.4, dz: (i * i * lz) / 2.4, c: i % 2 ? C.bark : C.bark2 });
    b.at(x, y, z, 0, s).sway(0).loft(rings, C.bark, { seg: 6 });
    const tx = x + (25 * lx * s) / 2.4, ty = y + 4.75 * s, tz = z + (25 * lz * s) / 2.4;
    soft.sway(0.7);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + lean;
      soft.at(tx + Math.cos(a) * 1.2 * s, ty - 0.12, tz - Math.sin(a) * 1.2 * s, a, s, 0, -0.4);
      soft.ball(0, 0, 0, 1.5, 0.11, 0.38, i % 2 ? C.palm : C.leaf3, { seg: 7, rows: 3, shade: 0 });
    }
    b.sway(0).at(tx, ty - 0.18, tz, 0, s).ball(0.16, 0, 0.1, 0.2, 0.2, 0.2, C.bark2, { seg: 5, rows: 3 }).ball(-0.15, -0.05, -0.06, 0.2, 0.2, 0.2, C.bark2, { seg: 5, rows: 3 });
    solid(x, z, 0.4 * s);
    shade(tx, tz, 2 * s);
  }
  function rock(x, z, s = 1) {
    const y = heightAt(x, z);
    b.at(x, y, z, noise2(x, z) * 6, s).sway(0).ball(0, 0.35, 0, 1, 0.75, 0.85, noise2(z, x) < 0.5 ? C.rock : C.rock2, { seg: 7, rows: 4, lump: 0.32 });
    if (s > 0.8) solid(x, z, 0.9 * s);
    shade(x, z, 1.1 * s);
  }
  function bush(x, z, s = 1, flower = C.pink) {
    const y = heightAt(x, z);
    b.at(x, y, z, noise2(x, z) * 6, s).sway(0.25).ball(0, 0.45, 0, 0.85, 0.65, 0.85, C.leaf2, { seg: 7, rows: 4, lump: 0.28 });
    for (let i = 0; i < 4; i++) b.ball(Math.cos(i * 2.1) * 0.55, 0.72, Math.sin(i * 2.1) * 0.5, 0.13, 0.13, 0.13, flower, { seg: 4, rows: 2 });
    b.sway(0);
    shade(x, z, 0.8 * s);
  }
  function house(x, z, ry, o) {
    const y = heightAt(x, z) - 0.15;
    const w = o.w ?? 5.4, d = o.d ?? 4.6, h = o.h ?? 3, rh = o.rh ?? 2.6;
    const lift = o.stilt ?? 0;
    b.at(x, y, z, ry).sway(0);
    if (lift) for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.rod([(a * w) / 2.5, -0.5, (c * d) / 2.5], [(a * w) / 2.5, lift + 0.2, (c * d) / 2.5], 0.16, 0.14, C.plank2);
    b.at(x, y + lift, z, ry);
    b.loft([{ y: 0, x: w * 0.53, z: d * 0.53, c: mixc(o.wall, C.navy, 0.16) }, { y: 0.5, x: w * 0.51, z: d * 0.51 }, { y: h * 0.75, x: w * 0.48, z: d * 0.48 }, { y: h, x: w * 0.46, z: d * 0.46 }], o.wall, { n: 5, seg: 14, shade: 0.1 });
    b.loft([
      { y: h - 0.2, x: w * 0.68, z: d * 0.7, c: mixc(o.roof, C.navy, 0.22) },
      { y: h + 0.06, x: w * 0.7, z: d * 0.72 },
      { y: h + rh * 0.45, x: w * 0.46, z: d * 0.5 },
      { y: h + rh * 0.86, x: w * 0.16, z: d * 0.2 },
      { y: h + rh, x: w * 0.03, z: d * 0.05 },
    ], o.roof, { n: o.roofN ?? 3, seg: 14, shade: 0.1, bottom: true });
    b.block(0, 0, d * 0.5, 1.15, 1.9, 0.26, C.door, { n: 4, seg: 10, bevel: 0.05 });
    b.ball(0.3, 0.95, d * 0.5 + 0.17, 0.07, 0.07, 0.07, C.win, { seg: 4, rows: 2 });
    for (const side of [-1, 1]) {
      b.ball(side * w * 0.3, 1.75, d * 0.5, 0.48, 0.48, 0.1, C.white, { seg: 8, rows: 3 });
      b.ball(side * w * 0.3, 1.75, d * 0.5 + 0.06, 0.37, 0.37, 0.09, C.win, { seg: 8, rows: 3, shade: 0 });
    }
    if (o.chimney) b.loft([{ y: h + rh * 0.3, x: 0.36 }, { y: h + rh * 0.95, x: 0.3 }, { y: h + rh * 1.05, x: 0.38 }], C.rock2, { n: 4, seg: 8, }).at(x, y, z, ry);
    lamps.push([x + Math.sin(ry) * (d * 0.5 + 1), y + lift + 1.8, z + Math.cos(ry) * (d * 0.5 + 1), 0.8]);
    solid(x, z, Math.max(w, d) * 0.62);
    if (w > d * 1.2 || d > w * 1.2) {
      const ax = Math.cos(ry), az = -Math.sin(ry), off = Math.max(w, d) * 0.3;
      solid(x + ax * off, z + az * off, Math.min(w, d) * 0.6);
      solid(x - ax * off, z - az * off, Math.min(w, d) * 0.6);
    }
    shade(x, z, Math.max(w, d) * 0.85);
  }
  function dome(x, z, r, ry) {
    const y = heightAt(x, z) - 0.15;
    b.at(x, y, z, ry).sway(0);
    const rings = [];
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 0.5;
      rings.push({ y: Math.sin(a) * r * 0.92, x: Math.max(0.02, Math.cos(a)) * r });
    }
    b.loft(rings, C.salt, { seg: 14, shade: 0.12 });
    b.block(0, 0, r * 0.92, 1.1, 1.8, 0.5, C.trim, { n: 4, seg: 10 });
    b.ball(0, r * 0.95, 0, 0.32, 0.5, 0.32, C.trim, { seg: 6, rows: 3 });
    for (const side of [-1, 1]) b.ball(side * r * 0.6, r * 0.42, r * 0.72, 0.3, 0.3, 0.1, C.win, { seg: 7, rows: 3, shade: 0 });
    lamps.push([x + Math.sin(ry) * (r + 1), y + 1.4, z + Math.cos(ry) * (r + 1), 0.8]);
    solid(x, z, r);
    shade(x, z, r * 1.2);
  }
  function tent(x, z, ry, cloth) {
    const y = heightAt(x, z) - 0.1;
    b.at(x, y, z, ry).sway(0);
    b.loft([{ y: 0, x: 2.5, c: mixc(cloth, C.navy, 0.2) }, { y: 0.6, x: 2.45 }, { y: 2.4, x: 1.5 }, { y: 4.4, x: 0.5 }, { y: 5.3, x: 0.06 }], cloth, { n: 2.4, seg: 12, shade: 0.1 });
    b.loft([{ y: 2.3, x: 1.62 }, { y: 2.55, x: 1.45 }], C.cream, { seg: 12, top: false, shade: 0 });
    b.block(0, 0, 2.3, 1, 1.9, 0.3, C.navy, { n: 4, seg: 8 });
    b.rod([0, 5.1, 0], [0, 6.2, 0], 0.05, 0.04, C.plank2);
    b.sway(0.5).ball(0.34, 5.98, 0, 0.32, 0.18, 0.04, C.orange, { seg: 6, rows: 2 }).sway(0);
    lamps.push([x + Math.sin(ry) * 3.2, y + 1.6, z + Math.cos(ry) * 3.2, 0.8]);
    solid(x, z, 2.5);
    shade(x, z, 3);
  }
  function lampPost(x, z) {
    const y = heightAt(x, z);
    b.at(x, y, z).sway(0).rod([0, 0, 0], [0, 3, 0], 0.1, 0.07, C.navy).ball(0, 3.15, 0, 0.3, 0.32, 0.3, C.win, { seg: 7, rows: 3, shade: 0 }).loft([{ y: 3.4, x: 0.42 }, { y: 3.7, x: 0.04 }], C.navy, { seg: 8, bottom: true });
    lamps.push([x, y + 3.2, z, 1.4]);
    solid(x, z, 0.2);
  }
  function fence(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / 2.2));
    let py = 0, px = 0, pz = 0;
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n, y = heightAt(x, z);
      b.at().sway(0).rod([x, y - 0.1, z], [x, y + 1, z], 0.1, 0.08, C.plank2);
      if (i) b.rod([px, py + 0.72, pz], [x, y + 0.72, z], 0.05, 0.05, C.plank);
      px = x; py = y; pz = z;
      solid(x, z, 0.28);
    }
  }
  function crate(x, z, s = 1) {
    const y = heightAt(x, z);
    b.at(x, y, z, noise2(x, z) * 2, s).sway(0).block(0, 0, 0, 1.1, 1, 1.1, C.plank, { n: 7, seg: 12, bevel: 0.06 }).block(0, 0.42, 0, 1.17, 0.16, 1.17, C.plank2, { n: 7, seg: 12, bevel: 0.03 });
    solid(x, z, 0.65 * s);
  }
  function barrel(x, z, c = C.plank) {
    const y = heightAt(x, z);
    b.at(x, y, z).sway(0).loft([{ y: 0, x: 0.42 }, { y: 0.5, x: 0.54 }, { y: 1.05, x: 0.42 }], c, { seg: 9 });
    solid(x, z, 0.5);
  }
  function sack(x, z, c) {
    const y = heightAt(x, z);
    b.at(x, y, z, noise2(x, z) * 6).sway(0).ball(0, 0.42, 0, 0.56, 0.48, 0.5, c, { seg: 8, rows: 4, lump: 0.12 }).ball(0, 0.92, 0, 0.14, 0.14, 0.14, C.rope, { seg: 5, rows: 2 });
  }
  function stall(x, z, ry, stripe) {
    const y = heightAt(x, z);
    b.at(x, y, z, ry).sway(0);
    b.block(0, 0, 0, 3.4, 1.05, 1.4, C.plank, { n: 7, seg: 12 });
    for (const [a, c] of [[-1.55, -0.9], [1.55, -0.9], [-1.55, 0.7], [1.55, 0.7]]) b.rod([a, 0, c], [a, 2.9, c], 0.08, 0.08, C.plank2);
    for (let i = 0; i < 6; i++) {
      const sx = -1.7 + i * 0.68;
      b.loft([{ y: 2.72, x: 0.35, z: 1.26, dx: sx, dz: 0.36 }, { y: 3.2, x: 0.35, z: 0.86, dx: sx, dz: -0.1 }], i % 2 ? C.cream : stripe, { n: 8, seg: 8, shade: 0 });
    }
    solid(x, z, 1.5);
    shade(x, z, 2.1);
  }

  // ---- the villages
  const vs = Object.fromEntries(VILLAGES.map((v) => [v.role, v]));
  {
    const v = vs.saltmaker;
    dome(v.x - 5, v.z - 7, 3.1, 0.3);
    dome(v.x + 6, v.z - 6, 2.6, -0.4);
    dome(v.x - 8, v.z + 3, 2.4, 1.3);
    for (const [a, c, s] of [[7, 4, 1.3], [5, 8, 1], [9, 7, 0.9], [-4, 8, 1.1]]) {
      const x = v.x + a, z = v.z + c, y = heightAt(x, z);
      b.at(x, y - 0.05, z, a, s).loft([{ y: 0, x: 1.5, c: C.salt }, { y: 0.8, x: 0.95 }, { y: 1.5, x: 0.1 }], C.white, { seg: 9, lump: 0.1 });
      solid(x, z, 1.2 * s);
      shade(x, z, 1.5 * s);
    }
    for (const a of [[-3, 7], [1.5, -11], [12, -2]]) sack(v.x + a[0], v.z + a[1], C.white);
    paint.push({ kind: "pans", x: v.x - 10, z: v.z + 13 });
    lampPost(v.x + 1, v.z + 2);
  }
  {
    const v = vs.fisher;
    house(v.x - 7, v.z - 7, 0.35, { wall: C.blue, roof: C.orange, stilt: 0.8, chimney: true });
    house(v.x + 7, v.z - 6, -0.3, { wall: C.cream, roof: C.trim, stilt: 0.8, w: 5, d: 4.2 });
    house(v.x + 9, v.z + 3, -1.2, { wall: C.teal, roof: C.red, stilt: 0.8, w: 4.6, d: 4 });
    for (const a of [[-2, -9], [-11, 0], [3, -10]]) barrel(v.x + a[0], v.z + a[1]);
    crate(v.x - 12, v.z + 3);
    for (const a of [[-4, 7], [6, 8]]) sack(v.x + a[0], v.z + a[1], C.teal);
    lampPost(v.x - 2, v.z + 2);
  }
  {
    const v = vs.farmer;
    house(v.x - 7, v.z - 6, 0.5, { wall: C.wall, roof: C.straw, w: 5, d: 4.4, roofN: 2.4 });
    house(v.x + 7, v.z - 7, -0.5, { wall: C.wall2, roof: C.straw2, w: 4.8, d: 4.2, roofN: 2.4, chimney: true });
    for (const a of [[-3, 8], [3, 9]]) sack(v.x + a[0], v.z + a[1], C.straw);
    lampPost(v.x, v.z + 1);
    paint.push({ kind: "paddy", x: v.x + 13, z: v.z + 9 });
    paint.push({ kind: "paddy", x: v.x - 10, z: v.z + 14 });
    // the crop itself, a low golden sway
    for (const [cx, cz] of [[v.x + 13, v.z + 9], [v.x - 10, v.z + 14]])
      for (let i = 0; i < (rich ? 7 : 5); i++)
        for (let k = 0; k < (rich ? 7 : 5); k++) {
          const x = cx - 6.5 + ((i + 0.5) * 13) / (rich ? 7 : 5), z = cz - 5 + ((k + 0.5) * 10) / (rich ? 7 : 5), y = heightAt(x, z);
          if (y < 0.1) continue;
          const leaf = (i + k) % 3 ? C.straw : hex("#b8d65a");
          soft.sway(0.8);
          for (let t = 0; t < 4; t++) {
            const a = t * 1.57 + i, r = 0.26;
            soft.at(x + Math.cos(a) * r, y - 0.05, z + Math.sin(a) * r, a, 1, Math.cos(a) * 0.16, Math.sin(a) * 0.16);
            soft.loft([{ y: 0, x: 0.1 }, { y: 0.8, x: 0.07 }, { y: 1.35, x: 0.015 }], leaf, { seg: 4, shade: 0.4 });
          }
          soft.sway(0);
        }
  }
  {
    const v = vs.weaver;
    tent(v.x - 6, v.z - 7, 0.5, C.violet);
    tent(v.x + 7, v.z - 7, -0.5, C.pink);
    tent(v.x - 10, v.z + 2, 1.3, C.teal);
    // washing lines of cloth, swaying
    const cloths = [C.violet, C.pink, C.orange, C.trim, C.straw];
    for (const [x0, z0, x1, z1] of [[v.x - 2, v.z + 7, v.x + 9, v.z + 3], [v.x - 7, v.z + 11, v.x + 3, v.z + 11]]) {
      const y0 = heightAt(x0, z0), y1 = heightAt(x1, z1);
      b.at().sway(0).rod([x0, y0, z0], [x0, y0 + 3.2, z0], 0.09, 0.07, C.plank2).rod([x1, y1, z1], [x1, y1 + 3.2, z1], 0.09, 0.07, C.plank2).rod([x0, y0 + 3.05, z0], [x1, y1 + 3.05, z1], 0.025, 0.025, C.rope);
      solid(x0, z0, 0.2);
      solid(x1, z1, 0.2);
      for (let i = 0; i < 4; i++) {
        const t = (i + 0.5) / 4, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = y0 + 3;
        const ry = Math.atan2(z1 - z0, x1 - x0);
        b.at(x, y, z, -ry).sway(0.8).block(0, -1.45, 0, 1.25, 1.45, 0.05, cloths[(i * 2 + (x0 | 0)) % 5], { n: 8, seg: 8, bevel: 0.02, shade: 0.25 }).sway(0);
      }
    }
    lampPost(v.x + 1, v.z);
    for (const a of [[9, -1], [-3, -2]]) sack(v.x + a[0], v.z + a[1], C.violet);
  }
  {
    const v = vs.logger;
    house(v.x - 8, v.z + 6, 0.8, { wall: hex("#b67f55"), roof: C.orange, w: 5.2, d: 4.4, chimney: true });
    house(v.x + 8, v.z + 7, -0.7, { wall: hex("#a87048"), roof: C.red, w: 4.8, d: 4.2 });
    for (let k = 0; k < 2; k++) {
      const x = v.x - 3 + k * 8, z = v.z - 6 + k;
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3 - i; j++) {
          const lx = (j - (2 - i) / 2) * 0.75, ly = heightAt(x, z) + 0.36 + i * 0.64;
          b.at(x + lx, ly, z, 0, 1, 1.57).sway(0).loft([{ y: -1.5, x: 0.36, c: C.plank }, { y: 1.5, x: 0.36, c: C.plank }], C.bark, { seg: 8, bottom: true });
        }
      solid(x, z, 1.5);
      shade(x, z, 2);
    }
    lampPost(v.x, v.z + 2);
  }

  // ---- market square: stalls around the town money pillar
  {
    const v = SQUARE;
    const stalls = [[-9, -5, 0.9, C.red], [9, -5, -0.9, C.trim], [-10, 6, 2.1, C.orange], [10, 6, -2.1, C.violet]];
    for (const [a, c, ry, col] of stalls) stall(v.x + a, v.z + c, ry, col);
    for (const [a, c] of [[0, -11], [-6, 9.5], [6, 9.5]]) lampPost(v.x + a, v.z + c);
    const y = heightAt(v.x, v.z);
    b.at(v.x, y, v.z).sway(0);
    b.loft([{ y: 0, x: 3.3, c: C.rock2 }, { y: 0.5, x: 3.1 }, { y: 0.6, x: 2.5 }, { y: 1, x: 2.3 }, { y: 1.1, x: 1.5 }, { y: 2.7, x: 1.05 }, { y: 3, x: 1.5 }], C.rock, { seg: 16, shade: 0.2 });
    solid(v.x, v.z, 3.1);
    shade(v.x, v.z, 3.8);
    paint.push({ kind: "square", x: v.x, z: v.z });
  }

  // ---- wreck beach: camp, shipwright, hammock
  {
    const v = CAMP;
    tent(v.x + 6, v.z - 7, -0.6, C.trim);
    const fx = v.x + 1, fz = v.z - 4, y = heightAt(fx, fz);
    for (let i = 0; i < 7; i++) rock(fx + Math.cos(i * 0.9) * 1, fz + Math.sin(i * 0.9) * 1, 0.28);
    b.at(fx, y, fz).sway(0).rod([-0.5, 0.05, 0], [0.5, 0.4, 0.1], 0.1, 0.08, C.bark2).rod([0.5, 0.05, -0.2], [-0.4, 0.4, 0.2], 0.1, 0.08, C.bark);
    solid(fx, fz, 0.9);
    // hammock between two palms
    const hx = v.x + 14, hz = v.z + 2;
    palm(hx - 3, hz, 0.9);
    palm(hx + 3, hz + 0.6, 1);
    const hy = heightAt(hx, hz);
    b.at(hx, hy, hz).sway(0).ball(0, 1, 0.2, 2.2, 0.28, 0.6, C.orange, { seg: 10, rows: 4 });
    objects.push({ kind: "bed", x: hx, z: hz + 1.5, label: "Sleep until morning" });
    // shipwright's bench
    const sx = WRECK.x + 7, sz = WRECK.z - 11;
    b.at(sx, heightAt(sx, sz), sz, 0.5).sway(0).block(0, 0, 0, 3.2, 1, 1.3, C.plank, { n: 7, seg: 12 }).block(0, 1, 0, 3.4, 0.14, 1.5, C.plank2, { n: 7, seg: 12, bevel: 0.04 });
    solid(sx, sz, 1.5);
    shade(sx, sz, 2);
    objects.push({ kind: "yard", x: sx, z: sz + 1.5, label: "Shipyard" });
    for (const a of [[-3.5, -1], [-3, 1.4]]) crate(sx + a[0], sz + a[1], 0.8);
    lampPost(sx + 3, sz - 2);
    lampPost(v.x + 3, v.z + 1);
  }

  // ---- bridges and piers
  for (const br of BRIDGES) {
    b.at(br.x, 0, br.z).sway(0);
    const n = 11;
    for (let i = 0; i <= n; i++) {
      const x = -8.2 + (i * 16.4) / n, y = 1.25 + (1 - (x / 8.5) ** 2) * 1.05;
      b.block(x, y - 0.22, 0, 1.46, 0.22, 4.6, i % 2 ? C.plank : hex("#e4b57e"), { n: 8, seg: 8, bevel: 0.05 });
      for (const side of [-1, 1]) if (i % 2 === 0) b.rod([x, y - 1.5, side * 2.15], [x, y + 1, side * 2.15], 0.12, 0.09, C.plank2);
    }
    for (const side of [-1, 1]) {
      let px = -8.2;
      for (let i = 1; i <= n; i += 1) {
        const x = -8.2 + (i * 16.4) / n;
        const py = 1.25 + (1 - (px / 8.5) ** 2) * 1.05, y = 1.25 + (1 - (x / 8.5) ** 2) * 1.05;
        b.rod([px, py + 0.85, side * 2.15], [x, y + 0.85, side * 2.15], 0.06, 0.06, C.plank2);
        px = x;
      }
    }
  }
  DOCKS.forEach((d, i) => {
    const ry = Math.atan2(d.dx, d.dz);
    b.at(d.x, 0, d.z, ry).sway(0);
    const n = Math.ceil(d.len / 1.25);
    for (let k = 0; k <= n; k++) {
      const z = -0.6 + (k * (d.len + 0.6)) / n;
      b.block(0, 0.86, z, 3, 0.2, 1.1, k % 2 ? C.plank : hex("#e4b57e"), { n: 8, seg: 8, bevel: 0.05 });
      if (k % 2 === 0) for (const s of [-1, 1]) b.rod([s * 1.3, -2, z], [s * 1.3, 1.5, z], 0.12, 0.1, C.plank2);
    }
    const ex = d.x + d.dx * (d.len - 0.4), ez = d.z + d.dz * (d.len - 0.4);
    objects.push({ kind: "dock", x: ex, z: ez, d, i, label: "Fish here" });
    lamps.push([ex + d.dz * 1.3, 2.2, ez - d.dx * 1.3, 0.8]);
    b.at(d.x + d.dx * d.len, 0, d.z + d.dz * d.len, ry).rod([1.3, 0.8, 0], [1.3, 2.4, 0], 0.08, 0.07, C.navy).ball(1.3, 2.5, 0, 0.2, 0.22, 0.2, C.win, { seg: 6, rows: 3, shade: 0 });
  });

  // ---- lighthouse on the north east hill
  {
    const x = 94, z = 16, y = heightAt(x, z) - 0.3;
    b.at(x, y, z).sway(0);
    const rings = [];
    for (let i = 0; i <= 8; i++) rings.push({ y: i * 1.6, x: 2.5 - i * 0.14, c: i % 4 < 2 ? C.white : C.red });
    b.loft(rings, C.white, { seg: 14, shade: 0.06 });
    b.loft([{ y: 12.8, x: 2.1 }, { y: 13.2, x: 2 }], C.navy, { seg: 14 });
    b.loft([{ y: 13.2, x: 1.1 }, { y: 15, x: 1.05 }], C.win, { seg: 12, top: false, shade: 0 });
    b.loft([{ y: 14.9, x: 1.5 }, { y: 16.6, x: 0.08 }], C.red, { seg: 12, bottom: true });
    solid(x, z, 2.6);
    shade(x, z, 3.4);
  }

  // ---- planting
  const clear = (x, z, r) => {
    if (hitSolid(x, z, r)) return false;
    for (const [px, pz, pr] of PADS) if (Math.hypot(x - px, z - pz) < pr + 1) return false;
    if (Math.hypot(x - WRECK.x, z - WRECK.z) < 17 || Math.hypot(x - CAMP.x, z - CAMP.z) < 19) return false;
    for (const [a, c] of EDGES) {
      const [ax, az] = NODES[a], [bx, bz] = NODES[c];
      const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l));
      if (Math.hypot(x - ax - dx * t, z - az - dz * t) < 4.6 + r) return false;
    }
    if (Math.abs(x - riverX(z)) < 7 + r && z > 18) return false;
    return true;
  };
  let planted = 0;
  const target = rich ? 96 : 56;
  for (let i = 0; i < 900 && planted < target; i++) {
    const x = 6 + noise2(i, 7) * 116, z = 6 + noise2(i, 13) * 116;
    const l = shore(x, z);
    const y = heightAt(x, z);
    if (l < 1 || y < 0.3 || !clear(x, z, 1.6)) continue;
    const near = Math.hypot(x - vs.logger.x, z - vs.logger.z);
    if (l < 15) palm(x, z, 0.8 + noise2(i, 3) * 0.3);
    else if (near < 26 || y > 3) pine(x, z, 0.95 + noise2(i, 5) * 0.55);
    else tree(x, z, 0.85 + noise2(i, 5) * 0.5);
    planted++;
  }
  for (let i = 0; i < (rich ? 60 : 30); i++) {
    const x = 6 + noise2(i, 21) * 116, z = 6 + noise2(i, 33) * 116;
    if (shore(x, z) < 2 || !clear(x, z, 0.6)) continue;
    i % 3 ? bush(x, z, 0.8 + noise2(i, 1) * 0.5, [C.pink, C.white, C.straw][i % 3]) : rock(x, z, 0.5 + noise2(i, 2) * 0.7);
  }
  for (let i = 0; i < 16; i++) {
    const a = noise2(i, 44) * 6.28, d = 50 + noise2(i, 45) * 8;
    const x = CX + Math.cos(a) * d, z = CZ + Math.sin(a) * d;
    if (heightAt(x, z) > -0.4 && heightAt(x, z) < 0.6) rock(x, z, 0.6 + noise2(i, 46) * 0.8);
  }

  // Where the villagers stand: a loose ring, clear of walls and water.
  for (const v of VILLAGES) {
    spots[v.role] = [];
    for (let i = 0; i < 80 && spots[v.role].length < 8; i++) {
      const a = (i * 2.4) % 6.28, r = 3.5 + (i % 5) * 1.5;
      const x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r * 0.85;
      if (hitSolid(x, z, 1.1)) continue;
      if (spots[v.role].some((s) => Math.hypot(s.x - x, s.z - z) < 2.8)) continue;
      spots[v.role].push({ x, z });
    }
  }

  // ---- bake it all in
  const staticGeo = b.build();
  const props = new THREE.Mesh(staticGeo, toon);
  props.frustumCulled = false;
  scene.add(props);
  if (rich) {
    const line = new THREE.Mesh(staticGeo, ink);
    line.frustumCulled = false;
    scene.add(line);
  }

  const softMesh = new THREE.Mesh(soft.build(), toon);
  softMesh.frustumCulled = false;
  scene.add(softMesh);

  const noise = cloudTexture();
  const ground = paintGround(rich ? 2048 : 1024, paint, shadows);
  const terrain = makeTerrain(ground, noise);
  scene.add(terrain);
  const water = makeWater(noise);
  scene.add(water);

  return { objects, spots, lamps, tris: staticGeo.index.count / 3 + softMesh.geometry.index.count / 3, ground, noise, water, terrain, line: scene.children.find((c) => c.material === ink) };
}

// A soft tiling noise used by the water, the cloud shadows and the rain.
function cloudTexture() {
  const S = 128;
  const d = new Uint8Array(S * S * 4);
  const n = (x, y, p) => {
    const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
    const w = (v) => ((v % p) + p) % p;
    const a = noise2(w(ix), w(iy)), b = noise2(w(ix + 1), w(iy)), c = noise2(w(ix), w(iy + 1)), e = noise2(w(ix + 1), w(iy + 1));
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + e) * sx * sy;
  };
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = (x / S) * 32, v = (y / S) * 32;
      const a = n(u / 4, v / 4, 8) * 0.55 + n(u / 2, v / 2, 16) * 0.3 + n(u, v, 32) * 0.15;
      const i = (x + y * S) * 4;
      d[i] = d[i + 1] = d[i + 2] = a * 255;
      d[i + 3] = 255;
    }
  const t = new THREE.DataTexture(d, S, S);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

function paintGround(size, paint, shadows) {
  const B = 512;
  const low = document.createElement("canvas");
  low.width = low.height = B;
  const lc = low.getContext("2d");
  const img = lc.createImageData(B, B);
  const sand = hex("#ffe7b0"), sand2 = hex("#f4cf8e"), wet = hex("#d8b279"), floor = hex("#7fd0c6");
  const g1 = hex("#92e36f"), g2 = hex("#5fcd68"), g3 = hex("#c2ec6e"), high = hex("#3fb474"), stone = hex("#b7a999");
  for (let py = 0; py < B; py++)
    for (let px = 0; px < B; px++) {
      const x = ((px + 0.5) / B) * SIZE, z = ((py + 0.5) / B) * SIZE;
      const h = heightAt(x, z);
      const sx = heightAt(x + 1, z) - heightAt(x - 1, z), sz = heightAt(x, z + 1) - heightAt(x, z - 1);
      const slope = Math.hypot(sx, sz) / 2;
      const n1 = smooth(x * 3, z * 3, 26), n2 = smooth(x * 7 + 9, z * 7 + 3, 22);
      let c;
      const dry = sstep(0.75, 1.15, h + (n2 - 0.5) * 0.5);
      if (h < -0.15) c = mixc(floor, wet, sstep(-2.2, -0.15, h));
      else {
        const s = mixc(wet, mixc(sand, sand2, n1), sstep(-0.1, 0.32, h));
        let g = mixc(g1, g2, sstep(0.3, 0.7, n1));
        g = mixc(g, g3, sstep(0.55, 0.8, n2) * 0.7);
        g = mixc(g, high, sstep(2.5, 6, h) * 0.8);
        g = mixc(g, stone, sstep(0.55, 1.05, slope));
        c = mixc(s, g, dry);
      }
      const lit = 1 + Math.max(-0.26, Math.min(0.22, (-sx * 0.5 - sz * 0.42) * 0.42));
      const i = (px + py * B) * 4;
      img.data[i] = Math.min(255, c[0] * lit * 255);
      img.data[i + 1] = Math.min(255, c[1] * lit * 255);
      img.data[i + 2] = Math.min(255, c[2] * lit * 255);
      img.data[i + 3] = 255;
    }
  lc.putImageData(img, 0, 0);

  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d");
  g.imageSmoothingQuality = "high";
  g.drawImage(low, 0, 0, size, size);
  const k = size / SIZE;
  g.lineCap = g.lineJoin = "round";

  // tufts and flowers
  for (let i = 0; i < 9000; i++) {
    const x = noise2(i, 1) * SIZE, z = noise2(i, 2) * SIZE;
    const h = heightAt(x, z);
    if (h < 0.95) continue;
    const dark = noise2(i, 3) < 0.55;
    g.strokeStyle = dark ? "rgba(36,120,86,.15)" : "rgba(226,255,170,.2)";
    g.lineWidth = k * 0.07;
    const l = k * (0.14 + noise2(i, 4) * 0.2);
    g.beginPath();
    g.moveTo(x * k, z * k);
    g.lineTo(x * k + l * 0.4, z * k - l);
    g.moveTo(x * k + k * 0.1, z * k);
    g.lineTo(x * k - l * 0.3, z * k - l * 0.8);
    g.stroke();
  }
  const blooms = ["#ffffff", "#ff9ecb", "#ffe27a", "#b9a6ff"];
  for (let i = 0; i < 1400; i++) {
    const cx = noise2(i, 5) * SIZE, cz = noise2(i, 6) * SIZE;
    if (smooth(cx, cz, 9) < 0.6 || heightAt(cx, cz) < 1) continue;
    g.fillStyle = blooms[i % 4];
    g.beginPath();
    g.arc(cx * k, cz * k, k * 0.1, 0, 7);
    g.fill();
  }
  // sand speckle
  for (let i = 0; i < 3000; i++) {
    const x = noise2(i, 8) * SIZE, z = noise2(i, 9) * SIZE;
    const h = heightAt(x, z);
    if (h < 0.05 || h > 0.8) continue;
    g.fillStyle = i % 2 ? "rgba(160,110,60,.2)" : "rgba(255,255,255,.4)";
    g.fillRect(x * k, z * k, k * 0.08, k * 0.08);
  }

  // roads: dark edge, warm body, a lighter worn middle, then stones
  const road = (w, style) => {
    g.strokeStyle = style;
    g.lineWidth = w * k;
    for (const [a, c] of EDGES) {
      const [ax, az] = NODES[a], [bx, bz] = NODES[c];
      const mx = (ax + bx) / 2 + (noise2(ax | 0, bz | 0) - 0.5) * 7, mz = (az + bz) / 2 + (noise2(bx | 0, az | 0) - 0.5) * 7;
      g.beginPath();
      g.moveTo(ax * k, az * k);
      g.quadraticCurveTo(mx * k, mz * k, bx * k, bz * k);
      g.stroke();
    }
  };
  road(3.9, "rgba(120,86,50,.3)");
  road(3.3, "#e9cc92");
  road(2, "#f3deae");
  for (const v of [...VILLAGES, CAMP]) {
    const grad = g.createRadialGradient(v.x * k, v.z * k, 0, v.x * k, v.z * k, 13 * k);
    grad.addColorStop(0, "rgba(243,222,174,.95)");
    grad.addColorStop(0.65, "rgba(233,204,146,.75)");
    grad.addColorStop(1, "rgba(233,204,146,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(v.x * k, v.z * k, 13 * k, 0, 7);
    g.fill();
  }

  for (const p of paint) {
    if (p.kind === "pans") {
      for (let i = 0; i < 4; i++) {
        const x = p.x + (i % 2) * 8.5, z = p.z - 8 + ((i / 2) | 0) * 7;
        g.fillStyle = "#c6f0f7";
        g.strokeStyle = "#fbfdff";
        g.lineWidth = k * 0.7;
        g.beginPath();
        g.roundRect((x - 3.8) * k, (z - 3) * k, 7.6 * k, 6 * k, k * 1.3);
        g.fill();
        g.stroke();
        g.fillStyle = "rgba(255,255,255,.75)";
        g.beginPath();
        g.ellipse(x * k, z * k, 2.3 * k, 1.1 * k, 0.4, 0, 7);
        g.fill();
      }
    } else if (p.kind === "paddy") {
      g.fillStyle = "#79c8c4";
      g.strokeStyle = "#a57e4b";
      g.lineWidth = k * 0.55;
      g.beginPath();
      g.roundRect((p.x - 7) * k, (p.z - 5.5) * k, 14 * k, 11 * k, k * 1.2);
      g.fill();
      g.stroke();
      g.strokeStyle = "rgba(255,255,255,.35)";
      g.lineWidth = k * 0.1;
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.moveTo((p.x - 6) * k, (p.z - 4 + i * 1.6) * k);
        g.lineTo((p.x + 6) * k, (p.z - 4 + i * 1.6) * k);
        g.stroke();
      }
    } else if (p.kind === "square") {
      for (let r = 13; r > 0; r -= 1.7) {
        g.fillStyle = (Math.round(r / 1.7) % 2 ? "#ead7b2" : "#dcc49a");
        g.beginPath();
        g.arc(p.x * k, p.z * k, r * k, 0, 7);
        g.fill();
      }
      g.strokeStyle = "rgba(120,86,50,.3)";
      g.lineWidth = k * 0.08;
      for (let r = 2; r < 13; r += 1.7)
        for (let a = 0; a < 40; a++) {
          const t = (a / 40) * 6.28 + r;
          g.beginPath();
          g.moveTo((p.x + Math.cos(t) * r) * k, (p.z + Math.sin(t) * r) * k);
          g.lineTo((p.x + Math.cos(t) * (r + 1.7)) * k, (p.z + Math.sin(t) * (r + 1.7)) * k);
          g.stroke();
        }
    }
  }

  // shadows the props cast, soft and a little blue
  for (const [x, z, r] of shadows) {
    const cx = (x + r * 0.35) * k, cz = (z + r * 0.3) * k, rad = r * 1.25 * k;
    const grad = g.createRadialGradient(cx, cz, rad * 0.25, cx, cz, rad);
    grad.addColorStop(0, "rgba(28,34,92,.24)");
    grad.addColorStop(1, "rgba(28,34,92,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(cx, cz, rad, 0, 7);
    g.fill();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function makeTerrain(map, noise) {
  const R = 96;
  const pos = new Float32Array((R + 1) * (R + 1) * 3);
  const uv = new Float32Array((R + 1) * (R + 1) * 2);
  const idx = [];
  for (let j = 0; j <= R; j++)
    for (let i = 0; i <= R; i++) {
      const x = (i / R) * SIZE, z = (j / R) * SIZE, k = i + j * (R + 1);
      pos.set([x, heightAt(Math.min(SIZE - 0.01, x), Math.min(SIZE - 0.01, z)), z], k * 3);
      uv.set([i / R, j / R], k * 2);
      if (i < R && j < R) idx.push(k, k + R + 1, k + 1, k + 1, k + R + 1, k + R + 2);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    uniforms: { ...U, tMap: { value: map }, tNoise: { value: noise }, uGround: { value: new THREE.Color(1, 1, 1) }, uCloud: { value: 0.2 } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vW; varying float vD;
      void main() { vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mv = viewMatrix * wp; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform sampler2D tMap, tNoise; uniform vec3 uGround, uFog; uniform float uFogNear, uFogFar, uTime, uCloud;
      varying vec2 vUv; varying vec3 vW; varying float vD;
      void main() {
        vec3 c = texture2D(tMap, vUv).rgb * uGround;
        float s = texture2D(tNoise, vW.xz * 0.0024 + vec2(uTime * 0.0022, uTime * 0.001)).r;
        c *= 1.0 - uCloud * smoothstep(0.46, 0.62, s);
        gl_FragColor = vec4(mix(c, uFog, smoothstep(uFogNear, uFogFar, vD)), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}

function makeWater(noise) {
  const R = 256;
  const data = new Uint8Array(R * R * 4);
  for (let j = 0; j < R; j++)
    for (let i = 0; i < R; i++) {
      const h = heightAt(((i + 0.5) / R) * SIZE, ((j + 0.5) / R) * SIZE);
      const v = Math.max(0, Math.min(1, -h / 6));
      const k = (i + j * R) * 4;
      data[k] = data[k + 1] = data[k + 2] = v * 255;
      data[k + 3] = 255;
    }
  const depth = new THREE.DataTexture(data, R, R);
  depth.magFilter = depth.minFilter = THREE.LinearFilter;
  depth.needsUpdate = true;
  const m = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      ...U, tDepth: { value: depth }, tNoise: { value: noise },
      uShallow: { value: new THREE.Color("#8ff0e6") }, uMid: { value: new THREE.Color("#22c6f5") }, uDeep: { value: new THREE.Color("#0b7fe0") },
      uTint: { value: new THREE.Color(1, 1, 1) }, uChop: { value: 0 },
    },
    vertexShader: `
      varying vec3 vW; varying float vD;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mv = viewMatrix * wp; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform sampler2D tDepth, tNoise; uniform vec3 uShallow, uMid, uDeep, uTint, uFog; uniform float uTime, uFogNear, uFogFar, uChop;
      varying vec3 vW; varying float vD;
      void main() {
        vec2 uv = vW.xz / 128.0;
        float inside = smoothstep(0.0, 0.05, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
        float depth = mix(1.0, texture2D(tDepth, uv).r, inside) * 6.0;
        float n1 = texture2D(tNoise, vW.xz * 0.018 + vec2(uTime * 0.012, uTime * 0.008)).r;
        float n2 = texture2D(tNoise, vW.xz * 0.04 - vec2(uTime * 0.016, -uTime * 0.01)).r;
        float d = depth + (n1 - 0.5) * 0.35;
        vec3 c = mix(uShallow, uMid, smoothstep(0.1, 1.2, d));
        c = mix(c, uDeep, smoothstep(1.2, 4.6, d));
        float n3 = texture2D(tNoise, vW.xz * 0.11 + vec2(-uTime * 0.02, uTime * 0.013)).r;
        float mixn = n2 * 0.5 + n3 * 0.5;
        float ripple = smoothstep(0.5, 0.525, mixn) * (1.0 - smoothstep(0.525, 0.55, mixn));
        c += ripple * (0.1 + uChop * 0.12);
        float wave = sin(d * 6.0 - uTime * 1.4 + n2 * 5.0);
        float foam = smoothstep(0.62, 0.92, wave) * smoothstep(1.5, 0.3, d) * 0.75;
        foam += smoothstep(0.2, 0.05, d);
        c = mix(c, vec3(1.0), min(1.0, foam));
        c *= uTint;
        float a = smoothstep(0.03, 0.14, depth) * (smoothstep(0.1, 0.5, depth) * 0.45 + 0.55);
        gl_FragColor = vec4(mix(c, uFog, smoothstep(uFogNear * 1.2, uFogFar * 1.3, vD)), a);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), m);
  mesh.position.set(CX, 0, CZ);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return mesh;
}

// ---------------------------------------------------------------- the sky
export function makeSky(scene) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uSun: U.uSun, uStars: { value: 0 } },
    vertexShader: `varying vec3 vP; void main() { vP = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 uTop, uHorizon, uGlow, uSun; uniform float uStars; varying vec3 vP;
      float hash(vec3 p) { return fract(sin(dot(floor(p * 120.0), vec3(12.7, 78.2, 37.1))) * 43758.5); }
      void main() {
        float t = pow(clamp(vP.y * 1.25 + 0.04, 0.0, 1.0), 0.62);
        vec3 c = mix(uHorizon, uTop, t);
        float s = max(dot(vP, uSun), 0.0);
        c += uGlow * (pow(s, 26.0) * 0.55 + pow(s, 420.0) * 1.6);
        float star = step(0.9965, hash(vP)) * uStars * smoothstep(0.02, 0.2, vP.y);
        gl_FragColor = vec4(c + star, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 16), m);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);
  return sky;
}

export function makeClouds(scene) {
  const b = brush();
  const col = hex("#ffffff");
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * 6.28 + noise2(i, 1), d = 70 + noise2(i, 2) * 170;
    const x = CX + Math.cos(a) * d, z = CZ + Math.sin(a) * d, y = 66 + noise2(i, 3) * 26, s = 2.6 + noise2(i, 4) * 3.2;
    b.at(x, y, z, a, s);
    for (let k = 0; k < 5; k++) b.ball((k - 2) * 2.1, Math.sin(k) * 0.3, noise2(i, k) * 1.4 - 0.7, 2.2 - Math.abs(k - 2) * 0.35, 1.25, 1.7, col, { seg: 9, rows: 5, lump: 0.1, shade: 0.28 });
  }
  const m = new THREE.Mesh(b.build(), toon);
  m.frustumCulled = false;
  scene.add(m);
  // far islets, so the first person view has a horizon
  const h = brush();
  for (const [x, z, s] of [[-120, 40, 7], [-170, 190, 9], [300, 60, 10], [290, 300, 8], [20, 420, 11], [120, -240, 9], [-90, -170, 6]]) {
    h.at(x, -1, z, x, s).ball(0, 0.4, 0, 2.4, 1, 1.9, hex("#5fb9a5"), { seg: 10, rows: 4, lump: 0.25, shade: 0.3 });
    h.ball(0.5, 1.2, 0.1, 1.1, 0.8, 0.9, hex("#4fa892"), { seg: 8, rows: 4, lump: 0.2 });
  }
  const islets = new THREE.Mesh(h.build(), toon);
  islets.frustumCulled = false;
  scene.add(islets);
  return m;
}

// Rain as long streaks, moved entirely in the vertex shader.
export function makeRain(scene, count) {
  const pos = new Float32Array(count * 2 * 3);
  const seed = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = (noise2(i, 1) - 0.5) * 90, z = (noise2(i, 2) - 0.5) * 90, y = noise2(i, 3);
    pos.set([x, y, z, x, y, z], i * 6);
    seed[i * 2] = 0;
    seed[i * 2 + 1] = 1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("end", new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: U.uTime, uDrop: { value: new THREE.Vector3() } },
    vertexShader: `
      attribute float end; uniform float uTime; uniform vec3 uDrop; varying float vA;
      void main() {
        float y = fract(position.y - uTime * 1.5) * 44.0;
        vec3 p = vec3(position.x + y * 0.16, y + end * 1.5, position.z) + vec3(uDrop.x, 0.0, uDrop.z);
        vA = end;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `varying float vA; void main() { gl_FragColor = vec4(0.82, 0.92, 1.0, 0.1 + vA * 0.42); }`,
  });
  const r = new THREE.LineSegments(g, m);
  r.frustumCulled = false;
  r.renderOrder = 3;
  r.visible = false;
  scene.add(r);
  return r;
}
