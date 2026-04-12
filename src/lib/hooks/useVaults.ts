"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Vault, SortBy } from "@/lib/types";
import { fetchVaultsStreaming } from "@/lib/api/earn";
import { parseTvl, getRiskLevel } from "@/lib/format";

interface UseVaultsOptions {
  chainIds?: number[];
  sortBy?: SortBy;
  riskLevel?: "low" | "medium" | "high";
  token?: string;
}

// Shared stream state keyed by fetch scope (asset token only — chain,
// sort, and risk are client-side so they don't belong in the key).
// Components subscribe via useVaults() and see cumulative updates as
// each API page lands.
interface StreamState {
  vaults: Vault[];
  done: boolean;
  error: Error | null;
}

const EMPTY_STATE: StreamState = { vaults: [], done: false, error: null };

const streams = new Map<string, StreamState>();
const inflight = new Map<string, Promise<Vault[]>>();
const subscribers = new Map<string, Set<(s: StreamState) => void>>();

function keyOf(token?: string): string {
  return token ?? "__all__";
}

function setState(key: string, state: StreamState) {
  streams.set(key, state);
  const subs = subscribers.get(key);
  if (!subs) return;
  for (const cb of subs) cb(state);
}

function startStream(token: string | undefined) {
  const key = keyOf(token);
  const existing = streams.get(key);
  if (existing?.done && !existing.error) return;
  if (inflight.has(key)) return;

  setState(key, { vaults: existing?.vaults ?? [], done: false, error: null });

  const promise = fetchVaultsStreaming(
    { pageSize: 100, maxPages: 10, asset: token },
    (cumulative) => {
      setState(key, { vaults: cumulative, done: false, error: null });
    }
  )
    .then((final) => {
      setState(key, { vaults: final, done: true, error: null });
      inflight.delete(key);
      return final;
    })
    .catch((err) => {
      const error = err instanceof Error ? err : new Error(String(err));
      setState(key, {
        vaults: streams.get(key)?.vaults ?? [],
        done: true,
        error,
      });
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, promise);
}

function subscribe(token: string | undefined, cb: (s: StreamState) => void): () => void {
  const key = keyOf(token);
  let subs = subscribers.get(key);
  if (!subs) {
    subs = new Set();
    subscribers.set(key, subs);
  }
  subs.add(cb);
  return () => {
    subs!.delete(cb);
  };
}

export function useVaults(options: UseVaultsOptions = {}) {
  const { chainIds, sortBy = "tvl", riskLevel, token } = options;

  const [state, setLocalState] = useState<StreamState>(
    () => streams.get(keyOf(token)) ?? EMPTY_STATE
  );

  useEffect(() => {
    // Sync to the latest value on mount in case another instance
    // already advanced the stream.
    setLocalState(streams.get(keyOf(token)) ?? EMPTY_STATE);
    const unsub = subscribe(token, setLocalState);
    startStream(token);
    return unsub;
  }, [token]);

  const vaults = useMemo(() => {
    let result = state.vaults;

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
  }, [state.vaults, chainIds, riskLevel, sortBy]);

  const loading = state.vaults.length === 0 && !state.done && !state.error;
  const loadingMore = state.vaults.length > 0 && !state.done && !state.error;
  const error = state.error?.message ?? null;

  const reload = useCallback(() => {
    const key = keyOf(token);
    streams.delete(key);
    inflight.delete(key);
    setLocalState(EMPTY_STATE);
    startStream(token);
  }, [token]);

  return { vaults, loading, loadingMore, error, reload };
}
