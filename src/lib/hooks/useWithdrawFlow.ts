"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { fetchVaults } from "@/lib/api/earn";
import {
  POSITION_RESYNC_DELAYS_MS,
  VAULT_MAX_PAGES,
  VAULT_PAGE_SIZE,
} from "@/lib/constants";
import { useVaults } from "@/lib/hooks/useVaults";
import {
  invalidatePositions,
  optimisticallyRemovePosition,
} from "@/lib/hooks/usePositions";
import { invalidateActivity } from "@/lib/hooks/useActivity";
import { invalidateBalances } from "@/lib/hooks/useBalances";
import { executeVaultWithdraw } from "@/lib/withdrawExecutor";
import type { ComposerQuote, Position, Vault } from "@/lib/types";

type Phase = "idle" | "quoting" | "confirming" | "success" | "error";

interface FlowState {
  phase: Phase;
  position: Position | null;
  quote: ComposerQuote | null;
  txHash: string;
  errorMessage: string;
  /** Amount requested on the current run — used by retry. Undefined means full. */
  requestedAmount?: number;
}

const INITIAL: FlowState = {
  phase: "idle",
  position: null,
  quote: null,
  txHash: "",
  errorMessage: "",
};

// On successful withdrawal: if the user withdrew the full position we
// remove it from the shared cache immediately so the UI updates without
// waiting for the earn indexer. For partial withdrawals we just kick a
// reload — the position still exists with a smaller balance and the
// indexer will report the new number after ~5–30 s. In both cases we
// schedule a few background reloads to confirm the final state.
function markWithdrawn(
  position: Position,
  walletAddress: string,
  isFullWithdrawal: boolean
) {
  if (isFullWithdrawal) {
    optimisticallyRemovePosition(
      walletAddress,
      position.chainId,
      position.asset.address,
      position.protocolName
    );
  }
  // Fire an immediate round so the user sees the change as soon as
  // they close the success modal, then follow up on the retry
  // schedule for the slow indexer tail.
  invalidateBalances(walletAddress).catch(() => {});
  for (const ms of POSITION_RESYNC_DELAYS_MS) {
    setTimeout(() => {
      invalidateBalances(walletAddress).catch(() => {});
      invalidatePositions(walletAddress).catch((err) => {
        console.warn("[withdraw] background position resync failed", err);
      });
      invalidateActivity(walletAddress).catch(() => {
        /* non-critical */
      });
    }, ms);
  }
}

function matchVault(position: Position, vault: Vault): boolean {
  return (
    vault.chainId === position.chainId &&
    vault.protocol.name === position.protocolName &&
    vault.underlyingTokens.some(
      (t) => t.address.toLowerCase() === position.asset.address.toLowerCase()
    )
  );
}

// Shared withdrawal flow used everywhere Stop Earning lives (portfolio
// list, vault detail, etc.). Callers pass in the Position — the hook
// resolves the vault's receipt token, fetches a composer quote for the
// full native balance, and fires the wallet transaction automatically.
export function useWithdrawFlow() {
  // Reading useVaults() here subscribes to the shared vault cache so
  // we have a receipt-token address for the position's protocol.
  const { vaults: cachedVaults } = useVaults();
  const { wallets } = useWallets();

  const [state, setState] = useState<FlowState>(INITIAL);
  const inFlightRef = useRef(false);
  // Tracks whether the consumer has unmounted or closed the modal so
  // late-arriving promise resolutions don't write into stale state.
  const closedRef = useRef(false);

  useEffect(() => {
    closedRef.current = false;
    return () => {
      closedRef.current = true;
    };
  }, []);

  const safeSetState = useCallback(
    (updater: FlowState | ((s: FlowState) => FlowState)) => {
      if (closedRef.current) return;
      setState(updater);
    },
    []
  );

  const close = useCallback(() => {
    inFlightRef.current = false;
    closedRef.current = true;
    setState(INITIAL);
    // Allow a fresh run after re-open from the same hook instance.
    queueMicrotask(() => {
      closedRef.current = false;
    });
  }, []);

  const resolveVault = useCallback(
    async (position: Position): Promise<Vault> => {
      const cached = cachedVaults.find((v) => matchVault(position, v));
      if (cached) return cached;

      // Fallback — the vault cache hasn't reached this protocol/chain
      // yet. Paginate the earn API directly until we find a match.
      let cursor: string | undefined;
      for (let page = 0; page < VAULT_MAX_PAGES; page++) {
        const res = await fetchVaults({
          chainId: position.chainId,
          limit: VAULT_PAGE_SIZE,
          cursor,
        });
        const hit = res.data.find((v) => matchVault(position, v));
        if (hit) return hit;
        if (!res.nextCursor) break;
        cursor = res.nextCursor;
      }

      throw new Error("Couldn't find this vault to withdraw from.");
    },
    [cachedVaults]
  );

  const run = useCallback(
    async (position: Position, options?: { amount?: number }) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      closedRef.current = false;

      safeSetState({
        phase: "quoting",
        position,
        quote: null,
        txHash: "",
        errorMessage: "",
        requestedAmount: options?.amount,
      });

      try {
        const wallet = wallets.find((w) => !!w.address) ?? wallets[0];
        if (!wallet) {
          throw new Error("No wallet found. Please reconnect.");
        }

        const vault = await resolveVault(position);

        const { txHash, isFullWithdrawal } = await executeVaultWithdraw({
          wallet,
          position,
          vault,
          amount: options?.amount,
          onConfirming: () => {
            safeSetState((s) => ({ ...s, phase: "confirming" }));
          },
        });

        markWithdrawn(position, wallet.address, isFullWithdrawal);
        safeSetState((s) => ({ ...s, phase: "success", txHash }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Withdrawal failed";
        safeSetState((s) => ({ ...s, phase: "error", errorMessage: message }));
      } finally {
        inFlightRef.current = false;
      }
    },
    [wallets, resolveVault, safeSetState]
  );

  const retry = useCallback(() => {
    if (!state.position) return;
    void run(state.position, { amount: state.requestedAmount });
  }, [run, state.position, state.requestedAmount]);

  const modalStatus: "confirming" | "success" | "error" | null =
    state.phase === "success"
      ? "success"
      : state.phase === "error"
      ? "error"
      : state.phase === "confirming" || state.phase === "quoting"
      ? "confirming"
      : null;

  return {
    state,
    start: run,
    retry,
    close,
    modalStatus,
  };
}
