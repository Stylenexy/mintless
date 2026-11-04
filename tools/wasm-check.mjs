// Runs the real contract wasm in Node with a small stand-in for the NEAR host:
// the shipwright's rules, without a network, an account or a wallet.
//
//   npm run build:contract && node tools/wasm-check.mjs
import fs from "node:fs";
import crypto from "node:crypto";
import { SALT_TOWN } from "../rules/town.js";
import { createTown, step } from "../engine/town.js";
import { shopGood, PARTS, TOWN_DAYS_PER_NIGHT } from "../engine/island.js";

const WASM = new URL("../contract/target/wasm32-unknown-unknown/release/mintless_town.wasm", import.meta.url);
const SEED = 7;
const mod = new WebAssembly.Module(fs.readFileSync(WASM));
const storage = new Map();
const key = (b) => Buffer.from(b).toString("latin1");
let failures = 0;
const say = (ok, name, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? " | " + detail : ""}`);
};

function call(method, args, who = "guest.testnet") {
  const registers = new Map();
  const input = Buffer.from(JSON.stringify(args));
  const logs = [];
  let result = null;
  let mem;
  const bytes = (ptr, len) => Buffer.from(new Uint8Array(mem.buffer, Number(ptr), Number(len)));
  const reg = (id, value) => registers.set(id, Buffer.from(value));
  class Panic extends Error {}
  const env = {
    input: (r) => reg(r, input),
    register_len: (r) => (registers.has(r) ? BigInt(registers.get(r).length) : 0xffffffffffffffffn),
    read_register: (r, ptr) => new Uint8Array(mem.buffer).set(registers.get(r), Number(ptr)),
    write_register: (r, len, ptr) => reg(r, bytes(ptr, len)),
    current_account_id: (r) => reg(r, "town.testnet"),
    predecessor_account_id: (r) => reg(r, who),
    signer_account_id: (r) => reg(r, who),
    block_timestamp: () => 1n,
    block_index: () => 1n,
    attached_deposit: (ptr) => new Uint8Array(mem.buffer, Number(ptr), 16).fill(0),
    prepaid_gas: () => 300000000000000n,
    used_gas: () => 0n,
    storage_read: (l, p, r) => {
      const v = storage.get(key(bytes(p, l)));
      if (!v) return 0n;
      reg(r, v);
      return 1n;
    },
    storage_write: (kl, kp, vl, vp, r) => {
      const k = key(bytes(kp, kl));
      const had = storage.get(k);
      if (had) reg(r, had);
      storage.set(k, Buffer.from(bytes(vp, vl)));
      return had ? 1n : 0n;
    },
    storage_remove: (l, p, r) => {
      const k = key(bytes(p, l));
      const had = storage.get(k);
      if (had) reg(r, had);
      storage.delete(k);
      return had ? 1n : 0n;
    },
    storage_has_key: (l, p) => (storage.has(key(bytes(p, l))) ? 1n : 0n),
    sha256: (l, p, r) => reg(r, crypto.createHash("sha256").update(bytes(p, l)).digest()),
    value_return: (l, p) => (result = bytes(p, l).toString()),
    log_utf8: (l, p) => logs.push(bytes(p, l).toString()),
    panic_utf8: (l, p) => {
      throw new Panic(bytes(p, l).toString());
    },
    panic: () => {
      throw new Panic("panic");
    },
    abort: () => {
      throw new Panic("abort");
    },
  };
  for (const imp of WebAssembly.Module.imports(mod)) {
    if (imp.kind === "function" && !env[imp.name]) {
      env[imp.name] = () => {
        throw new Error(`host function ${imp.name} is not in this stand-in`);
      };
    }
  }
  const inst = new WebAssembly.Instance(mod, { env });
  mem = inst.exports.memory;
  const before = new Map(storage);
  try {
    inst.exports[method]();
    return { ok: true, value: result ? JSON.parse(result) : null, logs };
  } catch (e) {
    // A refused call traps; the reason is the last thing it logged.
    if (!(e instanceof Panic) && e.message !== "unreachable") throw e;
    storage.clear();
    for (const [k, v] of before) storage.set(k, v);
    return { ok: false, error: logs[logs.length - 1] ?? e.message, logs };
  }
}

const rulesJson = JSON.stringify(SALT_TOWN);
const starter = Array(5).fill("32");
say(call("new", { rules_json: rulesJson, seed: SEED, day_seconds: "0", max_days: 30, stall: Array(5).fill("100000"), starter, bags: 200 }, "deployer.testnet").ok, "the wasm starts");

const local = createTown(SALT_TOWN, SEED);
const mornings = [];
for (let m = 0; m < 10; m++) {
  mornings.push(SALT_TOWN.goods[shopGood(local)].key);
  for (let d = 0; d < TOWN_DAYS_PER_NIGHT; d++) step(local);
}
const onChain = mornings.map((_, m) => call("shipyard", { town_day: m * TOWN_DAYS_PER_NIGHT }).value);
say(onChain.join() === mornings.join(), "the contract and the JS engine agree on every morning", onChain.join(" "));
say(onChain[5] === "salt" && onChain[6] === "cloth", "the shipyard moves to cloth on the morning of day 7");

say(call("join", {}).ok, "a guest takes a starter bag");
const paid = (p, day, good) => call("build", { part: p, town_day: day, good });
const wrong = paid(0, 18, "salt");
say(!wrong.ok, "day 7: salt is refused");
const supplyBefore = call("mt_supply", { token_id: "cloth" }).value;
const hull = paid(0, 18, "cloth");
say(hull.ok && hull.value.parts === 1, "day 7: the hull is paid in cloth", JSON.stringify(hull.value));
say(hull.logs.some((l) => l.includes("mt_burn") && l.includes("paid the shipwright")), "the payment is logged as a burn");
const supplyAfter = call("mt_supply", { token_id: "cloth" }).value;
say(BigInt(supplyBefore) - BigInt(supplyAfter) === BigInt(PARTS[0].cost), "the supply went down by the hull's price", `${supplyBefore} -> ${supplyAfter}`);
const skip = paid(2, 18, "cloth");
say(!skip.ok, "parts cannot be skipped");
const back = paid(1, 15, "salt");
say(!back.ok, "time only runs forward");
let boat = hull.value;
for (let p = 1; p < PARTS.length; p++) boat = paid(p, 21, "cloth").value;
const totalCost = PARTS.reduce((a, b) => a + b.cost, 0);
say(boat.parts === 4 && boat.paid[3] === totalCost, "a whole boat, paid part by part", JSON.stringify(boat));
const poor = call("build", { part: 0, town_day: 21, good: "cloth" });
const again = call("build", { part: 1, town_day: 21, good: "cloth" });
say(poor.ok && !again.ok, "a new season starts a new boat, and the bag runs out");
const costs = fs.readFileSync(new URL("../contract/src/lib.rs", import.meta.url), "utf8").match(/PART_COST: \[u64; 4\] = \[([^\]]+)\]/)[1];
say(costs.replace(/\s/g, "") === PARTS.map((p) => p.cost).join(","), "part prices in the contract = engine/island.js", costs);
const keys = fs.readFileSync(new URL("../contract/src/lib.rs", import.meta.url), "utf8");
say(!/fn\s+mint\b/.test(keys), "still no mint method");
console.log(`RINGKASAN: ${failures ? failures + " FAIL" : "all PASS"}`);
process.exit(failures ? 1 : 0);
