# toMaker

**Split a bond's fixed principal from its floating yield, and trade them
separately.** Built on [BOT Chain](https://botchain.ai).

Buy a bond and you get two things bundled together: the money back at the end,
and the interest along the way. toMaker separates them into two tokens you can
hold or sell independently:

- **PT** (Principal Token) — redeems for the principal at maturity. Fixed.
- **YT** (Yield Token) — collects the interest until maturity. Floating.

Someone who wants a predictable return buys PT and ignores the rest. Someone
who thinks rates will rise buys YT. Both trade on an AMM and an order book that
ship with the protocol.

> **Testnet demonstration. Unaudited.** The bond and the cash token are
> demonstration assets with no real value. Do not treat any of this as a
> financial product.

---

## How someone uses it

1. **Connect a wallet.** The site adds BOT Chain in one prompt if the wallet
   does not know it yet, so no manual network setup.
2. **Get eligible and get cash.** The bond is a permissioned ERC-3643 security:
   an identity registry has to mark the wallet verified before it can hold
   anything. On this demo market that is self-serve.
3. **Deposit** cash into the SY vault. SY is a receipt that quietly grows in
   value as the bond accrues.
4. **Split** SY into equal amounts of PT and YT.
5. **Trade** either leg on the AMM or the PT/SY order book.
6. **Claim** accrued yield as a YT holder, **recombine** PT + YT back into SY,
   or **redeem** at maturity.

The in-app documentation at `/docs` explains each step with the actual numbers.

---

## Deployment

Addresses live in the manifests under `contracts/deployments/`, which the
deploy script writes. The frontend is built from the same manifest, so the
addresses in the app and the addresses here cannot drift apart.

### BOT Chain Testnet — chain 968

| Contract | Address |
|---|---|
| Bond (ERC-3643 security) | [`0x970C3114C5Dcf853692bc8D3e0598d1AC9D12185`](https://scan.bohr.life/address/0x970C3114C5Dcf853692bc8D3e0598d1AC9D12185) |
| Identity registry | [`0xD04A92C83AFe71f4f69F9FAD0A33229BFBdE33E6`](https://scan.bohr.life/address/0xD04A92C83AFe71f4f69F9FAD0A33229BFBdE33E6) |
| Compliance module | [`0x44b99f76f12e0Ece22f6bD76DcB305Afcf25876D`](https://scan.bohr.life/address/0x44b99f76f12e0Ece22f6bD76DcB305Afcf25876D) |
| Cash token (tUSD, test only) | [`0x6d4d017dE8d0A36dce7856Ee989624C6A18cD9Ea`](https://scan.bohr.life/address/0x6d4d017dE8d0A36dce7856Ee989624C6A18cD9Ea) |
| SY vault | [`0x40c3323992dD140Fc3770ceE5A6B23165aD36Fc1`](https://scan.bohr.life/address/0x40c3323992dD140Fc3770ceE5A6B23165aD36Fc1) |
| Bond strategy | [`0x588DeC15D915659E8BF36c01e662479916301d3A`](https://scan.bohr.life/address/0x588DeC15D915659E8BF36c01e662479916301d3A) |
| PT | [`0x8Db79e6Ca738D7F212Db208B4f9889Caf931a68A`](https://scan.bohr.life/address/0x8Db79e6Ca738D7F212Db208B4f9889Caf931a68A) |
| YT | [`0x3152B6f625F25B6a2Aa0Adb57017eB74acA65ecB`](https://scan.bohr.life/address/0x3152B6f625F25B6a2Aa0Adb57017eB74acA65ecB) |
| Tokenizer | [`0xA0c9791e4FE34734D06fDD2ded0C0e0cd5b7F0f6`](https://scan.bohr.life/address/0xA0c9791e4FE34734D06fDD2ded0C0e0cd5b7F0f6) |
| AMM | [`0xE67A87b2eCBbE03B90cac2cA3C494a3e1be5f615`](https://scan.bohr.life/address/0xE67A87b2eCBbE03B90cac2cA3C494a3e1be5f615) |
| Order book | [`0x1d19a197B9860bD831F84d30E51584d62796f362`](https://scan.bohr.life/address/0x1d19a197B9860bD831F84d30E51584d62796f362) |

**Deployer**: [`0x3a8d93D5F52a26689b075A49E67F4f8924BeC84B`](https://scan.bohr.life/address/0x3a8d93D5F52a26689b075A49E67F4f8924BeC84B)  
**Maturity**: `1797571070` (Unix timestamp)  
**Market ID**: `botchain-bond-q4`

### BOT Chain Mainnet — chain 677

| Contract | Address |
|---|---|
| _(same eleven contracts)_ | _not deployed yet_ |

An address that is not listed has not been deployed. This table is filled from
`contracts/deployments/botchain-testnet.json` and `-mainnet.json`; if they ever
disagree, the manifest is authoritative.

### Deploying

```bash
cd contracts
python3 scripts/install-deps.py       # Solidity deps are pinned, not vendored
export PRIVATE_KEY=0x...
forge script script/DeployBotChain.s.sol:DeployBotChain \
  --rpc-url https://rpc.bohr.life --broadcast --slow
```

One transaction deploys all eleven contracts, seeds the AMM and the order book
so the first visitor can actually trade, and schedules a funded coupon. Swap
the RPC for `https://rpc.botchain.ai` to deploy to mainnet; the script reads
the chain id and writes the matching manifest.

Then point the app at it:

```bash
cd web/app
pnpm gen:env ../../contracts/deployments/botchain-testnet.json --out .env.local
```

---

## Network reference

| | Testnet | Mainnet |
|---|---|---|
| Chain ID | `968` | `677` |
| RPC | `https://rpc.bohr.life` | `https://rpc.botchain.ai` |
| Explorer | <https://scan.bohr.life> | <https://scan.botchain.ai> |
| Gas token | tBOT | BOT |
| Faucet | <https://faucet.botchain.ai/basic> (10 tBOT / 24h) | — |

---

## How it is built

Three layers, each with its own page in the app:

| Layer | Contracts | What it does |
|---|---|---|
| 1 | `StandardizedYieldVault`, `ERC3643BondStrategy`, `ERC3643Bond` | custodies the permissioned bond, mints SY at a derived rate |
| 2 | `Tokenizer`, `PrincipalToken`, `YieldToken` | splits SY into PT + YT, recombines, claims, redeems, freezes the rate at maturity |
| 3 | `AmmMarket`, `Orderbook` | a time-decay AMM with a TWAP guard, and a PT/SY limit-order book |

The protocol holds its invariants: escrow coverage, a pro-rata shortfall cap,
PT-senior / YT-surplus ordering, a maturity rate freeze, and a TWAP
anti-manipulation rule. `WadMath` does fixed-point in integers — no floats.

```
contracts/   Solidity (Foundry). src/ is the protocol, script/DeployBotChain.s.sol deploys a market.
web/sdk/     @tomaker/sdk — viem client. Reads state, returns UNSIGNED transactions. Holds no keys.
web/app/     Next.js — marketing site, trading app, /docs.
```

## Build and test

```bash
# contracts
cd contracts && python3 scripts/install-deps.py && forge build && forge test

# web
cd web && pnpm install
pnpm --filter @tomaker/sdk build      # always before the app; it imports dist/
pnpm --filter @tomaker/app dev
pnpm --filter @tomaker/app test
```

---

## Attribution

toMaker is derived from

This build ports it to BOT Chain. That meant removing the ATS integration
entirely — BOT Chain has no ATS factory — and issuing the bond from the
protocol's own ERC-3643 implementation instead, rewriting the eligibility path
the faucet uses, replacing the chain layer, and rebuilding the deployment so a
whole market comes up in a single transaction. The interface was rebuilt on a
new palette and typeface.

The protocol design underneath is the upstream author's, and the license is
carried forward unchanged.

## License

Apache-2.0. See [`contracts/LICENSE`](contracts/LICENSE).
