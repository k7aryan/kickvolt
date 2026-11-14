// Tools the AI assistant can call. Each returns compact JSON built from the same data layer the site uses.
import { COMPETITIONS } from "./config";
import { getHeadToHead, getLiveMatches, getMatch, getMatchesRange, getScorers, getStandings, shiftDay, todayKey } from "./data";
import { findOddsForMatch, getOdds } from "./odds";
import { findRow, predict, valueAnalysis } from "./predict";
import type { Match } from "./types";

const codes = COMPETITIONS.map((c) => `${c.code} (${c.name})`).join(", ");

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const TOOLS: ToolDef[] = [
  {
    name: "get_live_scores",
    description: "Matches that are in play right now, with score and minute.",
    parameters: {},
  },
  {
    name: "get_matches",
    description: `Fixtures and results for a date range (max 10 days). Dates are YYYY-MM-DD in UTC. Optional competition code: ${codes}.`,
    parameters: {
      type: "object",
      properties: {
        date_from: { type: "string" },
        date_to: { type: "string" },
        competition: { type: "string" },
        team: { type: "string", description: "Optional team name filter" },
      },
      required: ["date_from"],
    },
  },
  {
    name: "get_standings",
    description: `League table for a competition code: ${codes}.`,
    parameters: { type: "object", properties: { competition: { type: "string" } }, required: ["competition"] },
  },
  {
    name: "get_top_scorers",
    description: "Top scorers for a competition code.",
    parameters: { type: "object", properties: { competition: { type: "string" } }, required: ["competition"] },
  },
  {
    name: "get_match_analysis",
    description: "Everything about one match id: score, table positions, form, head-to-head, model prediction (1X2, xG, over 2.5, BTTS, likely scores) and best bookmaker odds with expected value. Get the id from get_matches first.",
    parameters: { type: "object", properties: { match_id: { type: "number" } }, required: ["match_id"] },
  },
  {
    name: "get_odds",
    description: "Upcoming fixtures in a competition with best bookmaker 1X2 odds, model probabilities and expected value per outcome, sorted by best value.",
    parameters: { type: "object", properties: { competition: { type: "string" } }, required: ["competition"] },
  },
];

const slim = (m: Match) => ({
  id: m.id,
  competition: m.competition.code,
  kickoff_utc: m.utcDate,
  status: m.status,
  minute: m.minute ?? undefined,
  home: m.homeTeam.name,
  away: m.awayTeam.name,
  score: m.score.home != null ? `${m.score.home}-${m.score.away}` : undefined,
});

const pct = (x: number) => Math.round(x * 1000) / 10;

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function runTool(name: string, input: any): Promise<unknown> {
  switch (name) {
    case "get_live_scores": {
      const r = await getLiveMatches();
      return { source: r.source, error: r.error, matches: r.data.map(slim) };
    }
    case "get_matches": {
      const from = input.date_from || todayKey();
      let to = input.date_to || from;
      if (Date.parse(to) - Date.parse(from) > 9 * 86400000) to = shiftDay(from, 9);
      const r = await getMatchesRange(from, to, input.competition?.toUpperCase());
      let ms = r.data;
      if (input.team) {
        const t = String(input.team).toLowerCase();
        ms = ms.filter((m) => [m.homeTeam.name, m.awayTeam.name, m.homeTeam.shortName, m.awayTeam.shortName].some((n) => n.toLowerCase().includes(t)));
      }
      return { source: r.source, error: r.error, count: ms.length, matches: ms.slice(0, 60).map(slim) };
    }
    case "get_standings": {
      const r = await getStandings(String(input.competition).toUpperCase());
      if (!r.data) return { error: r.error ?? "not found" };
      return {
        source: r.source,
        competition: r.data.competition.name,
        season: r.data.season,
        table: r.data.total.map((x) => ({ pos: x.position, team: x.team.name, p: x.playedGames, w: x.won, d: x.draw, l: x.lost, gf: x.goalsFor, ga: x.goalsAgainst, pts: x.points, form: x.form })),
      };
    }
    case "get_top_scorers": {
      const r = await getScorers(String(input.competition).toUpperCase());
      return { source: r.source, error: r.error, scorers: r.data.map((s) => ({ player: s.player.name, team: s.team.name, goals: s.goals, assists: s.assists, penalties: s.penalties })) };
    }
    case "get_match_analysis": {
      const r = await getMatch(Number(input.match_id));
      const m = r.data;
      if (!m) return { error: r.error ?? "match not found" };
      const [table, odds, h2h] = await Promise.all([getStandings(m.competition.code), getOdds(m.competition.code), getHeadToHead(m)]);
      const p = predict(m.homeTeam, m.awayTeam, table.data);
      const ev = findOddsForMatch(odds.data, m);
      const row = (t: Match["homeTeam"]) => {
        const x = findRow(table.data?.total, t);
        return x && { pos: x.position, pts: x.points, p: x.playedGames, gf: x.goalsFor, ga: x.goalsAgainst, form: x.form };
      };
      return {
        source: r.source,
        match: slim(m),
        goals: m.goals,
        table: { home: row(m.homeTeam), away: row(m.awayTeam) },
        head_to_head: h2h.slice(0, 6).map(slim),
        model: {
          home_win: pct(p.home), draw: pct(p.draw), away_win: pct(p.away),
          xg_home: Math.round(p.lambdaHome * 100) / 100, xg_away: Math.round(p.lambdaAway * 100) / 100,
          over_2_5: pct(p.over25), btts: pct(p.btts), likely_scores: p.likelyScores.map((s) => `${s.home}-${s.away} (${pct(s.p)}%)`),
          confidence: p.confidence,
        },
        odds: ev
          ? valueAnalysis(p, ev.bookmakers, m.homeTeam.name, m.awayTeam.name).map((v) => ({ outcome: v.label, best_odds: v.bestOdds, bookmaker: v.bestBook, model_pct: pct(v.model), market_pct: pct(v.market), ev_pct: pct(v.ev) }))
          : (odds.error ?? "no odds found"),
        odds_source: odds.source,
      };
    }
    case "get_odds": {
      const code = String(input.competition).toUpperCase();
      const [odds, table] = await Promise.all([getOdds(code), getStandings(code)]);
      const rows = odds.data
        .filter((e) => Date.parse(e.commenceTime) > Date.now())
        .map((e) => {
          const p = predict(e.homeTeam, e.awayTeam, table.data);
          const v = valueAnalysis(p, e.bookmakers, e.homeTeam, e.awayTeam);
          return { fixture: `${e.homeTeam} v ${e.awayTeam}`, kickoff_utc: e.commenceTime, outcomes: v.map((x) => ({ outcome: x.label, best_odds: x.bestOdds, model_pct: pct(x.model), ev_pct: pct(x.ev) })), best_ev: Math.max(...v.map((x) => x.ev)) };
        })
        .sort((a, b) => b.best_ev - a.best_ev)
        .slice(0, 15);
      return { source: odds.source, error: odds.error, fixtures: rows };
    }
    default:
      return { error: `unknown tool ${name}` };
  }
}
