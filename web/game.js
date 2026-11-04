// Mintless: a block island with no coins and no printer. Fish, barter with
// the 40 villagers, save in whatever the town takes most, and get out of it
// before the money moves. The town runs on the same engine the tests and the
// NEAR contract check.
import * as THREE from "three";
import { createTown } from "../engine/town.js";
import { SALT_TOWN } from "../rules/town.js";
import { mysteryRules } from "../engine/mystery.js";
import { answer, offer, shortestPath, wantsOf } from "../engine/visitor.js";
import { createHomestead, cast, fishYield, store, take, shopGood, buy, worthNow, nightFall, autoDay, castsPerDay, bagCount, CATALOG, BAG_MAX, HEARTS, TRADES_PER_DAY } from "../engine/homestead.js";
import { WIDTH, DEPTH, VILLAGES, HOME, MARKET, RELICS, buildWorld, makeTrader, makePlayer, makeRod, skyColor, nightness, makeClouds, makeStars, makeRain } from "./world3d.js";
import { iconCanvas, iconURL } from "./icons.js";

const GOOD_NAME = ["salt", "fish", "rice", "cloth", "wood"];
const GOOD_COLOR = ["#f4f7fb", "#2ec4b6", "#f2c94c", "#9b5de5", "#b5651d"];
const TOWNSFOLK = [
  "Asih", "Bayu", "Citra", "Dimas", "Eka", "Fajar", "Gita", "Hadi",
  "Intan", "Joko", "Kirana", "Lukas", "Maya", "Nanda", "Oki", "Putri",
  "Rahmat", "Sari", "Teguh", "Umi", "Vina", "Wawan", "Yanti", "Zaki",
  "Ayu", "Bimo", "Dewi", "Galih", "Hana", "Ilham", "Kartika", "Lestari",
  "Made", "Nyoman", "Ratna", "Surya", "Tari", "Wulan", "Yoga", "Agus",
];
const PLURAL = { saltmaker: "Saltmakers", fisher: "Fishers", farmer: "Farmers", weaver: "Weavers", logger: "Loggers" };
// Diamond Lock, lowest seller price in rupiah, 2015 to Jun 2026 (riset-track/growtopia-angka.md).
const DL_PRICES = [185000, 100000, 45000, 35000, 26000, 15800, 10000, 8000, 4000, 3700, 3300, 501, 299];
const SEASON = 30;
const SPEED = 6.5;
const JUMP = 8.6;
const GRAVITY = 24;
const REACH = 2.8;
const ZOOM_MIN = 12;
const ZOOM_MAX = 62;
const SKINS = ["hat", "cape", "crown", "sash"];

const $ = (id) => document.getElementById(id);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
let ICONS = [];
const pic = (g, cls = "") => `<img src="${ICONS[g]}" alt="${GOOD_NAME[g]}" class="${cls}">`;

// ------------------------------------------------------------ scene
const renderer = new THREE.WebGLRenderer({ canvas: $("world"), antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#58c8ff");
scene.fog = new THREE.Fog("#58c8ff", 70, 190);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 520);
const hemi = new THREE.HemisphereLight(0xdff2ff, 0x6b5a48, 1.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 220 });
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);

let WORLD = null;
let clouds = null, stars = null, rain = null;
let hero = null, rod = null, bobber = null, beacon = null;
const traderMeshes = [];
const marks = [];
const relicMeshes = [];
let markMats = [];
let keepMat = null;
const held = new Set();
const view = { mode: "roam", zoom: 26, yaw: 0, look: new THREE.Vector3(), free: { pos: new THREE.Vector3(), yaw: 0, pitch: -0.5 }, drag: null };
let S = null;

function resize() {
  const r = $("stage").getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
}

function loadOwned() {
  try {
    return JSON.parse(localStorage.getItem("mintless-skins")) || {};
  } catch {
    return {};
  }
}
function saveOwned() {
  try {
    const keep = Object.fromEntries(SKINS.filter((k) => S.me.owned[k]).map((k) => [k, true]));
    localStorage.setItem("mintless-skins", JSON.stringify(keep));
  } catch {
    // skins simply last this session
  }
}

function dressHero() {
  for (const k of ["hat", "cape", "crown", "sash", "boots"]) hero.wear[k].visible = !!S.me.owned[k];
}

// ------------------------------------------------------------ game state
function newGame(kind, seed) {
  const rules = kind === "mystery" ? mysteryRules(seed) : structuredClone(SALT_TOWN);
  const town = createTown(rules, seed);
  const me = createHomestead(rules, loadOwned());
  S = {
    kind, seed, rules, town, me,
    you: { x: HOME.x + 0.5, y: 7, z: HOME.z + 3.5, vy: 0, ground: false, dir: 0, walk: 0 },
    phase: 0, night: null, busy: false, panel: null, pick: null, near: null,
    days: [], worth: [], news: [], told: {}, ended: false, ver: 0, cacheVer: -1, bubbles: [], path: null, next: new Set(),
    banners: [], showing: false, nightLog: [], fish: null, relics: 0, place: "", lastWorth: 0,
  };
  S.traders = traderMeshes.map((m) => m.userData.spot);
  relicMeshes.forEach((m) => (m.visible = true));
  view.mode = "roam";
  $("end").classList.add("hidden");
  S.lastWorth = worthNow(town, me);
  morning();
  dressHero();
  renderHud();
}

const money = () => S.town.history[S.town.history.length - 1].money;
const rainEvent = () => S.rules.events[0] || null;
const rainGood = () => (S.town.eventGoods.length ? S.town.eventGoods[0] : -1);
const raining = () => {
  const ev = rainEvent();
  return !!ev && S.town.day >= ev.day && rainGood() >= 0;
};

function morning() {
  S.days.push({ money: money(), ate: null });
  S.worth.push(worthNow(S.town, S.me));
}

function refresh() {
  if (S.cacheVer === S.ver) return;
  S.cacheVer = S.ver;
  const path = shortestPath(S.town, S.me);
  S.path = path;
  S.next = new Set(path && path.length ? path[0].traders : []);
  S.bubbles = S.town.agents.map((ag) => {
    if (ag.holds === ag.needs) return { keep: true, wants: [], gives: ag.holds };
    const wants = wantsOf(S.town, ag).sort((a, b) => (a === ag.needs ? -1 : b === ag.needs ? 1 : a - b));
    return { keep: false, wants, gives: ag.holds };
  });
  marks.forEach((m, i) => {
    m.material = S.bubbles[i].keep ? keepMat : markMats[S.bubbles[i].gives];
  });
}

