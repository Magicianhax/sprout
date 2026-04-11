"use client";
import { useState, useEffect, useRef } from "react";

export interface TokenBalance {
  symbol: string;
  chainId: number;
  balance: string;
  balanceFormatted: number;
}

export function useBalances(address: string | undefined) {
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    // Don't refetch for the same address
    if (fetchedRef.current === address) return;
    fetchedRef.current = address;

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

    return () => {
      cancelled = true;
    };
  }, [address]);

  function reload() {
    if (!address) return;
    fetchedRef.current = null; // Allow refetch
    setLoading(true);
    fetch(`/api/balances?address=${address}`)
      .then((res) => (res.ok ? res.json() : { balances: [] }))
      .then((data: { balances?: TokenBalance[] }) => {
        setBalances(data.balances ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  return { balances, loading, reload };
}
