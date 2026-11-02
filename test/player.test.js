// The player's side: swaps never create value, stockpiles spoil by the
// public rules, and the end-of-season "best two moves" is really the best.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createTown, step } from "../engine/town.js";
import { createPlayer, prices, bagValue, swap, stockUp, spoilNight, seasonTable, planValue, bestTwoMoves } from "../engine/player.js";
import { SALT_TOWN } from "../rules/town.js";

const START = { fish: 10, rice: 10, wood: 10 };

test("a swap never increases bag value: the stall cannot print", () => {
  const town = createTown(SALT_TOWN, 3);
  for (let d = 0; d < 20; d++) {
    const p = createPlayer(SALT_TOWN, START);
    const before = bagValue(p, prices(town));
    swap(p, town, 1, 0, 10);
    stockUp(p, town, 3, 50);
    assert.ok(bagValue(p, prices(town)) <= before);
    step(town);
  }
});

test("stockpiles spoil at the public rate, and salt starts spoiling after the rain", () => {
  const town = createTown(SALT_TOWN, 1);
  const p = createPlayer(SALT_TOWN, { salt: 100, fish: 100 });
  step(town);
  spoilNight(p, town);
  assert.equal(p.bag[0], 100);
  assert.equal(p.bag[1], 80);
  while (town.day < SALT_TOWN.events[0].day) step(town);
  spoilNight(p, town);
  assert.equal(p.bag[0], 88);
});

test("timing matters: salt early then cloth before the rain beats every one-good plan", () => {
  const start = SALT_TOWN.goods.map((g) => START[g.key] ?? 0);
  const table = seasonTable(createTown(SALT_TOWN, 1), SALT_TOWN.seasonDays, step);
  const idle = planValue(table, start, []);
  const twoMoves = planValue(table, start, [{ day: 0, to: 0 }, { day: 15, to: 3 }]);
  const holdSalt = planValue(table, start, [{ day: 0, to: 0 }]);
  console.log(`  season value from 600: idle ${idle}, salt kept through the rain ${holdSalt}, salt then cloth ${twoMoves}`);
  for (let g = 0; g < start.length; g++) assert.ok(twoMoves > planValue(table, start, [{ day: 0, to: g }]));
  assert.ok(holdSalt < idle, "keeping the old money through the rain should hurt");
  const best = bestTwoMoves(table, start);
  assert.ok(best.value >= twoMoves);
});

test("following loses, anticipating wins: buying only after the town crowns a money ends below the start", () => {
  const start = SALT_TOWN.goods.map((g) => START[g.key] ?? 0);
  const follower = [];
  for (let seed = 1; seed <= 20; seed++) {
    const town = createTown(SALT_TOWN, seed);
    const table = seasonTable(town, SALT_TOWN.seasonDays, step);
    const crowned = town.history.findIndex((r) => r.money === 0);
    const cloth = town.history.findIndex((r) => r.day > 16 && r.money === 3);
    follower.push(planValue(table, start, [{ day: crowned, to: 0 }, { day: cloth, to: 3 }]));
    assert.ok(planValue(table, start, [{ day: 0, to: 0 }, { day: 15, to: 3 }]) > 3000, `seed ${seed}`);
  }
  follower.sort((a, b) => a - b);
  console.log(`  follower median over 20 towns: ${follower[10]} (start 600)`);
  assert.ok(follower[10] < 600);
});
