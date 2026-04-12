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

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/balances?address=${address}`)
      .then((res) => (res.ok ? res.json() : { balances: [] }))
      .then((data: { balances?: TokenBalance[] }) => {
        if (!cancelled) {
          const newBalances = data.balances ?? [];
          // Merge with previous balances — if a token was in the previous
          // response but missing from the new one (RPC flake), keep the old
          // value instead of losing it.
          setBalances((prev) => {
            if (prev.length === 0) return newBalances;
            const merged = new Map<string, TokenBalance>();
            for (const b of prev) merged.set(`${b.symbol}-${b.chainId}`, b);
            for (const b of newBalances) merged.set(`${b.symbol}-${b.chainId}`, b);
            return Array.from(merged.values()).sort(
              (a, b) => b.balanceFormatted - a.balanceFormatted,
            );
          });
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [address]);

  const reload = useCallback(() => {
    if (!address) return;
    setLoading(true);
    fetch(`/api/balances?address=${address}`)
      .then((res) => (res.ok ? res.json() : { balances: [] }))
      .then((data: { balances?: TokenBalance[] }) => {
        setBalances(data.balances ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [address]);

  return { balances, loading, reload };
}
