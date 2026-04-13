import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { PrivyProvider } from "@/components/providers/PrivyProvider";
import { ThemeSync } from "@/components/providers/ThemeSync";
import { ServiceWorkerRegister } from "@/components/providers/ServiceWorkerRegister";
import { InstallPrompt } from "@/components/providers/InstallPrompt";
import { SuppressPrivyWarnings } from "@/components/providers/SuppressPrivyWarnings";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sprout — Your money, growing every day",
  description: "Earn on your crypto as easily as a savings account. One tap to start earning.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icon-32.png",
    apple: [
      { url: "/icon-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
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
        <SuppressPrivyWarnings />
        <PrivyProvider>
          <ThemeSync />
          <ServiceWorkerRegister />
          <InstallPrompt />
          {children}
        </PrivyProvider>
        <Analytics />
      </body>
    </html>
  );
}
