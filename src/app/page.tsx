"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sparkles, ShieldCheck, Zap } from "lucide-react";
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

  // Loading / auto-redirect splash — shown while Privy is booting
  // OR while we're redirecting an authenticated user to /home.
  if (!ready || authenticated) {
    return (
      <main className="flex flex-col items-center justify-center min-h-dvh px-5 bg-sprout-gradient">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-sprout-green-primary/20 blur-2xl sprout-glow" />
          <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-sprout-green-light to-[#C8E6C9] flex items-center justify-center shadow-glow sprout-pulse">
            <span className="text-5xl">🌱</span>
          </div>
        </div>
        <h1 className="font-heading text-4xl font-800 text-sprout-green-dark text-center mt-8">
          sprout
        </h1>
        <div className="flex gap-1.5 mt-6">
          <span className="w-2 h-2 rounded-full bg-sprout-green-primary dot-pulse" style={{ animationDelay: "0s" }} />
          <span className="w-2 h-2 rounded-full bg-sprout-green-primary dot-pulse" style={{ animationDelay: "0.2s" }} />
          <span className="w-2 h-2 rounded-full bg-sprout-green-primary dot-pulse" style={{ animationDelay: "0.4s" }} />
        </div>
        <style>{`
          @keyframes sprout-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
          .sprout-pulse { animation: sprout-pulse 2.4s ease-in-out infinite; }
          @keyframes sprout-glow { 0%,100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 0.9; transform: scale(1.15); } }
          .sprout-glow { animation: sprout-glow 2.4s ease-in-out infinite; }
          @keyframes dot-pulse { 0%,100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }
          .dot-pulse { animation: dot-pulse 1.2s ease-in-out infinite; }
        `}</style>
      </main>
    );
  }

  return (
    <main className="relative flex flex-col min-h-dvh bg-sprout-gradient overflow-hidden">
      {/* Ambient blurred gradient blobs — adds depth without assets. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full bg-sprout-green-primary/20 blur-[96px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-24 w-[28rem] h-[28rem] rounded-full bg-sprout-green-light/40 blur-[112px]"
      />

      {/* Top wordmark — no dead "sprout out of position" look like the
          old layout where the heading floated mid-screen. */}
      <div className="relative flex items-center gap-2 px-5 pt-6">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sprout-green-light to-sprout-green-primary flex items-center justify-center shadow-subtle">
          <span className="text-lg leading-none">🌱</span>
        </div>
        <span className="font-heading text-lg font-800 text-sprout-green-dark">
          sprout
        </span>
      </div>

      {/* Hero — centered vertically in the remaining space. */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-5 text-center">
        <div className="relative mb-8 landing-rise">
          <div className="absolute inset-0 rounded-full bg-sprout-green-primary/25 blur-3xl" />
          <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-sprout-green-light to-[#C8E6C9] flex items-center justify-center shadow-glow">
            <span className="text-6xl leading-none">🌱</span>
          </div>
        </div>

        <h1 className="font-heading text-[44px] leading-[1.05] font-900 text-sprout-text-primary landing-rise-delay-1">
          Your money,
          <br />
          <span className="text-sprout-green-dark">growing every day.</span>
        </h1>

        <p className="font-body text-base text-sprout-text-secondary mt-4 max-w-[320px] leading-relaxed landing-rise-delay-2">
          Earn on your crypto as easily as opening a savings account. One tap
          to start. No DeFi jargon.
        </p>

        {/* Feature strip — three actual product truths, no fake stats. */}
        <div className="flex items-center gap-4 mt-8 landing-rise-delay-3">
          <Feature icon={<Zap size={14} />} label="One tap" />
          <Feature icon={<ShieldCheck size={14} />} label="Non-custodial" />
          <Feature icon={<Sparkles size={14} />} label="Cross-chain" />
        </div>
      </section>

      {/* CTA docked near the bottom so it's reachable without a stretch. */}
      <div className="relative px-5 pb-10 pt-4">
        <Button
          onClick={login}
          className="w-full max-w-[400px] mx-auto text-lg py-5 landing-rise-delay-4"
        >
          Start Earning
        </Button>
        <p className="text-center text-[11px] text-sprout-text-muted mt-5">
          Powered by <span className="font-bold">LI.FI</span>
        </p>
      </div>

      <style>{`
        @keyframes landing-rise {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .landing-rise { animation: landing-rise 0.6s cubic-bezier(0.22, 0.61, 0.36, 1) both; }
        .landing-rise-delay-1 { animation: landing-rise 0.6s cubic-bezier(0.22, 0.61, 0.36, 1) 0.08s both; }
        .landing-rise-delay-2 { animation: landing-rise 0.6s cubic-bezier(0.22, 0.61, 0.36, 1) 0.16s both; }
        .landing-rise-delay-3 { animation: landing-rise 0.6s cubic-bezier(0.22, 0.61, 0.36, 1) 0.24s both; }
        .landing-rise-delay-4 { animation: landing-rise 0.6s cubic-bezier(0.22, 0.61, 0.36, 1) 0.32s both; }
      `}</style>
    </main>
  );
}

function Feature({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-sprout-card/70 backdrop-blur-sm rounded-pill border border-sprout-border/60 shadow-subtle">
      <span className="text-sprout-green-primary">{icon}</span>
      <span className="text-[11px] font-bold text-sprout-text-primary">
        {label}
      </span>
    </div>
  );
}
