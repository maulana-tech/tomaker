// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";

// Demo infrastructure. BOT Chain has no ATS factory, so the market is built on
// the local reference bond plus the two ERC-3643 seams a real issuer would
// otherwise supply. These live under `test/` and are reused here rather than
// duplicated; nothing mock-like ships in `src/`.
//
// ponytail: the registry and compliance setters are unrestricted, so anyone can
// self-verify on this demo market. That is deliberate for a testnet judge flow.
// Gate them on an owner before any market holding real value.
import {TestERC20} from "../test/mocks/TestERC20.sol";
import {TestIdentityRegistry} from "../test/mocks/TestIdentityRegistry.sol";
import {TestCompliance} from "../test/mocks/TestCompliance.sol";

import {ERC3643Bond} from "../src/sy/ERC3643Bond.sol";
import {ERC3643BondStrategy} from "../src/sy/ERC3643BondStrategy.sol";
import {StandardizedYieldVault} from "../src/sy/StandardizedYieldVault.sol";
import {PrincipalToken} from "../src/tokens/PrincipalToken.sol";
import {YieldToken} from "../src/tokens/YieldToken.sol";
import {Tokenizer} from "../src/Tokenizer.sol";
import {AmmMarket} from "../src/AmmMarket.sol";
import {Orderbook} from "../src/Orderbook.sol";

