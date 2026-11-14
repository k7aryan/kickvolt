// One place the UI and the chatbot get football data from.
// Uses football-data.org when FOOTBALL_DATA_API_KEY is set, otherwise demo data.
import { cached } from "./cache";
import { isDemoFootball, LEAGUE_CODES } from "./config";
import { demoHeadToHead, demoMatch, demoMatches, demoMatchesForDay, demoStandings, dayKey, DEMO_CODES } from "./demo";
import { fdHeadToHead, fdMatch, fdMatches, fdScorers, fdStandings, fdTeamMatches } from "./footballData";
import type { Match, Result, Scorer, Standings } from "./types";

const DAY = 86400000;
/** Current time (request time when called after connection()). */
export const nowMs = () => Date.now();
export const todayKey = () => dayKey(new Date());
export const shiftDay = (key: string, days: number) => dayKey(new Date(Date.parse(key + "T00:00:00Z") + days * DAY));

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const isLive = (m: Match) => m.status === "IN_PLAY" || m.status === "PAUSED";

export function sortMatches(ms: Match[]) {
  const rank = (m: Match) => (isLive(m) ? 0 : m.status === "FINISHED" ? 2 : 1);
  return [...ms].sort((a, b) => rank(a) - rank(b) || a.utcDate.localeCompare(b.utcDate));
}

export async function getMatchesForDay(key: string, competition?: string): Promise<Result<Match[]>> {
  if (isDemoFootball()) {
    const all = demoMatchesForDay(key);
    return { data: competition ? all.filter((m) => m.competition.code === competition) : all, source: "demo" };
  }
  try {
    const ttl = key === todayKey() ? 30 : 600;
    const all = await cached(`day:${key}`, ttl, () => fdMatches(key, shiftDay(key, 1)));
    const day = all.filter((m) => m.utcDate.startsWith(key));
    return { data: competition ? day.filter((m) => m.competition.code === competition) : day, source: "live" };
  } catch (e) {
    return { data: [], source: "live", error: msg(e) };
  }
}

export async function getMatchesRange(dateFrom: string, dateTo: string, competition?: string): Promise<Result<Match[]>> {
  if (isDemoFootball()) {
    const all = demoMatches(dateFrom, dateTo);
    return { data: competition ? all.filter((m) => m.competition.code === competition) : all, source: "demo" };
  }
  try {
    const all = await cached(`range:${dateFrom}:${dateTo}:${competition ?? ""}`, 120, () => fdMatches(dateFrom, dateTo, competition));
    return { data: all, source: "live" };
  } catch (e) {
    return { data: [], source: "live", error: msg(e) };
  }
}

export async function getLiveMatches(): Promise<Result<Match[]>> {
  const today = await getMatchesForDay(todayKey());
  return { ...today, data: today.data.filter(isLive) };
}

export async function getMatch(id: number): Promise<Result<Match | null>> {
  if (isDemoFootball()) return { data: demoMatch(id), source: "demo" };
  try {
    return { data: await cached(`match:${id}`, 30, () => fdMatch(id)), source: "live" };
  } catch (e) {
    return { data: null, source: "live", error: msg(e) };
  }
}

export async function getHeadToHead(m: Match): Promise<Match[]> {
  if (isDemoFootball()) return demoHeadToHead(m);
  try {
    return await cached(`h2h:${m.id}`, 3600, () => fdHeadToHead(m.id));
  } catch {
    return [];
  }
}

export async function getStandings(code: string): Promise<Result<Standings | null>> {
  if (isDemoFootball()) return { data: demoStandings(code), source: "demo" };
  try {
    return { data: await cached(`table:${code}`, 600, () => fdStandings(code)), source: "live" };
  } catch (e) {
    return { data: null, source: "live", error: msg(e) };
  }
}

export async function getScorers(code: string): Promise<Result<Scorer[]>> {
  if (isDemoFootball()) return { data: [], source: "demo", error: "Top scorers need a football-data.org API key." };
  try {
    return { data: await cached(`scorers:${code}`, 1800, () => fdScorers(code)), source: "live" };
  } catch (e) {
    return { data: [], source: "live", error: msg(e) };
  }
}

export async function getRecentForm(teamId: number): Promise<Match[]> {
  if (isDemoFootball()) return [];
  try {
    return await cached(`form:${teamId}`, 3600, () => fdTeamMatches(teamId, 5));
  } catch {
    return [];
  }
}

export const availableTableCodes = () => (isDemoFootball() ? DEMO_CODES : ["CL", ...LEAGUE_CODES]);
