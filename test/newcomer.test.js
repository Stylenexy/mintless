// A stranger who only follows the guide, on the game's real clock. The seconds
// are a cautious guess at a first-timer, not a measurement: weak casts, a slow
// walk, a pause before every action. Testers Dex, Esther and Rosa set the bar:
// a first run has to reach the sail with nobody helping.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTown } from "../engine/town.js";
import { SALT_TOWN } from "../rules/town.js";
import { createRun, catchFish, shopGood, buyPart, buyGear, routeTo, nightFall, nextPart, boatDone, trimRoute, stuckToday, GEAR, DAYS, PARTS } from "../engine/island.js";
import { offer } from "../engine/visitor.js";

const VILLAGE = [[24, 84], [106, 94], [108, 44], [25, 42], [60, 19]]; // by good
const YARD = [40, 110], DOCKS = [[62, 114], [78, 66], [112, 104]];
const FIRST_DAY = 150, DAY = 80, WALK = 7.5, DUCK = 18;
const PAUSE = 1.5, CAST = 14, SWAP = 3, SHOP = 6;
const WEAK_CAST = 50; // one fish a catch

function stranger(rules, seed, firstVoyage, nights = DAYS) {
  const town = createTown(rules, seed);
  const me = createRun(rules, {}, { firstVoyage });
  let at = [50, 107];
  const walk = (to) => {
    const t = (Math.hypot(to[0] - at[0], to[1] - at[1]) / (me.gear.duck ? DUCK : WALK)) * PAUSE;
    at = to;
    return t;
  };
  for (let night = 1; night <= nights; night++) {
    let left = night === 1 ? FIRST_DAY : DAY;
    while (left > 0 && !boatDone(me)) {
      const g = shopGood(town);
      const item = me.gear.duck ? nextPart(me) : GEAR[0];
      if (me.bag[g] >= item.cost) {
        left -= walk(YARD) + SHOP;
        if (left > 0) me.gear.duck ? buyPart(town, me) : buyGear(town, me, "duck");
        continue;
      }
      const path = routeTo(town, me, g);
      if (path?.length) {
        const hop = path[0];
        const place = (i) => VILLAGE[town.agents[i].makes];
        const dist = (i) => Math.hypot(place(i)[0] - at[0], place(i)[1] - at[1]);
        const i = hop.traders.reduce((a, b) => (dist(b) < dist(a) ? b : a));
        left -= walk(place(i)) + SWAP;
        offer(town, me, i, hop.give);
        continue;
      }
      const dock = DOCKS.reduce((a, b) => (Math.hypot(b[0] - at[0], b[1] - at[1]) < Math.hypot(a[0] - at[0], a[1] - at[1]) ? b : a));
      left -= walk(dock) + CAST;
      catchFish(me, WEAK_CAST);
    }
    if (boatDone(me)) return { night, parts: me.parts };
    nightFall(town, me);
  }
  return { night: 0, parts: me.parts };
}

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

test("a first voyage costs about half and every later island costs in full", () => {
  const first = createRun(SALT_TOWN, {}, { firstVoyage: true });
  const later = createRun(SALT_TOWN);
  assert.deepEqual(PARTS.map((p, i) => nextPart({ ...first, parts: i }).cost), [3, 4, 5, 6]);
  assert.deepEqual(PARTS.map((p, i) => nextPart({ ...later, parts: i }).cost), [4, 6, 8, 10]);
  assert.equal(nextPart({ ...first, parts: PARTS.length }), null);
});

test("the old rules strand a stranger who follows the guide", (t) => {
  const old = SEEDS.map((s) => stranger(SALT_TOWN, s, false));
  t.diagnostic(`full price, 10 nights: ${old.filter((r) => r.night).length} of ${SEEDS.length} sail, parts ${old.map((r) => r.parts).join(" ")}`);
  assert.ok(old.filter((r) => r.night).length < SEEDS.length / 2);
});

test("a stranger on a first voyage reaches the sail on every island", (t) => {
  const runs = SEEDS.map((s) => stranger(SALT_TOWN, s, true, 20));
  t.diagnostic(`first voyage: sails on night ${runs.map((r) => r.night).join(" ")}`);
  assert.ok(runs.every((r) => r.night > 0));
  assert.ok(runs.every((r) => r.night <= 14));
  assert.ok(runs.every((r) => r.night >= 7), "the storm lands after night 6, and a first run should live through it");
});

test("the route never starts by walking backwards", () => {
  assert.deepEqual(trimRoute([[10, 0], [0, 0], [20, 0], [30, 0]]), [[10, 0], [20, 0], [30, 0]]);
  assert.deepEqual(trimRoute([[0, 0], [10, 0], [20, 0], [15, 0]]), [[0, 0], [10, 0], [15, 0]]);
  assert.deepEqual(trimRoute([[0, 0], [10, 0], [10, 10]]), [[0, 0], [10, 0], [10, 10]]);
  assert.deepEqual(trimRoute([[0, 0], [5, 5]]), [[0, 0], [5, 5]]);
});

test("a bag nobody wants today means go to bed, and dawn fixes it", (t) => {
  let stuck = 0, freed = 0;
  for (const seed of SEEDS) {
    const town = createTown(SALT_TOWN, seed);
    const me = createRun(SALT_TOWN, {}, { firstVoyage: true });
    for (let night = 1; night <= 9; night++) {
      for (let i = 0; i < 3; i++) catchFish(me, WEAK_CAST);
      for (let k = 0; k < 40; k++) {
        const g = shopGood(town), path = routeTo(town, me, g);
        if (!path?.length) break;
        offer(town, me, path[0].traders[0], path[0].give);
      }
      const g = shopGood(town);
      if (stuckToday(town, me, g)) {
        stuck++;
        nightFall(town, me);
        if (!stuckToday(town, me, shopGood(town))) freed++;
      } else nightFall(town, me);
    }
  }
  t.diagnostic(`stuck ${stuck} times, free after one night ${freed}`);
  assert.ok(stuck > 0, "the stuck case really happens");
  assert.ok(freed >= stuck * 0.7, "sleeping gets the bag moving again in most cases");
  const town = createTown(SALT_TOWN, 1), me = createRun(SALT_TOWN);
  assert.equal(stuckToday(town, me, shopGood(town)), false, "an empty bag is not stuck, it needs fish");
});
