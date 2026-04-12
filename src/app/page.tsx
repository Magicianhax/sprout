"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { loadPreferences } from "@/stores/preferences";

export default function LandingPage() {
  const { login, ready, authenticated } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) {
      const prefs = loadPreferences();
      router.replace(prefs.onboardingComplete ? "/home" : "/onboarding");
    }
  }, [ready, authenticated, router]);

  // While Privy is loading OR while we're redirecting an authenticated user
  if (!ready || authenticated) {
    return (
      <main className="flex flex-col items-center justify-center min-h-dvh px-5 bg-sprout-gradient">
        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-sprout-green-light to-[#C8E6C9] flex items-center justify-center mb-8 sprout-pulse">
          <span className="text-5xl">🌱</span>
        </div>
        <h1 className="font-heading text-4xl font-800 text-sprout-green-dark text-center">sprout</h1>
        <div className="flex gap-1.5 mt-6">
          <span className="w-2 h-2 rounded-full bg-sprout-green-primary dot-pulse" style={{ animationDelay: "0s" }} />
          <span className="w-2 h-2 rounded-full bg-sprout-green-primary dot-pulse" style={{ animationDelay: "0.2s" }} />
          <span className="w-2 h-2 rounded-full bg-sprout-green-primary dot-pulse" style={{ animationDelay: "0.4s" }} />
        </div>
        <style>{`
          @keyframes sprout-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
          .sprout-pulse { animation: sprout-pulse 2s ease-in-out infinite; }
          @keyframes dot-pulse { 0%,100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }
          .dot-pulse { animation: dot-pulse 1.2s ease-in-out infinite; }
        `}</style>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-dvh px-5 bg-sprout-gradient">
      <div className="w-28 h-28 rounded-full bg-gradient-to-br from-sprout-green-light to-[#C8E6C9] flex items-center justify-center mb-8">
        <span className="text-5xl">🌱</span>
      </div>
      <h1 className="font-heading text-4xl font-800 text-sprout-green-dark text-center">sprout</h1>
      <p className="font-body text-sprout-text-secondary mt-3 text-center text-base max-w-[280px] leading-relaxed">
        Your money, growing every day. Earn on your crypto as easily as a savings account.
      </p>
      <div className="mt-10 w-full max-w-[320px]">
        <Button onClick={login} className="w-full text-lg py-5">Start Earning</Button>
      </div>
      <p className="mt-auto mb-6 text-[11px] text-sprout-text-muted">Powered by LI.FI</p>
    </main>
  );
}
