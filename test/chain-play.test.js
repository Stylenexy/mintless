// The browser's wallet-free signer and its fallback. No network: fetch is a fake.
import test from "node:test";
import assert from "node:assert/strict";
import { b58decode, b58encode, createChainPlay, signCall } from "../web/chain-play.js";
import { SALT_TOWN } from "../rules/town.js";
import { createTown, stateHash, step } from "../engine/town.js";
import { createRun, nightFall, playDay, shopGood, TOWN_DAYS_PER_NIGHT } from "../engine/island.js";

// From tools/signer-vector.mjs: the same transaction signed by near-api-js 7.4.
const VECTOR = {
  pkcs8: "MC4CAQAwBQYDK2VwBCIEIAcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcH",
  pub: "6kpsY+KcUgq+9VB7Ey7F+ZVHdq6+vnuSQh7qaRRG0iw=",
  signed:
    "DQAAAGd1ZXN0LnRlc3RuZXQA6kpsY+KcUgq+9VB7Ey7F+ZVHdq6+vnuSQh7qaRRG0ix7wDcp/KoAAAwAAAB0b3duLnRlc3RuZXQBAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4fIAEAAAACBQAAAGJ1aWxkJwAAAHsicGFydCI6MSwidG93bl9kYXkiOjE4LCJnb29kIjoiY2xvdGgifQDAbjHZEAEAAAAAAAAAAAAAAAAAAAAAAAB/SzLOZRA/u0CmYfDRWwtySoTyvlzRbfhBCM4qvHjowROjqZFB6TEqfGqxXpxm4dA5H+IgF9xs0Je5bmqRcXcL",
};
const bytes = (s) => Uint8Array.from(Buffer.from(s, "base64"));

test("base58 round trip keeps leading zeros", () => {
  const raw = Uint8Array.from([0, 0, 1, 2, 250, 255]);
  assert.deepEqual(b58decode(b58encode(raw)), raw);
  assert.equal(b58encode(bytes(VECTOR.pub)).length, 44);
});

test("the browser signer matches near-api-js byte for byte", async () => {
  const key = await crypto.subtle.importKey("pkcs8", bytes(VECTOR.pkcs8), "Ed25519", false, ["sign"]);
  const signed = await signCall(
    {
      signer: "guest.testnet",
      publicKey: bytes(VECTOR.pub),
      nonce: 188000000000123n,
      receiver: "town.testnet",
      blockHash: Uint8Array.from({ length: 32 }, (_, i) => i + 1),
      method: "build",
      args: { part: 1, town_day: 18, good: "cloth" },
    },
    key,
  );
  assert.equal(Buffer.from(signed).toString("base64"), VECTOR.signed);
});

test("a played season walks the same path as an untouched town", () => {
  for (const seed of [7, 11]) {
    const played = createTown(SALT_TOWN, seed);
    const pure = createTown(SALT_TOWN, seed);
    const me = createRun(SALT_TOWN);
    const rival = createRun(SALT_TOWN);
    for (let night = 0; night < 9; night++) {
      playDay(played, me, { casts: 4, score: 70, swaps: 10 });
      playDay(played, rival, { casts: 3, score: 55, swaps: 4 });
      nightFall(played, me, [rival]);
      for (let d = 0; d < TOWN_DAYS_PER_NIGHT; d++) step(pure);
      assert.equal(stateHash(played), stateHash(pure), `seed ${seed} night ${night}`);
      assert.equal(shopGood(played), shopGood(pure));
    }
  }
});

test("the first island's storm moves the shipyard to cloth on the morning of day 7", () => {
  const town = createTown(SALT_TOWN, 7);
  const mornings = [];
  for (let m = 0; m < 10; m++) {
    mornings.push(SALT_TOWN.goods[shopGood(town)].key);
    for (let d = 0; d < TOWN_DAYS_PER_NIGHT; d++) step(town);
  }
  assert.deepEqual(mornings.slice(4, 8), ["salt", "salt", "cloth", "cloth"]);
});

const CFG = { rpc: "https://rpc.test", helper: "https://helper.test/account", contract: "town.testnet" };
const json = (result) => ({ ok: true, status: 200, json: async () => ({ result }) });

function fakeNear({ helper = 200, refuse = false } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    if (url === CFG.helper) {
      calls.push("helper");
      return { ok: helper === 200, status: helper };
    }
    const { method, params } = JSON.parse(init.body);
    if (method === "send_tx") {
      calls.push("send_tx");
      return json({ transaction: { hash: `tx${calls.length}` }, status: refuse ? { Failure: {} } : { SuccessValue: "" } });
    }
    if (params.request_type === "view_account") return json({ amount: "1" });
    if (params.request_type === "view_access_key") return json({ nonce: 5, block_hash: b58encode(new Uint8Array(32).fill(9)) });
    if (params.method_name === "bag_of") return json({ result: [...Buffer.from("null")] });
    throw new Error(`unexpected ${method}`);
  };
  return calls;
}

test("a guest joins, and a payment becomes a receipt", async () => {
  const calls = fakeNear();
  const play = createChainPlay(CFG);
  await play.start();
  assert.equal(play.state.status, "ready");
  assert.match(play.state.account, /^mintless-[a-z0-9]+\.testnet$/);
  play.pay(0, 18, "cloth", "Hull", 4);
  await play.settled();
  assert.deepEqual(calls, ["helper", "send_tx", "send_tx"]);
  assert.equal(play.state.receipts.length, 1);
  assert.equal(play.state.receipts[0].ok, true);
  assert.match(play.state.receipts[0].hash, /^tx/);
});

test("the contract saying no is a failed receipt, not a crash", async () => {
  fakeNear({ refuse: false });
  const play = createChainPlay(CFG);
  await play.start();
  fakeNear({ refuse: true });
  play.pay(0, 15, "cloth", "Hull", 4);
  await play.settled();
  assert.equal(play.state.receipts[0].ok, false);
});

test("a rate-limited helper leaves the game local and quiet", async () => {
  const calls = fakeNear({ helper: 429 });
  const play = createChainPlay(CFG);
  await play.start();
  assert.equal(play.state.status, "local");
  assert.match(play.state.error, /429/);
  play.pay(0, 18, "cloth", "Hull", 4);
  await play.settled();
  assert.equal(play.state.receipts.length, 0);
  assert.deepEqual(calls, ["helper"]);
});
