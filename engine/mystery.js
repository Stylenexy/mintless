// Mystery towns: same traders, same rule for every decision, but each town
// draws its spoil rates from a public table, and the rain hits whatever good
// the town hoards most on day 8. Reading the rulebook is not enough to know
// which good will become money; you have to read the market.

import { SALT_TOWN, MYSTERY } from "../rules/town.js";

export function mysteryRules(seed) {
  const rules = structuredClone(SALT_TOWN);
  rules.name = "Mystery Town";
  const spoil = MYSTERY.spoilSets[(seed >>> 0) % MYSTERY.spoilSets.length];
  spoil.forEach((s, g) => (rules.goods[g].spoil = s));
  rules.events = [{ ...MYSTERY.rain }];
  return rules;
}
