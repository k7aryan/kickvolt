// Demo data so the app works before you add API keys.
// Everything is generated from a seed, so it is stable between reloads, and today's
// fixtures play out in real time (one kick-off every hour) so the live view always has action.
import type { Match, MatchStatus, Standings, StandingRow, Team } from "./types";

const DEMO_LEAGUES: Record<string, { name: string; teams: string[]; played: number }> = {
  PL: {
    name: "Premier League",
    played: 12,
    teams: ["Arsenal", "Manchester City", "Liverpool", "Chelsea", "Newcastle United", "Aston Villa", "Tottenham Hotspur", "Manchester United", "Brighton & Hove Albion", "Crystal Palace", "Nottingham Forest", "Bournemouth", "Brentford", "Fulham", "Everton", "West Ham United", "Leeds United", "Sunderland", "Wolverhampton Wanderers", "Burnley"],
  },
  PD: {
    name: "La Liga",
    played: 12,
    teams: ["Real Madrid", "Barcelona", "Atlético Madrid", "Villarreal", "Athletic Club", "Real Betis", "Real Sociedad", "Sevilla", "Girona", "Celta Vigo", "Osasuna", "Valencia", "Rayo Vallecano", "Getafe", "Mallorca", "Espanyol", "Alavés", "Levante", "Elche", "Real Oviedo"],
  },
  BL1: {
    name: "Bundesliga",
    played: 11,
    teams: ["Bayern Munich", "Borussia Dortmund", "Bayer Leverkusen", "RB Leipzig", "VfB Stuttgart", "Eintracht Frankfurt", "SC Freiburg", "VfL Wolfsburg", "Borussia Mönchengladbach", "Mainz 05", "Werder Bremen", "Union Berlin", "Hoffenheim", "Augsburg", "Hamburger SV", "1. FC Köln", "St. Pauli", "Heidenheim"],
  },
  SA: {
    name: "Serie A",
    played: 12,
    teams: ["Inter", "Napoli", "AC Milan", "Juventus", "Atalanta", "Roma", "Como", "Lazio", "Bologna", "Fiorentina", "Torino", "Udinese", "Genoa", "Cagliari", "Parma", "Sassuolo", "Lecce", "Verona", "Cremonese", "Pisa"],
  },
  FL1: {
    name: "Ligue 1",
    played: 12,
    teams: ["Paris Saint-Germain", "Marseille", "Monaco", "Lille", "Lyon", "Lens", "Strasbourg", "Nice", "Rennes", "Toulouse", "Brest", "Nantes", "Auxerre", "Le Havre", "Angers", "Lorient", "Metz", "Paris FC"],
  },
  CL: {
    name: "Champions League",
    played: 5,
    teams: ["Real Madrid", "Bayern Munich", "Paris Saint-Germain", "Arsenal", "Liverpool", "Barcelona", "Manchester City", "Inter", "Chelsea", "Atlético Madrid", "Borussia Dortmund", "Bayer Leverkusen", "Napoli", "Juventus", "Benfica", "Sporting CP"],
  },
};

export const DEMO_CODES = Object.keys(DEMO_LEAGUES);

const SHORT: Record<string, string> = {
  "Wolverhampton Wanderers": "Wolves",
  "Tottenham Hotspur": "Spurs",
  "Paris Saint-Germain": "PSG",
  "Borussia Mönchengladbach": "Gladbach",
  "Nottingham Forest": "Forest",
  "Manchester United": "Man United",
  "Manchester City": "Man City",
  "Newcastle United": "Newcastle",
  "West Ham United": "West Ham",
  "Bayer Leverkusen": "Leverkusen",
  "Borussia Dortmund": "Dortmund",
  "Atlético Madrid": "Atlético",
  "Eintracht Frankfurt": "Frankfurt",
  "Brighton & Hove Albion": "Brighton",
};

// ---------- seeded randomness ----------
function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function poisson(lambda: number, r: () => number) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > L);
  return k - 1;
}
function shuffle<T>(arr: T[], r: () => number) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- teams ----------
function tla(name: string) {
  const words = name.replace(/&/g, "").split(/[\s-]+/).filter((w) => w && !["FC", "AC", "SC", "VfL", "VfB", "RB", "1.", "de", "CP"].includes(w));
  if (words.length >= 2) return (words[0][0] + words[words.length - 1].slice(0, 2)).toUpperCase();
  return (words[0] ?? name).slice(0, 3).toUpperCase();
}
export function demoTeam(name: string): Team {
  return { id: (hash(name) % 90000) + 10000, name, shortName: SHORT[name] ?? name, tla: tla(name), crest: null };
}
function strength(code: string, name: string) {
  const teams = DEMO_LEAGUES[code].teams;
  const idx = teams.indexOf(name);
  const r = rng("str" + code + name);
  return Math.max(0.05, 1 - (idx / teams.length) * 0.8 + (r() - 0.5) * 0.12);
}

