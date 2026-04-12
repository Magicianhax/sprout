"use client";

import { useCallback, useRef, useState } from "react";
import { useWallets } from "@privy-io/react-auth";
import { getWithdrawQuote } from "@/lib/api/composer";
import { fetchVaults } from "@/lib/api/earn";
import { toTokenUnits } from "@/lib/format";
import { useVaults } from "@/lib/hooks/useVaults";
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

        // ERC4626 direct redeem path — works for Morpho, Euler V2, and
        // any modern vault that exposes the standard redeem(shares,
        // receiver, owner) interface. Composer's /v1/quote doesn't
        // handle vault receipt tokens as fromToken (returns 404), so
        // we bypass it and call the vault contract directly.
        if (ERC4626_PROTOCOLS.has(position.protocolName)) {
          await wallet.switchChain(position.chainId);
          const provider = await wallet.getEthereumProvider();

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

          setState((s) => ({ ...s, phase: "confirming" }));

          const data = encodeRedeem(shares, wallet.address, wallet.address);
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

          setState((s) => ({ ...s, phase: "success", txHash: hash }));
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
