"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { getWithdrawQuote } from "@/lib/api/composer";
import { fetchVaults } from "@/lib/api/earn";
import { toTokenUnits } from "@/lib/format";
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
import type { ComposerQuote, Position, Vault } from "@/lib/types";

// Protocols whose vault address is an ERC4626 share token. For these
// we bypass composer entirely and call redeem(shares, receiver, owner)
// directly on the vault contract — that's how Morpho MetaMorpho,
// Euler V2 factories, and most modern vault standards are built.
const ERC4626_PROTOCOLS = new Set([
  "morpho-v1",
  "morpho-v2",
  "euler-v2",
  "felix-vanilla",
  "seamless",
  "upshift",
  "usdai",
  "hyperlend",
  "neverland",
  "yo-protocol",
]);

// Function selectors (keccak256 first 4 bytes)
const BALANCE_OF_SELECTOR = "0x70a08231"; // balanceOf(address)
const REDEEM_SELECTOR = "0xba087652"; // redeem(uint256,address,address)
const WITHDRAW_SELECTOR = "0xb460af94"; // withdraw(uint256,address,address)

function hex32(value: string | bigint): string {
  const hex =
    typeof value === "bigint"
      ? value.toString(16)
      : value.replace(/^0x/, "").toLowerCase();
  return hex.padStart(64, "0");
}

function encodeBalanceOf(holder: string): string {
  return `${BALANCE_OF_SELECTOR}${hex32(holder)}`;
}

function encodeRedeem(shares: bigint, receiver: string, owner: string): string {
  return `${REDEEM_SELECTOR}${hex32(shares)}${hex32(receiver)}${hex32(owner)}`;
}

function encodeWithdraw(
  assets: bigint,
  receiver: string,
  owner: string
): string {
  return `${WITHDRAW_SELECTOR}${hex32(assets)}${hex32(receiver)}${hex32(owner)}`;
}

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
        const fullBalance = parseFloat(position.balanceNative);
        if (!Number.isFinite(fullBalance) || fullBalance <= 0) {
          throw new Error("Nothing to withdraw — your balance is zero.");
        }

        // Clamp the requested amount to the actual balance. Anything
        // within a tiny epsilon of the balance is treated as a full
        // withdrawal (avoids rounding errors leaving 0.000001 dust).
        const requested =
          options?.amount && options.amount > 0
            ? Math.min(options.amount, fullBalance)
            : fullBalance;
        const isFullWithdrawal = requested >= fullBalance * 0.9999;
        const numeric = requested;

        const wallet = wallets.find((w) => !!w.address) ?? wallets[0];
        if (!wallet) {
          throw new Error("No wallet found. Please reconnect.");
        }

        const vault = await resolveVault(position);

        // Defense in depth: matchVault already checks chainId, but if
        // a future code path bypasses it we don't want to send to a
        // contract on the wrong chain.
        if (vault.chainId !== position.chainId) {
          throw new Error("Vault chain mismatch — refusing to send transaction.");
        }

        // ERC4626 direct redeem path — works for Morpho, Euler V2, and
        // any modern vault that exposes the standard redeem(shares,
        // receiver, owner) interface. Composer's /v1/quote doesn't
        // handle vault receipt tokens as fromToken (returns 404), so
        // we bypass it and call the vault contract directly.
        if (ERC4626_PROTOCOLS.has(position.protocolName)) {
          await wallet.switchChain(position.chainId);
          const provider = await wallet.getEthereumProvider();

          // Confirm we're actually on the requested chain after the
          // switch — Privy can silently leave us on the previous one
          // if the user dismisses the wallet prompt.
          const chainHex = (await provider.request({ method: "eth_chainId" })) as string;
          if (parseInt(chainHex, 16) !== position.chainId) {
            throw new Error("Wallet is on the wrong chain. Please switch networks.");
          }

          let data: string;
          if (isFullWithdrawal) {
            // Full exit — read share balance and redeem all of it.
            // Using redeem() (shares) is the safest way to leave nothing
            // behind since the vault itself converts shares → assets.
            const balanceHex = (await provider.request({
              method: "eth_call",
              params: [
                { to: vault.address, data: encodeBalanceOf(wallet.address) },
                "latest",
              ],
            })) as string;

            const shares = BigInt(balanceHex);
            if (shares === BigInt(0)) {
              throw new Error("No shares to redeem — position already empty.");
            }
            data = encodeRedeem(shares, wallet.address, wallet.address);
          } else {
            // Partial — use withdraw(assets, receiver, owner). Takes
            // the underlying amount the user wants back; the vault
            // burns just enough shares to cover it.
            const assets = BigInt(toTokenUnits(numeric, position.asset.decimals));
            if (assets === BigInt(0)) {
              throw new Error("Withdraw amount rounds to zero.");
            }
            data = encodeWithdraw(assets, wallet.address, wallet.address);
          }

          safeSetState((s) => ({ ...s, phase: "confirming" }));

          const hash = (await provider.request({
            method: "eth_sendTransaction",
            params: [
              {
                from: wallet.address,
                to: vault.address,
                data,
              },
            ],
          })) as string;

          markWithdrawn(position, wallet.address, isFullWithdrawal);
          safeSetState((s) => ({ ...s, phase: "success", txHash: hash }));
          return;
        }

        // Fallback: composer quote path for protocols that do handle
        // vault token → underlying swaps (Lido, Ethena, some swap-based
        // exits). This will 404 for pure ERC4626 vaults — hence the
        // branch above.
        const fromAmount = toTokenUnits(numeric, position.asset.decimals);

        const quote = await getWithdrawQuote({
          fromChain: position.chainId,
          toChain: position.chainId,
          fromToken: vault.address, // vault receipt token
          toToken: position.asset.address, // underlying
          fromAmount,
          fromAddress: wallet.address,
        });

        // Reject quotes that target a different chain than expected.
        if (quote.transactionRequest.chainId !== position.chainId) {
          throw new Error("Quote returned the wrong chain — aborting.");
        }

        safeSetState((s) => ({ ...s, phase: "confirming", quote }));

        const { transactionRequest } = quote;
        await wallet.switchChain(transactionRequest.chainId);

        const provider = await wallet.getEthereumProvider();
        const chainHex = (await provider.request({ method: "eth_chainId" })) as string;
        if (parseInt(chainHex, 16) !== transactionRequest.chainId) {
          throw new Error("Wallet is on the wrong chain. Please switch networks.");
        }

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

        markWithdrawn(position, wallet.address, isFullWithdrawal);
        safeSetState((s) => ({ ...s, phase: "success", txHash: hash as string }));
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
