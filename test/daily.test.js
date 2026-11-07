import test from "node:test";
import assert from "node:assert/strict";
import { dailyIsland, dailyRandom, dailySeconds, createDailyBoard, renderDailyBoard } from "../web/daily.js";
import { mysteryRules } from "../engine/mystery.js";
import { createTown, step, stateHash } from "../engine/town.js";

const date = "2026-11-07";
const memoryStorage = () => {
  let saved = null;
  return { getItem: () => saved, setItem: (_, value) => { saved = value; } };
};
const result = (parts, seconds) => ({ won: parts === 4, parts, seconds });

test("daily islands share one UTC date and seed across time zones and change at midnight", () => {
  const jakarta = dailyIsland(new Date("2026-11-07T07:00:00+07:00"));
  assert.deepEqual(jakarta, { date, seed: 20261107 });
  assert.deepEqual(jakarta, dailyIsland(new Date("2026-11-06T16:00:00-08:00")));
  assert.deepEqual(jakarta, dailyIsland(new Date("2026-11-07T23:59:59.999Z")));
  assert.notEqual(dailyIsland(new Date("2026-11-08T00:00:00Z")).seed, jakarta.seed);
  assert.deepEqual(dailyIsland(new Date("2027-01-01T00:00:00Z")), { date: "2027-01-01", seed: 20270101 });
});

test("the daily economy and fishing sequence replay identically on independent clients", () => {
  const { seed } = dailyIsland(new Date(`${date}T00:00:00Z`));
  const a = createTown(mysteryRules(seed), seed);
  const b = createTown(mysteryRules(seed), seed);
  for (let day = 0; day < 30; day++) {
    assert.equal(stateHash(a), stateHash(b));
    step(a);
    step(b);
  }
  const one = dailyRandom(seed), two = dailyRandom(seed), tomorrow = dailyRandom(seed + 1);
  const sequence = Array.from({ length: 100 }, one);
  assert.deepEqual(sequence, Array.from({ length: 100 }, two));
  assert.notDeepEqual(sequence, Array.from({ length: 100 }, tomorrow));
  assert.ok(sequence.every((n) => n >= 0 && n < 1));
});

test("daily game time charges a whole skipped day and respects the longer first day", () => {
  assert.equal(dailySeconds(1, 0.5, 150, 80), 75);
  assert.equal(dailySeconds(2, 0, 150, 80), 150);
  assert.equal(dailySeconds(3, 0.5, 150, 80), 270);
  assert.equal(dailySeconds(10, 1, 150, 80), 870);
});

test("local rankings prefer sailing, more parts, faster time, then the earlier attempt", () => {
  const board = createDailyBoard(memoryStorage());
  board.add(date, result(1, 100));
  board.add(date, result(3, 870));
  board.add(date, result(4, 700));
  board.add(date, result(4, 500));
  const saved = board.add(date, result(4, 500));
  assert.deepEqual(saved.runs.map((r) => r.attempt), [4, 5, 3, 2, 1]);
  assert.equal(saved.attempts, 5);
  saved.runs.length = 0;
  assert.equal(board.get(date).runs.length, 5, "callers cannot mutate stored results");
});

test("daily results survive a reload, stay separate by date, and keep only the best ten", () => {
  const storage = memoryStorage();
  const board = createDailyBoard(storage);
  for (let i = 0; i < 15; i++) board.add(date, result(4, 700 - i));
  board.add("2026-11-08", result(0, 870));
  const reloaded = createDailyBoard(storage);
  assert.equal(reloaded.get(date).attempts, 15);
  assert.equal(reloaded.get(date).runs.length, 10);
  assert.equal(reloaded.get(date).runs[0].seconds, 686);
  assert.equal(reloaded.get("2026-11-08").runs[0].parts, 0);
  assert.equal(reloaded.get("2026-11-09").runs.length, 0);
  assert.equal(reloaded.get(date).persistent, true);
});

test("the board bounds stored days and an unfinished run can still save under yesterday", () => {
  const board = createDailyBoard(memoryStorage());
  for (let day = 1; day <= 9; day++) board.add(`2026-11-0${day}`, result(2, 870));
  assert.equal(board.get("2026-11-01").runs.length, 0);
  board.add("2026-11-08", result(4, 400));
  assert.equal(board.get("2026-11-08").runs[0].won, true);
  assert.equal(board.get("2026-11-09").runs.length, 1);
});

test("corrupt or unavailable local storage cannot break a daily run", () => {
  const corrupt = { ...memoryStorage(), getItem: () => "{broken" };
  const board = createDailyBoard(corrupt);
  assert.equal(board.get(date).runs.length, 0);
  const unavailable = createDailyBoard({ getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } });
  unavailable.add(date, result(2, 870));
  assert.equal(unavailable.get(date).runs.length, 1);
  assert.equal(unavailable.get(date).persistent, false);
  const full = createDailyBoard({ getItem: () => null, setItem() { throw Error("quota"); } });
  assert.equal(full.add(date, result(4, 500)).persistent, false);
  assert.equal(full.get(date).runs.length, 1);
});

test("invalid scores and malformed saved rows never enter the ranking", () => {
  const board = createDailyBoard(memoryStorage());
  for (const score of [{ won: true, parts: 2, seconds: 30 }, result(4, -1), result(5, 50), result(4, Infinity), result(4, 871)]) {
    assert.throws(() => board.add(date, score), /Invalid/);
  }
  assert.throws(() => board.add("<script>", result(4, 500)), /Invalid/);
  const polluted = createDailyBoard({ getItem: () => JSON.stringify({ [date]: { attempts: 2, runs: [{ ...result(4, 400), attempt: 1 }, { ...result(4, -99), attempt: 2 }] } }) });
  assert.equal(polluted.get(date).runs.length, 1);
});

test("the visible board labels local-only results, ranks and the empty or session-only state", () => {
  const doc = { createElement: (tag) => ({ tag, children: [], textContent: "", append(child) { this.children.push(child); } }) };
  const root = { ownerDocument: doc, replaceChildren(...children) { this.children = children; } };
  const board = createDailyBoard({ getItem() { throw Error(); } });
  renderDailyBoard(root, date, board);
  assert.match(root.children[0].textContent, /2026-11-07 \(UTC\)/);
  assert.match(root.children[1].textContent, /this browser only/);
  assert.match(root.children[1].textContent, /Session only/);
  assert.match(root.children[2].children[0].textContent, /No finished runs/);
  board.add(date, result(4, 400));
  renderDailyBoard(root, date, board);
  assert.equal(root.children[2].children[0].textContent, "Run 1: sailed, 6:40");
});
