import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import clsx from "clsx";
import AutoRefresh from "@/components/AutoRefresh";
import TeamCrest from "@/components/TeamCrest";
import { FormPills, LocalTime, ProbBar, StatusPill } from "@/components/bits";
import { IconAI, IconBall, IconOdds, IconShield } from "@/components/icons";
import { ErrorCard, ListSkeleton } from "@/components/ui";
import { getHeadToHead, getMatch, getRecentForm, getStandings, isLive } from "@/lib/data";
import { findOddsForMatch, getOdds } from "@/lib/odds";
import { findRow, ordinal, predict, valueAnalysis } from "@/lib/predict";
import type { Match, Team } from "@/lib/types";

export default function MatchPage(props: PageProps<"/match/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton rows={10} />}>
      <MatchContent params={props.params} />
    </Suspense>
  );
}

async function MatchContent({ params }: Pick<PageProps<"/match/[id]">, "params">) {
  await connection();
  const { id } = await params;
  const { data: m, error } = await getMatch(Number(id));
  if (!m) return <ErrorCard error={error ?? "Match not found."} />;

  const code = m.competition.code;
  const [table, odds, h2h, homeForm, awayForm] = await Promise.all([
    getStandings(code),
    getOdds(code),
    getHeadToHead(m),
    getRecentForm(m.homeTeam.id),
    getRecentForm(m.awayTeam.id),
  ]);
  const pred = predict(m.homeTeam, m.awayTeam, table.data);
  const event = findOddsForMatch(odds.data, m);
  const value = event ? valueAnalysis(pred, event.bookmakers, m.homeTeam.shortName, m.awayTeam.shortName) : [];
  const hRow = findRow(table.data?.total, m.homeTeam);
  const aRow = findRow(table.data?.total, m.awayTeam);
  const upcoming = m.status === "TIMED" || m.status === "SCHEDULED";

  const aiPrompt = `Give me a full preview and betting analysis of ${m.homeTeam.name} vs ${m.awayTeam.name} (${m.competition.name}, match id ${m.id}). Use the live data tools: table positions, form, the model prediction and the best odds. Finish with the value angles and the risks.`;

  return (
    <div className="space-y-6">
      <AutoRefresh active={isLive(m)} />
      <Link href="/matches" className="text-sm font-semibold text-mist hover:text-chalk">
        ← Fixtures
      </Link>

      {/* Scoreboard */}
      <section className="card relative overflow-hidden p-6 md:p-8 animate-rise">
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ background: "radial-gradient(circle at 50% 120%, #d4ff3a, transparent 60%)" }} />
        <div className="mb-6 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-mist">
          <span>{m.competition.name}</span>
          {m.matchday && <span>· Matchday {m.matchday}</span>}
          <span>
            · <LocalTime iso={m.utcDate} mode="datetime" />
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <TeamBlock team={m.homeTeam} pos={hRow?.position} />
          <div className="text-center">
            {m.score.home != null ? (
              <div className={clsx("font-display text-6xl tabular md:text-7xl", isLive(m) && "text-volt")}>
                {m.score.home}
                <span className="mx-2 text-mist">–</span>
                {m.score.away}
              </div>
            ) : (
              <div className="font-display text-4xl text-mist">VS</div>
            )}
            <div className="mt-2">
              <StatusPill m={m} />
            </div>
            {m.score.halfTimeHome != null && (
              <div className="mt-1 text-xs text-mist">
                HT {m.score.halfTimeHome}–{m.score.halfTimeAway}
              </div>
            )}
          </div>
          <TeamBlock team={m.awayTeam} pos={aRow?.position} />
        </div>
        {!!m.goals?.length && (
          <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-x-8 gap-y-1 text-sm">
            {m.goals.map((g, i) => (
              <div key={i} className={clsx("flex items-center gap-1.5", g.side === "away" ? "col-start-2 justify-end" : "col-start-1")}>
                <IconBall size={13} className="text-volt" />
                <span className="text-mist">{g.scorer ?? (g.side === "home" ? m.homeTeam.shortName : m.awayTeam.shortName)}</span>
                <span className="font-bold tabular">{g.minute}&apos;</span>
              </div>
            ))}
          </div>
        )}
        {m.venue && <p className="mt-6 text-center text-xs text-mist">{m.venue}</p>}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Prediction */}
        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-2xl tracking-wide">
              <IconShield className="text-volt" /> MODEL PREDICTION
            </h2>
            <span className={clsx("rounded-full px-2.5 py-1 text-[11px] font-bold uppercase", pred.confidence === "high" ? "bg-win/15 text-win" : pred.confidence === "medium" ? "bg-amber-400/15 text-amber-300" : "bg-white/5 text-mist")}>
              {pred.confidence} confidence
            </span>
          </div>
          <ProbBar home={pred.home} draw={pred.draw} away={pred.away} labels={[m.homeTeam.shortName, "Draw", m.awayTeam.shortName]} />
          <div className="mt-5 grid grid-cols-4 gap-2 text-center">
            {[
              ["xG home", pred.lambdaHome.toFixed(2)],
              ["xG away", pred.lambdaAway.toFixed(2)],
              ["Over 2.5", `${Math.round(pred.over25 * 100)}%`],
              ["BTTS", `${Math.round(pred.btts * 100)}%`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white/[0.04] p-3">
                <div className="font-display text-2xl">{v}</div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-mist">{k}</div>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-mist">Most likely scores</div>
            <div className="flex flex-wrap gap-2">
              {pred.likelyScores.map((s) => (
                <span key={`${s.home}${s.away}`} className="rounded-lg border border-line px-2.5 py-1 text-sm font-semibold tabular">
                  {s.home}–{s.away} <span className="text-mist">{Math.round(s.p * 100)}%</span>
                </span>
              ))}
            </div>
          </div>
          <ul className="mt-5 space-y-1.5 text-sm text-mist">
            {pred.notes.map((n) => (
              <li key={n}>• {n}</li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-mist">Poisson model with a Dixon–Coles adjustment, built from goals scored and conceded (home/away splits) and recent form. xG here means the model&apos;s expected goals.</p>
        </section>

        {/* Odds */}
        <section className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-2xl tracking-wide">
            <IconOdds className="text-volt" /> ODDS & VALUE
          </h2>
          {event ? (
            <>
              <div className="overflow-hidden rounded-xl border border-line">
                <table className="w-full text-sm tabular">
                  <thead className="bg-white/[0.03] text-xs text-mist">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Bookmaker</th>
                      <th className="px-3 py-2 text-right font-semibold">1</th>
                      <th className="px-3 py-2 text-right font-semibold">X</th>
                      <th className="px-3 py-2 text-right font-semibold">2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {event.bookmakers.slice(0, 8).map((b) => (
                      <tr key={b.bookmaker} className="border-t border-line">
                        <td className="px-3 py-2">{b.bookmaker}</td>
                        {(["home", "draw", "away"] as const).map((o) => (
                          <td key={o} className={clsx("px-3 py-2 text-right", value.find((v) => v.outcome === o)?.bestBook === b.bookmaker && "font-bold text-volt")}>
                            {b[o].toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 space-y-2">
                {value.map((v) => (
                  <div key={v.outcome} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm">
                    <span className="w-24 truncate font-semibold">{v.label}</span>
                    <span className="flex-1 text-xs text-mist">
                      Model {Math.round(v.model * 100)}% · Market {Math.round(v.market * 100)}% · Best {v.bestOdds.toFixed(2)}
                    </span>
                    <span className={clsx("rounded-md px-2 py-0.5 text-xs font-bold", v.ev > 0.03 ? "bg-volt/15 text-volt" : v.ev > 0 ? "bg-white/10 text-chalk" : "text-mist")}>
                      {v.ev > 0 ? "+" : ""}
                      {(v.ev * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-mist">EV = model probability × best odds − 1. Positive means the model rates the outcome as more likely than the price implies. Models can be wrong, so stake responsibly.</p>
            </>
          ) : (
            <p className="text-sm text-mist">{upcoming ? odds.error ?? "No odds found for this fixture yet." : "Odds are only shown before kick-off."}</p>
          )}
          <Link href={`/chat?q=${encodeURIComponent(aiPrompt)}`} className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-volt px-4 py-3 font-bold text-night transition hover:brightness-110">
            <IconAI size={18} /> Ask AI for a full match analysis
          </Link>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="mb-4 font-display text-2xl tracking-wide">HEAD TO HEAD</h2>
          <H2H matches={h2h} home={m.homeTeam} away={m.awayTeam} />
        </section>
        <section className="card p-6">
          <h2 className="mb-4 font-display text-2xl tracking-wide">FORM & TABLE</h2>
          <div className="space-y-4">
            {[
              [m.homeTeam, hRow, homeForm],
              [m.awayTeam, aRow, awayForm],
            ].map(([t, row, form]) => {
              const team = t as Team;
              const r = row as typeof hRow;
              const recent = form as Match[];
              return (
                <div key={team.id} className="rounded-xl bg-white/[0.03] p-4">
                  <div className="flex items-center gap-3">
                    <TeamCrest team={team} size={26} />
                    <span className="flex-1 font-semibold">{team.shortName}</span>
                    <FormPills form={recent.length ? formFrom(recent, team.id) : r?.form} />
                  </div>
                  {r && (
                    <div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs">
                      {[
                        ["Pos", ordinal(r.position)],
                        ["Pts", r.points],
                        ["W-D-L", `${r.won}-${r.draw}-${r.lost}`],
                        ["GF", r.goalsFor],
                        ["GA", r.goalsAgainst],
                      ].map(([k, v]) => (
                        <div key={k as string}>
                          <div className="font-bold text-chalk">{v}</div>
                          <div className="text-mist">{k}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function formFrom(ms: Match[], teamId: number) {
  return ms
    .map((x) => {
      const home = x.homeTeam.id === teamId;
      const f = home ? x.score.home ?? 0 : x.score.away ?? 0;
      const a = home ? x.score.away ?? 0 : x.score.home ?? 0;
      return f > a ? "W" : f === a ? "D" : "L";
    })
    .join(",");
}

function TeamBlock({ team, pos }: { team: Team; pos?: number }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <TeamCrest team={team} size={72} />
      <div>
        <div className="text-lg font-bold leading-tight md:text-xl">{team.shortName}</div>
        {pos && <div className="text-xs text-mist">{ordinal(pos)} in table</div>}
      </div>
    </div>
  );
}

function H2H({ matches, home, away }: { matches: Match[]; home: Team; away: Team }) {
  if (!matches.length) return <p className="text-sm text-mist">No previous meetings available.</p>;
  let hw = 0, d = 0, aw = 0;
  for (const x of matches) {
    const hs = x.homeTeam.id === home.id ? x.score.home ?? 0 : x.score.away ?? 0;
    const as = x.homeTeam.id === home.id ? x.score.away ?? 0 : x.score.home ?? 0;
    if (hs > as) hw++;
    else if (hs === as) d++;
    else aw++;
  }
  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        {[
          [home.shortName, hw, "text-volt"],
          ["Draws", d, "text-draw"],
          [away.shortName, aw, "text-sky"],
        ].map(([k, v, c]) => (
          <div key={k as string} className="rounded-xl bg-white/[0.04] p-3">
            <div className={`font-display text-3xl ${c}`}>{v}</div>
            <div className="truncate text-xs text-mist">{k}</div>
          </div>
        ))}
      </div>
      <div className="divide-y divide-line text-sm">
        {matches.slice(0, 6).map((x) => (
          <div key={x.id} className="flex items-center gap-3 py-2">
            <span className="w-24 text-xs text-mist">
              <LocalTime iso={x.utcDate} mode="date" />
            </span>
            <span className="flex-1 truncate text-right">{x.homeTeam.shortName}</span>
            <span className="w-12 text-center font-bold tabular">
              {x.score.home}–{x.score.away}
            </span>
            <span className="flex-1 truncate">{x.awayTeam.shortName}</span>
          </div>
        ))}
      </div>
    </>
  );
}
