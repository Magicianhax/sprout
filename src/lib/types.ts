export interface UserPreferences {
  mode: "lite" | "pro";
  riskLevel: "low" | "medium" | "high";
  preferredTokens: string[];
  experienceLevel: "beginner" | "intermediate" | "advanced";
  onboardingComplete: boolean;
  notificationsEnabled: boolean;
  darkMode: boolean;
}

export interface VaultProtocol {
  name: string;
  url?: string;
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
  total?: number;
}

export interface PositionAsset {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

export interface Position {
  chainId: number;
  protocolName: string;
  asset: PositionAsset;
  balanceUsd: string;
  balanceNative: string;
}

export interface PositionsResponse {
  positions: Position[];
}

export interface Chain {
  chainId: number;
  name: string;
  networkCaip?: string;
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

// Shape returned by li.quest /v2/analytics/transfers — only the fields
// we consume are modeled; upstream may include many more.
export interface TransferSide {
  txHash: string;
  txLink?: string;
  chainId: number;
  amount: string;
  amountUSD?: string;
  timestamp: number;
  token: {
    address: string;
    chainId: number;
    symbol: string;
    decimals: number;
    name?: string;
    logoURI?: string;
    priceUSD?: string;
  };
}

export interface TransferRecord {
  transactionId: string;
  sending: TransferSide;
  receiving?: TransferSide;
}

export interface TransferHistoryResponse {
  data: TransferRecord[];
}
