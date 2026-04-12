"use client";

import { useCallback, useEffect, useState } from "react";
import type { Position } from "@/lib/types";
import { fetchPositions } from "@/lib/api/earn";
import { SUPPORTED_CHAIN_IDS } from "@/lib/constants";

// Module-level shared cache + pub-sub so every usePositions() consumer
// sees the same state and reacts to updates from any caller (e.g. the
// withdraw flow optimistically removing a redeemed position).
const cache = new Map<string, Position[]>();
const inflight = new Map<string, Promise<Position[]>>();
const subscribers = new Map<string, Set<(positions: Position[]) => void>>();

function notify(address: string) {
  const list = cache.get(address) ?? [];
  const subs = subscribers.get(address);
  if (!subs) return;
  for (const cb of subs) cb(list);
}

function subscribe(address: string, cb: (positions: Position[]) => void): () => void {
  let subs = subscribers.get(address);
  if (!subs) {
    subs = new Set();
    subscribers.set(address, subs);
  }
  subs.add(cb);
  return () => {
    subs!.delete(cb);
  };
}

async function loadPositions(address: string): Promise<Position[]> {
  const existing = inflight.get(address);
  if (existing) return existing;

  const promise = fetchPositions(address)
    .then((data) => {
      const supported = (data.positions ?? []).filter((p) =>
        SUPPORTED_CHAIN_IDS.includes(
          p.chainId as typeof SUPPORTED_CHAIN_IDS[number]
        )
      );
      cache.set(address, supported);
      inflight.delete(address);
      notify(address);
      return supported;
    })
    .catch((err) => {
      inflight.delete(address);
      throw err;
    });

  inflight.set(address, promise);
  return promise;
}

// Optimistically remove a position from the cache (used by the withdraw
// flow on success — the on-chain event takes a few seconds to reach
// the earn indexer, and we don't want the UI to lie in the meantime).
export function optimisticallyRemovePosition(
  address: string,
  chainId: number,
  assetAddress: string,
  protocolName: string
) {
  const current = cache.get(address);
  if (!current) return;
  const next = current.filter(
    (p) =>
      !(
        p.chainId === chainId &&
        p.asset.address.toLowerCase() === assetAddress.toLowerCase() &&
        p.protocolName === protocolName
      )
  );
  cache.set(address, next);
  notify(address);
}

// Force a fresh fetch (clears cache and any inflight promise).
export function invalidatePositions(address: string): Promise<Position[]> {
  cache.delete(address);
  inflight.delete(address);
  return loadPositions(address);
}

export function usePositions(address: string | undefined) {
  const [positions, setPositions] = useState<Position[]>(() =>
    address && cache.has(address) ? cache.get(address)! : []
  );
  const [loading, setLoading] = useState(
    () => Boolean(address) && !cache.has(address ?? "")
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    // Sync local state with shared cache on mount
    if (cache.has(address)) {
      setPositions(cache.get(address)!);
      setLoading(false);
    } else {
      setLoading(true);
      setError(null);
      loadPositions(address)
        .then(() => {
          // state pushed via subscribe callback
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Couldn't load your positions");
        })
        .finally(() => {
          setLoading(false);
        });
    }

    const unsub = subscribe(address, (next) => {
      setPositions(next);
    });
    return unsub;
  }, [address]);

  const reload = useCallback(() => {
    if (!address) return;
    setLoading(true);
    setError(null);
    invalidatePositions(address)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Couldn't load your positions");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [address]);

  const totalBalance = positions.reduce(
    (sum, p) => sum + parseFloat(p.balanceUsd || "0"),
    0
  );

  return { positions, loading, error, reload, totalBalance };
}
