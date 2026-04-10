"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionCard } from "@/components/onboarding/QuestionCard";
import { Button } from "@/components/ui/Button";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { usePreferences } from "@/lib/hooks/usePreferences";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { SUPPORTED_TOKENS } from "@/lib/constants";
import type { UserPreferences } from "@/lib/types";

const QUESTIONS = [
  {
    question: "How would you like your money to grow?",
    subtitle: "This helps us find the right opportunities for you",
    options: [
      { label: "Slow & steady", value: "low", description: "Lower returns, very stable" },
      { label: "A good balance", value: "medium", description: "Moderate returns, some variability" },
      { label: "I don't mind some bumps", value: "high", description: "Higher potential returns" },
    ],
  },
  {
    question: "Have you used apps like this before?",
    subtitle: "We'll adjust the experience to match",
    options: [
      { label: "First time", value: "beginner" },
      { label: "A little", value: "intermediate" },
      { label: "I'm a pro", value: "advanced" },
    ],
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const router = useRouter();
  const { update } = usePreferences();

  function handleSelect(value: string) {
    const key = step === 0 ? "riskLevel" : "experienceLevel";
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setTimeout(() => setStep((s) => s + 1), 300);
  }

  function toggleToken(symbol: string) {
    setSelectedTokens((prev) =>
      prev.includes(symbol) ? prev.filter((t) => t !== symbol) : [...prev, symbol]
    );
  }

  function handleFinish() {
    if (selectedTokens.length === 0) return;
    const mode: UserPreferences["mode"] = answers.experienceLevel === "beginner" ? "lite" : "pro";
    update({
      mode,
      riskLevel: answers.riskLevel as UserPreferences["riskLevel"],
      experienceLevel: answers.experienceLevel as UserPreferences["experienceLevel"],
      preferredTokens: selectedTokens,
      onboardingComplete: true,
    });
    router.replace("/home");
  }

  const isTokenStep = step >= QUESTIONS.length;

  return (
    <AuthGuard>
      <main className="min-h-dvh px-5 pt-16 pb-8 flex flex-col">
        <div className="flex justify-center gap-2 mb-10">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i <= step ? "bg-sprout-green-primary" : "bg-gray-200"}`} />
          ))}
        </div>
        {!isTokenStep ? (
          <QuestionCard
            question={QUESTIONS[step].question}
            subtitle={QUESTIONS[step].subtitle}
            options={QUESTIONS[step].options}
            onSelect={handleSelect}
            selected={answers[step === 0 ? "riskLevel" : "experienceLevel"]}
          />
        ) : (
          <div className="flex flex-col items-center">
            <h2 className="font-heading text-2xl font-700 text-sprout-text-primary text-center">What do you have to deposit?</h2>
            <p className="text-sm text-sprout-text-secondary mt-2 text-center">Pick one or more — you can always change later</p>
            <div className="grid grid-cols-3 gap-3 mt-8 w-full">
              {SUPPORTED_TOKENS.map((token) => (
                <button
                  key={token.symbol}
                  onClick={() => toggleToken(token.symbol)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-card border-[1.5px] transition-all cursor-pointer
                    ${selectedTokens.includes(token.symbol) ? "border-sprout-green-primary bg-sprout-green-light" : "border-sprout-border bg-white"}`}
                >
                  <TokenIcon type="token" identifier={token.symbol} size={36} />
                  <span className="text-sm font-semibold">{token.symbol}</span>
                </button>
              ))}
            </div>
            <div className="mt-auto pt-8 w-full">
              <Button onClick={handleFinish} disabled={selectedTokens.length === 0} className="w-full">
                Let&apos;s go
              </Button>
            </div>
          </div>
        )}
      </main>
    </AuthGuard>
  );
}
