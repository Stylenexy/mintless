// Mintless: a side-scrolling pixel market town. You are trader number 41;
// the 40 townsfolk run on the same engine the tests and the NEAR contract
// check. Every trader shows a bubble with the goods they take and the good
// they give, so the town's money appears in plain sight.
import { createTown } from "../engine/town.js";
import { SALT_TOWN } from "../rules/town.js";
import { mysteryRules } from "../engine/mystery.js";
import { createVisitor, visitorRole, answer, offer, shortestPath, autoTrade, endDay, savings, swapsNeeded, wantsOf, SWAPS_PER_DAY, MAKES_PER_DAY } from "../engine/visitor.js";
import { TILE, VIEW_H, GROUND_Y, WORLD_W, GOOD_COLOR, DISTRICTS, spotX, homeX, buildWorld, solidAt, personSprite, iconURL, darkness, drawBackground, drawWater, drawLights, drawRain, drawBubble, drawGlint, drawGoalArrow, drawEdgeArrow } from "./pixel.js";

const GOOD_NAME = ["salt", "fish", "rice", "cloth", "wood"];
const VERB = { saltmaker: "pan", fisher: "catch", farmer: "grow", weaver: "weave", logger: "cut" };
const TOWNSFOLK = [
  "Asih", "Bayu", "Citra", "Dimas", "Eka", "Fajar", "Gita", "Hadi",
  "Intan", "Joko", "Kirana", "Lukas", "Maya", "Nanda", "Oki", "Putri",
  "Rahmat", "Sari", "Teguh", "Umi", "Vina", "Wawan", "Yanti", "Zaki",
  "Ayu", "Bimo", "Dewi", "Galih", "Hana", "Ilham", "Kartika", "Lestari",
  "Made", "Nyoman", "Ratna", "Surya", "Tari", "Wulan", "Yoga", "Agus",
];
// Diamond Lock, lowest seller price in rupiah, 2015 to Jun 2026 (riset-track/growtopia-angka.md).
const DL_PRICES = [185000, 100000, 45000, 35000, 26000, 15800, 10000, 8000, 4000, 3700, 3300, 501, 299];
const SEASON = 30;
const HEARTS = 5;
const SPEED = 82;
const JUMP = 250;
const GRAVITY = 800;
const REACH = 20;
const DISTRICT_OF = Object.fromEntries(DISTRICTS.map((d) => [d.role, d]));

const $ = (id) => document.getElementById(id);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
let ICONS = [];
const pic = (g, cls = "") => `<img src="${ICONS[g]}" alt="${GOOD_NAME[g]}" class="${cls}">`;

const cv = $("world");
const ctx = cv.getContext("2d");
let viewW = 320;
let S = null;
let WORLD = null;
const held = new Set();

function setupView() {
  viewW = innerWidth < 700 ? 192 : 320;
  cv.width = viewW;
  cv.height = VIEW_H;
  ctx.imageSmoothingEnabled = false;
}

// ------------------------------------------------------------ game state
function newGame(kind, seed) {
  const rules = kind === "mystery" ? mysteryRules(seed) : structuredClone(SALT_TOWN);
  const town = createTown(rules, seed);
  const me = createVisitor(rules, visitorRole(rules));
  const seen = {};
  const npcs = town.agents.map((ag, i) => {
    const k = (seen[ag.role] = (seen[ag.role] ?? -1) + 1);
    return { i, x: spotX(DISTRICT_OF[ag.role], k), dir: k % 2 ? -1 : 1, skin: (i * 7) % 3, row: k % 2, idle: (i * 0.71) % 6 };
  });
  const startX = homeX(DISTRICT_OF[me.role]) + 34;
  S = {
    kind, seed, rules, town, me, npcs,
    you: { x: startX, y: GROUND_Y, vy: 0, ground: true, dir: 1, walk: 0, tx: null, target: null },
    cam: clamp(startX - viewW / 2, 0, WORLD_W - viewW),
    phase: 0, night: null, busy: false, trading: null, pick: null,
    days: [], hearts: HEARTS, news: [], shares: roleShares(town), told: {}, district: -1,
    ended: false, hover: null, ver: 0, cacheVer: -1, bubbles: [], next: new Set(), path: null,
    banners: [], showing: false, nightLog: [],
  };
  morning();
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
  S.days.push({ need: swapsNeeded(S.town, S.me), money: money(), ate: null });
}

