import { SUPPORTED_CHAIN_IDS } from "@/lib/constants";
import type { VaultsResponse, Chain, PositionsResponse } from "@/lib/types";

const EARN_API_BASE = "https://earn.li.fi";

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const key = process.env.NEXT_PUBLIC_LIFI_API_KEY;
  if (key) h["x-lifi-api-key"] = key;
  return h;
}

export async function fetchVaults(params?: {
  chainId?: number;
  asset?: string;
  sortBy?: "tvl" | "apy";
  limit?: number;
  cursor?: string;
}): Promise<VaultsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.chainId) searchParams.set("chainId", String(params.chainId));
  if (params?.asset) searchParams.set("asset", params.asset);
  if (params?.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.cursor) searchParams.set("cursor", params.cursor);
  if (!params?.chainId) {
    SUPPORTED_CHAIN_IDS.forEach((id) => searchParams.append("chainId", String(id)));
  }
  const res = await fetch(`${EARN_API_BASE}/v1/earn/vaults?${searchParams}`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Earn API error: ${res.status}`);
  return res.json();
}

export async function fetchChains(): Promise<Chain[]> {
  const res = await fetch(`${EARN_API_BASE}/v1/earn/chains`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Chains API error: ${res.status}`);
  return res.json();
}

export async function fetchProtocols(): Promise<{ name: string; url?: string }[]> {
  const res = await fetch(`${EARN_API_BASE}/v1/earn/protocols`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Protocols API error: ${res.status}`);
  return res.json();
}

export async function fetchPositions(address: string): Promise<PositionsResponse> {
  const res = await fetch(`${EARN_API_BASE}/v1/earn/portfolio/${address}/positions`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Positions API error: ${res.status}`);
  return res.json();
}
