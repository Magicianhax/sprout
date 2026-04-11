"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { CHAIN_NAMES } from "@/lib/constants";

export const TOKEN_ADDRESSES: Record<string, Record<number, string>> = {
  ETH: {
    1: "0x0000000000000000000000000000000000000000",
    8453: "0x0000000000000000000000000000000000000000",
    42161: "0x0000000000000000000000000000000000000000",
    10: "0x0000000000000000000000000000000000000000",
    137: "0x0000000000000000000000000000000000000000",
  },
  USDC: {
    1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  },
  USDT: {
    1: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    8453: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    10: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  },
  DAI: {
    1: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    8453: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    42161: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    10: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    137: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
  },
  WBTC: {
    1: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    42161: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    10: "0x68f180fcCe6836688e9084f035309E29Bf0A2095",
    137: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
  },
};

export const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  ETH: 18,
  WBTC: 8,
  DAI: 18,
};

const TOKENS = Object.keys(TOKEN_ADDRESSES);

export interface TokenSelection {
  symbol: string;
  chainId: number;
}

interface TokenSelectorProps {
  selected: TokenSelection;
  vaultChainId: number;
  onChange: (selection: TokenSelection) => void;
}

export function TokenSelector({ selected, vaultChainId, onChange }: TokenSelectorProps) {
  const [tokenOpen, setTokenOpen] = useState(false);
  const [chainOpen, setChainOpen] = useState(false);

  const availableChains = Object.keys(TOKEN_ADDRESSES[selected.symbol] ?? {}).map(Number);
  const isCrossChain = selected.chainId !== vaultChainId;
  const fromChainName = CHAIN_NAMES[selected.chainId] ?? `Chain ${selected.chainId}`;
  const toChainName = CHAIN_NAMES[vaultChainId] ?? `Chain ${vaultChainId}`;

  function handleTokenSelect(symbol: string) {
    setTokenOpen(false);
    const chains = Object.keys(TOKEN_ADDRESSES[symbol] ?? {}).map(Number);
    // Prefer the vault's own chain if the token exists there, otherwise first available
    const defaultChain = chains.includes(vaultChainId) ? vaultChainId : (chains[0] ?? vaultChainId);
    onChange({ symbol, chainId: defaultChain });
  }

  function handleChainSelect(chainId: number) {
    setChainOpen(false);
    onChange({ ...selected, chainId });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Token + Chain row */}
      <div className="flex items-center gap-3">
        {/* Token icon */}
        <div className="relative flex-shrink-0">
          <TokenIcon type="token" identifier={selected.symbol} size={44} />
          {/* Chain badge */}
          <div className="absolute -bottom-1 -right-1 rounded-full border-2 border-white overflow-hidden" style={{ width: 20, height: 20 }}>
            <TokenIcon type="chain" identifier={selected.chainId} size={20} />
          </div>
        </div>

        {/* Dropdowns */}
        <div className="flex flex-col gap-1.5 flex-1">
          {/* Token dropdown */}
          <div className="relative">
            <button
              onClick={() => { setTokenOpen((o) => !o); setChainOpen(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-button border-[1.5px] border-sprout-border bg-sprout-card w-full cursor-pointer"
            >
              <span className="text-sm font-semibold text-sprout-text-primary flex-1 text-left">
                {selected.symbol}
              </span>
              <ChevronDown size={14} className="text-sprout-text-secondary flex-shrink-0" />
            </button>

            {tokenOpen && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-sprout-border rounded-2xl shadow-lg overflow-hidden min-w-[140px]">
                {TOKENS.map((sym) => (
                  <button
                    key={sym}
                    onClick={() => handleTokenSelect(sym)}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-sprout-green-light transition-colors cursor-pointer
                      ${sym === selected.symbol ? "bg-sprout-green-light text-sprout-green-dark font-semibold" : "text-sprout-text-primary"}`}
                  >
                    <TokenIcon type="token" identifier={sym} size={20} />
                    {sym}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chain dropdown */}
          <div className="relative">
            <button
              onClick={() => { setChainOpen((o) => !o); setTokenOpen(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-button border-[1.5px] border-sprout-border bg-sprout-card w-full cursor-pointer"
            >
              <TokenIcon type="chain" identifier={selected.chainId} size={16} className="rounded-full flex-shrink-0" />
              <span className="text-sm font-medium text-sprout-text-primary flex-1 text-left">
                {fromChainName}
              </span>
              <ChevronDown size={14} className="text-sprout-text-secondary flex-shrink-0" />
            </button>

            {chainOpen && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-sprout-border rounded-2xl shadow-lg overflow-hidden min-w-[160px]">
                {availableChains.map((chainId) => (
                  <button
                    key={chainId}
                    onClick={() => handleChainSelect(chainId)}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-sprout-green-light transition-colors cursor-pointer
                      ${chainId === selected.chainId ? "bg-sprout-green-light text-sprout-green-dark font-semibold" : "text-sprout-text-primary"}`}
                  >
                    <TokenIcon type="chain" identifier={chainId} size={18} className="rounded-full flex-shrink-0" />
                    {CHAIN_NAMES[chainId] ?? `Chain ${chainId}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cross-chain hint */}
      {isCrossChain && (
        <p className="text-xs text-sprout-text-muted bg-sprout-green-light rounded-xl px-3 py-2">
          Will bridge {selected.symbol} from {fromChainName} → {toChainName} automatically
        </p>
      )}
      {!isCrossChain && (
        <p className="text-xs text-sprout-text-secondary">
          Depositing {selected.symbol} on {fromChainName}
        </p>
      )}
    </div>
  );
}