// What every trader would take right now, and who moves you closer to tonight's need.
function refresh() {
  if (S.cacheVer === S.ver) return;
  S.cacheVer = S.ver;
  const path = shortestPath(S.town, S.me);
  S.path = path;
  S.next = new Set(path && path.length ? path[0].traders : []);
  S.bubbles = S.npcs.map((n) => {
    const ag = S.town.agents[n.i];
    if (ag.holds === ag.needs) return { mood: "keep", wants: [], gives: ag.holds };
    const wants = wantsOf(S.town, ag).sort((a, b) => (a === ag.needs ? -1 : b === ag.needs ? 1 : a - b));
    const mood = S.next.has(n.i) ? "goal" : wants.some((g) => S.me.bag[g] > 0) ? "ok" : "plain";
    return { mood, wants, gives: ag.holds };
  });
}

function goalTrader() {
  refresh();
  let best = null;
  for (const i of S.next) if (best === null || Math.abs(S.npcs[i].x - S.you.x) < Math.abs(S.npcs[best].x - S.you.x)) best = i;
  return best;
}

function nearestTrader() {
  let best = null;
  for (const n of S.npcs) {
    const d = Math.abs(n.x - S.you.x);
    if (d <= REACH && S.you.y > GROUND_Y - 20 && (best === null || d < Math.abs(best.x - S.you.x))) best = n;
  }
  return best;
}

// Share of each role (excluding those who need or make the good) that takes each good.
function roleShares(town) {
  const out = {};
  for (const d of DISTRICTS) {
    const members = town.agents.filter((ag) => ag.role === d.role);
    out[d.role] = town.spoil.map((_, g) => members.filter((ag) => ag.holds === g || answer(town, ag, g).yes).length / members.length);
  }
  return out;
}

// News only follows goods the whole town is warming to (or cooling on), so
// small wobbles in one district don't drown out the story of the money.
function townNews() {
  const now = roleShares(S.town);
  const accept = S.town.history[S.town.history.length - 1].accept;
  const leader = accept.indexOf(Math.max(...accept));
  const lines = [];
  for (const d of DISTRICTS) {
    const role = S.rules.roles.find((r) => r.key === d.role);
    for (let g = 0; g < GOOD_NAME.length; g++) {
      if (g === role.needs || g === role.makes) continue;
      const key = `${d.role}:${g}`;
      const is = now[d.role][g];
      if (!S.told[key] && is >= 0.5 && g === leader && accept[g] >= 600) {
        S.told[key] = true;
        lines.push({ g, text: `${d.plural} now take ${GOOD_NAME[g]}, though they never use it.` });
      } else if (S.told[key] && is < 0.25) {
        S.told[key] = false;
        lines.push({ g, text: `${d.plural} stopped taking ${GOOD_NAME[g]}.` });
      }
    }
  }
  S.shares = now;
  for (const l of lines.slice(0, 3)) S.news.unshift({ day: S.town.day + 1, ...l });
  S.news = S.news.slice(0, 3);
}

// ------------------------------------------------------------ loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (S) {
    update(dt, now);
    draw(now / 1000);
  }
  requestAnimationFrame(frame);
}

const canMove = () => !S.busy && S.trading === null && !S.ended && !modalOpen();

function hitWall(x, feet) {
  for (const y of [feet - 2, feet - 12, feet - 21]) if (solidAt(WORLD, x - 5, y) || solidAt(WORLD, x + 5, y)) return true;
  return false;
}

