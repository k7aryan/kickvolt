"use client";

import Link from "next/link";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import type { Match } from "@/lib/types";
import TeamCrest from "./TeamCrest";
import { StatusPill } from "./bits";

const live = (m: Match) => m.status === "IN_PLAY" || m.status === "PAUSED";

export function MatchRow({ m, flash }: { m: Match; flash?: boolean }) {
  const started = m.score.home != null;
  const hw = m.status === "FINISHED" && (m.score.home ?? 0) > (m.score.away ?? 0);
  const aw = m.status === "FINISHED" && (m.score.away ?? 0) > (m.score.home ?? 0);
  return (
    <Link
      href={`/match/${m.id}`}
      prefetch={false}
      className={clsx("group grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 px-4 py-3 transition hover:bg-white/[0.04]", flash && "animate-goal")}
    >
      <div className="text-center">
        <StatusPill m={m} />
      </div>
      <div className="min-w-0 space-y-1.5">
        {([["home", m.homeTeam, hw], ["away", m.awayTeam, aw]] as const).map(([side, t, won]) => (
          <div key={side} className="flex items-center gap-2.5">
            <TeamCrest team={t} size={22} />
            <span className={clsx("truncate text-[15px]", won ? "font-bold text-chalk" : m.status === "FINISHED" ? "text-mist" : "font-medium")}>{t.shortName}</span>
          </div>
        ))}
      </div>
      <div className={clsx("space-y-1.5 text-right font-display text-xl tabular", live(m) ? "text-volt" : "text-chalk")}>
        <div>{started ? m.score.home : ""}</div>
        <div>{started ? m.score.away : ""}</div>
      </div>
    </Link>
  );
}

function group(ms: Match[]) {
  const map = new Map<string, Match[]>();
  for (const m of ms) {
    const k = m.competition.name ?? m.competition.code;
    map.set(k, [...(map.get(k) ?? []), m]);
  }
  return [...map.entries()].sort((a, b) => Number(b[1].some(live)) - Number(a[1].some(live)));
}

const sortMs = (ms: Match[]) => {
  const rank = (m: Match) => (live(m) ? 0 : m.status === "FINISHED" ? 2 : 1);
  return [...ms].sort((a, b) => rank(a) - rank(b) || a.utcDate.localeCompare(b.utcDate));
};

/** Day of matches grouped by competition. Polls for updates while anything is (or is about to be) live. */
export default function LiveBoard({ initial, day, comp, poll = true, onlyLive = false }: { initial: Match[]; day: string; comp?: string; poll?: boolean; onlyLive?: boolean }) {
  const [matches, setMatches] = useState(initial);
  const [flash, setFlash] = useState<Set<number>>(new Set());
  const [updated, setUpdated] = useState<Date | null>(null);
  const prev = useRef(new Map(initial.map((m) => [m.id, `${m.score.home}-${m.score.away}`])));

  useEffect(() => {
    if (!poll) return;
    let stop = false;
    const tick = async () => {
      try {
        const q = new URLSearchParams({ day, ...(comp ? { comp } : {}) });
        const res = await fetch(`/api/matches?${q}`, { cache: "no-store" });
        if (!res.ok) return;
        const { data } = (await res.json()) as { data: Match[] };
        if (stop) return;
        const goals = new Set<number>();
        for (const m of data) {
          const s = `${m.score.home}-${m.score.away}`;
          const before = prev.current.get(m.id);
          if (before && before !== s && m.score.home != null) goals.add(m.id);
          prev.current.set(m.id, s);
        }
        setMatches(data);
        setUpdated(new Date());
        if (goals.size) {
          setFlash(goals);
          setTimeout(() => setFlash(new Set()), 1500);
        }
      } catch {
        /* network blip: try again next tick */
      }
    };
    const id = setInterval(tick, 30000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [day, comp, poll]);

  const shown = sortMs(onlyLive ? matches.filter(live) : matches);
  if (!shown.length)
    return <div className="card px-6 py-10 text-center text-mist">{onlyLive ? "No matches live right now." : "No matches on this day."}</div>;

  return (
    <div className="space-y-4">
      {group(shown).map(([name, ms]) => (
        <section key={name} className="card overflow-hidden animate-rise">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <h3 className="text-sm font-bold tracking-wide">{name}</h3>
            {ms.some(live) && <span className="text-[11px] font-bold uppercase tracking-widest text-live">● {ms.filter(live).length} live</span>}
          </div>
          <div className="divide-y divide-line">
            {ms.map((m) => (
              <MatchRow key={m.id} m={m} flash={flash.has(m.id)} />
            ))}
          </div>
        </section>
      ))}
      {poll && <p className="text-center text-xs text-mist">Auto-updates every 30s{updated ? ` · last ${updated.toLocaleTimeString()}` : ""}</p>}
    </div>
  );
}
