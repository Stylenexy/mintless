// Mintless: shipwrecked on an island with no coins. Fish, barter with forty
// villagers, and pay the shipwright in whatever the town takes most, before the
// tenth night. The town runs on the same engine the tests and the NEAR contract
// check; this file is only the body around it.
import * as THREE from "three";
import { createTown } from "../engine/town.js";
import { SALT_TOWN } from "../rules/town.js";
import { mysteryRules } from "../engine/mystery.js";
import { answer, wantsOf, offer } from "../engine/visitor.js";
import { createRun, catchFish, shopGood, buyPart, buyGear, bestGive, routeTo, worthNow, nightFall, nextPart, boatDone, bagCount, playDay, PARTS, GEAR, DAYS, TOWN_DAYS_PER_NIGHT } from "../engine/island.js";
import { U, toon, ink, inked, hex, noise2, brush, sstep } from "./kit.js";
import { SIZE, VILLAGES, SQUARE, CAMP, WRECK, DOCKS, NODES, EDGES, buildIsland, heightAt, groundAt, hitSolid, makeSky, makeClouds, makeRain } from "./island3d.js";
import { makeCrowd, makeHero, makeDuck, makeKeeper, makeBoat, goodGeo, fishGeo } from "./people.js";
import { unlockAudio, sfx, babble, ambience, music, musicMood, setMuted, isMuted } from "./audio.js";

const GOODS = ["salt", "fish", "rice", "cloth", "wood"];
const FOLK = [
  "Asih", "Bayu", "Citra", "Dimas", "Eka", "Fajar", "Gita", "Hadi",
  "Intan", "Joko", "Kirana", "Lukas", "Maya", "Nanda", "Oki", "Putri",
  "Rahmat", "Sari", "Teguh", "Umi", "Vina", "Wawan", "Yanti", "Zaki",
  "Ayu", "Bimo", "Dewi", "Galih", "Hana", "Ilham", "Kartika", "Lestari",
  "Made", "Nyoman", "Ratna", "Surya", "Tari", "Wulan", "Yoga", "Agus",
];
const ROLE = { saltmaker: "saltmaker", fisher: "fisher", farmer: "farmer", weaver: "weaver", logger: "logger" };
// Lowest seller price of a Growtopia Diamond Lock in rupiah, 2015 to Jun 2026 (riset-track/growtopia-angka.md).
const DL_PRICES = [185000, 100000, 45000, 35000, 26000, 15800, 10000, 8000, 4000, 3700, 3300, 501, 299];

const DAY_SECONDS = 80;
const FIRST_DAY_SECONDS = 150;
const WALK = 7.5, RUN = 11.5, SPRINT = 14, DUCK = 18;
const JUMP = 10.5, GRAVITY = 30;
const REACH = 3.4;
const ZOOM_MIN = 12, ZOOM_MAX = 46;
const YARD = { x: WRECK.x + 7, z: WRECK.z - 9.5 };

const $ = (id) => document.getElementById(id);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const qs = new URLSearchParams(location.search);
let ICONS = [];
const pic = (g, cls = "ic") => `<img src="${ICONS[g]}" alt="${GOODS[g]}" class="${cls}">`;

// ------------------------------------------------------------ renderer
const touchDevice = matchMedia("(pointer: coarse)").matches || qs.has("touch");
const renderer = new THREE.WebGLRenderer({ canvas: $("world"), antialias: !touchDevice, powerPreference: "high-performance", preserveDrawingBuffer: qs.has("debug") });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const glInfo = (() => {
  const gl = renderer.getContext();
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
})();
let tier = touchDevice || qs.has("low") || /swiftshader|llvmpipe|software/i.test(glInfo) ? 0 : 1;
let ratio = Math.min(devicePixelRatio, tier ? 1.5 : 1.25);
renderer.setPixelRatio(ratio);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 900);
scene.add(camera);

let WORLD, sky, rain, crowd, hero, duck, keeper, mira, boat, miraBoat, pillar, trail, lampGlow;
const P = {}; // particles
const held = new Set();
let S = null;
let V = [];

const cam = {
  focus: new THREE.Vector3(64, 2, 64), fv: new THREE.Vector3(),
  dist: 104, dv: 0, pitch: 0.62, pv: 0, yaw: 0.5, yv: 0, fov: 38, fovv: 0, shake: 0,
};
const view = { mode: "orbit", zoom: 23, yaw: 0, drag: null, freeMix: 0, freeMixV: 0, free: { pos: new THREE.Vector3(), yaw: 0, pitch: -0.6 } };

function resize() {
  const r = $("stage").getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
}

// ------------------------------------------------------------ the day's light
const COLS = (o) => ({ ...o, top: hex(o.top), hor: hex(o.hor), glow: hex(o.glow) });
const SKY = [
  { p: 0, top: "#46b4ff", hor: "#ffe7c4", glow: "#ffe2a8", light: [1.05, 0.96, 0.86], shade: [0.62, 0.62, 0.86], ground: [1.02, 0.97, 0.92], water: [1.02, 0.97, 0.95] },
  { p: 0.14, top: "#2aa8ff", hor: "#c4f0ff", glow: "#fff2c8", light: [1.06, 1.02, 0.95], shade: [0.66, 0.72, 0.92], ground: [1, 1, 1], water: [1, 1, 1] },
  { p: 0.68, top: "#2aa2ff", hor: "#caf1ff", glow: "#fff2c8", light: [1.06, 1.01, 0.94], shade: [0.66, 0.72, 0.92], ground: [1, 1, 1], water: [1, 1, 1] },
  { p: 0.84, top: "#5a58d4", hor: "#ffae76", glow: "#ffb070", light: [1.08, 0.82, 0.64], shade: [0.55, 0.47, 0.76], ground: [1.04, 0.84, 0.74], water: [1.02, 0.8, 0.8] },
  { p: 0.94, top: "#141b5e", hor: "#40408e", glow: "#8090ff", light: [0.5, 0.56, 0.92], shade: [0.26, 0.3, 0.6], ground: [0.46, 0.5, 0.8], water: [0.42, 0.5, 0.82] },
  { p: 1, top: "#101650", hor: "#2c3078", glow: "#8090ff", light: [0.46, 0.52, 0.9], shade: [0.24, 0.28, 0.58], ground: [0.42, 0.46, 0.76], water: [0.38, 0.46, 0.78] },
].map(COLS);
const STORM = { top: hex("#3f4a6e"), hor: hex("#7c8aa6"), light: [0.72, 0.76, 0.9], shade: [0.42, 0.46, 0.66], ground: [0.66, 0.7, 0.82], water: [0.56, 0.62, 0.76] };
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const set3 = (c, v) => c.setRGB(v[0], v[1], v[2]);

function applySky(p, wet) {
  let i = 0;
  while (i < SKY.length - 2 && p > SKY[i + 1].p) i++;
  const a = SKY[i], b = SKY[i + 1];
  const t = clamp((p - a.p) / (b.p - a.p), 0, 1);
  const pick = (k) => mix3(mix3(a[k], b[k], t), STORM[k] ?? mix3(a[k], b[k], t), 0);
  const top = mix3(pick("top"), STORM.top, wet * 0.85), hor = mix3(pick("hor"), STORM.hor, wet * 0.85);
  const glow = mix3(pick("glow"), [0.3, 0.3, 0.34], wet);
  const light = mix3(pick("light"), mix3(pick("light"), STORM.light, 1), wet * 0.8);
  const shade = mix3(pick("shade"), mix3(pick("shade"), STORM.shade, 1), wet * 0.8);
  const ground = mix3(pick("ground"), mix3(pick("ground"), STORM.ground, 1), wet * 0.8);
  const water = mix3(pick("water"), mix3(pick("water"), STORM.water, 1), wet * 0.8);
  const su = sky.material.uniforms;
  set3(su.uTop.value, top);
  set3(su.uHorizon.value, hor);
  set3(su.uGlow.value, glow);
  const dark = sstep(0.84, 0.95, p);
  su.uStars.value = dark * (1 - wet);
  set3(U.uLight.value, light);
  set3(U.uShade.value, shade);
  set3(U.uFog.value, hor);
  set3(WORLD.terrain.material.uniforms.uGround.value, ground);
  set3(WORLD.water.material.uniforms.uTint.value, water);
  WORLD.terrain.material.uniforms.uCloud.value = 0.16 + wet * 0.2;
  WORLD.water.material.uniforms.uChop.value = wet;
  const ang = lerp(0.35, 2.75, clamp(p / 0.86, 0, 1));
  U.uSun.value.set(Math.cos(ang) * 0.8, Math.max(0.34, Math.sin(ang) * 0.95), 0.42).normalize();
  lampGlow.material.opacity = sstep(0.8, 0.92, p) * 0.95 + wet * 0.4;
  return dark;
}

// ------------------------------------------------------------ game state
function loadBook() {
  try {
    return JSON.parse(localStorage.getItem("mintless-book")) || {};
  } catch {
    return {};
  }
}
function saveBook() {
  try {
    localStorage.setItem("mintless-book", JSON.stringify(S.book));
  } catch {
    // the fish book simply lasts this session
  }
}

function newRun(kind, seed) {
  const rules = kind === "mystery" ? mysteryRules(seed) : structuredClone(SALT_TOWN);
  const town = createTown(rules, seed);
  const me = createRun(rules);
  const rival = createRun(rules);
  const dockEnd = WORLD.objects.find((o) => o.kind === "dock");
  S = {
    kind, seed, rules, town, me, rival,
    you: { x: CAMP.x - 7, y: 1.2, z: CAMP.z + 7, vx: 0, vz: 0, vy: 0, air: false, dir: Math.PI * 0.9, walk: 0, moveT: 0, coyote: 0, sq: 1, sqv: 0, riding: false, landed: 0, dust: 0, step: 0 },
    clock: 0, wet: 0, panel: null, near: null, night: null, ended: false, ver: 1, seenVer: 0, stepInfo: null, place: "", book: loadBook(),
    log: [], lost: 0, peakLoss: 0, banners: [], showing: false, fish: null, speak: null, tips: {}, routeT: 0, route: [], sawRain: false, parting: null, firstFish: true, dockEnd,
    moneyBorn: 0, rivalDone: 0, won: 0, swaps: 0, idle: 0,
  };
  hideAllPanels();
  V.forEach((p, i) => {
    Object.assign(p, { x: p.hx, z: p.hz, tx: p.hx, tz: p.hz, wait: 1 + (i % 7) * 0.7, hop: 0, greeted: false, walk: 0 });
  });
  for (const m of boat.parts) m.visible = false;
  boat.wreck.visible = true;
  boat.root.position.set(WRECK.x, -0.1, WRECK.z);
  for (const m of miraBoat.parts) m.visible = false;
  miraBoat.wreck.visible = true;
  miraBoat.root.visible = true;
  miraBoat.root.position.set(S.miraSpot?.x ?? MIRA.x, -0.1, MIRA.z);
  duck.root.visible = false;
  S.log.push({ money: money(), worth: worthNow(town, me) });
  S.lastMoney = money();
  rebuildStack();
  renderHud();
  renderBag();
}

const money = () => S.town.history[S.town.history.length - 1].money;
const shop = () => shopGood(S.town);
const dayNum = () => Math.floor(S.town.day / TOWN_DAYS_PER_NIGHT) + 1;
const rainEvent = () => S.rules.events[0] || null;
const rainGood = () => (S.town.eventGoods.length ? S.town.eventGoods[0] : -1);
const stormDay = () => Math.ceil((rainEvent()?.day ?? 99) / TOWN_DAYS_PER_NIGHT);
const raining = () => {
  const ev = rainEvent();
  return !!ev && S.town.day >= ev.day && rainGood() >= 0;
};
const dayLength = () => (S.town.day === 0 ? FIRST_DAY_SECONDS : DAY_SECONDS);

const modalOpen = () => S?.panel !== null || !$("title").classList.contains("hidden") || !$("end").classList.contains("hidden");
const canWalk = () => S && !S.fish && !S.night && !S.ended && !modalOpen() && view.mode !== "free" && !S.parting;

// ------------------------------------------------------------ walking
function deep(x, z) {
  return groundAt(x, z) < -0.5;
}
function blocked(x, z) {
  if (Math.hypot(x - 64, z - 64) > 86) return true;
  if (hitSolid(x, z, S.you.riding ? 0.7 : 0.42)) return true;
  return !S.you.riding && deep(x, z);
}

