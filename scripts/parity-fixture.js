// Writes contract/tests/parity.json: what the JavaScript engine computes,
// day by day, so the Rust contract can prove it computes the same town.
// Run: node scripts/parity-fixture.js
import { writeFileSync } from "node:fs";
import { createTown, step, stateHash } from "../engine/town.js";
import { prices } from "../engine/player.js";
import { makeRng } from "../engine/rng.js";
import { SALT_TOWN } from "../rules/town.js";

const runs = [1, 7, 99].map((seed) => {
  const town = createTown(SALT_TOWN, seed);
  const days = [];
  for (let d = 0; d <= 40; d++) {
    if (d > 0) step(town);
    const last = town.history[town.history.length - 1];
    days.push({ hash: stateHash(town), money: last.money, prices: prices(town) });
  }
  return { seed, days };
});
const rng = makeRng(12345);
const prng12345 = Array.from({ length: 5 }, () => rng.next());

const out = new URL("../contract/tests/parity.json", import.meta.url);
writeFileSync(out, JSON.stringify({ rules: SALT_TOWN, prng12345, runs }) + "\n");
// The exact rules text the contract is born with (its sha256 is the town's rules_hash).
writeFileSync(new URL("../contract/tests/rules.json", import.meta.url), JSON.stringify(SALT_TOWN));
console.log(`wrote contract/tests/parity.json (${runs.length} seeds x ${runs[0].days.length} days) and contract/tests/rules.json`);
