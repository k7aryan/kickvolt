import { connection } from "next/server";
import { getMatchesForDay, getStandings, isLive, shiftDay, todayKey } from "@/lib/data";
import { inPlayProbs, predict } from "@/lib/predict";
import type { Match, Standings } from "@/lib/types";

// Live prices for the free-play football game: the Kickvolt model's probabilities with a 6% margin,
// recalculated from the score, the minute and red cards while a match is in play.
// Markets are suspended for a short time after a goal, a penalty or a red card.
const MARGIN = 1.06;
const SUSPEND_MATCH_MINUTES = 1.5; // when the event minute is known (demo / detailed data)
const SUSPEND_SECONDS = 60; // when we only notice the score changed between updates (free data)

const toOdds = (p: number) => Math.min(51, Math.max(1.01, Math.round((1 / (p * MARGIN)) * 100) / 100));

// Remembers the last score we saw for each match, to spot goals in feeds that don't give event times.
const g = globalThis as unknown as { __kvScores?: Map<number, { score: string; changedAt: number }> };
const seen = (g.__kvScores ??= new Map());

/** football-data's free plan may not send the minute, so estimate it from the kick-off time. */
function liveMinute(m: Match) {
  if (m.status === "PAUSED") return 45;
  if (m.minute) return m.minute;
  const elapsed = (Date.now() - Date.parse(m.utcDate)) / 60000;
  if (elapsed <= 47) return Math.max(1, Math.floor(elapsed));
  if (elapsed < 62) return 45;
  return Math.min(90, Math.floor(elapsed - 15));
}

/** The same clock with seconds included, so the browser can keep the cash-out value ticking. */
function exactMinute(m: Match, whole: number) {
  if (m.status === "PAUSED") return 45;
  const elapsed = (Date.now() - Date.parse(m.utcDate)) / 60000;
  const exact = elapsed <= 47 ? elapsed : elapsed - 15;
  // stay within the displayed minute, adding the seconds part
  return Math.abs(exact - whole) < 1 ? Math.min(93, Math.max(whole, exact)) : whole;
}

function suspension(m: Match, minute: number): { suspended: boolean; reason: string | null } {
  if (!isLive(m)) return { suspended: false, reason: null };
  const recent = (x?: { minute: number }[]) => x?.some((e) => minute - e.minute >= 0 && minute - e.minute < SUSPEND_MATCH_MINUTES);
  if (recent(m.penalties)) return { suspended: true, reason: "Penalty" };
  if (recent(m.cards)) return { suspended: true, reason: "Red card" };
  if (recent(m.goals)) return { suspended: true, reason: "Goal" };

  const score = `${m.score.home}-${m.score.away}`;
  const prev = seen.get(m.id);
  if (!prev) seen.set(m.id, { score, changedAt: 0 });
  else if (prev.score !== score) seen.set(m.id, { score, changedAt: Date.now() });
  const changedAt = seen.get(m.id)!.changedAt;
  if (changedAt && Date.now() - changedAt < SUSPEND_SECONDS * 1000) return { suspended: true, reason: "Goal" };
  return { suspended: false, reason: null };
}

export async function GET() {
  await connection();
  const today = todayKey();
  const [a, b] = await Promise.all([getMatchesForDay(today), getMatchesForDay(shiftDay(today, 1))]);
  const all = [...a.data, ...b.data];
  const matches = all.filter((m) => (m.status === "TIMED" || m.status === "SCHEDULED" || isLive(m)) && m.homeTeam.id && m.awayTeam.id);

  const tables = new Map<string, Standings | null>();
  for (const code of new Set(matches.map((m) => m.competition.code))) {
    tables.set(code, (await getStandings(code)).data);
  }

  const out = matches.map((m) => {
    const pre = predict(m.homeTeam, m.awayTeam, tables.get(m.competition.code));
    const live = isLive(m);
    const minute = live ? liveMinute(m) : null;
    const redHome = m.cards?.filter((c) => c.side === "home").length ?? 0;
    const redAway = m.cards?.filter((c) => c.side === "away").length ?? 0;
    const p = live ? inPlayProbs(pre.lambdaHome, pre.lambdaAway, minute!, m.score.home ?? 0, m.score.away ?? 0, redHome, redAway) : { home: pre.home, draw: pre.draw, away: pre.away };
    const { suspended, reason } = suspension(m, minute ?? 0);
    // New bets close in the last few minutes, when the result is almost decided (cash out stays open).
    const open = !suspended && (!live || (minute ?? 0) < 85);
    return {
      id: m.id,
      day: m.utcDate.slice(0, 10),
      utcDate: m.utcDate,
      competition: m.competition.name,
      home: m.homeTeam.shortName,
      away: m.awayTeam.shortName,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      status: m.status,
      minute,
      score: m.score,
      reds: { home: redHome, away: redAway },
      // for the live cash-out clock: pre-match scoring rates and the exact minute (with seconds)
      model: { lambdaHome: pre.lambdaHome, lambdaAway: pre.lambdaAway },
      exactMinute: live ? exactMinute(m, minute!) : null,
      clockRunning: m.status === "IN_PLAY",
      open,
      suspended,
      reason,
      probs: p,
      odds: { home: toOdds(p.home), draw: toOdds(p.draw), away: toOdds(p.away) },
    };
  });

  // Recently finished matches too, so open bets can show their final score straight away.
  const finished = all
    .filter((m) => m.status === "FINISHED")
    .map((m) => ({ id: m.id, status: m.status, score: m.score }));

  out.sort((x, y) => Number(y.minute != null) - Number(x.minute != null) || x.utcDate.localeCompare(y.utcDate));
  return Response.json({ source: a.source, error: a.error ?? b.error, matches: out, finished, serverTime: Date.now() });
}
