"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ArrowLeft } from "lucide-react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TransactionModal } from "@/components/deposit/TransactionModal";
import { getWithdrawQuote } from "@/lib/api/composer";
import { getWithdrawMethod } from "@/lib/withdrawal";
import { toTokenUnits, formatCurrency, formatTokenAmount } from "@/lib/format";
import type { ComposerQuote } from "@/lib/types";

type WithdrawStatus = "idle" | "quoting" | "confirming" | "success" | "error";

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

  const [amount, setAmount] = useState<string>("");
  const [positionBalance, setPositionBalance] = useState<string>("0");
  const [quote, setQuote] = useState<ComposerQuote | null>(null);
  const [status, setStatus] = useState<WithdrawStatus>("idle");
  const [txHash, setTxHash] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [quoteError, setQuoteError] = useState<string>("");

  // Load user's position balance from the positions API
  useEffect(() => {
    if (!walletAddress) return;
    fetch(`/api/positions?address=${walletAddress}`)
      .then((r) => r.json())
      .then((data) => {
        const positions: Array<{ asset: { address: string }; chainId: number; balanceNative: string }> =
          data.positions ?? [];
        const match = positions.find(
          (p) =>
            p.asset.address.toLowerCase() === asset.toLowerCase() &&
            p.chainId === chainId
        );
        if (match) setPositionBalance(match.balanceNative);
      })
      .catch(() => {
        // Balance display is best-effort; proceed without it
      });
  }, [walletAddress, asset, chainId]);

  const numericAmount = parseFloat(amount);
  const validAmount = !isNaN(numericAmount) && numericAmount > 0;
  const maxAmount = parseFloat(positionBalance) || 0;

  const fetchQuote = useCallback(async () => {
    if (!vault || !walletAddress || !validAmount) {
      setQuote(null);
      setQuoteError("");
      return;
    }

    const fromAmount = toTokenUnits(numericAmount, assetDecimals);

    setStatus("quoting");
    setQuoteError("");

    try {
      const result = await getWithdrawQuote({
        fromChain: chainId,
        toChain: chainId,
        fromToken: vault,      // vault receipt token address
        toToken: asset,        // underlying token to receive
        fromAmount,
        fromAddress: walletAddress,
      });
      setQuote(result);
      setStatus("idle");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not fetch quote";
      setQuoteError(message);
      setQuote(null);
      setStatus("idle");
    }
  }, [amount, vault, walletAddress, validAmount, numericAmount, assetDecimals, chainId, asset]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchQuote();
    }, 600);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  async function handleConfirm() {
    if (!quote || !walletAddress) return;

    const wallet = wallets.find((w) => w.address.toLowerCase() === walletAddress.toLowerCase()) ?? wallets[0];
    if (!wallet) {
      setErrorMessage("No wallet found. Please reconnect.");
      setStatus("error");
      return;
    }

    setStatus("confirming");
    setErrorMessage("");

    try {
      const { transactionRequest } = quote;

      await wallet.switchChain(transactionRequest.chainId);

      const provider = await wallet.getEthereumProvider();
      const txHash = await provider.request({
        method: "eth_sendTransaction",
        params: [{
          from: walletAddress,
          to: transactionRequest.to,
          data: transactionRequest.data,
          value: transactionRequest.value && transactionRequest.value !== "0"
            ? `0x${BigInt(transactionRequest.value).toString(16)}`
            : undefined,
        }],
      });

      setTxHash(txHash as string);
      setStatus("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      setErrorMessage(message);
      setStatus("error");
    }
  }

  const receiveAmount = quote
    ? formatTokenAmount(quote.estimate.toAmount, assetDecimals)
    : 0;
  const networkFeeUsd = quote
    ? parseFloat(quote.estimate.gasCosts[0]?.amountUSD ?? "0")
    : 0;

  const modalStatus =
    status === "confirming" || status === "success" || status === "error" ? status : null;

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
        {/* Amount section */}
        <Card>
          <p className="text-xs font-semibold text-sprout-text-secondary uppercase tracking-wide mb-3">
            How much do you want to withdraw?
          </p>

          <div className="flex items-center gap-2 mb-2">
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 text-2xl font-heading font-bold text-sprout-text-primary bg-transparent outline-none placeholder:text-sprout-text-muted"
            />
            <span className="text-base font-semibold text-sprout-text-secondary shrink-0">
              {assetSymbol}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-sprout-text-muted">
              Balance: {maxAmount > 0 ? maxAmount.toFixed(6) : "—"} {assetSymbol}
            </p>
            {maxAmount > 0 && (
              <button
                className="text-xs font-semibold text-sprout-green-dark cursor-pointer"
                onClick={() => setAmount(String(maxAmount))}
              >
                MAX
              </button>
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

        {/* Preview — only when amount is valid */}
        {validAmount && (
          <>
            {status === "quoting" ? (
              <div className="text-center py-4 text-sm text-sprout-text-muted animate-pulse">
                Fetching best rate…
              </div>
            ) : quoteError ? (
              <div className="bg-red-50 rounded-2xl px-4 py-3 text-sm text-red-600">
                {quoteError}
              </div>
            ) : quote ? (
              <Card>
                <p className="text-xs font-semibold text-sprout-text-secondary uppercase tracking-wide mb-3">
                  What you&apos;ll receive
                </p>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sprout-text-muted text-sm">Amount</span>
                  <span className="font-heading text-base font-bold text-sprout-text-primary">
                    {receiveAmount.toFixed(6)} {assetSymbol}
                  </span>
                </div>
                {networkFeeUsd > 0 && (
                  <div className="flex items-center justify-between pt-3 border-t border-sprout-border">
                    <span className="text-sprout-text-muted text-sm">Network fee</span>
                    <span className="text-sm font-semibold text-sprout-text-secondary">
                      ~{formatCurrency(networkFeeUsd)}
                    </span>
                  </div>
                )}
              </Card>
            ) : null}
          </>
        )}

        {/* Swap method disclaimer */}
        {withdrawMethod === "swap" && (
          <div className="bg-amber-50 rounded-2xl px-4 py-3 text-sm text-amber-800 leading-relaxed">
            This vault uses market swap for withdrawals. You may receive slightly less due to market conditions.
          </div>
        )}

      </div>

      {/* CTA */}
      <div className="px-5 pb-8 pt-2 bg-sprout-gradient">
        <Button
          className="w-full"
          variant="danger-text"
          disabled={!validAmount || !quote || status === "confirming" || status === "quoting"}
          loading={status === "confirming"}
          onClick={() => void handleConfirm()}
        >
          {status === "confirming" ? "Confirming…" : "Confirm Withdrawal"}
        </Button>
        <p className="text-center text-[11px] text-sprout-text-muted mt-4">Powered by LI.FI</p>
      </div>

      <TransactionModal
        status={modalStatus}
        txHash={txHash}
        chainId={chainId}
        errorMessage={errorMessage}
        onClose={() => router.replace("/home")}
        onRetry={() => setStatus("idle")}
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
