// Execute the real game entry/finish functions with Node and small DOM/scene
// stand-ins. This checks wiring without opening a browser or claiming visual QA.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { SALT_TOWN } from "../rules/town.js";
import { createTown } from "../engine/town.js";
import { mysteryRules } from "../engine/mystery.js";
import { createRun, nextPart, worthNow, shopGood, PARTS, DAYS } from "../engine/island.js";
import { dailyIsland, dailyRandom, dailySeconds, createDailyBoard, renderDailyBoard } from "../web/daily.js";
import { voyageLimit } from "../web/help.js";

const source = readFileSync(new URL("../web/game.js", import.meta.url), "utf8");
const gameFunction = (name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf("\n}", start) + 2);
};
const noop = () => {};
function harness({ chainPlay = false, crown = false } = {}) {
  const nodes = new Map();
  const $ = (id) => {
    if (!nodes.has(id)) {
      const classes = new Set();
      nodes.set(id, {
        textContent: "", innerHTML: "",
        classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c), toggle(c, on) { on ? classes.add(c) : classes.delete(c); } },
      });
    }
    return nodes.get(id);
  };
  const boat = () => ({ parts: [], wreck: {}, root: { position: { set: noop }, rotation: {} } });
  const context = {
    $, S: null, CHAIN: { play: chainPlay, seed: 7 }, crowned: () => crown,
    SALT_TOWN, createTown, mysteryRules, createRun, worthNow, PARTS, DAYS,
    dailyIsland, dailyRandom, dailySeconds, dailyBoard: createDailyBoard({ getItem: () => null, setItem: noop }),
    renderDailyBoard: (root, date, board) => { root.textContent = `${date}: ${board.get(date).runs.length}`; },
    structuredClone, WORLD: { objects: [{ kind: "dock" }] }, CAMP: { x: 50, z: 100 }, WRECK: { x: 40, z: 110 }, MIRA: { x: 90, z: 100 },
    mira: {}, V: [], bottleMeshes: [], boat: boat(), miraBoat: boat(), duck: { root: {} },
    loadBook: () => ({}), hideAllPanels: noop, rebuildStack: noop, renderHud: noop, renderBag: noop,
    fishToGood: () => 0, FIRST_DAY_SECONDS: 150, DAY_SECONDS: 80, SALT_SEED: 7,
    unlockAudio: noop, music: noop, qs: new URLSearchParams("?seed=999"), crypto,
    guest: null, createChainPlay() { throw Error("daily must not create an account"); },
    view: {}, cam: { yaw: 0 }, touchDevice: false, toast: noop, say: noop,
    localStorage: { setItem: noop }, hero: { wear: { crown: {} } },
    stopFishing: noop, closePanel: noop, clearTimeout: noop, bannerTimer: null,
    drawChart: () => 0, GOODS: ["salt", "fish", "rice", "cloth", "wood"], chainProof: noop,
  };
  context.shop = () => shopGood(context.S.town);
  context.money = () => context.S.town.history.at(-1).money;
  vm.createContext(context);
  vm.runInContext(["newRun", "startRun", "finish"].map(gameFunction).join("\n"), context);
  return context;
}

test("daily entry ignores URL seeds, crown and chain settings and uses full prices", () => {
  for (const options of [{ chainPlay: false, crown: false }, { chainPlay: true, crown: true }]) {
    const game = harness(options);
    game.startRun("daily", 123, "2026-11-07");
    assert.equal(game.S.seed, 20261107);
    assert.equal(game.S.dailyDate, "2026-11-07");
    assert.equal(game.S.rules.name, "Mystery Town");
    assert.equal(game.S.me.firstVoyage, false);
    assert.equal(nextPart(game.S.me).cost, 4);
    assert.equal(game.S.chain, undefined);
    const expected = dailyRandom(20261107);
    assert.equal(game.S.random(), expected());
    assert.equal(game.$("title").classList.contains("hidden"), true);
  }
  const newcomer = harness();
  newcomer.startRun("salt");
  assert.equal(newcomer.S.me.firstVoyage, true);
  assert.equal(nextPart(newcomer.S.me).cost, 3);
});

test("a daily win records once under its start date and a retry preserves that date", () => {
  const game = harness();
  // Use the real board, with actual persistence between reads.
  let saved = null;
  game.dailyBoard = createDailyBoard({ getItem: () => saved, setItem: (_, value) => { saved = value; } });
  game.startRun("daily", null, "2026-11-07");
  game.S.me.parts = 4;
  game.S.won = 2;
  game.S.clock = 0.5;
  game.finish(true);
  game.finish(true);
  const record = game.dailyBoard.get("2026-11-07");
  assert.equal(record.attempts, 1);
  assert.equal(record.runs[0].seconds, 190);
  assert.equal(game.$("end-daily").classList.contains("hidden"), false);
  game.startRun(game.S.kind, game.S.seed, game.S.dailyDate);
  assert.equal(game.S.dailyDate, "2026-11-07");
  assert.equal(game.S.seed, 20261107);
  assert.equal(game.S.me.parts, 0);
});

test("a stranded daily run records parts and full time, ordinary runs never rank", () => {
  const game = harness();
  let saved = null;
  game.dailyBoard = createDailyBoard({ getItem: () => saved, setItem: (_, value) => { saved = value; } });
  game.startRun("daily", null, "2026-11-07");
  game.S.me.parts = 3;
  game.finish(false);
  assert.equal(game.dailyBoard.get("2026-11-07").runs[0].parts, 3);
  assert.equal(game.dailyBoard.get("2026-11-07").runs[0].seconds, 870);
  game.startRun("salt");
  game.finish(false);
  assert.equal(game.dailyBoard.get("2026-11-07").attempts, 1);
  assert.equal(game.$("end-daily").classList.contains("hidden"), true);
});

test("keyboard activation of a daily button or leaderboard summary cannot start the tutorial", () => {
  const game = harness();
  game.S = { kind: "salt" };
  let keydown;
  game.document = { addEventListener: (_, handler) => { keydown = handler; } };
  const start = source.indexOf('document.addEventListener("keydown"');
  vm.runInContext(source.slice(start, source.indexOf("\n});", start) + 4), game);
  const original = game.S;
  keydown({ key: "Enter", target: { closest: () => ({}) } });
  keydown({ key: " ", target: { closest: () => ({}) } });
  assert.equal(game.S, original);
  keydown({ key: "Enter", target: {} });
  assert.notEqual(game.S, original, "the ordinary title shortcut still works");
});

test("the actual HUD shows day 12 without a false ten-day limit for a first voyage", () => {
  const game = harness();
  game.startRun("salt");
  Object.assign(game, { voyageLimit, dayNum: () => 12, rainEvent: () => null, drawKeys: noop, bagCount: noop });
  vm.runInContext(gameFunction("renderHud"), game);
  game.renderHud();
  assert.equal(game.$("day-n").textContent, "Day 12");
  assert.equal(game.$("day-limit").textContent, "no deadline");
  game.S.me.firstVoyage = false;
  game.renderHud();
  assert.equal(game.$("day-limit").textContent, "of 10");
});

test("the offline bundle includes daily mode and parses as one valid module", () => {
  const build = spawnSync(process.execPath, ["scripts/bundle.js"], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  assert.equal(build.status, 0, build.stderr);
  const html = readFileSync(new URL("../dist/mintless.html", import.meta.url), "utf8");
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.match(script, /function dailyIsland/);
  assert.match(script, /function helpLines/);
  const parsed = spawnSync(process.execPath, ["--check", "--input-type=module"], { input: script, encoding: "utf8" });
  assert.equal(parsed.status, 0, parsed.stderr);
});
