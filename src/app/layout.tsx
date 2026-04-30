import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { PrivyProvider } from "@/components/providers/PrivyProvider";
import { LifiSdkProvider } from "@/components/providers/LifiSdkProvider";
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
        <meta
          name="talentapp:project_verification"
          content="84c63c64fe80e869e4174e6cb0da0a437030b315c71af4ab030e62b26292a935e7a9c845736939fb739c8ccbd9928eb3209330b15d8084e2a736e94b9fa77279"
        />
        {/* Static theme-init script served from /public — applies the
            dark class before React hydrates so the first paint matches
            the saved preference (no flash of light mode). */}
        <script src="/theme-init.js" async={false} />
      </head>
      <body className="font-body bg-sprout-gradient min-h-dvh">
        <SuppressPrivyWarnings />
        <PrivyProvider>
          <LifiSdkProvider>
            <ThemeSync />
            <ServiceWorkerRegister />
            <InstallPrompt />
            {children}
          </LifiSdkProvider>
        </PrivyProvider>
        <Analytics />
      </body>
    </html>
  );
}
