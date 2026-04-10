import type { Metadata, Viewport } from "next";
import { PrivyProvider } from "@/components/providers/PrivyProvider";
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
    <html lang="en">
      <body className="font-body bg-sprout-gradient min-h-dvh">
        <PrivyProvider>{children}</PrivyProvider>
      </body>
    </html>
  );
}
