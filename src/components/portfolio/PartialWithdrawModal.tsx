"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { Button } from "@/components/ui/Button";
import { CHAIN_NAMES } from "@/lib/constants";
import { displayProtocol } from "@/lib/protocols";
import type { Position } from "@/lib/types";

interface PartialWithdrawModalProps {
  open: boolean;
  position: Position | null;
  onClose: () => void;
  onConfirm: (position: Position, amount: number) => void;
}

export function PartialWithdrawModal({
  open,
  position,
  onClose,
  onConfirm,
}: PartialWithdrawModalProps) {
  const [amount, setAmount] = useState("");

  const maxAmount = useMemo(() => {
    if (!position) return 0;
    const n = parseFloat(position.balanceNative);
    return Number.isFinite(n) ? n : 0;
  }, [position]);

  useEffect(() => {
    if (open && position) {
      setAmount(String(maxAmount));
    }
    if (!open) {
      setAmount("");
    }
  }, [open, position, maxAmount]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !position) return null;

  const numericAmount = parseFloat(amount);
  const validAmount =
    !isNaN(numericAmount) && numericAmount > 0 && numericAmount <= maxAmount;
  const chainName = CHAIN_NAMES[position.chainId] ?? `Chain ${position.chainId}`;

  function setPercent(pct: number) {
    const value = Number((maxAmount * pct).toFixed(6));
    setAmount(String(value));
  }

  function handleConfirm() {
    if (!validAmount || !position) return;
    onConfirm(position, numericAmount);
  }

  return (
    <>
      <style>{`
        @keyframes pw-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pw-slide-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pw-backdrop { animation: pw-fade-in 0.22s ease-out both; }
        .pw-card { animation: pw-slide-up 0.28s ease-out both; }
      `}</style>

      <div
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm pw-backdrop"
        aria-modal="true"
        role="dialog"
        onClick={onClose}
      >
        <div
          className="bg-sprout-card rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-[420px] p-6 pb-8 pw-card relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1 rounded-full text-sprout-text-muted hover:text-sprout-text-primary transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3 pt-1 mb-5">
            <div className="relative shrink-0">
              <TokenIcon type="token" identifier={position.asset.symbol} size={42} />
              <div
                className="absolute -bottom-1 -right-1 rounded-full border-2 border-sprout-card overflow-hidden"
                style={{ width: 18, height: 18 }}
              >
                <TokenIcon type="chain" identifier={position.chainId} size={18} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading text-base font-700 text-sprout-text-primary">
                Withdraw {position.asset.symbol}
              </p>
              <p className="text-[11px] text-sprout-text-muted truncate">
                {displayProtocol(position.protocolName)} · {chainName}
              </p>
            </div>
          </div>

          {/* Amount input */}
          <div className="bg-sprout-green-light/40 rounded-2xl px-4 py-3">
            <div className="flex items-baseline justify-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 min-w-0 bg-transparent text-3xl font-heading font-bold text-sprout-text-primary outline-none placeholder:text-sprout-text-muted text-center"
              />
            </div>
            <p className="text-center text-xs text-sprout-text-muted mt-1">
              {position.asset.symbol}
            </p>
          </div>

          <p className="text-center text-[11px] text-sprout-text-muted mt-2">
            Balance: {maxAmount.toFixed(6)} {position.asset.symbol}
          </p>

          {/* Presets */}
          <div className="flex items-center gap-2 mt-4">
            {[0.25, 0.5, 0.75, 1].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setPercent(pct)}
                className="flex-1 py-2 rounded-pill text-[11px] font-bold bg-sprout-green-light text-sprout-green-dark cursor-pointer active:scale-[0.97] transition-transform"
              >
                {pct === 1 ? "MAX" : `${pct * 100}%`}
              </button>
            ))}
          </div>

          {numericAmount > maxAmount && (
            <p className="text-center text-[11px] text-sprout-red-stop font-semibold mt-3">
              Amount exceeds your position balance.
            </p>
          )}

          <Button
            className="w-full mt-5"
            disabled={!validAmount}
            onClick={handleConfirm}
          >
            {numericAmount >= maxAmount * 0.9999 ? "Withdraw all" : "Withdraw"}
          </Button>

          <p className="text-center text-[11px] text-sprout-text-muted mt-3">
            You&apos;ll receive {position.asset.symbol} back to your wallet.
          </p>
        </div>
      </div>
    </>
  );
}
