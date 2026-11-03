// The player as trader number 41: a newcomer who makes one good, needs
// another every night, and can only get it by swapping with the town's
// traders one unit at a time. Traders judge the player's offer with the same
// rule they use with each other (willTake), so the player feels money emerge
// instead of being told about it. Nothing here creates goods: a swap only
// moves units between the bag and a trader's hands.

import { willTake, step } from "./town.js";
import { spoilNight, prices } from "./player.js";

export const SWAPS_PER_DAY = 4;
export const MAKES_PER_DAY = 2;

// The visitor makes the good that spoils fastest in this town: the hardest
// thing to sell, so barter hurts most and money helps most.
export function visitorRole(rules) {
  let worst = rules.roles[0];
  for (const r of rules.roles) if (rules.goods[r.makes].spoil > rules.goods[worst.makes].spoil) worst = r;
  return worst.key;
}

// `role` is a town role key ("fisher") or any { key, makes, needs } pair: the
// visitor is not one of the town's 40 traders, so its trade can be anything.
export function createVisitor(rules, role, start = 2) {
  if (typeof role === "string") role = rules.roles.find((r) => r.key === role);
  if (!role) throw new Error("unknown role");
  const bag = rules.goods.map(() => 0);
  bag[role.makes] = start;
  return {
    role: role.key,
    makes: role.makes,
    needs: role.needs,
    bag,
    carry: bag.map(() => 0),
    swaps: SWAPS_PER_DAY,
    fed: 0,
    hungry: 0,
    log: [],
  };
}

// How a trader answers an offer of `give`, without changing anything.
// kind: "need" (it is what they need), "money" (they take it to trade on),
// "keeps" (they hold what they need and will use it), "same", "refuse".
export function answer(town, agent, give) {
  if (agent.holds === give) return { yes: false, kind: "same" };
  if (agent.holds === agent.needs) return { yes: false, kind: "keeps" };
  if (give === agent.needs) return { yes: true, kind: "need" };
  return willTake(town, agent, give) ? { yes: true, kind: "money" } : { yes: false, kind: "refuse" };
}

// Swap one unit of `give` for whatever trader `index` holds.
export function offer(town, visitor, index, give) {
  const agent = town.agents[index];
  if (visitor.bag[give] <= 0) return { ok: false, kind: "empty" };
  if (visitor.swaps <= 0) return { ok: false, kind: "tired" };
  const a = answer(town, agent, give);
  if (!a.yes) return { ok: false, kind: a.kind };
  const got = agent.holds;
  agent.holds = give;
  visitor.bag[give]--;
  visitor.bag[got]++;
  visitor.swaps--;
  visitor.log.push({ day: town.day, index, gave: give, got });
  return { ok: true, kind: a.kind, got };
}

// Shortest chain of swaps from what is in the bag to what the visitor needs,
// using traders as they stand right now. Each hop is { give, get, traders }.
// Returns [] when the need is already in the bag, null when no chain exists.
export function shortestPath(town, visitor, bag = visitor.bag) {
  const goal = visitor.needs;
  if (bag[goal] > 0) return [];
  const goods = town.spoil.length;
  const prev = new Array(goods).fill(null);
  const seen = new Array(goods).fill(false);
  const queue = [];
  for (let g = 0; g < goods; g++) {
    if (bag[g] > 0) {
      seen[g] = true;
      queue.push(g);
    }
  }
  while (queue.length) {
    const g = queue.shift();
    for (let h = 0; h < goods; h++) {
      if (seen[h]) continue;
      const traders = [];
      town.agents.forEach((ag, i) => {
        if (ag.holds === h && answer(town, ag, g).yes) traders.push(i);
      });
      if (traders.length === 0) continue;
      seen[h] = true;
      prev[h] = { give: g, get: h, traders };
      if (h === goal) {
        const path = [];
        for (let x = goal; prev[x]; x = prev[x].give) path.unshift(prev[x]);
        return path;
      }
      queue.push(h);
    }
  }
  return null;
}

// Follow the shortest chain while swaps last. Used by "skip days" and tests.
export function autoTrade(town, visitor) {
  while (visitor.swaps > 0) {
    const path = shortestPath(town, visitor);
    if (!path || path.length === 0) return;
    const hop = path[0];
    offer(town, visitor, hop.traders[0], hop.give);
  }
}

// Night falls: the family eats, stockpiles spoil, the visitor makes fresh
// units, and the town trades through the night. Returns what happened.
export function endDay(town, visitor) {
  const ate = visitor.bag[visitor.needs] > 0;
  if (ate) {
    visitor.bag[visitor.needs]--;
    visitor.fed++;
  } else {
    visitor.hungry++;
  }
  const lost = spoilNight(visitor, town);
  visitor.bag[visitor.makes] += MAKES_PER_DAY;
  const before = town.history[town.history.length - 1];
  const report = step(town);
  visitor.swaps = SWAPS_PER_DAY;
  return { ate, lost, report, newMoney: report.money !== before.money ? report.money : null };
}

// What the bag is worth in meals: how many nights of the family's need the
// town would trade for it at today's prices.
export function savings(town, visitor) {
  const p = prices(town);
  const total = visitor.bag.reduce((sum, units, g) => sum + units * p[g], 0);
  return Math.floor(total / p[visitor.needs]);
}

// A bag holding a single unit of `good`: how hard is the need to reach from
// what the visitor makes? This is the number the game shows every day.
function oneOf(good, goods) {
  const bag = new Array(goods).fill(0);
  bag[good] = 1;
  return bag;
}

export function swapsNeeded(town, visitor) {
  const path = shortestPath(town, visitor, oneOf(visitor.makes, town.spoil.length));
  return path ? path.length : -1;
}
