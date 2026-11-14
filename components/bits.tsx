"use client";

import clsx from "clsx";
import { useSyncExternalStore } from "react";
import type { Match } from "@/lib/types";

// Times are rendered in the visitor's own time zone once the page reaches the browser.
export function LocalTime({ iso, mode = "time" }: { iso: string; mode?: "time" | "date" | "datetime" }) {
  const onClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  let text: string | null = null;
  if (onClient) {
    const d = new Date(iso);
    const opts: Intl.DateTimeFormatOptions =
      mode === "time"
        ? { hour: "2-digit", minute: "2-digit" }
        : mode === "date"
          ? { weekday: "short", day: "numeric", month: "short" }
          : { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
    text = d.toLocaleString(undefined, opts);
  }
  return <span className="tabular">{text ?? (mode === "time" ? iso.slice(11, 16) : iso.slice(0, 10))}</span>;
}

export function StatusPill({ m }: { m: Match }) {
  if (m.status === "IN_PLAY")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-live/15 px-2 py-0.5 text-xs font-bold text-live">
        <span className="size-1.5 animate-pulse-live rounded-full bg-live" />
        {m.minute ? `${m.minute}'` : "LIVE"}
      </span>
    );
  if (m.status === "PAUSED") return <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-bold text-amber-300">HT</span>;
  if (m.status === "FINISHED") return <span className="rounded-full bg-white/8 px-2 py-0.5 text-xs font-bold text-mist">FT</span>;
  if (m.status === "POSTPONED" || m.status === "CANCELLED" || m.status === "SUSPENDED")
    return <span className="rounded-full bg-white/8 px-2 py-0.5 text-xs font-bold text-mist">{m.status.slice(0, 4)}</span>;
  return (
    <span className="text-xs font-semibold text-mist">
      <LocalTime iso={m.utcDate} />
    </span>
  );
}

export function FormPills({ form }: { form?: string | null }) {
  if (!form) return <span className="text-mist">–</span>;
  return (
    <span className="inline-flex gap-1">
      {form.split(",").slice(-5).map((r, i) => (
        <span
          key={i}
          className={clsx(
            "grid size-5 place-items-center rounded-md text-[10px] font-extrabold",
            r === "W" && "bg-win/20 text-win",
            r === "D" && "bg-draw/20 text-draw",
            r === "L" && "bg-loss/20 text-loss",
          )}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

export function ProbBar({ home, draw, away, labels }: { home: number; draw: number; away: number; labels?: [string, string, string] }) {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
        <div className="bg-volt transition-all duration-700" style={{ width: pct(home) }} />
        <div className="bg-draw/60 transition-all duration-700" style={{ width: pct(draw) }} />
        <div className="bg-sky transition-all duration-700" style={{ width: pct(away) }} />
      </div>
      <div className="mt-2 flex justify-between text-xs font-semibold">
        <span className="text-volt">{labels?.[0] ?? "Home"} {pct(home)}</span>
        <span className="text-draw">{labels?.[1] ?? "Draw"} {pct(draw)}</span>
        <span className="text-sky">{labels?.[2] ?? "Away"} {pct(away)}</span>
      </div>
    </div>
  );
}
