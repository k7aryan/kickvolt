// Match prediction model: Poisson goals with a Dixon–Coles low-score correction.
// Attack/defence strengths come from the league table (home/away splits when available),
// shrunk towards average for small samples, then nudged by recent form.
import type { BookmakerOdds, Prediction, StandingRow, Standings, Team } from "./types";

const MAX_GOALS = 8;
const RHO = -0.1;

function pois(k: number, l: number) {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return (Math.exp(-l) * Math.pow(l, k)) / f;
}

export function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/münchen|munchen/g, "munich")
    .replace(/internazionale/g, "inter")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["fc", "afc", "cf", "sc", "ac", "ssc", "as", "ss", "us", "1", "club", "de", "the", "calcio", "and", "milano", "hove", "albion", "wanderers", "hotspur"].includes(w));
}

const ALIASES: Record<string, string> = { wolves: "wolverhampton", spurs: "tottenham", psg: "paris", gladbach: "monchengladbach", "man": "manchester" };

export function nameSimilarity(a: string, b: string) {
  const A = new Set(normalizeName(a).map((w) => ALIASES[w] ?? w));
  const B = new Set(normalizeName(b).map((w) => ALIASES[w] ?? w));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((w) => B.has(w) && inter++);
  return inter / Math.min(A.size, B.size);
}

export function findRow(rows: StandingRow[] | undefined, team: Team | string) {
  if (!rows) return undefined;
  if (typeof team !== "string") {
    const byId = rows.find((r) => r.team.id === team.id && team.id !== 0);
    if (byId) return byId;
  }
  const name = typeof team === "string" ? team : team.name;
  let best: StandingRow | undefined;
  let bestScore = 0;
  for (const r of rows) {
    const s = Math.max(nameSimilarity(name, r.team.name), nameSimilarity(name, r.team.shortName));
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  return bestScore >= 0.5 ? best : undefined;
}

function formFactor(form?: string | null) {
  if (!form) return 1;
  const res = form.split(",").slice(-5);
  if (!res.length) return 1;
  const pts = res.reduce((s, r) => s + (r === "W" ? 3 : r === "D" ? 1 : 0), 0);
  return 1 + (pts / (res.length * 3) - 0.5) * 0.12;
}

const rate = (goals: number, played: number, avg: number, prior = 6) =>
  // Bayesian shrinkage towards the league average
  (goals + avg * prior) / (played + prior) / avg;

export function predict(home: Team | string, away: Team | string, standings: Standings | null | undefined): Prediction {
  const notes: string[] = [];
  let lambdaHome = 1.45;
  let lambdaAway = 1.15;
  let confidence: Prediction["confidence"] = "low";

  const hT = findRow(standings?.total, home);
  const aT = findRow(standings?.total, away);

  if (standings && hT && aT) {
    const sum = (rows: StandingRow[], k: "goalsFor" | "playedGames") => rows.reduce((s, r) => s + r[k], 0);
    const totalAvg = sum(standings.total, "goalsFor") / Math.max(1, sum(standings.total, "playedGames"));
    const hasSplits = !!(standings.home?.length && standings.away?.length);
    const homeAvg = hasSplits ? sum(standings.home!, "goalsFor") / Math.max(1, sum(standings.home!, "playedGames")) : totalAvg * 1.1;
    const awayAvg = hasSplits ? sum(standings.away!, "goalsFor") / Math.max(1, sum(standings.away!, "playedGames")) : totalAvg * 0.9;

    const hH = hasSplits ? findRow(standings.home, home) : undefined;
    const aA = hasSplits ? findRow(standings.away, away) : undefined;

    // Blend venue-specific and overall rates
    const blend = (venue: number | undefined, overall: number) => (venue === undefined ? overall : venue * 0.55 + overall * 0.45);

    const homeAtt = blend(hH && rate(hH.goalsFor, hH.playedGames, homeAvg), rate(hT.goalsFor, hT.playedGames, totalAvg));
    const homeDef = blend(hH && rate(hH.goalsAgainst, hH.playedGames, awayAvg), rate(hT.goalsAgainst, hT.playedGames, totalAvg));
    const awayAtt = blend(aA && rate(aA.goalsFor, aA.playedGames, awayAvg), rate(aT.goalsFor, aT.playedGames, totalAvg));
    const awayDef = blend(aA && rate(aA.goalsAgainst, aA.playedGames, homeAvg), rate(aT.goalsAgainst, aT.playedGames, totalAvg));

    lambdaHome = homeAtt * awayDef * homeAvg * formFactor(hT.form);
    lambdaAway = awayAtt * homeDef * awayAvg * formFactor(aT.form);

    const minPlayed = Math.min(hT.playedGames, aT.playedGames);
    confidence = minPlayed < 5 ? "low" : minPlayed < 12 ? "medium" : "high";

    const hn = hT.team.shortName;
    const an = aT.team.shortName;
    notes.push(`${hn} sit ${ordinal(hT.position)} (${hT.points} pts), ${an} ${ordinal(aT.position)} (${aT.points} pts).`);
    notes.push(`${hn} average ${(hT.goalsFor / Math.max(1, hT.playedGames)).toFixed(2)} goals scored and ${(hT.goalsAgainst / Math.max(1, hT.playedGames)).toFixed(2)} conceded per game.`);
    notes.push(`${an} average ${(aT.goalsFor / Math.max(1, aT.playedGames)).toFixed(2)} scored and ${(aT.goalsAgainst / Math.max(1, aT.playedGames)).toFixed(2)} conceded per game.`);
    if (hT.form) notes.push(`Recent form – ${hn}: ${hT.form.replace(/,/g, " ")} · ${an}: ${aT.form?.replace(/,/g, " ") ?? "n/a"}`);
  } else {
    notes.push("No league table data for one or both teams, so this uses league-average scoring rates.");
  }

  lambdaHome = clamp(lambdaHome, 0.2, 4.5);
  lambdaAway = clamp(lambdaAway, 0.2, 4.5);

  let home_ = 0, draw = 0, away_ = 0, over25 = 0, btts = 0, total = 0;
  const scores: { home: number; away: number; p: number }[] = [];
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      let p = pois(i, lambdaHome) * pois(j, lambdaAway);
      if (i === 0 && j === 0) p *= 1 - lambdaHome * lambdaAway * RHO;
      else if (i === 0 && j === 1) p *= 1 + lambdaHome * RHO;
      else if (i === 1 && j === 0) p *= 1 + lambdaAway * RHO;
      else if (i === 1 && j === 1) p *= 1 - RHO;
      total += p;
      if (i > j) home_ += p;
      else if (i === j) draw += p;
      else away_ += p;
      if (i + j > 2) over25 += p;
      if (i > 0 && j > 0) btts += p;
      scores.push({ home: i, away: j, p });
    }
  }
  scores.sort((a, b) => b.p - a.p);
  return {
    lambdaHome,
    lambdaAway,
    home: home_ / total,
    draw: draw / total,
    away: away_ / total,
    over25: over25 / total,
    btts: btts / total,
    likelyScores: scores.slice(0, 5).map((s) => ({ ...s, p: s.p / total })),
    confidence,
    notes,
  };
}