// ---------- dates ----------
const DAY = 86400000;
export const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const dayIndexOf = (key: string) => Math.floor(Date.parse(key + "T00:00:00Z") / DAY);

const OTHER_DAY_TIMES = ["11:30", "12:30", "14:00", "14:00", "15:00", "15:00", "16:30", "17:30", "18:45", "19:00", "20:00", "20:00"];

// ---------- matches ----------
function buildMatch(key: string, slot: number, now: number): Match {
  const today = key === dayKey(new Date(now));
  const dayIdx = dayIndexOf(key);
  const code = DEMO_CODES[(dayIdx + slot) % DEMO_CODES.length];
  const league = DEMO_LEAGUES[code];

  // Each competition gets a fresh shuffle each day; its slots take successive pairs.
  const slotsForComp: number[] = [];
  const totalSlots = today ? 24 : OTHER_DAY_TIMES.length;
  for (let s = 0; s < totalSlots; s++) if (DEMO_CODES[(dayIdx + s) % DEMO_CODES.length] === code) slotsForComp.push(s);
  const pairIdx = slotsForComp.indexOf(slot);
  const order = shuffle(league.teams, rng(`order${code}${key}`));
  const homeName = order[(pairIdx * 2) % order.length];
  const awayName = order[(pairIdx * 2 + 1) % order.length];

  const time = today ? `${String(slot).padStart(2, "0")}:00` : OTHER_DAY_TIMES[slot];
  const kickoff = Date.parse(`${key}T${time}:00Z`);

  const r = rng(`match${key}${slot}`);
  const sh = strength(code, homeName);
  const sa = strength(code, awayName);
  const lh = 1.35 * Math.pow((sh + 0.15) / (sa + 0.15), 0.85) * 1.08;
  const la = 1.15 * Math.pow((sa + 0.15) / (sh + 0.15), 0.85) * 0.92;
  const hg = poisson(lh, r);
  const ag = poisson(la, r);
  const goals = [
    ...Array.from({ length: hg }, () => ({ minute: 1 + Math.floor(r() * 90), side: "home" as const })),
    ...Array.from({ length: ag }, () => ({ minute: 1 + Math.floor(r() * 90), side: "away" as const })),
  ].sort((a, b) => a.minute - b.minute);

  // Demo-only extras: occasional red cards and penalties, so suspended markets can be seen in action.
  const e = rng(`events${key}${slot}`);
  const cards: { minute: number; side: "home" | "away" }[] = [];
  const penalties: { minute: number; side: "home" | "away"; scored: boolean }[] = [];
  if (e() < 0.2) cards.push({ minute: 15 + Math.floor(e() * 70), side: e() < 0.5 ? "home" : "away" });
  if (e() < 0.25) {
    const pen = { minute: 10 + Math.floor(e() * 78), side: (e() < 0.5 ? "home" : "away") as "home" | "away", scored: e() < 0.76 };
    penalties.push(pen);
    if (pen.scored) {
      goals.push({ minute: pen.minute, side: pen.side });
      goals.sort((x, y) => x.minute - y.minute);
    }
  }

  const elapsed = (now - kickoff) / 60000;
  let status: MatchStatus = "TIMED";
  let minute: number | null = null;
  if (elapsed >= 0 && elapsed < 45) {
    status = "IN_PLAY";
    minute = Math.max(1, Math.floor(elapsed));
  } else if (elapsed >= 45 && elapsed < 60) {
    status = "PAUSED";
    minute = 45;
  } else if (elapsed >= 60 && elapsed < 108) {
    status = "IN_PLAY";
    minute = Math.min(90, Math.floor(elapsed - 15));
  } else if (elapsed >= 108) {
    status = "FINISHED";
  }

  const visible = status === "FINISHED" ? goals : minute != null ? goals.filter((g) => g.minute <= minute!) : [];
  const started = status !== "TIMED";
  const ht = goals.filter((g) => g.minute <= 45);

  return {
    id: dayIdx * 100 + slot,
    competition: { code, name: league.name, emblem: null },
    utcDate: new Date(kickoff).toISOString(),
    status,
    minute,
    matchday: league.played + 1 + Math.floor((dayIdx % 7) / 3),
    stage: code === "CL" ? "LEAGUE_STAGE" : "REGULAR_SEASON",
    homeTeam: demoTeam(homeName),
    awayTeam: demoTeam(awayName),
    score: {
      home: started ? visible.filter((g) => g.side === "home").length : null,
      away: started ? visible.filter((g) => g.side === "away").length : null,
      halfTimeHome: elapsed >= 45 ? ht.filter((g) => g.side === "home").length : null,
      halfTimeAway: elapsed >= 45 ? ht.filter((g) => g.side === "away").length : null,
    },
    goals: visible.map((g) => ({ ...g, scorer: null })),
    cards: status === "FINISHED" ? cards : minute != null ? cards.filter((c) => c.minute <= minute!) : [],
    penalties: status === "FINISHED" ? penalties : minute != null ? penalties.filter((p) => p.minute <= minute!) : [],
    venue: `${SHORT[homeName] ?? homeName} Stadium`,
  };
}

