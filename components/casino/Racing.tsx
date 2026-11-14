"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { fmt, payout, stake, useWallet } from "@/lib/wallet";
import TokenBar from "./TokenBar";

const NAMES = ["Volt Runner", "Offside Trap", "Golden Boot", "Late Winner", "Park The Bus", "Nutmeg Express", "Top Bin", "Route One", "False Nine", "Extra Time", "Var Check", "Hat-Trick Hero"];
const SILKS = ["#d4ff3a", "#38bdf8", "#f97316", "#e879f9", "#f43f5e", "#a3e635", "#facc15", "#22d3ee"];
const STAKES = [10, 25, 50, 100];
const MARGIN = 1.12; // the bookmaker's edge built into the odds

interface Runner {
  no: number;
  name: string;
  silk: string;
  p: number; // true chance of winning
  odds: number; // decimal odds offered
}

function newRace(): Runner[] {
  const names = [...NAMES].sort(() => Math.random() - 0.5).slice(0, 6);
  const raw = names.map(() => Math.exp(Math.random() * 1.6));
  const sum = raw.reduce((a, b) => a + b, 0);
  return names.map((name, i) => {
    const p = raw[i] / sum;
    return { no: i + 1, name, silk: SILKS[i], p, odds: Math.max(1.2, Math.round((1 / (p * MARGIN)) * 10) / 10) };
  });
}

function pickWinner(rs: Runner[]) {
  let r = Math.random();
  for (const x of rs) if ((r -= x.p) < 0) return x.no;
  return rs[rs.length - 1].no;
}

const DURATION = 6500;

