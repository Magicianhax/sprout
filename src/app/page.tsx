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

  return (
    <main className="flex flex-col items-center justify-center min-h-dvh px-5">
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
      <div className="flex justify-center gap-5 mt-8">
        <div className="text-center">
          <div className="text-sm font-bold text-sprout-text-primary">$2.1B+</div>
          <div className="text-[11px] text-sprout-text-muted">Total deposited</div>
        </div>
        <div className="w-px bg-sprout-border" />
        <div className="text-center">
          <div className="text-sm font-bold text-sprout-text-primary">5.2%</div>
          <div className="text-[11px] text-sprout-text-muted">Avg. yearly rate</div>
        </div>
        <div className="w-px bg-sprout-border" />
        <div className="text-center">
          <div className="text-sm font-bold text-sprout-text-primary">20+</div>
          <div className="text-[11px] text-sprout-text-muted">Partners</div>
        </div>
      </div>
      <p className="mt-auto mb-6 text-[11px] text-sprout-text-muted">Powered by LI.FI</p>
    </main>
  );
}
