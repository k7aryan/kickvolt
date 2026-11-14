"use client";

import Link from "next/link";
import { canClaimBonus, claimBonus, confirmAge, DAILY_BONUS, fmt, useHydrated, useWallet } from "@/lib/wallet";
import { IconToken } from "../icons";

/** Balance strip shown at the top of every Play page, plus the one-time 18+ notice. */
export default function TokenBar({ title, back = true }: { title: string; back?: boolean }) {
  const w = useWallet();
  const ready = useHydrated();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {back && (
          <Link href="/casino" className="text-sm font-semibold text-mist hover:text-chalk">
            ← Arcade
          </Link>
        )}
        <h1 className="font-display text-4xl tracking-wide md:text-5xl">{title.toUpperCase()}</h1>
        <div className="ml-auto flex items-center gap-2">
          {ready && canClaimBonus(w) && (
            <button onClick={() => claimBonus()} className="rounded-full bg-sky/15 px-3 py-2 text-xs font-bold text-sky transition hover:bg-sky/25">
              🎁 +{DAILY_BONUS} daily
            </button>
          )}
          <div className="flex items-center gap-2 rounded-full border border-volt/30 bg-volt/10 px-4 py-2 font-display text-xl text-volt">
            <IconToken size={20} />
            <span key={w.balance} className="tabular animate-rise">
              {ready ? fmt(w.balance) : "…"}
            </span>
          </div>
        </div>
      </div>
      {ready && !w.ageOk && <AgeGate />}
    </>
  );
}

function AgeGate() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-night/85 p-4 backdrop-blur-md">
      <div className="card max-w-md p-7 text-center animate-rise">
        <div className="mb-3 text-5xl">🎟️</div>
        <h2 className="font-display text-3xl tracking-wide">FREE-PLAY ARCADE</h2>
        <ul className="mt-4 space-y-2 text-left text-sm text-mist">
          <li>• You play with <b className="text-chalk">tokens</b>, which are not real money. They can&apos;t be bought, sold or cashed out, and there are no prizes.</li>
          <li>• You start with 1,000 tokens and can claim {DAILY_BONUS} more once a day.</li>
          <li>• These games are for adults (18+) and for fun only.</li>
          <li>
            • If gambling, even free-play, stops feeling like fun, free confidential support is at <b className="text-chalk">BeGambleAware.org</b> or the National Gambling Helpline on <b className="text-chalk">0808 8020 133</b>.
          </li>
        </ul>
        <div className="mt-6 flex gap-3">
          <Link href="/" className="flex-1 rounded-xl border border-line px-4 py-3 font-semibold text-mist">
            Leave
          </Link>
          <button onClick={() => confirmAge()} className="flex-1 rounded-xl bg-volt px-4 py-3 font-bold text-night">
            I&apos;m 18+, let&apos;s play
          </button>
        </div>
      </div>
    </div>
  );
}
