import { SUPPORTED_CHAIN_IDS } from "@/lib/constants";
import type { Vault, VaultsResponse, Chain, PositionsResponse } from "@/lib/types";

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

// Stream pages of vaults as they arrive. `onPage` is called after each
// page with the cumulative (deduped, chain-filtered) list so callers
// can render progressively without waiting for every page.
export async function fetchVaultsStreaming(
  params: {
    chainId?: number;
    asset?: string;
    sortBy?: "tvl" | "apy";
    pageSize?: number;
    maxPages?: number;
  },
  onPage: (cumulative: Vault[]) => void
): Promise<Vault[]> {
  const pageSize = params.pageSize ?? 100;
  const maxPages = params.maxPages ?? 10;

  const seen = new Set<string>();
  const cumulative: Vault[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const res = await fetchVaultsRaw({
      chainId: params.chainId,
      asset: params.asset,
      sortBy: params.sortBy,
      limit: pageSize,
      cursor,
    });

    for (const v of res.data) {
      if (
        !params.chainId &&
        !SUPPORTED_CHAIN_IDS.includes(v.chainId as typeof SUPPORTED_CHAIN_IDS[number])
      ) {
        continue;
      }
      const key = `${v.chainId}-${v.address}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cumulative.push(v);
    }

    // Emit a fresh array snapshot so React consumers see the change
    onPage([...cumulative]);

    if (!res.nextCursor) break;
    cursor = res.nextCursor;
  }

  return cumulative;
}

// Non-streaming convenience wrapper — resolves once every page is in.
// Shares the exact same pagination path as the streaming variant.
export async function fetchAllVaults(params?: {
  chainId?: number;
  asset?: string;
  sortBy?: "tvl" | "apy";
  pageSize?: number;
  maxPages?: number;
}): Promise<VaultsResponse> {
  const data = await fetchVaultsStreaming(params ?? {}, () => {});
  return { data, nextCursor: undefined, total: data.length };
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