function goalTrader() {
  refresh();
  let best = null, bd = Infinity;
  for (const i of S.next) {
    const p = S.traders[i];
    const d = Math.hypot(p.x - S.you.x, p.z - S.you.z);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

function townNews() {
  const accept = S.town.history[S.town.history.length - 1].accept;
  const leader = accept.indexOf(Math.max(...accept));
  const lines = [];
  for (const r of S.rules.roles) {
    const members = S.town.agents.filter((ag) => ag.role === r.key);
    for (let g = 0; g < GOOD_NAME.length; g++) {
      if (g === r.needs || g === r.makes) continue;
      const share = members.filter((ag) => ag.holds === g || answer(S.town, ag, g).yes).length / members.length;
      const tag = `${r.key}:${g}`;
      if (!S.told[tag] && share >= 0.5 && g === leader && accept[g] >= 600) {
        S.told[tag] = true;
        lines.push({ g, text: `${PLURAL[r.key]} now take ${GOOD_NAME[g]}, though they never use it.` });
      } else if (S.told[tag] && share < 0.25) {
        S.told[tag] = false;
        lines.push({ g, text: `${PLURAL[r.key]} stopped taking ${GOOD_NAME[g]}.` });
      }
    }
  }
  for (const l of lines.slice(0, 3)) S.news.unshift({ day: S.town.day + 1, ...l });
  S.news = S.news.slice(0, 3);
  return lines.length > 0;
}

// ------------------------------------------------------------ movement
const modalOpen = () => S?.panel !== null || !$("intro").classList.contains("hidden") || !$("end").classList.contains("hidden");
const canAct = () => S && !S.busy && !S.ended && !modalOpen() && view.mode !== "first" && view.mode !== "free";

function bodyHits(x, y, z) {
  if (WORLD.blocked(x - 0.3, z - 0.3) || WORLD.blocked(x + 0.3, z + 0.3) || WORLD.blocked(x - 0.3, z + 0.3) || WORLD.blocked(x + 0.3, z - 0.3)) return true;
  for (const h of [0.1, 1, 1.8]) for (const [a, b] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) if (WORLD.solid(x + a, y + h, z + b)) return true;
  return false;
}

function moveAxis(you, nx, nz) {
  if (!bodyHits(nx, you.y, nz)) {
    you.x = nx;
    you.z = nz;
  } else if (you.ground && !bodyHits(nx, you.y + 1.05, nz)) {
    you.y += 1.05;
    you.x = nx;
    you.z = nz;
  }
}

function jump() {
  if (!canAct() || !S.you.ground) return;
  S.you.vy = JUMP;
  S.you.ground = false;
  sfx("jump");
}

function update(dt, now) {
  if (S.night) {
    const p = (now - S.night.t0) / S.night.dur;
    S.phase = Math.min(0.999, p);
    if (p >= 0.5 && !S.night.applied) applyNight();
    if (p >= 1) finishNight();
  }
  const you = S.you;
  let fx = 0, fz = 0;
  if (canAct()) {
    fx = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
    fz = (held.has("back") ? 1 : 0) - (held.has("up") ? 1 : 0);
  }
  const moving = fx !== 0 || fz !== 0;
  if (moving) {
    const yaw = view.mode === "third" ? view.yaw : 0;
    const len = Math.hypot(fx, fz);
    const dx = (fx * Math.cos(yaw) + fz * Math.sin(yaw)) / len;
    const dz = (-fx * Math.sin(yaw) + fz * Math.cos(yaw)) / len;
    const speed = SPEED * (S.me.owned.boots ? 1.5 : 1) * dt;
    moveAxis(you, you.x + dx * speed, you.z);
    moveAxis(you, you.x, you.z + dz * speed);
    you.dir = Math.atan2(dx, dz);
  }
  you.vy -= GRAVITY * dt;
  let ny = you.y + you.vy * dt;
  you.ground = false;
  const corners = [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]];
  if (you.vy <= 0 && corners.some(([a, b]) => WORLD.solid(you.x + a, ny, you.z + b))) {
    ny = Math.floor(ny) + 1;
    you.vy = 0;
    you.ground = true;
  } else if (you.vy > 0 && corners.some(([a, b]) => WORLD.solid(you.x + a, ny + 2, you.z + b))) you.vy = 0;
  you.y = ny;
  if (you.y < 0) Object.assign(you, { x: HOME.x + 0.5, y: 8, z: HOME.z + 3.5, vy: 0 });
  you.walk = moving && you.ground ? you.walk + dt * 11 : 0;

  // zones decide the camera, unless fishing or free
  const inTown = [...VILLAGES.map((v) => [v.x, v.z, 25]), [MARKET.x, MARKET.z, 16], [HOME.x + 14, HOME.z + 1, 13], [88.5, 148, 14]];
  const zone = inTown.some(([x, z, r]) => Math.hypot(you.x - x, you.z - z) < r + (view.mode === "third" ? 3 : 0));
  if (view.mode === "roam" && zone) {
    view.mode = "third";
    view.yaw = 0;
  } else if (view.mode === "third" && !zone) view.mode = "roam";

  const village = VILLAGES.find((v) => Math.hypot(you.x - v.x, you.z - v.z) < 22)?.name || (Math.hypot(you.x - MARKET.x, you.z - MARKET.z) < 15 ? "Market hall" : Math.hypot(you.x - HOME.x, you.z - HOME.z) < 12 ? "Your home" : "");
  if (village && village !== S.place) {
    const el = $("place");
    el.textContent = village;
    el.classList.remove("hidden");
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
  }
  S.place = village;

  for (let i = 0; i < relicMeshes.length; i++) {
    const m = relicMeshes[i];
    if (m.visible && Math.hypot(m.position.x - you.x, m.position.z - you.z) < 1.4 && Math.abs(m.position.y - you.y - 1) < 2) {
      m.visible = false;
      S.relics++;
      sfx("money");
      toast(`Gold shell ${S.relics} of ${RELICS.length}.`);
      if (S.relics === RELICS.length) {
        S.me.owned.sash = true;
        dressHero();
        saveOwned();
        toast("All gold shells found. The gold sash is yours for every season.");
      }
    }
  }
  if (S.fish) updateFishing(dt, now);
  if (view.mode === "free") updateFree(dt);
  findNear();
}

function updateFree(dt) {
  const f = view.free;
  const speed = 26 * dt;
  const x = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
  const z = (held.has("back") ? 1 : 0) - (held.has("up") ? 1 : 0);
  f.pos.x += (x * Math.cos(f.yaw) + z * Math.sin(f.yaw)) * speed;
  f.pos.z += (-x * Math.sin(f.yaw) + z * Math.cos(f.yaw)) * speed;
  f.pos.x = clamp(f.pos.x, -20, WIDTH + 20);
  f.pos.z = clamp(f.pos.z, -20, DEPTH + 20);
}

const RAIN_SKY = new THREE.Color("#4a5670");
const camGoal = new THREE.Vector3();
const lookGoal = new THREE.Vector3();
function placeCamera(dt) {
  const you = S.you;
  let rate = 5;
  if (view.mode === "roam") {
    camera.fov += (42 - camera.fov) * Math.min(1, dt * 5);
    camGoal.set(you.x, you.y + view.zoom * 0.84, you.z + view.zoom * 0.62);
    lookGoal.set(you.x, you.y + 1, you.z);
  } else if (view.mode === "third") {
    camera.fov += (55 - camera.fov) * Math.min(1, dt * 5);
    const dist = 7.5;
    camGoal.set(you.x + Math.sin(view.yaw) * dist, you.y + 3.6, you.z + Math.cos(view.yaw) * dist);
    // Walk from the head to the camera and stop before any block in between.
    const hx = you.x, hy = you.y + 2, hz = you.z;
    for (let k = 1; k <= 30; k++) {
      const f = k / 30;
      if (WORLD.solid(hx + (camGoal.x - hx) * f, hy + (camGoal.y - hy) * f, hz + (camGoal.z - hz) * f)) {
        camGoal.set(hx + (camGoal.x - hx) * Math.max(0.12, f - 0.08), hy + (camGoal.y - hy) * Math.max(0.12, f - 0.08), hz + (camGoal.z - hz) * Math.max(0.12, f - 0.08));
        break;
      }
    }
    lookGoal.set(you.x, you.y + 1.7, you.z);
  } else if (view.mode === "first") {
    camera.fov += (60 - camera.fov) * Math.min(1, dt * 6);
    const d = S.fish.dock;
    const fx = d.face === 1 ? 1 : 0, fz = d.face === 2 ? 1 : 0;
    camGoal.set(d.x, 8.5, d.z);
    lookGoal.set(d.x + fx * 12, 5.6, d.z + fz * 12);
    rate = 9;
  } else {
    const f = view.free;
    camGoal.copy(f.pos);
    lookGoal.set(f.pos.x + Math.sin(f.yaw + Math.PI) * Math.cos(f.pitch), f.pos.y + Math.sin(f.pitch), f.pos.z + Math.cos(f.yaw + Math.PI) * Math.cos(f.pitch));
    rate = 14;
  }
  const k = 1 - Math.exp(-dt * rate);
  camera.position.lerp(camGoal, k);
  view.look.lerp(lookGoal, k);
  camera.lookAt(view.look);
  camera.updateProjectionMatrix();
}

function render(t, dt) {
  refresh();
  const you = S.you;
  hero.root.position.set(you.x, you.y, you.z);
  hero.root.rotation.y = you.dir;
  hero.root.visible = view.mode !== "first";
  const swing = Math.sin(you.walk) * 0.8;
  hero.legL.rotation.x = swing;
  hero.legR.rotation.x = -swing;
  hero.armL.rotation.x = -swing;
  hero.armR.rotation.x = swing;

  for (let i = 0; i < traderMeshes.length; i++) {
    const m = traderMeshes[i];
    const p = S.traders[i];
    const d = Math.hypot(p.x - you.x, p.z - you.z);
    m.position.y = p.y + (Math.sin(t * 1.6 + i) > 0.96 ? 0.08 : 0);
    if (d < 12) m.rotation.y = Math.atan2(you.x - p.x, you.z - p.z);
    const mk = marks[i];
    mk.visible = !S.busy && d < 11 && view.mode !== "first";
    if (mk.visible) mk.position.y = p.y + 3.1 + Math.sin(t * 3 + i) * 0.06;
  }

  const goal = S.town.day < 3 && !S.busy && S.me.bag[S.me.needs] === 0 && view.mode !== "first" ? goalTrader() : null;
  beacon.visible = goal !== null;
  if (goal !== null) beacon.position.set(S.traders[goal].x, 24, S.traders[goal].z);
  for (const r of relicMeshes) r.rotation.y = t * 1.5;

  skyColor(S.phase, scene.background);
  const wet = raining();
  if (wet) scene.background.lerp(RAIN_SKY, 0.6);
  scene.fog.color.copy(scene.background);
  const dark = nightness(S.phase);
  const a = S.phase * Math.PI * 2;
  sun.position.set(you.x + 40 * Math.cos(a) + 24, you.y + 80 * Math.abs(Math.cos(a)) + 12, you.z + 34);
  sun.target.position.set(you.x, you.y, you.z);
  sun.intensity = (1 - dark) * (wet ? 1.1 : 2.4) + 0.05;
  hemi.intensity = (wet ? 1 : 1.5) * (1 - dark * 0.75);
  stars.material.opacity = dark;
  clouds.position.x = ((t * 0.8) % 120) - 60;
  clouds.visible = true;
  for (const g of WORLD.glowMats) g.emissiveIntensity = 0.15 + dark * 1.4;
  for (const l of WORLD.lampGlow) l.material.opacity = dark * 0.75;
  WORLD.waterTex.offset.x = (t * 0.02) % 1;
  WORLD.waterTex.offset.y = (t * 0.012) % 1;

  rain.visible = wet;
  if (wet) {
    rain.position.set(camera.position.x, 0, camera.position.z);
    const pos = rain.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - dt * 34;
      if (y < 0) y += 30;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }
  placeCamera(dt);
  renderer.render(scene, camera);
  renderPrompt();
}

let last = performance.now();
let slowFrames = 0, frames = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  frames++;
  if (now - last > 45 && frames > 30) slowFrames++;
  if (slowFrames > 40 && renderer.shadowMap.enabled) {
    renderer.shadowMap.enabled = false;
    sun.castShadow = false;
    renderer.setPixelRatio(1);
    resize();
    scene.traverse((o) => o.material && (Array.isArray(o.material) ? o.material.forEach((m) => (m.needsUpdate = true)) : (o.material.needsUpdate = true)));
  }
  last = now;
  if (S) {
    update(dt, now);
    render(now / 1000, dt);
  }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------ input
const KEYMAP = { ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right", ArrowUp: "up", w: "up", ArrowDown: "back", s: "back" };
document.addEventListener("keydown", (e) => {
  if (!S) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (S.panel) {
    if (k === "Escape") closePanel();
    else if (S.panel === "trade" && (k === "e" || k === "Enter")) deal();
    else if (S.panel === "trade" && /^[1-5]$/.test(k)) pickNth(Number(k) - 1);
    return;
  }
  if (S.fish) {
    if (k === " " || k === "e" || k === "Enter") fishAction();
    else if (k === "Escape" || k === "q") stopFishing();
    e.preventDefault();
    return;
  }
  if (k === "Escape") {
    if (view.mode === "free") toggleFree();
    else if (!$("intro").classList.contains("hidden") && !$("back").classList.contains("hidden")) hideIntro();
    return;
  }
  if (!$("intro").classList.contains("hidden") || !$("end").classList.contains("hidden")) return;
  if (KEYMAP[k]) {
    held.add(KEYMAP[k]);
    e.preventDefault();
  } else if (k === " ") {
    jump();
    e.preventDefault();
  } else if (k === "e" || k === "Enter") interact();
  else if (k === "c") toggleFree();
  else if (k === "m") openPanel("map");
  else if (k === "n") toggleSound();
});
document.addEventListener("keyup", (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (KEYMAP[k]) held.delete(KEYMAP[k]);
});
addEventListener("blur", () => held.clear());

// Ctrl + scroll, and a touchpad pinch which browsers report the same way.
addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey) e.preventDefault();
    if (!S || modalOpen()) return;
    if (view.mode === "free") {
      view.free.pos.y = clamp(view.free.pos.y + e.deltaY * 0.03, 8, 110);
      return;
    }
    if (e.ctrlKey && view.mode === "roam") view.zoom = clamp(view.zoom * (1 + e.deltaY * 0.0022), ZOOM_MIN, ZOOM_MAX);
  },
  { passive: false },
);