function moveHero(dt) {
  const you = S.you;
  let mx = 0, mz = 0;
  if (canWalk()) {
    mx = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0) + stick.x;
    mz = (held.has("back") ? 1 : 0) - (held.has("up") ? 1 : 0) + stick.y;
  }
  const mag = Math.min(1, Math.hypot(mx, mz));
  if (mag > 0.1) {
    const l = Math.hypot(mx, mz) || 1;
    mx /= l;
    mz /= l;
    you.moveT += dt;
    S.idle = 0;
  } else {
    mx = mz = 0;
    you.moveT = 0;
    S.idle += dt;
  }
  const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
  const wx = mx * cy + mz * sy, wz = -mx * sy + mz * cy;
  let top = you.riding ? DUCK : held.has("sprint") ? SPRINT : lerp(WALK, RUN, sstep(0.2, 0.7, you.moveT));
  top *= mag > 0 ? Math.max(0.45, mag) : 0;
  const k = 1 - Math.exp(-dt * (you.riding ? 5 : 11));
  you.vx += (wx * top - you.vx) * k;
  you.vz += (wz * top - you.vz) * k;
  const nx = you.x + you.vx * dt, nz = you.z + you.vz * dt;
  if (!blocked(nx, you.z)) you.x = nx;
  else you.vx = 0;
  if (!blocked(you.x, nz)) you.z = nz;
  else you.vz = 0;
  const speed = Math.hypot(you.vx, you.vz);
  if (speed > 0.6) {
    const want = Math.atan2(you.vx, you.vz);
    let d = want - you.dir;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    you.dir += d * (1 - Math.exp(-dt * 13));
  }

  const swimming = you.riding && groundAt(you.x, you.z) < 0;
  const floor = swimming ? Math.sin(performance.now() / 300) * 0.06 - 0.55 : groundAt(you.x, you.z);
  if (you.air) {
    you.vy -= GRAVITY * dt;
    you.y += you.vy * dt;
    if (you.y <= floor) {
      you.y = floor;
      you.air = false;
      you.sqv = -5;
      sfx("land");
      burst(you.x, you.y + 0.15, you.z, 7, [1, 0.97, 0.88], 3, 0.42, 0.4);
    }
  } else {
    if (you.y - floor > 0.7) you.air = true;
    else you.y += (floor - you.y) * (1 - Math.exp(-dt * 18));
    you.coyote = 0.11;
  }
  if (you.air) you.coyote -= dt;
  you.walk += speed * dt * (you.riding ? 0.95 : 1.55);
  you.dust -= dt;
  if (speed > 6 && !you.air && you.dust <= 0) {
    you.dust = you.riding ? 0.07 : 0.1;
    if (swimming) burst(you.x, 0.1, you.z, 3, [1, 1, 1], 2.4, 0.5, 0.6);
    else burst(you.x, you.y + 0.1, you.z, 2, heightAt(you.x, you.z) < 1 ? [1, 0.93, 0.76] : [0.93, 0.95, 0.84], 1.4, 0.4, 0.5);
  }
  if (!you.air && !you.riding && speed > 3 && Math.floor(you.walk / Math.PI) !== you.step) {
    you.step = Math.floor(you.walk / Math.PI);
    sfx("step");
  }
  you.sqv += (1 - you.sq) * 300 * dt - you.sqv * 18 * dt;
  you.sq += you.sqv * dt;
}

function jump() {
  const you = S.you;
  if (!canWalk() || (you.air && you.coyote <= 0)) return;
  you.vy = JUMP * (you.riding ? 0.85 : 1);
  you.air = true;
  you.coyote = 0;
  you.sqv = 6;
  sfx("jump");
}

function toggleDuck() {
  const you = S.you;
  if (!canWalk() || !S.me.gear.duck) return;
  if (you.riding && deep(you.x, you.z)) return say(null, "Not in the middle of the water.");
  you.riding = !you.riding;
  duck.root.visible = you.riding;
  you.sqv = 5;
  sfx("quack");
  burst(you.x, you.y + 1, you.z, 16, [1, 1, 1], 4, 0.5, 0.7);
  drawKeys();
}

// ------------------------------------------------------------ villagers
function updateVillagers(t, dt) {
  const you = S.you;
  let nearest = -1, nd = 7;
  for (let i = 0; i < V.length; i++) {
    const p = V[i];
    const d = Math.hypot(p.x - you.x, p.z - you.z);
    if (d < nd && !S.night) {
      nd = d;
      nearest = i;
    }
    if (d < 7.5) {
      let a = Math.atan2(you.x - p.x, you.z - p.z) - p.ry;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      p.ry += a * (1 - Math.exp(-dt * 8));
      p.walk = 0;
      if (!p.greeted) {
        p.greeted = true;
        p.hop = 1;
      }
    } else {
      if (d > 11) p.greeted = false;
      p.wait -= dt;
      if (p.wait <= 0) {
        const a = noise2(i, Math.floor(t)) * 6.28, r = 1 + noise2(Math.floor(t), i) * 3;
        const nx = p.hx + Math.cos(a) * r, nz = p.hz + Math.sin(a) * r;
        if (!hitSolid(nx, nz, 0.8)) {
          p.tx = nx;
          p.tz = nz;
        }
        p.wait = 3 + noise2(i, 9) * 6;
      }
      const dx = p.tx - p.x, dz = p.tz - p.z, l = Math.hypot(dx, dz);
      if (l > 0.15) {
        const sp = raining() ? 3.2 : 1.5;
        p.x += (dx / l) * sp * dt;
        p.z += (dz / l) * sp * dt;
        let a = Math.atan2(dx, dz) - p.ry;
        a = Math.atan2(Math.sin(a), Math.cos(a));
        p.ry += a * (1 - Math.exp(-dt * 6));
        p.walk += dt * 9;
      } else p.walk = 0;
    }
    p.hop = Math.max(0, p.hop - dt * 1.9);
    const hop = Math.sin(p.hop * Math.PI) * 0.8;
    const bob = Math.abs(Math.sin(p.walk)) * 0.12;
    const breathe = Math.sin(t * 2 + i) * 0.015;
    const sy = 1 + breathe + Math.sin(p.hop * Math.PI * 2) * 0.13;
    const blink = (t + i * 1.7) % 3.7 < 0.11;
    crowd.set(i, p.x, groundAt(p.x, p.z) + hop + bob, p.z, p.ry + Math.sin(p.walk) * 0.08, sy, blink, 1.08);
  }
  crowd.commit();
  S.watching = nearest;
}

function say(i, text, ms = 3200) {
  if (i === null) return toast(text);
  S.speak = { i, text, until: performance.now() + ms };
  babble(170 + (i % 8) * 36, Math.min(9, 3 + Math.round(text.length / 9)));
}

function lineFor(i) {
  const { town, me } = S;
  const ag = town.agents[i];
  const m = money();
  const ev = rainEvent();
  if (ag.holds === ag.needs) return `This ${GOODS[ag.needs]} is my dinner. Come back tomorrow.`;
  const wants = wantsOf(town, ag);
  if (ev && !raining() && rainGood() >= 0 && town.day >= (ev.decideDay ?? 0) && noise2(i, town.day) < 0.5) return `Storm after day ${stormDay()}. ${cap(GOODS[rainGood()])} won't last.`;
  if (raining() && rainGood() >= 0 && m !== rainGood()) return `${cap(GOODS[rainGood()])}? Nobody wants that wet stuff now.`;
  if (m >= 0 && wants.includes(m) && ag.needs !== m && ag.makes !== m) return `I never use ${GOODS[m]}. But everybody takes it, so I do too.`;
  if (!wants.length) return "I have nothing to trade today.";
  const have = wants.some((g) => me.bag[g] > 0);
  if (!have) return `I'd give ${GOODS[ag.holds]} for ${wants.slice(0, 2).map((g) => GOODS[g]).join(" or ")}.`;
  return "Deal?";
}

function trade(i) {
  const { town, me } = S;
  const p = V[i];
  const give = bestGive(town, me, i);
  if (give < 0) {
    p.hop = 0.5;
    sfx("deny");
    return say(i, lineFor(i));
  }
  const res = offer(town, me, i, give);
  if (!res.ok) {
    sfx("deny");
    return say(i, lineFor(i));
  }
  S.ver++;
  S.swaps++;
  p.hop = 1;
  sfx("swap");
  babble(170 + (i % 8) * 36, 3);
  const a = new THREE.Vector3(S.you.x, S.you.y + 1.5, S.you.z), b = new THREE.Vector3(p.x, groundAt(p.x, p.z) + 1.5, p.z);
  fly(give, a, b);
  fly(res.got, b, a, () => {
    popAt(S.you.x, S.you.y + 2.6, S.you.z, `+1 ${pic(res.got)}`);
    bump(res.got);
    rebuildStack();
    burst(S.you.x, S.you.y + 1.6, S.you.z, 10, [1, 0.9, 0.45], 3, 0.5, 0.3);
  });
  renderBag();
  renderHud();
}

// ------------------------------------------------------------ goods in flight, the stack on your back
const flights = [];
const flyPool = [];
function fly(g, from, to, then) {
  let f = flyPool.find((x) => !x.busy);
  if (!f) {
    f = { mesh: new THREE.Mesh(GOOD_GEO[0], toon), busy: false };
    scene.add(f.mesh);
    flyPool.push(f);
  }
  f.busy = true;
  f.mesh.geometry = GOOD_GEO[g];
  f.mesh.visible = true;
  f.mesh.scale.setScalar(1.1);
  flights.push({ f, from: from.clone(), to: to.clone(), t: 0, then });
}
function updateFlights(dt) {
  for (let i = flights.length - 1; i >= 0; i--) {
    const k = flights[i];
    k.t += dt / 0.42;
    const t = Math.min(1, k.t);
    k.f.mesh.position.lerpVectors(k.from, k.to, t);
    k.f.mesh.position.y += Math.sin(t * Math.PI) * 1.8;
    k.f.mesh.rotation.y += dt * 10;
    if (k.t >= 1) {
      k.f.busy = false;
      k.f.mesh.visible = false;
      flights.splice(i, 1);
      if (k.then) k.then();
    }
  }
}

let GOOD_GEO = [];
const stack = { group: new THREE.Group(), lists: [], sway: 0, swayV: 0 };
function rebuildStack() {
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
  let y = 0, n = 0;
  stack.lists.forEach((m) => (m.count = 0));
  const order = S.me.bag.map((u, g) => [g, u]).sort((a, b) => b[1] - a[1]);
  for (const [g, u] of order) {
    const show = Math.min(u, Math.max(0, 16 - n));
    for (let i = 0; i < show; i++) {
      E.set(0, noise2(n, 4) * 1.4 - 0.7, 0);
      Q.setFromEuler(E);
      M.compose(new THREE.Vector3((noise2(n, 1) - 0.5) * 0.12, y, (noise2(n, 2) - 0.5) * 0.12), Q, new THREE.Vector3(0.74, 0.74, 0.74));
      stack.lists[g].setMatrixAt(stack.lists[g].count++, M);
      y += 0.3;
      n++;
    }
    stack.lists[g].instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------ particles
function initParticles() {
  const n = 320;
  P.n = n;
  P.i = 0;
  P.pos = new Float32Array(n * 3);
  P.col = new Float32Array(n * 3);
  P.size = new Float32Array(n);
  P.vel = new Float32Array(n * 3);
  P.life = new Float32Array(n);
  P.max = new Float32Array(n);
  P.grav = new Float32Array(n);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(P.pos, 3));
  g.setAttribute("tint", new THREE.BufferAttribute(P.col, 3));
  g.setAttribute("sz", new THREE.BufferAttribute(P.size, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uH: { value: 800 } },
    vertexShader: `attribute vec3 tint; attribute float sz; varying vec3 vC; uniform float uH;
      void main() { vC = tint; vec4 mv = viewMatrix * vec4(position, 1.0); gl_PointSize = sz * uH / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vC, smoothstep(0.5, 0.28, d)); }`,
  });
  P.geo = g;
  P.mat = m;
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.renderOrder = 4;
  scene.add(pts);
}
function burst(x, y, z, n, col, speed, life, grav = 0.6) {
  for (let k = 0; k < n; k++) {
    const i = (P.i = (P.i + 1) % P.n);
    const a = Math.random() * 6.28, up = Math.random();
    P.pos.set([x, y, z], i * 3);
    P.vel.set([Math.cos(a) * speed * (0.4 + Math.random() * 0.6), speed * (0.3 + up * 0.8), Math.sin(a) * speed * (0.4 + Math.random() * 0.6)], i * 3);
    P.col.set(col, i * 3);
    P.life[i] = P.max[i] = life * (0.6 + Math.random() * 0.6);
    P.grav[i] = grav;
    P.size[i] = 0.34 + Math.random() * 0.34;
  }
}
function updateParticles(dt) {
  for (let i = 0; i < P.n; i++) {
    if (P.life[i] <= 0) continue;
    P.life[i] -= dt;
    if (P.life[i] <= 0) {
      P.size[i] = 0;
      continue;
    }
    P.vel[i * 3 + 1] -= 16 * P.grav[i] * dt;
    P.pos[i * 3] += P.vel[i * 3] * dt;
    P.pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt;
    P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
    P.size[i] *= 1 - dt * 1.4;
  }
  P.geo.attributes.position.needsUpdate = true;
  P.geo.attributes.tint.needsUpdate = true;
  P.geo.attributes.sz.needsUpdate = true;
}

