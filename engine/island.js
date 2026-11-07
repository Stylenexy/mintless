// One run: you wash up on an island with no coins and a broken boat. Fish,
// swap, and pay the shipwright in whatever the town takes most, before the
// tenth night. Each night the town trades for three of its own days, so money
// is born around day 2, the storm lands after day 6 and a new money rises
// before the end. Nothing here creates goods except the catch; swaps only move
// units between hands, and paying the shipwright destroys them.

import { step } from "./town.js";
import { spoilNight, prices } from "./player.js";
import { createVisitor, answer, offer, shortestPath } from "./visitor.js";

export const DAYS = 10;
export const TOWN_DAYS_PER_NIGHT = 3;
export const FIRST_FISH = 1;

// What the boat needs, in order. Prices are in units of the town's money, so
// the same hull costs 3 salt today and 3 cloth after the money moves.
export const PARTS = [
  { key: "hull", name: "Hull", cost: 4 },
  { key: "mast", name: "Mast", cost: 6 },
  { key: "sail", name: "Sail", cost: 8 },
  { key: "rudder", name: "Rudder", cost: 10 },
];
export const GEAR = [
  { key: "duck", name: "Duck saddle", cost: 1, what: "Ride, and cross water" },
  { key: "rod", name: "Long rod", cost: 3, what: "+1 fish on every catch" },
];

export function createRun(rules, keep = {}, { firstVoyage = false } = {}) {
  const v = createVisitor(rules, { key: "castaway", makes: 1, needs: 0 }, 0);
  v.swaps = Infinity;
  v.parts = 0;
  v.gear = {};
  v.firstVoyage = firstVoyage;
  v.keep = { ...keep };
  v.caught = 0;
  v.spent = rules.goods.map(() => 0);
  return v;
}

export const bagCount = (v) => v.bag.reduce((a, b) => a + b, 0);

// Skill decides the catch, no dice: score 0..100 from the cast, the strike and
// the fight.
export function fishYield(score, gear = {}) {
  const base = score >= 85 ? 3 : score >= 55 ? 2 : score >= 20 ? 1 : 0;
  return base && gear.rod ? base + 1 : base;
}

export function catchFish(v, score, bonus = 0) {
  const base = fishYield(score, v.gear);
  const got = base ? base + bonus : 0;
  v.bag[v.makes] += got;
  v.caught += got;
  return got;
}

// Every good this trader would take from your bag right now.
export function givesFor(town, v, index) {
  const agent = town.agents[index];
  return v.bag.map((u, g) => (u > 0 && answer(town, agent, g).yes ? g : -1)).filter((g) => g >= 0);
}

// The good the shipwright takes today: whichever the town accepts most.
export function shopGood(town) {
  const { accept } = town.history[town.history.length - 1];
  return accept.indexOf(Math.max(...accept));
}

// Someone's first island pays about half and has no deadline, so nobody's first run
// ends with the boat on the sand. Every island after that pays in full.
export const partCost = (v, part) => (v.firstVoyage ? Math.ceil(part.cost * 0.6) : part.cost);
export const nextPart = (v) => (PARTS[v.parts] ? { ...PARTS[v.parts], cost: partCost(v, PARTS[v.parts]) } : null);
export const boatDone = (v) => v.parts >= PARTS.length;

function pay(town, v, cost) {
  const g = shopGood(town);
  if (v.bag[g] < cost) return { ok: false, kind: "poor", good: g, cost };
  v.bag[g] -= cost;
  v.spent[g] += cost;
  return { ok: true, good: g, cost };
}

export function buyPart(town, v) {
  const part = nextPart(v);
  if (!part) return { ok: false, kind: "done" };
  const res = pay(town, v, part.cost);
  if (res.ok) v.parts++;
  return { ...res, part };
}

export function buyGear(town, v, key) {
  const item = GEAR.find((c) => c.key === key);
  if (!item) return { ok: false, kind: "unknown" };
  if (v.gear[key]) return { ok: false, kind: "owned" };
  const res = pay(town, v, item.cost);
  if (res.ok) v.gear[key] = true;
  return { ...res, item };
}

// Which good to hand this trader: from everything they would take and you
// carry, give what rots fastest. -1 when nothing fits.
export function bestGive(town, v, index) {
  const agent = town.agents[index];
  let best = -1;
  for (let g = 0; g < v.bag.length; g++) {
    if (v.bag[g] <= 0 || !answer(town, agent, g).yes) continue;
    if (best === -1 || town.spoil[g] > town.spoil[best]) best = g;
  }
  return best;
}


// The shortest chain of swaps from your bag to `goal`, ignoring what you
// already hold of it.
export function routeTo(town, v, goal) {
  const bag = v.bag.slice();
  bag[goal] = 0;
  return shortestPath(town, { needs: goal }, bag);
}

export const worthNow = (town, v) => {
  const p = prices(town);
  return v.bag.reduce((sum, units, g) => sum + units * p[g], 0);
};

// What your bag buys at the shipyard today, in units of the town's money.
export const spendable = (town, v) => v.bag[shopGood(town)];

// Night: stock spoils and the town trades three days. Returns what changed.
// Swaps with a visitor last until dusk: every trader goes back to what they
// held at dawn, so the town's path depends only on its rules and seed, and the
// contract can recompute the shipyard's good for any morning.
export function nightFall(town, v, others = []) {
  const before = town.history[town.history.length - 1];
  town.agents.forEach((a, i) => (a.holds = town.dawn ? town.dawn[i] : a.makes));
  const lost = v.bag.map(() => 0);
  const reports = [];
  for (let i = 0; i < TOWN_DAYS_PER_NIGHT; i++) {
    spoilNight(v, town).forEach((u, g) => (lost[g] += u));
    for (const o of others) spoilNight(o, town);
    reports.push(step(town));
  }
  town.dawn = town.agents.map((a) => a.holds);
  const report = reports[reports.length - 1];
  return { lost, report, reports, newMoney: report.money !== before.money ? report.money : null };
}

// A walking route runs you to the nearest road junction first. When that
// junction is behind you, or past the goal, the dots would double back, so skip it.
export function trimRoute(route) {
  const fold = (a, b, c) => (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0;
  const r = route.slice();
  while (r.length > 2 && fold(r[0], r[1], r[2])) r.splice(1, 1);
  while (r.length > 2 && fold(r[r.length - 3], r[r.length - 2], r[r.length - 1])) r.splice(r.length - 2, 1);
  return r;
}

// A sensible day, for tests and balance: `casts` catches at `score`, walk the
// route to the shipyard's good, pay for whatever you can.
export function playDay(town, v, { casts = 4, score = 60, swaps = 10 } = {}) {
  for (let i = 0; i < casts; i++) catchFish(v, score);
  for (let n = 0; n < swaps; n++) {
    const goal = shopGood(town);
    const path = routeTo(town, v, goal);
    if (!path || path.length === 0) break;
    const hop = path[0];
    if (!offer(town, v, hop.traders[0], hop.give).ok) break;
  }
  if (!v.gear.duck) buyGear(town, v, "duck");
  while (buyPart(town, v).ok);
}
