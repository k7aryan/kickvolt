import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import LiveBoard from "@/components/LiveBoard";
import TeamCrest from "@/components/TeamCrest";
import { FormPills, LocalTime } from "@/components/bits";
import { IconAI, IconOdds, IconQuiz, IconSpark } from "@/components/icons";
import { getMatchesForDay, getStandings, isLive, nowMs, todayKey } from "@/lib/data";
import { findOddsForMatch, getOdds } from "@/lib/odds";
import { predict, valueAnalysis } from "@/lib/predict";
import { ErrorCard, ListSkeleton } from "@/components/ui";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
        <div className="animate-rise">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs font-semibold text-mist">
            <IconSpark size={14} className="text-volt" /> Scores · Tables · Odds · AI
          </p>
          <h1 className="font-display text-6xl leading-[0.9] tracking-wide md:text-8xl">
            MATCHDAY,
            <br />
            <span className="text-volt">DECODED.</span>
          </h1>
          <p className="mt-4 max-w-md text-mist">Live scores across Europe&apos;s top leagues, a prediction model for every fixture, bookmaker prices side by side, and an AI that knows the game.</p>
        </div>
        <Suspense fallback={<StatsSkeleton />}>
          <LiveStats />
        </Suspense>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <section>
          <SectionTitle title="Today" href="/matches" cta="All fixtures" />
          <Suspense fallback={<ListSkeleton />}>
            <TodayBoard />
          </Suspense>
        </section>

        <aside className="space-y-8">
          <section>
            <SectionTitle title="Model picks" href="/odds" cta="Odds & analysis" />
            <Suspense fallback={<ListSkeleton rows={3} />}>
              <Picks />
            </Suspense>
          </section>

          <section>
            <SectionTitle title="Premier League" href="/tables?comp=PL" cta="Full table" />
            <Suspense fallback={<ListSkeleton rows={6} />}>
              <MiniTable code="PL" />
            </Suspense>
          </section>

          <section className="grid gap-3">
            <Link href="/chat" className="card group flex items-center gap-4 p-5 transition hover:border-volt/40">
              <span className="grid size-12 place-items-center rounded-2xl bg-volt text-night">
                <IconAI size={26} />
              </span>
              <span>
                <span className="block font-bold">Ask Kickvolt AI</span>
                <span className="text-sm text-mist">&ldquo;Who&apos;s top of La Liga?&rdquo; &ldquo;Preview Arsenal vs Chelsea&rdquo;</span>
              </span>
            </Link>
            <Link href="/quiz" className="card group flex items-center gap-4 p-5 transition hover:border-volt/40">
              <span className="grid size-12 place-items-center rounded-2xl bg-sky/15 text-sky">
                <IconQuiz size={26} />
              </span>
              <span>
                <span className="block font-bold">Football Quiz</span>
                <span className="text-sm text-mist">10 questions, 15 seconds each. Beat your high score.</span>
              </span>
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ title, href, cta }: { title: string; href: string; cta: string }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h2 className="font-display text-3xl tracking-wide">{title.toUpperCase()}</h2>
      <Link href={href} className="text-sm font-semibold text-volt hover:underline">
        {cta} →
      </Link>
    </div>
  );
}

async function LiveStats() {
  await connection();
  const { data } = await getMatchesForDay(todayKey());
  const liveCount = data.filter(isLive).length;
  const goals = data.reduce((s, m) => s + (m.score.home ?? 0) + (m.score.away ?? 0), 0);
  const stats = [
    { label: "Live now", value: liveCount, accent: "text-live" },
    { label: "Matches today", value: data.length, accent: "text-chalk" },
    { label: "Goals today", value: goals, accent: "text-volt" },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="card p-4 text-center">
          <div className={`font-display text-4xl ${s.accent}`}>{s.value}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-mist">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

async function TodayBoard() {
  await connection();
  const day = todayKey();
  const { data, error } = await getMatchesForDay(day);
  if (error) return <ErrorCard error={error} />;
  return <LiveBoard initial={data} day={day} />;
}

async function Picks() {
  await connection();
  const code = "PL";
  const [odds, table, fixtures] = await Promise.all([getOdds(code), getStandings(code), getMatchesForDay(todayKey(), code)]);
  const rows = odds.data
    .filter((e) => Date.parse(e.commenceTime) > nowMs())
    .map((e) => {
      const p = predict(e.homeTeam, e.awayTeam, table.data);
      const best = valueAnalysis(p, e.bookmakers, e.homeTeam, e.awayTeam).sort((a, b) => b.ev - a.ev)[0];
      return { e, best };
    })
    .filter((r) => r.best)
    .sort((a, b) => b.best.ev - a.best.ev)
    .slice(0, 3);

  if (!rows.length) return <div className="card p-6 text-sm text-mist">{odds.error ?? "No upcoming Premier League odds right now."}</div>;
  return (
    <div className="card divide-y divide-line overflow-hidden">
      {rows.map(({ e, best }) => {
        const m = fixtures.data.find((f) => findOddsForMatch([e], f));
        const inner = (
          <div className="flex items-center gap-3 px-4 py-3">
            <IconOdds size={18} className={best.ev > 0.03 ? "text-volt" : "text-mist"} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {e.homeTeam} v {e.awayTeam}
              </div>
              <div className="text-xs text-mist">
                <LocalTime iso={e.commenceTime} mode="datetime" /> · model likes <b className="text-chalk">{best.label}</b> at {best.bestOdds.toFixed(2)}
              </div>
            </div>
            <span className={`rounded-lg px-2 py-1 text-xs font-bold ${best.ev > 0 ? "bg-volt/15 text-volt" : "bg-white/5 text-mist"}`}>
              {best.ev > 0 ? "+" : ""}
              {(best.ev * 100).toFixed(1)}% EV
            </span>
          </div>
        );
        return m ? (
          <Link key={e.id} href={`/match/${m.id}`} className="block hover:bg-white/[0.04]">
            {inner}
          </Link>
        ) : (
          <div key={e.id}>{inner}</div>
        );
      })}
    </div>
  );
}

async function MiniTable({ code }: { code: string }) {
  await connection();
  const { data, error } = await getStandings(code);
  if (!data) return <ErrorCard error={error ?? "No table"} />;
  return (
    <div className="card overflow-hidden">
      {data.total.slice(0, 6).map((r) => (
        <div key={r.team.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0">
          <span className="w-5 text-mist tabular">{r.position}</span>
          <TeamCrest team={r.team} size={20} />
          <span className="flex-1 truncate font-medium">{r.team.shortName}</span>
          <FormPills form={r.form} />
          <span className="w-8 text-right font-bold tabular">{r.points}</span>
        </div>
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card h-24 animate-pulse" />
      ))}
    </div>
  );
}
