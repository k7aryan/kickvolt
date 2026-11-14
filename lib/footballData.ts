// Client for https://www.football-data.org (v4). Free key: https://www.football-data.org/client/register
import { env } from "./config";
import type { Match, MatchStatus, Scorer, StandingRow, Standings, Team } from "./types";

const BASE = "https://api.football-data.org/v4";

async function fd<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "X-Auth-Token": env.footballKey },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`football-data.org ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function team(t: any): Team {
  return {
    id: t?.id ?? 0,
    name: t?.name ?? "TBD",
    shortName: t?.shortName ?? t?.name ?? "TBD",
    tla: t?.tla ?? (t?.name ?? "TBD").slice(0, 3).toUpperCase(),
    crest: t?.crest ?? null,
  };
}

function match(m: any): Match {
  const goals = Array.isArray(m.goals)
    ? m.goals.map((g: any) => ({
        minute: g.minute ?? 0,
        side: g.team?.id === m.homeTeam?.id ? "home" : "away",
        scorer: g.scorer?.name ?? null,
      }))
    : undefined;
  const side = (teamId: number) => (teamId === m.homeTeam?.id ? "home" : "away") as "home" | "away";
  const cards = Array.isArray(m.bookings)
    ? m.bookings.filter((b: any) => b.card === "RED" || b.card === "YELLOW_RED" || b.card === "RED_CARD" || b.card === "YELLOW_RED_CARD").map((b: any) => ({ minute: b.minute ?? 0, side: side(b.team?.id) }))
    : undefined;
  const penalties = Array.isArray(m.goals)
    ? m.goals.filter((g: any) => g.type === "PENALTY").map((g: any) => ({ minute: g.minute ?? 0, side: side(g.team?.id), scored: true }))
    : undefined;
  return {
    cards,
    penalties,
    id: m.id,
    competition: { code: m.competition?.code, name: m.competition?.name, emblem: m.competition?.emblem },
    utcDate: m.utcDate,
    status: m.status as MatchStatus,
    minute: typeof m.minute === "number" ? m.minute : m.minute ? Number(m.minute) : null,
    matchday: m.matchday ?? null,
    stage: m.stage ?? null,
    homeTeam: team(m.homeTeam),
    awayTeam: team(m.awayTeam),
    score: {
      home: m.score?.fullTime?.home ?? null,
      away: m.score?.fullTime?.away ?? null,
      halfTimeHome: m.score?.halfTime?.home ?? null,
      halfTimeAway: m.score?.halfTime?.away ?? null,
    },
    goals,
    venue: m.venue ?? null,
  };
}

function rows(table: any[]): StandingRow[] {
  return (table ?? []).map((r: any) => ({
    position: r.position,
    team: team(r.team),
    playedGames: r.playedGames,
    won: r.won,
    draw: r.draw,
    lost: r.lost,
    points: r.points,
    goalsFor: r.goalsFor,
    goalsAgainst: r.goalsAgainst,
    goalDifference: r.goalDifference,
    form: r.form ?? null,
  }));
}

export async function fdMatches(dateFrom: string, dateTo: string, competitions?: string): Promise<Match[]> {
  const q = new URLSearchParams({ dateFrom, dateTo });
  if (competitions) q.set("competitions", competitions);
  const data = await fd<any>(`/matches?${q}`);
  return (data.matches ?? []).map(match);
}

export async function fdMatch(id: number): Promise<Match> {
  return match(await fd<any>(`/matches/${id}`));
}

export async function fdHeadToHead(id: number, limit = 10): Promise<Match[]> {
  const data = await fd<any>(`/matches/${id}/head2head?limit=${limit}`);
  return (data.matches ?? []).map(match);
}

export async function fdStandings(code: string): Promise<Standings> {
  const data = await fd<any>(`/competitions/${code}/standings`);
  const pick = (type: string) => data.standings?.find((s: any) => s.type === type)?.table;
  return {
    competition: { code: data.competition?.code, name: data.competition?.name, emblem: data.competition?.emblem },
    season: data.season?.startDate?.slice(0, 4),
    total: rows(pick("TOTAL") ?? data.standings?.[0]?.table ?? []),
    home: pick("HOME") ? rows(pick("HOME")) : undefined,
    away: pick("AWAY") ? rows(pick("AWAY")) : undefined,
  };
}

export async function fdScorers(code: string, limit = 15): Promise<Scorer[]> {
  const data = await fd<any>(`/competitions/${code}/scorers?limit=${limit}`);
  return (data.scorers ?? []).map((s: any) => ({
    player: { id: s.player?.id, name: s.player?.name, nationality: s.player?.nationality },
    team: team(s.team),
    goals: s.goals ?? 0,
    assists: s.assists ?? null,
    penalties: s.penalties ?? null,
    playedMatches: s.playedMatches ?? null,
  }));
}

export async function fdTeamMatches(teamId: number, limit = 5): Promise<Match[]> {
  const data = await fd<any>(`/teams/${teamId}/matches?status=FINISHED`);
  const all: Match[] = (data.matches ?? []).map(match);
  all.sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  return all.slice(-limit);
}
