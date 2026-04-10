export const SUPPORTED_CHAIN_IDS = [1, 8453, 42161, 10, 137] as const;

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

export const DEFAULT_PREFERENCES = {
  mode: "lite" as const,
  riskLevel: "low" as const,
  preferredTokens: ["USDC"],
  experienceLevel: "beginner" as const,
  onboardingComplete: false,
};
