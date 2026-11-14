"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { Team } from "@/lib/types";
import { inPlayProbs } from "@/lib/predict";
import {
  CASH_OUT_RATE,
  cashOut,
  cashOutValue,
  combinedOdds,
  EARLY_PAYOUT_LEAD,
  fmt,
  placeFootballBet,
  settleFootballBets,
  useHydrated,
  useWallet,
  type FootballBet,
  type Leg,
  type MatchResult,
  type Pick,
} from "@/lib/wallet";
import TeamCrest from "../TeamCrest";
import { LocalTime } from "../bits";
import TokenBar from "./TokenBar";

interface OddsMatch {
  id: number;
  day: string;
  utcDate: string;
  competition: string;
  home: string;
  away: string;
  homeTeam: Team;
  awayTeam: Team;
  status: string;
  minute: number | null;
  score: { home: number | null; away: number | null };
  reds: { home: number; away: number };
  open: boolean;
  suspended: boolean;
  reason: string | null;
  probs: Record<Pick, number>;
  odds: Record<Pick, number>;
  model: { lambdaHome: number; lambdaAway: number };
  exactMinute: number | null;
  clockRunning: boolean;
}

interface Selection {
  matchId: number;
  pick: Pick;
  addedOdds: number;
}

const STAKES = [10, 25, 50, 100, 250];
const MAX_LEGS = 10;
const POLL_MS = 5000;
const MARGIN = 1.06;
const PICKS: Pick[] = ["home", "draw", "away"];

const pickLabel = (m: { home: string; away: string }, p: Pick) => (p === "home" ? m.home : p === "away" ? m.away : "Draw");
const isLiveStatus = (s: string) => s === "IN_PLAY" || s === "PAUSED";

/** ▲▼ price movement. On your own bets a falling price is good news (your pick is more likely), so it shows green. */
function Arrow({ from, to, mine = false }: { from: number; to: number; mine?: boolean }) {
  if (Math.abs(from - to) < 0.005) return null;
  const good = mine ? to < from : to > from;
  return <span className={clsx("ml-1 text-[10px] font-bold", good ? "text-win" : "text-loss")}>{to > from ? "▲" : "▼"}</span>;
}

/** Cash-out amount that counts smoothly to each new value and flashes green (up) or red (down). */
function LiveAmount({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 600);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round((start + (value - start) * eased) * 100) / 100);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame((t) => {
      setFlash(value > start ? "up" : "down");
      step(t);
    });
    from.current = value;
    const off = setTimeout(() => setFlash(null), 900);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(off);
    };
  }, [value]);
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-md px-1.5 tabular transition-colors duration-300", flash === "up" && "bg-win/25 text-win", flash === "down" && "bg-loss/25 text-loss")}>
      {shown.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      {flash && <span className="text-[10px]">{flash === "up" ? "▲" : "▼"}</span>}
    </span>
  );
}

