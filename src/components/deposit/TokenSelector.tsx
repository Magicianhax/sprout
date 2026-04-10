"use client";

import { TokenIcon } from "@/components/ui/TokenIcon";
import { SUPPORTED_TOKENS } from "@/lib/constants";

interface TokenSelectorProps {
  selected: string;
  onChange: (symbol: string) => void;
}

export function TokenSelector({ selected, onChange }: TokenSelectorProps) {
  return (
    <div className="flex flex-row gap-2 flex-wrap">
      {SUPPORTED_TOKENS.map((token) => {
        const isSelected = token.symbol === selected;
        return (
          <button
            key={token.symbol}
            onClick={() => onChange(token.symbol)}
            className={`flex items-center gap-2 px-3 py-2 rounded-button border-[1.5px] transition-all duration-150 cursor-pointer
              ${
                isSelected
                  ? "border-sprout-green-primary bg-sprout-green-light"
                  : "border-sprout-border bg-sprout-card"
              }`}
          >
            <TokenIcon type="token" identifier={token.symbol} size={24} />
            <span
              className={`text-sm font-semibold ${
                isSelected ? "text-sprout-green-dark" : "text-sprout-text-primary"
              }`}
            >
              {token.symbol}
            </span>
          </button>
        );
      })}
    </div>
  );
}