export interface ValueRow {
  outcome: "home" | "draw" | "away";
  label: string;
  model: number;
  market: number; // bookmaker-implied probability with the margin removed
  bestOdds: number;
  bestBook: string;
  ev: number; // expected return per 1 unit staked at best odds
}

export function valueAnalysis(pred: Prediction, books: BookmakerOdds[], homeName: string, awayName: string): ValueRow[] {
  if (!books.length) return [];
  const outcomes = ["home", "draw", "away"] as const;
  const fair = { home: 0, draw: 0, away: 0 };
  for (const b of books) {
    const inv = 1 / b.home + 1 / b.draw + 1 / b.away;
    fair.home += 1 / b.home / inv;
    fair.draw += 1 / b.draw / inv;
    fair.away += 1 / b.away / inv;
  }
  return outcomes.map((o) => {
    const best = books.reduce((x, b) => (b[o] > x[o] ? b : x), books[0]);
    const model = pred[o];
    return {
      outcome: o,
      label: o === "home" ? homeName : o === "away" ? awayName : "Draw",
      model,
      market: fair[o] / books.length,
      bestOdds: best[o],
      bestBook: best.bookmaker,
      ev: model * best[o] - 1,
    };
  });
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * In-play 1X2 probabilities: goals still to come follow a Poisson distribution scaled by
 * the time left (and adjusted for red cards), added to the current score.
 */
export function inPlayProbs(lambdaHome: number, lambdaAway: number, minute: number, scoreHome: number, scoreAway: number, redHome = 0, redAway = 0) {
  const left = Math.max(0, Math.min(1, (93 - minute) / 93)); // ~3 min stoppage time
  // A red card: the side down to ten scores less and concedes more for the rest of the game.
  const lh = lambdaHome * left * Math.pow(0.72, redHome) * Math.pow(1.22, redAway);
  const la = lambdaAway * left * Math.pow(0.72, redAway) * Math.pow(1.22, redHome);
  let home = 0, draw = 0, away = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = pois(i, lh) * pois(j, la);
      const h = scoreHome + i;
      const a = scoreAway + j;
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
    }
  }
  const t = home + draw + away;
  return { home: home / t, draw: draw / t, away: away / t };
}