export function demoMatchesForDay(key: string, now = Date.now()): Match[] {
  const slots = key === dayKey(new Date(now)) ? 24 : OTHER_DAY_TIMES.length;
  return Array.from({ length: slots }, (_, s) => buildMatch(key, s, now));
}

export function demoMatches(dateFrom: string, dateTo: string, now = Date.now()): Match[] {
  const out: Match[] = [];
  for (let t = Date.parse(dateFrom + "T00:00:00Z"); t <= Date.parse(dateTo + "T00:00:00Z"); t += DAY) {
    out.push(...demoMatchesForDay(dayKey(new Date(t)), now));
  }
  return out;
}

export function demoMatch(id: number, now = Date.now()): Match | null {
  const dayIdx = Math.floor(id / 100);
  const slot = id % 100;
  const key = dayKey(new Date(dayIdx * DAY));
  const max = key === dayKey(new Date(now)) ? 24 : OTHER_DAY_TIMES.length;
  if (slot >= max) return null;
  return buildMatch(key, slot, now);
}

// ---------- standings ----------
export function demoStandings(code: string): Standings | null {
  const league = DEMO_LEAGUES[code];
  if (!league) return null;
  const total: StandingRow[] = [];
  const home: StandingRow[] = [];
  const away: StandingRow[] = [];

  for (const name of league.teams) {
    const r = rng("table" + code + name);
    const s = strength(code, name);
    const P = league.played;
    const mk = (played: number, boost: number): StandingRow => {
      const ppg = Math.min(2.8, Math.max(0.3, 0.55 + s * 1.95 + boost + (r() - 0.5) * 0.45));
      const draw = Math.round(played * (0.18 + r() * 0.17));
      const won = Math.max(0, Math.min(played - draw, Math.round((ppg * played - draw) / 3)));
      const lost = played - won - draw;
      const gf = Math.max(1, Math.round(played * (0.75 + s * 1.55 + boost + (r() - 0.5) * 0.4)));
      const ga = Math.max(1, Math.round(played * (1.95 - s * 1.25 - boost + (r() - 0.5) * 0.4)));
      return { position: 0, team: demoTeam(name), playedGames: played, won, draw, lost, points: won * 3 + draw, goalsFor: gf, goalsAgainst: ga, goalDifference: gf - ga, form: null };
    };
    const h = mk(Math.ceil(P / 2), 0.12);
    const a = mk(Math.floor(P / 2), -0.12);
    const form = Array.from({ length: 5 }, () => {
      const x = r();
      return x < 0.25 + s * 0.45 ? "W" : x < 0.5 + s * 0.3 ? "D" : "L";
    }).join(",");
    total.push({
      position: 0,
      team: demoTeam(name),
      playedGames: h.playedGames + a.playedGames,
      won: h.won + a.won,
      draw: h.draw + a.draw,
      lost: h.lost + a.lost,
      points: h.points + a.points,
      goalsFor: h.goalsFor + a.goalsFor,
      goalsAgainst: h.goalsAgainst + a.goalsAgainst,
      goalDifference: h.goalDifference + a.goalDifference,
      form,
    });
    home.push(h);
    away.push(a);
  }
  const sort = (t: StandingRow[]) => {
    t.sort((x, y) => y.points - x.points || y.goalDifference - x.goalDifference || y.goalsFor - x.goalsFor);
    t.forEach((row, i) => (row.position = i + 1));
    return t;
  };
  return { competition: { code, name: league.name, emblem: null }, season: "Demo", total: sort(total), home: sort(home), away: sort(away) };
}

// ---------- head to head ----------
export function demoHeadToHead(m: Match): Match[] {
  const r = rng(`h2h${[m.homeTeam.name, m.awayTeam.name].sort().join()}`);
  const now = Date.parse(m.utcDate);
  return Array.from({ length: 6 }, (_, i) => {
    const flip = r() > 0.5;
    const ht = flip ? m.awayTeam : m.homeTeam;
    const at = flip ? m.homeTeam : m.awayTeam;
    const hg = poisson(1.4, r);
    const ag = poisson(1.1, r);
    return {
      id: m.id * 10 + i,
      competition: m.competition,
      utcDate: new Date(now - (i + 1) * (150 + Math.floor(r() * 60)) * DAY).toISOString(),
      status: "FINISHED" as MatchStatus,
      homeTeam: ht,
      awayTeam: at,
      score: { home: hg, away: ag },
    };
  });
}
