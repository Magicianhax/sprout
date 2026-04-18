export const SUPPORTED_CHAIN_IDS = [1, 8453, 42161, 10, 137] as const;

export const TOKEN_ADDRESSES: Record<string, Record<number, string>> = {
  // ETH only covers chains whose NATIVE token is actually ether.
  // Polygon's native is POL (formerly MATIC) — listing it under ETH
  // caused us to read the POL balance and then price it at ETH's
  // ~$3000, inflating the total by hundreds of dollars.
  ETH: {
    1: "0x0000000000000000000000000000000000000000",
    8453: "0x0000000000000000000000000000000000000000",
    42161: "0x0000000000000000000000000000000000000000",
    10: "0x0000000000000000000000000000000000000000",
  },
  POL: {
    137: "0x0000000000000000000000000000000000000000",
  },
  USDC: {
    1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  },
  USDT: {
    1: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    8453: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    10: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  },
  DAI: {
    1: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    8453: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    42161: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    10: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    137: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
  },
  WBTC: {
    1: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    42161: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    10: "0x68f180fcCe6836688e9084f035309E29Bf0A2095",
    137: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
  },
};

export const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  ETH: 18,
  POL: 18,
  WBTC: 8,
  DAI: 18,
};

export const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
  10: "Optimism",
  137: "Polygon",
};

export const SUPPORTED_TOKENS = [
  { symbol: "USDC", name: "USD Coin" },
  { symbol: "USDT", name: "Tether" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "WBTC", name: "Wrapped Bitcoin" },
  { symbol: "DAI", name: "Dai" },
] as const;

export const RISK_TAG_MAP: Record<string, "low" | "medium" | "high"> = {
  stablecoin: "low",
  single: "low",
  "blue-chip": "low",
  multi: "medium",
  "il-risk": "high",
};

export const EARN_API_BASE = "https://earn.li.fi";
export const LIFI_API_BASE = "https://li.quest";

// Alchemy network slugs for each supported chain. Used by the activity
// proxy to query alchemy_getAssetTransfers per chain.
export const ALCHEMY_NETWORK_BY_CHAIN: Record<number, string> = {
  1: "eth-mainnet",
  8453: "base-mainnet",
  42161: "arb-mainnet",
  10: "opt-mainnet",
  137: "polygon-mainnet",
};

export const NATIVE_SYMBOL_BY_CHAIN: Record<number, string> = {
  1: "ETH",
  8453: "ETH",
  42161: "ETH",
  10: "ETH",
  137: "POL",
};

export const EXPLORER_TX_URL_BY_CHAIN: Record<number, string> = {
  1: "https://etherscan.io/tx/",
  8453: "https://basescan.org/tx/",
  42161: "https://arbiscan.io/tx/",
  10: "https://optimistic.etherscan.io/tx/",
  137: "https://polygonscan.com/tx/",
};

// Pagination / streaming
export const VAULT_PAGE_SIZE = 100;
export const VAULT_MAX_PAGES = 10;
export const HOME_PAGE_SIZE = 10;

// Timing
export const QUOTE_DEBOUNCE_MS = 600;
// After a deposit/withdraw, we invalidate caches and then keep
// retrying on this schedule so slow indexers (LI.FI earn, Alchemy)
// eventually report the new state. Earn positions in particular can
// take 30-60s to land, so we push the last retry out to 90s.
export const POSITION_RESYNC_DELAYS_MS = [3000, 8000, 20000, 45000, 90000] as const;
export const API_FETCH_TIMEOUT_MS = 15000;
export const RPC_FETCH_TIMEOUT_MS = 10000;

// Safety caps for swap/bridge parameters forwarded to LI.FI.
// DEFAULT_SLIPPAGE is what the SDK sends when we don't override.
// 1% is the minimum that reliably clears Pendle PT paths, newer
// stablecoin mints (USDai, etc.), and compounded multi-hop routes
// (e.g. USDC→PYUSD→USDai→PT where each hop eats 0.5% and compounds
// to ~1.5% at the top level). 0.5% was genuinely too tight for
// vault deposits — stable→stable direct swaps survived it, but
// anything that touched a newer protocol or a compound route hit
// "Simulation Failed" in any wallet with a real simulator (Rabby,
// MetaMask 12+). Real user cost at 1% is negligible because LI.FI
// routes through the best DEX anyway — this is headroom, not a
// price the user pays.
export const MAX_SLIPPAGE = 0.03; // 3% hard cap
export const DEFAULT_SLIPPAGE = 0.01; // 1% when client omits it

// Allowlists for the earn API proxy (see /api/earn/[...path]/route.ts).
// Path layout changed Apr 2026 — LI.FI dropped the /earn/ subpath
// segment, so endpoints now live at /v1/vaults, /v1/chains, etc.
export const EARN_API_PATH_ALLOWLIST: readonly RegExp[] = [
  /^v1\/vaults$/,
  /^v1\/chains$/,
  /^v1\/protocols$/,
  /^v1\/portfolio\/0x[0-9a-fA-F]{40}\/positions$/,
] as const;

export const EARN_API_QUERY_ALLOWLIST = new Set([
  "chainId",
  "asset",
  "sortBy",
  "limit",
  "cursor",
] as const);

export const DEFAULT_PREFERENCES = {
  mode: "lite" as const,
  riskLevel: "low" as const,
  preferredTokens: ["USDC"],
  experienceLevel: "beginner" as const,
  onboardingComplete: false,
  notificationsEnabled: false,
  darkMode: false,
  riskAcknowledged: false,
};