const screenPos = new THREE.Vector3();
function project(x, y, z) {
  screenPos.set(x, y, z).project(camera);
  const r = $("stage").getBoundingClientRect();
  return { x: ((screenPos.x + 1) / 2) * r.width, y: ((1 - screenPos.y) / 2) * r.height, on: screenPos.z < 1 && Math.abs(screenPos.x) < 1.1 && Math.abs(screenPos.y) < 1.1 };
}
function popAt(x, y, z, html, cls = "") {
  const p = project(x, y, z);
  const el = document.createElement("div");
  el.className = `pop ${cls}`;
  el.innerHTML = html;
  el.style.left = `${p.x}px`;
  el.style.top = `${p.y}px`;
  $("pops").appendChild(el);
  setTimeout(() => el.remove(), 1250);
}

// ------------------------------------------------------------ the camera rig
// One rig, four sets of numbers. Moving between them only changes the numbers,
// each through a spring, so the view never cuts: distance, pitch, yaw and lens
// all glide at once.
function damp(cur, target, vel, smooth, dt) {
  const o = 2 / smooth, x = o * dt;
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const c = cur - target;
  const temp = (vel + o * c) * dt;
  const nv = (vel - o * temp) * e;
  return [target + (c + temp) * e, nv];
}
function dampAngle(cur, target, vel, smooth, dt) {
  const d = Math.atan2(Math.sin(target - cur), Math.cos(target - cur));
  return damp(cur, cur + d, vel, smooth, dt);
}

const eye = new THREE.Vector3();
const freeLook = new THREE.Vector3();
function placeCamera(dt) {
  const you = S.you;
  let goal;
  if (view.mode === "orbit") {
    view.yaw += dt * 0.05;
    goal = { fx: 64, fy: 2, fz: 66, dist: touchPortrait() ? 170 : 104, pitch: 0.58, yaw: view.yaw, fov: 38, smooth: 0.5 };
  } else if (view.mode === "first") {
    const f = S.fish, d = f.dock;
    const fight = f.side || 0;
    goal = { fx: f.ex + d.dx * 8 + d.dz * fight * 0.8, fy: 0.9, fz: f.ez + d.dz * 8 - d.dx * fight * 0.8, dist: 8.2, pitch: 0.22, yaw: Math.atan2(-d.dx, -d.dz), fov: 56, smooth: 0.5 };
  } else if (view.mode === "third") {
    goal = { fx: you.x, fy: you.y + 1.9, fz: you.z, dist: 9, pitch: 0.3, yaw: view.yaw, fov: 50, smooth: 0.42 };
  } else if (view.mode === "cine") {
    const b = S.parting;
    goal = { fx: b.x, fy: 2, fz: b.z, dist: 26, pitch: 0.3, yaw: view.yaw + (b.t || 0) * 0.14, fov: 40, smooth: 0.8 };
  } else {
    const riding = you.riding ? 1.25 : 1;
    goal = { fx: you.x, fy: you.y + 1, fz: you.z, dist: view.zoom * riding * (touchPortrait() ? 1.25 : 1), pitch: 0.9, yaw: 0, fov: 38, smooth: 0.42 };
  }
  // while the player runs, look a little ahead
  const lead = view.mode === "roam" ? 0.28 : 0;
  const ax = goal.fx + you.vx * lead, az = goal.fz + you.vz * lead;
  const fast = view.mode === "first" || view.mode === "orbit" || view.mode === "cine" ? goal.smooth : 0.16;
  [cam.focus.x, cam.fv.x] = damp(cam.focus.x, ax, cam.fv.x, fast, dt);
  [cam.focus.y, cam.fv.y] = damp(cam.focus.y, goal.fy, cam.fv.y, Math.max(fast, 0.2), dt);
  [cam.focus.z, cam.fv.z] = damp(cam.focus.z, az, cam.fv.z, fast, dt);
  [cam.dist, cam.dv] = damp(cam.dist, goal.dist, cam.dv, goal.smooth, dt);
  [cam.pitch, cam.pv] = damp(cam.pitch, goal.pitch, cam.pv, goal.smooth, dt);
  [cam.yaw, cam.yv] = dampAngle(cam.yaw, goal.yaw, cam.yv, goal.smooth, dt);
  [cam.fov, cam.fovv] = damp(cam.fov, goal.fov, cam.fovv, goal.smooth, dt);

  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  let dist = cam.dist;
  if (view.mode === "third") {
    // keep walls out of the shot: walk from the head outward
    for (let k = 1; k <= 10; k++) {
      const d = (k / 10) * dist;
      const x = cam.focus.x + Math.sin(cam.yaw) * cp * d, z = cam.focus.z + Math.cos(cam.yaw) * cp * d;
      if (hitSolid(x, z, 0.4)) {
        dist = Math.max(2.4, d - 1);
        break;
      }
    }
  }
  eye.set(cam.focus.x + Math.sin(cam.yaw) * cp * dist, cam.focus.y + sp * dist, cam.focus.z + Math.cos(cam.yaw) * cp * dist);
  const floor = groundAt(clamp(eye.x, 0, SIZE - 1), clamp(eye.z, 0, SIZE - 1));
  eye.y = Math.max(eye.y, Math.max(0.4, floor + 0.9));
  [view.freeMix, view.freeMixV] = damp(view.freeMix, view.mode === "free" ? 1 : 0, view.freeMixV, 0.3, dt);
  if (view.freeMix > 0.001) eye.lerp(view.free.pos, view.freeMix);
  camera.position.copy(eye);
  if (cam.shake > 0.001) {
    camera.position.x += (Math.random() - 0.5) * cam.shake;
    camera.position.y += (Math.random() - 0.5) * cam.shake;
    cam.shake *= Math.exp(-dt * 7);
  }
  freeLook.set(view.free.pos.x + Math.sin(view.free.yaw + Math.PI) * Math.cos(view.free.pitch), view.free.pos.y + Math.sin(view.free.pitch), view.free.pos.z + Math.cos(view.free.yaw + Math.PI) * Math.cos(view.free.pitch));
  const look = cam.focus.clone().lerp(freeLook, view.freeMix);
  camera.lookAt(look);
  camera.fov = cam.fov;
  camera.updateProjectionMatrix();
  sky.position.copy(camera.position);
  P.mat.uniforms.uH.value = renderer.domElement.height * 1.05;
}
const touchPortrait = () => innerHeight > innerWidth;

function chooseMode() {
  if (view.mode === "free" || view.mode === "first" || view.mode === "orbit" || view.mode === "cine") return;
  const you = S.you;
  const zones = [...VILLAGES.map((v) => [v.x, v.z, 13]), [SQUARE.x, SQUARE.z, 12], [YARD.x, YARD.z, 7]];
  const margin = view.mode === "third" ? 3.5 : 0;
  const inside = !you.riding && zones.some(([x, z, r]) => Math.hypot(you.x - x, you.z - z) < r + margin);
  const onPier = WORLD.objects.some((o) => o.kind === "dock" && Math.hypot(you.x - o.x, you.z - o.z) < 8 + margin);
  const want = inside || onPier ? "third" : "roam";
  if (want !== view.mode) {
    view.mode = want;
    if (want === "third") view.yaw = cam.yaw;
  }
}

// ------------------------------------------------------------ frame
function update(dt, now) {
  const t = now / 1000;
  U.uTime.value = t;
  S.wet += ((raining() ? 1 : stormNear() ? 0.32 : 0) - S.wet) * (1 - Math.exp(-dt * 0.8));
  U.uWind.value = 1 + S.wet * 2.2 + (S.night?.storm ? 1 : 0);
  rain.visible = S.wet > 0.5 || !!S.night?.storm;
  rain.material.uniforms.uDrop.value.set(camera.position.x + (cam.focus.x - camera.position.x) * 0.6, 0, camera.position.z + (cam.focus.z - camera.position.z) * 0.6);

  const paused = !$("title").classList.contains("hidden") || S.panel || S.ended;
  if (!paused && !S.night && !S.parting) {
    S.clock += dt / dayLength();
    if (S.clock >= 1) beginNight();
  }
  moveHero(dt);
  chooseMode();
  updateVillagers(t, dt);
  updateFlights(dt);
  if (S.night) updateNight(dt);
  if (S.fish) updateFishing(dt);
  if (S.parting) updateParting(dt);
  if (view.mode === "free") updateFree(dt);
  findNear();
  S.routeT -= dt;
  if (S.routeT <= 0) {
    S.routeT = 0.35;
    refreshStep();
  }
  checkPlace();
  // tutorial nudges appear only after a pause, so people who get it never see them
  if (S.tips.walk !== true && S.idle > 7 && canWalk() && !S.me.bag[1]) showTip(touchDevice ? "Drag the circle to walk" : "Press W A S D to walk, and follow the gold trail");
  if (S.idle < 0.2 && !S.tips.walk && S.tips.shown) {
    S.tips.walk = true;
    hideTip();
  }
  updateParticles(dt);
}
const stormNear = () => {
  const ev = rainEvent();
  return !!ev && S.town.day >= ev.day - 7 && !raining();
};

function updateFree(dt) {
  const f = view.free;
  const speed = 28 * dt;
  const x = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
  const z = (held.has("back") ? 1 : 0) - (held.has("up") ? 1 : 0);
  f.pos.x = clamp(f.pos.x + (x * Math.cos(f.yaw) + z * Math.sin(f.yaw)) * speed, -30, SIZE + 30);
  f.pos.z = clamp(f.pos.z + (-x * Math.sin(f.yaw) + z * Math.cos(f.yaw)) * speed, -30, SIZE + 30);
}

function render(t, dt) {
  const you = S.you;
  const swing = Math.sin(you.walk) * Math.min(1, Math.hypot(you.vx, you.vz) / 7) * 0.95;
  hero.root.position.set(you.x, you.y + (you.riding ? 1.7 : 0), you.z);
  hero.root.rotation.y = you.dir;
  const lean = Math.min(0.2, Math.hypot(you.vx, you.vz) * 0.022);
  hero.body.rotation.x = you.riding ? 0.05 : lean;
  hero.body.scale.set(2 - you.sq, you.sq, 2 - you.sq);
  hero.body.position.y = you.riding ? 0 : Math.abs(Math.sin(you.walk)) * 0.1;
  const seated = you.riding ? 1 : 0;
  hero.legL.rotation.x = seated ? -1.2 : swing;
  hero.legR.rotation.x = seated ? -1.2 : -swing;
  hero.armL.rotation.x = seated ? -0.9 : you.air ? -2.4 : -swing;
  hero.armR.rotation.x = seated ? -0.9 : you.air ? -2.4 : swing;
  const hidden = camera.position.distanceTo(hero.root.position) < 2.6 || (S.fish && view.mode === "first");
  hero.root.visible = !hidden;

  if (you.riding) {
    duck.root.position.set(you.x, you.y, you.z);
    duck.root.rotation.y = you.dir;
    const w = Math.sin(you.walk * 1.5);
    const sp = Math.min(1, Math.hypot(you.vx, you.vz) / 10);
    duck.body.rotation.z = w * 0.09 * sp;
    duck.body.position.y = Math.abs(w) * 0.1 * sp;
    duck.neck.rotation.x = 0.1 + Math.sin(you.walk * 3) * 0.1 * sp;
    duck.fl.rotation.x = w * 0.9;
    duck.fr.rotation.x = -w * 0.9;
    const swim = groundAt(you.x, you.z) < 0;
    duck.fl.visible = duck.fr.visible = !swim;
  }

  // the stack leans behind you when you run
  const target = -Math.hypot(you.vx, you.vz) * 0.022;
  stack.swayV += (target - stack.sway) * 120 * dt - stack.swayV * 9 * dt;
  stack.sway += stack.swayV * dt;
  stack.group.rotation.x = stack.sway;

  pillar.rotation.y = t * 0.8;
  pillar.position.y = heightAt(SQUARE.x, SQUARE.z) + 5.3 + Math.sin(t * 1.6) * 0.18;

  const p = S.night ? S.night.sky : S.clock * 0.9;
  const dark = applySky(Math.min(1, p), S.wet);
  ambience({ sea: 0.5, wind: 0.08 + S.wet * 0.5, rain: S.wet > 0.5 ? S.wet : 0 });
  musicMood(S.wet > 0.6 ? "storm" : S.clock > 0.72 ? "dusk" : "day");

  renderTrail(t);
  renderBubbles();
  $("sun").style.width = `${Math.min(100, S.clock * 100)}%`;
  drawMini(t);
  placeCamera(dt);
  renderer.render(scene, camera);
  return dark;
}