const canvas = $("world");
canvas.addEventListener("pointerdown", (e) => {
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

function toggleFree() {
  if (!S || S.fish || modalOpen()) return;
  if (view.mode === "free") {
    view.mode = "roam";
    $("freebar").classList.add("hidden");
  } else {
    view.mode = "free";
    view.free.pos.set(S.you.x, S.you.y + 22, S.you.z + 18);
    view.free.yaw = 0;
    view.free.pitch = -0.75;
    $("freebar").classList.remove("hidden");
  }
  $("prompt").classList.add("hidden");
}

function findNear() {
  const you = S.you;
  let best = null, bd = REACH;
  if (canAct()) {
    S.traders.forEach((p, i) => {
      const d = Math.hypot(p.x - you.x, p.z - you.z);
      if (d < bd) {
        bd = d;
        best = { kind: "trader", i };
      }
    });
    for (const o of WORLD.objects) {
      const d = Math.hypot(o.x - you.x, o.z - you.z);
      if (d < bd) {
        bd = d;
        best = { kind: o.type, o };
      }
    }
  }
  S.near = best;
}

const worldPos = new THREE.Vector3();
function renderPrompt() {
  const el = $("prompt");
  const n = S.near;
  if (!n) return el.classList.add("hidden");
  let html;
  if (n.kind === "trader") {
    const p = S.traders[n.i];
    worldPos.set(p.x, p.y + 2.9, p.z);
    const b = S.bubbles[n.i];
    const ag = S.town.agents[n.i];
    html = b.keep ? `${TOWNSFOLK[n.i]} is keeping ${GOOD_NAME[ag.needs]} for tonight` : `<kbd>E</kbd> ${b.wants.slice(0, 3).map((g) => pic(g, "ic")).join("")} <span class="arrow">→</span> ${pic(b.gives, "ic")}`;
  } else {
    worldPos.set(n.o.x, S.you.y + 2.6, n.o.z);
    html = `<kbd>E</kbd> ${n.o.label}`;
  }
  worldPos.project(camera);
  const r = $("stage").getBoundingClientRect();
  el.innerHTML = html;
  el.style.left = `${((worldPos.x + 1) / 2) * r.width}px`;
  el.style.top = `${((1 - worldPos.y) / 2) * r.height}px`;
  el.classList.remove("hidden");
}

function interact() {
  if (!canAct()) return;
  const n = S.near;
  if (!n) return toast("Nothing to use here. Walk up to a villager, your chest, your bed, or a dock.");
  if (n.kind === "trader") openTrade(n.i);
  else if (n.kind === "chest") openPanel("chest");
  else if (n.kind === "shop") openPanel("shop");
  else if (n.kind === "bed") sleep(1);
  else if (n.kind === "dock") startFishing(n.o);
}

// ------------------------------------------------------------ panels
function openPanel(name) {
  closePanel();
  S.panel = name;
  held.clear();
  $(name).classList.remove("hidden");
  if (name === "chest") renderChest();
  if (name === "shop") renderShop();
  if (name === "map") renderMap();
  sfx("open");
}

function closePanel() {
  if (!S || !S.panel) return;
  $(S.panel).classList.add("hidden");
  S.panel = null;
  S.pick = null;
  renderHud();
}
for (const b of document.querySelectorAll("[data-close]")) b.addEventListener("click", closePanel);

function openTrade(i) {
  refresh();
  S.tradeWith = i;
  openPanel("trade");
  const ag = S.town.agents[i];
  $("t-name").textContent = TOWNSFOLK[i];
  $("t-role").textContent = cap(ag.role);
  S.pick = S.bubbles[i].wants.find((g) => S.me.bag[g] > 0) ?? null;
  renderTrade();
}

function renderTrade() {
  const i = S.tradeWith;
  const ag = S.town.agents[i];
  const b = S.bubbles[i];
  $("t-give").innerHTML = b.wants.length
    ? b.wants.map((g, k) => `<button class="slot big ${S.me.bag[g] ? "" : "empty"} ${g === S.pick ? "sel" : ""}" data-g="${g}" title="${k + 1}: ${cap(GOOD_NAME[g])}">${pic(g)}<span class="n">${S.me.bag[g]}</span></button>`).join("")
    : '<p class="dim">Not trading today</p>';
  $("t-get").innerHTML = b.keep ? '<p class="dim">Keeping it</p>' : `<div class="slot big get">${pic(ag.holds)}<span class="n">1</span></div>`;
  const btn = $("t-swap");
  const ready = !b.keep && S.pick !== null && S.me.bag[S.pick] > 0 && S.me.swaps > 0;
  btn.textContent = ready ? `Deal: 1 ${GOOD_NAME[S.pick]} for 1 ${GOOD_NAME[ag.holds]}` : S.me.swaps <= 0 ? "No trades left today" : "You have nothing they take";
  ready ? btn.removeAttribute("aria-disabled") : btn.setAttribute("aria-disabled", "true");
  const moneyNote = S.pick !== null && !b.keep && answer(S.town, ag, S.pick).kind === "money";
  $("t-note").textContent = moneyNote ? `${cap(ag.role)}s never use ${GOOD_NAME[S.pick]}. They take it because everyone else does. That is money.` : "";
  $("t-foot").textContent = `Trades left today: ${S.me.swaps} of ${TRADES_PER_DAY}`;
}

function pickNth(k) {
  const g = S.bubbles[S.tradeWith].wants[k];
  if (g === undefined) return;
  S.pick = g;
  renderTrade();
}

$("t-give").addEventListener("click", (e) => {
  const slot = e.target.closest(".slot");
  if (slot) pickNth(S.bubbles[S.tradeWith].wants.indexOf(Number(slot.dataset.g)));
});

function deal() {
  if (S.panel !== "trade" || S.pick === null) return;
  const gave = S.pick;
  const res = offer(S.town, S.me, S.tradeWith, gave);
  if (!res.ok) return sfx("deny");
  sfx("deal");
  S.ver++;
  toast(`+1 ${GOOD_NAME[res.got]}, gave 1 ${GOOD_NAME[gave]}`);
  closePanel();
}
$("t-swap").addEventListener("click", deal);

function renderChest() {
  const { me, town } = S;
  $("chest-rows").innerHTML = GOOD_NAME.map((name, g) => {
    const rate = me.owned.icebox ? town.spoil[g] >> 1 : town.spoil[g];
    return `<div class="c-row"><span class="c-good">${pic(g, "ic")} ${cap(name)}</span><span class="c-n">${me.bag[g]}</span><button class="pbtn" data-store="${g}" ${me.bag[g] ? "" : 'aria-disabled="true"'}>Store →</button><button class="pbtn" data-take="${g}" ${me.chest[g] ? "" : 'aria-disabled="true"'}>← Take</button><span class="c-n">${me.chest[g]}</span><span class="dim c-rot">${rate}% a night</span></div>`;
  }).join("");
  $("chest-foot").textContent = `Bag ${bagCount(me)} of ${BAG_MAX}. Stored goods still spoil at the public rate${me.owned.icebox ? ", halved by your ice box" : ""}.`;
}
$("chest-rows").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.store) store(S.me, Number(b.dataset.store), 99);
  if (b.dataset.take) take(S.me, Number(b.dataset.take), 99);
  S.ver++;
  sfx("open");
  renderChest();
});

