"use client";

import { useState } from "react";

type TimeRange = "1W" | "1M" | "ALL";

const RANGES: TimeRange[] = ["1W", "1M", "ALL"];

// Static SVG paths for each time range — upward growth curves
const PATHS: Record<TimeRange, string> = {
  "1W": "M0,80 C20,75 40,68 60,60 C80,52 100,50 120,44 C140,38 160,32 180,25 C200,18 220,14 240,10",
  "1M": "M0,85 C30,78 60,70 90,58 C120,46 150,38 180,28 C210,18 230,12 240,8",
  "ALL": "M0,90 C40,82 80,72 110,58 C140,44 160,34 180,22 C200,12 220,6 240,4",
};

interface EarningsChartProps {
  className?: string;
}

export function EarningsChart({ className = "" }: EarningsChartProps) {
  const [range, setRange] = useState<TimeRange>("1M");
  const path = PATHS[range];

  return (
    <div className={`mx-5 ${className}`}>
      {/* Time range toggles */}
      <div className="flex gap-1 mb-3">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1 rounded-pill text-xs font-semibold transition-all cursor-pointer
              ${range === r
                ? "bg-sprout-green-primary text-white"
                : "bg-sprout-green-light text-sprout-green-dark"
              }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* SVG chart */}
      <div className="relative h-24 w-full overflow-hidden rounded-2xl">
        <svg
          viewBox="0 0 240 100"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4CAF50" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#4CAF50" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* Fill area */}
          <path
            d={`${path} L240,100 L0,100 Z`}
            fill="url(#chartGradient)"
          />
          {/* Line */}
          <path
            d={path}
            fill="none"
            stroke="#4CAF50"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
