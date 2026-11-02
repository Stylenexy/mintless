// Deploy a Mintless town to NEAR TESTNET, play it, lock it, prove it.
// Throwaway accounts from the testnet helper; keys live only in memory.
//
//   npm --prefix tools install
//   node tools/chain.mjs            full run: deploy, play, delete the last key
//   node tools/chain.mjs --keep     same, but keep the key (to delete it live on stage)
//   node tools/chain.mjs --lock <account>   delete that key later (reads .keys/<account>.txt)
import fs from "node:fs";
import { Account, JsonRpcProvider, KeyPair, teraToGas } from "near-api-js";
import { SALT_TOWN } from "../rules/town.js";
import { createTown, run, stateHash } from "../engine/town.js";
import { prices } from "../engine/player.js";

const RPC = process.env.NEAR_RPC ?? "https://rpc.testnet.near.org";
const HELPER = "https://helper.nearprotocol.com/account";
const WASM = new URL("../contract/target/wasm32-unknown-unknown/release/mintless_town.wasm", import.meta.url);
const provider = new JsonRpcProvider({ url: RPC });
const GAS = teraToGas("300");
const runId = Date.now().toString(36);
const lines = [];
let failures = 0;
const say = (ok, name, detail = "") => {
  const line = `${ok ? "PASS" : "FAIL"} | ${name}${detail ? " | " + detail : ""}`;
  if (!ok) failures++;
  console.log(line);
  lines.push(line);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const view = (contractId, method, args = {}) => provider.callFunction({ contractId, method, args });

async function throwaway(prefix) {
  const kp = KeyPair.fromRandom("ed25519");
  const id = `${prefix}-${runId}.testnet`;
  const res = await fetch(HELPER, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ newAccountId: id, newAccountPublicKey: kp.getPublicKey().toString() }),
  });
  if (!res.ok) throw new Error(`helper ${res.status} ${await res.text()}`);
  for (let i = 0; i < 20; i++) {
    try {
      await provider.viewAccount({ accountId: id });
      break;
    } catch {
      await sleep(1500);
    }
  }
  return { account: new Account(id, provider, kp.toString()), secret: kp.toString() };
}

async function lock(account) {
  const keys = await account.getAccessKeyList();
  for (const k of keys.keys) await account.deleteKey(k.public_key);
  await sleep(2500);
  return (await provider.viewAccessKeyList({ accountId: account.accountId })).keys.length;
}

if (process.argv[2] === "--lock") {
  const id = process.argv[3];
  const secret = fs.readFileSync(new URL(`../.keys/${id}.txt`, import.meta.url), "utf8").trim();
  const left = await lock(new Account(id, provider, secret));
  console.log(left === 0 ? `${id} is locked: zero access keys. Nobody can deploy, upgrade or mint.` : `still ${left} key(s)`);
  process.exit(left === 0 ? 0 : 1);
}

const keep = process.argv.includes("--keep");
const rulesJson = JSON.stringify(SALT_TOWN);
const SEED = 1;

console.log(`== Mintless on NEAR testnet (${new Date().toISOString()}) ==`);
const town = await throwaway("mintless");
const dex = await throwaway("player");
const C = town.account;
say(true, "throwaway accounts", `town=${C.accountId} player=${dex.account.accountId}`);

await C.deployContract(fs.readFileSync(WASM));
await C.callFunction({
  contractId: C.accountId,
  methodName: "new",
  args: { rules_json: rulesJson, seed: SEED, day_seconds: "0", max_days: 60, stall: Array(5).fill("100000"), starter: ["0", "10", "10", "0", "10"], bags: 200 },
  gas: GAS,
});
const t0 = await view(C.accountId, "town");
const localHash = (await import("node:crypto")).createHash("sha256").update(rulesJson).digest("hex");
say(t0.rules_hash === localHash, "C01 rules on chain = rules/town.js", `sha256 ${t0.rules_hash.slice(0, 16)}…`);
const supply0 = await view(C.accountId, "mt_batch_supply", { token_ids: SALT_TOWN.goods.map((g) => g.key) });

