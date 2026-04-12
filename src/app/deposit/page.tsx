"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ArrowLeft } from "lucide-react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TokenSelector, type TokenSelection } from "@/components/deposit/TokenSelector";
import { TransactionModal } from "@/components/deposit/TransactionModal";
import { QUOTE_DEBOUNCE_MS, TOKEN_ADDRESSES, TOKEN_DECIMALS } from "@/lib/constants";
import { useBalances } from "@/lib/hooks/useBalances";
import { invalidatePositions } from "@/lib/hooks/usePositions";
import { invalidateActivity } from "@/lib/hooks/useActivity";
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
    if (urlVault && urlChainId) {
      // Specific vault requested — search by chainId only, find by address
      fetchVaults({ chainId: Number(urlChainId), sortBy: "tvl", limit: 100 })
        .then((res) => {
          const found = res.data.find(
            (v) => v.address.toLowerCase() === urlVault.toLowerCase()
          );
          setVault(found ?? null);
        })
        .catch(() => setVault(null));
    } else {
      // Lite mode: pick highest-TVL vault for the selected token on the same chain first
      fetchVaults({ chainId: tokenSelection.chainId, asset: tokenSelection.symbol, sortBy: "tvl", limit: 1 })
        .then((res) => {
          if (res.data.length > 0) {
            setVault(res.data[0]);
          } else {
            // No vault on this chain — try any chain
            return fetchVaults({ asset: tokenSelection.symbol, sortBy: "tvl", limit: 1 })
              .then((res2) => setVault(res2.data[0] ?? null));
          }
        })
        .catch(() => setVault(null));
    }
  }, [tokenSelection.symbol, tokenSelection.chainId, urlVault, urlChainId]);

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
    // Skip quote if the user is asking for more than they have. Shows
    // the inline error instead of burning an API call that will later
    // fail on-chain anyway.
    if (!balancesLoading && numericAmount > selectedTokenBalance) {
      setQuote(null);
      setQuoteError("");
      setStatus("idle");
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
  }, [amount, vault, walletAddress, tokenSelection, balancesLoading, selectedTokenBalance]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchQuote();
    }, QUOTE_DEBOUNCE_MS);
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

      // Switch wallet to the source chain (fromChain) for the quote
      await wallet.switchChain(tokenSelection.chainId);

      // Get the provider and send transaction — use wallet.address to ensure
      // the `from` matches exactly what Privy expects
      const provider = await wallet.getEthereumProvider();
      const txHash = await provider.request({
        method: "eth_sendTransaction",
        params: [{
          from: wallet.address,
          to: transactionRequest.to,
          data: transactionRequest.data,
          value: transactionRequest.value && transactionRequest.value !== "0"
            ? `0x${BigInt(transactionRequest.value).toString(16)}`
            : undefined,
        }],
      });

      setTxHash(txHash as string);
      setStatus("success");

      // Kick the shared caches so positions + LI.FI analytics reflect
      // the new deposit without the user needing to reload.
      const walletAddress = wallet.address;
      if (walletAddress) {
        invalidatePositions(walletAddress).catch(() => {});
        invalidateActivity(walletAddress).catch(() => {});
        for (const ms of [4000, 12000, 30000]) {
          setTimeout(() => {
            invalidatePositions(walletAddress).catch(() => {});
            invalidateActivity(walletAddress).catch(() => {});
          }, ms);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      setErrorMessage(message);
      setStatus("error");
    }
  }

  const numericAmount = parseFloat(amount);
  const validAmount = !isNaN(numericAmount) && numericAmount > 0;
  // Only treat as "too much" once we actually know the balance (avoids
  // flashing an error during the initial load before useBalances lands).
  const insufficientBalance =
    validAmount && !balancesLoading && numericAmount > selectedTokenBalance;
  const canSubmit =
    validAmount &&
    !insufficientBalance &&
    !!vault &&
    !!quote &&
    status !== "confirming" &&
    status !== "quoting";
  const apy = vault?.analytics.apy.total ?? 0;
  const networkFeeUsd = quote
    ? parseFloat(quote.estimate.gasCosts[0]?.amountUSD ?? "0")
    : 0;
  const isCrossChain = vault !== null && tokenSelection.chainId !== vault.chainId;
  const isLite = preferences.mode === "lite";

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
        <h1 className="font-heading text-xl font-bold text-sprout-text-primary">Start Earning</h1>
      </div>

      {isLite ? (
        /* ───── LITE MODE: ultra-simple ───── */
        <>
          <div className="flex flex-col gap-8 px-5 pt-10 pb-10 flex-1">
            <div className="text-center">
              <h2 className="font-heading text-lg font-700 text-sprout-text-primary mb-1">
                How much do you want to earn on?
              </h2>
              <p className="text-sm text-sprout-text-muted">
                {selectedTokenBalance > 0
                  ? `You have ${selectedTokenBalance.toFixed(2)} ${tokenSelection.symbol}`
                  : balancesLoading
                  ? "Checking balance..."
                  : "Enter any amount"}
              </p>
            </div>

            <AmountInput
              value={amount}
              onChange={setAmount}
              balance={selectedTokenBalance}
              symbol={tokenSelection.symbol}
              balanceLoading={balancesLoading}
            />

            {insufficientBalance && (
              <p className="text-center text-xs text-sprout-red-stop font-semibold">
                You only have {selectedTokenBalance.toFixed(4)} {tokenSelection.symbol}
              </p>
            )}
            {!insufficientBalance && status === "quoting" && validAmount && (
              <p className="text-center text-xs text-sprout-text-muted animate-pulse">Finding best rate...</p>
            )}
            {!insufficientBalance && quoteError && (
              <p className="text-center text-xs text-red-500">{quoteError}</p>
            )}
          </div>

          <div className="px-5 pb-8 pt-2 bg-sprout-gradient">
            <Button
              className="w-full"
              disabled={!canSubmit}
              loading={status === "quoting" || status === "confirming"}
              onClick={() => void handleConfirm()}
            >
              {insufficientBalance
                ? "Insufficient balance"
                : status === "quoting"
                ? "Finding best rate..."
                : status === "confirming"
                ? "Confirming..."
                : "Start Earning"}
            </Button>
            <p className="text-center text-[11px] text-sprout-text-muted mt-4">Powered by LI.FI</p>
          </div>
        </>
      ) : (
        /* ───── PRO MODE: full details ───── */
        <>
          <div className="flex flex-col gap-5 px-5 pb-10 flex-1 overflow-y-auto">
            <Card>
              <p className="text-xs font-semibold text-sprout-text-secondary uppercase tracking-wide mb-3">
                Select Token
              </p>
              <TokenSelector
                selected={tokenSelection}
                vaultChainId={vault?.chainId ?? 8453}
                onChange={setTokenSelection}
                balances={walletBalances}
                balancesLoading={balancesLoading}
              />
            </Card>

            {isCrossChain && vault && (
              <div className="bg-blue-50 rounded-2xl px-4 py-3 text-xs text-blue-700 leading-relaxed">
                <p className="font-semibold mb-0.5">
                  Cross-chain deposit
                </p>
                <p>
                  Your {tokenSelection.symbol} on{" "}
                  <span className="font-semibold">
                    {CHAIN_NAMES[tokenSelection.chainId] ?? tokenSelection.chainId}
                  </span>{" "}
                  will be bridged to{" "}
                  <span className="font-semibold">
                    {CHAIN_NAMES[vault.chainId] ?? vault.chainId}
                  </span>{" "}
                  and deposited into the vault in one transaction via LI.FI.
                  You&apos;ll see a chain switch in your wallet.
                </p>
              </div>
            )}

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
              {selectedTokenBalance > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  {[0.25, 0.5, 0.75, 1].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() =>
                        setAmount(
                          String(
                            // Trim to 6 decimal places to match AmountInput
                            Number((selectedTokenBalance * pct).toFixed(6))
                          )
                        )
                      }
                      className="flex-1 py-1.5 rounded-pill text-[11px] font-bold bg-sprout-green-light text-sprout-green-dark cursor-pointer active:scale-[0.97] transition-transform"
                    >
                      {pct === 1 ? "MAX" : `${pct * 100}%`}
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {insufficientBalance && (
              <div className="bg-red-50 rounded-2xl px-4 py-3 text-sm text-red-600">
                You only have {selectedTokenBalance.toFixed(4)} {tokenSelection.symbol} on{" "}
                {CHAIN_NAMES[tokenSelection.chainId] ?? tokenSelection.chainId}.
              </div>
            )}
            {!insufficientBalance && validAmount && vault && (
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
          </div>

          <div className="px-5 pb-8 pt-2 bg-sprout-gradient">
            <Button
              className="w-full"
              disabled={!canSubmit}
              loading={status === "confirming"}
              onClick={() => void handleConfirm()}
            >
              {insufficientBalance
                ? "Insufficient balance"
                : status === "confirming"
                ? "Confirming…"
                : "Confirm"}
            </Button>
            <p className="text-center text-[11px] text-sprout-text-muted mt-4">Powered by LI.FI</p>
          </div>
        </>
      )}

      <TransactionModal
        status={modalStatus}
        txHash={txHash}
        chainId={vault?.chainId}
        errorMessage={errorMessage}
        onClose={() => router.replace("/home")}
        onRetry={() => setStatus("idle")}
      />
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