function renderShop() {
  const { me, town } = S;
  const g = shopGood(town);
  const have = me.bag[g] + me.chest[g];
  $("shop-take").innerHTML = `Today the market takes ${pic(g, "ic")} <b>${GOOD_NAME[g]}</b>. You have ${have}.`;
  $("shop-items").innerHTML = CATALOG.map((c) => {
    const owned = me.owned[c.key];
    return `<div class="s-item ${owned ? "owned" : ""}"><div><b>${c.name}</b><span class="dim">${c.what}</span></div><button class="pbtn ${have >= c.cost && !owned ? "primary" : ""}" data-buy="${c.key}" ${owned || have < c.cost ? 'aria-disabled="true"' : ""}>${owned ? "Owned" : `${c.cost} ${pic(g, "ic")}`}</button></div>`;
  }).join("");
}
$("shop-items").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.hasAttribute("aria-disabled")) return;
  const res = buy(S.town, S.me, b.dataset.buy);
  if (!res.ok) return sfx("deny");
  sfx("money");
  S.ver++;
  dressHero();
  saveOwned();
  renderShop();
});

const PLACES = () => [
  { name: "Your home", x: HOME.x + 0.5, z: HOME.z + 3.5 },
  { name: "Market hall", x: MARKET.x + 0.5, z: MARKET.z },
  ...VILLAGES.map((v) => ({ name: v.name, x: v.x + 0.5, z: v.role === "fisher" ? 130 : v.z + 0.5 })),
  { name: "Harbor pier", x: 88.5, z: 147 },
];
function renderMap() {
  $("map-dots").innerHTML =
    PLACES().map((p, i) => `<button class="m-dot" data-i="${i}" style="left:${(p.x / WIDTH) * 100}%;top:${(p.z / DEPTH) * 100}%"><i></i>${p.name}</button>`).join("") +
    `<span class="m-you" style="left:${(S.you.x / WIDTH) * 100}%;top:${(S.you.z / DEPTH) * 100}%">You</span>`;
}
$("map-dots").addEventListener("click", (e) => {
  const b = e.target.closest(".m-dot");
  if (!b) return;
  const p = PLACES()[Number(b.dataset.i)];
  Object.assign(S.you, { x: p.x, z: p.z, y: WORLD.groundAt(p.x, p.z) + 2, vy: 0 });
  camera.position.set(p.x, 30, p.z + 18);
  closePanel();
});
$("map-btn").addEventListener("click", () => S && !S.fish && !S.busy && !S.ended && openPanel("map"));

