import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import clsx from "clsx";
import TeamCrest from "@/components/TeamCrest";
import { FormPills } from "@/components/bits";
import { CompChips, ErrorCard, ListSkeleton, PageHeader } from "@/components/ui";
import { getCompetition } from "@/lib/config";
import { availableTableCodes, getScorers, getStandings } from "@/lib/data";

export const metadata: Metadata = { title: "League tables" };

export default function TablesPage(props: PageProps<"/tables">) {
  return (
    <>
      <PageHeader kicker="Standings" title="League tables">
        Full tables with form and the top scorers.
      </PageHeader>
      <Suspense fallback={<ListSkeleton rows={12} />}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/tables">, "searchParams">) {
  await connection();
  const sp = await searchParams;
  const codes = availableTableCodes();
  const code = typeof sp.comp === "string" && codes.includes(sp.comp.toUpperCase()) ? sp.comp.toUpperCase() : "PL";
  const [table, scorers] = await Promise.all([getStandings(code), getScorers(code)]);
  const isCup = code === "CL";
  const n = table.data?.total.length ?? 0;

  const zone = (pos: number) => {
    if (isCup) return pos <= 8 ? "bg-volt" : pos <= 24 ? "bg-sky" : "";
    if (pos <= 4) return "bg-volt";
    if (pos <= 6) return "bg-sky";
    if (pos > n - 3) return "bg-loss";
    return "";
  };

  return (
    <>
      <CompChips base="/tables" active={code} codes={codes} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {table.data ? (
          <section className="card overflow-hidden">
            <div className="border-b border-line px-4 py-3 text-sm font-bold">
              {getCompetition(code)?.flag} {table.data.competition.name} {table.data.season && <span className="text-mist">· {table.data.season}</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular">
                <thead className="text-xs text-mist">
                  <tr className="border-b border-line">
                    <th className="w-10 py-2.5 pl-4 text-left font-semibold">#</th>
                    <th className="py-2.5 text-left font-semibold">Team</th>
                    <th className="px-2 font-semibold">P</th>
                    <th className="px-2 font-semibold">W</th>
                    <th className="px-2 font-semibold">D</th>
                    <th className="px-2 font-semibold">L</th>
                    <th className="hidden px-2 font-semibold sm:table-cell">GF</th>
                    <th className="hidden px-2 font-semibold sm:table-cell">GA</th>
                    <th className="px-2 font-semibold">GD</th>
                    <th className="px-2 font-semibold">Pts</th>
                    <th className="hidden px-4 font-semibold md:table-cell">Form</th>
                  </tr>
                </thead>
                <tbody>
                  {table.data.total.map((r) => (
                    <tr key={r.team.id} className="border-b border-line last:border-0 hover:bg-white/[0.03]">
                      <td className="relative py-2.5 pl-4 text-mist">
                        <span className={clsx("absolute inset-y-1 left-0 w-1 rounded-r", zone(r.position))} />
                        {r.position}
                      </td>
                      <td className="py-2.5">
                        <span className="flex items-center gap-2.5">
                          <TeamCrest team={r.team} size={22} />
                          <span className="truncate font-medium">{r.team.shortName}</span>
                        </span>
                      </td>
                      <td className="px-2 text-center">{r.playedGames}</td>
                      <td className="px-2 text-center">{r.won}</td>
                      <td className="px-2 text-center">{r.draw}</td>
                      <td className="px-2 text-center">{r.lost}</td>
                      <td className="hidden px-2 text-center sm:table-cell">{r.goalsFor}</td>
                      <td className="hidden px-2 text-center sm:table-cell">{r.goalsAgainst}</td>
                      <td className={clsx("px-2 text-center", r.goalDifference > 0 ? "text-win" : r.goalDifference < 0 ? "text-loss" : "")}>
                        {r.goalDifference > 0 ? "+" : ""}
                        {r.goalDifference}
                      </td>
                      <td className="px-2 text-center font-bold">{r.points}</td>
                      <td className="hidden px-4 md:table-cell">
                        <FormPills form={r.form} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-4 border-t border-line px-4 py-3 text-xs text-mist">
              {isCup ? (
                <>
                  <Legend c="bg-volt" t="Last 16" />
                  <Legend c="bg-sky" t="Knockout play-offs" />
                </>
              ) : (
                <>
                  <Legend c="bg-volt" t="Champions League" />
                  <Legend c="bg-sky" t="Europa League" />
                  <Legend c="bg-loss" t="Relegation" />
                </>
              )}
              <span>Exact places vary by league.</span>
            </div>
          </section>
        ) : (
          <ErrorCard error={table.error ?? "No table available."} />
        )}

        <section className="card h-fit overflow-hidden">
          <div className="border-b border-line px-4 py-3 font-display text-xl tracking-wide">TOP SCORERS</div>
          {scorers.data.length ? (
            scorers.data.map((s, i) => (
              <div key={s.player.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0">
                <span className="w-5 text-mist tabular">{i + 1}</span>
                <TeamCrest team={s.team} size={20} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.player.name}</span>
                  <span className="text-xs text-mist">{s.team.shortName}</span>
                </span>
                <span className="text-right">
                  <span className="block font-display text-xl text-volt">{s.goals}</span>
                  {s.assists != null && <span className="text-[10px] text-mist">{s.assists} ast</span>}
                </span>
              </div>
            ))
          ) : (
            <p className="p-4 text-sm text-mist">{scorers.error ?? "No scorer data yet."}</p>
          )}
        </section>
      </div>
    </>
  );
}

function Legend({ c, t }: { c: string; t: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-1 rounded ${c}`} />
      {t}
    </span>
  );
}
