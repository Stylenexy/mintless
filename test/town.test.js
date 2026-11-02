// SPK-G1: does money emerge on its own, deterministically, and does changing
// one rule change which good becomes money? Every claim in the README is
// checked here over many seeds, not one lucky run.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createTown, step, run, stateHash } from "../engine/town.js";
import { SALT_TOWN } from "../rules/town.js";

const SALT = 0;
const CLOTH = 3;
const SEEDS = 500;
const RAIN_DAY = SALT_TOWN.events[0].day;

const noEvents = (rules) => ({ ...structuredClone(rules), events: [] });

function firstMoneyDay(rules, seed, days, good) {
  const town = createTown(rules, seed);
  for (let d = 0; d < days; d++) {
    const r = step(town);
    if (r.money === good) return r.day;
  }
  return -1;
}

test("same seed, same town: the simulation is deterministic", () => {
  const a = run(createTown(SALT_TOWN, 42), 30);
  const b = run(createTown(SALT_TOWN, 42), 30);
  const c = run(createTown(SALT_TOWN, 43), 30);
  assert.equal(stateHash(a), stateHash(b));
  assert.deepEqual(a.history, b.history);
  assert.notEqual(stateHash(a), stateHash(c));
});

test("salt becomes money by day 14 in every one of 500 towns", () => {
  const rules = noEvents(SALT_TOWN);
  const days = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const d = firstMoneyDay(rules, seed, 30, SALT);
    assert.ok(d !== -1 && d <= 14, `seed ${seed}: salt became money on day ${d}`);
    days.push(d);
  }
  days.sort((x, y) => x - y);
  console.log(`  salt is money: median day ${days[SEEDS >> 1]}, latest day ${days[SEEDS - 1]}`);
});

test("without a rule change, salt stays money through day 60", () => {
  const rules = noEvents(SALT_TOWN);
  for (let seed = 1; seed <= SEEDS; seed++) {
    const town = createTown(rules, seed);
    run(town, 60);
    const fromDay = town.history.findIndex((r) => r.money === SALT);
    const after = town.history.slice(fromDay + 3);
    assert.ok(after.every((r) => r.money === SALT), `seed ${seed}: salt lost its place before day 60`);
  }
});

test("one rule change (salt turns damp on day 16) makes cloth the money within 7 days", () => {
  const lags = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const town = createTown(SALT_TOWN, seed);
    run(town, 40);
    const h = town.history;
    assert.equal(h[RAIN_DAY - 1].money, SALT, `seed ${seed}: salt was not money before the rain`);
    const switchDay = h.findIndex((r) => r.day > RAIN_DAY && r.money === CLOTH);
    assert.ok(switchDay !== -1 && switchDay - RAIN_DAY <= 7, `seed ${seed}: cloth took over on day ${switchDay}`);
    assert.ok(h.slice(switchDay).every((r) => r.money !== SALT), `seed ${seed}: salt came back`);
    lags.push(switchDay - RAIN_DAY);
  }
  lags.sort((x, y) => x - y);
  console.log(`  cloth replaces salt: median ${lags[SEEDS >> 1]} days after the rain, slowest ${lags[SEEDS - 1]}`);
});

test("money follows the rules, not a label: swap salt's and cloth's spoil rates and cloth wins", () => {
  const rules = noEvents(SALT_TOWN);
  rules.goods[SALT].spoil = SALT_TOWN.goods[CLOTH].spoil;
  rules.goods[CLOTH].spoil = SALT_TOWN.goods[SALT].spoil;
  for (let seed = 1; seed <= SEEDS; seed++) {
    assert.ok(firstMoneyDay(rules, seed, 30, CLOTH) !== -1, `seed ${seed}: cloth did not become money`);
    assert.equal(firstMoneyDay(rules, seed, 30, SALT), -1, `seed ${seed}: salt still became money`);
  }
});

test("if every good spoils alike, the town still picks a money, and history decides which", () => {
  const rules = noEvents(SALT_TOWN);
  for (const g of rules.goods) g.spoil = 4;
  const winners = new Map();
  for (let seed = 1; seed <= SEEDS; seed++) {
    const town = createTown(rules, seed);
    run(town, 60);
    const first = town.history.find((r) => r.money !== -1);
    assert.ok(first, `seed ${seed}: no money emerged in 60 days`);
    winners.set(first.money, (winners.get(first.money) ?? 0) + 1);
  }
  console.log(`  winners by good: ${JSON.stringify(Object.fromEntries(winners))}`);
  assert.equal(winners.size, rules.goods.length, "every good should win in some town");
});

test("pure barter feeds nobody; money feeds the town", () => {
  const barter = structuredClone(SALT_TOWN);
  barter.trader.doubt = 1_000_000; // nobody ever takes a good they do not need
  const fed = (rules) => createTown(rules, 1) && run(createTown(rules, 1), 30).history.reduce((s, r) => s + r.fedToday, 0);
  const withBarter = fed(barter);
  const withMoney = fed(SALT_TOWN);
  console.log(`  needs met in 30 days: pure barter ${withBarter}, with money ${withMoney}`);
  assert.equal(withBarter, 0);
  assert.ok(withMoney >= 300);
});

test("the engine never names a good: nothing is hard-coded as money", () => {
  const src = readFileSync(new URL("../engine/town.js", import.meta.url), "utf8").toLowerCase();
  for (const g of SALT_TOWN.goods) assert.ok(!new RegExp(`\\b${g.key}\\b`).test(src), `engine mentions "${g.key}"`);
});
