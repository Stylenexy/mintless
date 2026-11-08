# Changelog

Newest first. The git history has the full order.

## 2026-11-09

- When nobody will take what you carry today, the guide says to sleep (the village trades again at dawn) instead of telling you to keep fishing.
- The title screen shows one button, Play, to a first-time player. Daily island and Mystery island appear after the first sail; Jump to the storm needs the `?demo` link.

## 2026-11-07

- Daily mystery island from the UTC date, with identical full prices and deadline for all players, a seeded fishing sequence and a local top ten per day. No server or contract change.
- Help remains reachable on small screens; it explains movement, leaving fishing and the gold bag slot. First-voyage help and day counter now say there is no deadline and show the actual day after day ten.
- Independent baseline: 52 tests pass, old newcomer simulation 0/20 sail and first voyage 20/20. With 17 new checks, 69 pass; the offline bundle builds and parses. No new human or browser playtest.
- First voyage: a boat at about half price and no deadline, so a new player reaches the sail. Every later island is the full game.
- The gold trail no longer doubles back, and a gold marker floats over the next stop.
- Villagers stand further apart, the guide's villager wins when several are in reach, and a swap off the route asks first.
- Drag turns and tilts the view everywhere.
- A proper sound for a catch, and a golden hour with +1 fish and its own rare fish.

## 2026-11-05

- Rendering capped at 60 frames per second.
- CI, `SECURITY.md`, `CLAIMS.md` and this file.
- The shipwright moves into the contract: `build`, `shipyard`, `boat_of`. Built, not deployed.
- Browser guest account and signing with no wallet or popup: `web/chain-play.js`. Not live yet.
- Swaps last until dusk, so the town's path stays a pure function of rules and seed.
- The first island uses seed 7, so the money moves on the morning of day 7.
- The demo clip opens on the morning the money moves.
- Rebuilt as a soft painted island: a boat to fix in ten nights, Mira as a rival, fish cards, a rideable duck, phone controls.
- Block island in 3D with fishing and savings that can collapse. Kept at `web/v4/`.

## 2026-11-04

- Readable digits, a night summary, honest rain text.

## 2026-11-03

- Town engine: money emerges from barter, and one rule change moves it.
- Playable town in the browser, then a pixel market town and a side-scrolling town. Kept at `web/2d/`.
- NEAR contract: the town runs on chain, goods are NEP-245 tokens, no mint, no admin.
- Mystery towns: spoil rates from a public table.
- README for judges and a single-file build.
