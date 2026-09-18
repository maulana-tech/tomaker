// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import {
  explorerAccountUrl,
  explorerContractUrl,
  explorerTxUrl,
} from "../lib/explorer";

const HASH = "0x9c1f5b6c4a4c31f3a4f93ba0a6a5a0e0f0d9c8b7a6f5e4d3c2b1a09876543210";
const TESTNET = "https://scan.bohr.life";
const MAINNET = "https://scan.botchain.ai";

describe("explorerTxUrl", () => {
  it("builds a testnet tx link", () => {
    expect(explorerTxUrl(HASH, "testnet")).toBe(`${TESTNET}/tx/${HASH}`);
  });

  it("builds a mainnet tx link", () => {
    expect(explorerTxUrl(HASH, "mainnet")).toBe(`${MAINNET}/tx/${HASH}`);
  });

  it("keeps a custom network on the testnet explorer", () => {
    expect(explorerTxUrl(HASH, "custom")).toBe(`${TESTNET}/tx/${HASH}`);
  });
});

describe("address links", () => {
  it("builds a testnet account link", () => {
    const account = "0xabc0000000000000000000000000000000000001";
    expect(explorerAccountUrl(account, "testnet")).toBe(`${TESTNET}/address/${account}`);
  });

  it("builds a mainnet contract link", () => {
    const contract = "0xdef0000000000000000000000000000000000002";
    expect(explorerContractUrl(contract, "mainnet")).toBe(`${MAINNET}/address/${contract}`);
  });
});