let last = performance.now(), slow = 0, seen = 0;
function watchSpeed(ms) {
  seen++;
  if (ms > 42) slow++;
  if (seen < 90) return;
  if (slow > 45) lowerQuality();
  seen = slow = 0;
}
function lowerQuality() {
  if (ratio > 0.75) {
    ratio = Math.max(0.75, ratio - 0.25);
    renderer.setPixelRatio(ratio);
    resize();
    return;
  }
  if (WORLD.line) WORLD.line.visible = false;
}

function frame(now) {
  const ms = now - last;
  const dt = Math.min(0.05, ms / 1000);
  last = now;
  watchSpeed(ms);
  update(dt, now);
  render(now / 1000, dt);
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------ input
const KEYMAP = { ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right", ArrowUp: "up", w: "up", ArrowDown: "back", s: "back", Shift: "sprint" };
document.addEventListener("keydown", (e) => {
  if (!S) return;
  unlockAudio();
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (!$("title").classList.contains("hidden")) {
    if (k === "Enter" || k === " ") startRun(S.kind === "mystery" ? "mystery" : "salt");
    return;
  }
  if (S.panel) {
    if (k === "Escape") closePanel();
    if (S.panel === "map" && k === "m") closePanel();
    if (S.panel === "yard" && (k === "e" || k === "Enter")) payNext();
    if (S.panel === "yard" && /^[1-3]$/.test(k)) document.querySelectorAll("#yard-items button")[Number(k) - 1]?.click();
    return;
  }
  if (S.fish) {
    if (KEYMAP[k]) held.add(KEYMAP[k]);
    if ((k === " " || k === "e" || k === "Enter") && !e.repeat) fishDown();
    if (k === "Escape" || k === "q") stopFishing();
    e.preventDefault();
    return;
  }
  if (KEYMAP[k]) {
    held.add(KEYMAP[k]);
    e.preventDefault();
  } else if (k === " ") {
    jump();
    e.preventDefault();
  } else if (k === "e" || k === "Enter") use();
  else if (k === "r") toggleDuck();
  else if (k === "c") toggleFree();
  else if (k === "m") openPanel("map");
  else if (k === "n") toggleSound();
  else if (k === "Escape" && view.mode === "free") toggleFree();
});
document.addEventListener("keyup", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (KEYMAP[k]) held.delete(KEYMAP[k]);
  if (S?.fish && (k === " " || k === "e" || k === "Enter")) fishUp();
});
addEventListener("blur", () => held.clear());
addEventListener("contextmenu", (e) => e.preventDefault());

// Ctrl + scroll, a touchpad pinch, or plain scroll: all zoom, within limits.
addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey) e.preventDefault();
    if (!S || modalOpen()) return;
    if (view.mode === "free") {
      view.free.pos.y = clamp(view.free.pos.y + e.deltaY * 0.03, 8, 110);
      return;
    }
    view.zoom = clamp(view.zoom * (1 + e.deltaY * 0.0016), ZOOM_MIN, ZOOM_MAX);
  },
  { passive: false },
);

const canvas = $("world");
canvas.addEventListener("pointerdown", (e) => {
  unlockAudio();
  view.drag = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!view.drag || !S) return;
  const dx = e.clientX - view.drag.x, dy = e.clientY - view.drag.y;
  view.drag = { x: e.clientX, y: e.clientY };
  if (view.mode === "third") view.yaw -= dx * 0.006;
  else if (view.mode === "free") {
    view.free.yaw -= dx * 0.004;
    view.free.pitch = clamp(view.free.pitch - dy * 0.004, -1.5, 0.6);
  }
});
canvas.addEventListener("pointerup", () => (view.drag = null));

// touch: a stick on the left, buttons on the right
const stick = { x: 0, y: 0, id: null };
function bindTouch() {
  const box = $("stick"), nub = $("nub");
  const move = (e) => {
    const r = box.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const l = Math.hypot(dx, dy), max = r.width / 2 - 12, k = l > max ? max / l : 1;
    nub.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    stick.x = (dx * k) / max;
    stick.y = (dy * k) / max;
  };
  box.addEventListener("pointerdown", (e) => {
    unlockAudio();
    stick.id = e.pointerId;
    box.setPointerCapture(e.pointerId);
    move(e);
  });
  box.addEventListener("pointermove", (e) => e.pointerId === stick.id && move(e));
  const end = () => {
    stick.id = null;
    stick.x = stick.y = 0;
    nub.style.transform = "";
  };
  box.addEventListener("pointerup", end);
  box.addEventListener("pointercancel", end);
  const tap = (id, fn) => $(id).addEventListener("pointerdown", (e) => {
    e.preventDefault();
    unlockAudio();
    fn();
  });
  tap("t-use", use);
  tap("t-jump", jump);
  tap("t-duck", toggleDuck);
  const hold = (id, name) => {
    const el = $(id);
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      held.add(name);
    });
    for (const ev of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(ev, () => held.delete(name));
  };
  hold("t-left", "left");
  hold("t-right", "right");
  const castBtn = $("t-hold");
  castBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    fishDown();
  });
  for (const ev of ["pointerup", "pointercancel"]) castBtn.addEventListener(ev, fishUp);
}

function toggleFree() {
  if (!S || S.fish || modalOpen() || S.parting) return;
  if (view.mode === "free") {
    view.mode = "roam";
    toast("Camera follows you again.");
  } else {
    view.mode = "free";
    view.free.pos.copy(camera.position);
    view.free.yaw = cam.yaw;
    view.free.pitch = -cam.pitch;
    toast("Free camera: WASD to fly, drag to look, scroll for height, C to return.");
  }
}

function findNear() {
  const you = S.you;
  let best = null, bd = REACH;
  if (canWalk()) {
    V.forEach((p, i) => {
      const d = Math.hypot(p.x - you.x, p.z - you.z);
      if (d < bd) {
        bd = d;
        best = { kind: "trader", i };
      }
    });
    for (const o of WORLD.objects) {
      const d = Math.hypot(o.x - you.x, o.z - you.z);
      if (d < bd + 0.6) {
        bd = d;
        best = { kind: o.kind, o };
      }
    }
  }
  if ((best?.i ?? best?.o) !== (S.near?.i ?? S.near?.o)) {
    S.near = best;
    drawKeys();
    if (best && best.kind === "trader") say(best.i, lineFor(best.i), 2600);
  } else S.near = best;
}

function use() {
  if (!canWalk()) return;
  const n = S.near;
  if (!n) return;
  if (n.kind === "trader") trade(n.i);
  else if (n.kind === "yard") openPanel("yard");
  else if (n.kind === "bed") beginNight();
  else if (n.kind === "dock") startFishing(n.o);
}

// ------------------------------------------------------------ objective, trail
function nearestTrader(list) {
  const you = S.you;
  let best = null, bd = Infinity;
  for (const i of list) {
    const d = Math.hypot(V[i].x - you.x, V[i].z - you.z);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}
function nearestDock() {
  const you = S.you;
  let best = null, bd = Infinity;
  for (const o of WORLD.objects)
    if (o.kind === "dock") {
      const d = Math.hypot(o.x - you.x, o.z - you.z);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
  return best;
}

function refreshStep() {
  const { town, me } = S;
  const g = shop();
  const item = !me.gear.duck ? GEAR[0] : nextPart(me);
  if (!item) return;
  const have = me.bag[g];
  let info;
  if (have >= item.cost) {
    info = { kind: "pay", x: YARD.x, z: YARD.z, html: `Pay the shipyard ${item.cost} ${pic(g)} for the <b>${item.name.toLowerCase()}</b>` };
  } else {
    const path = routeTo(town, me, g);
    if (path && path.length) {
      const hop = path[0];
      const i = nearestTrader(hop.traders);
      info = { kind: "swap", x: V[i].x, z: V[i].z, html: `Swap ${pic(hop.give)} for ${pic(hop.get)} with a ${ROLE[town.agents[i].role]}`, sub: `${have} of ${item.cost} ${GOODS[g]} for the ${item.name.toLowerCase()}` };
    } else {
      const o = nearestDock();
      info = { kind: "fish", x: o.x, z: o.z, html: `Catch fish at the ${o.d.name.toLowerCase()}`, sub: `${have} of ${item.cost} ${GOODS[g]} for the ${item.name.toLowerCase()}` };
    }
  }
  const dist = Math.round(Math.hypot(info.x - S.you.x, info.z - S.you.z));
  info.key = info.html + (info.sub || "");
  const old = S.stepInfo;
  S.stepInfo = info;
  $("step").innerHTML = `${info.html} <span class="far">${dist} m</span>`;
  if (!old || old.key !== info.key || S.rivalShown !== S.rival.parts) {
    S.rivalShown = S.rival.parts;
    $("rival").textContent = `${info.sub ? `${cap(info.sub)}. ` : ""}Mira: ${S.rival.parts} of ${PARTS.length}`;
  }
  S.route = routeOf(S.you.x, S.you.z, info.x, info.z);
}

const GRAPH = (() => {
  const names = Object.keys(NODES);
  const links = Object.fromEntries(names.map((n) => [n, []]));
  for (const [a, b] of EDGES) {
    const d = Math.hypot(NODES[a][0] - NODES[b][0], NODES[a][1] - NODES[b][1]);
    links[a].push([b, d]);
    links[b].push([a, d]);
  }
  return { names, links };
})();

function routeOf(ax, az, bx, bz) {
  const straight = Math.hypot(ax - bx, az - bz);
  if (S.you.riding || straight < 14) return [[ax, az], [bx, bz]];
  const close = (x, z) => GRAPH.names.reduce((b, n) => (Math.hypot(NODES[n][0] - x, NODES[n][1] - z) < Math.hypot(NODES[b][0] - x, NODES[b][1] - z) ? n : b), GRAPH.names[0]);
  const from = close(ax, az), to = close(bx, bz);
  const dist = { [from]: 0 }, prev = {}, open = new Set([from]);
  while (open.size) {
    let cur = null;
    for (const n of open) if (cur === null || dist[n] < dist[cur]) cur = n;
    open.delete(cur);
    if (cur === to) break;
    for (const [n, d] of GRAPH.links[cur])
      if (dist[n] === undefined || dist[cur] + d < dist[n]) {
        dist[n] = dist[cur] + d;
        prev[n] = cur;
        open.add(n);
      }
  }
  const nodes = [];
  for (let n = to; n; n = prev[n]) nodes.unshift(NODES[n]);
  return [[ax, az], ...nodes, [bx, bz]];
}

function initTrail() {
  const n = 26;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("a", new THREE.BufferAttribute(new Float32Array(n), 1));
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uH: { value: 800 } },
    vertexShader: `attribute float a; varying float vA; uniform float uH; void main() { vA = a; vec4 mv = viewMatrix * vec4(position, 1.0); gl_PointSize = 0.72 * uH / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; vec3 c = mix(vec3(1.0, 0.72, 0.16), vec3(1.0, 0.96, 0.7), smoothstep(0.34, 0.08, d)); gl_FragColor = vec4(c, vA * smoothstep(0.5, 0.36, d)); }`,
  });
  trail = new THREE.Points(g, m);
  trail.frustumCulled = false;
  trail.renderOrder = 3;
  scene.add(trail);
}

function renderTrail(t) {
  const on = canWalk() && S.route.length > 1 && !$("title").classList.contains("hidden") === false;
  trail.visible = !!on;
  if (!on) return;
  trail.material.uniforms.uH.value = renderer.domElement.height;
  const route = S.route.slice();
  route[0] = [S.you.x, S.you.z];
  const pos = trail.geometry.attributes.position, a = trail.geometry.attributes.a;
  const gap = 2.6, n = pos.count;
  const shift = (t * 3.4) % gap;
  let seg = 0, left = 2 + shift, px = route[0][0], pz = route[0][1];
  for (let i = 0; i < n; i++) {
    let done = false;
    while (seg < route.length - 1) {
      const bx = route[seg + 1][0], bz = route[seg + 1][1];
      const l = Math.hypot(bx - px, bz - pz);
      if (l >= left) {
        px += ((bx - px) / l) * left;
        pz += ((bz - pz) / l) * left;
        left = gap;
        done = true;
        break;
      }
      left -= l;
      px = bx;
      pz = bz;
      seg++;
    }
    if (!done) {
      a.setX(i, 0);
      pos.setXYZ(i, 0, -50, 0);
      continue;
    }
    const y = Math.max(0.1, groundAt(px, pz)) + 0.5 + Math.sin(t * 4 + i * 0.7) * 0.1;
    pos.setXYZ(i, px, y, pz);
    a.setX(i, Math.min(1, (n - i) / 5) * Math.min(1, (i + 1) / 2) * 0.95);
  }
  pos.needsUpdate = true;
  a.needsUpdate = true;
}

