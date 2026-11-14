export type MatchStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "POSTPONED"
  | "SUSPENDED"
  | "CANCELLED"
  | "AWARDED";

export interface Team {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest?: string | null;
}

export interface CompetitionRef {
  code: string;
  name: string;
  emblem?: string | null;
}

export interface Goal {
  minute: number;
  side: "home" | "away";
  scorer?: string | null;
}

export interface Match {
  id: number;
  competition: CompetitionRef;
  utcDate: string;
  status: MatchStatus;
  minute?: number | null;
  matchday?: number | null;
  stage?: string | null;
  homeTeam: Team;
  awayTeam: Team;
  score: {
    home: number | null;
    away: number | null;
    halfTimeHome?: number | null;
    halfTimeAway?: number | null;
  };
  goals?: Goal[];
  cards?: MatchEvent[]; // red cards (where the data source provides them)
  penalties?: (MatchEvent & { scored: boolean })[];
  venue?: string | null;
}

export interface MatchEvent {
  minute: number;
  side: "home" | "away";
}

export interface StandingRow {
  position: number;
  team: Team;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form?: string | null; // e.g. "W,D,L,W,W"
}

export interface Standings {
  competition: CompetitionRef;
  season?: string;
  total: StandingRow[];
  home?: StandingRow[];
  away?: StandingRow[];
}

export interface Scorer {
  player: { id: number; name: string; nationality?: string | null };
  team: Team;
  goals: number;
  assists?: number | null;
  penalties?: number | null;
  playedMatches?: number | null;
}

export interface BookmakerOdds {
  bookmaker: string;
  home: number;
  draw: number;
  away: number;
  lastUpdate?: string;
}

export interface OddsEvent {
  id: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  bookmakers: BookmakerOdds[];
}

export interface Prediction {
  lambdaHome: number;
  lambdaAway: number;
  home: number;
  draw: number;
  away: number;
  over25: number;
  btts: number;
  likelyScores: { home: number; away: number; p: number }[];
  confidence: "low" | "medium" | "high";
  notes: string[];
}

export interface Result<T> {
  data: T;
  source: "live" | "demo";
  error?: string;
}
