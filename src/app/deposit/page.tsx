"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ArrowLeft } from "lucide-react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TokenSelector, type TokenSelection } from "@/components/deposit/TokenSelector";
import { TOKEN_ADDRESSES, TOKEN_DECIMALS } from "@/lib/constants";
import { useBalances } from "@/lib/hooks/useBalances";
import { AmountInput } from "@/components/deposit/AmountInput";
import { DepositPreview } from "@/components/deposit/DepositPreview";
import { usePreferences } from "@/lib/hooks/usePreferences";
import { getDepositQuote } from "@/lib/api/composer";
import { fetchVaults } from "@/lib/api/earn";
import { toTokenUnits } from "@/lib/format";
import { SUPPORTED_TOKENS, CHAIN_NAMES } from "@/lib/constants";
import type { ComposerQuote, Vault } from "@/lib/types";

type DepositStatus = "idle" | "quoting" | "confirming" | "success" | "error";

function isValidToken(symbol: string): boolean {
  return SUPPORTED_TOKENS.some((t) => t.symbol === symbol);
}

function getDefaultChainForToken(symbol: string, preferredChainId: number): number {
  const chains = Object.keys(TOKEN_ADDRESSES[symbol] ?? {}).map(Number);
  if (chains.includes(preferredChainId)) return preferredChainId;
  return chains[0] ?? preferredChainId;
}

function DepositPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const { preferences } = usePreferences();

  const urlToken = searchParams.get("token");
  const urlVault = searchParams.get("vault");
  const urlChainId = searchParams.get("chainId");

  const initialSymbol =
    urlToken && isValidToken(urlToken)
      ? urlToken
      : preferences.preferredTokens[0] ?? "USDC";

  const [tokenSelection, setTokenSelection] = useState<TokenSelection>({
    symbol: initialSymbol,
    chainId: getDefaultChainForToken(initialSymbol, 8453),
  });
  const [amount, setAmount] = useState<string>("");
  const [vault, setVault] = useState<Vault | null>(null);
  const [quote, setQuote] = useState<ComposerQuote | null>(null);
  const [status, setStatus] = useState<DepositStatus>("idle");
  const [txHash, setTxHash] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [quoteError, setQuoteError] = useState<string>("");

  const walletAddress = user?.wallet?.address ?? "";

  // Real wallet balances across all chains
  const { balances: walletBalances, loading: balancesLoading } = useBalances(
    walletAddress || undefined,
  );

  // Find balance for the currently selected token+chain
  const selectedTokenBalance =
    walletBalances.find(
      (b) => b.symbol === tokenSelection.symbol && b.chainId === tokenSelection.chainId,
    )?.balanceFormatted ?? 0;

  // Resolve vault: pro mode uses URL params, lite mode auto-fetches highest TVL
  useEffect(() => {
    if (preferences.mode === "pro" && urlVault && urlChainId) {
      fetchVaults({ chainId: Number(urlChainId), asset: tokenSelection.symbol, sortBy: "tvl", limit: 10 })
        .then((res) => {
          const found = res.data.find(
            (v) => v.address.toLowerCase() === urlVault.toLowerCase()
          );
          setVault(found ?? res.data[0] ?? null);
        })
        .catch(() => setVault(null));
    } else {
      fetchVaults({ asset: tokenSelection.symbol, sortBy: "tvl", limit: 1 })
        .then((res) => setVault(res.data[0] ?? null))
        .catch(() => setVault(null));
    }
  }, [tokenSelection.symbol, preferences.mode, urlVault, urlChainId]);

  // When vault resolves, default fromChain to vault's chain if token is available there
  useEffect(() => {
    if (!vault) return;
    setTokenSelection((prev) => ({
      ...prev,
      chainId: getDefaultChainForToken(prev.symbol, vault.chainId),
    }));
  }, [vault]);

  // Fetch quote whenever amount, vault, or token selection changes
  const fetchQuote = useCallback(async () => {
    const numericAmount = parseFloat(amount);
    if (!vault || !walletAddress || isNaN(numericAmount) || numericAmount <= 0) {
      setQuote(null);
      setQuoteError("");
      return;
    }

    const decimals = TOKEN_DECIMALS[tokenSelection.symbol] ?? 18;
    const fromAmount = toTokenUnits(numericAmount, decimals);
    const fromTokenAddress = TOKEN_ADDRESSES[tokenSelection.symbol]?.[tokenSelection.chainId];

    if (!fromTokenAddress) {
      setQuoteError(`${tokenSelection.symbol} not available on ${CHAIN_NAMES[tokenSelection.chainId] ?? tokenSelection.chainId}`);
      setQuote(null);
      return;
    }

    setStatus("quoting");
    setQuoteError("");

    try {
      const result = await getDepositQuote({
        fromChain: tokenSelection.chainId,
        toChain: vault.chainId,
        fromToken: fromTokenAddress,
        toToken: vault.address,
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
  }, [amount, vault, walletAddress, tokenSelection]);

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

      // Switch wallet to the correct chain if needed
      await wallet.switchChain(transactionRequest.chainId);

      // Get the provider and send transaction
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

  const numericAmount = parseFloat(amount);
  const validAmount = !isNaN(numericAmount) && numericAmount > 0;
  const apy = vault?.analytics.apy.total ?? 0;
  const networkFeeUsd = quote
    ? parseFloat(quote.estimate.gasCosts[0]?.amountUSD ?? "0")
    : 0;
  const isCrossChain = vault !== null && tokenSelection.chainId !== vault.chainId;

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
        <h1 className="font-heading text-xl font-bold text-sprout-text-primary">Start Earning</h1>
      </div>

      <div className="flex flex-col gap-5 px-5 pb-10 flex-1 overflow-y-auto">
        {/* Token selector */}
        <Card>
          <p className="text-xs font-semibold text-sprout-text-secondary uppercase tracking-wide mb-3">
            Select Token
          </p>
          <TokenSelector
            selected={tokenSelection}
            vaultChainId={vault?.chainId ?? 8453}
            onChange={setTokenSelection}
            walletAddress={walletAddress || undefined}
          />
        </Card>

        {/* Cross-chain route indicator */}
        {isCrossChain && vault && (
          <div className="flex items-center gap-2 px-1">
            <div className="h-px flex-1 bg-sprout-border" />
            <span className="text-xs text-sprout-text-muted whitespace-nowrap">
              {CHAIN_NAMES[tokenSelection.chainId] ?? tokenSelection.chainId}
              {" → "}
              {CHAIN_NAMES[vault.chainId] ?? vault.chainId}
            </span>
            <div className="h-px flex-1 bg-sprout-border" />
          </div>
        )}

        {/* Amount input */}
        <Card>
          <p className="text-xs font-semibold text-sprout-text-secondary uppercase tracking-wide mb-3">
            Amount
          </p>
          <AmountInput
            value={amount}
            onChange={setAmount}
            balance={selectedTokenBalance}
            symbol={tokenSelection.symbol}
            balanceLoading={balancesLoading}
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
          <Card shadow="subtle" className="!p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-sprout-text-secondary font-medium">{vault.protocol.name}</span>
              <span className="text-sprout-text-secondary font-medium">{CHAIN_NAMES[vault.chainId] ?? `Chain ${vault.chainId}`}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-sprout-green-dark font-semibold">{vault.analytics.apy.total.toFixed(1)}% yearly</span>
              <span className="text-sprout-text-muted">{vault.underlyingTokens[0]?.symbol} vault</span>
            </div>
          </Card>
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
          {status === "confirming" ? "Confirming…" : "Confirm"}
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
