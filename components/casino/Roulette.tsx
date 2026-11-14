"use client";

import { useState } from "react";
import clsx from "clsx";
import { fmt, payout, stake, useWallet } from "@/lib/wallet";
import TokenBar from "./TokenBar";

// European single-zero wheel, in wheel order.
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const CHIPS = [5, 10, 25, 100];
const SEG = 360 / WHEEL.length;

const spinNumber = () => Math.floor(Math.random() * 37);
const color = (n: number) => (n === 0 ? "green" : REDS.has(n) ? "red" : "black");

// Payout multiples (winnings on top of your stake)
function wins(key: string, n: number): number {
  if (key.startsWith("n:")) return Number(key.slice(2)) === n ? 35 : 0;
  if (n === 0) return 0;
  switch (key) {
    case "red": return REDS.has(n) ? 1 : 0;
    case "black": return !REDS.has(n) ? 1 : 0;
    case "odd": return n % 2 === 1 ? 1 : 0;
    case "even": return n % 2 === 0 ? 1 : 0;
    case "low": return n <= 18 ? 1 : 0;
    case "high": return n >= 19 ? 1 : 0;
    case "d1": return n <= 12 ? 2 : 0;
    case "d2": return n >= 13 && n <= 24 ? 2 : 0;
    case "d3": return n >= 25 ? 2 : 0;
    case "c1": return n % 3 === 1 ? 2 : 0;
    case "c2": return n % 3 === 2 ? 2 : 0;
    case "c3": return n % 3 === 0 ? 2 : 0;
  }
  return 0;
}

const LABELS: Record<string, string> = { red: "Red", black: "Black", odd: "Odd", even: "Even", low: "1–18", high: "19–36", d1: "1st 12", d2: "2nd 12", d3: "3rd 12", c1: "Column 1", c2: "Column 2", c3: "Column 3" };
const label = (k: string) => (k.startsWith("n:") ? `Number ${k.slice(2)}` : LABELS[k]);

