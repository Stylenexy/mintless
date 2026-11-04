// Prints one signed transaction made by near-api-js with a fixed key, the
// reference that test/chain-play.test.js holds web/chain-play.js to.
import crypto from "node:crypto";
import { KeyPair, KeyPairSigner, actions, baseEncode, createTransaction } from "near-api-js";

const seed = Buffer.alloc(32, 7);
const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]);
const priv = crypto.createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
const pub = crypto.createPublicKey(priv).export({ format: "der", type: "spki" }).subarray(-32);
const pair = KeyPair.fromString(`ed25519:${baseEncode(Buffer.concat([seed, pub]))}`);
const blockHash = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const tx = createTransaction("guest.testnet", pair.getPublicKey(), "town.testnet", 188000000000123n, [actions.functionCall("build", { part: 1, town_day: 18, good: "cloth" }, 300000000000000n, 0n)], blockHash);
const [, signed] = await new KeyPairSigner(pair).signTransaction(tx).then((r) => (Array.isArray(r) ? r : [null, r.signedTransaction ?? r]));
console.log(JSON.stringify({ pkcs8: pkcs8.toString("base64"), pub: pub.toString("base64"), signed: Buffer.from(signed.encode()).toString("base64") }));
