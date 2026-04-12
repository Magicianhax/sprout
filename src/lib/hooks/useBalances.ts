"use client";
import { useState, useEffect, useCallback } from "react";

export interface TokenBalance {
  symbol: string;
  chainId: number;
  balance: string;
  balanceFormatted: number;
}

// Module-level cache — persists across component re-mounts and strict-mode runs
const cache = new Map<string, TokenBalance[]>();
const inflight = new Map<string, Promise<TokenBalance[]>>();

async function fetchBalances(address: string): Promise<TokenBalance[]> {
  if (cache.has(address)) return cache.get(address)!;

  const existing = inflight.get(address);
  if (existing) return existing;

  const promise = fetch(`/api/balances?address=${address}`)
    .then((res) => (res.ok ? res.json() : { balances: [] }))
    .then((data: { balances?: TokenBalance[] }) => {
      const balances = data.balances ?? [];
      cache.set(address, balances);
      inflight.delete(address);
      return balances;
    })
    .catch(() => {
      inflight.delete(address);
      return [] as TokenBalance[];
    });

  inflight.set(address, promise);
  return promise;
}

export function useBalances(address: string | undefined) {
  const [balances, setBalances] = useState<TokenBalance[]>(() =>
    address && cache.has(address) ? cache.get(address)! : [],
  );
  const [loading, setLoading] = useState(() => Boolean(address) && !cache.has(address ?? ""));

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    // Cache hit — no fetch needed
    if (cache.has(address)) {
      setBalances(cache.get(address)!);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchBalances(address).then((data) => {
      if (!cancelled) {
        setBalances(data);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [address]);

  const reload = useCallback(() => {
    if (!address) return;
    cache.delete(address);
    inflight.delete(address);
    setLoading(true);
    fetchBalances(address).then((data) => {
      setBalances(data);
      setLoading(false);
    });
  }, [address]);

  return { balances, loading, reload };
}