// ------------------------------------------------------------ fishing
function startFishing(dock) {
  if (S.me.casts <= 0) return toast("No casts left today. Sleep, and the fish come back.");
  S.fish = { dock, stage: "ready", t: 0, score: 0, wait: 0 };
  view.mode = "first";
  held.clear();
  $("fishing").classList.remove("hidden");
  rod.group.visible = true;
  bobber.visible = false;
  renderFish();
}

function stopFishing() {
  S.fish = null;
  view.mode = "third";
  rod.group.visible = false;
  bobber.visible = false;
  $("fishing").classList.add("hidden");
  renderHud();
}

function fishAction() {
  const f = S.fish;
  if (f.stage === "ready") {
    if (S.me.casts <= 0) return stopFishing();
    f.stage = "wait";
    f.t = 0;
    f.wait = 1 + Math.random() * 1.8;
    bobber.visible = true;
    const d = f.dock;
    bobber.position.set(d.x + (d.face === 1 ? 8 : 0), 5.7, d.z + (d.face === 2 ? 8 : 0));
    sfx("jump");
    renderFish();
  } else if (f.stage === "bite") hook();
  else if (f.stage === "wait") toast("Wait for the float to dip.");
}

function hook() {
  const f = S.fish;
  f.score = Math.round(100 - Math.abs(f.pos - 50) * 2);
  const res = cast(S.me, f.score);
  S.ver++;
  f.stage = "done";
  f.t = 0;
  f.got = res.got;
  bobber.visible = false;
  sfx(res.got ? "deal" : "deny");
  renderFish();
}