function jump() {
  if (!S || !S.you.ground || !canMove()) return;
  S.you.vy = -JUMP;
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
  let dir = 0;
  if (canMove()) {
    dir = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
    if (dir) {
      you.tx = null;
      you.target = null;
    } else if (you.tx !== null) {
      const d = you.tx - you.x;
      if (Math.abs(d) < 2) {
        you.tx = null;
        if (you.target !== null) {
          const t = you.target;
          you.target = null;
          openTrade(t);
        }
      } else dir = Math.sign(d);
    }
  }
  if (dir) you.dir = dir;
  const nx = clamp(you.x + dir * SPEED * dt, 8, WORLD_W - 8);
  if (!hitWall(nx, you.y)) you.x = nx;
  else if (you.ground && you.tx !== null) jump();
  you.vy += GRAVITY * dt;
  let ny = you.y + you.vy * dt;
  you.ground = false;
  if (you.vy >= 0 && (solidAt(WORLD, you.x - 4, ny) || solidAt(WORLD, you.x + 4, ny))) {
    ny = Math.floor(ny / TILE) * TILE;
    you.vy = 0;
    you.ground = true;
  } else if (you.vy < 0 && (solidAt(WORLD, you.x - 4, ny - 23) || solidAt(WORLD, you.x + 4, ny - 23))) {
    you.vy = 0;
    ny = you.y;
  }
  you.y = ny;
  you.walk = dir && you.ground ? you.walk + dt * 9 : 0;

  const target = clamp(you.x - viewW / 2, 0, WORLD_W - viewW);
  S.cam += (target - S.cam) * Math.min(1, dt * 7);

  const d = DISTRICTS.findIndex((dd) => you.x >= dd.x0 && you.x < dd.x0 + 368);
  if (d >= 0 && d !== S.district) {
    S.district = d;
    const el = $("place");
    el.textContent = DISTRICTS[d].name;
    el.classList.remove("hidden");
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
  }
  renderPrompt();
}

function drawSprite(sp, x, feet, dir) {
  const px = Math.round(x), py = Math.round(feet);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(px - 6, py, 12, 1);
  ctx.fillRect(px - 4, py + 1, 8, 1);
  if (dir < 0) {
    ctx.save();
    ctx.translate(px + 9, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sp, 0, py - 25);
    ctx.restore();
  } else ctx.drawImage(sp, px - 9, py - 25);
}

function draw(t) {
  refresh();
  const cam = Math.round(S.cam);
  const wet = raining();
  drawBackground(ctx, WORLD, cam, viewW, t, S.phase, wet);
  drawWater(ctx, WORLD, cam, t);
  ctx.drawImage(WORLD.terrain, -cam, 0);

  const visible = S.npcs.filter((n) => n.x - cam > -24 && n.x - cam < viewW + 24);
  for (const n of visible) {
    const ag = S.town.agents[n.i];
    const near = Math.abs(n.x - S.you.x) < 70;
    const hop = Math.sin(t * 1.7 + n.idle) > 0.97 ? 1 : 0;
    drawSprite(personSprite(ag.role, 0, n.skin), n.x - cam, GROUND_Y - hop, near ? (S.you.x < n.x ? -1 : 1) : n.dir);
  }
  const you = S.you;
  const pulse = 0.35 + 0.25 * Math.sin(t * 4);
  if (you.ground) {
    ctx.fillStyle = `rgba(0,191,255,${pulse.toFixed(2)})`;
    ctx.fillRect(Math.round(you.x - cam) - 8, Math.round(you.y) + 2, 17, 1);
  }
  drawSprite(personSprite("you", Math.floor(you.walk) % 2), you.x - cam, you.y, you.dir);

  const dk = darkness(S.phase);
  if (dk > 0) {
    ctx.fillStyle = `rgba(6,8,30,${(0.5 * dk).toFixed(2)})`;
    ctx.fillRect(0, 0, viewW, VIEW_H);
    drawLights(ctx, WORLD, cam, viewW, dk);
  }
  if (wet) drawRain(ctx, viewW, t);

  if (!S.busy) {
    const m = money();
    const goal = goalTrader();
    for (const n of visible) {
      const b = S.bubbles[n.i];
      const x = n.x - cam;
      const full = Math.abs(n.x - S.you.x) < 60 || n.i === goal || n.i === S.hover;
      const bottom = GROUND_Y - 29 - (full && n.row ? 15 : 0);
      drawBubble(ctx, x, bottom, b.wants.slice(0, 3), b.gives, b.mood, !full);
      if (b.mood !== "keep" && b.gives === m) drawGlint(ctx, Math.round(x) + 10, bottom - 12, t, n.i);
      if (n.i === goal) drawGoalArrow(ctx, Math.round(x), bottom - 16, t);
    }
    if (goal !== null) {
      const gx = S.npcs[goal].x - cam;
      if (gx < 0) drawEdgeArrow(ctx, viewW, -1, S.bubbles[goal].gives, t);
      else if (gx > viewW) drawEdgeArrow(ctx, viewW, 1, S.bubbles[goal].gives, t);
    }
  }
}

