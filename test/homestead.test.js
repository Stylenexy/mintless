// The household loop: skill decides the catch, shops follow the town's money,
// and savings parked in the wrong good crash when the money moves.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTown, run } from "../engine/town.js";
import { SALT_TOWN } from "../rules/town.js";
import { prices } from "../engine/player.js";
import { createHomestead, cast, fishYield, store, take, shopGood, buy, worthNow, nightFall, autoDay, moveSavings, bagCount, BAG_MAX, CASTS_PER_DAY, HEARTS } from "../engine/homestead.js";

const SALT = 0, FISH = 1, CLOTH = 3;

test("the catch depends only on timing", () => {
  assert.deepEqual([0, 24, 25, 59, 60, 89, 90, 100].map(fishYield), [0, 0, 1, 1, 2, 2, 3, 3]);
  const v = createHomestead(SALT_TOWN);
  const before = v.bag[FISH];
  assert.equal(cast(v, 95).got, 3);
  assert.equal(v.bag[FISH], before + 3);
  for (let i = 1; i < CASTS_PER_DAY; i++) cast(v, 0);
  assert.equal(cast(v, 100).kind, "tired");
});

test("the bag has a limit, the chest does not", () => {
  const v = createHomestead(SALT_TOWN);
  v.bag[FISH] = BAG_MAX - 1;
  assert.equal(cast(v, 100).got, 1);
  assert.equal(bagCount(v), BAG_MAX);
  assert.equal(store(v, FISH, 15), 15);
  assert.equal(v.chest[FISH], 15);
  assert.equal(take(v, FISH, 5), 5);
});

test("shops take what the town takes most, and spending burns units", () => {
  const town = run(createTown(SALT_TOWN, 1), 10);
  assert.equal(shopGood(town), SALT);
  const v = createHomestead(SALT_TOWN);
  assert.equal(buy(town, v, "boots").kind, "poor");
  v.bag[SALT] = 2;
  v.chest[SALT] = 3;
  const res = buy(town, v, "boots");
  assert.deepEqual(res, { ok: true, good: SALT, cost: 4 });
  assert.equal(v.bag[SALT] + v.chest[SALT], 1);
  assert.equal(buy(town, v, "boots").kind, "owned");
});

test("the rainy season moves the shops from salt to cloth", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const town = createTown(SALT_TOWN, seed);
    run(town, 12);
    assert.equal(shopGood(town), SALT, `seed ${seed} day 12`);
    run(town, 18);
    assert.equal(shopGood(town), CLOTH, `seed ${seed} day 30`);
  }
});

test("savings left in salt crash; moved before the rain they survive", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const outcome = (moveEarly) => {
      const town = createTown(SALT_TOWN, seed);
      run(town, 12);
      const v = createHomestead(SALT_TOWN);
      v.bag[FISH] = 0;
      v.chest[SALT] = 16;
      const start = worthNow(town, v);
      for (let d = 12; d < 30; d++) {
        if (moveEarly && d < 16) moveSavings(town, v, SALT, CLOTH);
        v.hearts = HEARTS;
        nightFall(town, v);
      }
      return { start, end: worthNow(town, v) };
    };
    const held = outcome(false);
    const moved = outcome(true);
    assert.ok(held.end <= held.start * 0.5, `seed ${seed}: held ${held.start} -> ${held.end}`);
    assert.ok(moved.end > held.end * 3, `seed ${seed}: moved ${moved.end} vs held ${held.end}`);
  }
});

test("an ice box halves what the chest loses", () => {
  const lose = (owned) => {
    const town = createTown(SALT_TOWN, 1);
    const v = createHomestead(SALT_TOWN, owned);
    v.chest[FISH] = 20;
    return nightFall(town, v).lostChest[FISH];
  };
  assert.equal(lose({}), 4);
  assert.equal(lose({ icebox: true }), 2);
});

test("no food costs a heart, food earns one back", () => {
  const town = createTown(SALT_TOWN, 1);
  const v = createHomestead(SALT_TOWN);
  assert.equal(nightFall(town, v).ate, false);
  assert.equal(v.hearts, HEARTS - 1);
  v.chest[SALT] = 1;
  assert.equal(nightFall(town, v).ate, true);
  assert.equal(v.hearts, HEARTS);
});

test("a steady player feeds the family and saves", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const town = createTown(SALT_TOWN, seed);
    const v = createHomestead(SALT_TOWN);
    for (let d = 0; d < 30; d++) {
      autoDay(town, v);
      nightFall(town, v);
    }
    assert.ok(v.fed >= 26, `seed ${seed}: fed ${v.fed}`);
    assert.ok(worthNow(town, v) > prices(town)[CLOTH] * 8, `seed ${seed}`);
  }
});