function updateFishing(dt) {
  const f = S.fish;
  f.t += dt;
  if (f.stage === "wait") {
    bobber.position.y = 5.7 + Math.sin(f.t * 4) * 0.05;
    if (f.t > f.wait) {
      f.stage = "bite";
      f.t = 0;
      sfx("bite");
      renderFish();
    }
  } else if (f.stage === "bite") {
    bobber.position.y = 5.35 + Math.sin(f.t * 20) * 0.12;
    f.pos = 50 - Math.cos(f.t * 3.4) * 50;
    $("fish-mark").style.left = `${f.pos}%`;
    if (f.t > 3) {
      f.pos = 0;
      hook();
    }
  } else if (f.stage === "done" && f.t > 1.1) {
    if (S.me.casts <= 0) return stopFishing();
    f.stage = "ready";
    renderFish();
  }
}

function renderFish() {
  const f = S.fish;
  $("fish-gauge").classList.toggle("hidden", f.stage !== "bite");
  $("fish-casts").textContent = `Casts left today: ${S.me.casts} of ${castsPerDay(S.me)}. Fish in bag: ${S.me.bag[S.me.makes]}`;
  $("fish-say").textContent = {
    ready: "Press Space to cast",
    wait: "Watch the float...",
    bite: "Bite! Press Space in the gold zone",
    done: f.got ? `${f.score >= 90 ? "Perfect" : f.score >= 60 ? "Good" : "Close"} catch: +${f.got} fish` : "It got away",
  }[f.stage];
}

// ------------------------------------------------------------ nights
function sleep(days) {
  if (!S || S.busy || S.ended || modalOpen() || S.fish) return;
  S.busy = true;
  S.queue = days;
  S.fast = days > 1;
  S.nightLog = [];
  startNight();
  renderHud();
  sfx("night");
}

function startNight() {
  S.night = { t0: performance.now(), dur: S.fast ? 900 : 2600, applied: false };
}

function applyNight() {
  S.night.applied = true;
  const before = money();
  if (S.fast) autoDay(S.town, S.me, 60);
  const r = nightFall(S.town, S.me);
  S.days[S.days.length - 1].ate = r.ate;
  S.ver++;
  S.nightLog.push(r);
  if (r.newMoney !== null) S.banners.push(moneyBanner(r.newMoney, before, r.report));
  const ev = rainEvent();
  if (ev && S.town.day === ev.day && rainGood() >= 0) {
    S.banners.push({ kind: "rain", g: rainGood(), title: "The rainy season came", text: `It stays wet until the season ends. ${cap(GOOD_NAME[rainGood()])} now loses ${ev.spoil}% every night, in your bag and your chest.` });
  }
  if (ev && ev.good === -1 && S.town.day === ev.decideDay) {
    S.banners.push({ kind: "rain", g: rainGood(), title: "Rain forecast", text: `The rain on day ${ev.day + 1} will soak ${GOOD_NAME[rainGood()]}, the good the town holds most today.` });
  }
  if (townNews()) sfx("news");
  if (S.town.day < SEASON) morning();
  const g = shopGood(S.town);
  if (S.shopWas !== undefined && S.shopWas !== g) S.banners.push({ kind: "money", g, title: `The market now takes ${GOOD_NAME[g]}`, text: `It stopped taking ${GOOD_NAME[S.shopWas]}. Whatever you saved in ${GOOD_NAME[S.shopWas]} just lost its best buyer.` });
  S.shopWas = g;
}

function finishNight() {
  S.night = null;
  S.phase = 0;
  const done = S.town.day >= SEASON || S.me.hearts <= 0;
  if (done) {
    S.busy = false;
    S.worth.push(worthNow(S.town, S.me));
    renderHud();
    return finish();
  }
  if (--S.queue > 0) return startNight();
  S.busy = false;
  report(S.nightLog);
  showBanners();
  renderHud();
}

function report(log) {
  const lost = GOOD_NAME.map((_, g) => log.reduce((sum, r) => sum + r.lost[g] + r.lostChest[g], 0));
  const parts = [];
  const ate = log.filter((r) => r.ate).length;
  parts.push(log.length > 1 ? `Your family ate on ${ate} of ${log.length} nights.` : ate ? "Your family ate. +1 heart." : "Nothing to eat. -1 heart.");
  const rot = lost.map((u, g) => (u ? `${u} ${GOOD_NAME[g]}` : "")).filter(Boolean).join(", ");
  if (rot) parts.push(`Spoiled overnight: ${rot}.`);
  const now = worthNow(S.town, S.me);
  const pct = S.lastWorth ? Math.round(((now - S.lastWorth) / S.lastWorth) * 100) : 0;
  if (pct <= -5) parts.push(`Your savings fell ${-pct}%.`);
  $("last").textContent = parts.join(" ");
  $("last").classList.toggle("bad", pct <= -10);
  if (pct <= -10) {
    $("worth-chip").classList.remove("flash");
    void $("worth-chip").offsetWidth;
    $("worth-chip").classList.add("flash");
    sfx("deny");
  }
  S.lastWorth = now;
}

function moneyBanner(g, before, rep) {
  if (g < 0) return { kind: "money", g: before, title: `${cap(GOOD_NAME[before])} stopped being money`, text: "The town is bartering again. Read the town news: what are they starting to take?" };
  const tenths = Math.round(rep.accept[g] / 100);
  const share = tenths >= 10 ? "All" : `${tenths} in 10`;
  return { kind: "money", g, title: `${cap(GOOD_NAME[g])} is money now`, text: `${before >= 0 ? `It replaced ${GOOD_NAME[before]}. ` : ""}Nobody decided it. ${share} villagers who never use ${GOOD_NAME[g]} take it anyway.` };
}

function showBanners() {
  if (S.showing || !S.banners.length) return;
  const b = S.banners.shift();
  const el = $("banner");
  el.className = `banner ${b.kind === "rain" ? "rain" : ""}`;
  el.innerHTML = `<h2>${b.g >= 0 ? pic(b.g) : ""}${b.title}</h2><p>${b.text}</p>`;
  S.showing = true;
  sfx(b.kind === "rain" ? "rain" : "money");
  setTimeout(() => {
    el.classList.add("hidden");
    if (S) S.showing = false;
    if (S) showBanners();
  }, 4800);
}

let toastTimer = null;
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3800);
}

