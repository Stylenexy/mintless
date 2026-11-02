// Mintless: browser game. Same engine as the tests (../engine), no build step.
import { createTown, step, explain, holdingCost } from "../engine/town.js";
import { createPlayer, prices, bagValue, stockUp, spoilNight, seasonTable, planValue, bestTwoMoves } from "../engine/player.js";
import { SALT_TOWN } from "../rules/town.js";

const LOOK = [
  { icon: "🧂", name: "Salt", color: "var(--salt)" },
  { icon: "🐟", name: "Fish", color: "var(--fish)" },
  { icon: "🌾", name: "Rice", color: "var(--rice)" },
  { icon: "🧵", name: "Cloth", color: "var(--cloth)" },
  { icon: "🪵", name: "Wood", color: "var(--wood)" },
];
const ROLE_NAME = { saltmaker: "Saltmakers", fisher: "Fishers", farmer: "Farmers", weaver: "Weavers", logger: "Loggers" };
const START_BAG = { fish: 10, rice: 10, wood: 10 };
const DAY_MS = 1600;

// Diamond Lock, lowest seller price in rupiah (riset-track/growtopia-angka.md).
const DL = [
  ["2015", 185000], ["2016", 100000], ["2017", 45000], ["2018", 35000], ["2019", 26000], ["2020", 15800],
  ["2021", 10000], ["2022", 8000], ["2023", 4000], ["2024", 3700], ["2025", 3300], ["Nov 25", 501], ["Jun 26", 299],
];

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString("en-US");
let S = null; // game state
let timer = null;

// ---------------------------------------------------------------- intro
function drawDL() {
  const max = Math.max(...DL.map((d) => d[1]));
  $("dl-chart").innerHTML = DL.map(([yr, rp], i) => {
    const h = Math.max(1.5, (rp / max) * 100);
    const label = rp >= 1000 ? `${Math.round(rp / 1000)}k` : String(rp);
    return `<div class="dl-bar ${rp < 1000 ? "low" : ""}"><div class="val">${label}</div><div class="fill" style="height:${h}%;animation-delay:${i * 60}ms"></div><div class="yr">${yr}</div></div>`;
  }).join("");
}

// ---------------------------------------------------------------- setup
function variant(kind) {
  const rules = structuredClone(SALT_TOWN);
  if (kind === "dry") rules.events = [];
  if (kind === "swap") {
    rules.goods[0].spoil = SALT_TOWN.goods[3].spoil;
    rules.goods[3].spoil = SALT_TOWN.goods[0].spoil;
    rules.events = [];
  }
  return rules;
}

function newSeed() {
  const fromUrl = new URLSearchParams(location.search).get("seed");
  if (fromUrl && !S) return Number(fromUrl) >>> 0;
  return crypto.getRandomValues(new Uint32Array(1))[0] % 100000;
}

function startGame(kind = "rain", seed = newSeed()) {
  stopPlay();
  const rules = variant(kind);
  const town = createTown(rules, seed);
  const player = createPlayer(rules, START_BAG);
  const table = seasonTable(createTown(rules, seed), rules.seasonDays, step);
  S = {
    kind, seed, rules, town, player, table,
    startValue: bagValue(player, prices(town)),
    lastMoney: -1, lastHolds: town.agents.map((a) => a.holds), lastRot: rules.goods.map(() => 0),
    log: [],
  };
  note(`Day 0. You arrive with ${fmt(START_BAG.fish)} fish, ${fmt(START_BAG.rice)} rice and ${fmt(START_BAG.wood)} wood. The town has no money.`);
  const ev = rules.events[0];
  if (ev) note(`The public calendar says: on day ${ev.day} the rainy season starts and ${LOOK[ev.good].name.toLowerCase()} spoils ${ev.spoil}% a day.`);
  $("intro").classList.add("hidden");
  $("end").classList.add("hidden");
  $("game").classList.remove("hidden");
  buildCards();
  buildTown();
  renderRules();
  render();
}

// ---------------------------------------------------------------- actions
function note(html) {
  S.log.push(`<li>${html}</li>`);
}

function buy(good, share) {
  if (S.town.day >= S.rules.seasonDays) return;
  const before = S.player.bag.slice();
  const got = stockUp(S.player, S.town, good, share);
  if (got === 0) return;
  const gave = before.map((b, g) => (g === good ? 0 : b - S.player.bag[g])).map((n, g) => (n > 0 ? `${n} ${LOOK[g].name.toLowerCase()}` : "")).filter(Boolean).join(", ");
  note(`Day ${S.town.day}: swapped ${gave} for <b>${got} ${LOOK[good].name.toLowerCase()}</b>.`);
  render();
}

