"use client";

import { useState } from "react";
import type { Team } from "@/lib/types";

function hue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

// Shows the crest from the API when there is one; otherwise a generated shield badge.
export default function TeamCrest({ team, size = 28 }: { team: Pick<Team, "name" | "tla" | "crest">; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (team.crest && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={team.crest} alt="" width={size} height={size} onError={() => setFailed(true)} className="shrink-0 object-contain" style={{ width: size, height: size }} />
    );
  }
  const h = hue(team.name);
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="shrink-0" aria-hidden>
      <path d="M16 1.5l12.5 4.5v9c0 7.5-5.3 12.8-12.5 15.5C8.8 27.8 3.5 22.5 3.5 15V6z" fill={`hsl(${h} 55% 22%)`} stroke={`hsl(${h} 80% 62%)`} strokeWidth="1.6" />
      <path d="M3.8 12h24.4" stroke={`hsl(${h} 80% 62%)`} strokeOpacity=".35" />
      <text x="16" y="20.5" textAnchor="middle" fontSize="8.5" fontWeight="800" fill={`hsl(${h} 90% 85%)`} fontFamily="Inter Variable, sans-serif">
        {team.tla.slice(0, 3)}
      </text>
    </svg>
  );
}
