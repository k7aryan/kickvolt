export interface CompetitionConfig {
  code: string; // football-data.org code
  name: string;
  short: string;
  country: string;
  flag: string;
  color: string; // accent used for badges
  oddsKey?: string; // the-odds-api.com sport key
}

// The 12 competitions on football-data.org's free tier (minus two tournaments
// that only run every few years, which still work via the API if you add them).
export const COMPETITIONS: CompetitionConfig[] = [
  { code: "PL", name: "Premier League", short: "EPL", country: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", color: "#a855f7", oddsKey: "soccer_epl" },
  { code: "CL", name: "Champions League", short: "UCL", country: "Europe", flag: "🇪🇺", color: "#3b82f6", oddsKey: "soccer_uefa_champs_league" },
  { code: "PD", name: "La Liga", short: "LIGA", country: "Spain", flag: "🇪🇸", color: "#f97316", oddsKey: "soccer_spain_la_liga" },
  { code: "BL1", name: "Bundesliga", short: "BUN", country: "Germany", flag: "🇩🇪", color: "#ef4444", oddsKey: "soccer_germany_bundesliga" },
  { code: "SA", name: "Serie A", short: "SA", country: "Italy", flag: "🇮🇹", color: "#06b6d4", oddsKey: "soccer_italy_serie_a" },
  { code: "FL1", name: "Ligue 1", short: "L1", country: "France", flag: "🇫🇷", color: "#eab308", oddsKey: "soccer_france_ligue_one" },
  { code: "ELC", name: "Championship", short: "EFL", country: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", color: "#14b8a6", oddsKey: "soccer_efl_champ" },
  { code: "DED", name: "Eredivisie", short: "ERE", country: "Netherlands", flag: "🇳🇱", color: "#fb923c", oddsKey: "soccer_netherlands_eredivisie" },
  { code: "PPL", name: "Primeira Liga", short: "POR", country: "Portugal", flag: "🇵🇹", color: "#22c55e", oddsKey: "soccer_portugal_primeira_liga" },
  { code: "BSA", name: "Brasileirão", short: "BRA", country: "Brazil", flag: "🇧🇷", color: "#84cc16", oddsKey: "soccer_brazil_campeonato" },
];

export const LEAGUE_CODES = ["PL", "PD", "BL1", "SA", "FL1", "ELC", "DED", "PPL", "BSA"];

export function getCompetition(code?: string | null) {
  return COMPETITIONS.find((c) => c.code === code?.toUpperCase());
}

export const env = {
  footballKey: process.env.FOOTBALL_DATA_API_KEY || "",
  oddsKey: process.env.ODDS_API_KEY || "",
  geminiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  oddsCacheMinutes: Number(process.env.ODDS_CACHE_MINUTES || 360),
  oddsRegion: process.env.ODDS_REGION || "uk",
};

export const isDemoFootball = () => !env.footballKey;
export const isDemoOdds = () => !env.oddsKey;