function checkPlace() {
  const you = S.you;
  const spot = [...VILLAGES, SQUARE, CAMP].find((v) => Math.hypot(you.x - v.x, you.z - v.z) < 11);
  const name = spot?.name || "";
  if (name && name !== S.place && view.mode !== "orbit") {
    const el = $("place");
    el.textContent = name;
    el.classList.remove("hidden");
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
  }
  if (name) S.place = name;
}

// ------------------------------------------------------------ bubbles over heads
const bubPool = [];
function renderBubbles() {
  const you = S.you;
  const show = [];
  if (!S.fish && !S.night && !S.ended && !modalOpen() && view.mode !== "free") {
    for (let i = 0; i < V.length; i++) {
      const d = Math.hypot(V[i].x - you.x, V[i].z - you.z);
      if (d < 15) show.push([d, i]);
    }
    show.sort((a, b) => a[0] - b[0]);
  }
  const now = performance.now();
  if (S.speak && S.speak.until < now) S.speak = null;
  const count = Math.min(show.length, 6);
  for (let k = 0; k < Math.max(count, bubPool.length); k++) {
    let el = bubPool[k];
    if (k >= count) {
      if (el) el.style.display = "none";
      continue;
    }
    if (!el) {
      el = bubPool[k] = document.createElement("div");
      el.className = "bub";
      $("bubbles").appendChild(el);
    }
    const i = show[k][1];
    const p = V[i];
    const sp = project(p.x, groundAt(p.x, p.z) + 3.05, p.z);
    if (!sp.on) {
      el.style.display = "none";
      continue;
    }
    el.style.display = "";
    el.style.left = `${sp.x}px`;
    el.style.top = `${sp.y}px`;
    const talking = S.speak && S.speak.i === i;
    const near = S.near?.kind === "trader" && S.near.i === i;
    const key = `${i}:${S.ver}:${talking ? S.speak.text : ""}:${near}`;
    if (el.dataset.key === key) continue;
    el.dataset.key = key;
    const ag = S.town.agents[i];
    if (talking) {
      el.className = "bub say";
      el.textContent = S.speak.text;
      continue;
    }
    if (ag.holds === ag.needs) {
      el.className = "bub off";
      el.innerHTML = `${pic(ag.holds, "")}<span>eating</span>`;
      continue;
    }
    const wants = wantsOf(S.town, ag).sort((a, b) => (a === ag.needs ? -1 : b === ag.needs ? 1 : 0));
    const give = bestGive(S.town, S.me, i);
    el.className = `bub ${give >= 0 ? "can" : ""} ${near ? "near" : ""}`;
    const left = give >= 0 ? pic(give, "") : wants.slice(0, 2).map((g) => pic(g, "")).join("");
    const hint = near && give >= 0 ? `<kbd>${touchDevice ? "Use" : "E"}</kbd>` : "";
    el.innerHTML = `${hint}${left}<span class="ar">→</span>${pic(ag.holds, "")}`;
  }
}

// ------------------------------------------------------------ panels
function hideAllPanels() {
  for (const id of ["yard", "map", "end"]) $(id).classList.add("hidden");
  $("night").classList.add("hidden");
  $("fishing").classList.add("hidden");
  $("card").classList.add("hidden");
}
function openPanel(name) {
  if (S.fish || S.night || S.ended) return;
  closePanel();
  S.panel = name;
  held.clear();
  $(name).classList.remove("hidden");
  if (name === "yard") renderYard();
  if (name === "map") renderMap();
  sfx("open");
}
function closePanel() {
  if (!S || !S.panel) return;
  $(S.panel).classList.add("hidden");
  S.panel = null;
  sfx("close");
  renderHud();
}
for (const b of document.querySelectorAll("[data-close]")) b.addEventListener("click", closePanel);

function renderYard() {
  const { me } = S;
  const g = shop();
  $("yard-take").innerHTML = `Today I take ${pic(g)} <b>${GOODS[g]}</b>, because everyone does. You have <b>${me.bag[g]}</b>.`;
  const part = nextPart(me);
  const rows = [];
  if (part) rows.push({ cls: "next", key: "part", name: `Boat part ${me.parts + 1} of ${PARTS.length}: ${part.name}`, what: "Fix all four and you can sail away", cost: part.cost });
  for (const c of GEAR) if (!me.gear[c.key]) rows.push({ cls: "", key: c.key, name: c.name, what: c.what, cost: c.cost });
  $("yard-items").innerHTML = rows
    .map((r, k) => `<div class="item ${r.cls}"><div><b>${r.name}</b><span>${r.what}</span></div><button class="btn ${me.bag[g] >= r.cost ? "primary" : ""}" data-buy="${r.key}" ${me.bag[g] < r.cost ? 'aria-disabled="true"' : ""}>${r.cost} ${pic(g)}</button></div>`)
    .join("");
}
function payNext() {
  const me = S.me;
  if (!me.gear.duck && me.bag[shop()] >= GEAR[0].cost) return buyThing("duck");
  buyThing("part");
}
function buyThing(key) {
  const { town, me } = S;
  const res = key === "part" ? buyPart(town, me) : buyGear(town, me, key);
  if (!res.ok) {
    sfx("deny");
    return;
  }
  S.ver++;
  rebuildStack();
  renderBag();
  if (key === "part") {
    const m = boat.parts[me.parts - 1];
    m.visible = true;
    m.scale.setScalar(0.01);
    S.grow = { m, t: 0 };
    if (me.parts === 1) boat.wreck.visible = false;
    sfx("part");
    burst(WRECK.x, 2.5, WRECK.z, 40, [1, 0.85, 0.35], 7, 0.9, 0.5);
    banner(boatDone(me) ? "The boat is whole!" : `${res.part.name} fixed: ${me.parts} of ${PARTS.length}`, boatDone(me) ? "The tide is turning. Time to go." : "", "gold");
    if (boatDone(me)) {
      closePanel();
      return sail();
    }
  } else {
    sfx("buy");
    toast(key === "duck" ? `Duck saddle bought. Press ${touchDevice ? "Duck" : "R"} to ride, even across water.` : "Long rod bought: +1 fish on every catch.");
    drawKeys();
  }
  renderYard();
  renderHud();
}
$("yard-items").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b && !b.hasAttribute("aria-disabled")) buyThing(b.dataset.buy);
});

const MAP_PINS = () => [
  ...VILLAGES.map((v) => {
    const r = S.rules.roles.find((x) => x.key === v.role);
    return { x: v.x, z: v.z, html: `${v.name} ${pic(r.needs)}<span>→</span>${pic(r.makes)}` };
  }),
  { x: WRECK.x + 2, z: WRECK.z - 6, html: "Shipyard" },
  { x: SQUARE.x, z: SQUARE.z, html: "Market Square" },
];
function renderMap() {
  const area = $("map-area");
  if (!area.querySelector("canvas")) {
    const c = document.createElement("canvas");
    c.width = c.height = 640;
    drawIsland(c.getContext("2d"), 640);
    area.appendChild(c);
    const pins = document.createElement("div");
    pins.id = "map-pins";
    area.appendChild(pins);
  }
  const pct = (v) => `${(v / SIZE) * 100}%`;
  const you = `<span class="pin you" style="left:${pct(S.you.x)};top:${pct(S.you.z)}">You</span>`;
  const go = S.stepInfo ? `<span class="pin go" style="left:${pct(S.stepInfo.x)};top:${pct(S.stepInfo.z)}">Next</span>` : "";
  $("map-pins").innerHTML = MAP_PINS().map((p) => `<span class="pin" style="left:${pct(p.x)};top:${pct(p.z)}">${p.html}</span>`).join("") + go + you;
}
$("map-open").addEventListener("click", () => S && openPanel("map"));

function drawIsland(ctx, size) {
  ctx.fillStyle = "#1aa8ee";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(WORLD.ground.image, 0, 0, size, size);
  // the painted sea floor reads as land at this size, so wash it blue
  const img = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const h = heightAt((x / size) * SIZE, (y / size) * SIZE);
      if (h >= -0.1) continue;
      const i = (x + y * size) * 4, t = sstep(-0.1, -2, h);
      img.data[i] = lerp(120, 26, t);
      img.data[i + 1] = lerp(230, 168, t);
      img.data[i + 2] = lerp(235, 238, t);
    }
  ctx.putImageData(img, 0, 0);
}

let miniBase = null, miniT = 0;
function drawMini(t) {
  if (t - miniT < 0.12) return;
  miniT = t;
  const c = $("mini"), g = c.getContext("2d"), s = c.width;
  if (!miniBase) {
    miniBase = document.createElement("canvas");
    miniBase.width = miniBase.height = s;
    drawIsland(miniBase.getContext("2d"), s);
  }
  g.drawImage(miniBase, 0, 0);
  const k = s / SIZE;
  const info = S.stepInfo;
  if (info) {
    g.fillStyle = "#ffd166";
    g.strokeStyle = "#7a4a00";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(info.x * k, info.z * k, 6 + Math.sin(t * 5) * 1.5, 0, 7);
    g.fill();
    g.stroke();
  }
  const you = S.you;
  g.save();
  g.translate(you.x * k, you.z * k);
  g.rotate(Math.PI - you.dir);
  g.fillStyle = "#fff";
  g.strokeStyle = "#0d1433";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, -8);
  g.lineTo(6, 7);
  g.lineTo(-6, 7);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
}

// ------------------------------------------------------------ fishing
const FISH = [
  { name: "Pebble Minnow", a: "#8fd3ff", b: "#e8fbff", f: "#ffb454", rank: 0, cm: [12, 22], line: "Small, quick, and everywhere." },
  { name: "Salt Sprat", a: "#c8d8e8", b: "#ffffff", f: "#7fdcff", rank: 0, cm: [14, 24], line: "Tastes like it was already seasoned." },
  { name: "Sunset Perch", a: "#ff9a5c", b: "#ffe2b8", f: "#ff5d73", rank: 1, cm: [24, 38], line: "Bites best when the light goes orange." },
  { name: "River Ribbon", a: "#59d68c", b: "#e4ffd9", f: "#2ec4b6", rank: 1, cm: [30, 52], line: "All muscle, no manners." },
  { name: "Copper Carp", a: "#d98a3d", b: "#ffe0a8", f: "#a85a2a", rank: 2, cm: [40, 64], line: "Old enough to remember barter." },
  { name: "Moon Snapper", a: "#9b8cff", b: "#efe9ff", f: "#5a4ad8", rank: 2, cm: [38, 60], line: "Glows faintly. Nobody knows why." },
  { name: "Lantern Puffer", a: "#ffd166", b: "#fff4c8", f: "#ff8a3d", rank: 3, cm: [28, 44], line: "Puffs up when you look at it." },
  { name: "Tide King", a: "#1f8fd6", b: "#d9f4ff", f: "#ffd166", rank: 3, cm: [70, 110], line: "Wears the current like a cape." },
  { name: "Storm Marlin", a: "#47507a", b: "#c9d4ee", f: "#ff5d73", rank: 4, cm: [120, 190], rain: true, line: "Only comes up when the sky breaks." },
];
let fishMesh = null, rod = null, rodMid = null, rodEnd = null, bobber = null, fishLine = null, ring = null, shadow = null;

function initFishing() {
  rod = new THREE.Group();
  const r = brush();
  r.rod([0, -0.1, 0], [0, 0.32, 0], 0.03, 0.028, hex("#ff8a3d"), { seg: 6 });
  r.ball(0.09, 0.26, 0, 0.09, 0.09, 0.05, hex("#2a3560"), { seg: 7, rows: 3 });
  const hand = brush();
  hand.loft([{ y: -0.62, x: 0.075, dx: 0.14 }, { y: -0.08, x: 0.055 }], hex("#17b4f5"), { seg: 7, bottom: true });
  hand.ball(0, 0.04, 0, 0.066, 0.075, 0.066, hex("#f2c49b"), { seg: 7, rows: 4 });
  const tip = brush();
  tip.rod([0, 0, 0], [0, 0.8, 0], 0.024, 0.016, hex("#d8a56b"), { seg: 5 });
  const tip2 = brush();
  tip2.rod([0, 0, 0], [0, 0.8, 0], 0.016, 0.007, hex("#c98a56"), { seg: 5 });
  rod.add(new THREE.Mesh(r.build(), toon), new THREE.Mesh(hand.build(), toon));
  rodMid = new THREE.Mesh(tip.build(), toon);
  rodMid.position.y = 0.32;
  rodEnd = new THREE.Mesh(tip2.build(), toon);
  rodEnd.position.y = 0.8;
  rodMid.add(rodEnd);
  rod.add(rodMid);
  rod.position.set(0.46, -0.46, -1);
  rod.visible = false;
  camera.add(rod);

  const b = brush();
  b.ball(0, 0.09, 0, 0.17, 0.12, 0.17, hex("#ffffff"), { seg: 8, rows: 3, shade: 0 });
  b.ball(0, 0.2, 0, 0.17, 0.12, 0.17, hex("#ff5d5d"), { seg: 8, rows: 3, shade: 0 });
  bobber = new THREE.Mesh(b.build(), toon);
  bobber.scale.setScalar(1.5);
  bobber.visible = false;
  scene.add(bobber);

  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
  fishLine = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xffffff }));
  fishLine.frustumCulled = false;
  fishLine.visible = false;
  scene.add(fishLine);

  ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 36).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  ring.visible = false;
  ring.renderOrder = 2;
  scene.add(ring);
  shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0a2a60, transparent: true, opacity: 0.42, depthWrite: false }));
  shadow.visible = false;
  shadow.renderOrder = 2;
  scene.add(shadow);

  for (const f of FISH) f.geo = fishGeo(hex(f.a), hex(f.b), hex(f.f));
  fishMesh = new THREE.Mesh(FISH[0].geo, toon);
  fishMesh.visible = false;
  scene.add(fishMesh);
}