export default function FootballBets() {
  const w = useWallet();
  const ready = useHydrated();
  const [matches, setMatches] = useState<OddsMatch[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [slip, setSlip] = useState<Selection[]>([]);
  const [amount, setAmount] = useState(25);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<"open" | "settled">("open");
  const [confirm, setConfirm] = useState<string | null>(null);
  const prevOdds = useRef(new Map<string, number>());
  const [fetchedAt, setFetchedAt] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000); // the live clock: cash-out values tick every second
    return () => clearInterval(id);
  }, []);
  const [moves, setMoves] = useState(new Map<string, number>()); // last odds before the latest update, for ▲▼

  const byId = new Map((matches ?? []).map((m) => [m.id, m]));
  const betsRef = useRef<FootballBet[]>([]);
  useEffect(() => {
    betsRef.current = w.bets;
  }, [w.bets]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/casino/odds", { cache: "no-store" });
      const data = (await res.json()) as { matches: OddsMatch[]; finished: MatchResult[]; error?: string };
      // remember previous prices so we can show which way they moved
      const before = new Map<string, number>();
      for (const m of data.matches) {
        for (const p of PICKS) {
          const k = `${m.id}:${p}`;
          const prev = prevOdds.current.get(k);
          if (prev != null && Math.abs(prev - m.odds[p]) >= 0.005) before.set(k, prev);
          prevOdds.current.set(k, m.odds[p]);
        }
      }
      setMoves(before);
      setMatches(data.matches);
      setFetchedAt(Date.now());
      setErr(data.error ?? null);

      // settle: live matches (early payouts) + finished ones in the feed
      const results: MatchResult[] = [...data.matches.map((m) => ({ id: m.id, status: m.status, score: m.score })), ...data.finished];
      // any open legs on matches outside the feed (older days)? look those days up too
      const known = new Set(results.map((r) => r.id));
      const days = [...new Set(betsRef.current.flatMap((b) => (b.status === "open" ? b.legs.filter((l) => l.status === "open" && !known.has(l.matchId)).map((l) => l.day) : [])))];
      for (const day of days) {
        try {
          const r = await fetch(`/api/matches?day=${day}`, { cache: "no-store" });
          results.push(...((await r.json()) as { data: MatchResult[] }).data);
        } catch {}
      }
      const notes = settleFootballBets(results);
      if (notes.length) setToast(notes.join(" · "));
    } catch {
      setErr("Couldn't load matches. Retrying…");
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(null), 4000);
    return () => clearTimeout(t);
  }, [confirm]);

  function toggle(m: OddsMatch, pick: Pick) {
    if (!m.open) return;
    setSlip((s) => {
      const existing = s.find((x) => x.matchId === m.id);
      if (existing?.pick === pick) return s.filter((x) => x.matchId !== m.id); // tap again to remove
      if (!existing && s.length >= MAX_LEGS) {
        setToast(`Max ${MAX_LEGS} selections per bet`);
        return s;
      }
      const sel = { matchId: m.id, pick, addedOdds: m.odds[pick] };
      return existing ? s.map((x) => (x.matchId === m.id ? sel : x)) : [...s, sel];
    });
  }

  // Slip lines with the latest prices
  const lines = slip.map((s) => ({ s, m: byId.get(s.matchId) })).filter((x): x is { s: Selection; m: OddsMatch } => !!x.m);
  const blocked = lines.find((x) => x.m.suspended || !x.m.open);
  const changed = lines.some((x) => Math.abs(x.m.odds[x.s.pick] - x.s.addedOdds) >= 0.005);
  const slipOdds = combinedOdds(lines.map((x) => ({ odds: x.m.odds[x.s.pick] })));

  function place() {
    if (!lines.length || blocked) return;
    if (changed) {
      // accept the new prices first
      setSlip(lines.map((x) => ({ ...x.s, addedOdds: x.m.odds[x.s.pick] })));
      setToast("Odds updated. Check the new price and place again.");
      return;
    }
    const legs: Omit<Leg, "status">[] = lines.map(({ s, m }) => ({
      matchId: m.id,
      day: m.day,
      home: m.home,
      away: m.away,
      pick: s.pick,
      odds: m.odds[s.pick],
      liveAt: m.minute != null ? `${m.status === "PAUSED" ? "HT" : `${m.minute}'`} ${m.score.home}-${m.score.away}` : null,
    }));
    const ok = placeFootballBet(legs, amount);
    setToast(ok ? (legs.length > 1 ? `${legs.length}-fold acca placed. Good luck!` : "Bet placed. Good luck!") : "Not enough tokens.");
    if (ok) setSlip([]);
  }

  // Fair probability of a pick right now. For running matches the clock keeps moving between
  // updates, so the chance (and the cash-out value) is recalculated every second.
  const liveProb = (m: OddsMatch, pick: Pick) => {
    if (m.exactMinute == null || !m.clockRunning) return m.probs[pick];
    const minute = Math.min(93, m.exactMinute + Math.max(0, now - fetchedAt) / 60000);
    return inPlayProbs(m.model.lambdaHome, m.model.lambdaAway, minute, m.score.home ?? 0, m.score.away ?? 0, m.reds.home, m.reds.away)[pick];
  };
  const liveOdds = (m: OddsMatch, pick: Pick) => Math.min(51, Math.max(1.01, Math.round((1 / (liveProb(m, pick) * MARGIN)) * 100) / 100));

  // Current fair probability for each open leg's pick (null = no live price / suspended)
  const probsFor = (b: FootballBet) =>
    new Map(
      b.legs.map((l) => {
        const m = byId.get(l.matchId);
        return [l.matchId, m && !m.suspended ? liveProb(m, l.pick) : null];
      }),
    );

  function doCashOut(b: FootballBet) {
    const value = cashOutValue(b, probsFor(b));
    if (value == null) return;
    if (confirm !== b.id) {
      setConfirm(b.id);
      return;
    }
    setConfirm(null);
    if (cashOut(b.id, value)) setToast(`Cashed out ${value.toFixed(2)} tokens`);
  }

  const shown = ready ? w.bets.filter((b) => (tab === "open" ? b.status === "open" : b.status !== "open")) : [];
  const openCount = ready ? w.bets.filter((b) => b.status === "open").length : 0;

  return (
    <div>
      <TokenBar title="Football Bets" />

      {toast && <div className="fixed left-1/2 top-20 z-50 max-w-[90vw] -translate-x-1/2 rounded-2xl bg-volt px-5 py-2.5 text-center text-sm font-bold text-night shadow-xl animate-rise">{toast}</div>}

      <div className="mb-4 flex flex-wrap gap-2 text-xs text-mist">
        <span className="rounded-full border border-line px-3 py-1">🔗 Add several picks for an accumulator</span>
        <span className="rounded-full border border-line px-3 py-1">⚡ {EARLY_PAYOUT_LEAD} goals up = early payout</span>
        <span className="rounded-full border border-line px-3 py-1">💸 Live cash out, updated every second</span>
        <span className="rounded-full border border-line px-3 py-1">⏸ Markets pause after goals, penalties &amp; red cards</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        {/* Matches */}
        <section>
          {err && <div className="card mb-4 p-4 text-sm text-mist">{err}</div>}
          {!matches && <div className="card h-64 animate-pulse" />}
          {matches && !matches.length && <div className="card p-8 text-center text-mist">No matches to bet on today or tomorrow. Try again later!</div>}
          <div className="space-y-3">
            {matches?.map((m) => {
              const live = m.minute != null;
              return (
                <article key={m.id} className={clsx("card relative overflow-hidden p-4", m.suspended && "border-amber-400/40")}>
                  <div className="mb-3 flex items-center justify-between gap-2 text-xs text-mist">
                    <span className="truncate">{m.competition}</span>
                    {live ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 font-bold text-live">
                        <span className="size-1.5 animate-pulse-live rounded-full bg-live" />
                        {m.status === "PAUSED" ? "HT" : `${m.minute}'`} · {m.score.home}–{m.score.away}
                        {m.reds.home + m.reds.away > 0 && (
                          <span className="ml-1 text-chalk">
                            {m.reds.home > 0 && `🟥${m.home.slice(0, 3)}`} {m.reds.away > 0 && `🟥${m.away.slice(0, 3)}`}
                          </span>
                        )}
                      </span>
                    ) : (
                      <LocalTime iso={m.utcDate} mode="datetime" />
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {PICKS.map((p) => {
                      const sel = slip.some((x) => x.matchId === m.id && x.pick === p);
                      const k = `${m.id}:${p}`;
                      return (
                        <button
                          key={p}
                          disabled={!m.open}
                          onClick={() => toggle(m, p)}
                          className={clsx("flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 transition disabled:cursor-not-allowed disabled:opacity-40", sel ? "border-volt bg-volt text-night" : "border-line hover:border-volt/50")}
                        >
                          <span className="flex max-w-full items-center gap-1.5 text-xs font-semibold">
                            {p !== "draw" && <TeamCrest team={p === "home" ? m.homeTeam : m.awayTeam} size={16} />}
                            <span className="truncate">{pickLabel(m, p)}</span>
                          </span>
                          <span className="font-display text-xl tabular">
                            {m.suspended ? "–" : m.odds[p].toFixed(2)}
                            {!m.suspended && moves.has(k) && <Arrow from={moves.get(k)!} to={m.odds[p]} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {m.suspended && (
                    <div className="absolute inset-0 grid place-items-center bg-night/70 backdrop-blur-[2px]">
                      <div className="rounded-xl border border-amber-400/50 bg-amber-400/10 px-4 py-2 text-center">
                        <div className="font-display text-xl tracking-wider text-amber-300">⏸ SUSPENDED</div>
                        <div className="text-xs font-semibold text-amber-200">{m.reason === "Goal" ? "⚽ Goal!" : m.reason === "Penalty" ? "🎯 Penalty!" : m.reason === "Red card" ? "🟥 Red card!" : "Odds updating"} Markets reopen shortly.</div>
                      </div>
                    </div>
                  )}
                  {!m.suspended && !m.open && <p className="mt-2 text-center text-xs text-mist">New bets closed for the final minutes. Cash out is still open.</p>}
                </article>
              );
            })}
          </div>
        </section>

        {/* Slip + bets */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div className="font-display text-xl tracking-wide">BET SLIP</div>
              {lines.length > 0 && (
                <span className="rounded-full bg-volt/15 px-2.5 py-0.5 text-xs font-bold text-volt">{lines.length === 1 ? "Single" : `${lines.length}-fold acca`}</span>
              )}
            </div>
            {lines.length ? (
              <>
                <div className="mt-3 space-y-2">
                  {lines.map(({ s, m }) => (
                    <div key={m.id} className={clsx("rounded-xl p-3 text-sm", m.suspended ? "bg-amber-400/10" : "bg-white/[0.04]")}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-bold">{pickLabel(m, s.pick)}</div>
                          <div className="truncate text-xs text-mist">
                            {m.home} v {m.away}
                            {m.minute != null && ` · ${m.status === "PAUSED" ? "HT" : `${m.minute}'`} ${m.score.home}-${m.score.away}`}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-bold text-volt">
                            {m.suspended ? "SUSP" : m.odds[s.pick].toFixed(2)}
                            {!m.suspended && <Arrow from={s.addedOdds} to={m.odds[s.pick]} />}
                          </div>
                          <button onClick={() => setSlip((x) => x.filter((y) => y.matchId !== m.id))} className="text-[11px] text-mist hover:text-loss">
                            remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-mist">{lines.length > 1 ? "Combined odds" : "Odds"}</span>
                  <b className="font-display text-xl text-volt">{slipOdds.toFixed(2)}</b>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {STAKES.map((v) => (
                    <button key={v} onClick={() => setAmount(v)} className="chip" data-active={amount === v}>
                      {v}
                    </button>
                  ))}
                </div>
                <div className="mt-3 text-sm text-mist">
                  Potential return: <b className="text-volt">{fmt(Math.round(amount * slipOdds))}</b>
                </div>
                <button
                  onClick={place}
                  disabled={!!blocked || amount > w.balance}
                  className={clsx("mt-4 w-full rounded-xl py-3 font-display text-xl tracking-wider text-night disabled:opacity-40", changed ? "bg-amber-300" : "bg-volt")}
                >
                  {blocked ? (blocked.m.suspended ? "SUSPENDED…" : "SELECTION CLOSED") : changed ? "ACCEPT NEW ODDS" : `PLACE BET · ${amount}`}
                </button>
                <button onClick={() => setSlip([])} className="mt-2 w-full text-xs text-mist hover:text-chalk">
                  Clear slip
                </button>
              </>
            ) : (
              <p className="mt-2 text-sm text-mist">Tap a price to add it. Add picks from different matches to build an accumulator.</p>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="flex border-b border-line">
              {(["open", "settled"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={clsx("flex-1 py-3 text-sm font-bold capitalize", tab === t ? "text-volt" : "text-mist")}>
                  {t} bets {t === "open" && openCount > 0 && `(${openCount})`}
                </button>
              ))}
            </div>
            {shown.length ? (
              shown.slice(0, 25).map((b) => {
                const value = b.status === "open" ? cashOutValue(b, probsFor(b)) : null;
                const anySusp = b.legs.some((l) => l.status === "open" && byId.get(l.matchId)?.suspended);
                return (
                  <div key={b.id} className="border-b border-line p-4 text-sm last:border-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{b.legs.length === 1 ? "Single" : `${b.legs.length}-fold accumulator`}</span>
                      <StatusBadge b={b} />
                    </div>
                    <div className="mt-0.5 text-xs text-mist">
                      {b.stake} @ {b.odds.toFixed(2)} · returns {fmt(Math.round(b.stake * b.odds))}
                    </div>

                    <div className="mt-2 space-y-1.5">
                      {b.legs.map((l, i) => {
                        const m = byId.get(l.matchId);
                        const nowOdds = m && l.status === "open" && !m.suspended ? liveOdds(m, l.pick) : null;
                        return (
                          <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2">
                            <span className="w-4 text-center">{l.status === "won" ? "✅" : l.status === "lost" ? "❌" : l.status === "void" ? "↩️" : m && isLiveStatus(m.status) ? "🟢" : "⏳"}</span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-semibold">
                                {pickLabel(l, l.pick)} {l.early && <span className="ml-1 rounded bg-volt/20 px-1 text-[10px] text-volt">EARLY PAYOUT</span>}
                              </div>
                              <div className="truncate text-[11px] text-mist">
                                {l.home} v {l.away}
                                {l.status !== "open" && l.result && ` · ${l.status === "void" ? l.result : `FT ${l.result}`}`}
                                {l.status === "open" && m && isLiveStatus(m.status) && ` · ${m.status === "PAUSED" ? "HT" : `${m.minute}'`} ${m.score.home}-${m.score.away}`}
                                {l.status === "open" && m?.suspended && " · ⏸ suspended"}
                              </div>
                            </div>
                            <div className="shrink-0 text-right text-[11px] tabular">
                              <div className="font-bold">{l.odds.toFixed(2)}</div>
                              {nowOdds != null && (
                                <div className="text-mist">
                                  now {nowOdds.toFixed(2)}
                                  <Arrow from={l.odds} to={nowOdds} mine />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {b.status === "open" && (
                      <button
                        onClick={() => doCashOut(b)}
                        disabled={value == null}
                        className={clsx(
                          "mt-3 w-full rounded-xl py-2.5 text-sm font-bold transition disabled:opacity-40",
                          confirm === b.id ? "bg-volt text-night" : "border border-volt/50 text-volt hover:bg-volt/10",
                        )}
                      >
                        {value == null ? (
                          anySusp ? "⏸ Cash out suspended" : "Cash out unavailable"
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            {confirm === b.id ? "Tap to confirm ·" : "💸 Cash out"} <LiveAmount value={value} />
                          </span>
                        )}
                      </button>
                    )}
                    {b.status === "cashed" && <div className="mt-2 text-xs text-volt">Cashed out for {fmt(b.payout ?? 0)}</div>}
                  </div>
                );
              })
            ) : (
              <p className="p-4 text-sm text-mist">{tab === "open" ? "No open bets." : "No settled bets yet."}</p>
            )}
          </div>
          <p className="text-xs text-mist">
            Prices come from Kickvolt&apos;s model with a small margin. Scores refresh every 5 seconds and cash-out values move with the match clock every second. Cash out pays {Math.round(CASH_OUT_RATE * 100)}% of a bet&apos;s current value. Early payout applies to picks made before kick-off.
          </p>
        </aside>
      </div>
    </div>
  );
}

function StatusBadge({ b }: { b: FootballBet }) {
  const map: Record<FootballBet["status"], [string, string]> = {
    open: ["open", "bg-sky/15 text-sky"],
    won: [`+${fmt(b.payout ?? 0)}`, "bg-volt/15 text-volt"],
    lost: ["lost", "bg-loss/15 text-loss"],
    void: ["void", "bg-white/10 text-mist"],
    cashed: [`cashed ${fmt(b.payout ?? 0)}`, "bg-volt/10 text-volt"],
  };
  const [text, cls] = map[b.status];
  return <span className={clsx("shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase", cls)}>{text}</span>;
}
