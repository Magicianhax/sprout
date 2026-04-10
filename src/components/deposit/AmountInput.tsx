"use client";

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  balance: number;
  symbol: string;
}

export function AmountInput({ value, onChange, balance, symbol }: AmountInputProps) {
  function handleMax() {
    onChange(balance > 0 ? balance.toString() : "");
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // Allow only valid positive numeric input
    if (raw === "" || /^\d*\.?\d*$/.test(raw)) {
      onChange(raw);
    }
  }

  const formattedBalance = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(balance);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center w-full">
        <span className="absolute left-4 text-3xl font-bold text-sprout-text-secondary select-none">
          $
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          placeholder="0.00"
          className="w-full text-center text-4xl font-bold text-sprout-text-primary bg-transparent outline-none placeholder:text-sprout-text-muted py-3"
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-sprout-text-secondary">
          Balance: ${formattedBalance} {symbol}
        </span>
        <button
          onClick={handleMax}
          className="text-xs font-bold text-sprout-green-dark bg-sprout-green-light px-2 py-0.5 rounded-full cursor-pointer"
        >
          MAX
        </button>
      </div>
    </div>
  );
}
