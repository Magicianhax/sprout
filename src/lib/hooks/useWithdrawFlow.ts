"use client";

import { useCallback, useRef, useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { getWithdrawQuote } from "@/lib/api/composer";
import { fetchVaults } from "@/lib/api/earn";
import { toTokenUnits } from "@/lib/format";
import { useVaults } from "@/lib/hooks/useVaults";
import type { ComposerQuote, Position, Vault } from "@/lib/types";

type Phase = "idle" | "quoting" | "confirming" | "success" | "error";

interface FlowState {
  phase: Phase;
  position: Position | null;
  quote: ComposerQuote | null;
  txHash: string;
  errorMessage: string;
}

const INITIAL: FlowState = {
  phase: "idle",
  position: null,
  quote: null,
  txHash: "",
  errorMessage: "",
};

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

  const close = useCallback(() => {
    inFlightRef.current = false;
    setState(INITIAL);
  }, []);

  const resolveVault = useCallback(
    async (position: Position): Promise<Vault> => {
      const cached = cachedVaults.find((v) => matchVault(position, v));
      if (cached) return cached;

      // Fallback — the vault cache hasn't reached this protocol/chain
      // yet. Paginate the earn API directly until we find a match.
      let cursor: string | undefined;
      for (let page = 0; page < 10; page++) {
        const res = await fetchVaults({
          chainId: position.chainId,
          limit: 100,
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
    async (position: Position) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      setState({
        phase: "quoting",
        position,
        quote: null,
        txHash: "",
        errorMessage: "",
      });

      try {
        const numeric = parseFloat(position.balanceNative);
        if (!(numeric > 0)) {
          throw new Error("Nothing to withdraw — your balance is zero.");
        }

        const wallet = wallets.find((w) => !!w.address) ?? wallets[0];
        if (!wallet) {
          throw new Error("No wallet found. Please reconnect.");
        }

        const vault = await resolveVault(position);
        const fromAmount = toTokenUnits(numeric, position.asset.decimals);

        const quote = await getWithdrawQuote({
          fromChain: position.chainId,
          toChain: position.chainId,
          fromToken: vault.address, // vault receipt token
          toToken: position.asset.address, // underlying
          fromAmount,
          fromAddress: wallet.address,
        });

        setState((s) => ({ ...s, phase: "confirming", quote }));

        const { transactionRequest } = quote;
        await wallet.switchChain(transactionRequest.chainId);

        const provider = await wallet.getEthereumProvider();
        const hash = await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: wallet.address,
              to: transactionRequest.to,
              data: transactionRequest.data,
              value:
                transactionRequest.value && transactionRequest.value !== "0"
                  ? `0x${BigInt(transactionRequest.value).toString(16)}`
                  : undefined,
            },
          ],
        });

        setState((s) => ({ ...s, phase: "success", txHash: hash as string }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Withdrawal failed";
        setState((s) => ({ ...s, phase: "error", errorMessage: message }));
      } finally {
        inFlightRef.current = false;
      }
    },
    [wallets, resolveVault]
  );

  const retry = useCallback(() => {
    if (!state.position) return;
    void run(state.position);
  }, [run, state.position]);

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
