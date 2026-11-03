// Mintless: the pixel market town. You are trader number 41; the 40
// townsfolk run on the same engine the tests and the NEAR contract check.
import { createTown } from "../engine/town.js";
import { SALT_TOWN } from "../rules/town.js";
import { mysteryRules } from "../engine/mystery.js";
import { createVisitor, visitorRole, answer, offer, shortestPath, autoTrade, endDay, savings, swapsNeeded, SWAPS_PER_DAY, MAKES_PER_DAY } from "../engine/visitor.js";
import { VIEW_H, WORLD_W, STREET_TOP, STREET_BOTTOM, GOOD_COLOR, STALLS, drawWorld, drawMarker, drawGlint, iconSprite, personSprite, iconURL, darkness } from "./pixel.js";

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

const $ = (id) => document.getElementById(id);
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
let ICONS = [];
const pic = (g) => `<img src="${ICONS[g]}" alt="${GOOD_NAME[g]}">`;

const cv = $("world");
const ctx = cv.getContext("2d");
let viewW = WORLD_W;
let S = null;
const held = new Set();

function setupView() {
  viewW = innerWidth < 700 ? 200 : WORLD_W;
  cv.width = viewW;
  cv.height = VIEW_H;
  ctx.imageSmoothingEnabled = false;
}

