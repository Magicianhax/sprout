export interface UserPreferences {
  mode: "lite" | "pro";
  riskLevel: "low" | "medium" | "high";
  preferredTokens: string[];
  experienceLevel: "beginner" | "intermediate" | "advanced";
  onboardingComplete: boolean;
}

export interface VaultProtocol {
  name: string;
  website?: string;
  description?: string;
}

export interface UnderlyingToken {
  address: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

export interface VaultAnalytics {
  apy: {
    base: number;
    reward: number | null;
    total: number;
  };
  apy1d: number | null;
  apy7d: number | null;
  apy30d: number | null;
  tvl: {
    usd: string;
  };
}

export interface Vault {
  address: string;
  chainId: number;
  name: string;
  protocol: VaultProtocol;
  underlyingTokens: UnderlyingToken[];
  analytics: VaultAnalytics;
  tags: string[];
  isTransactional: boolean;
  isRedeemable: boolean;
}

export interface VaultsResponse {
  data: Vault[];
  nextCursor?: string;
}

export interface Position {
  vault: Vault;
  balance: number;
  balanceUsd: number;
  earnings: number;
  earningsUsd: number;
}

export interface Chain {
  chainId: number;
  name: string;
  logoURI?: string;
}

export interface ComposerQuote {
  transactionRequest: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    gasPrice?: string;
    chainId: number;
  };
  estimate: {
    fromAmount: string;
    toAmount: string;
    gasCosts: { amountUSD: string }[];
  };
}

export type RiskLevel = "low" | "medium" | "high";
export type SortBy = "tvl" | "apy";
