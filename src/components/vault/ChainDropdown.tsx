"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { SUPPORTED_CHAIN_IDS, CHAIN_NAMES } from "@/lib/constants";

interface ChainDropdownProps {
  selected: number[];
  onChange: (chainIds: number[]) => void;
}

export function ChainDropdown({ selected, onChange }: ChainDropdownProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number[]>(selected);
  const ref = useRef<HTMLDivElement>(null);

  // Sync draft when external selection changes
  useEffect(() => {
    setDraft(selected);
  }, [selected]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setDraft(selected);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, selected]);

  function toggleChain(chainId: number) {
    setDraft((prev) =>
      prev.includes(chainId)
        ? prev.filter((id) => id !== chainId)
        : [...prev, chainId]
    );
  }

  function handleApply() {
    onChange(draft);
    setOpen(false);
  }

  const triggerLabel =
    draft.length === 0 || draft.length === SUPPORTED_CHAIN_IDS.length
      ? "All Chains"
      : `${draft.length} chain${draft.length > 1 ? "s" : ""}`;

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-sprout-border rounded-pill text-sm font-semibold text-sprout-text-primary shadow-subtle cursor-pointer"
      >
        <span>{triggerLabel}</span>
        <ChevronDown
          size={14}
          className={`text-sprout-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown panel — anchors to the trigger's right edge and
          opens leftward so it never overflows the viewport on narrow
          screens where ChainDropdown is typically the rightmost
          filter in the row. */}
      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white border border-sprout-border rounded-2xl shadow-card p-3 min-w-[200px] z-50">
          <div className="flex flex-col gap-1 mb-3">
            {SUPPORTED_CHAIN_IDS.map((chainId) => {
              const checked = draft.includes(chainId);
              return (
                <label
                  key={chainId}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-sprout-green-light cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleChain(chainId)}
                    className="accent-sprout-green-primary w-4 h-4 cursor-pointer"
                  />
                  <TokenIcon type="chain" identifier={chainId} size={20} />
                  <span className="text-sm text-sprout-text-primary">
                    {CHAIN_NAMES[chainId]}
                  </span>
                </label>
              );
            })}
          </div>

          <button
            onClick={handleApply}
            className="w-full bg-sprout-green-primary text-white rounded-button py-2 text-sm font-bold cursor-pointer"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