// ------------------------------------------------------------ game state
function newGame(kind, seed) {
  const rules = kind === "mystery" ? mysteryRules(seed) : structuredClone(SALT_TOWN);
  const town = createTown(rules, seed);
  const me = createVisitor(rules, visitorRole(rules));
  const npcs = town.agents.map((ag, i) => {
    const home = STALLS.find((st) => st.role === ag.role).x;
    const x = home - 28 + ((i * 37) % 56);
    return { i, home, x, y: STREET_TOP + 6 + ((i * 53) % (STREET_BOTTOM - STREET_TOP - 8)), tx: x, wait: (i % 7) * 0.4, dir: i % 2 ? 1 : -1, walk: 0, stop: false };
  });
  const homeX = STALLS.find((st) => st.good === me.makes).x;
  S = {
    kind, seed, rules, town, me, npcs,
    you: { x: homeX, y: STREET_BOTTOM - 1, tx: null, dir: 1, walk: 0, target: null },
    cam: 0, phase: 0, night: null, busy: false, trading: null, picked: null,
    days: [], ended: false, hover: null, ver: 0, hint: { ver: -1 }, banners: [], showing: false, nightLog: [],
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

function hints() {
  if (S.hint.ver !== S.ver) {
    const path = shortestPath(S.town, S.me);
    S.hint = { ver: S.ver, path, next: new Set(path && path.length ? path[0].traders : []) };
  }
  return S.hint;
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

function update(dt, now) {
  if (S.night) {
    const p = (now - S.night.t0) / S.night.dur;
    S.phase = Math.min(0.999, p);
    if (p >= 0.5 && !S.night.applied) applyNight();
    if (p >= 1) finishNight();
  }
  const you = S.you;
  let moving = false;
  if (!S.busy && S.trading === null && !modalOpen()) {
    const dir = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
    if (dir) {
      you.tx = null;
      you.target = null;
      you.x = clamp(you.x + dir * 70 * dt, 6, WORLD_W - 6);
      you.dir = dir;
      moving = true;
    } else if (you.tx !== null) {
      const d = you.tx - you.x;
      if (Math.abs(d) < 1.2) {
        you.x = you.tx;
        you.tx = null;
        if (you.target !== null) openTrade(you.target);
      } else {
        you.dir = Math.sign(d);
        you.x += you.dir * Math.min(Math.abs(d), 75 * dt);
        moving = true;
      }
    }
  }
  you.walk = moving ? you.walk + dt * 9 : 0;

  for (const n of S.npcs) {
    if (n.stop) {
      n.dir = S.you.x < n.x ? -1 : 1;
      n.walk = 0;
      continue;
    }
    if (n.wait > 0) {
      n.wait -= dt;
      n.walk = 0;
      continue;
    }
    const d = n.tx - n.x;
    if (Math.abs(d) < 0.8) {
      n.wait = 0.6 + Math.random() * 2.6;
      const far = Math.random() < 0.3;
      const base = far ? STALLS[Math.floor(Math.random() * STALLS.length)].x : n.home;
      n.tx = clamp(base - 30 + Math.random() * 60, 6, WORLD_W - 6);
    } else {
      n.dir = Math.sign(d);
      n.x += n.dir * Math.min(Math.abs(d), 14 * dt);
      n.walk += dt * 6;
    }
  }
}

function drawPerson(look, x, y, dir, walk) {
  const sp = personSprite(look, Math.floor(walk) % 2);
  const px = Math.round(x), py = Math.round(y);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(px - 4, py, 8, 1);
  ctx.fillRect(px - 3, py + 1, 6, 1);
  if (dir < 0) {
    ctx.save();
    ctx.translate(px + 5, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sp, 0, py - 13);
    ctx.restore();
  } else {
    ctx.drawImage(sp, px - 5, py - 13);
  }
}

function draw(t) {
  S.cam = viewW >= WORLD_W ? 0 : clamp(Math.round(S.you.x - viewW / 2), 0, WORLD_W - viewW);
  const wet = raining();
  drawWorld(ctx, S.cam, viewW, t, S.phase, wet);
  ctx.save();
  ctx.translate(-S.cam, 0);
  const m = money();
  const h = S.busy ? { next: new Set() } : hints();
  const rg = rainGood();
  const crowd = S.npcs.map((n) => ({ n, y: n.y })).concat([{ you: true, y: S.you.y }]).sort((a, b) => a.y - b.y);
  for (const c of crowd) {
    if (c.you) {
      const { x, y, dir, walk } = S.you;
      const pulse = 0.35 + 0.25 * Math.sin(t * 4);
      ctx.fillStyle = `rgba(0,191,255,${pulse.toFixed(2)})`;
      ctx.fillRect(Math.round(x) - 7, Math.round(y) + 1, 15, 1);
      ctx.fillRect(Math.round(x) - 5, Math.round(y) + 2, 11, 1);
      drawPerson("you", x, y, dir, walk);
      const bob = Math.round(Math.sin(t * 5) * 1.5);
      const ax = Math.round(x), ay = Math.round(y) - 22 + bob;
      ctx.fillStyle = "#0b0e18";
      ctx.fillRect(ax - 4, ay - 1, 9, 6);
      ctx.fillStyle = "#00bfff";
      ctx.fillRect(ax - 3, ay, 7, 1);
      ctx.fillRect(ax - 2, ay + 1, 5, 1);
      ctx.fillRect(ax - 1, ay + 2, 3, 1);
      ctx.fillRect(ax, ay + 3, 1, 1);
      continue;
    }
    const n = c.n;
    const ag = S.town.agents[n.i];
    drawPerson(ag.role, n.x, n.y, n.dir, n.walk);
    const x = Math.round(n.x), y = Math.round(n.y);
    const bob = Math.round(Math.sin(t * 3 + n.i));
    ctx.drawImage(iconSprite(ag.holds), x - 5, y - 26 + bob);
    if (ag.holds === m) drawGlint(ctx, x + 4, y - 25 + bob, t, n.i);
    if (wet && ag.holds === rg) {
      ctx.fillStyle = "#8fb8ff";
      ctx.fillRect(x - 2 + (Math.floor(t * 3 + n.i) % 4), y - 16 + (Math.floor(t * 12 + n.i) % 3), 1, 1);
    }
    if (h.next.has(n.i)) drawMarker(ctx, x, y - 26 + bob, t);
    if (S.hover === n.i || S.trading === n.i) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - 5, y + 2, 10, 1);
    }
  }
  ctx.restore();
  const dk = darkness(S.phase);
  if (dk > 0) {
    ctx.fillStyle = `rgba(6,8,30,${(0.45 * dk).toFixed(2)})`;
    ctx.fillRect(0, 0, viewW, VIEW_H);
  }
}

// ------------------------------------------------------------ input
function toWorld(e) {
  const r = cv.getBoundingClientRect();
  return { x: S.cam + ((e.clientX - r.left) / r.width) * viewW, y: ((e.clientY - r.top) / r.height) * VIEW_H, r };
}

function npcAt(x, y) {
  let best = null;
  let bd = Infinity;
  for (const n of S.npcs) {
    if (Math.abs(x - n.x) <= 6 && y >= n.y - 30 && y <= n.y + 3) {
      const d = Math.abs(x - n.x) + Math.abs(y - (n.y - 12)) * 0.3;
      if (d < bd) {
        bd = d;
        best = n.i;
      }
    }
  }
  return best;
}

function goTo(i) {
  const n = S.npcs[i];
  n.stop = true;
  S.you.target = i;
  S.you.tx = clamp(n.x + (S.you.x < n.x ? -9 : 9), 6, WORLD_W - 6);
}

cv.addEventListener("pointerdown", (e) => {
  if (!S || S.busy || S.trading !== null || S.ended || modalOpen()) return;
  const { x, y } = toWorld(e);
  const hit = npcAt(x, y);
  if (S.you.target !== null && S.you.target !== hit) S.npcs[S.you.target].stop = false;
  if (hit !== null) goTo(hit);
  else {
    S.you.target = null;
    S.you.tx = clamp(x, 6, WORLD_W - 6);
  }
});

cv.addEventListener("pointermove", (e) => {
  if (!S) return;
  const { x, y, r } = toWorld(e);
  const hit = npcAt(x, y);
  S.hover = hit;
  const tag = $("tag");
  if (hit === null || S.busy) return tag.classList.add("hidden");
  const n = S.npcs[hit];
  const ag = S.town.agents[hit];
  tag.innerHTML = `${TOWNSFOLK[hit]} the ${ag.role} · has ${GOOD_NAME[ag.holds]}`;
  const sr = $("stage").getBoundingClientRect();
  tag.style.left = `${r.left - sr.left + ((n.x - S.cam) / viewW) * r.width}px`;
  tag.style.top = `${r.top - sr.top + ((n.y - 30) / VIEW_H) * r.height}px`;
  tag.classList.remove("hidden");
});
cv.addEventListener("pointerleave", () => {
  if (S) S.hover = null;
  $("tag").classList.add("hidden");
});

const KEYMAP = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
document.addEventListener("keydown", (e) => {
  if (!S) return;
  if (e.key === "Escape") {
    if (S.trading !== null) closeTrade();
    else if (!$("intro").classList.contains("hidden") && !S.ended) hideIntro();
    return;
  }
  if (modalOpen()) return;
  if (KEYMAP[e.key]) {
    held.add(KEYMAP[e.key]);
    e.preventDefault();
  } else if (e.key === "e" || e.key === "E" || e.key === "Enter") {
    let best = null;
    for (const n of S.npcs) if (Math.abs(n.x - S.you.x) <= 16 && (best === null || Math.abs(n.x - S.you.x) < Math.abs(best.x - S.you.x))) best = n;
    if (best) {
      best.stop = true;
      openTrade(best.i);
    }
  } else if (e.key === "s" || e.key === "S") sleep(1);
  else if (e.key === "f" || e.key === "F") sleep(7);
});
document.addEventListener("keyup", (e) => KEYMAP[e.key] && held.delete(KEYMAP[e.key]));

const modalOpen = () => ["trade", "intro", "end"].some((id) => !$(id).classList.contains("hidden"));

// ------------------------------------------------------------ trading
const SAY = {
  empty: (g) => `You don't have any ${GOOD_NAME[g]}.`,
  tired: () => "You're out of swaps for today. Sleep, and come back tomorrow.",
  same: (g) => `I already have ${GOOD_NAME[g]}.`,
  keeps: (g, ag) => `I'm keeping this ${GOOD_NAME[ag.needs]} for my family tonight.`,
  need: (g) => `${cap(GOOD_NAME[g])}! That's exactly what I need. Deal.`,
  money: (g) => `I don't use ${GOOD_NAME[g]} myself, but everyone in town takes it. Deal.<small>That's money: wanted to trade on, not to use.</small>`,
  refuse: (g, ag) => `No thanks. I need ${GOOD_NAME[ag.needs]}, and I doubt anyone would take ${GOOD_NAME[g]} off my hands.`,
};

function openTrade(i) {
  const n = S.npcs[i];
  n.stop = true;
  S.you.target = null;
  S.trading = i;
  S.picked = null;
  $("tag").classList.add("hidden");
  const ag = S.town.agents[i];
  const face = $("t-face").getContext("2d");
  face.imageSmoothingEnabled = false;
  face.clearRect(0, 0, 10, 14);
  face.drawImage(personSprite(ag.role, 0), 0, 0);
  $("t-name").textContent = `${TOWNSFOLK[i]} the ${ag.role}`;
  say(ag.holds === ag.needs ? `I've got the ${GOOD_NAME[ag.needs]} my family needs tonight. Nothing to trade today.` : `I have ${GOOD_NAME[ag.holds]}. What will you give me for it?`, "");
  renderTrade();
  $("trade").classList.remove("hidden");
}

function say(html, mood) {
  const b = $("t-say");
  b.innerHTML = html;
  b.className = `bubble ${mood}`;
}

function renderTrade() {
  const ag = S.town.agents[S.trading];
  $("t-facts").innerHTML = `<span>Has ${pic(ag.holds)} ${GOOD_NAME[ag.holds]}</span><span>Needs ${pic(ag.needs)} ${GOOD_NAME[ag.needs]}</span><span>Swaps left ${S.me.swaps}/${SWAPS_PER_DAY}</span>`;
  $("t-bag").innerHTML = slotsHtml(S.picked);
  const btn = $("t-swap");
  const verdict = S.picked === null ? null : judge(S.picked);
  if (!verdict) {
    btn.textContent = "Pick something to offer";
    btn.setAttribute("aria-disabled", "true");
  } else if (verdict.yes) {
    btn.textContent = `Swap 1 ${GOOD_NAME[S.picked]} for 1 ${GOOD_NAME[ag.holds]}`;
    btn.removeAttribute("aria-disabled");
  } else {
    btn.textContent = "No deal";
    btn.setAttribute("aria-disabled", "true");
  }
}

function judge(g) {
  const ag = S.town.agents[S.trading];
  if (S.me.bag[g] <= 0) return { yes: false, kind: "empty" };
  if (S.me.swaps <= 0) return { yes: false, kind: "tired" };
  return answer(S.town, ag, g);
}

$("t-bag").addEventListener("click", (e) => {
  const slot = e.target.closest(".slot");
  if (!slot) return;
  S.picked = Number(slot.dataset.g);
  const v = judge(S.picked);
  say(SAY[v.kind](S.picked, S.town.agents[S.trading]), v.yes ? "yes" : "no");
  renderTrade();
});

$("t-swap").addEventListener("click", () => {
  if (S.picked === null) return;
  const gave = S.picked;
  const res = offer(S.town, S.me, S.trading, gave);
  if (!res.ok) return;
  S.ver++;
  S.picked = null;
  say(`Pleasure doing business. Enjoy the ${GOOD_NAME[res.got]}.`, "yes");
  toast(`+1 ${GOOD_NAME[res.got]}   -1 ${GOOD_NAME[gave]}`);
  renderTrade();
  renderHud();
});

$("t-leave").addEventListener("click", closeTrade);
$("trade").addEventListener("click", (e) => e.target.id === "trade" && closeTrade());

function closeTrade() {
  if (S.trading === null) return;
  const n = S.npcs[S.trading];
  n.stop = false;
  n.wait = 0.8;
  S.trading = null;
  $("trade").classList.add("hidden");
  renderHud();
}

// ------------------------------------------------------------ nights
function sleep(days) {
  if (!S || S.busy || S.ended || modalOpen()) return;
  if (S.trading !== null) closeTrade();
  for (const n of S.npcs) n.stop = false;
  S.you.target = null;
  S.busy = true;
  S.queue = days;
  S.fast = days > 1;
  S.nightLog = [];
  startNight();
  renderHud();
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
  S.ver++;
  S.nightLog.push(r);
  if (r.newMoney !== null) S.banners.push(moneyBanner(r.newMoney, before, r.report));
  const ev = rainEvent();
  if (ev && S.town.day === ev.day && rainGood() >= 0) {
    S.banners.push({ kind: "rain", g: rainGood(), title: "The rains came", text: `${cap(GOOD_NAME[rainGood()])} gets damp now and loses ${ev.spoil}% every night.` });
  }
  if (ev && ev.good === -1 && S.town.day === ev.decideDay) {
    S.banners.push({ kind: "rain", g: rainGood(), title: "Rain forecast", text: `The rain on day ${ev.day + 1} will soak ${GOOD_NAME[rainGood()]}, the good the town holds most today.` });
  }
  if (S.town.day < SEASON) morning();
}

function finishNight() {
  S.night = null;
  S.phase = 0;
  if (S.town.day >= SEASON) {
    S.busy = false;
    renderHud();
    return finish();
  }
  if (--S.queue > 0) return startNight();
  S.busy = false;
  const log = S.nightLog;
  if (log.length === 1) {
    const r = log[0];
    const rot = r.lost.map((u, g) => (u ? `${u} ${GOOD_NAME[g]}` : "")).filter(Boolean).join(", ");
    toast(`${r.ate ? "Your family ate." : "Your family went hungry."}${rot ? ` Rotted overnight: ${rot}.` : ""} You made ${MAKES_PER_DAY} ${GOOD_NAME[S.me.makes]}.`);
  } else {
    toast(`${log.length} days passed. Your family ate on ${log.filter((r) => r.ate).length} of ${log.length} nights.`);
  }
  showBanners();
  renderHud();
}

function moneyBanner(g, before, report) {
  if (g < 0) return { kind: "money", g: before, title: `${cap(GOOD_NAME[before])} stopped being money`, text: "The town is bartering again. Watch what they start taking next." };
  const tenths = Math.round(report.accept[g] / 100);
  const share = tenths >= 10 ? "All" : `${tenths} in 10`;
  const swapped = before >= 0 ? `It replaced ${GOOD_NAME[before]}. ` : "";
  return { kind: "money", g, title: `${cap(GOOD_NAME[g])} is money now`, text: `${swapped}Nobody decided it. ${share} traders who never use ${GOOD_NAME[g]} take it anyway.` };
}

function showBanners() {
  if (S.showing || !S.banners.length) return;
  const b = S.banners.shift();
  const el = $("banner");
  el.className = `banner ${b.kind === "rain" ? "rain" : ""}`;
  el.innerHTML = `<h2>${b.g >= 0 ? pic(b.g) : ""}${b.title}</h2><p>${b.text}</p>`;
  S.showing = true;
  setTimeout(() => {
    el.classList.add("hidden");
    S.showing = false;
    showBanners();
  }, 4200);
}

let toastTimer = null;
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3600);
}

