import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import clsx from "clsx";
import { LocalTime, ProbBar } from "@/components/bits";
import { CompChips, ErrorCard, ListSkeleton, PageHeader } from "@/components/ui";
import { COMPETITIONS, isDemoFootball } from "@/lib/config";
import { getMatchesRange, getStandings, nowMs, shiftDay, todayKey } from "@/lib/data";
import { DEMO_CODES } from "@/lib/demo";
import { findOddsForMatch, getOdds } from "@/lib/odds";
import { predict, valueAnalysis } from "@/lib/predict";

export const metadata: Metadata = { title: "Odds & model picks" };

export default function OddsPage(props: PageProps<"/odds">) {
  return (
    <>
      <PageHeader kicker="Odds & analysis" title="Find the value">
        Best prices across bookmakers, set against Kickvolt&apos;s prediction model. A green EV means the model thinks the price is too generous. It&apos;s a statistical estimate, not a sure thing.
      </PageHeader>
      <Suspense fallback={<ListSkeleton rows={8} />}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/odds">, "searchParams">) {
  await connection();
  const sp = await searchParams;
  const codes = (isDemoFootball() ? DEMO_CODES : COMPETITIONS.map((c) => c.code)).filter((c) => COMPETITIONS.find((x) => x.code === c)?.oddsKey);
  const code = typeof sp.comp === "string" && codes.includes(sp.comp.toUpperCase()) ? sp.comp.toUpperCase() : "PL";
  const sort = sp.sort === "time" ? "time" : "value";

  const [odds, table, fixtures] = await Promise.all([getOdds(code), getStandings(code), getMatchesRange(todayKey(), shiftDay(todayKey(), 7), code)]);

  const rows = odds.data
    .filter((e) => Date.parse(e.commenceTime) > nowMs() - 5 * 60000)
    .map((e) => {
      const pred = predict(e.homeTeam, e.awayTeam, table.data);
      const value = valueAnalysis(pred, e.bookmakers, e.homeTeam, e.awayTeam);
      const best = [...value].sort((a, b) => b.ev - a.ev)[0];
      const match = fixtures.data.find((m) => findOddsForMatch([e], m));
      return { e, pred, value, best, match };
    })
    .sort((a, b) => (sort === "time" ? a.e.commenceTime.localeCompare(b.e.commenceTime) : (b.best?.ev ?? -1) - (a.best?.ev ?? -1)));

  return (
    <>
      <CompChips base="/odds" active={code} codes={codes} extra={sort === "time" ? { sort } : undefined} />
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="text-mist">Sort:</span>
        <Link href={`/odds?comp=${code}`} className="chip" data-active={sort === "value"}>
          Best value
        </Link>
        <Link href={`/odds?comp=${code}&sort=time`} className="chip" data-active={sort === "time"}>
          Kick-off
        </Link>
      </div>

      {odds.error && <ErrorCard error={odds.error} />}
      {!odds.error && !rows.length && <div className="card p-8 text-center text-mist">No upcoming odds for this competition.</div>}

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map(({ e, pred, value, best, match }) => (
          <article key={e.id} className="card p-5 animate-rise">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="font-bold">
                  {e.homeTeam} <span className="text-mist">v</span> {e.awayTeam}
                </div>
                <div className="text-xs text-mist">
                  <LocalTime iso={e.commenceTime} mode="datetime" /> · {e.bookmakers.length} bookmakers
                </div>
              </div>
              {best && (
                <span className={clsx("shrink-0 rounded-lg px-2 py-1 text-xs font-bold", best.ev > 0.03 ? "bg-volt text-night" : best.ev > 0 ? "bg-volt/15 text-volt" : "bg-white/5 text-mist")}>
                  {best.ev > 0.03 ? "VALUE " : ""}
                  {best.ev > 0 ? "+" : ""}
                  {(best.ev * 100).toFixed(1)}%
                </span>
              )}
            </div>
            <ProbBar home={pred.home} draw={pred.draw} away={pred.away} labels={["1", "X", "2"]} />
            <div className="mt-4 grid grid-cols-3 gap-2">
              {value.map((v) => (
                <div key={v.outcome} className={clsx("rounded-xl border p-2.5 text-center", v === best && v.ev > 0 ? "border-volt/50 bg-volt/[0.06]" : "border-line")}>
                  <div className="truncate text-[11px] font-semibold text-mist">{v.label}</div>
                  <div className="font-display text-2xl tabular">{v.bestOdds.toFixed(2)}</div>
                  <div className="truncate text-[10px] text-mist">{v.bestBook}</div>
                  <div className={clsx("mt-1 text-[11px] font-bold", v.ev > 0 ? "text-volt" : "text-mist")}>
                    {v.ev > 0 ? "+" : ""}
                    {(v.ev * 100).toFixed(1)}% EV
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-mist">
              <span>
                Model xG {pred.lambdaHome.toFixed(1)}–{pred.lambdaAway.toFixed(1)} · O2.5 {Math.round(pred.over25 * 100)}%
              </span>
              {match && (
                <Link href={`/match/${match.id}`} className="font-semibold text-volt hover:underline">
                  Analysis →
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
