"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";

type TimeRange = "1W" | "1M" | "ALL";

interface EarningsChartProps {
  className?: string;
}

export function EarningsChart({ className = "" }: EarningsChartProps) {
  const [range, setRange] = useState<TimeRange>("1W");

  // Demo chart paths per time range — illustrative for hackathon
  const paths: Record<TimeRange, string> = {
    "1W": "M0,55 Q40,52 80,48 T160,40 T240,32 T300,20",
    "1M": "M0,62 Q30,58 70,50 T140,42 T200,35 T260,28 T300,18",
    "ALL": "M0,70 Q50,65 100,55 T180,40 T240,25 T300,12",
  };

  return (
    <Card shadow="subtle" className={`mx-5 ${className}`}>
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-semibold text-sprout-text-primary">
          Earnings
        </span>
        <div className="flex gap-1">
          {(["1W", "1M", "ALL"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-0.5 rounded-xl text-[11px] font-semibold cursor-pointer transition-colors
                ${range === r
                  ? "bg-sprout-green-light text-sprout-green-dark"
                  : "text-sprout-text-muted"
                }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <svg width="100%" height="80" viewBox="0 0 300 80" className="block">
        <defs>
          <linearGradient id="earnings-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4CAF50" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#4CAF50" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={paths[range]}
          fill="none"
          stroke="#4CAF50"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d={`${paths[range]} L300,80 L0,80 Z`}
          fill="url(#earnings-fill)"
        />
      </svg>
    </Card>
  );
}