function startFishing(o) {
  const d = o.d;
  S.you.vx = S.you.vz = 0;
  if (S.you.riding) toggleDuck();
  S.you.x = o.x;
  S.you.z = o.z;
  S.you.dir = Math.atan2(d.dx, d.dz);
  S.fish = { o, dock: d, ex: o.x, ez: o.z, stage: "aim", t: 0, pow: 0, zone: 0.3 + Math.random() * 0.5, up: true, charging: false, side: 0, tension: 0, peak: 0, reel: 0 };
  view.mode = "first";
  $("fishing").classList.remove("hidden");
  $("hud").classList.add("reeling");
  hideTip();
  if (touchDevice) {
    document.querySelector(".pads").classList.add("hidden");
    $("stick").classList.add("hidden");
    $("fish-pads").classList.remove("hidden");
    $("t-left").classList.add("hidden");
    $("t-right").classList.add("hidden");
    $("t-hold").textContent = "Cast";
  }
  rod.visible = true;
  placeTarget();
  renderFish();
}

function placeTarget() {
  const f = S.fish, d = f.dock;
  f.far = 7 + f.zone * 15;
  f.tx = f.ex + d.dx * f.far + d.dz * (Math.random() - 0.5) * 3;
  f.tz = f.ez + d.dz * f.far - d.dx * (Math.random() - 0.5) * 3;
  ring.visible = true;
  ring.position.set(f.tx, 0.12, f.tz);
  $("cast-zone").style.left = `${(f.zone - 0.075) * 100}%`;
  $("cast-zone").style.width = "15%";
}

function stopFishing() {
  if (!S.fish) return;
  S.fish = null;
  view.mode = "third";
  view.yaw = cam.yaw;
  rod.visible = bobber.visible = fishLine.visible = ring.visible = shadow.visible = fishMesh.visible = false;
  $("fishing").classList.add("hidden");
  $("card").classList.add("hidden");
  $("hud").classList.remove("reeling");
  if (touchDevice) {
    document.querySelector(".pads").classList.remove("hidden");
    $("stick").classList.remove("hidden");
    $("fish-pads").classList.add("hidden");
  }
  renderHud();
}

function fishDown() {
  const f = S.fish;
  if (!f) return;
  if (f.stage === "aim") {
    f.charging = true;
    f.t = 0;
    f.pow = 0;
    f.up = true;
    renderFish();
  } else if (f.stage === "bite") strike();
  else if (f.stage === "card" && f.t > 0.5) nextCast();
}
function fishUp() {
  const f = S.fish;
  if (!f || !f.charging) return;
  f.charging = false;
  cast();
}

function cast() {
  const f = S.fish, d = f.dock;
  const miss = Math.abs(f.pow - f.zone);
  f.castQ = clamp(1 - miss / 0.42, 0, 1);
  f.perfect = miss < 0.08;
  const dist = 6 + f.pow * 16.5;
  f.bx = f.ex + d.dx * dist + (f.tx - f.ex - d.dx * f.far) * (1 - miss);
  f.bz = f.ez + d.dz * dist + (f.tz - f.ez - d.dz * f.far) * (1 - miss);
  f.stage = "fly";
  f.t = 0;
  bobber.visible = fishLine.visible = true;
  sfx("jump");
  renderFish();
}

function pickFish(q) {
  const wet = raining();
  const top = Math.floor(q * 3.3);
  const pool = FISH.filter((x) => (x.rain ? wet && q > 0.75 : x.rank <= top && x.rank >= top - 1));
  return pool[Math.floor(Math.random() * pool.length)] ?? FISH[0];
}

function strike() {
  const f = S.fish;
  f.strikeQ = clamp(1 - f.t / 0.8, 0, 1);
  f.kind = pickFish(f.castQ * 0.6 + f.strikeQ * 0.4);
  f.stage = "fight";
  f.t = 0;
  f.reel = 0;
  f.tension = 0.15;
  f.peak = 0;
  f.pull = 0;
  f.pullT = 0.5;
  f.need = 2.4 + f.kind.rank * 0.9;
  cam.shake = 0.14;
  sfx("reel");
  if (touchDevice) {
    $("t-left").classList.remove("hidden");
    $("t-right").classList.remove("hidden");
    $("t-hold").classList.add("hidden");
  }
  renderFish();
}

function endFight(won) {
  const f = S.fish, me = S.me;
  fishLine.visible = bobber.visible = shadow.visible = false;
  f.side = 0;
  if (touchDevice) {
    $("t-left").classList.add("hidden");
    $("t-right").classList.add("hidden");
    $("t-hold").classList.remove("hidden");
  }
  if (!won) {
    f.stage = "card";
    f.t = 0;
    f.lost = true;
    sfx("snap");
    cam.shake = 0.2;
    say(null, "The line snapped.");
    renderFish();
    return nextCast(1.1);
  }
  const score = Math.round(f.castQ * 30 + f.strikeQ * 30 + (1 - f.peak) * 40);
  const got = catchFish(me, score + 15);
  S.ver++;
  f.stage = "card";
  f.t = 0;
  f.lost = false;
  sfx("catch");
  burst(f.ex + f.dock.dx * 3, 0.4, f.ez + f.dock.dz * 3, 36, [1, 1, 1], 8, 0.8, 0.8);
  const k = f.kind;
  fishMesh.geometry = k.geo;
  fishMesh.visible = true;
  fishMesh.scale.setScalar(1 + k.rank * 0.25);
  const cm = Math.round(lerp(k.cm[0], k.cm[1], clamp(score / 100, 0, 1)));
  const isNew = !S.book[k.name];
  S.book[k.name] = Math.max(S.book[k.name] || 0, cm);
  saveBook();
  const stars = "★".repeat(k.rank + 1) + '<span style="opacity:.25">' + "★".repeat(4 - k.rank) + "</span>";
  const card = $("card");
  card.innerHTML = `${isNew ? '<span class="new">NEW</span>' : ""}<h3>${k.name}</h3><div class="stars">${stars}</div><p>${cm} cm. ${k.line}</p><p class="plus">+${got} ${pic(1)} ${score >= 70 ? "Clean catch!" : ""}</p><p style="font-size:14px;color:#46507a">${Object.keys(S.book).length} of ${FISH.length} in your fish book</p>`;
  card.classList.remove("hidden");
  renderBag();
  bump(1);
  rebuildStack();
  renderFish();
  if (S.firstFish) S.firstFish = false;
}

function nextCast(delay = 0) {
  const f = S.fish;
  if (!f) return;
  if (delay) {
    f.wait = delay;
    f.stage = "rest";
    f.t = 0;
    return;
  }
  $("card").classList.add("hidden");
  fishMesh.visible = false;
  f.stage = "aim";
  f.t = 0;
  f.zone = 0.3 + Math.random() * 0.5;
  placeTarget();
  renderFish();
}

const tipLocal = new THREE.Vector3();
function rodTip(out) {
  tipLocal.set(0, 0.8, 0);
  rodEnd.updateWorldMatrix(true, false);
  return out.copy(tipLocal).applyMatrix4(rodEnd.matrixWorld);
}
const tipW = new THREE.Vector3();

function updateFishing(dt) {
  const f = S.fish;
  const d = f.dock;
  f.t += dt;
  const t = performance.now() / 1000;
  ring.scale.setScalar(1.2 + ((t * 1.2) % 1) * 1.5);
  ring.material.opacity = (1 - (t * 1.2) % 1) * 0.65;
  let tilt = 0.5, lean = 0, push = 0;

  if (f.stage === "aim") {
    if (f.charging) {
      f.pow += (f.up ? 1 : -1) * dt * 1.15;
      if (f.pow >= 1) f.up = false;
      if (f.pow <= 0) f.up = true;
      f.pow = clamp(f.pow, 0, 1);
      $("cast-mark").style.left = `${f.pow * 100}%`;
      tilt = 0.5 - f.pow * 1.2;
    }
  } else if (f.stage === "fly") {
    const k = Math.min(1, f.t / 0.55);
    tilt = lerp(-0.7, 0.8, sstep(0, 0.4, k));
    rodTip(tipW);
    bobber.position.set(lerp(tipW.x, f.bx, k), lerp(tipW.y, 0.05, k) + Math.sin(k * Math.PI) * 3.2, lerp(tipW.z, f.bz, k));
    if (k >= 1) {
      f.stage = "wait";
      f.t = 0;
      f.wait = (f.perfect ? 0.9 : 1.8) + Math.random() * 1.8;
      f.nibbles = f.wait > 1.6 ? [f.wait * 0.45] : [];
      sfx("plop");
      burst(f.bx, 0.1, f.bz, 16, [1, 1, 1], 4.4, 0.55, 0.8);
      ring.visible = false;
      shadow.visible = true;
      f.sa = Math.random() * 6.28;
      renderFish();
    }
  } else if (f.stage === "wait") {
    tilt = 0.8;
    const k = Math.min(1, f.t / f.wait);
    const r = lerp(6, 0.9, k * k);
    f.sa += dt * 0.7;
    shadow.position.set(f.bx + Math.cos(f.sa) * r, 0.08, f.bz + Math.sin(f.sa) * r);
    shadow.scale.set(0.9, 1, 0.42);
    shadow.rotation.y = -f.sa;
    bobber.position.set(f.bx, Math.sin(t * 3.2) * 0.04, f.bz);
    if (f.nibbles.length && f.t > f.nibbles[0]) {
      f.nibbles.shift();
      f.dip = 0.32;
      sfx("tick");
      burst(f.bx, 0.1, f.bz, 4, [1, 1, 1], 1.6, 0.3, 0.6);
    }
    if (f.dip > 0) {
      f.dip -= dt;
      bobber.position.y -= 0.2;
    }
    if (f.t > f.wait) {
      f.stage = "bite";
      f.t = 0;
      sfx("bite");
      cam.shake = 0.1;
      burst(f.bx, 0.1, f.bz, 12, [1, 1, 1], 3, 0.4, 0.7);
      renderFish();
    }
  } else if (f.stage === "bite") {
    tilt = 0.86;
    bobber.position.set(f.bx, -0.32 + Math.sin(t * 34) * 0.08, f.bz);
    if (f.t > 0.9) {
      f.stage = "card";
      f.t = 0;
      say(null, "Too slow. It spat the hook.");
      fishLine.visible = bobber.visible = shadow.visible = false;
      nextCast(0.9);
      return;
    }
  } else if (f.stage === "fight") {
    f.pullT -= dt;
    if (f.pullT <= 0) {
      const opts = f.pull === 0 ? [-1, 1] : [0, -f.pull];
      f.pull = opts[Math.floor(Math.random() * opts.length)];
      f.pullT = f.pull ? 0.75 + Math.random() * 0.75 - f.kind.rank * 0.05 : 0.45;
      if (f.pull) {
        sfx("splash");
        cam.shake = 0.07;
      }
      renderFish();
    }
    const hold = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
    const good = f.pull !== 0 && hold === -f.pull;
    const rest = f.pull === 0;
    if (good || rest) {
      f.reel += (dt * (good ? 1.25 : 0.55)) / f.need;
      f.tension = Math.max(0, f.tension - dt * 0.42);
      if (Math.random() < dt * 8) sfx("reel");
    } else {
      f.tension += dt * (hold === f.pull ? 0.72 : 0.42) * (1 + f.kind.rank * 0.12);
      if (Math.random() < dt * 5) sfx("creak");
    }
    f.peak = Math.max(f.peak, f.tension);
    f.side = f.pull * 1.6;
    const w = f.pull * (1 - f.reel) * 5;
    f.fx = lerp(f.fx ?? f.bx, f.bx + d.dz * w - d.dx * f.reel * 10, 1 - Math.exp(-dt * 3));
    f.fz = lerp(f.fz ?? f.bz, f.bz - d.dx * w - d.dz * f.reel * 10, 1 - Math.exp(-dt * 3));
    bobber.position.set(f.fx, -0.25, f.fz);
    shadow.position.set(f.fx, 0.08, f.fz);
    shadow.scale.set(1.2 + f.kind.rank * 0.4, 1, 0.56);
    if (f.pull && Math.random() < dt * 22) burst(f.fx, 0.1, f.fz, 3, [1, 1, 1], 3, 0.4, 0.7);
    tilt = 0.25 - f.tension * 0.35;
    lean = -hold * 0.42;
    push = f.tension * 0.12;
    $("line-bar").style.width = `${Math.min(100, f.tension * 100)}%`;
    $("reel-bar").style.width = `${Math.min(100, f.reel * 100)}%`;
    $("pull-l").className = `pull left ${f.pull === 1 ? "go" : ""} ${hold < 0 ? "hold" : ""}`;
    $("pull-r").className = `pull right ${f.pull === -1 ? "go" : ""} ${hold > 0 ? "hold" : ""}`;
    fishLine.material.color.setRGB(1, 1 - f.tension * 0.8, 1 - f.tension * 0.9);
    if (f.reel >= 1) {
      f.fx = f.fz = undefined;
      return endFight(true);
    }
    if (f.tension >= 1) {
      f.fx = f.fz = undefined;
      return endFight(false);
    }
  } else if (f.stage === "card") {
    tilt = 0.1;
    if (fishMesh.visible) {
      const k = Math.min(1, f.t / 0.5);
      const e = 1 - (1 - k) ** 3;
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      fishMesh.position.set(lerp(f.ex + d.dx * 6, camera.position.x + camDir.x * 3, e), lerp(0, camera.position.y + camDir.y * 3 + 0.35, e) + Math.sin(k * Math.PI) * 1.4, lerp(f.ez + d.dz * 6, camera.position.z + camDir.z * 3, e));
      fishMesh.rotation.y += dt * 2.6;
      fishMesh.rotation.z = Math.sin(t * 8) * 0.14;
    }
    if (f.t > 3.2) nextCast();
  } else if (f.stage === "rest") {
    if (f.t > f.wait) nextCast();
  }

  rod.rotation.x = lerp(rod.rotation.x, tilt - 0.5, 1 - Math.exp(-dt * 12));
  rod.rotation.z = lerp(rod.rotation.z, lean - 0.15, 1 - Math.exp(-dt * 10));
  rod.position.z = -1 + push;
  const bend = f.stage === "fight" ? 0.22 + f.tension * 0.5 : f.stage === "bite" ? 0.3 : 0.04;
  f.bend = lerp(f.bend ?? 0, bend, 1 - Math.exp(-dt * 14));
  rodMid.rotation.x = -f.bend * 0.8;
  rodEnd.rotation.x = -f.bend * 1.3;
  if (fishLine.visible) {
    rodTip(tipW);
    const pos = fishLine.geometry.attributes.position;
    const bx = bobber.position.x, by = bobber.position.y + 0.2, bz = bobber.position.z;
    const slack = f.stage === "fight" ? (1 - f.tension) * 0.5 : 1.3;
    for (let i = 0; i < 16; i++) {
      const k = i / 15;
      pos.setXYZ(i, lerp(tipW.x, bx, k), lerp(tipW.y, by, k) - Math.sin(k * Math.PI) * slack, lerp(tipW.z, bz, k));
    }
    pos.needsUpdate = true;
  }
}

