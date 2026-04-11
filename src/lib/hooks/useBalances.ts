"use client";
import { useState, useEffect, useCallback } from "react";

export interface TokenBalance {
  symbol: string;
  chainId: number;
  balance: string;
  balanceFormatted: number;
}

export function useBalances(address: string | undefined) {
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/balances?address=${address}`);
      if (res.ok) {
        const data = (await res.json()) as { balances?: TokenBalance[] };
        setBalances(data.balances ?? []);
      }
    } catch {
      // silent — network errors shouldn't crash the UI
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void load();
  }, [load]);

  return { balances, loading, reload: load };
}
