"use client";

import { useState, useEffect, useCallback } from "react";
import type { Vault, SortBy } from "@/lib/types";
import { fetchVaults } from "@/lib/api/earn";
import { parseTvl, getRiskLevel } from "@/lib/format";

interface UseVaultsOptions {
  chainIds?: number[];
  sortBy?: SortBy;
  riskLevel?: "low" | "medium" | "high";
  token?: string;
}

export function useVaults(options: UseVaultsOptions = {}) {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchVaults({
        sortBy: options.sortBy || "tvl",
        limit: 50,
        asset: options.token,
      });
      let filtered = res.data;
      if (options.chainIds && options.chainIds.length > 0) {
        filtered = filtered.filter((v) => options.chainIds!.includes(v.chainId));
      }
      if (options.riskLevel) {
        filtered = filtered.filter((v) => getRiskLevel(v.tags) === options.riskLevel);
      }
      if (options.sortBy === "apy") {
        filtered.sort((a, b) => b.analytics.apy.total - a.analytics.apy.total);
      } else {
        filtered.sort((a, b) => parseTvl(b.analytics.tvl.usd) - parseTvl(a.analytics.tvl.usd));
      }
      setVaults(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load opportunities");
    } finally {
      setLoading(false);
    }
  }, [options.chainIds, options.sortBy, options.riskLevel, options.token]);

  useEffect(() => { load(); }, [load]);

  return { vaults, loading, error, reload: load };
}
