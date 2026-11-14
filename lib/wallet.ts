"use client";

// Free-play token wallet. Lives in the visitor's browser (localStorage), so no login is needed.
// Tokens have no cash value: they can't be bought, sold or withdrawn.
import { useSyncExternalStore } from "react";

export const START_TOKENS = 1000;
export const DAILY_BONUS = 500;
const KEY = "kickvolt-wallet-v1";

export type Pick = "home" | "draw" | "away";

export type LegStatus = "open" | "won" | "lost" | "void";

export interface Leg {
  matchId: number;
  day: string; // YYYY-MM-DD the match is on (used to look up the result)
  home: string;
  away: string;
  pick: Pick;
  odds: number;
  liveAt?: string | null; // e.g. "63' 1-0" if picked in-play
  status: LegStatus;
  result?: string;
  early?: boolean; // paid early because the team went 2 goals ahead
}

export interface FootballBet {
  id: string;
  legs: Leg[];
  stake: number;
  odds: number; // combined odds (product of the legs)
  placedAt: string;
  status: "open" | "won" | "lost" | "void" | "cashed";
  payout?: number;
}

/** Early payout: a pre-match pick on a team is paid as a winner once that team leads by this many goals. */
export const EARLY_PAYOUT_LEAD = 2;
/** Cash out pays this share of the bet's fair value (the house keeps the rest). */
export const CASH_OUT_RATE = 0.95;

export interface HistoryItem {
  t: string;
  game: string;
  delta: number;
  note: string;
}

export interface Wallet {
  balance: number;
  lastBonus: string | null;
  ageOk: boolean;
  bets: FootballBet[];
  history: HistoryItem[];
  wagered: number;
  won: number;
}

const fresh = (): Wallet => ({ balance: START_TOKENS, lastBonus: null, ageOk: false, bets: [], history: [], wagered: 0, won: 0 });
const SERVER_SNAPSHOT: Wallet = fresh();

let cache: Wallet | null = null;
const listeners = new Set<() => void>();

/* eslint-disable @typescript-eslint/no-explicit-any */
// Bets saved before accumulators existed had a single match on the bet itself.
function migrateBet(b: any): FootballBet {
  if (Array.isArray(b.legs)) return b;
  const status = b.status as FootballBet["status"];
  return {
    id: b.id,
    legs: [{ matchId: b.matchId, day: b.day, home: b.home, away: b.away, pick: b.pick, odds: b.odds, liveAt: b.liveAt, status: status === "open" ? "open" : (status as LegStatus), result: b.result }],
    stake: b.stake,
    odds: b.odds,
    placedAt: b.placedAt,
    status,
    payout: status === "won" ? Math.round(b.stake * b.odds) : status === "void" ? b.stake : undefined,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function load(): Wallet {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const w = { ...fresh(), ...JSON.parse(raw) } as Wallet;
      w.bets = w.bets.map(migrateBet);
      return w;
    }
  } catch {
    /* storage blocked: play with an in-memory wallet */
  }
  return fresh();
}

function get(): Wallet {
  if (!cache) cache = load();
  return cache;
}

function set(next: Wallet) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = load();
      cb();
    }
  };
  window.addEventListener("storage", onStorage); // keep several tabs in sync
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Current wallet. Re-renders whenever tokens change anywhere on the site. */
export function useWallet(): Wallet {
  return useSyncExternalStore(subscribe, get, () => SERVER_SNAPSHOT);
}

/** True once the page is running in the browser (wallet is real, not the server placeholder). */
export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const log = (w: Wallet, game: string, delta: number, note: string) => [{ t: new Date().toISOString(), game, delta, note }, ...w.history].slice(0, 60);

/** Take a stake. Returns false if there aren't enough tokens. */
export function stake(amount: number, game: string, note: string): boolean {
  const w = get();
  if (amount <= 0 || amount > w.balance) return false;
  set({ ...w, balance: w.balance - amount, wagered: w.wagered + amount, history: log(w, game, -amount, note) });
  return true;
}

/** Pay out winnings (stake included). */
export function payout(amount: number, game: string, note: string) {
  if (amount <= 0) return;
  const w = get();
  set({ ...w, balance: w.balance + amount, won: w.won + amount, history: log(w, game, amount, note) });
}

export const canClaimBonus = (w: Wallet) => w.lastBonus !== today();

export function claimBonus(): boolean {
  const w = get();
  if (!canClaimBonus(w)) return false;
  set({ ...w, balance: w.balance + DAILY_BONUS, lastBonus: today(), history: log(w, "bonus", DAILY_BONUS, "Daily free tokens") });
  return true;
}

export function confirmAge() {
  set({ ...get(), ageOk: true });
}

export const combinedOdds = (legs: { odds: number }[]) => Math.round(legs.reduce((x, l) => x * l.odds, 1) * 100) / 100;

const betLabel = (legs: { home: string; away: string }[]) => (legs.length === 1 ? `${legs[0].home} v ${legs[0].away}` : `${legs.length}-fold accumulator`);