function advance() {
  if (S.town.day >= S.rules.seasonDays) return finish();
  S.lastHolds = S.town.agents.map((a) => a.holds);
  const report = step(S.town);
  S.lastRot = spoilNight(S.player, S.town);
  const rot = S.lastRot.map((n, g) => (n > 0 ? `${n} ${LOOK[g].name.toLowerCase()}` : "")).filter(Boolean);
  if (rot.length) note(`Night ${S.town.day}: ${rot.join(", ")} spoiled in your bag.`);
  const ev = S.rules.events.find((e) => e.day === S.town.day);
  if (ev) note(`<b>Day ${ev.day}: the rains came.</b> ${LOOK[ev.good].name} now spoils ${ev.spoil}% a day, for everyone.`);
  if (report.money !== S.lastMoney) {
    if (report.money === -1) note(`Day ${S.town.day}: ${LOOK[S.lastMoney].name.toLowerCase()} lost its place. The town is bartering again.`);
    else note(`<b>Day ${S.town.day}: ${LOOK[report.money].name} is now the town's money.</b> Nobody declared it.`);
    S.lastMoney = report.money;
  }
  render(true);
  if (S.town.day >= S.rules.seasonDays) {
    stopPlay();
    setTimeout(finish, 900);
  }
}

function fastForward(days = 7) {
  stopPlay();
  let left = Math.min(days, S.rules.seasonDays - S.town.day);
  const tick = () => {
    if (left-- <= 0) return;
    advance();
    if (left > 0 && S.town.day < S.rules.seasonDays) setTimeout(tick, 140);
  };
  tick();
}

function togglePlay() {
  if (timer) return stopPlay();
  timer = setInterval(advance, DAY_MS);
  $("play").textContent = "⏸ Pause";
}

function stopPlay() {
  if (timer) clearInterval(timer);
  timer = null;
  $("play").textContent = "▶ Play";
}

// ---------------------------------------------------------------- render
function buildCards() {
  $("cards").innerHTML = LOOK.map((l, g) => `
    <div class="card" id="card-${g}" style="--c:${l.color}">
      <span class="crown hidden" id="crown-${g}">👑</span>
      <div class="icon">${l.icon}</div>
      <div class="name">${l.name}</div>
      <div><span class="price" id="price-${g}">0</span> <span class="trend" id="trend-${g}"></span></div>
      <div class="meta" id="accept-${g}"></div>
      <div class="meter"><span id="meter-${g}"></span></div>
      <div class="meta" id="spoil-${g}"></div>
      <div class="buys">
        <button class="btn" data-buy="${g}" data-share="50" title="Swap half of your other goods into ${l.name.toLowerCase()}">Half</button>
        <button class="btn all" data-buy="${g}" data-share="100" title="Swap everything else into ${l.name.toLowerCase()}">All in</button>
      </div>
    </div>`).join("");
}

function buildTown() {
  $("town").innerHTML = S.rules.roles.map((role) => {
    const toks = S.town.agents.map((a, i) => (a.role === role.key ? `<div class="tok" id="tok-${i}" data-agent="${i}"></div>` : "")).join("");
    return `<div class="role-group"><div class="role">${ROLE_NAME[role.key]}<br><span class="dim">make ${LOOK[role.makes].icon} · need ${LOOK[role.needs].icon}</span></div><div class="toks">${toks}</div></div>`;
  }).join("");
}

