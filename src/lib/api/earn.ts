import { SUPPORTED_CHAIN_IDS } from "@/lib/constants";
import type { VaultsResponse, Chain, PositionsResponse } from "@/lib/types";

// Earn API doesn't support CORS — all calls proxied through /api/earn/
const API_BASE = "/api/earn";

export async function fetchVaults(params?: {
  chainId?: number;
  asset?: string;
  sortBy?: "tvl" | "apy";
  limit?: number;
  cursor?: string;
}): Promise<VaultsResponse> {
  const searchParams = new URLSearchParams();
  // API only accepts a single chainId — omit to get all, filter client-side
  if (params?.chainId) searchParams.set("chainId", String(params.chainId));
  if (params?.asset) searchParams.set("asset", params.asset);
  if (params?.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.cursor) searchParams.set("cursor", params.cursor);
  const res = await fetch(`${API_BASE}/v1/earn/vaults?${searchParams}`);
  if (!res.ok) throw new Error(`Earn API error: ${res.status}`);
  const data: VaultsResponse = await res.json();
  // Filter to supported chains client-side
  if (!params?.chainId) {
    data.data = data.data.filter((v) => SUPPORTED_CHAIN_IDS.includes(v.chainId as typeof SUPPORTED_CHAIN_IDS[number]));
  }
  return data;
}

export async function fetchChains(): Promise<Chain[]> {
  const res = await fetch(`${API_BASE}/v1/earn/chains`);
  if (!res.ok) throw new Error(`Chains API error: ${res.status}`);
  return res.json();
}

export async function fetchProtocols(): Promise<{ name: string; url?: string }[]> {
  const res = await fetch(`${API_BASE}/v1/earn/protocols`);
  if (!res.ok) throw new Error(`Protocols API error: ${res.status}`);
  return res.json();
}

export async function fetchPositions(address: string): Promise<PositionsResponse> {
  const res = await fetch(`${API_BASE}/v1/earn/portfolio/${address}/positions`);
  if (!res.ok) throw new Error(`Positions API error: ${res.status}`);
  return res.json();
}
