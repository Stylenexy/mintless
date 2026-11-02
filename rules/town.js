// THE TOWN RULES — the only file that decides how this economy behaves.
//
// Nothing in this file (or anywhere in the code) says which good is money.
// Traders only know two things about a good: how fast it spoils, and how
// often the people they meet are willing to take it. Money is whatever the
// town ends up accepting from everyone. The same rules are committed on-chain
// (sha256 of this object, see contract/) so nobody can change them later.
//
// All numbers are integers so the browser, the tests and the NEAR contract
// compute exactly the same town, day after day.

export const SALT_TOWN = {
  name: "Salt Town",
  seasonDays: 30,

  // spoil = percent of a stockpile lost per day (also a trader's holding cost).
  goods: [
    { key: "salt", spoil: 0 },
    { key: "fish", spoil: 20 },
    { key: "rice", spoil: 6 },
    { key: "cloth", spoil: 2 },
    { key: "wood", spoil: 8 },
  ],

  // Every role makes one good and needs another. The needs form a ring, so two
  // traders never want each other's goods at the same time: pure barter fails.
  // (saltmaker needs wood, fisher needs salt, farmer needs fish, ...)
  roles: [
    { key: "saltmaker", makes: 0, needs: 4, count: 8 },
    { key: "fisher", makes: 1, needs: 0, count: 8 },
    { key: "farmer", makes: 2, needs: 1, count: 8 },
    { key: "weaver", makes: 3, needs: 2, count: 8 },
    { key: "logger", makes: 4, needs: 3, count: 8 },
  ],

  // How every trader decides (same rule for all, no LLM, no randomness inside
  // the decision):
  //   worth(good) = remembered acceptance of good / (baseCost + spoil of good)
  //   A trader gives what she holds for something she does not need only if
  //   its worth is more than (100 + doubt)% of what she holds now.
  //   After each meeting she updates her notebook: memory moves 1/2^memoryShift
  //   of the way towards what the other trader was willing to take.
  trader: { baseCost: 6, doubt: 40, memoryShift: 3, prior: 200 },

  // Each day every trader meets this many random partners, one at a time.
  market: { roundsPerDay: 4 },

  // A good is the town's money when at least this many permille of the traders
  // who do not need it would still take it in trade.
  moneyThreshold: 900,

  // Public calendar of rule changes. Known to everyone from day 0.
  // Day 16: the rainy season starts and salt turns damp (spoils 12% a day).
  events: [{ day: 16, good: 0, spoil: 12, key: "rain" }],
};

// MYSTERY TOWNS: identical to Salt Town except two public rules.
// 1. Each town takes its spoil rates (goods in the order above) from this
//    table: row = town seed modulo 38. Every row is a shuffle of 1, 2, 3, 8, 20
//    in which money appears by day 10 and a new one can appear after the rain
//    (found by scripts/mystery-table.js). The slowest-spoiling good is not
//    always the winner: who makes what, and who needs what, matters too.
// 2. On day 16 the rain soaks the good that most traders hold on day 8
//    (good: -1 means "decided on decideDay"). It then spoils 12% a day.
export const MYSTERY = {
  spoilSets: [
    [1, 2, 3, 8, 20], [1, 3, 8, 20, 2], [1, 3, 20, 2, 8], [1, 3, 20, 8, 2], [1, 8, 2, 3, 20], [1, 8, 3, 2, 20],
    [1, 8, 3, 20, 2], [1, 20, 3, 8, 2], [2, 1, 3, 8, 20], [2, 1, 3, 20, 8], [2, 1, 8, 3, 20], [2, 1, 20, 3, 8],
    [2, 3, 8, 20, 1], [2, 3, 20, 1, 8], [2, 8, 1, 3, 20], [2, 20, 1, 8, 3], [3, 2, 20, 1, 8], [3, 8, 2, 1, 20],
    [3, 8, 20, 1, 2], [3, 8, 20, 2, 1], [3, 20, 2, 1, 8], [3, 20, 2, 8, 1], [3, 20, 8, 1, 2], [3, 20, 8, 2, 1],
    [8, 1, 3, 20, 2], [8, 2, 1, 3, 20], [8, 2, 1, 20, 3], [8, 2, 3, 20, 1], [8, 3, 2, 20, 1], [8, 3, 20, 2, 1],
    [8, 20, 1, 2, 3], [8, 20, 2, 1, 3], [20, 1, 2, 3, 8], [20, 1, 8, 3, 2], [20, 2, 1, 8, 3], [20, 2, 8, 1, 3],
    [20, 3, 8, 2, 1], [20, 8, 2, 1, 3],
  ],
  rain: { day: 16, good: -1, decideDay: 8, spoil: 12, key: "rain" },
};
