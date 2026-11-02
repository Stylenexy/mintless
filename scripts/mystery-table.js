// Finds which assignments of spoil rates make a playable mystery town:
// money must appear by day 10 and, if the rain hits the money on day 16,
// a new money must appear by day 26. Prints the table pasted into
// rules/town.js (MYSTERY.spoilSets). Run: node scripts/mystery-table.js
import { createTown, run } from "../engine/town.js";
import { SALT_TOWN } from "../rules/town.js";

const RATES = [1, 2, 3, 8, 20];
const SEEDS = 100;
const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));

const keep = [];
for (const spoil of perms(RATES)) {
  const rules = structuredClone(SALT_TOWN);
  spoil.forEach((s, g) => (rules.goods[g].spoil = s));
  rules.events = [];
  let ok = 0;
  const winners = new Set();
  for (let seed = 1; seed <= SEEDS; seed++) {
    const h = run(createTown(rules, seed), 10).history;
    const first = h.find((r) => r.money !== -1);
    if (!first) continue;
    winners.add(first.money);
    // rain on the money it chose: does the town find another one in time?
    const wet = structuredClone(rules);
    wet.events = [{ day: 16, good: first.money, spoil: 12, key: "rain" }];
    const h2 = run(createTown(wet, seed), 26).history;
    if (h2.slice(17).some((r) => r.money !== -1 && r.money !== first.money)) ok++;
  }
  if (ok >= SEEDS * 0.98) keep.push({ spoil, winners: [...winners].sort() });
}
console.log(`${keep.length} of 120 assignments are playable`);
console.log(JSON.stringify(keep.map((k) => k.spoil)));
const byWinner = {};
for (const k of keep) for (const w of k.winners) byWinner[SALT_TOWN.goods[w].key] = (byWinner[SALT_TOWN.goods[w].key] ?? 0) + 1;
console.log("towns in which each good can become money:", JSON.stringify(byWinner));
