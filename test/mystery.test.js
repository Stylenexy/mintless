// Mystery towns: the rulebook alone does not tell you which good will be
// money. Checked over 760 towns (20 per row of the public spoil table).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createTown, run, stateHash } from "../engine/town.js";
import { mysteryRules } from "../engine/mystery.js";
import { MYSTERY } from "../rules/town.js";

const N = MYSTERY.spoilSets.length * 20;
const towns = Array.from({ length: N }, (_, i) => {
  const seed = i + 1;
  const rules = mysteryRules(seed);
  return { seed, rules, town: run(createTown(rules, seed), 30) };
});

test("a mystery town is fully decided by its seed", () => {
  const a = run(createTown(mysteryRules(77), 77), 30);
  const b = run(createTown(mysteryRules(77), 77), 30);
  assert.equal(stateHash(a), stateHash(b));
});

test("money appears by day 10 in at least 98% of mystery towns", () => {
  const ok = towns.filter(({ town }) => town.history.slice(0, 11).some((r) => r.money !== -1)).length;
  console.log(`  money by day 10: ${ok}/${N}`);
  assert.ok(ok >= N * 0.98);
});

test("every good becomes money somewhere, and the slowest-spoiling good wins only about half the time", () => {
  const wins = [0, 0, 0, 0, 0];
  let slowest = 0;
  for (const { rules, town } of towns) {
    const first = town.history.find((r) => r.money !== -1);
    if (!first) continue;
    wins[first.money]++;
    const spoil = rules.goods.map((g) => g.spoil);
    if (spoil[first.money] === Math.min(...spoil)) slowest++;
  }
  console.log(`  first money by good: ${wins.join(" / ")}; slowest-spoiling good won ${Math.round((slowest / N) * 100)}%`);
  for (const w of wins) assert.ok(w >= N * 0.1);
  assert.ok(slowest <= N * 0.6);
});

test("the market tells early: the day-3 price leader is the eventual money in at least 90% of towns", () => {
  let hit = 0;
  let total = 0;
  for (const { town } of towns) {
    const first = town.history.find((r) => r.money !== -1);
    if (!first) continue;
    const b = town.history[3].belief;
    total++;
    if (b.indexOf(Math.max(...b)) === first.money) hit++;
  }
  console.log(`  day-3 price leader = eventual money in ${hit}/${total}`);
  assert.ok(hit >= total * 0.9);
});

test("the rain soaks the town's hoard; when that is the money, a new money follows by day 26", () => {
  let hits = 0;
  let switched = 0;
  for (const { town } of towns) {
    const h = town.history;
    const hoard = town.eventGoods[0];
    assert.equal(h[16].spoil[hoard], MYSTERY.rain.spoil);
    if (h[8].money === -1 || hoard !== h[8].money) continue;
    hits++;
    if (h.slice(17, 27).some((r) => r.money !== -1 && r.money !== hoard)) switched++;
  }
  console.log(`  rain hit the money in ${hits}/${N} towns; a new money followed in ${switched}/${hits}`);
  assert.ok(hits >= N * 0.9);
  assert.ok(switched >= hits * 0.97);
});