// ------------------------------------------------------------ HUD
function slotsHtml(sel = null) {
  const m = money();
  return S.me.bag
    .map((u, g) => {
      const cls = ["slot", u ? "" : "empty", g === S.me.needs ? "need" : "", g === m ? "money" : "", g === sel ? "sel" : ""].join(" ");
      const rot = S.town.spoil[g] ? `<span class="rot">-${S.town.spoil[g]}%</span>` : "";
      return `<button class="${cls}" data-g="${g}" title="${cap(GOOD_NAME[g])}: you have ${u}. Loses ${S.town.spoil[g]}% a night.">${pic(g)}<span class="n">${u}</span>${rot}</button>`;
    })
    .join("");
}

function renderHud() {
  const { town, me } = S;
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

  $("bag").innerHTML = slotsHtml();
  $("swaps").innerHTML = `Swaps today ${Array.from({ length: SWAPS_PER_DAY }, (_, k) => `<i class="${k < SWAPS_PER_DAY - me.swaps ? "used" : ""}"></i>`).join("")}`;
  const have = me.bag[me.needs] > 0;
  $("meal").innerHTML = `Tonight ${pic(me.needs)} ${have ? '<span class="ok">ready</span>' : '<span class="no">missing</span>'} <span class="dim">· fed ${me.fed}/${town.day}</span>`;
  renderErrand();
}