await dex.account.callFunction({ contractId: C.accountId, methodName: "join", args: {}, gas: GAS });
const bag = await view(C.accountId, "bag_of", { account_id: dex.account.accountId });
say(bag.units.join(",") === "0,10,10,0,10", "C02 player joined, starter bag from the chest", `bag=${bag.units.join(",")}`);

const got = await dex.account.callFunction({ contractId: C.accountId, methodName: "swap", args: { give: "fish", amount: "10", get: "salt" }, gas: GAS });
say(Number(got) > 0, "C03 swap 10 fish -> salt at town prices", `got ${got} salt`);

const outcome = await C.callFunctionRaw({ contractId: C.accountId, methodName: "tick", args: { days: 10 }, gas: GAS, waitUntil: "FINAL" });
const burnt = outcome.receipts_outcome.reduce((s, r) => s + Number(r.outcome.gas_burnt), 0);
let t = await view(C.accountId, "town");
say(t.day === 10, "C04 tick: 10 days in one call", `gas ${(burnt / 1e12).toFixed(1)} TGas`);
const local10 = run(createTown(SALT_TOWN, SEED), 10);
const fp10 = await view(C.accountId, "fingerprint");
say(fp10 === stateHash(local10) && JSON.stringify(t.prices) === JSON.stringify(prices(local10)), "C05 chain town = local JS engine on day 10", `fingerprint ${fp10}, money ${t.money}`);

say(keep || (await lock(C)) === 0, keep ? "C06 key kept for a live lock on stage (--keep)" : "C06 contract locked: zero access keys");

const stranger = await throwaway("stranger");
await stranger.account.callFunction({ contractId: C.accountId, methodName: "tick", args: { days: 10 }, gas: GAS });
await stranger.account.callFunction({ contractId: C.accountId, methodName: "tick", args: { days: 10 }, gas: GAS });
t = await view(C.accountId, "town");
say(t.day === 30, `C07 a stranger advanced the town to day 30${keep ? "" : " after the lock"}`, `money ${t.money}`);
const local30 = run(createTown(SALT_TOWN, SEED), 30);
say(JSON.stringify(t.prices) === JSON.stringify(prices(local30)) && t.money === "cloth", "C08 the rain switched the money to cloth, same as local", `prices ${t.prices.join(",")}`);

await dex.account.callFunction({ contractId: C.accountId, methodName: "settle", args: { account_id: dex.account.accountId }, gas: GAS });
const supply1 = await view(C.accountId, "mt_batch_supply", { token_ids: SALT_TOWN.goods.map((g) => g.key) });
const down = supply1.every((s, g) => BigInt(s) <= BigInt(supply0[g]));
const anyDown = supply1.some((s, g) => BigInt(s) < BigInt(supply0[g]));
say(down && anyDown, "C09 supply only went down (rot burned), never up", `${supply0.join(",")} -> ${supply1.join(",")}`);

const keys = await provider.viewAccessKeyList({ accountId: C.accountId });
console.log(`\ncontract: ${C.accountId}  keys left: ${keys.keys.length}`);
if (keep) {
  // Throwaway testnet key, kept out of git (.keys/ is ignored) for the live lock on stage.
  fs.mkdirSync(new URL("../.keys/", import.meta.url), { recursive: true });
  fs.writeFileSync(new URL(`../.keys/${C.accountId}.txt`, import.meta.url), town.secret);
  console.log(`lock it on stage: node tools/chain.mjs --lock ${C.accountId} (key in .keys/)`);
}
console.log(`RINGKASAN: ${lines.length - failures} PASS, ${failures} FAIL`);

fs.writeFileSync(new URL("./chain-report.txt", import.meta.url), `testnet ${new Date().toISOString()}\n${lines.join("\n")}\n\ncontract ${C.accountId}\n`);
fs.writeFileSync(new URL("../web/chain.json", import.meta.url), JSON.stringify({ network: "testnet", rpc: RPC, contract: C.accountId, seed: SEED, deployed: new Date().toISOString() }, null, 2) + "\n");
process.exit(failures ? 1 : 0);
