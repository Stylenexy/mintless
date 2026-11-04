// Pays the shipwright on NEAR testnet with no wallet and no popup. This browser
// gets a throwaway guest account, its key stays in localStorage, and every
// payment is a transaction the contract can refuse. When the helper or the RPC
// says no, the game simply stays local.

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const GAS = 300000000000000n;
const GUEST_KEY = "mintless-guest";
const text = new TextEncoder();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function b58encode(bytes) {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let out = "";
  for (; n > 0n; n /= 58n) out = B58[Number(n % 58n)] + out;
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

export function b58decode(str) {
  let n = 0n;
  for (const c of str) n = n * 58n + BigInt(B58.indexOf(c));
  const out = [];
  for (; n > 0n; n /= 256n) out.unshift(Number(n % 256n));
  for (const c of str) {
    if (c !== "1") break;
    out.unshift(0);
  }
  return Uint8Array.from(out);
}

const u32 = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
const uint = (v, size) => Array.from({ length: size }, (_, i) => Number((BigInt(v) >> BigInt(i * 8)) & 255n));
const str = (s) => {
  const b = text.encode(s);
  return [...u32(b.length), ...b];
};

// A signed-for transaction with one FunctionCall, in borsh.
export function encodeCall({ signer, publicKey, nonce, receiver, blockHash, method, args }) {
  const body = text.encode(JSON.stringify(args));
  return Uint8Array.from([
    ...str(signer),
    0, ...publicKey,
    ...uint(nonce, 8),
    ...str(receiver),
    ...blockHash,
    ...u32(1),
    2, ...str(method), ...u32(body.length), ...body, ...uint(GAS, 8), ...uint(0, 16),
  ]);
}

export async function signCall(tx, privateKey) {
  const bytes = encodeCall(tx);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const sig = new Uint8Array(await crypto.subtle.sign("Ed25519", privateKey, hash));
  return Uint8Array.from([...bytes, 0, ...sig]);
}

const base64 = (bytes) => btoa(String.fromCharCode(...bytes));
const unbase64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function remembered() {
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY) ?? "null");
  } catch {
    return null;
  }
}
function remember(guest) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
  } catch {
    // no storage: this tab's guest lasts as long as the tab
  }
}

async function newKeys() {
  const pair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
  return {
    pkcs8: base64(new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey))),
    pub: base64(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))),
  };
}

export function createChainPlay(cfg) {
  const state = { status: "off", account: null, receipts: [], error: null };
  let guest = null;
  let key = null;
  let pub = null;
  let access = null;
  let queue = Promise.resolve();
  const enqueue = (job) => (queue = queue.then(job, job));

  async function rpc(method, params) {
    const res = await fetch(cfg.rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.json();
    if (body.error) throw new Error(body.error.data?.message ?? body.error.cause?.name ?? body.error.message ?? "rpc error");
    return body.result;
  }

  const view = async (method, args) => {
    const r = await rpc("query", { finality: "final", request_type: "call_function", account_id: cfg.contract, method_name: method, args_base64: btoa(JSON.stringify(args)) });
    return JSON.parse(String.fromCharCode(...r.result));
  };

  async function exists(id) {
    try {
      await rpc("query", { finality: "final", request_type: "view_account", account_id: id });
      return true;
    } catch {
      return false;
    }
  }

  async function makeGuest() {
    const keys = await newKeys();
    const id = `mintless-${crypto.getRandomValues(new Uint32Array(2)).reduce((s, n) => s + n.toString(36), "")}.testnet`;
    const res = await fetch(cfg.helper, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newAccountId: id, newAccountPublicKey: `ed25519:${b58encode(unbase64(keys.pub))}` }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`the testnet account helper said ${res.status}`);
    for (let i = 0; i < 15 && !(await exists(id)); i++) await wait(1000);
    const made = { id, ...keys };
    remember(made);
    return made;
  }

  async function send(method, args) {
    // The nonce is counted here after the first read, so a payment is one round trip.
    access ??= await rpc("query", { finality: "final", request_type: "view_access_key", account_id: guest.id, public_key: `ed25519:${b58encode(pub)}` });
    const signed = await signCall({ signer: guest.id, publicKey: pub, nonce: BigInt(++access.nonce), receiver: cfg.contract, blockHash: b58decode(access.block_hash), method, args }, key);
    try {
      const res = await rpc("send_tx", { signed_tx_base64: base64(signed), wait_until: "EXECUTED_OPTIMISTIC" });
      return { hash: res.transaction.hash, ok: "SuccessValue" in res.status };
    } catch (e) {
      access = null;
      throw e;
    }
  }

  return {
    state,
    // Quietly get this browser a guest and a starter bag. Safe to call each season.
    start() {
      if (state.status === "ready" || state.status === "starting") return queue;
      state.status = "starting";
      return enqueue(async () => {
        try {
          guest = remembered();
          if (guest && !(await exists(guest.id))) guest = null;
          guest ??= await makeGuest();
          key = await crypto.subtle.importKey("pkcs8", unbase64(guest.pkcs8), "Ed25519", false, ["sign"]);
          pub = unbase64(guest.pub);
          if (!(await view("bag_of", { account_id: guest.id }))) {
            const joined = await send("join", {});
            if (!joined.ok) throw new Error("the town refused a new player");
          }
          state.account = guest.id;
          state.status = "ready";
        } catch (e) {
          state.status = "local";
          state.error = e.message;
        }
      });
    },
    // One boat part, one transaction. Never blocks the game.
    pay(part, townDay, good, label, cost) {
      return enqueue(async () => {
        if (state.status !== "ready") return;
        const t0 = performance.now();
        try {
          const r = await send("build", { part, town_day: townDay, good });
          state.receipts.push({ label, good, cost, ...r, ms: Math.round(performance.now() - t0) });
        } catch (e) {
          state.receipts.push({ label, good, cost, ok: false, error: e.message, ms: Math.round(performance.now() - t0) });
        }
      });
    },
    settled: () => queue,
  };
}