/// @title DeployBotChain
/// @notice One-shot deploy of a complete toMaker market on BOT Chain, plus the
///         seed that makes it usable by a visitor on the first click.
///
///         `script/Deploy.s.sol` wraps a bond that already exists. BOT Chain has
///         none, so this script issues the bond as well, then runs the same
///         market construction, and finally seeds the AMM and the order book so
///         a first-time visitor can trade rather than meeting an empty pool.
///
///         The manifest it writes is the input to the frontend's env generator:
///           cd web/app && pnpm gen:env ../../contracts/deployments/botchain-testnet.json
///
/// Usage:
///   export PRIVATE_KEY=0x...
///   forge script script/DeployBotChain.s.sol:DeployBotChain \
///     --rpc-url https://rpc.bohr.life --broadcast --slow
contract DeployBotChain is Script {
    uint256 internal constant WAD = 1e18;

    // Issuer float, sized so the reserve covers redemption and the coupon.
    uint256 internal constant CASH_MINT = 5_000_000e18;
    uint256 internal constant BOND_RESERVE = 1_000_000e18;

    uint256 internal constant DEPOSIT = 500_000e18;
    uint256 internal constant SPLIT = 300_000e18;

    // PT-heavy, not 50/50: the AMM's first addLiquidity reverts
    // ExchangeRateBelowOne once the funded coupon lifts the SY rate above 1.
    uint256 internal constant PT_LIQ = 120_000e18;
    uint256 internal constant SY_LIQ = 80_000e18;

    uint256 internal constant COUPON_RATE = 0.02e18;
    uint256 internal constant COUPON_RECORD_DELAY = 1 hours;
    uint256 internal constant COUPON_EXECUTION_GAP = 5 minutes;
    uint256 internal constant BOOK_ORDER = 1_000e18;

    struct Deployment {
        address deployer;
        address cash;
        address registry;
        address compliance;
        address bond;
        address sy;
        address strategy;
        address pt;
        address yt;
        address tokenizer;
        address amm;
        address orderbook;
        uint256 maturity;
        uint256 couponId;
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        uint256 maturity = vm.envOr("MATURITY", block.timestamp + 90 days);
        // Optional second wallet (a judge, a demo account) funded and verified
        // alongside the deployer so it can transact without the faucet.
        address guest = vm.envOr("GUEST_ADDRESS", address(0));

        require(maturity > block.timestamp, "maturity must be in the future");

        vm.startBroadcast(pk);

        TestERC20 cash = new TestERC20("toMaker Demo USD", "tUSD", 18);
        TestIdentityRegistry registry = new TestIdentityRegistry();
        TestCompliance compliance = new TestCompliance();

        ERC3643Bond bond =
            new ERC3643Bond(address(cash), deployer, block.timestamp, maturity, 0.95e18, 1e18);
        bond.setIdentityRegistry(address(registry));
        bond.setCompliance(address(compliance));

        StandardizedYieldVault sy = new StandardizedYieldVault();
        ERC3643BondStrategy strategy = new ERC3643BondStrategy(address(sy), address(bond));
        sy.initialize(deployer, address(strategy));

        PrincipalToken pt = new PrincipalToken();
        YieldToken yt = new YieldToken();
        Tokenizer tokenizer = new Tokenizer();
        tokenizer.initialize(deployer, address(sy), address(pt), address(yt), maturity, deployer, 0);
        pt.initialize(deployer, address(tokenizer), address(sy), maturity);
        yt.initialize(deployer, address(tokenizer), address(sy), maturity);

        AmmMarket amm = new AmmMarket();
        amm.initialize(
            deployer,
            address(pt),
            address(sy),
            address(yt),
            address(tokenizer),
            maturity,
            1e18,
            1e18,
            10,
            30 minutes
        );
        Orderbook orderbook = new Orderbook();
        orderbook.initialize(deployer, address(pt), address(sy), maturity, deployer, 10);

        // Eligibility is enforced on every SY movement, not just on the bond
        // purchase, so every contract that ever custodies SY has to be a
        // verified holder too. Missing the tokenizer here reverts the first
        // split with NotEligible.
        address[6] memory holders = [
            deployer,
            address(strategy),
            address(tokenizer),
            address(amm),
            address(orderbook),
            address(sy)
        ];
        for (uint256 i = 0; i < holders.length; i++) {
            registry.setVerified(holders[i], true);
            compliance.setAllowed(holders[i], true);
        }

        cash.mint(deployer, CASH_MINT);
        cash.approve(address(bond), type(uint256).max);
        bond.fundPrincipal(BOND_RESERVE);

        // Layer 1: cash in, strategy buys the bond, SY minted.
        cash.approve(address(sy), type(uint256).max);
        uint256 shares = sy.deposit(DEPOSIT, 0);
        require(bond.balanceOf(address(strategy)) > 0, "strategy must hold bond");

        // Layer 2: split SY into equal PT and YT face.
        sy.approve(address(tokenizer), type(uint256).max);
        (uint256 ptOut, uint256 ytOut) = tokenizer.split(SPLIT);
        require(ptOut == ytOut && ptOut > 0, "split must mint equal PT/YT");

        // Layer 3: seed both venues so the first visitor can actually trade.
        pt.approve(address(amm), type(uint256).max);
        sy.approve(address(amm), type(uint256).max);
        amm.addLiquidity(PT_LIQ, SY_LIQ, 0);

        pt.approve(address(orderbook), type(uint256).max);
        orderbook.placeOrder(Orderbook.Side.Ask, BOOK_ORDER, 0.99e18, maturity - 60, 0);

        // A real, funded coupon for YT to collect. It cannot be made claimable
        // inside this transaction: `scheduleCoupon` rejects a record date at or
        // before now, and `fundCoupon` closes at that record date. So it is
        // scheduled just ahead and funded immediately; it becomes claimable on
        // its execution date, and `sy.touch()` pulls it into the SY rate then.
        uint256 recordDate = block.timestamp + COUPON_RECORD_DELAY;
        uint256 executionDate = recordDate + COUPON_EXECUTION_GAP;
        require(executionDate <= maturity, "coupon must execute before maturity");
        uint256 couponId = bond.scheduleCoupon(recordDate, executionDate, COUPON_RATE);
        bond.fundCoupon(couponId, bond.couponTargetFunding(couponId));

        // Anchor the pre-maturity rate the freeze will read.
        tokenizer.observeRate();

        if (guest != address(0)) {
            registry.setVerified(guest, true);
            compliance.setAllowed(guest, true);
            cash.mint(guest, 100_000e18);
        }

        vm.stopBroadcast();

        Deployment memory d = Deployment({
            deployer: deployer,
            cash: address(cash),
            registry: address(registry),
            compliance: address(compliance),
            bond: address(bond),
            sy: address(sy),
            strategy: address(strategy),
            pt: address(pt),
            yt: address(yt),
            tokenizer: address(tokenizer),
            amm: address(amm),
            orderbook: address(orderbook),
            maturity: maturity,
            couponId: couponId
        });
        _writeManifest(d);

        console2.log("== toMaker market deployed on chain", block.chainid, "==");
        console2.log("cash        ", d.cash);
        console2.log("registry    ", d.registry);
        console2.log("compliance  ", d.compliance);
        console2.log("bond        ", d.bond);
        console2.log("sy          ", d.sy);
        console2.log("strategy    ", d.strategy);
        console2.log("pt          ", d.pt);
        console2.log("yt          ", d.yt);
        console2.log("tokenizer   ", d.tokenizer);
        console2.log("amm         ", d.amm);
        console2.log("orderbook   ", d.orderbook);
        console2.log("maturity    ", d.maturity);
        console2.log("sy shares   ", shares);
        console2.log("pt/yt minted", ptOut);
        console2.log("coupon id   ", couponId);
        console2.log("coupon execs", executionDate);
    }

    function _writeManifest(Deployment memory d) internal {
        if (!vm.exists("./deployments")) {
            vm.createDir("./deployments", true);
        }
        string memory obj = "botchain";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeString(obj, "network", _networkName());
        vm.serializeString(obj, "rpcUrl", _rpcUrl());
        vm.serializeString(obj, "marketId", "botchain-bond-q4");
        vm.serializeString(obj, "yieldSourceName", "Tokenized bond (ERC-3643)");
        vm.serializeAddress(obj, "deployer", d.deployer);
        vm.serializeAddress(obj, "cash", d.cash);
        vm.serializeAddress(obj, "registry", d.registry);
        vm.serializeAddress(obj, "compliance", d.compliance);
        vm.serializeAddress(obj, "bond", d.bond);
        vm.serializeAddress(obj, "sy", d.sy);
        vm.serializeAddress(obj, "strategy", d.strategy);
        vm.serializeAddress(obj, "pt", d.pt);
        vm.serializeAddress(obj, "yt", d.yt);
        vm.serializeAddress(obj, "tokenizer", d.tokenizer);
        vm.serializeAddress(obj, "amm", d.amm);
        vm.serializeAddress(obj, "orderbook", d.orderbook);
        vm.serializeUint(obj, "decimals", 18);
        // Cash and the protocol tokens are both 18-decimal here, unlike the
        // 6-decimal ATS demo cash. Emitted explicitly so the app does not guess.
        vm.serializeUint(obj, "cashDecimals", 18);
        // TestERC20.mint is public, so the faucet route can hand out test cash.
        vm.serializeBool(obj, "cashMintable", true);
        vm.serializeUint(obj, "faucetAmount", 1000);
        vm.serializeUint(obj, "couponId", d.couponId);
        string memory json = vm.serializeUint(obj, "maturity", d.maturity);
        vm.writeJson(json, _manifestPath());
    }

    function _networkName() internal view returns (string memory) {
        return block.chainid == 677 ? "botchain-mainnet" : "botchain-testnet";
    }

    function _rpcUrl() internal view returns (string memory) {
        return block.chainid == 677 ? "https://rpc.botchain.ai" : "https://rpc.bohr.life";
    }

    function _manifestPath() internal view returns (string memory) {
        return block.chainid == 677
            ? "./deployments/botchain-mainnet.json"
            : "./deployments/botchain-testnet.json";
    }
}