// ------------------------------------------------------------ sound
let audio = null;
let soundOn = true;
const TUNES = {
  deal: [[660, 0, 0.07], [990, 0.07, 0.12]],
  deny: [[160, 0, 0.14]],
  open: [[520, 0, 0.04]],
  jump: [[420, 0, 0.05], [560, 0.04, 0.04]],
  bite: [[880, 0, 0.06], [880, 0.1, 0.06]],
  news: [[740, 0, 0.06], [988, 0.08, 0.1]],
  night: [[392, 0, 0.18], [330, 0.18, 0.3]],
  money: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1046, 0.3, 0.22]],
  rain: [[220, 0, 0.25], [196, 0.22, 0.35]],
};
function sfx(kind) {
  if (!soundOn) return;
  try {
    audio = audio || new AudioContext();
  } catch {
    return;
  }
  const t0 = audio.currentTime;
  for (const [f, at, len] of TUNES[kind]) {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = "square";
    o.frequency.value = f;
    g.gain.setValueAtTime(0.05, t0 + at);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + at + len);
    o.connect(g).connect(audio.destination);
    o.start(t0 + at);
    o.stop(t0 + at + len + 0.02);
  }
}
function toggleSound() {
  soundOn = !soundOn;
  $("sound").textContent = soundOn ? "♪" : "×";
  $("sound").setAttribute("aria-label", soundOn ? "Sound on" : "Sound off");
}
$("sound").addEventListener("click", toggleSound);

// ------------------------------------------------------------ HUD
function renderHud() {
  const { town, me } = S;
  refresh();
  $("day").textContent = Math.min(SEASON, town.day + 1);
  const m = money();
  $("money").innerHTML = m >= 0 ? `${pic(m, "ic")} ${cap(GOOD_NAME[m])}` : town.history.some((h) => h.money >= 0) ? "barter again" : "none yet";
  $("money-chip").classList.toggle("has", m >= 0);
  const ev = rainEvent();
  const rc = $("rain-chip");
  if (!ev) rc.innerHTML = "";
  else {
    const g = rainGood();
    const what = g >= 0 ? `${pic(g, "ic")} ${GOOD_NAME[g]}` : "?";
    rc.innerHTML = town.day >= ev.day && g >= 0 ? `Rainy season: ${what} rots ${ev.spoil}%` : `Rains on day ${ev.day + 1}: soaks ${what}`;
  }
  $("worth").textContent = worthNow(town, me).toLocaleString("en-US");
  for (const id of ["sleep", "skip"]) S.busy || S.ended ? $(id).setAttribute("aria-disabled", "true") : $(id).removeAttribute("aria-disabled");
  $("bag").innerHTML = me.bag
    .map((u, g) => `<div class="slot ${u ? "" : "empty"} ${g === me.needs ? "need" : ""} ${g === m ? "money" : ""}" title="${cap(GOOD_NAME[g])}: ${u} in bag, ${me.chest[g]} in chest. Loses ${town.spoil[g]}% a night.">${pic(g)}<span class="n">${u}</span>${town.spoil[g] ? `<span class="rot">${town.spoil[g]}%</span>` : ""}</div>`)
    .join("");
  $("swaps").innerHTML = `Trades ${me.swaps}/${TRADES_PER_DAY} · Casts ${me.casts}/${castsPerDay(me)}`;
  renderQuest();
  $("news").innerHTML = S.news.map((n) => `<li><span class="dim">Day ${n.day}</span> ${pic(n.g, "ic")} ${n.text}</li>`).join("");
}

function renderQuest() {
  const { me, town } = S;
  const need = GOOD_NAME[me.needs];
  const have = me.bag[me.needs] + me.chest[me.needs] > 0;
  const hearts = `<span class="hearts" aria-label="${me.hearts} of ${HEARTS} hearts">${"♥".repeat(Math.max(0, me.hearts))}<span class="lost">${"♥".repeat(HEARTS - Math.max(0, me.hearts))}</span></span>`;
  let body = "";
  if (town.day < 3) {
    const path = S.path;
    if (have) body = `<p class="ok">You have ${need} for tonight. Go home and sleep, or fish and trade more.</p>`;
    else if (me.bag[me.makes] === 0 && me.casts > 0) body = "<p>Catch fish first: go to your dock, press E, then Space.</p>";
    else if (path && path.length) {
      const role = town.agents[S.next.values().next().value].role;
      body = `<p class="step">Next: give ${pic(path[0].give, "ic")} to a <b>${role}</b>, get ${pic(path[0].get, "ic")}. Follow the gold beam.</p>`;
    } else body = "<p>Nobody will trade toward it today. Sleep and try tomorrow.</p>";
  } else {
    const g = shopGood(town);
    body = `<p>${have ? `<span class="ok">Tonight is covered.</span> ` : ""}The market takes ${pic(g, "ic")} ${GOOD_NAME[g]} today. What are you saving in?</p>`;
  }
  $("quest").innerHTML = `<h3>${pic(me.needs, "ic")} Tonight: 1 ${need} ${hearts}</h3>${body}`;
}

// ------------------------------------------------------------ screens
function introHtml() {
  return [
    [1, "Catch fish at your dock. Timing decides the catch: first person, rod in hand."],
    [0, "Your family eats 1 salt a night or loses a heart. Swap fish with villagers in the 5 villages. No coins here, only goods."],
    [3, "Save what the town takes most, and spend it at the market on a boat, boots, an ice box or skins."],
    [2, "When the rains come the town's money can change. Savings left behind melt. Read the town news and move first."],
  ]
    .map(([g, text], k) => `<li><b class="k">${k + 1}</b>${pic(g)}<span>${text}</span></li>`)
    .join("");
}

function showIntro(help) {
  $("how").innerHTML = introHtml();
  $("back").classList.toggle("hidden", !help);
  $("intro").classList.remove("hidden");
}
function hideIntro() {
  $("intro").classList.add("hidden");
}

function start(kind) {
  const fromUrl = Number(new URLSearchParams(location.search).get("seed"));
  const seed = kind === "salt" ? fromUrl || 1 : crypto.getRandomValues(new Uint32Array(1))[0] % 100000;
  newGame(kind, seed);
  hideIntro();
  $("last").textContent = "";
  if (kind === "mystery") toast(`Mystery town #${seed}. The spoil rates changed. Nobody knows what becomes money here.`);
  else toast("Go to your dock by the river, press E, and catch your first fish.");
}

function drawChart() {
  const w = S.worth;
  const max = Math.max(...w, 1);
  const W = 600, H = 150;
  const x = (i) => (i / Math.max(1, w.length - 1)) * W;
  const y = (v) => H - (v / max) * (H - 10) - 4;
  const bands = S.days.map((d, i) => `<rect x="${x(i)}" y="${H}" width="${W / Math.max(1, w.length - 1) + 1}" height="10" fill="${d.money >= 0 ? GOOD_COLOR[d.money] : "#44506e"}"/>`).join("");
  const line = w.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const dlMax = DL_PRICES[0];
  const dl = DL_PRICES.map((p, i) => `${((i / (DL_PRICES.length - 1)) * W).toFixed(1)},${(H - (p / dlMax) * (H - 10) - 4).toFixed(1)}`).join(" ");
  $("end-chart").innerHTML = `<polyline points="${dl}" fill="none" stroke="#ff6b6b" stroke-width="2" stroke-dasharray="6 5"/><polyline points="${line}" fill="none" stroke="#00bfff" stroke-width="4"/>${bands}`;
  let peak = 0, drop = 0;
  for (const v of w) {
    peak = Math.max(peak, v);
    if (peak) drop = Math.max(drop, (peak - v) / peak);
  }
  return Math.round(drop * 100);
}