function renderFish() {
  const f = S.fish;
  if (!f) return;
  const say2 = $("fish-say");
  const hold = touchDevice ? "Hold the button" : "Hold Space";
  const text = {
    aim: f.charging ? "Let go in the gold!" : `${hold}, let go in the gold`,
    fly: "",
    wait: f.perfect ? "Nice cast! Watch the float..." : "Watch the float...",
    bite: touchDevice ? "NOW! Tap!" : "NOW! Press Space!",
    fight: touchDevice ? "Press against the pull" : "Press against the pull: A or D",
    card: "",
    rest: "",
  }[f.stage];
  say2.textContent = text;
  say2.classList.toggle("hidden", !text);
  say2.classList.toggle("hot", f.stage === "bite");
  $("cast-bar").classList.toggle("hidden", !(f.stage === "aim"));
  $("fight").classList.toggle("hidden", f.stage !== "fight");
  $("fish-foot").innerHTML = touchDevice ? '<button class="mini" id="fish-stop">Stop fishing</button>' : "<kbd>Q</kbd> stop fishing";
  $("fish-stop")?.addEventListener("pointerdown", stopFishing);
  if (touchDevice) $("t-hold").textContent = f.stage === "bite" ? "Hook!" : "Cast";
}

// ------------------------------------------------------------ night, storm, sailing
function beginNight() {
  if (S.night || S.ended) return;
  stopFishing();
  closePanel();
  const ev = rainEvent();
  const stormy = !!ev && S.town.day < ev.day && S.town.day + TOWN_DAYS_PER_NIGHT >= ev.day && rainGood() >= 0;
  S.night = { t: 0, dur: stormy ? 4.6 : 3, sky: Math.max(S.clock * 0.9, 0.7), storm: stormy, applied: false, flashes: stormy ? [1.1, 1.8, 2.9, 3.5] : [] };
  $("night").classList.remove("hidden");
  $("night-title").textContent = stormy ? "The storm breaks" : `Night ${dayNum()}`;
  $("night-text").textContent = stormy ? `${cap(GOODS[rainGood()])} is soaking through.` : "The village trades without you.";
  sfx("night");
}

function updateNight(dt) {
  const n = S.night;
  n.t += dt;
  const k = n.t / n.dur;
  n.sky = k < 0.45 ? lerp(n.sky, 1, 1 - Math.exp(-dt * 5)) : lerp(1, 0, sstep(0.72, 1, k));
  if (n.flashes.length && n.t > n.flashes[0]) {
    n.flashes.shift();
    const el = $("flash");
    el.style.transition = "none";
    el.style.opacity = "0.85";
    void el.offsetWidth;
    el.style.transition = "opacity 0.5s";
    el.style.opacity = "0";
    cam.shake = 0.5;
    sfx("thunder");
  }
  if (k >= 0.5 && !n.applied) applyNight();
  if (k >= 0.8) $("night").classList.add("hidden");
  if (k >= 1) {
    S.night = null;
    S.clock = 0;
    sfx("dawn");
    if (S.town.day >= DAYS * TOWN_DAYS_PER_NIGHT) return finish(false);
    showBanners();
    renderHud();
  }
}

function applyNight() {
  S.night.applied = true;
  const { town, me, rival } = S;
  const before = money();
  const shopWas = shop();
  const worthWas = worthNow(town, me);
  if (!boatDone(rival)) playDay(town, rival, { casts: 3, score: 55, swaps: 4 });
  const r = nightFall(town, me, [rival]);
  S.ver++;
  const lost = r.lost.reduce((a, b) => a + b, 0);
  S.lost += lost;
  r.lost.forEach((u, g) => {
    if (u) document.querySelector(`.slot[data-g="${g}"]`)?.classList.add("loss");
  });
  const m = money();
  const g = shop();
  S.log.push({ money: m, worth: worthNow(town, me) });
  if (lost) S.banners.push({ title: `${r.lost.map((u, k) => (u ? `-${u} ${pic(k)}` : "")).join(" ")} rotted overnight`, text: "", cls: "bad" });
  if (m !== before && m >= 0) {
    S.moneyBorn++;
    S.banners.push({ title: `${pic(m)} ${cap(GOODS[m])} is money now`, text: before >= 0 ? `It replaced ${GOODS[before]}. Nobody decided it.` : "Nobody decided it. People just started taking it.", cls: "gold", sound: "money" });
  } else if (m < 0 && before >= 0) S.banners.push({ title: `${cap(GOODS[before])} stopped being money`, text: "The town is bartering again. What will it trust next?", cls: "bad" });
  if (g !== shopWas) S.banners.push({ title: `The shipwright now takes ${pic(g)} ${GOODS[g]}`, text: `Your ${GOODS[shopWas]} no longer buys boat parts.`, cls: "bad", sound: "deny" });
  const ev = rainEvent();
  if (ev && !S.told && rainGood() >= 0 && town.day >= (ev.decideDay ?? 0) && town.day < ev.day) {
    S.told = true;
    S.banners.push({ title: `Storm after day ${stormDay()}`, text: `It will soak ${GOODS[rainGood()]}, the good people hoard most. Spend it or swap it before then.`, cls: "bad", sound: "thunder" });
  }
  if (ev && !S.sawRain && raining()) {
    S.sawRain = true;
    S.banners.push({ title: "The rain is here", text: `${cap(GOODS[rainGood()])} now rots ${ev.spoil}% a day. The Storm Marlin is biting.`, cls: "bad" });
  }
  if (boatDone(rival) && !S.rivalDone) {
    S.rivalDone = dayNum() - 1;
    S.banners.push({ title: "Mira sailed away", text: "Her boat is gone. Yours is still on the sand.", cls: "bad" });
    miraBoat.root.visible = false;
  }
  for (const [m2, on] of miraBoat.parts.map((p, i) => [p, i < rival.parts])) m2.visible = on;
  miraBoat.wreck.visible = rival.parts === 0;
  rebuildStack();
  renderBag();
  void worthWas;
}

function banner(title, text, cls = "") {
  S.banners.unshift({ title, text, cls });
  S.showing = false;
  clearTimeout(bannerTimer);
  showBanners();
}
let bannerTimer = null;
function showBanners() {
  if (S.showing || !S.banners.length) return;
  const b = S.banners.shift();
  const el = $("banner");
  el.className = `banner ${b.cls || ""}`;
  el.innerHTML = `<h2>${b.title}</h2>${b.text ? `<p>${b.text}</p>` : ""}`;
  S.showing = true;
  if (b.sound) sfx(b.sound);
  bannerTimer = setTimeout(() => {
    el.classList.add("hidden");
    if (S) S.showing = false;
    if (S) setTimeout(showBanners, 160);
  }, 3400);
}

let toastTimer = null;
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3600);
}
function showTip(text) {
  S.tips.shown = true;
  $("tip").textContent = text;
  $("tip").classList.remove("hidden");
}
const hideTip = () => $("tip").classList.add("hidden");

function sail() {
  S.won = dayNum();
  if (S.you.riding) toggleDuck();
  S.parting = { x: WRECK.x, z: WRECK.z, t: 0, dx: WRECK.x - 64, dz: WRECK.z - 64 };
  const l = Math.hypot(S.parting.dx, S.parting.dz);
  S.parting.dx /= l;
  S.parting.dz /= l;
  view.mode = "cine";
  view.yaw = cam.yaw;
}
function updateParting(dt) {
  const b = S.parting;
  b.t += dt;
  const go = sstep(0.6, 3.5, b.t) * 7;
  b.x += b.dx * go * dt;
  b.z += b.dz * go * dt;
  boat.root.position.set(b.x, Math.sin(b.t * 1.4) * 0.12 - 0.1, b.z);
  boat.root.rotation.z = Math.sin(b.t * 1.1) * 0.03;
  if (b.t > 6) {
    S.parting = null;
    finish(true);
  }
}

function drawChart() {
  const w = S.log.map((l) => l.worth);
  const max = Math.max(...w, 1);
  const W = 600, H = 155;
  const x = (i) => (i / Math.max(1, w.length - 1)) * W;
  const y = (v) => H - (v / max) * (H - 12) - 4;
  const colors = ["#f4f7fb", "#2ec4b6", "#f2c94c", "#9b5de5", "#b5651d"];
  const bands = S.log.map((d, i) => `<rect x="${x(i)}" y="${H + 3}" width="${W / Math.max(1, w.length - 1) + 1}" height="9" fill="${d.money >= 0 ? colors[d.money] : "#44506e"}"/>`).join("");
  const line = w.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const dlMax = DL_PRICES[0];
  const dl = DL_PRICES.map((p, i) => `${((i / (DL_PRICES.length - 1)) * W).toFixed(1)},${(H - (p / dlMax) * (H - 12) - 4).toFixed(1)}`).join(" ");
  $("end-chart").innerHTML = `<polyline points="${dl}" fill="none" stroke="#ff6b6b" stroke-width="2" stroke-dasharray="6 5" vector-effect="non-scaling-stroke"/><polyline points="${line}" fill="none" stroke="#00bfff" stroke-width="4" vector-effect="non-scaling-stroke"/>${bands}`;
  let peak = 0, drop = 0;
  for (const v of w) {
    peak = Math.max(peak, v);
    if (peak) drop = Math.max(drop, (peak - v) / peak);
  }
  return Math.round(drop * 100);
}

