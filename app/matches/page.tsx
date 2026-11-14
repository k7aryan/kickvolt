import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import LiveBoard from "@/components/LiveBoard";
import { CompChips, ErrorCard, ListSkeleton, PageHeader } from "@/components/ui";
import { COMPETITIONS } from "@/lib/config";
import { getMatchesForDay, shiftDay, todayKey } from "@/lib/data";
import { DEMO_CODES } from "@/lib/demo";
import { isDemoFootball } from "@/lib/config";

export const metadata: Metadata = { title: "Fixtures & results" };

export default function MatchesPage(props: PageProps<"/matches">) {
  return (
    <>
      <PageHeader kicker="Fixtures & results" title="Every match">
        Pick a day and a competition. Today&apos;s scores refresh on their own.
      </PageHeader>
      <Suspense fallback={<ListSkeleton />}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/matches">, "searchParams">) {
  await connection();
  const sp = await searchParams;
  const today = todayKey();
  const day = typeof sp.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : today;
  const comp = typeof sp.comp === "string" ? sp.comp.toUpperCase() : undefined;
  const { data, error } = await getMatchesForDay(day, comp);
  const codes = isDemoFootball() ? DEMO_CODES : COMPETITIONS.map((c) => c.code);

  const days = Array.from({ length: 9 }, (_, i) => shiftDay(today, i - 4));
  const label = (d: string) => {
    if (d === today) return "Today";
    if (d === shiftDay(today, -1)) return "Yesterday";
    if (d === shiftDay(today, 1)) return "Tomorrow";
    return new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
  };
  const q = (d: string) => `/matches?day=${d}${comp ? `&comp=${comp}` : ""}`;

  return (
    <>
      <div className="scroll-x -mx-4 mb-3 flex gap-2 px-4">
        {days.map((d) => (
          <Link key={d} href={q(d)} className="chip" data-active={d === day}>
            {label(d)}
          </Link>
        ))}
      </div>
      <CompChips base="/matches" active={comp} codes={codes} extra={{ day }} allowAll />
      {error ? <ErrorCard error={error} /> : <LiveBoard key={`${day}${comp}`} initial={data} day={day} comp={comp} poll={day === today} />}
    </>
  );
}
