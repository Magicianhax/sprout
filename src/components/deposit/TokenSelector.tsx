"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { CHAIN_NAMES, TOKEN_ADDRESSES } from "@/lib/constants";
import { useBalances, type TokenBalance } from "@/lib/hooks/useBalances";

// Re-export so existing imports in deposit page keep working
export { TOKEN_ADDRESSES } from "@/lib/constants";
export { TOKEN_DECIMALS } from "@/lib/constants";

export interface TokenSelection {
  symbol: string;
  chainId: number;
}

interface TokenSelectorProps {
  selected: TokenSelection;
  vaultChainId: number;
  onChange: (selection: TokenSelection) => void;
  walletAddress?: string;
}

interface TokenRow {
  symbol: string;
  chainId: number;
  balanceFormatted: number;
  hasBalance: boolean;
}

function buildRows(balances: TokenBalance[]): TokenRow[] {
  const balanceMap = new Map<string, number>();
  for (const b of balances) {
    balanceMap.set(`${b.symbol}-${b.chainId}`, b.balanceFormatted);
  }

  const rows: TokenRow[] = [];
  for (const [symbol, chainMap] of Object.entries(TOKEN_ADDRESSES)) {
    for (const chainId of Object.keys(chainMap).map(Number)) {
      const balanceFormatted = balanceMap.get(`${symbol}-${chainId}`) ?? 0;
      rows.push({ symbol, chainId, balanceFormatted, hasBalance: balanceFormatted > 0 });
    }
  }

  // Sort: tokens with balance first (highest first), then zero-balance
  rows.sort((a, b) => {
    if (a.hasBalance !== b.hasBalance) return a.hasBalance ? -1 : 1;
    return b.balanceFormatted - a.balanceFormatted;
  });

  return rows;
}

function formatBalance(n: number): string {
  if (n === 0) return "0.00";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

export function TokenSelector({
  selected,
  vaultChainId,
  onChange,
  walletAddress,
}: TokenSelectorProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { balances, loading } = useBalances(walletAddress);

  const rows = buildRows(balances);
  const isCrossChain = selected.chainId !== vaultChainId;
  const fromChainName = CHAIN_NAMES[selected.chainId] ?? `Chain ${selected.chainId}`;
  const toChainName = CHAIN_NAMES[vaultChainId] ?? `Chain ${vaultChainId}`;

  // Find balance for currently selected token+chain
  const selectedBalance =
    balances.find((b) => b.symbol === selected.symbol && b.chainId === selected.chainId)
      ?.balanceFormatted ?? 0;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleSelect(row: TokenRow) {
    setOpen(false);
    onChange({ symbol: row.symbol, chainId: row.chainId });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Trigger button */}
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-button border-[1.5px] border-sprout-border bg-sprout-card cursor-pointer"
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          {/* Token icon with chain badge */}
          <div className="relative flex-shrink-0">
            <TokenIcon type="token" identifier={selected.symbol} size={36} />
            <div
              className="absolute -bottom-1 -right-1 rounded-full border-2 border-white overflow-hidden"
              style={{ width: 18, height: 18 }}
            >
              <TokenIcon type="chain" identifier={selected.chainId} size={18} />
            </div>
          </div>

          {/* Label */}
          <div className="flex flex-col items-start flex-1 min-w-0">
            <span className="text-sm font-semibold text-sprout-text-primary leading-tight">
              {selected.symbol} on {fromChainName}
            </span>
            {selectedBalance > 0 && (
              <span className="text-xs text-sprout-text-secondary leading-tight">
                {formatBalance(selectedBalance)} {selected.symbol}
              </span>
            )}
            {selectedBalance === 0 && loading && (
              <span className="text-xs text-sprout-text-muted leading-tight animate-pulse">
                Loading balance…
              </span>
            )}
          </div>

          <ChevronDown
            size={16}
            className={`text-sprout-text-secondary flex-shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {/* Dropdown list */}
        {open && (
          <div
            role="listbox"
            className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-sprout-border rounded-2xl shadow-lg overflow-hidden max-h-72 overflow-y-auto"
          >
            {rows.map((row) => {
              const isSelected = row.symbol === selected.symbol && row.chainId === selected.chainId;
              const chainName = CHAIN_NAMES[row.chainId] ?? `Chain ${row.chainId}`;

              return (
                <button
                  key={`${row.symbol}-${row.chainId}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(row)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors cursor-pointer
                    ${isSelected ? "bg-sprout-green-light" : "hover:bg-sprout-green-light/50"}
                    ${!row.hasBalance ? "opacity-50" : ""}`}
                >
                  {/* Token icon with chain badge */}
                  <div className="relative flex-shrink-0">
                    <TokenIcon type="token" identifier={row.symbol} size={32} />
                    <div
                      className="absolute -bottom-1 -right-1 rounded-full border-2 border-white overflow-hidden"
                      style={{ width: 16, height: 16 }}
                    >
                      <TokenIcon type="chain" identifier={row.chainId} size={16} />
                    </div>
                  </div>

                  {/* Symbol + chain */}
                  <div className="flex flex-col flex-1 min-w-0">
                    <span
                      className={`text-sm font-semibold leading-tight ${isSelected ? "text-sprout-green-dark" : "text-sprout-text-primary"}`}
                    >
                      {row.symbol}
                    </span>
                    <span className="text-xs text-sprout-text-secondary leading-tight truncate">
                      {chainName}
                    </span>
                  </div>

                  {/* Balance */}
                  <span
                    className={`text-sm font-medium flex-shrink-0 ${row.hasBalance ? "text-sprout-text-primary" : "text-sprout-text-muted"}`}
                  >
                    {formatBalance(row.balanceFormatted)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Cross-chain hint */}
      {isCrossChain ? (
        <p className="text-xs text-sprout-text-muted bg-sprout-green-light rounded-xl px-3 py-2">
          Will bridge {selected.symbol} from {fromChainName} → {toChainName} automatically
        </p>
      ) : (
        <p className="text-xs text-sprout-text-secondary">
          Depositing {selected.symbol} on {fromChainName}
        </p>
      )}
    </div>
  );
}
