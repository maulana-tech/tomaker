# toMaker web

Frontend and TypeScript SDK for toMaker on **BOT Chain**. The app drives the
full protocol lifecycle — deposit, split, trade, provide liquidity, claim,
redeem — and ships the in-app documentation at `/docs`.

| Path | Contents |
|---|---|
| `app/` | Next.js: marketing site, trading app, `/docs` |
| `sdk/` | `@tomaker/sdk`, the viem client for the contracts |

## Develop

```bash
nvm use 20            # Node 20.x
pnpm install
pnpm --filter @tomaker/sdk build     # always first: the app imports dist/, not src/
pnpm --filter @tomaker/app dev
```

Without contract addresses the app still builds and runs; it reports no
configured market rather than pointing at addresses that are not there.

## Configuring a market

Generate the env from a deployment manifest instead of transcribing addresses:

```bash
cd app
pnpm check:env ../../contracts/deployments/botchain-testnet.json   # print, write nothing
pnpm gen:env   ../../contracts/deployments/botchain-testnet.json --out .env.local
```

The generator renames manifest keys to env names (`amm` → `MARKET`, `cash` →
`UNDERLYING`), rejects a `chainId` that is not 968 or 677, rejects malformed and
zero addresses, fails when the result would leave `isDeployed()` false, and
emits the identity-registry and compliance addresses the faucet needs.

Key variables: `NEXT_PUBLIC_BOT_CHAIN_ID`, `NEXT_PUBLIC_BOT_RPC_URL`, the
protocol addresses (`NEXT_PUBLIC_SY_ADDRESS`, `_PT_`, `_YT_`, `_TOKENIZER_`,
`_MARKET_`, `_ORDERBOOK_`), the yield source (`_BOND_`, `_STRATEGY_`,
`_UNDERLYING_`) and eligibility (`_REGISTRY_`, `_COMPLIANCE_`).

### These values are build-time, not runtime

**Every `NEXT_PUBLIC_*` value is baked into the browser bundle by `next build`.**
Next inlines only what is present in the build environment; an unset variable is
permanently `undefined` on the client. Setting Cloudflare Worker variables
without rebuilding leaves the deployed bundle exactly as it was.

So configuring a market always means rebuild and redeploy:

```bash
pnpm check:env ../../contracts/deployments/botchain-testnet.json
pnpm cf:deploy
```

To confirm the addresses reached the client, grep the emitted bundle. Absence
means the build did not see the env file:

```bash
rg -l "0x<sy-address>" .next/static/chunks/
```

## Wallet

The financial pages share a Privy embedded wallet when
`NEXT_PUBLIC_PRIVY_APP_ID` is set; otherwise the app uses the injected EVM
provider. Either way the SDK builds unsigned transactions and holds no keys.

`lib/wallet.tsx` handles `wallet_switchEthereumChain` and falls back to
`wallet_addEthereumChain`, so a visitor whose wallet does not know BOT Chain
adds it in one prompt.

## Testnet faucet

`/api/faucet` verifies a Privy access token and linked embedded-wallet
ownership, records a durable D1 allocation, marks the wallet verified in the
identity registry and allowed in the compliance module, then transfers test cash
plus a little tBOT for gas.

It needs `FAUCET_PRIVATE_KEY`, `PRIVY_APP_SECRET`, `NEXT_PUBLIC_PRIVY_APP_ID`,
`NEXT_PUBLIC_FAUCET_ENABLED=1`, and the `FAUCET_DB` D1 binding. Missing
authentication or storage disables funding.

On the demo market the cash token's `mint` and both eligibility setters are
unrestricted, so a visitor can self-serve without the route at all. If you are
not configuring Privy and D1, set `NEXT_PUBLIC_FAUCET_ENABLED=0` so no button
promises something that will fail.

## Test

```bash
pnpm --filter @tomaker/sdk run typecheck && pnpm --filter @tomaker/sdk test
pnpm --filter @tomaker/app run typecheck && pnpm --filter @tomaker/app test
pnpm --filter @tomaker/app test:e2e      # Playwright, dev server on :3100
```

## SDK

`@tomaker/sdk` exposes a `ToMakerClient` with reads (`getMarket`, `getPosition`,
`getLpPosition`, `quoteSwap`, `previewDeposit`, `getRestingOrders`,
`getBondInfo`, `getTokenBalance`, `getAllowance`, …) and builders that return an
unsigned `{ to, data, value }` (`buildApprove`, `buildDeposit`, `buildSplit`,
`buildSwap`, `buildRedeem`, `buildClaimYield`, `buildAddLiquidity`,
`buildPlaceOrder`, …). `ensureAllowance` in `app/lib/sdk.ts` reads an allowance
and returns an approval request when one is needed.

## Deploy

The app has server routes (`/api/faucet`, `/api/health`,
`/api/privy/delegated-exit`), so a static host such as GitHub Pages cannot serve
it. It deploys to **Cloudflare Workers** through OpenNext:

```bash
pnpm install --frozen-lockfile
pnpm --filter @tomaker/app cf:deploy
```

There are two wrangler configs — the repository root and `app/` — and they
mirror each other's bindings and Worker name. Change one, change both. The D1
`database_id` in each must be a database in your own Cloudflare account:

```bash
pnpm exec wrangler d1 create tomaker-faucet
pnpm exec wrangler d1 migrations apply tomaker-faucet --remote
```

## License

Apache-2.0. See `../contracts/LICENSE`.