// ------------------------------------------------------------ input
function toWorld(e) {
  const r = cv.getBoundingClientRect();
  return { x: S.cam + ((e.clientX - r.left) / r.width) * viewW, y: ((e.clientY - r.top) / r.height) * VIEW_H };
}

function npcAt(x, y) {
  let best = null;
  for (const n of S.npcs) {
    const top = GROUND_Y - 44 - (n.row ? 15 : 0);
    if (Math.abs(x - n.x) <= 12 && y >= top && y <= GROUND_Y + 2) {
      if (best === null || Math.abs(x - n.x) < Math.abs(x - best.x)) best = n;
    }
  }
  return best ? best.i : null;
}

function walkTo(i) {
  const n = S.npcs[i];
  S.you.target = i;
  S.you.tx = clamp(n.x + (S.you.x < n.x ? -14 : 14), 8, WORLD_W - 8);
}

cv.addEventListener("pointerdown", (e) => {
  if (!S || !canMove()) return;
  const { x, y } = toWorld(e);
  const hit = npcAt(x, y);
  if (hit !== null) {
    if (Math.abs(S.npcs[hit].x - S.you.x) <= REACH) openTrade(hit);
    else walkTo(hit);
  } else {
    S.you.target = null;
    S.you.tx = clamp(x, 8, WORLD_W - 8);
  }
});

cv.addEventListener("pointermove", (e) => {
  if (!S) return;
  const { x, y } = toWorld(e);
  S.hover = npcAt(x, y);
});
cv.addEventListener("pointerleave", () => S && (S.hover = null));

const KEYMAP = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
document.addEventListener("keydown", (e) => {
  if (!S) return;
  if (S.trading !== null) {
    if (e.key === "Escape") closeTrade();
    else if (e.key === "Enter" || e.key === "e" || e.key === "E") deal();
    else if (/^[1-5]$/.test(e.key)) pickNth(Number(e.key) - 1);
    return;
  }
  if (e.key === "Escape") {
    if (!$("intro").classList.contains("hidden") && !$("back").classList.contains("hidden")) hideIntro();
    return;
  }
  if (modalOpen()) return;
  if (KEYMAP[e.key]) {
    held.add(KEYMAP[e.key]);
    e.preventDefault();
  } else if ([" ", "w", "W", "ArrowUp"].includes(e.key)) {
    jump();
    e.preventDefault();
  } else if (e.key === "e" || e.key === "E" || e.key === "Enter") talk();
  else if (e.key === "s" || e.key === "S") sleep(1);
  else if (e.key === "f" || e.key === "F") sleep(7);
  else if (e.key === "m" || e.key === "M") toggleSound();
});
document.addEventListener("keyup", (e) => KEYMAP[e.key] && held.delete(KEYMAP[e.key]));
addEventListener("blur", () => held.clear());

for (const b of document.querySelectorAll("[data-k]")) {
  const k = b.dataset.k;
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (k === "jump") jump();
    else held.add(k);
  });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, () => held.delete(k));
}
$("pad-trade").addEventListener("click", talk);

function talk() {
  if (!S || !canMove()) return;
  const n = nearestTrader();
  if (n) openTrade(n.i);
  else toast("Walk up to a trader first. Their bubble shows what they take and what they give.");
}

function renderPrompt() {
  const el = $("prompt");
  const n = S && canMove() ? nearestTrader() : null;
  $("pad-trade").classList.toggle("live", !!n);
  if (!n) return el.classList.add("hidden");
  const r = cv.getBoundingClientRect();
  const sr = $("stage").getBoundingClientRect();
  el.innerHTML = `<kbd>E</kbd> Trade with ${TOWNSFOLK[n.i]}`;
  el.style.left = `${r.left - sr.left + ((n.x - S.cam) / viewW) * r.width}px`;
  el.style.top = `${r.top - sr.top + ((GROUND_Y + 6) / VIEW_H) * r.height}px`;
  el.classList.remove("hidden");
}

const modalOpen = () => ["trade", "intro", "end"].some((id) => !$(id).classList.contains("hidden"));

