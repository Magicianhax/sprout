"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Vault, SortBy } from "@/lib/types";
import { fetchAllVaults } from "@/lib/api/earn";
import { parseTvl, getRiskLevel } from "@/lib/format";

interface UseVaultsOptions {
  chainIds?: number[];
  sortBy?: SortBy;
  riskLevel?: "low" | "medium" | "high";
  token?: string;
}

// Module-level cache keyed by fetch scope (asset token only — chain/sort/risk
// are all applied client-side so they must NOT be part of the key, otherwise
// toggling them re-hits the network).
const cache = new Map<string, Vault[]>();
const inflight = new Map<string, Promise<Vault[]>>();

function cacheKey(token?: string): string {
  return token ?? "__all__";
}

async function loadVaults(token?: string): Promise<Vault[]> {
  const key = cacheKey(token);
  const cached = cache.get(key);
  if (cached) return cached;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = fetchAllVaults({
    pageSize: 50,
    maxPages: 10,
    asset: token,
  })
    .then((res) => {
      // Don't cache empty results — they're almost certainly a transient
      // upstream hiccup and we'd rather retry than get stuck on [].
      if (res.data.length > 0) cache.set(key, res.data);
      inflight.delete(key);
      return res.data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}

export function useVaults(options: UseVaultsOptions = {}) {
  const { chainIds, sortBy = "tvl", riskLevel, token } = options;

  const [allVaults, setAllVaults] = useState<Vault[]>(
    () => cache.get(cacheKey(token)) ?? []
  );
  const [loading, setLoading] = useState(() => !cache.has(cacheKey(token)));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force = false) => {
      if (force) cache.delete(cacheKey(token));
      setLoading(!cache.has(cacheKey(token)));
      setError(null);
      try {
        const data = await loadVaults(token);
        setAllVaults(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load opportunities");
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Derive filtered + sorted view from cached data — no network calls.
  const vaults = useMemo(() => {
    let result = allVaults;

    if (chainIds && chainIds.length > 0) {
      const set = new Set(chainIds);
      result = result.filter((v) => set.has(v.chainId));
    }

    if (riskLevel) {
      result = result.filter((v) => getRiskLevel(v.tags) === riskLevel);
    }

    const sorted = [...result];
    if (sortBy === "apy") {
      sorted.sort((a, b) => b.analytics.apy.total - a.analytics.apy.total);
    } else {
      sorted.sort(
        (a, b) => parseTvl(b.analytics.tvl.usd) - parseTvl(a.analytics.tvl.usd)
      );
    }
    return sorted;
  }, [allVaults, chainIds, riskLevel, sortBy]);

  return { vaults, loading, error, reload: () => load(true) };
}
