"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { ArrowLeft } from "lucide-react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TokenSelector } from "@/components/deposit/TokenSelector";
import { AmountInput } from "@/components/deposit/AmountInput";
import { DepositPreview } from "@/components/deposit/DepositPreview";
import { usePreferences } from "@/lib/hooks/usePreferences";
import { getDepositQuote } from "@/lib/api/composer";
import { fetchVaults } from "@/lib/api/earn";
import { toTokenUnits } from "@/lib/format";
import { SUPPORTED_TOKENS } from "@/lib/constants";
import type { ComposerQuote, Vault } from "@/lib/types";

type DepositStatus = "idle" | "quoting" | "confirming" | "success" | "error";

const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  ETH: 18,
  WBTC: 8,
  DAI: 18,
};

const MOCK_WALLET_BALANCE: Record<string, number> = {
  USDC: 1200,
  USDT: 800,
  ETH: 0.5,
  WBTC: 0.01,
  DAI: 500,
};

function isValidToken(symbol: string): boolean {
  return SUPPORTED_TOKENS.some((t) => t.symbol === symbol);
}

function DepositPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, sendTransaction } = usePrivy();
  const { preferences } = usePreferences();

  const urlToken = searchParams.get("token");
  const urlVault = searchParams.get("vault");
  const urlChainId = searchParams.get("chainId");

  const initialToken =
    urlToken && isValidToken(urlToken)
      ? urlToken
      : preferences.preferredTokens[0] ?? "USDC";

  const [selectedToken, setSelectedToken] = useState<string>(initialToken);
  const [amount, setAmount] = useState<string>("");
  const [vault, setVault] = useState<Vault | null>(null);
  const [quote, setQuote] = useState<ComposerQuote | null>(null);
  const [status, setStatus] = useState<DepositStatus>("idle");
  const [txHash, setTxHash] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [quoteError, setQuoteError] = useState<string>("");

  const walletAddress = user?.wallet?.address ?? "";

  // Resolve vault: pro mode uses URL params, lite mode auto-fetches highest TVL
  useEffect(() => {
    if (preferences.mode === "pro" && urlVault && urlChainId) {
      // In pro mode the vault was passed via URL — we still need to fetch to get full vault data
      fetchVaults({ chainId: Number(urlChainId), asset: selectedToken, sortBy: "tvl", limit: 10 })
        .then((res) => {
          const found = res.data.find(
            (v) => v.address.toLowerCase() === urlVault.toLowerCase()
          );
          setVault(found ?? res.data[0] ?? null);
        })
        .catch(() => setVault(null));
    } else {
      // Lite mode: pick highest-TVL vault for the selected token
      fetchVaults({ asset: selectedToken, sortBy: "tvl", limit: 1 })
        .then((res) => setVault(res.data[0] ?? null))
        .catch(() => setVault(null));
    }
  }, [selectedToken, preferences.mode, urlVault, urlChainId]);

  // Fetch quote whenever amount or vault changes
  const fetchQuote = useCallback(async () => {
    const numericAmount = parseFloat(amount);
    if (!vault || !walletAddress || isNaN(numericAmount) || numericAmount <= 0) {
      setQuote(null);
      setQuoteError("");
      return;
    }

    const decimals = TOKEN_DECIMALS[selectedToken] ?? 18;
    const fromAmount = toTokenUnits(numericAmount, decimals);

    setStatus("quoting");
    setQuoteError("");

    try {
      const result = await getDepositQuote({
        fromChain: vault.chainId,
        toChain: vault.chainId,
        fromToken: selectedToken,
        toToken: vault.underlyingTokens[0]?.address ?? selectedToken,
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
  }, [amount, vault, walletAddress, selectedToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchQuote();
    }, 600);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  async function handleConfirm() {
    if (!quote || !walletAddress) return;

    setStatus("confirming");
    setErrorMessage("");

    try {
      const { transactionRequest } = quote;
      const result = await sendTransaction({
        to: transactionRequest.to,
        data: transactionRequest.data,
        value: transactionRequest.value,
        chainId: transactionRequest.chainId,
        gasLimit: transactionRequest.gasLimit,
      });
      setTxHash(result.hash);
      setStatus("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      setErrorMessage(message);
      setStatus("error");
    }
  }

  const numericAmount = parseFloat(amount);
  const validAmount = !isNaN(numericAmount) && numericAmount > 0;
  const apy = vault?.analytics.apy.total ?? 0;
  const networkFeeUsd = quote
    ? parseFloat(quote.estimate.gasCosts[0]?.amountUSD ?? "0")
    : 0;
  const walletBalance = MOCK_WALLET_BALANCE[selectedToken] ?? 0;

  if (status === "success") {
    return (
      <main className="flex flex-col items-center justify-center min-h-dvh px-5 bg-sprout-gradient">
        <div className="w-20 h-20 rounded-full bg-sprout-green-light flex items-center justify-center mb-6">
          <span className="text-4xl">🌱</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-sprout-green-dark mb-2">
          Deposit Confirmed!
        </h1>
        <p className="text-sm text-sprout-text-secondary text-center mb-6">
          Your funds are now earning. It may take a moment to reflect.
        </p>
        {txHash && (
          <p className="text-xs text-sprout-text-muted font-mono break-all text-center mb-6 max-w-xs">
            Tx: {txHash}
          </p>
        )}
        <Button className="w-full max-w-xs" onClick={() => router.replace("/home")}>
          Back to Home
        </Button>
        <p className="mt-8 text-[11px] text-sprout-text-muted">Powered by LI.FI</p>
      </main>
    );
  }

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
        <h1 className="font-heading text-xl font-bold text-sprout-text-primary">Deposit</h1>
      </div>

      <div className="flex flex-col gap-5 px-5 pb-10 flex-1 overflow-y-auto">
        {/* Token selector */}
        <Card>
          <p className="text-xs font-semibold text-sprout-text-secondary uppercase tracking-wide mb-3">
            Select Token
          </p>
          <TokenSelector selected={selectedToken} onChange={setSelectedToken} />
        </Card>

        {/* Amount input */}
        <Card>
          <p className="text-xs font-semibold text-sprout-text-secondary uppercase tracking-wide mb-3">
            Amount
          </p>
          <AmountInput
            value={amount}
            onChange={setAmount}
            balance={walletBalance}
            symbol={selectedToken}
          />
        </Card>

        {/* Preview — only shown when amount is valid */}
        {validAmount && vault && (
          <>
            {status === "quoting" ? (
              <div className="text-center py-4 text-sm text-sprout-text-muted animate-pulse">
                Fetching best rate…
              </div>
            ) : quoteError ? (
              <div className="bg-red-50 rounded-2xl px-4 py-3 text-sm text-red-600">
                {quoteError}
              </div>
            ) : (
              <DepositPreview
                amount={numericAmount}
                apyPercent={apy}
                networkFeeUsd={networkFeeUsd}
              />
            )}
          </>
        )}

        {/* Vault info strip */}
        {vault && (
          <div className="flex items-center justify-between text-xs text-sprout-text-muted px-1">
            <span>{vault.protocol.name}</span>
            <span>
              {vault.chainId === 1
                ? "Ethereum"
                : vault.chainId === 8453
                ? "Base"
                : vault.chainId === 42161
                ? "Arbitrum"
                : vault.chainId === 10
                ? "Optimism"
                : vault.chainId === 137
                ? "Polygon"
                : `Chain ${vault.chainId}`}
            </span>
          </div>
        )}

        {/* Error state */}
        {status === "error" && errorMessage && (
          <div className="bg-red-50 rounded-2xl px-4 py-3 text-sm text-red-600">
            {errorMessage}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-5 pb-8 pt-2 bg-sprout-gradient">
        <Button
          className="w-full"
          disabled={!validAmount || !vault || !quote || status === "confirming" || status === "quoting"}
          loading={status === "confirming"}
          onClick={() => void handleConfirm()}
        >
          {status === "confirming" ? "Confirming…" : "Confirm Deposit"}
        </Button>
        <p className="text-center text-[11px] text-sprout-text-muted mt-4">Powered by LI.FI</p>
      </div>
    </main>
  );
}

export default function DepositPage() {
  return (
    <AuthGuard>
      <DepositPageContent />
    </AuthGuard>
  );
}