// ------------------------------------------------------------ trading
function openTrade(i) {
  refresh();
  S.trading = i;
  S.you.target = null;
  S.you.tx = null;
  held.clear();
  const ag = S.town.agents[i];
  const face = $("t-face").getContext("2d");
  face.imageSmoothingEnabled = false;
  face.clearRect(0, 0, 18, 26);
  face.drawImage(personSprite(ag.role, 0, S.npcs[i].skin), 0, 0);
  $("t-name").textContent = TOWNSFOLK[i];
  $("t-role").textContent = `${cap(ag.role)} · ${DISTRICT_OF[ag.role].name}`;
  const wants = S.bubbles[i].wants;
  S.pick = wants.find((g) => S.me.bag[g] > 0) ?? null;
  greet();
  renderTrade();
  $("trade").classList.remove("hidden");
  sfx("open");
}

function greet() {
  const ag = S.town.agents[S.trading];
  const b = S.bubbles[S.trading];
  const list = b.wants.map((g) => GOOD_NAME[g]).join(" or ");
  if (b.mood === "keep") return say(`I'm keeping my ${GOOD_NAME[ag.needs]} for my family tonight. Come back tomorrow!`, "");
  if (S.me.swaps <= 0) return say("You're out of trades for today. Sleep, and come back tomorrow.", "no");
  if (S.pick === null) return say(`I'll take ${list} for my ${GOOD_NAME[ag.holds]}. You don't have any yet.`, "no");
  const kind = answer(S.town, ag, S.pick).kind;
  if (kind === "need") say(`${cap(GOOD_NAME[S.pick])}? That's exactly what my family needs. Deal?`, "yes");
  else say(`I don't use ${GOOD_NAME[S.pick]} myself, but everyone in town takes it. I'll take it for my ${GOOD_NAME[ag.holds]}.<small>That's money: wanted to trade on, not to use.</small>`, "yes");
}

function say(html, mood) {
  const b = $("t-say");
  b.innerHTML = html;
  b.className = `bubble ${mood}`;
}

function renderTrade() {
  const ag = S.town.agents[S.trading];
  const b = S.bubbles[S.trading];
  $("t-give").innerHTML = b.wants.length
    ? b.wants.map((g, k) => `<button class="slot big ${S.me.bag[g] ? "" : "empty"} ${g === S.pick ? "sel" : ""}" data-g="${g}" title="${k + 1}: ${cap(GOOD_NAME[g])}, you have ${S.me.bag[g]}">${pic(g)}<span class="n">${S.me.bag[g]}</span></button>`).join("")
    : '<p class="dim">Nothing today</p>';
  $("t-get").innerHTML = b.mood === "keep" ? '<p class="dim">Not trading</p>' : `<div class="slot big get">${pic(ag.holds)}<span class="n">1</span></div>`;
  const btn = $("t-swap");
  const ready = b.mood !== "keep" && S.pick !== null && S.me.bag[S.pick] > 0 && S.me.swaps > 0;
  btn.textContent = ready ? `Deal: 1 ${GOOD_NAME[S.pick]} for 1 ${GOOD_NAME[ag.holds]}` : "No deal";
  ready ? btn.removeAttribute("aria-disabled") : btn.setAttribute("aria-disabled", "true");
  $("t-foot").textContent = `Trades left today: ${S.me.swaps} of ${SWAPS_PER_DAY}`;
}

function pickNth(k) {
  const g = S.bubbles[S.trading].wants[k];
  if (g === undefined) return;
  S.pick = g;
  if (S.me.bag[g] > 0) greet();
  else say(`You don't have any ${GOOD_NAME[g]}.`, "no");
  renderTrade();
}

$("t-give").addEventListener("click", (e) => {
  const slot = e.target.closest(".slot");
  if (!slot) return;
  pickNth(S.bubbles[S.trading].wants.indexOf(Number(slot.dataset.g)));
});

function deal() {
  if (S.trading === null || S.pick === null) return;
  const gave = S.pick;
  const res = offer(S.town, S.me, S.trading, gave);
  if (!res.ok) {
    sfx("deny");
    return;
  }
  sfx("deal");
  S.ver++;
  S.pick = null;
  say(`Deal! Enjoy the ${GOOD_NAME[res.got]}.`, "yes");
  $("t-swap").setAttribute("aria-disabled", "true");
  toast(`+1 ${GOOD_NAME[res.got]}   −1 ${GOOD_NAME[gave]}`);
  renderHud();
  setTimeout(closeTrade, 700);
}
$("t-swap").addEventListener("click", deal);
$("t-leave").addEventListener("click", closeTrade);
$("trade").addEventListener("click", (e) => e.target.id === "trade" && closeTrade());