export function placeFootballBet(legs: Omit<Leg, "status">[], amount: number): boolean {
  if (!legs.length || new Set(legs.map((l) => l.matchId)).size !== legs.length) return false;
  if (!stake(amount, "football", betLabel(legs))) return false;
  const w = get();
  const bet: FootballBet = {
    id: Math.random().toString(36).slice(2),
    legs: legs.map((l) => ({ ...l, status: "open" })),
    stake: amount,
    odds: combinedOdds(legs),
    placedAt: new Date().toISOString(),
    status: "open",
  };
  set({ ...w, bets: [bet, ...w.bets].slice(0, 100) });
  return true;
}

export interface MatchResult {
  id: number;
  status: string;
  score: { home: number | null; away: number | null };
}

const outcomeOf = (h: number, a: number): Pick => (h > a ? "home" : h < a ? "away" : "draw");

function updateLeg(l: Leg, m: MatchResult | undefined): Leg {
  if (l.status !== "open" || !m) return l;
  if (["POSTPONED", "CANCELLED", "SUSPENDED"].includes(m.status)) return { ...l, status: "void", result: m.status.toLowerCase() };
  const { home, away } = m.score;
  if (home == null || away == null) return l;
  const live = m.status === "IN_PLAY" || m.status === "PAUSED";
  if (live && l.pick !== "draw" && !l.liveAt) {
    const lead = l.pick === "home" ? home - away : away - home;
    if (lead >= EARLY_PAYOUT_LEAD) return { ...l, status: "won", early: true, result: `${home}-${away}` };
  }
  if (m.status !== "FINISHED") return l;
  return { ...l, status: outcomeOf(home, away) === l.pick ? "won" : "lost", result: `${home}-${away}` };
}

/** Settle legs and bets against the latest scores (incl. early payouts). Returns a short summary of what changed. */
export function settleFootballBets(results: MatchResult[]): string[] {
  const w = get();
  const notes: string[] = [];
  let balance = w.balance;
  let won = w.won;
  let history = w.history;
  let changed = false;
  const bets = w.bets.map((b) => {
    if (b.status !== "open") return b;
    const legs = b.legs.map((l) => updateLeg(l, results.find((r) => r.id === l.matchId)));
    if (legs.every((l, i) => l === b.legs[i])) return b;
    changed = true;
    for (const [i, l] of legs.entries()) if (l.early && !b.legs[i].early) notes.push(`Early payout! ${l.pick === "home" ? l.home : l.away} went ${EARLY_PAYOUT_LEAD} goals up`);
    if (legs.some((l) => l.status === "lost")) {
      notes.push(`${betLabel(legs)} lost`);
      return { ...b, legs, status: "lost" as const };
    }
    if (legs.every((l) => l.status !== "open")) {
      const allVoid = legs.every((l) => l.status === "void");
      const pay = allVoid ? b.stake : Math.round(b.stake * legs.reduce((x, l) => x * (l.status === "won" ? l.odds : 1), 1));
      balance += pay;
      if (!allVoid) won += pay;
      history = [{ t: new Date().toISOString(), game: "football", delta: pay, note: `${allVoid ? "Refund" : "Won"}: ${betLabel(legs)}` }, ...history];
      notes.push(allVoid ? `${betLabel(legs)} refunded` : `${betLabel(legs)} won ${fmt(pay)}!`);
      return { ...b, legs, status: allVoid ? ("void" as const) : ("won" as const), payout: pay };
    }
    return { ...b, legs };
  });
  if (changed) set({ ...w, bets, balance, won, history: history.slice(0, 60) });
  return notes;
}

/**
 * What the bet is worth right now: stake × odds × the current chance every open leg still wins,
 * times the cash-out rate. probs maps matchId → current fair probability of that leg's pick.
 * Returns null if any open leg has no live price (or is suspended).
 */
export function cashOutValue(b: FootballBet, probs: Map<number, number | null>): number | null {
  if (b.status !== "open") return null;
  let p = 1;
  for (const l of b.legs) {
    if (l.status === "won" || l.status === "void") continue;
    if (l.status === "lost") return null;
    const q = probs.get(l.matchId);
    if (q == null) return null;
    p *= q;
  }
  const settledOdds = b.legs.reduce((x, l) => x * (l.status === "won" ? l.odds : 1), 1);
  const openOdds = b.legs.reduce((x, l) => x * (l.status === "open" ? l.odds : 1), 1);
  // to the hundredth of a token, so the value visibly moves with the match clock
  return Math.max(0.01, Math.floor(b.stake * settledOdds * openOdds * p * CASH_OUT_RATE * 100) / 100);
}

export function cashOut(betId: string, amount: number): boolean {
  const w = get();
  const b = w.bets.find((x) => x.id === betId);
  if (!b || b.status !== "open" || amount <= 0) return false;
  set({
    ...w,
    balance: Math.round((w.balance + amount) * 100) / 100,
    won: Math.round((w.won + amount) * 100) / 100,
    bets: w.bets.map((x) => (x.id === betId ? { ...x, status: "cashed" as const, payout: amount } : x)),
    history: [{ t: new Date().toISOString(), game: "football", delta: amount, note: `Cashed out: ${betLabel(b.legs)}` }, ...w.history].slice(0, 60),
  });
  return true;
}

export function fmt(n: number) {
  return n.toLocaleString("en-GB", { maximumFractionDigits: 2 });
}
