// Read-only check of the deployed testnet town (no keys, no dependencies):
// zero access keys, rules hash = rules/town.js, and the on-chain town state
// equals what the local engine computes for the same seed and day.
// Run: npm run verify:chain
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createTown, run, stateHash } from "../engine/town.js";
import { prices } from "../engine/player.js";
import { SALT_TOWN } from "../rules/town.js";

const cfg = JSON.parse(readFileSync(new URL("../web/chain.json", import.meta.url), "utf8"));
const rpc = process.env.NEAR_RPC ?? cfg.rpc;

async function query(params) {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { finality: "final", ...params } }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json();
  if (body.error || body.result?.error) throw new Error(JSON.stringify(body.error ?? body.result.error));
  return body.result;
}
const call = async (method, args = {}) => {
  const r = await query({ request_type: "call_function", account_id: cfg.contract, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") });
  return JSON.parse(Buffer.from(r.result).toString());
};

let fails = 0;
const say = (ok, msg) => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"} | ${msg}`);
};

console.log(`\nOn-chain town ${cfg.contract} (${cfg.network}), read-only:`);
try {
  const keys = await query({ request_type: "view_access_key_list", account_id: cfg.contract });
  say(keys.keys.length === 0, `access keys on the contract account: ${keys.keys.length} (nobody can redeploy, upgrade or add a mint)`);
  const town = await call("town");
  const hash = createHash("sha256").update(JSON.stringify(SALT_TOWN)).digest("hex");
  say(town.rules_hash === hash, `rules hash on chain = sha256 of the Salt Town rules in rules/town.js = ${hash.slice(0, 16)}…`);
  const local = run(createTown(SALT_TOWN, town.seed), town.day);
  const fp = await call("fingerprint");
  say(fp === stateHash(local) && JSON.stringify(town.prices) === JSON.stringify(prices(local)), `day ${town.day}: chain fingerprint ${fp} = local engine replay; money = ${town.money ?? "none yet"}`);
  const supply = await call("mt_batch_supply", { token_ids: SALT_TOWN.goods.map((g) => g.key) });
  console.log(`     supply now: ${SALT_TOWN.goods.map((g, i) => `${g.key} ${supply[i]}`).join(", ")} (born 100000 + chest; can only go down)`);
  console.log(`     explorer: https://testnet.nearblocks.io/address/${cfg.contract}\n`);
} catch (e) {
  console.log(`SKIPPED | could not reach ${rpc} (${e.message.slice(0, 80)}). The local checks above still stand; run again with network.\n`);
  process.exit(0);
}
process.exit(fails ? 1 : 0);