function finish() {
  S.ended = true;
  if (view.mode === "free") toggleFree();
  const { me, town } = S;
  $("end-title").textContent = me.hearts <= 0 ? `Your family left the island on day ${town.day}` : `Your family ate on ${me.fed} of ${SEASON} nights`;
  const drop = drawChart();
  const worst = drop >= 30 ? `Your savings once fell ${drop}% from their peak. That is the feeling Diamond Lock holders know: they fell 99.7%.` : `Your savings never fell more than ${drop}% from their peak. You read the town well. Diamond Lock holders fell 99.7%.`;
  $("end-save").textContent = worst;
  const story = [];
  let prev = -1;
  town.history.forEach((h, d) => {
    if (h.money !== prev) {
      if (h.money >= 0) story.push(`Day ${d + 1}: ${GOOD_NAME[h.money]} became money${prev >= 0 ? `, replacing ${GOOD_NAME[prev]}` : ""}.`);
      else story.push(`Day ${d + 1}: ${GOOD_NAME[prev]} stopped being money.`);
      prev = h.money;
    }
  });
  if (!story.length) story.push("The town never settled on a money while you were here.");
  $("end-story").textContent = `${story.join(" ")} Nobody decided any of it.`;
  const skins = SKINS.filter((k) => me.owned[k]).length;
  $("end-keep").textContent = skins ? `You keep ${skins} skin${skins > 1 ? "s" : ""} for the next season.` : "Buy a skin next season and it stays yours.";
  $("end").classList.remove("hidden");
}

$("sleep").addEventListener("click", () => {
  if (S.busy || S.ended) return;
  if (Math.hypot(S.you.x - HOME.x, S.you.z - HOME.z) < 9) sleep(1);
  else toast("Your bed is at home. Press M for the map.");
});
$("skip").addEventListener("click", () => sleep(7));
$("help").addEventListener("click", () => showIntro(true));
$("back").addEventListener("click", hideIntro);
$("play-salt").addEventListener("click", () => start("salt"));
$("play-mystery").addEventListener("click", () => start("mystery"));
$("again").addEventListener("click", () => start("mystery"));
$("replay").addEventListener("click", () => newGame(S.kind, S.seed));
$("free-exit").addEventListener("click", toggleFree);
addEventListener("resize", resize);

// ------------------------------------------------------------ boot
function bubbleTexture(good) {
  const cv = document.createElement("canvas");
  cv.width = 64;
  cv.height = 72;
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#0b0e18";
  ctx.fillRect(2, 2, 60, 56);
  ctx.fillRect(26, 58, 12, 6);
  ctx.fillRect(30, 64, 4, 4);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(6, 6, 52, 48);
  if (good >= 0) ctx.drawImage(iconCanvas(good, 4), 12, 10);
  else {
    ctx.fillStyle = "#8b97ab";
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.fillText("zz", 32, 40);
  }
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function boot() {
  ICONS = GOOD_NAME.map((_, g) => iconURL(g, 4));
  const dlMax = Math.max(...DL_PRICES);
  $("dl").innerHTML = DL_PRICES.map((rp) => `<span class="${rp < 1000 ? "low" : ""}" style="height:${Math.max(3, (rp / dlMax) * 100)}%"></span>`).join("");
  showIntro(false);
  resize();
  WORLD = buildWorld(scene);
  clouds = makeClouds(scene);
  stars = makeStars(scene);
  rain = makeRain(scene);
  hero = makePlayer();
  scene.add(hero.root);
  rod = makeRod();
  rod.group.visible = false;
  camera.add(rod.group);
  scene.add(camera);
  bobber = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 0.26), new THREE.MeshBasicMaterial({ color: 0xff5040 }));
  bobber.visible = false;
  scene.add(bobber);
  beacon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 40, 0.5), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.55 }));
  beacon.visible = false;
  scene.add(beacon);

  markMats = GOOD_NAME.map((_, g) => new THREE.SpriteMaterial({ map: bubbleTexture(g), depthTest: false }));
  keepMat = new THREE.SpriteMaterial({ map: bubbleTexture(-1), depthTest: false });
  const seen = {};
  SALT_TOWN.roles.forEach((r) => {
    for (let k = 0; k < r.count; k++) {
      const n = (seen[r.key] = (seen[r.key] ?? -1) + 1);
      const spot = WORLD.spots[r.key][n];
      spot.y = WORLD.groundAt(spot.x, spot.z) + 1;
      const m = makeTrader(r.key, traderMeshes.length * 7);
      m.position.set(spot.x, spot.y, spot.z);
      m.userData.spot = spot;
      scene.add(m);
      traderMeshes.push(m);
      const mark = new THREE.Sprite(markMats[r.makes]);
      mark.position.set(spot.x, spot.y + 3.1, spot.z);
      mark.scale.set(1, 1.12, 1);
      mark.visible = false;
      scene.add(mark);
      marks.push(mark);
    }
  });
  const keeper = makeTrader("keeper", 1);
  const ky = WORLD.groundAt(MARKET.x, MARKET.z) + 2;
  keeper.position.set(MARKET.x + 0.5, ky, MARKET.z - 6.5);
  scene.add(keeper);
  for (const r of WORLD.relicSpots) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    m.position.set(r.x, r.y, r.z);
    scene.add(m);
    relicMeshes.push(m);
  }
  newGame("salt", 1);
  view.look.set(S.you.x, S.you.y, S.you.z);
  camera.position.set(S.you.x, 40, S.you.z + 30);
  $("loading").classList.add("hidden");
  requestAnimationFrame(frame);
}
boot();

// ?debug exposes the live state for automated play-throughs; run(ms)
// advances the clock by hand, for when the page is in a background tab.
if (new URLSearchParams(location.search).has("debug")) {
  window.mintless = {
    state: () => S,
    view,
    sleep,
    openTrade,
    deal,
    startFishing,
    world: () => WORLD,
    info: () => renderer.info.render,
    run(ms) {
      let now = performance.now();
      const t0 = performance.now();
      for (const end = now + ms; now < end; now += 16) update(0.016, now);
      render(now / 1000, 0.3);
      return Math.round(performance.now() - t0);
    },
  };
}
