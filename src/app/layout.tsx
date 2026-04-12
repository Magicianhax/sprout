import type { Metadata, Viewport } from "next";
import { PrivyProvider } from "@/components/providers/PrivyProvider";
import { ThemeSync } from "@/components/providers/ThemeSync";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sprout — Your money, growing every day",
  description: "Earn on your crypto as easily as a savings account. One tap to start earning.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#4CAF50",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Static theme-init script served from /public — applies the
            dark class before React hydrates so the first paint matches
            the saved preference (no flash of light mode). */}
        <script src="/theme-init.js" async={false} />
      </head>
      <body className="font-body bg-sprout-gradient min-h-dvh">
        <PrivyProvider>
          <ThemeSync />
          {children}
        </PrivyProvider>
      </body>
    </html>
  );
}
