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
          setBalances(data.balances ?? []);
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