function closeTrade() {
  if (S.trading === null) return;
  S.trading = null;
  $("trade").classList.add("hidden");
  renderHud();
}

// ------------------------------------------------------------ nights
function sleep(days) {
  if (!S || S.busy || S.ended || modalOpen()) return;
  S.you.target = null;
  S.you.tx = null;
  S.busy = true;
  S.queue = days;
  S.fast = days > 1;
  S.nightLog = [];
  startNight();
  renderHud();
  sfx("night");
}

function startNight() {
  S.night = { t0: performance.now(), dur: S.fast ? 700 : 1700, applied: false };
}

function applyNight() {
  S.night.applied = true;
  const before = money();
  if (S.fast) autoTrade(S.town, S.me);
  const r = endDay(S.town, S.me);
  S.days[S.days.length - 1].ate = r.ate;
  S.hearts = r.ate ? Math.min(HEARTS, S.hearts + 1) : S.hearts - 1;
  S.ver++;
  S.nightLog.push(r);
  if (r.newMoney !== null) S.banners.push(moneyBanner(r.newMoney, before, r.report));
  const ev = rainEvent();
  if (ev && S.town.day === ev.day && rainGood() >= 0) {
    S.banners.push({ kind: "rain", g: rainGood(), title: "The rainy season came", text: `It stays wet until the season ends. ${cap(GOOD_NAME[rainGood()])} now loses ${ev.spoil}% every night.` });
  }
  if (ev && ev.good === -1 && S.town.day === ev.decideDay) {
    S.banners.push({ kind: "rain", g: rainGood(), title: "Rain forecast", text: `The rain on day ${ev.day + 1} will soak ${GOOD_NAME[rainGood()]}, the good the town holds most today.` });
  }
  townNews();
  if (S.town.day < SEASON) morning();
}

function finishNight() {
  S.night = null;
  S.phase = 0;
  if (S.town.day >= SEASON || S.hearts <= 0) {
    S.busy = false;
    renderHud();
    return finish();
  }
  if (--S.queue > 0) return startNight();
  S.busy = false;
  const log = S.nightLog;
  $("last").textContent = nightLine(log);
  if (log.length === 1) {
    const r = log[0];
    const rot = r.lost.map((u, g) => (u ? `${u} ${GOOD_NAME[g]}` : "")).filter(Boolean).join(", ");
    toast(`${r.ate ? "Your family ate. +1 ♥" : "Your family went hungry. −1 ♥"}${rot ? ` Rotted overnight: ${rot}.` : ""} You ${VERB[S.me.role]} ${MAKES_PER_DAY} fresh ${GOOD_NAME[S.me.makes]}.`);
  } else toast(`${log.length} days passed. Your family ate on ${log.filter((r) => r.ate).length} of ${log.length} nights.`);
  showBanners();
  renderHud();
}

// One plain line under the bag, so the numbers going up and down add up.
function nightLine(log) {
  const lost = GOOD_NAME.map((_, g) => log.reduce((sum, r) => sum + r.lost[g], 0));
  const parts = [`+${log.length * MAKES_PER_DAY} ${GOOD_NAME[S.me.makes]} made`];
  lost.forEach((u, g) => u && parts.push(`${u} ${GOOD_NAME[g]} rotted`));
  const ate = log.filter((r) => r.ate).length;
  if (ate) parts.push(`${ate} ${GOOD_NAME[S.me.needs]} eaten`);
  return `${log.length > 1 ? `Last ${log.length} nights` : "Last night"}: ${parts.join(", ")}`;
}

