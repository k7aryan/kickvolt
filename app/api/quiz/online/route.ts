import { connection } from "next/server";

// Pulls Sports questions from the free Open Trivia Database (opentdb.com, no key) and keeps only
// the football (soccer) ones. Questions are collected into a pool in memory, so each visit adds
// more variety without hammering the API (it allows about one request every 5 seconds).

interface OnlineQ {
  q: string;
  a: string;
  wrong: string[];
}

const SOCCER = /\b(soccer|football(er)?s?|fifa|world cup|premier league|uefa|champions league|la liga|serie a|bundesliga|ligue 1|eredivisie|ballon d'or|euro 20\d\d|copa am[eé]rica|goalkeeper|striker|manchester|arsenal|liverpool|chelsea|tottenham|everton|barcelona|real madrid|atl[eé]tico|juventus|ac milan|inter milan|bayern|dortmund|ajax|celtic|rangers|pel[eé]|maradona|messi|ronaldo|zidane|beckham)\b/i;
const NOT_SOCCER = /\b(nfl|super bowl|touchdown|quarterback|american football|college football|gridiron|nba|basketball|baseball|mlb|hockey|nhl|rugby|cricket|tennis|golf|formula|f1|nascar|boxing|ufc|olympic|wrestling)\b/i;

const g = globalThis as unknown as { __kvQuizPool?: Map<string, OnlineQ>; __kvQuizLast?: number };
const pool = (g.__kvQuizPool ??= new Map());

async function topUp() {
  const now = Date.now();
  if (g.__kvQuizLast && now - g.__kvQuizLast < 5500) return; // respect the rate limit
  g.__kvQuizLast = now;
  try {
    const res = await fetch(process.env.OPENTDB_URL ?? "https://opentdb.com/api.php?amount=50&category=21&type=multiple&encode=url3986", { cache: "no-store" });
    const data = (await res.json()) as { response_code: number; results?: { question: string; correct_answer: string; incorrect_answers: string[] }[] };
    if (data.response_code !== 0 || !data.results) return;
    for (const r of data.results) {
      const q = decodeURIComponent(r.question);
      const a = decodeURIComponent(r.correct_answer);
      const wrong = r.incorrect_answers.map(decodeURIComponent);
      const text = `${q} ${a} ${wrong.join(" ")}`;
      if (SOCCER.test(text) && !NOT_SOCCER.test(text) && !pool.has(q)) pool.set(q, { q, a, wrong });
    }
    if (pool.size > 600) pool.delete(pool.keys().next().value!);
  } catch {
    /* offline or rate-limited: serve what we already have */
  }
}

export async function GET(req: Request) {
  await connection();
  const want = Math.min(20, Number(new URL(req.url).searchParams.get("n") || 10));
  await topUp();
  const all = [...pool.values()];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return Response.json({ questions: all.slice(0, want), poolSize: pool.size });
}
