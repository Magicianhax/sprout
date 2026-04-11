"use client";

import { useRouter } from "next/navigation";

const EXPLORER_TX_URLS: Record<number, string> = {
  1: "https://etherscan.io/tx/",
  8453: "https://basescan.org/tx/",
  42161: "https://arbiscan.io/tx/",
  10: "https://optimistic.etherscan.io/tx/",
  137: "https://polygonscan.com/tx/",
};

function truncateTxHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export interface TransactionModalProps {
  status: "confirming" | "success" | "error" | null;
  txHash?: string;
  chainId?: number;
  errorMessage?: string;
  onClose: () => void;
  onRetry: () => void;
}

export function TransactionModal({
  status,
  txHash,
  chainId,
  errorMessage,
  onClose,
  onRetry,
}: TransactionModalProps) {
  if (!status) return null;

  const explorerBase = chainId ? (EXPLORER_TX_URLS[chainId] ?? null) : null;
  const explorerUrl = explorerBase && txHash ? `${explorerBase}${txHash}` : null;

  return (
    <>
      <style>{`
        @keyframes sprout-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
        @keyframes check-bounce-in {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.22); opacity: 1; }
          80% { transform: scale(0.92); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes dot-pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes backdrop-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modal-slide-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sprout-breathe {
          animation: sprout-breathe 2s ease-in-out infinite;
          display: inline-block;
        }
        .check-bounce-in {
          animation: check-bounce-in 0.45s cubic-bezier(0.22, 0.61, 0.36, 1) both;
        }
        .dot-1 { animation: dot-pulse 1.4s ease-in-out infinite; animation-delay: 0s; }
        .dot-2 { animation: dot-pulse 1.4s ease-in-out infinite; animation-delay: 0.22s; }
        .dot-3 { animation: dot-pulse 1.4s ease-in-out infinite; animation-delay: 0.44s; }
        .backdrop-fade-in {
          animation: backdrop-fade-in 0.25s ease-out both;
        }
        .modal-slide-up {
          animation: modal-slide-up 0.32s ease-out both;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-5 bg-black/40 backdrop-blur-sm backdrop-fade-in"
        aria-modal="true"
        role="dialog"
      >
        {/* Modal card */}
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[340px] px-7 py-9 flex flex-col items-center text-center modal-slide-up">

          {/* ── CONFIRMING ─────────────────────────────────── */}
          {status === "confirming" && (
            <>
              {/* Sprout icon — breathing animation */}
              <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-6">
                <span className="text-4xl sprout-breathe" aria-hidden="true">🌱</span>
              </div>

              <h2 className="font-heading text-xl font-bold text-gray-800 mb-2">
                Confirming your deposit…
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Please approve in your wallet
              </p>

              {/* Animated dots */}
              <div className="flex items-center gap-2" aria-label="Loading">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 dot-1" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 dot-2" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 dot-3" />
              </div>
            </>
          )}

          {/* ── SUCCESS ────────────────────────────────────── */}
          {status === "success" && (
            <>
              {/* Bounce-in check */}
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
                <svg
                  className="w-10 h-10 text-green-600 check-bounce-in"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <h2 className="font-heading text-xl font-bold text-gray-800 mb-1">
                Your money is growing! 🌱
              </h2>

              {explorerUrl && txHash && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-700 font-medium underline underline-offset-2 mt-3 mb-1 inline-flex items-center gap-1 hover:text-green-900 transition-colors"
                >
                  View on explorer&nbsp;↗
                  <span className="font-mono text-xs text-gray-400 ml-1">
                    ({truncateTxHash(txHash)})
                  </span>
                </a>
              )}

              <button
                onClick={onClose}
                className="mt-6 w-full rounded-button px-6 py-4 text-base font-bold bg-gradient-to-br from-sprout-green-primary to-[#66BB6A] text-white shadow-glow transition-all duration-150 active:scale-[0.97] cursor-pointer"
              >
                Back to Home
              </button>

              <p className="mt-5 text-[11px] text-gray-400">Powered by LI.FI</p>
            </>
          )}

          {/* ── ERROR ──────────────────────────────────────── */}
          {status === "error" && (
            <>
              {/* Red X icon */}
              <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-6">
                <svg
                  className="w-10 h-10 text-red-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>

              <h2 className="font-heading text-xl font-bold text-gray-800 mb-2">
                Something went wrong
              </h2>

              {errorMessage && (
                <p className="text-sm text-red-500 mb-2 leading-relaxed max-w-[260px]">
                  {errorMessage}
                </p>
              )}

              <button
                onClick={onRetry}
                className="mt-5 w-full rounded-button px-6 py-4 text-base font-bold bg-gradient-to-br from-sprout-green-primary to-[#66BB6A] text-white shadow-glow transition-all duration-150 active:scale-[0.97] cursor-pointer"
              >
                Try Again
              </button>
            </>
          )}

        </div>
      </div>
    </>
  );
}