export default function Racing() {
  const w = useWallet();
  const [runners, setRunners] = useState<Runner[]>([]);
  const [pick, setPick] = useState<number | null>(null);
  const [bet, setBet] = useState(25);
  const [progress, setProgress] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [phase, setPhase] = useState<"ready" | "running" | "done">("ready");
  const [result, setResult] = useState<{ order: number[]; win: number } | null>(null);
  const raf = useRef<number | null>(null);

  // Generate the first card in the browser (random odds would mismatch the server render).
  useEffect(() => {
    const id = requestAnimationFrame(() => setRunners(newRace()));
    return () => {
      cancelAnimationFrame(id);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  function start() {
    if (phase === "running" || pick == null) return;
    const horse = runners.find((r) => r.no === pick)!;
    if (!stake(bet, "racing", `#${horse.no} ${horse.name} @ ${horse.odds}`)) return;

    const winner = pickWinner(runners);
    // Finish times: the winner is fastest; everyone else finishes 2–14% behind.
    const others = runners.filter((r) => r.no !== winner).sort(() => Math.random() - 0.5);
    const finish: Record<number, number> = { [winner]: 1 };
    others.forEach((r, i) => (finish[r.no] = 1 + 0.02 * (i + 1) + Math.random() * 0.02));
    const order = Object.entries(finish).sort((a, b) => a[1] - b[1]).map(([n]) => Number(n));
    const wobble = runners.map(() => ({ a: Math.random() * 0.06, f: 2 + Math.random() * 3, ph: Math.random() * 6 }));

    setPhase("running");
    setResult(null);
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = (now - t0) / DURATION;
      setProgress(
        runners.map((r, i) => {
          const base = t / finish[r.no];
          const wv = wobble[i];
          const surge = wv.a * Math.sin(base * wv.f * Math.PI + wv.ph) * (1 - base); // jostling that settles by the line
          return Math.max(0, Math.min(1, base + surge));
        }),
      );
      if (t < Math.max(...Object.values(finish)) + 0.05) {
        raf.current = requestAnimationFrame(tick);
      } else {
        const win = winner === pick ? Math.round(bet * horse.odds) : 0;
        if (win) payout(win, "racing", `#${horse.no} ${horse.name} won`);
        setResult({ order, win });
        setPhase("done");
      }
    };
    raf.current = requestAnimationFrame(tick);
  }

  function next() {
    setRunners(newRace());
    setPick(null);
    setProgress([0, 0, 0, 0, 0, 0]);
    setResult(null);
    setPhase("ready");
  }

  return (
    <div>
      <TokenBar title="Horse Racing" />

      <section className="card overflow-hidden">
        <div className="relative bg-[repeating-linear-gradient(90deg,#14532d_0_40px,#166534_40px_80px)] px-3 py-3">
          <div className="absolute inset-y-0 right-12 w-1.5 bg-[repeating-linear-gradient(180deg,#fff_0_8px,#111_8px_16px)] opacity-90" />
          {runners.map((r, i) => (
            <div key={r.no} className="relative h-11 border-b border-white/10 last:border-0">
              <div className="absolute top-1/2 flex -translate-y-1/2 items-center" style={{ left: `calc(${progress[i] * 100}% * 0.88)` }}>
                <span className="text-3xl" style={{ transform: "scaleX(-1)", display: "inline-block" }}>
                  🏇
                </span>
                <span className="ml-1 grid size-5 place-items-center rounded-full text-[10px] font-extrabold text-night" style={{ background: r.silk }}>
                  {r.no}
                </span>
              </div>
            </div>
          ))}
          {!runners.length && <div className="h-64" />}
        </div>

        {result && (
          <div className="border-t border-line px-5 py-4 animate-rise">
            <div className={clsx("font-display text-2xl tracking-wide", result.win ? "text-volt" : "text-chalk")}>
              {result.win ? `WINNER! +${fmt(result.win)} TOKENS` : `#${result.order[0]} ${runners.find((r) => r.no === result.order[0])?.name.toUpperCase()} WINS`}
            </div>
            <div className="mt-1 text-sm text-mist">
              Result: {result.order.slice(0, 3).map((n, i) => `${["1st", "2nd", "3rd"][i]} #${n}`).join(" · ")}
            </div>
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3 font-display text-xl tracking-wide">RACECARD</div>
          {runners.map((r) => (
            <button
              key={r.no}
              disabled={phase !== "ready"}
              onClick={() => setPick(r.no)}
              className={clsx("flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition last:border-0", pick === r.no ? "bg-volt/10" : "hover:bg-white/[0.03]")}
            >
              <span className="grid size-8 place-items-center rounded-lg font-extrabold text-night" style={{ background: r.silk }}>
                {r.no}
              </span>
              <span className="flex-1 font-semibold">{r.name}</span>
              <span className={clsx("rounded-lg px-3 py-1.5 font-display text-xl tabular", pick === r.no ? "bg-volt text-night" : "bg-white/5")}>{r.odds.toFixed(1)}</span>
            </button>
          ))}
        </section>

        <aside className="card h-fit p-5">
          <div className="text-sm text-mist">Your pick</div>
          <div className="mt-1 text-lg font-bold">{pick ? `#${pick} ${runners.find((r) => r.no === pick)?.name}` : "Tap a horse"}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {STAKES.map((s) => (
              <button key={s} onClick={() => setBet(s)} disabled={phase === "running"} className="chip" data-active={bet === s}>
                {s}
              </button>
            ))}
          </div>
          {pick && (
            <div className="mt-3 text-sm text-mist">
              Returns <b className="text-volt">{fmt(Math.round(bet * (runners.find((r) => r.no === pick)?.odds ?? 0)))}</b> if it wins
            </div>
          )}
          {phase === "done" ? (
            <button onClick={next} className="mt-5 w-full rounded-xl bg-volt py-3 font-display text-xl tracking-wider text-night">
              NEXT RACE
            </button>
          ) : (
            <button onClick={start} disabled={phase === "running" || pick == null || w.balance < bet} className="mt-5 w-full rounded-xl bg-volt py-3 font-display text-xl tracking-wider text-night disabled:opacity-40">
              {phase === "running" ? "THEY'RE OFF…" : `BET ${bet} & START`}
            </button>
          )}
          <p className="mt-4 text-xs text-mist">Odds reflect each horse&apos;s real chance, minus a bookmaker margin, so favourites win more often but pay less.</p>
        </aside>
      </div>
    </div>
  );
}
