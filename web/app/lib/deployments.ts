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
 * `contracts/script/Deploy.s.sol` writes after deploying to BOT Chain; until
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
  bondToken: "",
  issuanceTx: "",
  contracts: {
    sy: "",
    pt: "",
    yt: "",
    tokenizer: "",
    market: "",
    orderbook: "",
    bond: "",
    strategy: "",
    underlying: "",
    registry: "",
    compliance: "",
  },
  maturity: 0,
  couponId: 0,
  deployer: "",
  demoWallets: [],
};
