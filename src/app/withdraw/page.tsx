"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ArrowLeft } from "lucide-react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { TransactionModal } from "@/components/deposit/TransactionModal";
import { getWithdrawQuote } from "@/lib/api/composer";
import { fetchPositions } from "@/lib/api/earn";
import { getWithdrawMethod } from "@/lib/withdrawal";
import { toTokenUnits, formatTokenAmount } from "@/lib/format";
import { displayProtocol } from "@/lib/protocols";
import { CHAIN_NAMES } from "@/lib/constants";
import type { ComposerQuote } from "@/lib/types";

type Phase =
  | "loading-position"  // fetching position balance
  | "quoting"           // fetching composer quote
  | "ready"             // quote arrived, about to fire wallet prompt
  | "confirming"        // wallet prompt open / tx pending
  | "success"
  | "error";

function WithdrawPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = usePrivy();
  const { wallets } = useWallets();

  const vault = searchParams.get("vault") ?? "";
  const chainId = Number(searchParams.get("chainId") ?? "0");
  const protocolName = searchParams.get("protocolName") ?? "";
  const asset = searchParams.get("asset") ?? "";
  const assetSymbol = searchParams.get("assetSymbol") ?? "Token";
  const assetDecimals = Number(searchParams.get("assetDecimals") ?? "18");

  const walletAddress = user?.wallet?.address ?? "";
  const withdrawMethod = getWithdrawMethod(protocolName);
  const chainName = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;

  const [phase, setPhase] = useState<Phase>("loading-position");
  const [positionBalance, setPositionBalance] = useState<string>("");
  const [quote, setQuote] = useState<ComposerQuote | null>(null);
  const [txHash, setTxHash] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Fire-once guard so HMR / strict-mode double effects don't re-trigger
  // the wallet prompt after the user has already seen it.
  const confirmedRef = useRef(false);

  // Step 1 — fetch the position balance from the Earn API
  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;

    fetchPositions(walletAddress)
      .then((data) => {
        if (cancelled) return;
        const match = data.positions?.find(
          (p) =>
            p.asset.address.toLowerCase() === asset.toLowerCase() &&
            p.chainId === chainId &&
            p.protocolName === protocolName
        );
        if (!match) {
          setErrorMessage("Couldn't find this position in your portfolio.");
          setPhase("error");
          return;
        }
        setPositionBalance(match.balanceNative);
        setPhase("quoting");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : "Failed to load position");
        setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [walletAddress, asset, chainId, protocolName]);

  // Step 2 — once we have the balance, fetch a composer quote for the full amount
  useEffect(() => {
    if (phase !== "quoting") return;
    if (!vault || !walletAddress || !positionBalance) return;

    let cancelled = false;
    const numeric = parseFloat(positionBalance);
    if (!(numeric > 0)) {
      setErrorMessage("Nothing to withdraw — your balance is zero.");
      setPhase("error");
      return;
    }

    const fromAmount = toTokenUnits(numeric, assetDecimals);

    getWithdrawQuote({
      fromChain: chainId,
      toChain: chainId,
      fromToken: vault,
      toToken: asset,
      fromAmount,
      fromAddress: walletAddress,
    })
      .then((result) => {
        if (cancelled) return;
        setQuote(result);
        setPhase("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : "Could not fetch quote");
        setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [phase, vault, walletAddress, positionBalance, assetDecimals, chainId, asset]);

  const sendTransaction = useCallback(async () => {
    if (!quote || !walletAddress) return;

    const wallet =
      wallets.find((w) => w.address.toLowerCase() === walletAddress.toLowerCase()) ??
      wallets[0];
    if (!wallet) {
      setErrorMessage("No wallet found. Please reconnect.");
      setPhase("error");
      return;
    }

    setPhase("confirming");
    setErrorMessage("");

    try {
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

      setTxHash(hash as string);
      setPhase("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      setErrorMessage(message);
      setPhase("error");
    }
  }, [quote, walletAddress, wallets]);

  // Step 3 — once the quote is ready, automatically fire the wallet prompt.
  useEffect(() => {
    if (phase !== "ready") return;
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    void sendTransaction();
  }, [phase, sendTransaction]);

  function handleRetry() {
    confirmedRef.current = false;
    setQuote(null);
    setErrorMessage("");
    setPhase("quoting");
  }

  function handleClose() {
    router.replace("/portfolio");
  }

  const maxAmount = parseFloat(positionBalance) || 0;
  const receiveAmount = quote
    ? formatTokenAmount(quote.estimate.toAmount, assetDecimals)
    : 0;

  const modalStatus =
    phase === "confirming"
      ? "confirming"
      : phase === "success"
      ? "success"
      : phase === "error"
      ? "error"
      : null;

  return (
    <main className="flex flex-col min-h-dvh bg-sprout-gradient">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <button
          onClick={() => router.back()}
          className="p-1 -ml-1 cursor-pointer text-sprout-text-secondary"
          aria-label="Go back"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="font-heading text-xl font-bold text-sprout-text-primary">
          Stop Earning
        </h1>
      </div>

      <div className="flex flex-col gap-5 px-5 pb-10 flex-1 overflow-y-auto">
        {/* Summary card */}
        <Card>
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <TokenIcon type="token" identifier={assetSymbol} size={48} />
              <div
                className="absolute -bottom-1 -right-1 rounded-full border-2 border-sprout-card overflow-hidden"
                style={{ width: 20, height: 20 }}
              >
                <TokenIcon type="chain" identifier={chainId} size={20} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-sprout-text-muted uppercase tracking-wide">
                Withdrawing from
              </p>
              <p className="font-semibold text-sprout-text-primary truncate">
                {displayProtocol(protocolName)} · {chainName}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-sprout-border">
            <span className="text-sm text-sprout-text-muted">Amount</span>
            {phase === "loading-position" ? (
              <span className="text-sm text-sprout-text-muted animate-pulse">
                Loading…
              </span>
            ) : (
              <span className="font-heading text-base font-bold text-sprout-text-primary">
                {maxAmount.toFixed(6)} {assetSymbol}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-sprout-text-muted">You&apos;ll receive</span>
            {phase === "loading-position" || phase === "quoting" ? (
              <span className="text-sm text-sprout-text-muted animate-pulse">
                Fetching best rate…
              </span>
            ) : quote ? (
              <span className="font-heading text-base font-bold text-sprout-green-dark">
                ~{receiveAmount.toFixed(6)} {assetSymbol}
              </span>
            ) : (
              <span className="text-sm text-sprout-text-muted">—</span>
            )}
          </div>
        </Card>

        {/* Withdrawal method badge */}
        <div className="flex items-center gap-2 px-1">
          {withdrawMethod === "composer" ? (
            <Badge color="green">Direct withdrawal</Badge>
          ) : (
            <Badge color="amber">Market swap</Badge>
          )}
          <span className="text-xs text-sprout-text-muted">
            {withdrawMethod === "composer"
              ? "Withdrawn directly from the protocol"
              : "Sold on secondary market via LI.FI"}
          </span>
        </div>

        {withdrawMethod === "swap" && (
          <div className="bg-amber-50 rounded-2xl px-4 py-3 text-sm text-amber-800 leading-relaxed">
            This vault uses market swap for withdrawals. You may receive slightly
            less due to market conditions.
          </div>
        )}

        {/* Inline status copy while auto-flow runs */}
        {(phase === "loading-position" || phase === "quoting" || phase === "ready") && (
          <div className="flex items-center justify-center gap-2 text-xs text-sprout-text-muted pt-2">
            <span className="w-3 h-3 rounded-full border-2 border-sprout-green-primary border-t-transparent animate-spin" />
            {phase === "loading-position"
              ? "Loading your position…"
              : phase === "quoting"
              ? "Preparing withdrawal…"
              : "Opening wallet…"}
          </div>
        )}
      </div>

      {/* Fallback CTA — only when confirm is dismissed / failed so user can retry */}
      {phase === "error" && !modalStatus && (
        <div className="px-5 pb-8 pt-2 bg-sprout-gradient">
          <Button className="w-full" onClick={handleRetry}>
            Try Again
          </Button>
        </div>
      )}

      <TransactionModal
        status={modalStatus}
        txHash={txHash}
        chainId={chainId}
        errorMessage={errorMessage}
        onClose={handleClose}
        onRetry={handleRetry}
      />
    </main>
  );
}

export default function WithdrawPage() {
  return (
    <AuthGuard>
      <WithdrawPageContent />
    </AuthGuard>
  );
}