function finish(won) {
  S.ended = true;
  stopFishing();
  closePanel();
  S.banners = [];
  clearTimeout(bannerTimer);
  $("banner").classList.add("hidden");
  $("hud").classList.add("hidden");
  $("touch").classList.add("hidden");
  view.mode = "orbit";
  view.yaw = cam.yaw;
  const { town, me } = S;
  const firstHome = won && (!S.rivalDone || S.won <= S.rivalDone);
  $("end-kick").textContent = won ? `Day ${S.won} of ${DAYS}` : "The tenth night";
  $("end-title").textContent = won ? (firstHome ? "You sailed before Mira" : "You sailed, after Mira") : `Stranded with ${me.parts} of ${PARTS.length} boat parts`;
  const drop = drawChart();
  $("end-sub").textContent = won
    ? drop >= 25
      ? `Your wealth fell ${drop}% at its worst, and you still got out. Diamond Lock holders fell 99.8%.`
      : `Your wealth never fell more than ${drop}%. You moved before the money did. Diamond Lock holders fell 99.8%.`
    : drop >= 25
      ? `Your wealth fell ${drop}% when the money moved. That is what holding the wrong thing feels like.`
      : "The money moved, and the boat stayed on the sand. Try spending before the storm.";
  const story = [];
  let prev = -1;
  town.history.forEach((h, d) => {
    if (h.money !== prev) {
      const day = Math.floor(d / TOWN_DAYS_PER_NIGHT) + 1;
      if (h.money >= 0) story.push(`Day ${day}: ${GOODS[h.money]} became money${prev >= 0 ? `, replacing ${GOODS[prev]}` : ""}.`);
      prev = h.money;
    }
  });
  if (!story.length) story.push("This island never settled on a money.");
  $("end-story").textContent = `${story.join(" ")} Nobody decided any of it, and nobody could print a single unit. You caught ${me.caught} fish and made ${S.swaps} swaps.`;
  $("end").classList.remove("hidden");
  $("play-next").classList.remove("hidden");
}

// ------------------------------------------------------------ sound toggle
function toggleSound() {
  setMuted(!isMuted());
  $("sound").textContent = isMuted() ? "Sound off" : "Sound on";
}
$("sound").addEventListener("click", toggleSound);
$("sleep").addEventListener("click", () => S && canWalk() && beginNight());
$("help").addEventListener("click", () => {
  toast(touchDevice ? "Goal: fix four boat parts. Follow the gold trail. Green bubbles can swap with you." : "Goal: fix four boat parts. Follow the gold trail. Green bubbles can swap with you. E use, R duck, M map.");
});

// ------------------------------------------------------------ HUD
function bump(g) {
  const el = document.querySelector(`.slot[data-g="${g}"]`);
  if (!el) return;
  el.classList.add("bump");
  setTimeout(() => el.classList.remove("bump"), 160);
}
function renderBag() {
  const { me, town } = S;
  const g = shop();
  $("bag").innerHTML = me.bag
    .map((u, k) => `<div class="slot ${u ? "" : "none"} ${k === g ? "money" : ""}" data-g="${k}" title="${cap(GOODS[k])}: loses ${town.spoil[k]}% a day">${k === g ? '<span class="tagm">shipyard takes</span>' : ""}${pic(k, "")}<span class="count">${u}</span></div>`)
    .join("");
}
function drawKeys() {
  const you = S.you;
  const near = S.near;
  $("t-duck").classList.toggle("hidden", !S.me.gear.duck);
  $("t-use").textContent = near?.kind === "dock" ? "Fish" : near?.kind === "yard" ? "Open" : near?.kind === "bed" ? "Sleep" : near?.kind === "trader" ? "Swap" : "Use";
  $("t-use").style.opacity = near ? 1 : 0.5;
  if (touchDevice) return;
  const verb = near ? { dock: "fish here", yard: "open the shipyard", bed: "sleep", trader: "swap" }[near.kind] : null;
  $("keys").innerHTML = [
    verb ? `<kbd>E</kbd> ${verb}` : "",
    "<kbd>WASD</kbd> move <kbd>Shift</kbd> sprint <kbd>Space</kbd> jump",
    `${S.me.gear.duck ? `<kbd>R</kbd> ${you.riding ? "get off" : "ride duck"} ` : ""}<kbd>M</kbd> map <kbd>Ctrl</kbd> + scroll zoom`,
  ].filter(Boolean).join("<br>");
}
function renderHud() {
  const { me, town, rival } = S;
  $("day-n").textContent = `Day ${Math.min(DAYS, dayNum())}`;
  $("pips").innerHTML = PARTS.map((_, i) => `<i class="${i < me.parts ? "on" : ""}"></i>`).join("");
  const m = money(), g = shop();
  $("town-money").innerHTML = m >= 0 ? `${pic(m)} ${cap(GOODS[m])} is money` : `<span class="no">No money yet</span>`;
  const ev = rainEvent();
  const chip = $("storm-chip");
  if (ev && !raining() && rainGood() >= 0 && town.day >= (ev.decideDay ?? 9)) {
    const left = stormDay() - dayNum();
    chip.innerHTML = `Storm ${left > 0 ? `in ${left} day${left > 1 ? "s" : ""}` : "tonight"}: soaks ${pic(rainGood())} ${GOODS[rainGood()]}`;
    chip.classList.remove("hidden");
  } else chip.classList.add("hidden");
  renderBag();
  drawKeys();
  S.routeT = 0;
  void g;
  void rival;
  void bagCount;
}

// ------------------------------------------------------------ start
function startRun(kind) {
  const seed = kind === "salt" ? Number(qs.get("seed")) || 1 : crypto.getRandomValues(new Uint32Array(1))[0] % 100000;
  unlockAudio();
  music(true);
  newRun(kind, seed);
  $("title").classList.add("hidden");
  $("hud").classList.remove("hidden");
  $("end").classList.add("hidden");
  $("banner").classList.add("hidden");
  $("tip").classList.add("hidden");
  if (touchDevice) $("touch").classList.remove("hidden");
  view.mode = "roam";
  if (kind === "mystery") toast(`Island #${seed}. Different goods last, so nobody knows what becomes money here.`);
  else say(null, "Your boat broke. Nobody here uses coins. Follow the gold trail.");
  renderHud();
}
$("play").addEventListener("click", () => startRun("salt"));
$("play-next").addEventListener("click", () => startRun("mystery"));
$("again").addEventListener("click", () => startRun("mystery"));
$("replay").addEventListener("click", () => {
  $("end").classList.add("hidden");
  startRun(S.kind);
});

function iconOf(geo, size = 160, yaw = 0.7, tilt = 0.55, span = 0.72, centerY = 0.3) {
  const rt = new THREE.WebGLRenderTarget(size, size);
  const sc = new THREE.Scene();
  const m = new THREE.Mesh(geo, toon);
  const o = new THREE.Mesh(geo, ink);
  sc.add(m, o);
  const c = new THREE.OrthographicCamera(-span, span, span, -span, 0.1, 20);
  c.position.set(Math.sin(yaw) * Math.cos(tilt) * 6, centerY + Math.sin(tilt) * 6, Math.cos(yaw) * Math.cos(tilt) * 6);
  c.lookAt(0, centerY, 0);
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(sc, c);
  const buf = new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
  renderer.setRenderTarget(null);
  rt.dispose();
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d");
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
  g.putImageData(img, 0, 0);
  return cv.toDataURL("image/png");
}

const MIRA = { x: 118, z: 70 };
function boot() {
  resize();
  WORLD = buildIsland(scene, tier);
  sky = makeSky(scene);
  makeClouds(scene);
  rain = makeRain(scene, tier ? 1200 : 500);
  initParticles();
  initTrail();
  initFishing();

  GOOD_GEO = GOODS.map((_, g) => goodGeo(g));
  ICONS = GOOD_GEO.map((g) => iconOf(g));

  crowd = makeCrowd(scene, SALT_TOWN.roles);
  const seen = {};
  SALT_TOWN.roles.forEach((r) => {
    for (let k = 0; k < r.count; k++) {
      const n = (seen[r.key] = (seen[r.key] ?? -1) + 1);
      const s = WORLD.spots[r.key][n % WORLD.spots[r.key].length];
      V.push({ hx: s.x, hz: s.z, x: s.x, z: s.z, tx: s.x, tz: s.z, ry: (V.length * 2.1) % 6.28, wait: 1, hop: 0, greeted: false, walk: 0 });
    }
  });

  hero = makeHero();
  scene.add(hero.root);
  hero.body.add(stack.group);
  stack.group.position.set(0, 0.86, -0.72);
  GOOD_GEO.forEach((g) => {
    const m = new THREE.InstancedMesh(g, toon, 16);
    m.count = 0;
    m.frustumCulled = false;
    stack.group.add(m);
    stack.lists.push(m);
  });
  duck = makeDuck();
  scene.add(duck.root);
  boat = makeBoat();
  scene.add(boat.root);
  miraBoat = makeBoat();
  scene.add(miraBoat.root);
  miraBoat.root.rotation.y = 1.9;
  keeper = makeKeeper();
  keeper.position.set(YARD.x - 2, groundAt(YARD.x - 2, YARD.z - 3.4), YARD.z - 3.4);
  keeper.scale.setScalar(1.15);
  scene.add(keeper);
  mira = makeKeeper("weaver");
  mira.position.set(MIRA.x - 5, groundAt(MIRA.x - 5, MIRA.z), MIRA.z);
  mira.rotation.y = 1.5;
  mira.scale.setScalar(1.08);
  scene.add(mira);

  pillar = new THREE.Group();
  pillar.position.set(SQUARE.x, 6, SQUARE.z);
  const statue = GOOD_GEO.map((g) => {
    const m = inked(g, pillar);
    m.scale.setScalar(3.4);
    m.position.y = -1;
    m.visible = false;
    return m;
  });
  scene.add(pillar);
  pillar.userData.statue = statue;

  // lamps: one soft sprite cloud, visible from dusk
  const lp = new Float32Array(WORLD.lamps.length * 3);
  const ls = new Float32Array(WORLD.lamps.length);
  WORLD.lamps.forEach((l, i) => {
    lp.set([l[0], l[1], l[2]], i * 3);
    ls[i] = l[3];
  });
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.BufferAttribute(lp, 3));
  lg.setAttribute("sz", new THREE.BufferAttribute(ls, 1));
  lampGlow = new THREE.Points(lg, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uH: { value: 800 }, opacity: { value: 0 } },
    vertexShader: `attribute float sz; uniform float uH; void main() { vec4 mv = viewMatrix * vec4(position, 1.0); gl_PointSize = sz * 6.0 * uH / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float opacity; void main() { float d = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(1.0, 0.76, 0.42, opacity * pow(max(0.0, 1.0 - d), 2.0) * 0.8); }`,
  }));
  lampGlow.frustumCulled = false;
  lampGlow.renderOrder = 4;
  Object.defineProperty(lampGlow.material, "opacity", { get: () => lampGlow.material.uniforms.opacity.value, set: (v) => (lampGlow.material.uniforms ? (lampGlow.material.uniforms.opacity.value = v) : 0), configurable: true });
  scene.add(lampGlow);

  newRun("salt", Number(qs.get("seed")) || 1);
  bindTouch();
  $("loading").textContent = "";
  $("title").classList.remove("hidden");
  drawKeys();
  requestAnimationFrame(frame);
}

function updateStatue() {
  const m = money();
  pillar.userData.statue.forEach((s, i) => (s.visible = i === m));
}
setInterval(() => S && pillar && updateStatue(), 400);
setInterval(() => {
  if (!S?.grow) return;
  const g = S.grow;
  g.t += 0.05;
  const k = Math.min(1, g.t / 0.5);
  g.m.scale.setScalar(1 + (1 - k) * Math.sin(k * 9) * 0.25 - (1 - k) * (1 - k) * 0.9);
  if (k >= 1) S.grow = null;
}, 40);
addEventListener("resize", resize);
boot();

// ?debug exposes the live state for automated play-throughs; run(ms) advances
// the clock by hand, for when the page sits in a background tab.
if (qs.has("debug")) {
  window.mintless = {
    state: () => S,
    view,
    cam,
    world: () => WORLD,
    V,
    info: () => renderer.info.render,
    tier: () => tier,
    gpu: () => glInfo,
    start: startRun,
    trade,
    use,
    startFishing,
    stopFishing,
    beginNight,
    buyThing,
    fishDown,
    fishUp,
    held,
    toggleDuck,
    openPanel,
    closePanel,
    run(ms) {
      let now = performance.now();
      const t0 = performance.now();
      for (const end = now + ms; now < end; now += 16) update(0.016, now);
      for (let i = 0; i < 40; i++) placeCamera(0.03);
      render(now / 1000, 0.016);
      return Math.round(performance.now() - t0);
    },
    // A hidden page does not present its canvas, so show the last frame as an image.
    snap() {
      let img = $("snap");
      if (!img) {
        img = document.createElement("img");
        img.id = "snap";
        img.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
        $("stage").insertBefore(img, $("flash"));
      }
      img.src = canvas.toDataURL("image/jpeg", 0.85);
    },
  };
}
