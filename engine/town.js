// Town engine: a Kiyotaki–Wright style search economy with simple learning
// traders. Pure, deterministic, integer-only. No good is ever labelled as
// money here; `moneyOf` only *measures* what the traders already do.

import { makeRng } from "./rng.js";

export function createTown(rules, seed) {
  const agents = [];
  for (const role of rules.roles) {
    for (let i = 0; i < role.count; i++) {
      agents.push({
        role: role.key,
        needs: role.needs,
        makes: role.makes,
        holds: role.makes,
        memory: rules.goods.map(() => rules.trader.prior),
        fed: 0,
      });
    }
  }
  if (agents.length % 2 !== 0) throw new Error("town needs an even number of traders");
  const town = {
    rules,
    seed: seed >>> 0,
    rngState: seed >>> 0,
    day: 0,
    spoil: rules.goods.map((g) => g.spoil),
    // Which good each event hits. An event with good = -1 hits whatever good
    // most traders hold on its `decideDay` (the rain soaks the town's hoard).
    eventGoods: rules.events.map((ev) => ev.good),
    agents,
    history: [],
  };
  applyEvents(town);
  town.history.push(snapshot(town, { trades: 0, fedToday: 0, indirect: rules.goods.map(() => 0) }));
  return town;
}

export function mostHeld(town) {
  const count = town.spoil.map(() => 0);
  for (const ag of town.agents) count[ag.holds]++;
  let best = 0;
  for (let g = 1; g < count.length; g++) if (count[g] > count[best]) best = g;
  return best;
}

function applyEvents(town) {
  town.rules.events.forEach((ev, i) => {
    if (ev.good === -1 && ev.decideDay === town.day) town.eventGoods[i] = mostHeld(town);
    if (ev.day === town.day && town.eventGoods[i] >= 0) town.spoil[town.eventGoods[i]] = ev.spoil;
  });
}

export function holdingCost(town, good) {
  return town.rules.trader.baseCost + town.spoil[good];
}

export function worth(town, agent, good) {
  return Math.trunc((agent.memory[good] * 1000) / holdingCost(town, good));
}

// Would `agent`, currently holding `holding`, take `offered` in exchange?
export function willTake(town, agent, offered, holding = agent.holds) {
  if (offered === holding) return false;
  if (offered === agent.needs) return true;
  if (holding === agent.needs) return false;
  const doubt = town.rules.trader.doubt;
  return worth(town, agent, offered) * 100 > worth(town, agent, holding) * (100 + doubt);
}

function learn(town, agent, partner) {
  const shift = town.rules.trader.memoryShift;
  for (let g = 0; g < town.spoil.length; g++) {
    if (g === partner.holds) continue;
    const seen = willTake(town, partner, g) ? 1000 : 0;
    agent.memory[g] += (seen - agent.memory[g]) >> shift;
  }
}

// Advance the town by one day (several market rounds). Returns the day report
// that was appended to history.
export function step(town) {
  const rng = makeRng(town.rngState);
  const n = town.agents.length;
  const goods = town.spoil.length;
  const indirect = new Array(goods).fill(0);
  let trades = 0;
  let fedToday = 0;
  const order = Array.from({ length: n }, (_, i) => i);

  for (let round = 0; round < town.rules.market.roundsPerDay; round++) {
    for (let i = n - 1; i > 0; i--) {
      const j = rng.below(i + 1);
      const t = order[i];
      order[i] = order[j];
      order[j] = t;
    }
    for (let k = 0; k < n; k += 2) {
      const a = town.agents[order[k]];
      const b = town.agents[order[k + 1]];
      const aTakes = willTake(town, a, b.holds);
      const bTakes = willTake(town, b, a.holds);
      learn(town, a, b);
      learn(town, b, a);
      if (aTakes && bTakes) {
        const x = a.holds;
        a.holds = b.holds;
        b.holds = x;
        trades++;
        if (a.holds !== a.needs) indirect[a.holds]++;
        if (b.holds !== b.needs) indirect[b.holds]++;
      }
    }
    // Whoever now holds what they need uses it and makes a fresh unit of their own good.
    for (const ag of town.agents) {
      if (ag.holds === ag.needs) {
        ag.fed++;
        fedToday++;
        ag.holds = ag.makes;
      }
    }
  }
  town.rngState = rng.state;

  town.day++;
  applyEvents(town);
  const report = snapshot(town, { trades, fedToday, indirect });
  town.history.push(report);
  return report;
}

// Permille of traders who neither need nor make `good` that would still take
// it in trade (or already hold it because they took it earlier).
export function acceptance(town) {
  const goods = town.spoil.length;
  const out = [];
  for (let g = 0; g < goods; g++) {
    let yes = 0;
    let total = 0;
    for (const ag of town.agents) {
      if (ag.needs === g || ag.makes === g) continue;
      total++;
      if (ag.holds === g || willTake(town, ag, g)) yes++;
    }
    out.push(total === 0 ? 0 : Math.trunc((yes * 1000) / total));
  }
  return out;
}

export function moneyFrom(accept, threshold) {
  let best = -1;
  for (let g = 0; g < accept.length; g++) {
    if (accept[g] >= threshold && (best === -1 || accept[g] > accept[best])) best = g;
  }
  return best;
}

// Average notebook entry per good across all traders (permille): how
// tradeable the town believes each good is. This is the price signal.
export function belief(town) {
  const n = town.agents.length;
  return town.spoil.map((_, g) => {
    let sum = 0;
    for (const ag of town.agents) sum += ag.memory[g];
    return Math.trunc(sum / n);
  });
}

function snapshot(town, { trades, fedToday, indirect }) {
  const accept = acceptance(town);
  return {
    day: town.day,
    accept,
    belief: belief(town),
    money: moneyFrom(accept, town.rules.moneyThreshold),
    trades,
    fedToday,
    indirect,
    spoil: town.spoil.slice(),
  };
}

export function run(town, days) {
  for (let i = 0; i < days; i++) step(town);
  return town;
}

// Stable fingerprint of the whole town state (FNV-1a over integers).
export function stateHash(town) {
  let h = 0x811c9dc5;
  const mix = (v) => {
    h ^= v & 0xffff;
    h = Math.imul(h, 0x01000193) >>> 0;
    h ^= (v >>> 16) & 0xffff;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  mix(town.day);
  mix(town.rngState);
  for (const s of town.spoil) mix(s);
  for (const ag of town.agents) {
    mix(ag.holds);
    mix(ag.fed);
    for (const m of ag.memory) mix(m);
  }
  return h.toString(16).padStart(8, "0");
}

// Plain-language reason for the tooltip: why this trader would (not) take a good.
export function explain(town, agent, good) {
  const take = willTake(town, agent, good);
  return {
    take,
    needs: agent.needs,
    holds: agent.holds,
    memoryOffered: agent.memory[good],
    memoryHeld: agent.memory[agent.holds],
    costOffered: holdingCost(town, good),
    costHeld: holdingCost(town, agent.holds),
    worthOffered: worth(town, agent, good),
    worthHeld: worth(town, agent, agent.holds),
    doubt: town.rules.trader.doubt,
  };
}