function moneyBanner(g, before, report) {
  if (g < 0) return { kind: "money", g: before, title: `${cap(GOOD_NAME[before])} stopped being money`, text: "The town is bartering again. Watch the bubbles: what do they start taking next?" };
  const tenths = Math.round(report.accept[g] / 100);
  const share = tenths >= 10 ? "All" : `${tenths} in 10`;
  const swapped = before >= 0 ? `It replaced ${GOOD_NAME[before]}. ` : "";
  return { kind: "money", g, title: `${cap(GOOD_NAME[g])} is money now`, text: `${swapped}Nobody decided it. ${share} traders who never use ${GOOD_NAME[g]} take it anyway. Look at the bubbles.` };
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
    S.showing = false;
    showBanners();
  }, 4600);
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
  $("sky-icon").classList.toggle("night", !!S.night);
  const m = money();
  $("money").innerHTML = m >= 0 ? `${pic(m)} ${cap(GOOD_NAME[m])}` : town.history.some((h) => h.money >= 0) ? "barter again" : "none yet";
  $("money-chip").classList.toggle("has", m >= 0);

  const ev = rainEvent();
  const rc = $("rain-chip");
  if (!ev) rc.innerHTML = "";
  else {
    const g = rainGood();
    const what = g >= 0 ? `${pic(g)} ${GOOD_NAME[g]}` : `? <span class="dim">(known day ${ev.decideDay + 1})</span>`;
    rc.innerHTML = town.day >= ev.day && g >= 0 ? `Raining: ${what} rots ${ev.spoil}%/night` : `Rain from day ${ev.day + 1}: soaks ${what}`;
    rc.classList.toggle("on", town.day >= ev.day);
  }
  for (const id of ["sleep", "skip"]) S.busy || S.ended ? $(id).setAttribute("aria-disabled", "true") : $(id).removeAttribute("aria-disabled");

  $("bag").innerHTML = me.bag
    .map((u, g) => {
      const cls = ["slot", u ? "" : "empty", g === me.needs ? "need" : "", g === m ? "money" : ""].join(" ");
      const rot = town.spoil[g] ? `<span class="rot">-${town.spoil[g]}%</span>` : "";
      return `<button class="${cls}" data-g="${g}" title="${cap(GOOD_NAME[g])}: you have ${u}. Loses ${town.spoil[g]}% a night.">${pic(g)}<span class="n">${u}</span>${rot}</button>`;
    })
    .join("");
  $("swaps").innerHTML = `Trades today ${Array.from({ length: SWAPS_PER_DAY }, (_, k) => `<i class="${k < SWAPS_PER_DAY - me.swaps ? "used" : ""}"></i>`).join("")}`;
  renderQuest();
  $("news").innerHTML = S.news.map((n) => `<li><span class="dim">Day ${n.day}</span> ${pic(n.g)} ${n.text}</li>`).join("");
}

function renderQuest() {
  const { me, town } = S;
  const need = GOOD_NAME[me.needs];
  const have = me.bag[me.needs] > 0;
  const hearts = `<span class="hearts" aria-label="${S.hearts} of ${HEARTS} hearts">${"♥".repeat(Math.max(0, S.hearts))}<span class="lost">${"♥".repeat(HEARTS - Math.max(0, S.hearts))}</span></span>`;
  const path = S.path;
  let body;
  if (have) body = `<p class="ok">✓ You have ${need} for tonight.</p><p class="dim">Sleep when you're ready (S). Spare goods? Trade them into what everyone takes, so they don't rot.</p>`;
  else if (me.swaps <= 0) body = "<p>Out of trades today. Sleep and try again tomorrow.</p>";
  else if (path === null || path.length === 0) body = `<p>Nobody will trade toward ${need} today. Sleep and try tomorrow.</p>`;
  else {
    const hop = path[0];
    const role = town.agents[S.next.values().next().value].role;
    const left = path.length === 1 ? `That gets you ${need}!` : `${cap(need)} is ${path.length} trades away today.`;
    body = `<p class="step">Next: give ${pic(hop.give, "ic")} to a <b>${role}</b> → get ${pic(hop.get, "ic")}</p><p class="dim">${left} Follow the gold arrow.</p>`;
  }
  $("quest").innerHTML = `<h3>${pic(me.needs, "ic")} Tonight: 1 ${need} for your family ${hearts}</h3>${body}`;
}

// ------------------------------------------------------------ screens
function introHtml(rules) {
  const role = rules.roles.find((r) => r.key === visitorRole(rules));
  const mk = GOOD_NAME[role.makes], nd = GOOD_NAME[role.needs];
  return [
    [role.makes, `You're a ${role.key}. You ${VERB[role.key]} ${MAKES_PER_DAY} ${mk} a day, and ${mk} loses ${rules.goods[role.makes].spoil}% every night.`],
    [role.needs, `Your family needs 1 ${nd} every night, or loses a heart. You have ${HEARTS}.`],
    [role.makes, "Every trader's bubble shows what they take → what they give. Green bubble: you have what they want. Walk up and press E."],
    [0, "Nobody has money yet. Watch which good starts showing up in everyone's bubble."],
  ]
    .map(([g, text], k) => `<li><b class="k">${k + 1}</b>${pic(g)}<span>${text}</span></li>`)
    .join("");
}

