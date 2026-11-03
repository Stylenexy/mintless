// The player as trader number 41: swaps follow the town's own rule, never
// create goods, and the barter path to the family's need shrinks once the
// town has money.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTown, willTake } from "../engine/town.js";
import { SALT_TOWN } from "../rules/town.js";
import { mysteryRules } from "../engine/mystery.js";
import { createVisitor, visitorRole, answer, offer, shortestPath, autoTrade, endDay, swapsNeeded, wantsOf, SWAPS_PER_DAY } from "../engine/visitor.js";

const SALT = 0, FISH = 1, RICE = 2, CLOTH = 3, WOOD = 4;

function units(town, visitor) {
  const count = visitor.bag.slice();
  for (const ag of town.agents) count[ag.holds]++;
  return count;
}

test("in Salt Town the visitor is the fisher: fish spoils fastest", () => {
  assert.equal(visitorRole(SALT_TOWN), "fisher");
  const v = createVisitor(SALT_TOWN, "fisher");
  assert.equal(v.makes, FISH);
  assert.equal(v.needs, SALT);
});

test("traders answer the visitor with their own rule", () => {
  const town = createTown(SALT_TOWN, 1);
  for (const ag of town.agents) {
    for (let g = 0; g < 5; g++) {
      const a = answer(town, ag, g);
      if (g === ag.holds) assert.equal(a.kind, "same");
      else assert.equal(a.yes, willTake(town, ag, g));
    }
  }
});

test("the bubble lists exactly what a trader would take", () => {
  const town = createTown(SALT_TOWN, 3);
  for (let d = 0; d < 6; d++) {
    for (const ag of town.agents) {
      const wants = wantsOf(town, ag);
      for (let g = 0; g < 5; g++) assert.equal(wants.includes(g), answer(town, ag, g).yes);
      if (ag.holds !== ag.needs) assert.ok(wants.includes(ag.needs), "a trader always takes what they need");
    }
    endDay(town, createVisitor(SALT_TOWN, "fisher"));
  }
});

test("a swap moves goods and never creates them", () => {
  const town = createTown(SALT_TOWN, 1);
  const v = createVisitor(SALT_TOWN, "fisher");
  const before = units(town, v);
  const farmer = town.agents.findIndex((ag) => ag.role === "farmer");
  const res = offer(town, v, farmer, FISH);
  assert.equal(res.ok, true);
  assert.equal(res.kind, "need");
  assert.equal(res.got, RICE);
  assert.deepEqual(units(town, v), before);
  assert.equal(v.swaps, SWAPS_PER_DAY - 1);
  assert.equal(offer(town, v, farmer, SALT).kind, "empty");
});

test("swaps per day are limited", () => {
  const town = createTown(SALT_TOWN, 1);
  const v = createVisitor(SALT_TOWN, "fisher", 9);
  const farmers = town.agents.map((ag, i) => (ag.role === "farmer" ? i : -1)).filter((i) => i >= 0);
  for (let k = 0; k < SWAPS_PER_DAY; k++) assert.equal(offer(town, v, farmers[k], FISH).ok, true);
  assert.equal(offer(town, v, farmers[SWAPS_PER_DAY], FISH).kind, "tired");
});

test("day 0 is pure barter: fish reaches salt only the long way round", () => {
  const town = createTown(SALT_TOWN, 1);
  const v = createVisitor(SALT_TOWN, "fisher");
  const path = shortestPath(town, v);
  assert.deepEqual(path.map((h) => h.get), [RICE, CLOTH, WOOD, SALT]);
  assert.deepEqual(path.map((h) => town.agents[h.traders[0]].role), ["farmer", "weaver", "logger", "saltmaker"]);
});

test("once salt is money, a farmer pays salt for fish: one swap", () => {
  let checked = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const town = createTown(SALT_TOWN, seed);
    const v = createVisitor(SALT_TOWN, "fisher");
    const needed = [];
    for (let d = 0; d < 12; d++) {
      needed.push(swapsNeeded(town, v));
      autoTrade(town, v);
      endDay(town, v);
    }
    assert.equal(needed[0], 4, `seed ${seed}`);
    const later = needed.slice(6).filter((n) => n > 0);
    assert.ok(Math.max(...later) <= 2, `seed ${seed}: ${needed}`);
    const path = shortestPath(town, v, [0, 1, 0, 0, 0]);
    if (path && path.length === 1) {
      const trader = town.agents[path[0].traders[0]];
      assert.notEqual(trader.needs, SALT, "the payer does not eat salt: it is money to them");
      checked++;
    }
  }
  assert.ok(checked >= 80, `one-swap salt payments seen in ${checked}/100 towns`);
});

test("trading matters: the visitor who never swaps never feeds the family", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const town = createTown(SALT_TOWN, seed);
    const idle = createVisitor(SALT_TOWN, "fisher");
    for (let d = 0; d < 30; d++) endDay(town, idle);
    assert.equal(idle.fed, 0);
  }
  const fed = [];
  for (let seed = 0; seed < 100; seed++) {
    const rules = seed % 2 ? SALT_TOWN : mysteryRules(seed);
    const town = createTown(rules, seed);
    const v = createVisitor(rules, visitorRole(rules));
    for (let d = 0; d < 30; d++) {
      autoTrade(town, v);
      endDay(town, v);
    }
    fed.push(v.fed);
  }
  fed.sort((a, b) => a - b);
  assert.ok(fed[50] >= 28, `median nights fed by the shortest-path player: ${fed[50]}`);
});
