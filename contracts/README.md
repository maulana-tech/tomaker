# toMaker contracts

Solidity for the yield-tokenization protocol: it splits a yield-bearing
position into a principal token (PT) and a yield token (YT), lets either trade,
and recombines or redeems at maturity. Foundry project, targets BOT Chain (EVM).

The yield source is a **permissioned ERC-3643 bond**. Yield is the issuer's cash
coupon and maturity cashflow, not a lending pool.

## Layout

```
src/
├── Tokenizer.sol                    Layer 2: split / recombine / redeem / claim
├── AmmMarket.sol                    Layer 3: time-decay AMM + flash YT routes + TWAP
├── Orderbook.sol                    Layer 3: PT/SY limit-order book
├── sy/
│   ├── StandardizedYieldVault.sol   Layer 1: derived-rate SY vault
│   ├── ERC3643Bond.sol              the bond: cash coupons + issuer cashflow
│   └── ERC3643BondStrategy.sol      IYieldStrategy adapter over the bond
├── tokens/                          ERC3643Base, PrincipalToken, YieldToken
├── interfaces/                      IBond3643, IYieldStrategy, erc3643/*
└── libraries/WadMath.sol            WAD fixed point, integer ln/exp/sqrt

script/DeployBotChain.s.sol          deploys and seeds a whole market in one run
test/                                unit, fuzz and invariant suites
```

## Contract map

| Layer | Contract | Responsibility |
|---|---|---|
| 1 | `sy/StandardizedYieldVault.sol` | derived-rate SY vault, `MINIMUM_SHARES` lock, deposit cap |
| 1 | `sy/ERC3643BondStrategy.sol` | `IYieldStrategy` over the bond; claims coupons, redeems |
| 1 | `sy/ERC3643Bond.sol` | permissioned bond: scheduled coupons, maturity redemption |
| 1 | `tokens/ERC3643Base.sol` | permissioned ERC-20: verified + compliant transfers |
| 2 | `Tokenizer.sol` | split / recombine / redeem / claim; yield fee, maturity freeze |
| 2 | `tokens/PrincipalToken.sol` | PT, tokenizer-gated mint/burn |
| 2 | `tokens/YieldToken.sol` | YT, yield-basis accounting |
| 3 | `AmmMarket.sol` | time-decay AMM, flash split/recombine YT routes, TWAP |
| 3 | `Orderbook.sol` | PT/SY limit-order book, price-time priority |

### Design notes

- **Decimals.** Protocol tokens are 18-decimal; `WAD = 1e18`. The cash
  denomination is read from the deployment, not assumed.
- **Access control.** Cross-contract privileges (mint/burn PT and YT, settle the
  YT ledger) are gated on `msg.sender == tokenizer`; admin powers are separate.
- **Invariants.** Escrow coverage, pro-rata shortfall cap, PT-senior YT surplus,
  maturity rate freeze, TWAP anti-manipulation.
- **No floating point.** `WadMath` implements integer `ln`/`exp`/`sqrt`.

## The bond yield model

`ERC3643Bond` is a permissioned ERC-20: every non-mint/non-burn transfer needs
both counterparties verified by an `IIdentityRegistry` and cleared by an
`ICompliance` module. Its yield is **realized as cash**, never capitalized into
a per-unit rate:

- **Principal** accretes linearly from `issuePricePerUnit` to `nominalValue` and
  redeems at par on or after maturity.
- **Coupons** are scheduled by the issuer, funded in cash, and claimed on or
  after each execution date, using record-date balance and supply checkpoints.
  A later transfer cannot recreate an already-earned entitlement.
- `scheduleCoupon` rejects a record date at or before now, and `fundCoupon`
  closes at that record date — so a coupon cannot be scheduled, funded and
  claimed inside one transaction.

`ERC3643BondStrategy` implements `IYieldStrategy`:

```
totalAssets = bond.valueOf(accountedBonds) + countedCash + attributedCouponReceivables
```

`accountedBonds` and `countedCash` are tracked explicitly, so donated bonds or
cash never enter the valuation.

## Build and test

```bash
python3 scripts/install-deps.py   # lib/ is not committed; clones the pinned refs
forge build
forge test
forge test --gas-report
```

## Deploy

```bash
export PATH="$HOME/.foundry/bin:$PATH"
export PRIVATE_KEY=0x...
export GUEST_ADDRESS=0x...        # optional second wallet, funded and verified

forge script script/DeployBotChain.s.sol:DeployBotChain \
  --rpc-url https://rpc.bohr.life --broadcast --slow
```

BOT Chain has no bond to wrap, so the script issues one: a demo cash token, an
identity registry, a compliance module and the bond, then the market around it,
then the seed — PT-heavy AMM liquidity plus one resting ask — and finally a
funded coupon scheduled just ahead.

**The AMM's first `addLiquidity` must be PT-heavy.** A 50/50 seed reverts
`ExchangeRateBelowOne` once the SY rate is above par.

**Every contract that custodies SY must be a verified holder**, not just the
strategy: the tokenizer, the AMM and the order book too. Missing one reverts the
first split with `NotEligible`.

The script reads `block.chainid` and writes `deployments/botchain-testnet.json`
(968) or `deployments/botchain-mainnet.json` (677). That manifest is the input
to the frontend's env generator.

| Network | Chain ID | JSON-RPC |
|---|---|---|
| Testnet | `968` | `https://rpc.bohr.life` |
| Mainnet | `677` | `https://rpc.botchain.ai` |

`--slow` avoids a nonce race; add `--gas-estimate-multiplier 200` if estimates
come back tight.

> The demo identity registry and compliance module have **unrestricted
> setters** — anyone can self-verify. That is deliberate for a testnet judge
> flow and marked in the script. Gate them behind an owner before any market
> that holds value.

## License

Apache-2.0. See [`LICENSE`](./LICENSE).