function Wheel({ rotation, spinning }: { rotation: number; spinning: boolean }) {
  const R = 150;
  const pt = (r: number, deg: number) => {
    const t = (deg * Math.PI) / 180;
    return [160 + r * Math.sin(t), 160 - r * Math.cos(t)];
  };
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px]">
      {/* pointer */}
      <div className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2 border-x-[10px] border-t-[18px] border-x-transparent border-t-volt drop-shadow" />
      <svg viewBox="0 0 320 320" className="h-full w-full" style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 4.2s cubic-bezier(.12,.75,.15,1)" : "none" }}>
        <circle cx="160" cy="160" r="158" fill="#2a1c0e" stroke="#d4ff3a" strokeOpacity=".4" strokeWidth="2" />
        {WHEEL.map((n, i) => {
          const a0 = i * SEG - SEG / 2;
          const a1 = i * SEG + SEG / 2;
          const [x0, y0] = pt(R, a0);
          const [x1, y1] = pt(R, a1);
          const [xi0, yi0] = pt(95, a0);
          const [xi1, yi1] = pt(95, a1);
          const fill = color(n) === "green" ? "#15803d" : color(n) === "red" ? "#b91c1c" : "#111827";
          const [tx, ty] = pt(132, i * SEG);
          return (
            <g key={n}>
              <path d={`M${xi0},${yi0} L${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1} L${xi1},${yi1} A95,95 0 0 0 ${xi0},${yi0}`} fill={fill} stroke="#d4af37" strokeOpacity=".5" strokeWidth=".8" />
              <text x={tx} y={ty} fill="#fff" fontSize="11" fontWeight="800" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${i * SEG} ${tx} ${ty})`}>
                {n}
              </text>
            </g>
          );
        })}
        <circle cx="160" cy="160" r="95" fill="#0b1a10" stroke="#d4af37" strokeOpacity=".5" />
        <circle cx="160" cy="160" r="60" fill="none" stroke="#d4ff3a" strokeOpacity=".15" strokeWidth="10" />
        {[0, 90, 180, 270].map((d) => {
          const [x, y] = pt(55, d);
          return <line key={d} x1="160" y1="160" x2={x} y2={y} stroke="#d4af37" strokeWidth="5" strokeLinecap="round" />;
        })}
        <circle cx="160" cy="160" r="14" fill="#d4af37" />
      </svg>
    </div>
  );
}

export default function Roulette() {
  const w = useWallet();
  const [chip, setChip] = useState(10);
  const [bets, setBets] = useState<Record<string, number>>({});
  const [lastBets, setLastBets] = useState<Record<string, number>>({});
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ n: number; win: number; lines: string[] } | null>(null);
  const [recent, setRecent] = useState<number[]>([]);

  const total = Object.values(bets).reduce((a, b) => a + b, 0);

  function add(key: string) {
    if (spinning) return;
    if (total + chip > w.balance) return;
    setResult(null);
    setBets((b) => ({ ...b, [key]: (b[key] ?? 0) + chip }));
  }

  function spin() {
    if (spinning || !total) return;
    if (!stake(total, "roulette", `Spin (${Object.keys(bets).length} bets)`)) return;
    const n = spinNumber();
    const idx = WHEEL.indexOf(n);
    const target = (360 - idx * SEG) % 360;
    const current = ((rotation % 360) + 360) % 360;
    const next = rotation + 360 * 5 + ((target - current + 360) % 360);
    setSpinning(true);
    setResult(null);
    setRotation(next);
    const placed = bets;
    setTimeout(() => {
      let win = 0;
      const lines: string[] = [];
      for (const [k, amt] of Object.entries(placed)) {
        const m = wins(k, n);
        if (m) {
          win += amt * (m + 1);
          lines.push(`${label(k)}: +${fmt(amt * (m + 1))}`);
        }
      }
      if (win) payout(win, "roulette", `${n} ${color(n)}`);
      setResult({ n, win, lines });
      setRecent((r) => [n, ...r].slice(0, 12));
      setLastBets(placed);
      setBets({});
      setSpinning(false);
    }, 4300);
  }

  const cell = (key: string, content: React.ReactNode, cls: string) => (
    <button key={key} onClick={() => add(key)} disabled={spinning} className={clsx("relative grid place-items-center rounded-md border border-white/15 text-sm font-bold transition hover:brightness-125", cls)}>
      {content}
      {bets[key] && <span className="absolute -right-1 -top-1 z-10 grid min-w-6 place-items-center rounded-full border-2 border-white bg-volt px-1 text-[10px] font-extrabold text-night shadow">{bets[key]}</span>}
    </button>
  );

  const rows = [3, 2, 1].map((r) => Array.from({ length: 12 }, (_, i) => i * 3 + r));

  return (
    <div>
      <TokenBar title="Roulette" />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="card p-5">
          <Wheel rotation={rotation} spinning={spinning} />
          <div className="mt-4 h-16 text-center">
            {result && (
              <div className="animate-rise">
                <span className={clsx("inline-grid size-12 place-items-center rounded-full font-display text-2xl", color(result.n) === "red" ? "bg-red-700" : color(result.n) === "green" ? "bg-green-700" : "bg-gray-900 ring-1 ring-white/20")}>{result.n}</span>
                <div className={clsx("mt-1 text-sm font-bold", result.win ? "text-volt" : "text-mist")}>{result.win ? `You win ${fmt(result.win)}!` : "No win this time"}</div>
              </div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-1">
            {recent.map((n, i) => (
              <span key={i} className={clsx("grid size-7 place-items-center rounded-full text-[11px] font-bold", color(n) === "red" ? "bg-red-700" : color(n) === "green" ? "bg-green-700" : "bg-gray-900 ring-1 ring-white/20")}>
                {n}
              </span>
            ))}
          </div>
        </div>

        <div className="card p-4 md:p-5">
          <div className="scroll-x -mx-1 px-1 pb-1">
            <div className="grid min-w-[560px] grid-cols-[2.5rem_repeat(12,1fr)_3rem] gap-1">
              <div className="row-span-3 grid">{cell("n:0", "0", "bg-green-700")}</div>
              {rows.map((row, ri) => (
                <div key={ri} className="contents">
                  {row.map((n) => cell(`n:${n}`, n, clsx("h-11", REDS.has(n) ? "bg-red-700" : "bg-gray-900")))}
                  {cell(`c${3 - ri}`, "2:1", "h-11 bg-white/5 text-xs")}
                </div>
              ))}
              <div />
              {cell("d1", "1st 12", "col-span-4 h-10 bg-white/5")}
              {cell("d2", "2nd 12", "col-span-4 h-10 bg-white/5")}
              {cell("d3", "3rd 12", "col-span-4 h-10 bg-white/5")}
              <div />
              <div />
              {cell("low", "1–18", "col-span-2 h-10 bg-white/5")}
              {cell("even", "EVEN", "col-span-2 h-10 bg-white/5")}
              {cell("red", <span className="size-5 rotate-45 rounded-sm bg-red-600" />, "col-span-2 h-10 bg-white/5")}
              {cell("black", <span className="size-5 rotate-45 rounded-sm bg-gray-950 ring-1 ring-white/40" />, "col-span-2 h-10 bg-white/5")}
              {cell("odd", "ODD", "col-span-2 h-10 bg-white/5")}
              {cell("high", "19–36", "col-span-2 h-10 bg-white/5")}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-sm text-mist">Chip</span>
            {CHIPS.map((c) => (
              <button key={c} onClick={() => setChip(c)} className="chip" data-active={chip === c}>
                {c}
              </button>
            ))}
            <span className="ml-auto text-sm">
              On the table: <b className="text-volt">{fmt(total)}</b>
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button onClick={() => setBets({})} disabled={spinning || !total} className="rounded-xl border border-line py-3 font-semibold disabled:opacity-40">
              Clear
            </button>
            <button
              onClick={() => {
                const t = Object.values(lastBets).reduce((a, b) => a + b, 0);
                if (t && t <= w.balance) setBets(lastBets);
              }}
              disabled={spinning || !Object.keys(lastBets).length}
              className="rounded-xl border border-line py-3 font-semibold disabled:opacity-40"
            >
              Rebet
            </button>
            <button onClick={spin} disabled={spinning || !total} className="rounded-xl bg-volt py-3 font-display text-xl tracking-wider text-night disabled:opacity-40">
              {spinning ? "…" : "SPIN"}
            </button>
          </div>

          {result?.lines.length ? <div className="mt-3 text-xs text-volt">{result.lines.join(" · ")}</div> : null}
          <p className="mt-4 text-xs text-mist">Tap the table to place chips. Single number pays 35:1, dozens and columns 2:1, red/black, odd/even and 1–18/19–36 pay 1:1. Zero makes all outside bets lose, which gives the house its 2.7% edge.</p>
        </div>
      </div>
    </div>
  );
}
