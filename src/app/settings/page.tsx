"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Copy, Check, ExternalLink, LogOut } from "lucide-react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card } from "@/components/ui/Card";
import { usePreferences } from "@/lib/hooks/usePreferences";

function truncateAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function SettingsContent() {
  const router = useRouter();
  const { user, logout } = usePrivy();
  const { preferences, update } = usePreferences();

  const [copied, setCopied] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);

  const walletAddress = user?.wallet?.address ?? "";
  const email = user?.email?.address ?? "";

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.replace("/");
  };

  const isPro = preferences.mode === "pro";

  return (
    <main className="min-h-dvh bg-sprout-gradient pb-28">
      <Header />

      <div className="px-5 pt-5 pb-4">
        <p className="font-heading text-2xl font-800 text-sprout-text-primary">
          Settings
        </p>
      </div>

      <div className="flex flex-col gap-4 px-5">
        {/* Account section */}
        <Card shadow="subtle">
          <p className="text-xs font-semibold text-sprout-text-muted uppercase tracking-wider mb-3">
            Account
          </p>

          {email && (
            <div className="mb-3">
              <p className="text-xs text-sprout-text-muted">Email</p>
              <p className="text-sm font-semibold text-sprout-text-primary mt-0.5 truncate">
                {email}
              </p>
            </div>
          )}

          {walletAddress && (
            <div>
              <p className="text-xs text-sprout-text-muted">Wallet</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm font-semibold text-sprout-text-primary font-mono">
                  {truncateAddress(walletAddress)}
                </p>
                <button
                  onClick={handleCopyAddress}
                  className="text-sprout-text-muted hover:text-sprout-green-dark transition-colors cursor-pointer"
                  aria-label="Copy wallet address"
                >
                  {copied ? (
                    <Check size={15} className="text-sprout-green-dark" />
                  ) : (
                    <Copy size={15} />
                  )}
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* Mode toggle */}
        <Card shadow="subtle">
          <p className="text-xs font-semibold text-sprout-text-muted uppercase tracking-wider mb-3">
            Mode
          </p>

          {/* Segmented control */}
          <div className="flex bg-gray-100 rounded-xl p-1">
            <button
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all cursor-pointer ${
                !isPro
                  ? "bg-white text-sprout-green-dark shadow-subtle"
                  : "text-sprout-text-muted"
              }`}
              onClick={() => update({ mode: "lite" })}
            >
              Lite
            </button>
            <button
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all cursor-pointer ${
                isPro
                  ? "bg-white text-sprout-green-dark shadow-subtle"
                  : "text-sprout-text-muted"
              }`}
              onClick={() => update({ mode: "pro" })}
            >
              Pro
            </button>
          </div>

          <p className="text-xs text-sprout-text-muted mt-2">
            {isPro
              ? "Pro mode shows advanced details like protocol info, chains, and vault explorer."
              : "Lite mode keeps things simple — just your balance, rate, and earnings."}
          </p>
        </Card>

        {/* Notifications toggle */}
        <Card shadow="subtle">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-sprout-text-primary">
                Push Notifications
              </p>
              <p className="text-xs text-sprout-text-muted mt-0.5">
                Get alerts on earnings milestones
              </p>
            </div>
            <button
              onClick={() => setNotificationsEnabled((v) => !v)}
              className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer ${
                notificationsEnabled ? "bg-sprout-green-primary" : "bg-gray-200"
              }`}
              aria-label="Toggle notifications"
            >
              <span
                className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  notificationsEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </Card>

        {/* Dark mode toggle */}
        <Card shadow="subtle">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-sprout-text-primary">
                Dark Mode
              </p>
              <p className="text-xs text-sprout-text-muted mt-0.5">
                Easier on the eyes at night
              </p>
            </div>
            <button
              onClick={() => setDarkModeEnabled((v) => !v)}
              className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer ${
                darkModeEnabled ? "bg-sprout-green-primary" : "bg-gray-200"
              }`}
              aria-label="Toggle dark mode"
            >
              <span
                className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  darkModeEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </Card>

        {/* About */}
        <Card shadow="subtle">
          <button
            className="flex items-center justify-between w-full cursor-pointer"
            onClick={() => {}}
          >
            <p className="text-sm font-semibold text-sprout-text-primary">
              About Sprout
            </p>
            <ExternalLink size={16} className="text-sprout-text-muted" />
          </button>
        </Card>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="flex items-center justify-center gap-2 w-full py-4 text-sprout-red-stop font-semibold text-sm cursor-pointer"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>

      <BottomNav />
    </main>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}
