# Security

Mintless is a hackathon project on NEAR testnet. It holds no real money and has not been audited. Do not deploy it to mainnet as it is.

## Reporting a problem

Use GitHub's private report: the Security tab, then "Report a vulnerability". Please do not open a public issue for anything that could change the rules, create goods, or take goods from another player.

Only the `main` branch is supported.

## What this project promises

- No mint: after `new`, supply can only stay the same or go down.
- No admin: no owner, no admin method, no upgrade method.
- No keys: the deployed contract account has 0 access keys. Check it with `npm run verify:chain`.

A way around any of these is the most useful report you can send.

## Keys

- The browser guest key is a throwaway testnet key kept in localStorage. Anything else on that page can read it, so it must never hold real value.
- Deploy keys are written to `.keys/`, which git ignores. They are throwaway testnet keys.
- The game asks for no wallet, seed phrase or password.

## Out of scope

- Rate limits on NEAR's public testnet services.
- Cheating in the local browser game. Fishing and barter with villagers run in the browser, as `CLAIMS.md` says.