function renderErrand() {
  const { me, town } = S;
  const need = GOOD_NAME[me.needs];
  const have = me.bag[me.needs] > 0;
  const { path } = hints();
  let body;
  if (path === null) body = `<p>Nobody will trade toward ${need} today. Keep your swaps and try tomorrow.</p>`;
  else if (path.length === 0) body = `<p>You're set for tonight. Spare ${GOOD_NAME[me.makes]}? Swap it into what the town takes most and save it. It rots otherwise.</p>`;
  else {
    const chain = path.map((hop) => `<span class="arrow">→</span><span class="who">${town.agents[hop.traders[0]].role}</span>${pic(hop.get)}`).join("");
    body = `<p>Shortest way today: <b class="count">${path.length} swap${path.length > 1 ? "s" : ""}</b></p><div class="chainline">${pic(path[0].give)}${chain}</div><p class="dim">Gold <b style="color:var(--gold)">!</b> marks who to visit next.</p>`;
  }
  const bars = S.days
    .map((d, k) => {
      const hgt = d.need < 0 ? 100 : Math.max(12, (d.need / 4) * 100);
      const col = d.money >= 0 ? GOOD_COLOR[d.money] : "#44506e";
      return `<span style="height:${Math.min(100, hgt)}%;background:${col}" title="Day ${k + 1}: ${d.need < 0 ? "no way" : `${d.need} swaps`}"></span>`;
    })
    .join("");
  $("errand").innerHTML = `<h3>${pic(me.needs)} Your family needs 1 ${need} tonight ${have ? '<span class="ok">✓</span>' : ""}</h3>${body}<div class="mini">${bars}</div><div class="mini-label">Swaps needed each morning. Bar colour = the town's money that day.</div>`;
}

