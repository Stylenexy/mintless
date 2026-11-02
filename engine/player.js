// The player: a newcomer with a bag of goods and no money, because the town
// has none yet. Prices come from the traders' notebooks (how tradeable the
// town believes each good is); the player's swaps never print anything, they
// only move goods between the bag and the market stall.

import { belief } from "./town.js";

export const SWAP_FEE = 5; // percent kept by the stall on every swap

export function createPlayer(rules, start) {
  const bag = rules.goods.map((g) => start[g.key] ?? 0);
  return { bag, carry: bag.map(() => 0), log: [] };
}

// Price of one unit, in value points (1..100). Never zero, so nothing is free.
export function prices(town) {
  return belief(town).map((b) => Math.max(1, Math.round(b / 10)));
}

export function bagValue(player, price) {
  return player.bag.reduce((sum, units, g) => sum + units * price[g], 0);
}

// Swap `units` of good `from` into good `to` at today's prices.
export function swap(player, town, from, to, units) {
  if (from === to || units <= 0) return 0;
  const n = Math.min(units, player.bag[from]);
  if (n === 0) return 0;
  const p = prices(town);
  const got = Math.floor((n * p[from] * (100 - SWAP_FEE)) / (100 * p[to]));
  if (got === 0) return 0;
  player.bag[from] -= n;
  player.bag[to] += got;
  player.log.push({ day: town.day, from, to, gave: n, got });
  return got;
}

// Move `share` percent of everything else in the bag into good `to`.
export function stockUp(player, town, to, share) {
  let total = 0;
  for (let g = 0; g < player.bag.length; g++) {
    if (g === to) continue;
    total += swap(player, town, g, to, Math.ceil((player.bag[g] * share) / 100));
  }
  return total;
}

// Record what a season looks like from the market stall: prices for each day
// and the spoil rates of each night. The town does not react to the player,
// so this lets us score any plan after the fact.
export function seasonTable(town, days, stepFn) {
  const price = [prices(town)];
  const spoil = [town.spoil.slice()];
  for (let d = 0; d < days; d++) {
    stepFn(town);
    price.push(prices(town));
    spoil.push(town.spoil.slice());
  }
  return { price, spoil, days };
}

// Value at the end of the season of a plan made of all-in moves [{day, to}].
export function planValue(table, startBag, moves) {
  const player = { bag: startBag.slice(), carry: startBag.map(() => 0), log: [] };
  const byDay = new Map(moves.map((m) => [m.day, m.to]));
  for (let d = 0; d < table.days; d++) {
    if (byDay.has(d)) {
      const to = byDay.get(d);
      for (let g = 0; g < player.bag.length; g++) {
        if (g === to || player.bag[g] === 0) continue;
        const got = Math.floor((player.bag[g] * table.price[d][g] * (100 - SWAP_FEE)) / (100 * table.price[d][to]));
        if (got === 0) continue;
        player.bag[g] = 0;
        player.bag[to] += got;
      }
    }
    spoilNight(player, { spoil: table.spoil[d + 1] });
  }
  return bagValue(player, table.price[table.days]);
}

// The best plan of at most two all-in moves, found by trying them all.
export function bestTwoMoves(table, startBag) {
  const goods = startBag.length;
  let best = { value: planValue(table, startBag, []), moves: [] };
  for (let d1 = 0; d1 < table.days; d1++) {
    for (let x = 0; x < goods; x++) {
      const one = [{ day: d1, to: x }];
      const v1 = planValue(table, startBag, one);
      if (v1 > best.value) best = { value: v1, moves: one };
      for (let d2 = d1 + 1; d2 < table.days; d2++) {
        for (let y = 0; y < goods; y++) {
          if (y === x) continue;
          const two = [{ day: d1, to: x }, { day: d2, to: y }];
          const v2 = planValue(table, startBag, two);
          if (v2 > best.value) best = { value: v2, moves: two };
        }
      }
    }
  }
  return best;
}

// One night passes: stockpiles spoil at the town's current spoil rates.
export function spoilNight(player, town) {
  const lost = player.bag.map(() => 0);
  for (let g = 0; g < player.bag.length; g++) {
    const amount = player.bag[g] * town.spoil[g] + player.carry[g];
    const rot = Math.min(player.bag[g], Math.floor(amount / 100));
    player.carry[g] = amount % 100;
    player.bag[g] -= rot;
    lost[g] = rot;
  }
  return lost;
}
