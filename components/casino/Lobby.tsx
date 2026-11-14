"use client";

import Link from "next/link";
import clsx from "clsx";
import { canClaimBonus, DAILY_BONUS, fmt, useHydrated, useWallet } from "@/lib/wallet";
import TokenBar from "./TokenBar";

const GAMES = [
  { href: "/casino/football", emoji: "⚽", name: "Football Bets", sub: "Real matches, live in-play odds", tint: "from-volt/25" },
  { href: "/casino/blackjack", emoji: "🃏", name: "Blackjack", sub: "Beat the dealer to 21, blackjack pays 3:2", tint: "from-fuchsia-500/25" },
  { href: "/casino/roulette", emoji: "🎡", name: "Roulette", sub: "European wheel, single zero", tint: "from-red-500/25" },
  { href: "/casino/racing", emoji: "🏇", name: "Horse Racing", sub: "Six runners, pick a winner", tint: "from-sky/25" },
];

export default function Lobby() {
  const w = useWallet();
  const ready = useHydrated();
  const open = w.bets.filter((b) => b.status === "open").length;

  return (
    <div>
      <TokenBar title="Arcade" back={false} />

      <p className="-mt-3 mb-6 max-w-2xl text-mist">
        Play with free tokens, not real money. Tokens can&apos;t be bought or cashed out, and there are no prizes: it&apos;s just for fun. 18+.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {GAMES.map((g) => (
          <Link key={g.href} href={g.href} className={clsx("card group relative overflow-hidden bg-gradient-to-br to-transparent p-6 transition hover:-translate-y-0.5 hover:border-volt/40", g.tint)}>
            <div className="text-6xl transition group-hover:scale-110">{g.emoji}</div>
            <div className="mt-4 font-display text-3xl tracking-wide">{g.name.toUpperCase()}</div>
            <div className="text-sm text-mist">{g.sub}</div>
            {g.href === "/casino/football" && ready && open > 0 && (
              <span className="absolute right-4 top-4 rounded-full bg-volt px-2.5 py-1 text-xs font-bold text-night">{open} open bet{open > 1 ? "s" : ""}</span>
            )}
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3 font-display text-xl tracking-wide">RECENT ACTIVITY</div>
          {ready && w.history.length ? (
            w.history.slice(0, 12).map((h, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0">
                <span className="w-20 shrink-0 text-xs capitalize text-mist">{h.game}</span>
                <span className="flex-1 truncate">{h.note}</span>
                <span className={clsx("font-bold tabular", h.delta > 0 ? "text-volt" : "text-mist")}>
                  {h.delta > 0 ? "+" : ""}
                  {fmt(h.delta)}
                </span>
              </div>
            ))
          ) : (
            <p className="p-4 text-sm text-mist">Nothing yet. Pick a game above.</p>
          )}
        </section>

        <aside className="space-y-4">
          <div className="card p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-mist">Your stats</div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-white/[0.04] p-3">
                <div className="font-display text-2xl">{ready ? fmt(w.wagered) : "–"}</div>
                <div className="text-[11px] text-mist">Tokens played</div>
              </div>
              <div className="rounded-xl bg-white/[0.04] p-3">
                <div className="font-display text-2xl">{ready ? fmt(w.won) : "–"}</div>
                <div className="text-[11px] text-mist">Tokens won</div>
              </div>
            </div>
            <p className="mt-3 text-xs text-mist">Over time the games pay back slightly less than you put in, just like real gambling. That&apos;s why it should only ever be for fun.</p>
          </div>
          <div className="card p-5 text-sm">
            <div className="font-bold">Out of tokens?</div>
            <p className="mt-1 text-mist">
              {ready && canClaimBonus(w) ? `Claim your free ${DAILY_BONUS} at the top of the page.` : `Your next ${DAILY_BONUS} free tokens arrive tomorrow. A good moment for a break!`}
            </p>
          </div>
          <div className="card p-5 text-xs leading-relaxed text-mist">
            If gambling stops being fun for you or someone you know, free confidential help is available 24/7: <b className="text-chalk">BeGambleAware.org</b> · National Gambling Helpline <b className="text-chalk">0808 8020 133</b>.
          </div>
        </aside>
      </div>
    </div>
  );
}
