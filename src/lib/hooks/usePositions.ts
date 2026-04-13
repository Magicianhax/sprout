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

// Drop positions whose USD value rounds to dust — they clutter the UI,
// skew avg-APY calculations, and can't meaningfully be withdrawn
// (gas would dwarf the amount).
const DUST_THRESHOLD_USD = 0.01;

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
      const meaningful = supported.filter((p) => {
        const usd = parseFloat(p.balanceUsd || "0");
        return Number.isFinite(usd) && usd >= DUST_THRESHOLD_USD;
      });
      cache.set(address, meaningful);
      inflight.delete(address);
      notify(address);
      return meaningful;
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
      // Mirroring `loading` from `address` here trips React 19's
      // set-state-in-effect rule. The proper fix is to migrate this
      // hook to useSyncExternalStore (tracked separately).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    let cancelled = false;

    // Show cached data instantly if we have it — keeps the UI snappy.
    if (cache.has(address)) {
      setPositions(cache.get(address)!);
      setLoading(false);
    } else {
      setLoading(true);
      setError(null);
    }

    // Always kick a fresh fetch on mount. loadPositions always hits
    // the earn API (deduped via the inflight map) and updates the
    // shared cache on resolve, broadcasting the new data to every
    // subscriber. The old cache entry stays in place during the
    // in-flight window so we don't flash a loading state.
    loadPositions(address)
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Couldn't load your positions");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    const unsub = subscribe(address, (next) => {
      if (cancelled) return;
      setPositions(next);
    });
    return () => {
      cancelled = true;
      unsub();
    };
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
