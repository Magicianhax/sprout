"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { RecentActivity } from "@/components/home/RecentActivity";
import type { Position } from "@/lib/types";

interface ActivityDrawerProps {
  open: boolean;
  onClose: () => void;
  positions: Position[];
}

export function ActivityDrawer({ open, onClose, positions }: ActivityDrawerProps) {
  // Esc to close — matches modal patterns elsewhere
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes drawer-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes drawer-slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .drawer-backdrop { animation: drawer-fade-in 0.22s ease-out both; }
        .drawer-panel { animation: drawer-slide-in 0.3s cubic-bezier(0.22, 0.61, 0.36, 1) both; }
      `}</style>

      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] drawer-backdrop"
        onClick={onClose}
        aria-modal="true"
        role="dialog"
      >
        <aside
          className="absolute top-0 right-0 bottom-0 w-[88%] max-w-[360px] bg-sprout-gradient shadow-2xl drawer-panel flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-sprout-text-muted">
                History
              </p>
              <h2 className="font-heading text-xl font-800 text-sprout-text-primary">
                Recent Activity
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-sprout-card border border-sprout-border shadow-subtle flex items-center justify-center text-sprout-text-primary cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pt-3 pb-6">
            {positions.length > 0 ? (
              <RecentActivity positions={positions} />
            ) : (
              <div className="mx-5 text-center text-sm text-sprout-text-muted py-10">
                No activity yet. Your deposits and withdrawals will show up here.
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
