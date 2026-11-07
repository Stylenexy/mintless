# Claims

Every claim this project makes, and how to check it yourself. If a check fails, the claim is wrong.

## Proved

| Claim | Check | Result |
|---|---|---|
| Money emerges from barter, and no good is named in the engine | `npm test`, `npm run proof` | salt became money in 500 of 500 towns, median day 3 |
| One rule change moves the money | `npm run proof` | after the rain, cloth replaced salt in 500 of 500 towns |
| A played season does not change the town's path | `test/chain-play.test.js` | same state hash as an untouched town every night |
| The deployed contract has no access keys | `npm run verify:chain` | 0 keys on `mintless-mvznw81o.testnet` |
| The rules on chain are the rules in this repo | `npm run verify:chain` | hash on chain = sha256 of `rules/town.js` |
| The chain town walks the same path as the local engine | `npm run verify:chain` | fingerprint and money match on day 30 |
| The browser signer is correct | `test/chain-play.test.js` | same bytes as `near-api-js` 7.4 |
| The newcomer simulation independently repeats the previous result | `test/newcomer.test.js` | old full prices: 0/20 sail; first voyage: 20/20, on nights 7 or 8; timings remain estimates |
| Daily islands use the same UTC date seed and full prices for everyone | `test/daily.test.js`, `test/game-flow.test.js` | date boundary, independent town replay, seeded fishing sequence, tutorial/chain settings and replay date checked in Node |
| Daily results rank and persist locally | same | top ten per date, reload, date separation, ordering, invalid saves, unavailable storage and game start/finish checked with stand-ins |
| Newcomer help stays accessible at the small-screen breakpoint | `test/help.test.js`, `test/game-flow.test.js` | CSS regression and real HUD function checked in Node; no browser layout measurement |

## Built, proved only in a stand-in host

The shipwright contract is not deployed yet. The deployed contract is older and has no `build` method.

| Claim | Check | Result |
|---|---|---|
| The contract decides what counts as money each morning | `npm run build:contract`, then `npm run check:wasm` | contract and JS engine agree on 10 mornings; salt refused on day 7, cloth accepted |
| Paying burns the goods | same | supply of cloth falls by 4 for the hull |
| The compiled contract still has no mint method | same | no mint export |

## Not claimed

- No guest has paid on testnet yet, so the time per action on testnet is unmeasured.
- Six newer Rust tests in `contract/src/lib.rs` have not run on the builder's machine. CI runs them.
- Fishing and barter with villagers stay in the browser. The chain can prove what the shipyard accepted and burned, not that you caught the fish.
- Esther reported that she could not get the boat moving, and Rosa enjoyed the idea but found the loop repetitive. Neither has tried these latest changes; the 20/20 simulation does not prove human usability or replay value.
- The latest 360px layout and daily mode have not been tried in a browser or by a human in this verification session. UI function tests use Node stand-ins, not a rendered page.
- Daily scores are local attempts only, editable and dependent on the device clock; there is no shared leaderboard or server verification.
- The contract is not audited.
