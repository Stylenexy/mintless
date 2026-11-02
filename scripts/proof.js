// Prints the evidence behind the README claims: one town day by day, then
// the same claims measured over many seeds. Run: npm run proof
import { createTown, run } from "../engine/town.js";
import { SALT_TOWN } from "../rules/town.js";

const SEEDS = Number(process.argv[2] ?? 500);
const names = SALT_TOWN.goods.map((g) => g.key);
const rainDay = SALT_TOWN.events[0].day;
const pad = (v, n) => String(v).padStart(n);
const pct = (permille) => `${pad(Math.round(permille / 10), 3)}%`;

console.log(`\n${SALT_TOWN.name}, seed 1. Share of traders who would take each good`);
console.log(`even though they do not need it (90% or more = money).\n`);
console.log(`day  ${names.map((n) => n.padStart(6)).join("")}   money   needs met`);
const town = run(createTown(SALT_TOWN, 1), SALT_TOWN.seasonDays);
for (const r of town.history) {
  if (r.day > 12 && r.day < rainDay - 1) continue;
  const mark = r.day === rainDay ? "  <- rain: salt now spoils 12%/day" : "";
  const money = r.money === -1 ? "-" : names[r.money];
  console.log(`${pad(r.day, 3)}  ${r.accept.map((a) => pct(a).padStart(6)).join("")}   ${money.padEnd(6)}  ${pad(r.fedToday, 4)}${mark}`);
}

const stat = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  return { median: s[s.length >> 1], max: s[s.length - 1] };
};
let firstDays = [];
let lags = [];
let failures = 0;
for (let seed = 1; seed <= SEEDS; seed++) {
  const t = run(createTown(SALT_TOWN, seed), 40);
  const first = t.history.findIndex((r) => r.money === 0);
  const sw = t.history.findIndex((r) => r.day > rainDay && r.money === 3);
  if (first === -1 || first >= rainDay || sw === -1) failures++;
  else {
    firstDays.push(first);
    lags.push(sw - rainDay);
  }
}
const f = stat(firstDays);
const l = stat(lags);
const barter = structuredClone(SALT_TOWN);
barter.trader.doubt = 1_000_000;
const fed = (rules) => run(createTown(rules, 1), 30).history.reduce((s, r) => s + r.fedToday, 0);

console.log(`\nOver ${SEEDS} towns with the same rules and different random meetings:`);
console.log(`  salt became money in ${SEEDS - failures}/${SEEDS} towns, median day ${f.median}, latest day ${f.max}`);
console.log(`  after the rain, cloth replaced it in ${SEEDS - failures}/${SEEDS} towns, median ${l.median} days, slowest ${l.max}`);
console.log(`  needs met in 30 days (seed 1): pure barter ${fed(barter)}, with emergent money ${fed(SALT_TOWN)}`);
console.log(`  no trader is told which good is money; see test/town.test.js for the full checks\n`);
if (failures > 0) process.exit(1);
