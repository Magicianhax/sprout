"use client";

import { useState, useEffect, useCallback } from "react";
import type { Position } from "@/lib/types";
import { fetchPositions } from "@/lib/api/earn";

export function usePositions(address: string | undefined) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPositions(address);
      setPositions(data.positions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your positions");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { load(); }, [load]);

  const totalBalance = positions.reduce(
    (sum, p) => sum + parseFloat(p.balanceUsd || "0"),
    0
  );

  return { positions, loading, error, reload: load, totalBalance };
}
