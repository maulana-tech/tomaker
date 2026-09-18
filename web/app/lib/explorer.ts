// SPDX-License-Identifier: Apache-2.0

import { explorerBaseFor, type AppNetwork } from "./config";

/**
 * BOT Chain explorer links. BOT Chain runs Blockscout on a separate host per
 * network (`scan.bohr.life` testnet, `scan.botchain.ai` mainnet), so the
 * network selects the host rather than a path segment. Blockscout has no
 * separate contract route: a contract is an address whose page carries a
 * Contract tab.
 */

/** Link to a transaction on the explorer for the given network. */
export function explorerTxUrl(hash: string, network: AppNetwork): string {
  return `${explorerBaseFor(network)}/tx/${hash}`;
}

/** Link to a contract on the explorer for the given network. */
export function explorerContractUrl(address: string, network: AppNetwork): string {
  return `${explorerBaseFor(network)}/address/${address}`;
}

/** Link to an account on the explorer for the given network. */
export function explorerAccountUrl(address: string, network: AppNetwork): string {
  return `${explorerBaseFor(network)}/address/${address}`;
}
