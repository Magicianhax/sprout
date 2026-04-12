import { SUPPORTED_CHAIN_IDS } from "@/lib/constants";
import type { VaultsResponse, Chain, PositionsResponse } from "@/lib/types";

// Earn API doesn't support CORS — all calls proxied through /api/earn/
const API_BASE = "/api/earn";

// Raw fetch — returns the API response as-is without any client-side filter.
// Used internally by the paginator so early breaks aren't triggered by the
// SUPPORTED_CHAIN_IDS filter eating entire pages.
async function fetchVaultsRaw(params?: {
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
  const res = await fetch(`${API_BASE}/v1/earn/vaults?${searchParams}`);
  if (!res.ok) throw new Error(`Earn API error: ${res.status}`);
  return res.json();
}

export async function fetchVaults(params?: {
  chainId?: number;
  asset?: string;
  sortBy?: "tvl" | "apy";
  limit?: number;
  cursor?: string;
}): Promise<VaultsResponse> {
  const data = await fetchVaultsRaw(params);
  if (!params?.chainId) {
    data.data = data.data.filter((v) =>
      SUPPORTED_CHAIN_IDS.includes(v.chainId as typeof SUPPORTED_CHAIN_IDS[number])
    );
  }
  return data;
}

// Fetch ALL pages of vaults by following nextCursor until exhausted.
// Capped at `maxPages` to protect against runaway loops.
export async function fetchAllVaults(params?: {
  chainId?: number;
  asset?: string;
  sortBy?: "tvl" | "apy";
  pageSize?: number;
  maxPages?: number;
}): Promise<VaultsResponse> {
  const pageSize = params?.pageSize ?? 50;
  const maxPages = params?.maxPages ?? 10;

  const combined: VaultsResponse = { data: [], nextCursor: undefined, total: 0 };
  const seen = new Set<string>();
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    // Use raw fetcher so the SUPPORTED_CHAIN_IDS filter doesn't zero-out
    // a page and trigger an early break while nextCursor is still valid.
    const res = await fetchVaultsRaw({
      chainId: params?.chainId,
      asset: params?.asset,
      sortBy: params?.sortBy,
      limit: pageSize,
      cursor,
    });

    for (const v of res.data) {
      if (
        !params?.chainId &&
        !SUPPORTED_CHAIN_IDS.includes(v.chainId as typeof SUPPORTED_CHAIN_IDS[number])
      ) {
        continue;
      }
      const key = `${v.chainId}-${v.address}`;
      if (seen.has(key)) continue;
      seen.add(key);
      combined.data.push(v);
    }

    if (!res.nextCursor) break;
    cursor = res.nextCursor;
  }

  combined.total = combined.data.length;
  return combined;
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
