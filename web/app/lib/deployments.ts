// SPDX-License-Identifier: Apache-2.0

import type { ContractAddresses } from "@tomaker/sdk";

/**
 * Checked-in fallback for the public BOT Chain testnet demo.
 *
 * The app reads NEXT_PUBLIC_* first; when those are absent (for example on a
 * freshly cloned public deployment) a testnet build falls back to this
 * deployment so the demo is usable without any manual environment setup.
 * Mainnet builds never fall back to these addresses.
 *
 * These addresses are public. Fill them from the manifest that
 * `contracts/script/DeployBotChain.s.sol` writes after deploying; until
 * then every address is empty, `isDeployed()` stays false, and the app reports
 * "Preview" rather than pointing at a market that is not there.
 */

export interface DeploymentInfo {
  /** The ERC-3643 bond token the strategy custodies. */
  bondToken: string;
  /** Transaction that issued the bond, for provenance. Empty until deployed. */
  issuanceTx: string;
  contracts: ContractAddresses;
  maturity: number;
  couponId: number;
  deployer: string;
  /** Verified demo holders used for the two-wallet walkthrough. */
  demoWallets: { label: string; address: string }[];
}

export const TESTNET_DEPLOYMENT: DeploymentInfo = {
  bondToken: "0x970C3114C5Dcf853692bc8D3e0598d1AC9D12185",
  issuanceTx: "",
  contracts: {
    sy: "0x40c3323992dD140Fc3770ceE5A6B23165aD36Fc1",
    pt: "0x8Db79e6Ca738D7F212Db208B4f9889Caf931a68A",
    yt: "0x3152B6f625F25B6a2Aa0Adb57017eB74acA65ecB",
    tokenizer: "0xA0c9791e4FE34734D06fDD2ded0C0e0cd5b7F0f6",
    market: "0xE67A87b2eCBbE03B90cac2cA3C494a3e1be5f615",
    orderbook: "0x1d19a197B9860bD831F84d30E51584d62796f362",
    bond: "0x970C3114C5Dcf853692bc8D3e0598d1AC9D12185",
    strategy: "0x588DeC15D915659E8BF36c01e662479916301d3A",
    underlying: "0x6d4d017dE8d0A36dce7856Ee989624C6A18cD9Ea",
    registry: "0xD04A92C83AFe71f4f69F9FAD0A33229BFBdE33E6",
    compliance: "0x44b99f76f12e0Ece22f6bD76DcB305Afcf25876D",
  },
  maturity: 1797571070,
  couponId: 0,
  deployer: "0x3a8d93D5F52a26689b075A49E67F4f8924BeC84B",
  demoWallets: [],
};
