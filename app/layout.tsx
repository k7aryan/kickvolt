import type { Metadata, Viewport } from "next";
import "@fontsource/anton/400.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { Suspense } from "react";
import Nav, { NavView } from "@/components/Nav";
import { isDemoFootball, isDemoOdds } from "@/lib/config";

export const metadata: Metadata = {
  title: { default: "Kickvolt – live scores, tables, odds & AI", template: "%s · Kickvolt" },
  description: "Live football scores, league tables, bookmaker odds with model-based match analysis, an AI football assistant and a quiz.",
  applicationName: "Kickvolt",
};

export const viewport: Viewport = {
  themeColor: "#050b08",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const demo = isDemoFootball() || isDemoOdds();
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <div className="backdrop" />
        <Suspense fallback={<NavView path="" />}>
          <Nav />
        </Suspense>
        {demo && (
          <div className="border-b border-volt/20 bg-volt/[0.07] px-4 py-2 text-center text-xs text-volt">
            Demo mode{isDemoFootball() && isDemoOdds() ? "" : isDemoFootball() ? " (scores)" : " (odds)"}: fixtures, scores and odds are simulated. Add your free API keys to <code className="font-mono">.env.local</code> for real data.
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:pb-16">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-28 text-xs text-mist md:pb-10">
          <div className="border-t border-line pt-6 leading-relaxed">
            <br />
            18+ only. Gamble responsibly – set limits and never bet more than you can afford to lose.
          </div>
        </footer>
      </body>
    </html>
  );
}
