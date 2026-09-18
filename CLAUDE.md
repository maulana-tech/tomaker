# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Two toolchains

`contracts/` is Foundry (solc 0.8.28, `via_ir`). `web/` is a pnpm workspace
(Node 20.x) with two packages: `@tomaker/sdk` (`web/sdk`) and `@tomaker/app`
(`web/app`). They share nothing but the deployment manifests in
`contracts/deployments/`.

## Commands

### Contracts (`cd contracts`)

```bash
python3 scripts/install-deps.py   # lib/ is NOT committed; run before the first build
forge build
forge test
forge test --match-contract TokenizerLifecycleTest        # one suite
forge test --match-test test_splitMintsEqualFaces -vvv    # one test
RUN_ATS_LIVE=true forge test                              # adds read-only ATS fork checks
FOUNDRY_PROFILE=hedera_live forge build                   # cancun; what the live market was compiled with
python3 scripts/check-deployed-bytecode.py                # verify deployed code matches source
```

The default profile is `evm_version = paris`; `hedera_live` is `cancun`. A
default build produces different bytecode from what is on testnet, so any
bytecode/verification work must use `FOUNDRY_PROFILE=hedera_live`. Live ATS
tests are skipped (`vm.skip`) unless `RUN_ATS_LIVE=true`.

### Web (`cd web`)

```bash
pnpm install
pnpm --filter @tomaker/sdk build          # ALWAYS first; the app imports dist/, not src/
pnpm --filter @tomaker/app dev

pnpm --filter @tomaker/sdk test
pnpm --filter @tomaker/app test           # vitest: tests/**/*.test.ts(x)
pnpm --filter @tomaker/app exec vitest run tests/slippage.test.ts   # one file
pnpm --filter @tomaker/app run typecheck
pnpm --filter @tomaker/app run lint

pnpm --filter @tomaker/app test:e2e       # playwright: e2e/**/*.spec.ts, dev server on :3100
pnpm --filter @tomaker/app exec playwright test e2e/smoke.spec.ts --project=desktop-chromium
```

Playwright browsers need `pnpm exec playwright install chromium` once. e2e
specs live in `e2e/` and are excluded from vitest — do not mix the two dirs.

CI (`.github/workflows/ci.yml`) runs exactly: contracts build+test, then
sdk typecheck/test/build, then sdk build → app typecheck/test/build.

## Architecture

Three protocol layers, each with a matching frontend page:

| Layer | Contracts | What it does |
|---|---|---|
| 1 | `sy/StandardizedYieldVault.sol`, `sy/ERC3643BondStrategy.sol`, `sy/ATSBondAdapter.sol` | wraps an ERC-3643/ATS bond, mints SY at a derived rate |
| 2 | `Tokenizer.sol`, `tokens/PrincipalToken.sol`, `tokens/YieldToken.sol` | split SY → PT+YT, recombine, claim, redeem; maturity rate freeze |
| 3 | `AmmMarket.sol`, `Orderbook.sol` | time-decay AMM with TWAP guard; PT/SY limit-order book |

`ERC3643Bond.sol` is a local *reference* bond for tests, never the production
yield source. Production wraps a real ATS security through `ATSBondAdapter`, and
`IBond3643` is toMaker's settlement ABI — not the ATS token ABI.

Cross-contract privileges are gated on `msg.sender == tokenizer`; admin powers
are a separate axis. `WadMath` supplies integer `ln`/`exp`/`sqrt` — no floats.

### SDK ↔ app split

`@tomaker/sdk` (`ToMakerClient`, viem) does reads and returns **unsigned**
`{ to, data, value }` requests from its `build*` methods. It never holds keys.
Signing, retries and allowance logic live in `web/app/lib/sdk.ts`
(`ensureAllowance`, retryable-read backoff for flaky Hedera RPC). Wallet
plumbing is `lib/privy.tsx` / `lib/wallet.tsx`: Privy embedded wallet when
`NEXT_PUBLIC_PRIVY_APP_ID` is set, injected EVM provider otherwise.

Routes: `app/(marketing)/` is the landing site, `app/(app)/` the trading pages
(invest/mint/trade/orderbook/pool/portfolio), `app/docs/` the in-app docs,
`app/api/` server routes (`runtime = "nodejs"`, `dynamic = "force-dynamic"`).

## Configuration: the main footgun

**Every `NEXT_PUBLIC_*` value is inlined by `next build`.** Setting Cloudflare
Worker vars or Vercel env vars without rebuilding leaves the deployed bundle
stale — the pages keep reporting no configured market. Reconfiguring a market
always means rebuild + redeploy.

Never transcribe addresses; generate them from a manifest:

```bash
cd web/app
pnpm check:env ../../contracts/deployments/hedera-ats.json   # print only
pnpm gen:env   ../../contracts/deployments/hedera-ats.json --out /tmp/public.env
```

`scripts/manifest-to-env.mjs` renames manifest keys (`amm` → `MARKET`, `cash` →
`UNDERLYING`). Its `REQUIRED_FOR_DEPLOYED` list must stay in sync with
`isDeployed()` in `lib/config.ts`. Merge the output into `.env.local` — do not
overwrite, it holds Privy/faucet secrets.

`lib/deployments.ts` holds a checked-in testnet fallback so a fresh clone still
runs the public demo. Mainnet builds never fall back.

### Decimals

Cash (sdUSD) and the ATS bond are **6-decimal**; SY, PT and YT are 18-decimal
(`WAD`). `AppConfig` keeps these apart as `underlyingDecimals` vs
`shareDecimals` — mixing them is the most likely source of a wrong number on
screen. One SY share ≠ one PT/YT pair.

## Deployment

Public demo: Cloudflare Worker `tomaker` via OpenNext
(`pnpm --filter @tomaker/app cf:deploy`). There are **two** wrangler configs —
root `wrangler.jsonc` (repo-root build) and `web/app/wrangler.jsonc` (app-root
build). They mirror each other's bindings (`FAUCET_DB` D1, `ASSETS`,
`WORKER_SELF_REFERENCE`); changing one means changing both.

`.github/workflows/deploy-web.yml` is the alternative Vercel path. It stages a
self-contained copy of `web/app` with the SDK packed as a tarball, because the
Vercel CLI uploads only one directory and cannot see the pnpm workspace root.

Contract deployment: `script/DeployATS.s.sol` issues the bond through the real
ATS factory and builds the market around it (never a mock bond); then
`script/ATSLifecycle.s.sol` runs one named phase at a time (`seed`, `trade`,
`coupon`, `revoke`, `reinstate`, `settle`). Hedera needs `--slow` (stale nonce
reporting) and `--gas-estimate-multiplier 200`. Timing rules, including the
PT-heavy first seed the AMM requires, are in `contracts/ATS_DEPLOYMENT.md`.

## Landing-page 3D scene

`web/app/lib/world/` drives a scroll-scrubbed WebGL scene; its art direction is
specified in `lib/world/WORLD.md` and enforced by `e2e/` specs. One hard rule:
amber `#FFAC2E` marks the yield token and nothing else — never a ring, a light,
or a UI element.

## Evidence files

`contracts/deployments/*.json` and `deployments/evidence/*.json` are records of
real testnet transactions. Treat them as append-only history; do not edit them
to make a check pass. Manifests from earlier markets
(`hedera-ats-previous.json`, `hedera-ats-short.json`) must not be mixed with the
current market's addresses.