function render(animate = false) {
  const { town, player, table } = S;
  const p = prices(town);
  const prev = town.day > 0 ? table.price[town.day - 1] : p;
  const h = town.history[town.history.length - 1];

  $("day").textContent = town.day;
  const money = $("money");
  if (h.money === -1) {
    money.textContent = "No money yet: traders still barter";
    money.classList.remove("crowned");
  } else {
    money.innerHTML = `Town money: ${LOOK[h.money].icon} ${LOOK[h.money].name} <span class="dim">(${Math.round(h.accept[h.money] / 10)}% would take it)</span>`;
    money.classList.add("crowned");
    money.style.setProperty("--crown", LOOK[h.money].color);
  }

  const ev = S.rules.events[0];
  const cal = $("calendar");
  if (!ev) cal.textContent = "Public calendar: no rule changes this season.";
  else if (town.day < ev.day) cal.innerHTML = `Public calendar: rainy season in <b>${ev.day - town.day} day${ev.day - town.day === 1 ? "" : "s"}</b> (day ${ev.day}). From then ${LOOK[ev.good].name.toLowerCase()} spoils ${ev.spoil}% a day.`;
  else cal.innerHTML = `Rainy season: ${LOOK[ev.good].name.toLowerCase()} now spoils ${ev.spoil}% a day.`;
  cal.classList.toggle("now", !!ev && town.day >= ev.day);

  LOOK.forEach((l, g) => {
    $(`price-${g}`).textContent = p[g];
    const d = p[g] - prev[g];
    const tr = $(`trend-${g}`);
    tr.textContent = d === 0 ? "" : `${d > 0 ? "▲" : "▼"}${Math.abs(d)}`;
    tr.className = `trend ${d > 0 ? "up" : "down"}`;
    $(`accept-${g}`).textContent = `${Math.round(h.accept[g] / 10)}% of traders would take it`;
    $(`meter-${g}`).style.width = `${h.accept[g] / 10}%`;
    $(`spoil-${g}`).textContent = `spoils ${town.spoil[g]}% a day`;
    $(`card-${g}`).classList.toggle("money-good", h.money === g);
    $(`crown-${g}`).classList.toggle("hidden", h.money !== g);
  });

  $("bag").innerHTML = LOOK.map((l, g) => `
    <div class="bag-row"><span>${l.icon}</span><span>${l.name}</span><span class="units">${player.bag[g]}</span>
    <span class="rot">${S.lastRot[g] ? `−${S.lastRot[g]}` : ""}</span></div>`).join("");
  const v = bagValue(player, p);
  $("value").textContent = fmt(v);
  const change = Math.round(((v - S.startValue) / S.startValue) * 100);
  const delta = $("delta");
  delta.textContent = `${change >= 0 ? "+" : ""}${change}% since day 0`;
  delta.className = `delta mono ${change >= 0 ? "up" : "down"}`;
  $("log").innerHTML = S.log.slice(-40).reverse().join("");

  town.agents.forEach((a, i) => {
    const el = $(`tok-${i}`);
    el.textContent = LOOK[a.holds].icon;
    el.style.background = `color-mix(in srgb, ${LOOK[a.holds].color} 22%, transparent)`;
    if (animate && S.lastHolds[i] !== a.holds) {
      el.classList.add("traded");
      setTimeout(() => el.classList.remove("traded"), 450);
    }
  });

  drawChart();
  const over = town.day >= S.rules.seasonDays;
  for (const b of document.querySelectorAll("[data-buy]")) b.disabled = over;
  $("next").disabled = over;
  $("ff").disabled = over;
  $("play").disabled = over;
}

