"use client";

import { useState, useEffect, useCallback } from "react";
import type { Position } from "@/lib/types";
import { fetchPositions } from "@/lib/api/earn";
import { SUPPORTED_CHAIN_IDS } from "@/lib/constants";

// Module-level cache — persists across re-mounts and strict-mode double-invocations
const cache = new Map<string, Position[]>();
const inflight = new Map<string, Promise<Position[]>>();

async function loadPositions(address: string): Promise<Position[]> {
  if (cache.has(address)) return cache.get(address)!;

  const existing = inflight.get(address);
  if (existing) return existing;

  const promise = fetchPositions(address)
    .then((data) => {
      const supported = (data.positions ?? []).filter(
        (p) => SUPPORTED_CHAIN_IDS.includes(p.chainId as typeof SUPPORTED_CHAIN_IDS[number])
      );
      cache.set(address, supported);
      inflight.delete(address);
      return supported;
    })
    .catch((err) => {
      inflight.delete(address);
      throw err;
    });

  inflight.set(address, promise);
  return promise;
}

export function usePositions(address: string | undefined) {
  const [positions, setPositions] = useState<Position[]>(() =>
    address && cache.has(address) ? cache.get(address)! : []
  );
  const [loading, setLoading] = useState(() => Boolean(address) && !cache.has(address ?? ""));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    if (cache.has(address)) {
      setPositions(cache.get(address)!);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    loadPositions(address)
      .then((data) => {
        if (!cancelled) {
          setPositions(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Couldn't load your positions");
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
    loadPositions(address)
      .then((data) => {
        setPositions(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Couldn't load your positions");
        setLoading(false);
      });
  }, [address]);

  const totalBalance = positions.reduce(
    (sum, p) => sum + parseFloat(p.balanceUsd || "0"),
    0
  );

  return { positions, loading, error, reload, totalBalance };
}
