// SPDX-License-Identifier: Apache-2.0

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The SDK ships as TypeScript ESM in this workspace; let Next transpile it.
  transpilePackages: ["@tomaker/sdk"],
  webpack(config) {
    // Privy dynamically references optional integrations (Stripe, Solana
    // wallets, Farcaster mini-apps) that this app does not use. Alias them to
    // an empty module so the bundler does not require their packages.
    for (const mod of [
      "@stripe/stripe-js",
      "@solana/wallet-adapter-react",
      "@farcaster/miniapp-sdk",
      "@farcaster/mini-app-solana",
    ]) {
      config.resolve.alias[mod] = false;
    }
    return config;
  },
  async redirects() {
    return [{ source: "/redeem", destination: "/portfolio", permanent: true }];
  },
};

export default nextConfig;
