// One run on the island: skill decides the catch, the shipyard follows the
// town's money, the boat costs real units, and the storm punishes hoarders.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTown, run } from "../engine/town.js";
import { SALT_TOWN } from "../rules/town.js";
import { mysteryRules } from "../engine/mystery.js";
import { createRun, catchFish, fishYield, shopGood, buyPart, buyGear, bestGive, routeTo, worthNow, nightFall, nextPart, boatDone, playDay, DAYS, PARTS, GEAR, TOWN_DAYS_PER_NIGHT } from "../engine/island.js";
import { offer } from "../engine/visitor.js";

const SALT = 0, FISH = 1, CLOTH = 3;
const season = (rules, seed, play) => {
  const town = createTown(rules, seed);
  const me = createRun(rules);
  let won = 0;
  for (let d = 1; d <= DAYS && !won; d++) {
    play(town, me, d);
    if (boatDone(me)) won = d;
    nightFall(town, me);
  }
  return { town, me, won };
};

test("the catch depends only on skill", () => {
  assert.deepEqual([0, 19, 20, 54, 55, 84, 85, 100].map((s) => fishYield(s)), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(fishYield(100, { rod: true }), 4);
  assert.equal(fishYield(0, { rod: true }), 0);
  const v = createRun(SALT_TOWN);
  assert.equal(catchFish(v, 90), 3);
  assert.equal(v.bag[FISH], 3);
});

test("day one is a barter chain through every village", () => {
  const town = createTown(SALT_TOWN, 1);
  const v = createRun(SALT_TOWN);
  catchFish(v, 40);
  const path = routeTo(town, v, shopGood(town));
  assert.ok(path.length >= 3, `chain of ${path?.length}`);
});

test("swaps move units and never print them", () => {
  const town = createTown(SALT_TOWN, 1);
  const v = createRun(SALT_TOWN);
  v.bag[FISH] = 5;
  const total = () => v.bag.reduce((a, b) => a + b, 0);
  const before = total();
  const i = town.agents.findIndex((ag) => ag.needs === FISH);
  const res = offer(town, v, i, bestGive(town, v, i));
  assert.ok(res.ok);
  assert.equal(total(), before);
  assert.equal(town.agents[i].holds, FISH);
});

test("the shipyard takes the good the town takes most, and burns what you pay", () => {
  const town = run(createTown(SALT_TOWN, 1), 12);
  assert.equal(shopGood(town), SALT);
  const v = createRun(SALT_TOWN);
  assert.equal(buyPart(town, v).kind, "poor");
  v.bag[SALT] = PARTS[0].cost + GEAR[0].cost;
  assert.ok(buyGear(town, v, "duck").ok);
  const res = buyPart(town, v);
  assert.ok(res.ok);
  assert.equal(v.bag[SALT], 0);
  assert.equal(v.spent[SALT], PARTS[0].cost + GEAR[0].cost);
  assert.equal(nextPart(v).key, PARTS[1].key);
  assert.equal(buyGear(town, v, "duck").kind, "owned");
});

test("a decent player finishes after the storm, a sloppy one stays stranded", () => {
  const steady = (town, me) => playDay(town, me, { casts: 3, score: 60, swaps: 5 });
  const sloppy = (town, me) => playDay(town, me, { casts: 2, score: 40, swaps: 4 });
  const wins = [];
  for (let seed = 1; seed <= 40; seed++) {
    const { won } = season(SALT_TOWN, seed, steady);
    assert.ok(won > 0, `seed ${seed} did not finish`);
    wins.push(won);
    assert.equal(season(SALT_TOWN, seed, sloppy).won, 0);
  }
  wins.sort((a, b) => a - b);
  assert.ok(wins[20] >= 7, `median finish on day ${wins[20]}`);
});

test("mystery islands are winnable too", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const rules = mysteryRules(seed);
    assert.ok(season(rules, seed, (t, m) => playDay(t, m, { casts: 3, score: 60, swaps: 5 })).won > 0, `seed ${seed}`);
  }
});

test("salt held through the storm stops buying anything", () => {
  const town = run(createTown(SALT_TOWN, 1), 15);
  const v = createRun(SALT_TOWN);
  v.bag[SALT] = 16;
  assert.equal(shopGood(town), SALT);
  const worthBefore = worthNow(town, v);
  nightFall(town, v);
  nightFall(town, v);
  assert.ok(v.bag[SALT] < 12, `still ${v.bag[SALT]} salt`);
  assert.notEqual(shopGood(town), SALT);
  assert.equal(shopGood(town), CLOTH);
  assert.ok(worthNow(town, v) < worthBefore * 0.5, "savings should at least halve");
});

test("each night the town moves three days", () => {
  const town = createTown(SALT_TOWN, 1);
  const v = createRun(SALT_TOWN);
  const rival = createRun(SALT_TOWN);
  rival.bag[FISH] = 10;
  const r = nightFall(town, v, [rival]);
  assert.equal(town.day, TOWN_DAYS_PER_NIGHT);
  assert.equal(r.reports.length, TOWN_DAYS_PER_NIGHT);
  assert.ok(rival.bag[FISH] < 10, "the rival's stock rots as well");
});