function drawChart() {
  const { town, table, rules } = S;
  const W = 600, H = 180, days = rules.seasonDays;
  const x = (d) => (d / days) * W;
  const y = (v) => H - (v / 100) * (H - 10) - 5;
  let svg = "";
  for (const v of [25, 50, 75]) svg += `<line x1="0" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,0.06)"/>`;
  const ev = rules.events[0];
  if (ev) svg += `<line x1="${x(ev.day)}" x2="${x(ev.day)}" y1="0" y2="${H}" stroke="rgba(255,92,122,0.5)" stroke-dasharray="4 4"/><text x="${x(ev.day) + 4}" y="12" fill="#ff8fa3" font-size="11" font-family="Nunito">rain</text>`;
  LOOK.forEach((l, g) => {
    const pts = [];
    for (let d = 0; d <= town.day; d++) pts.push(`${x(d).toFixed(1)},${y(table.price[d][g]).toFixed(1)}`);
    svg += `<polyline points="${pts.join(" ")}" fill="none" stroke="${l.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
    const last = pts[pts.length - 1].split(",");
    svg += `<text x="${Math.min(W - 18, Number(last[0]) + 4)}" y="${Number(last[1]) + 4}" font-size="13">${l.icon}</text>`;
  });
  $("chart").innerHTML = svg;
}

// ---------------------------------------------------------------- tooltip
function showTip(e) {
  const i = e.target.dataset.agent;
  if (i === undefined) return hideTip();
  const a = S.town.agents[i];
  const others = LOOK.map((_, g) => g).filter((g) => g !== a.holds && g !== a.needs);
  const lines = others.map((g) => {
    const r = explain(S.town, a, g);
    const ratio = r.worthHeld === 0 ? "∞" : `${Math.round((r.worthOffered / r.worthHeld) * 100)}%`;
    return `${LOOK[g].icon} ${r.take ? "<b>yes</b>" : "no"}: seen taken ${Math.round(r.memoryOffered / 10)}%, holding cost ${r.costOffered} → worth ${ratio} of mine`;
  });
  const tip = $("tooltip");
  tip.innerHTML = `<div><b>${ROLE_NAME[a.role].slice(0, -1)}</b> · needs ${LOOK[a.needs].icon} · holds ${LOOK[a.holds].icon}</div>
    <div class="small">Takes a good it doesn't need only if it is worth more than ${100 + S.rules.trader.doubt}% of what it holds (worth = how often it saw people take it ÷ holding cost ${holdingCost(S.town, a.holds)}).</div>
    <div style="margin-top:6px">${lines.join("<br>")}</div>`;
  tip.classList.remove("hidden");
  const r = e.target.getBoundingClientRect();
  tip.style.left = `${Math.min(window.innerWidth - 310, r.left)}px`;
  tip.style.top = `${r.bottom + 8}px`;
}
function hideTip() {
  $("tooltip").classList.add("hidden");
}

// ---------------------------------------------------------------- end
function finish() {
  stopPlay();
  const { table, player, rules } = S;
  const start = rules.goods.map((g) => START_BAG[g.key] ?? 0);
  const you = bagValue(player, table.price[rules.seasonDays]);
  const idle = planValue(table, start, []);
  const best = bestTwoMoves(table, start);
  const ratio = best.value > 0 ? you / best.value : 0;
  const grade = ratio >= 0.8 ? "Market sage" : ratio >= 0.5 ? "Sharp trader" : you >= S.startValue ? "You kept your shirt" : "Caught by the season";
  $("grade").textContent = grade;
  $("s-you").textContent = fmt(you);
  $("s-idle").textContent = fmt(idle);
  $("s-best").textContent = fmt(best.value);
  $("best-line").innerHTML = best.moves.length
    ? `Best two moves in this town: ${best.moves.map((m) => `all in ${LOOK[m.to].icon} ${LOOK[m.to].name.toLowerCase()} on day ${m.day}`).join(", then ")}.`
    : "Doing nothing was the best you could do.";
  const ev = rules.events[0];
  const heldOld = ev && player.bag[ev.good] * table.price[rules.seasonDays][ev.good] > you / 2;
  $("moral").textContent = heldOld
    ? "You kept the old money through the rain. In Growtopia that was holding Diamond Locks in 2017. The difference here: the rain was on a public calendar from day 0, and nobody printed anything."
    : "Money is whatever everyone will take. Here the rules that decide it are public, and nobody can print more of it.";
  $("game").classList.add("hidden");
  $("end").classList.remove("hidden");
}

// ---------------------------------------------------------------- rules drawer
async function renderRules() {
  const r = S.rules;
  const items = [
    ...r.goods.map((g, i) => `${LOOK[i].icon} ${LOOK[i].name} spoils ${g.spoil}% a day (holding cost ${r.trader.baseCost + g.spoil}).`),
    `Five roles, eight traders each. Every role makes one good and needs another: ${r.roles.map((x) => `${LOOK[x.makes].icon}→needs ${LOOK[x.needs].icon}`).join(", ")}. Nobody wants what their neighbour wants, so pure barter feeds no one.`,
    `A trader takes a good she doesn't need only if its worth (how often she saw people take it ÷ holding cost) beats what she holds by more than ${r.trader.doubt}%.`,
    `After each meeting she moves her notebook 1/${2 ** r.trader.memoryShift} of the way towards what the other trader was willing to take.`,
    `${r.market.roundsPerDay} meetings per trader per day. A good is money when ${r.moneyThreshold / 10}% of traders who don't need it would still take it.`,
    ...r.events.map((e) => `Day ${e.day}: ${LOOK[e.good].name.toLowerCase()} starts to spoil ${e.spoil}% a day.`),
    `Town seed ${S.seed}: the only randomness is who meets whom. Same seed, same town.`,
  ];
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(r)));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  items.push(`Rules fingerprint (sha256 of the rules object): <span class="mono">${hex.slice(0, 16)}…</span>`);
  $("rules-list").innerHTML = items.map((t) => `<li>${t}</li>`).join("");
}

// ---------------------------------------------------------------- wiring
drawDL();
$("start").onclick = () => startGame("rain");
$("play").onclick = togglePlay;
$("next").onclick = () => { stopPlay(); advance(); };
$("ff").onclick = () => fastForward(7);
$("again").onclick = () => startGame(S.kind);
$("replay").onclick = () => startGame(S.kind, S.seed);
$("rules-btn").onclick = () => $("rules").classList.remove("hidden");
$("rules-close").onclick = () => $("rules").classList.add("hidden");
$("whatif-go").onclick = () => {
  const kind = document.querySelector("input[name=whatif]:checked").value;
  $("rules").classList.add("hidden");
  startGame(kind);
};
$("cards").addEventListener("click", (e) => {
  const b = e.target.closest("[data-buy]");
  if (b) buy(Number(b.dataset.buy), Number(b.dataset.share));
});
$("town").addEventListener("mouseover", showTip);
$("town").addEventListener("mouseout", hideTip);
document.addEventListener("keydown", (e) => {
  if (!S || $("game").classList.contains("hidden")) return;
  if (e.code === "Space") { e.preventDefault(); togglePlay(); }
  if (e.key === "n" || e.key === "N") { stopPlay(); advance(); }
  if (e.key === "f" || e.key === "F") fastForward(7);
});
