// The player's household: a fisher with a bag, a chest at home, a family to
// feed and things worth saving for. Shops take only what the town takes most,
// so savings live or die with the town's money. Nothing here creates goods
// except the catch, and spending removes units for good.

import { step } from "./town.js";
import { spoilNight, prices } from "./player.js";
import { createVisitor, shortestPath, offer, answer } from "./visitor.js";

export const BAG_MAX = 20;
export const HEARTS = 5;
export const CASTS_PER_DAY = 3;
export const TRADES_PER_DAY = 8;

export const CATALOG = [
  { key: "boots", name: "Fast boots", cost: 4, what: "Run half again as fast", kind: "tool" },
  { key: "boat", name: "Bigger boat", cost: 8, what: "2 more casts a day", kind: "tool" },
  { key: "icebox", name: "Ice box", cost: 8, what: "Your chest spoils at half the rate", kind: "tool" },
  { key: "hat", name: "Straw hat", cost: 5, what: "Yours for every season", kind: "skin" },
  { key: "cape", name: "Sky cape", cost: 7, what: "Yours for every season", kind: "skin" },
  { key: "crown", name: "Salt crown", cost: 20, what: "Proof you saved through a crash", kind: "skin" },
];

export function createHomestead(rules, owned = {}) {
  const v = createVisitor(rules, "fisher", 3);
  v.chest = rules.goods.map(() => 0);
  v.chestCarry = rules.goods.map(() => 0);
  v.swaps = TRADES_PER_DAY;
  v.casts = CASTS_PER_DAY;
  v.hearts = HEARTS;
  v.owned = { ...owned };
  return v;
}

export const castsPerDay = (v) => CASTS_PER_DAY + (v.owned.boat ? 2 : 0);
export const bagCount = (v) => v.bag.reduce((a, b) => a + b, 0);

// Timing score 0..100 decides the catch. Skill only, no dice.
export function fishYield(score) {
  return score >= 90 ? 3 : score >= 60 ? 2 : score >= 25 ? 1 : 0;
}

export function cast(v, score) {
  if (v.casts <= 0) return { ok: false, kind: "tired", got: 0 };
  v.casts--;
  const got = Math.min(fishYield(score), BAG_MAX - bagCount(v));
  v.bag[v.makes] += got;
  return { ok: true, got };
}

export function store(v, good, units = 1) {
  const n = Math.min(units, v.bag[good]);
  v.bag[good] -= n;
  v.chest[good] += n;
  return n;
}

export function take(v, good, units = 1) {
  const n = Math.min(units, v.chest[good], BAG_MAX - bagCount(v));
  v.chest[good] -= n;
  v.bag[good] += n;
  return n;
}

// The good shops take today: whichever the town accepts most.
export function shopGood(town) {
  const { accept } = town.history[town.history.length - 1];
  return accept.indexOf(Math.max(...accept));
}

export function buy(town, v, key) {
  const item = CATALOG.find((c) => c.key === key);
  if (!item) return { ok: false, kind: "unknown" };
  if (v.owned[key]) return { ok: false, kind: "owned" };
  const g = shopGood(town);
  if (v.bag[g] + v.chest[g] < item.cost) return { ok: false, kind: "poor", good: g };
  const fromBag = Math.min(v.bag[g], item.cost);
  v.bag[g] -= fromBag;
  v.chest[g] -= item.cost - fromBag;
  v.owned[key] = true;
  return { ok: true, good: g, cost: item.cost };
}

// What everything you own is worth at today's prices.
export function worthNow(town, v) {
  const p = prices(town);
  return v.bag.reduce((sum, units, g) => sum + (units + v.chest[g]) * p[g], 0);
}

// Night: the family eats, stock spoils, the town trades until morning.
export function nightFall(town, v) {
  const before = town.history[town.history.length - 1];
  let ate = true;
  if (v.bag[v.needs] > 0) v.bag[v.needs]--;
  else if (v.chest[v.needs] > 0) v.chest[v.needs]--;
  else ate = false;
  if (ate) {
    v.fed++;
    v.hearts = Math.min(HEARTS, v.hearts + 1);
  } else {
    v.hungry++;
    v.hearts--;
  }
  const lost = spoilNight(v, town);
  const box = { bag: v.chest, carry: v.chestCarry };
  const chestRate = v.owned.icebox ? town.spoil.map((s) => s >> 1) : town.spoil;
  const lostChest = spoilNight(box, { spoil: chestRate });
  const report = step(town);
  v.swaps = TRADES_PER_DAY;
  v.casts = castsPerDay(v);
  return { ate, lost, lostChest, report, newMoney: report.money !== before.money ? report.money : null };
}

// One day played by the book, for "skip days" and tests: fish decently, secure
// tonight's need, then turn spare catch into what the shops take.
export function autoDay(town, v, score = 60) {
  while (v.casts > 0) cast(v, score);
  while (v.swaps > 0) {
    const path = shortestPath(town, v);
    if (!path || path.length === 0) break;
    offer(town, v, path[0].traders[0], path[0].give);
  }
  const g = shopGood(town);
  for (let i = 0; i < town.agents.length && v.swaps > 0 && v.bag[v.makes] > 0; i++) {
    const ag = town.agents[i];
    if (ag.holds === g && answer(town, ag, v.makes).yes) offer(town, v, i, v.makes);
  }
  const spare = v.bag[g] - (g === v.needs ? 1 : 0);
  if (spare > 0) store(v, g, spare);
}

// Move savings from one good into another through the town's traders.
export function moveSavings(town, v, from, to) {
  let moved = 0;
  for (let i = 0; i < town.agents.length && v.swaps > 0; i++) {
    if (v.bag[from] === 0 && v.chest[from] > 0) take(v, from, 4);
    if (v.bag[from] === 0) break;
    const ag = town.agents[i];
    if (ag.holds === to && answer(town, ag, from).yes && offer(town, v, i, from).ok) moved++;
  }
  return moved;
}
