"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { useVaults } from "@/lib/hooks/useVaults";
import {
  invalidatePositions,
  optimisticallyRemovePosition,
} from "@/lib/hooks/usePositions";
import { invalidateActivity } from "@/lib/hooks/useActivity";
import { invalidateBalances } from "@/lib/hooks/useBalances";
import { executeVaultWithdraw } from "@/lib/withdrawExecutor";
import { POSITION_RESYNC_DELAYS_MS } from "@/lib/constants";
import {
  buildWithdrawPlan,
  planTotalUsd,
  type WithdrawStep,
} from "@/lib/withdrawPlanner";
import type { Position, Vault } from "@/lib/types";

type Phase = "idle" | "planning" | "confirming" | "success" | "error";

export interface SmartWithdrawState {
  phase: Phase;
  plan: WithdrawStep[];
  /** Which step is currently being signed / waiting on the wallet. */
  currentStepIndex: number;
  /** Successful step results, in order. */
  completed: Array<{ step: WithdrawStep; txHash: string }>;
  errorMessage: string;
  requestedUsd: number;
}

const INITIAL: SmartWithdrawState = {
  phase: "idle",
  plan: [],
  currentStepIndex: -1,
  completed: [],
  errorMessage: "",
  requestedUsd: 0,
};

function scheduleResync(walletAddress: string) {
  invalidateBalances(walletAddress).catch(() => {});
  invalidatePositions(walletAddress).catch(() => {});
  for (const ms of POSITION_RESYNC_DELAYS_MS) {
    setTimeout(() => {
      invalidateBalances(walletAddress).catch(() => {});
      invalidatePositions(walletAddress).catch(() => {});
      invalidateActivity(walletAddress).catch(() => {});
    }, ms);
  }
}

async function resolveVault(
  position: Position,
  cachedVaults: Vault[]
): Promise<Vault> {
  const assetAddr = position.asset.address.toLowerCase();
  const hit = cachedVaults.find(
    (v) =>
      v.chainId === position.chainId &&
      v.protocol.name === position.protocolName &&
      v.underlyingTokens.some((t) => t.address.toLowerCase() === assetAddr)
  );
  if (!hit) {
    throw new Error("Couldn't find the source vault for one of the steps.");
  }
  return hit;
}

export function useSmartWithdrawFlow() {
  const { wallets } = useWallets();
  const { vaults: cachedVaults } = useVaults();
  const [state, setState] = useState<SmartWithdrawState>(INITIAL);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  // Correctly track mounted state across React strict-mode double-
  // invocations: set to true on every effect run, false only on the
  // real unmount cleanup. A cleanup-only effect would flip the ref
  // to false on the strict-mode simulated remount and never reset
  // it, silently dropping every setState that followed.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const safeSetState = useCallback(
    (
      updater:
        | SmartWithdrawState
        | ((prev: SmartWithdrawState) => SmartWithdrawState)
    ) => {
      if (!mountedRef.current) return;
      setState(updater);
    },
    []
  );

  const close = useCallback(() => {
    inFlightRef.current = false;
    safeSetState(INITIAL);
  }, [safeSetState]);

  // Execute an already-built plan starting at `fromIndex`. Used by both
  // start() and retry() so resume-on-failure shares one code path.
  const executePlan = useCallback(
    async (plan: WithdrawStep[], fromIndex: number, requestedUsd: number) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        const wallet = wallets.find((w) => !!w.address) ?? wallets[0];
        if (!wallet) {
          throw new Error("No wallet found. Please reconnect.");
        }

        safeSetState((s) => ({
          ...s,
          phase: "confirming",
          plan,
          currentStepIndex: fromIndex,
          requestedUsd,
          errorMessage: "",
        }));

        for (let i = fromIndex; i < plan.length; i++) {
          const step = plan[i];
          safeSetState((s) => ({ ...s, currentStepIndex: i }));

          const vault = await resolveVault(step.position, cachedVaults);

          const { txHash, isFullWithdrawal } = await executeVaultWithdraw({
            wallet,
            position: step.position,
            vault,
            amount: step.amount,
            // No per-step UI flicker — we're already in "confirming".
          });

          // Optimistically remove the whole position from the shared
          // cache only if we redeemed all of it. Partial steps rely on
          // the background resync.
          if (isFullWithdrawal) {
            optimisticallyRemovePosition(
              wallet.address,
              step.position.chainId,
              step.position.asset.address,
              step.position.protocolName
            );
          }

          safeSetState((s) => ({
            ...s,
            completed: [...s.completed, { step, txHash }],
          }));
        }

        // Plan fully executed — kick the long-tail resync so balances,
        // positions, and activity reflect the new state.
        const wa = wallet.address;
        scheduleResync(wa);

        safeSetState((s) => ({ ...s, phase: "success" }));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Withdrawal failed";
        safeSetState((s) => ({ ...s, phase: "error", errorMessage: message }));
      } finally {
        inFlightRef.current = false;
      }
    },
    [wallets, cachedVaults, safeSetState]
  );

  const start = useCallback(
    async (requestedUsd: number, positions: Position[]) => {
      if (inFlightRef.current) return;

      const plan = buildWithdrawPlan(positions, cachedVaults, requestedUsd);
      if (plan.length === 0) {
        safeSetState((s) => ({
          ...s,
          phase: "error",
          errorMessage: "Nothing to withdraw for the requested amount.",
          requestedUsd,
        }));
        return;
      }

      // If we can't cover the requested amount with available
      // positions, abort early with a clear error.
      const planTotal = planTotalUsd(plan);
      if (planTotal < requestedUsd * 0.99) {
        safeSetState((s) => ({
          ...s,
          phase: "error",
          errorMessage: `You only have about $${planTotal.toFixed(
            2
          )} earning — try a smaller amount.`,
          requestedUsd,
          plan,
        }));
        return;
      }

      safeSetState({
        phase: "planning",
        plan,
        currentStepIndex: 0,
        completed: [],
        errorMessage: "",
        requestedUsd,
      });

      await executePlan(plan, 0, requestedUsd);
    },
    [cachedVaults, executePlan, safeSetState]
  );

  // Resume from wherever we failed.
  const retry = useCallback(() => {
    if (state.plan.length === 0) return;
    const fromIndex = state.completed.length;
    if (fromIndex >= state.plan.length) return;
    safeSetState((s) => ({ ...s, phase: "confirming", errorMessage: "" }));
    void executePlan(state.plan, fromIndex, state.requestedUsd);
  }, [state.plan, state.completed.length, state.requestedUsd, executePlan, safeSetState]);

  const modalStatus: "confirming" | "success" | "error" | null =
    state.phase === "success"
      ? "success"
      : state.phase === "error"
      ? "error"
      : state.phase === "confirming" || state.phase === "planning"
      ? "confirming"
      : null;

  return {
    state,
    start,
    retry,
    close,
    modalStatus,
  };
}