function showIntro(help) {
  $("how").innerHTML = introHtml(help && S ? S.rules : SALT_TOWN);
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
  $("end").classList.add("hidden");
  if (kind === "mystery") toast(`Mystery town #${seed}. You're the ${S.me.role} here: ${GOOD_NAME[S.me.makes]} rots fastest in this town.`);
  else toast("Your family needs salt tonight. Follow the gold arrow to your first trade.");
}

function finish() {
  S.ended = true;
  const { me, town } = S;
  $("end-title").textContent = S.hearts <= 0 ? `Your family left town hungry on day ${town.day}` : `Your family ate on ${me.fed} of ${SEASON} nights`;
  $("end-save").textContent = `Savings left: worth ${savings(town, me)} meals of ${GOOD_NAME[me.needs]}.`;
  const maxNeed = Math.max(4, ...S.days.map((d) => d.need));
  $("end-chart").innerHTML = S.days
    .map((d, k) => {
      const hgt = d.need < 0 ? 100 : Math.max(6, (d.need / maxNeed) * 100);
      const col = d.money >= 0 ? GOOD_COLOR[d.money] : "#44506e";
      return `<span class="${d.ate === false ? "hungry" : ""}" style="height:${hgt}%;background:${col}" title="Day ${k + 1}: ${d.need < 0 ? "no way" : `${d.need} trades`}"></span>`;
    })
    .join("");
  const seenMoney = [...new Set(S.days.map((d) => d.money))];
  $("end-legend").innerHTML = seenMoney.map((g) => `<span><i style="background:${g >= 0 ? GOOD_COLOR[g] : "#44506e"}"></i>${g >= 0 ? `${GOOD_NAME[g]} was money` : "no money, pure barter"}</span>`).join("") + '<span><i style="background:transparent;outline:2px solid var(--bad)"></i>family went hungry</span>';
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
  $("end-story").textContent = `${story.join(" ")} Nobody decided any of it. Bar height is how many trades your ${GOOD_NAME[me.needs]} took that morning; colour is the town's money that day.`;
  $("end").classList.remove("hidden");
}

$("sleep").addEventListener("click", () => sleep(1));
$("skip").addEventListener("click", () => sleep(7));
$("help").addEventListener("click", () => showIntro(true));
$("back").addEventListener("click", hideIntro);
$("play-salt").addEventListener("click", () => start("salt"));
$("play-mystery").addEventListener("click", () => start("mystery"));
$("again").addEventListener("click", () => start("mystery"));
$("replay").addEventListener("click", () => {
  newGame(S.kind, S.seed);
  $("end").classList.add("hidden");
});
$("bag").addEventListener("click", (e) => {
  const slot = e.target.closest(".slot");
  if (!slot) return;
  const g = Number(slot.dataset.g);
  toast(`${cap(GOOD_NAME[g])}: you have ${S.me.bag[g]}. Loses ${S.town.spoil[g]}% a night.${g === money() ? " The town uses it as money." : ""}`);
});
addEventListener("resize", () => {
  const before = viewW;
  setupView();
  if (viewW !== before && S) renderHud();
});

// ------------------------------------------------------------ boot
setupView();
WORLD = buildWorld();
ICONS = GOOD_NAME.map((_, g) => iconURL(g, 4));
const dlMax = Math.max(...DL_PRICES);
$("dl").innerHTML = DL_PRICES.map((rp) => `<span class="${rp < 1000 ? "low" : ""}" style="height:${Math.max(3, (rp / dlMax) * 100)}%"></span>`).join("");
newGame("salt", 1);
showIntro(false);
requestAnimationFrame(frame);
// ?debug exposes the live state for automated play-throughs; run(ms)
// advances the clock by hand, for when the page is in a background tab.
if (new URLSearchParams(location.search).has("debug")) {
  window.mintless = {
    state: () => S,
    openTrade,
    sleep,
    deal,
    run(ms) {
      let now = performance.now();
      for (const end = now + ms; now < end; now += 16) update(0.016, now);
      draw(now / 1000);
    },
  };
}
