// Bookmaker odds from https://the-odds-api.com (free key: 500 credits/month).
// Each call for one league + one region + one market costs 1 credit, so results are cached
// for ODDS_CACHE_MINUTES (default 6 hours) to stay inside the free quota.
import { cached } from "./cache";
import { env, getCompetition, isDemoOdds } from "./config";
import { getMatchesRange, getStandings, todayKey, shiftDay } from "./data";
import { nameSimilarity, predict } from "./predict";
import type { Match, OddsEvent, Result } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function fetchOdds(sportKey: string): Promise<OddsEvent[]> {
  const q = new URLSearchParams({ apiKey: env.oddsKey, regions: env.oddsRegion, markets: "h2h", oddsFormat: "decimal" });
  const res = await fetch(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds?${q}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`the-odds-api ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data: any[] = await res.json();
  return data.map((e) => ({
    id: e.id,
    commenceTime: e.commence_time,
    homeTeam: e.home_team,
    awayTeam: e.away_team,
    bookmakers: (e.bookmakers ?? [])
      .map((b: any) => {
        const outcomes = b.markets?.find((m: any) => m.key === "h2h")?.outcomes ?? [];
        const price = (n: string) => outcomes.find((o: any) => o.name === n)?.price;
        return { bookmaker: b.title, home: price(e.home_team), draw: price("Draw"), away: price(e.away_team), lastUpdate: b.last_update };
      })
      .filter((b: any) => b.home && b.draw && b.away),
  }));
}

// Demo odds: model probabilities + a bookmaker margin + a little noise per book.
async function demoOdds(code: string): Promise<OddsEvent[]> {
  const [fixtures, table] = await Promise.all([getMatchesRange(todayKey(), shiftDay(todayKey(), 3), code), getStandings(code)]);
  return fixtures.data
    .filter((m) => m.status === "TIMED" || m.status === "SCHEDULED")
    .map((m) => {
      const p = predict(m.homeTeam, m.awayTeam, table.data);
      const books = ["Demo Book A", "Demo Book B", "Demo Book C", "Demo Book D"].map((name, i) => {
        const wiggle = (k: number) => 1 + Math.sin(m.id * (i + 1) * (k + 3)) * 0.075;
        const margin = 1.05 + i * 0.012;
        const o = (prob: number, k: number) => Math.max(1.01, Math.round((1 / (prob * margin)) * wiggle(k) * 100) / 100);
        return { bookmaker: name, home: o(p.home, 1), draw: o(p.draw, 2), away: o(p.away, 3) };
      });
      return { id: `demo-${m.id}`, commenceTime: m.utcDate, homeTeam: m.homeTeam.name, awayTeam: m.awayTeam.name, bookmakers: books };
    });
}

export async function getOdds(code: string): Promise<Result<OddsEvent[]>> {
  const comp = getCompetition(code);
  if (isDemoOdds()) return { data: await demoOdds(code), source: "demo" };
  if (!comp?.oddsKey) return { data: [], source: "live", error: "No odds feed for this competition." };
  try {
    return { data: await cached(`odds:${comp.oddsKey}`, env.oddsCacheMinutes * 60, () => fetchOdds(comp.oddsKey!)), source: "live" };
  } catch (e) {
    return { data: [], source: "live", error: e instanceof Error ? e.message : String(e) };
  }
}

export function findOddsForMatch(events: OddsEvent[], m: Match) {
  let best: OddsEvent | undefined;
  let bestScore = 0;
  for (const e of events) {
    const hours = Math.abs(Date.parse(e.commenceTime) - Date.parse(m.utcDate)) / 3600000;
    if (hours > 36) continue;
    const s =
      Math.max(nameSimilarity(e.homeTeam, m.homeTeam.name), nameSimilarity(e.homeTeam, m.homeTeam.shortName)) +
      Math.max(nameSimilarity(e.awayTeam, m.awayTeam.name), nameSimilarity(e.awayTeam, m.awayTeam.shortName));
    if (s > bestScore) {
      bestScore = s;
      best = e;
    }
  }
  return bestScore >= 1 ? best : undefined;
}
