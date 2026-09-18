# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Two toolchains

`contracts/` is Foundry (solc 0.8.28, `via_ir`). `web/` is a pnpm workspace
(Node 20.x) with `@tomaker/sdk` (`web/sdk`) and `@tomaker/app` (`web/app`).
They share nothing but the deployment manifests in `contracts/deployments/`.

Foundry is not on PATH by default here: `export PATH="$HOME/.foundry/bin:$PATH"`.

## Commands

### Contracts (`cd contracts`)

```bash
python3 scripts/install-deps.py   # lib/ is NOT committed; run before the first build
forge build
forge test
forge test --match-contract TokenizerLifecycleTest        # one suite
forge test --match-test test_splitMintsEqualFaces -vvv    # one test
```

### Web (`cd web`)

```bash
pnpm install
pnpm --filter @tomaker/sdk build          # ALWAYS first; the app imports dist/, not src/
pnpm --filter @tomaker/app dev

pnpm --filter @tomaker/app test           # vitest: tests/**/*.test.ts(x)
pnpm --filter @tomaker/app exec vitest run tests/slippage.test.ts   # one file
pnpm --filter @tomaker/app run typecheck
pnpm --filter @tomaker/app test:e2e       # playwright: e2e/**/*.spec.ts, dev server on :3100
```

**Never run `next build` while a `next dev` server is live.** Both write the
same `.next`, and the production build clobbers what dev is serving: the page
loads with every chunk 404, which looks like a catastrophic CSS bug and is not.

## Architecture

Three protocol layers, each with a matching frontend page:

| Layer | Contracts | What it does |
|---|---|---|
| 1 | `sy/StandardizedYieldVault.sol`, `sy/ERC3643BondStrategy.sol`, `sy/ERC3643Bond.sol` | custodies a permissioned ERC-3643 bond, mints SY at a derived rate |
| 2 | `Tokenizer.sol`, `tokens/PrincipalToken.sol`, `tokens/YieldToken.sol` | split SY → PT+YT, recombine, claim, redeem; maturity rate freeze |
| 3 | `AmmMarket.sol`, `Orderbook.sol` | time-decay AMM with a TWAP guard; PT/SY limit-order book |

Cross-contract privileges are gated on `msg.sender == tokenizer`; admin powers
are a separate axis. `WadMath` supplies integer `ln`/`exp`/`sqrt` — no floats.

### SDK ↔ app split

`@tomaker/sdk` (`ToMakerClient`, viem) does reads and returns **unsigned**
`{ to, data, value }` from its `build*` methods. It never holds keys. Signing,
retries and allowance logic live in `web/app/lib/sdk.ts`. Wallet plumbing is
`lib/privy.tsx` / `lib/wallet.tsx`.

Routes: `app/(marketing)/` landing, `app/(app)/` trading pages, `app/docs/`,
`app/api/` server routes (`runtime = "nodejs"`, so a static host cannot serve
this app).

## Deployment

`contracts/script/DeployBotChain.s.sol` is the only deploy path. It issues the
bond as well as the market, because BOT Chain has no bond to wrap. Two rules it
encodes, both learned from reverts:

- **Every contract that custodies SY must be a verified holder** — tokenizer,
  AMM and order book, not just the strategy. Otherwise the first `split`
  reverts `NotEligible`.
- **A coupon cannot be scheduled, funded and claimed in one transaction.**
  `scheduleCoupon` rejects a record date at or before now, and `fundCoupon`
  closes at that record date.

The AMM's first `addLiquidity` must be PT-heavy; 50/50 reverts
`ExchangeRateBelowOne` once the SY rate is above par.

## Configuration: the main footgun

**Every `NEXT_PUBLIC_*` value is inlined by `next build`.** Setting Worker or
platform vars without rebuilding leaves the deployed bundle stale. Generate env
from a manifest, never by hand:

```bash
cd web/app && pnpm gen:env ../../contracts/deployments/botchain-testnet.json
```

`scripts/manifest-to-env.mjs` renames keys (`amm` → `MARKET`, `cash` →
`UNDERLYING`); its `REQUIRED_FOR_DEPLOYED` list must stay in sync with
`isDeployed()` in `lib/config.ts`. `lib/deployments.ts` is the checked-in
fallback and is intentionally empty until a market is deployed.

## Network

| | Testnet | Mainnet |
|---|---|---|
| Chain ID | 968 | 677 |
| RPC | `https://rpc.bohr.life` | `https://rpc.botchain.ai` |
| Explorer | `scan.bohr.life` (Blockscout, `/tx/`, `/address/`) | `scan.botchain.ai` |
| Gas token | **tBOT** | BOT |

`eth_getLogs` is disabled on mainnet endpoints; nothing here uses it, and
nothing should start.

## Design system

Colours resolve through CSS variables in `app/globals.css` as **space-separated
RGB channels** (`--ink: 21 19 16`), because Tailwind's alpha utilities compile
to `rgb(var(--x) / 0.1)` and a `#hex` variable breaks all ~112 of them.

`ink` and `paper` are colour names, not roles — ink is always the dark one. The
accent carries two values: `signal` (#5EA6E5) is for marks, fills and rules;
`signal-ink` is the only one allowed to carry a word, because the brand blue is
2.5:1 against the page.

Marketing pages sit on a two-colour WebGL dither field (`DitherBackground`) with
glass `.panel` copy blocks; the app and `/docs` are ledger paper. Type is
HarmonyOS Sans SC, loaded from a pinned jsDelivr subset bundle.

There is no dark mode, and no 3D scene — both were removed deliberately.