// ------------------------------------------------------------ screens
function introHtml(rules) {
  const role = rules.roles.find((r) => r.key === visitorRole(rules));
  const mk = GOOD_NAME[role.makes], nd = GOOD_NAME[role.needs];
  return [
    [role.makes, `You ${VERB[role.key]} ${MAKES_PER_DAY} ${mk} a day. ${cap(mk)} loses ${rules.goods[role.makes].spoil}% every night.`],
    [role.needs, `Your family needs 1 ${nd} every night. Walk up to traders and swap your way to it.`],
    [0, "Watch the goods above everyone's heads. When the whole town starts taking one good, they have invented money."],
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
  if (kind === "mystery") {
    const role = visitorRole(S.rules);
    toast(`Mystery town #${seed}. You're the ${role} here: ${GOOD_NAME[S.me.makes]} rots fastest in this town.`);
  }
}

function finish() {
  S.ended = true;
  const { me, town } = S;
  $("end-title").textContent = `Your family ate on ${me.fed} of ${SEASON} nights`;
  $("end-save").textContent = `Savings left: worth ${savings(town, me)} meals of ${GOOD_NAME[me.needs]}.`;
  const maxNeed = Math.max(4, ...S.days.map((d) => d.need));
  $("end-chart").innerHTML = S.days
    .map((d, k) => {
      const hgt = d.need < 0 ? 100 : Math.max(6, (d.need / maxNeed) * 100);
      const col = d.money >= 0 ? GOOD_COLOR[d.money] : "#44506e";
      return `<span class="${d.ate === false ? "hungry" : ""}" style="height:${hgt}%;background:${col}" title="Day ${k + 1}: ${d.need < 0 ? "no way" : `${d.need} swaps`}"></span>`;
    })
    .join("");
  const seen = [...new Set(S.days.map((d) => d.money))];
  $("end-legend").innerHTML = seen.map((g) => `<span><i style="background:${g >= 0 ? GOOD_COLOR[g] : "#44506e"}"></i>${g >= 0 ? `${GOOD_NAME[g]} was money` : "no money, pure barter"}</span>`).join("") + '<span><i style="background:transparent;outline:2px solid var(--bad)"></i>family went hungry</span>';
  const story = [];
  let prev = -1;
  town.history.forEach((h, d) => {
    if (h.money !== prev) {
      if (h.money >= 0) story.push(`Day ${d + 1}: ${GOOD_NAME[h.money]} became money${prev >= 0 ? `, replacing ${GOOD_NAME[prev]}` : ""}.`);
      else story.push(`Day ${d + 1}: ${GOOD_NAME[prev]} stopped being money.`);
      prev = h.money;
    }
  });
  $("end-story").textContent = `${story.join(" ")} Nobody decided any of it. Bar height is how many swaps your ${GOOD_NAME[me.needs]} took; colour is the town's money that day.`;
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
addEventListener("blur", () => held.clear());

// ------------------------------------------------------------ boot
setupView();
ICONS = GOOD_NAME.map((_, g) => iconURL(g, 4));
const dlMax = Math.max(...DL_PRICES);
$("dl").innerHTML = DL_PRICES.map((rp) => `<span class="${rp < 1000 ? "low" : ""}" style="height:${Math.max(3, (rp / dlMax) * 100)}%"></span>`).join("");
newGame("salt", 1);
showIntro(false);
// ?debug exposes the live state for automated play-throughs.
// run(ms) advances the clock by hand, for when the page is in a background tab.
if (new URLSearchParams(location.search).has("debug")) {
  window.mintless = {
    state: () => S,
    openTrade,
    sleep,
    run(ms) {
      let now = performance.now();
      for (const end = now + ms; now < end; now += 16) update(0.016, now);
      draw(now / 1000);
    },
  };
}
requestAnimationFrame(frame);
