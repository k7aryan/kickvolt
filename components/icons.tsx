// Custom Kickvolt icon set. Every icon is a 24×24 stroke icon that inherits currentColor.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 20) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function LogoMark({ size = 34, ...p }: P) {
  // Kickvolt mark: a "K" whose leg strikes down like a lightning bolt, inside a ball-panel hexagon.
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" {...p} aria-hidden>
      <defs>
        <linearGradient id="kv-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f2ff8a" />
          <stop offset=".55" stopColor="#d4ff3a" />
          <stop offset="1" stopColor="#7fd321" />
        </linearGradient>
      </defs>
      <path d="M32 3.5 56.5 17.5v29L32 60.5 7.5 46.5v-29z" fill="#0a1a10" stroke="url(#kv-g)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M32 3.5v8M56.5 17.5l-7 4M56.5 46.5l-7-4M32 60.5v-8M7.5 46.5l7-4M7.5 17.5l7 4" stroke="#d4ff3a" strokeOpacity=".35" strokeWidth="2" strokeLinecap="round" />
      <rect x="16" y="15" width="9" height="34" rx="2.2" fill="url(#kv-g)" />
      <path d="M40 14h10L37.5 28.5H45L48.5 48 36.5 37H25v-8.5h1.2z" fill="url(#kv-g)" />
    </svg>
  );
}

export function IconLive({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4" />
      <path d="M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
    </svg>
  );
}

export function IconFixtures({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <rect x="3" y="4.5" width="18" height="16" rx="3" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
      <circle cx="12" cy="15" r="2.6" />
      <path d="M12 12.4v1.2M9.6 15.8l1.1-.3M14.4 15.8l-1.1-.3" />
    </svg>
  );
}

export function IconTable({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      <path d="M19 4l1 2 2 .3-1.5 1.4.4 2.1L19 8.8l-1.9 1 .4-2.1L16 6.3l2-.3z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconOdds({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M3 17l5-5 4 3 7-8" />
      <path d="M15 7h4v4" />
      <circle cx="6.5" cy="19.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="19.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconAI({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z" />
      <path d="M12 6.2l1.1 2.4 2.4 1.1-2.4 1.1L12 13.2l-1.1-2.4-2.4-1.1 2.4-1.1z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconQuiz({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0z" />
      <path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 13v3M8.5 20h7M10 16h4l.5 4h-5z" />
    </svg>
  );
}

export function IconBall({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5l3.8 2.8-1.5 4.4H9.7l-1.5-4.4z" fill="currentColor" stroke="none" />
      <path d="M12 3v4.5M15.8 10.3l4.5-1.6M14.3 14.7l2.8 3.8M9.7 14.7l-2.8 3.8M8.2 10.3L3.7 8.7" />
    </svg>
  );
}

export function IconWhistle({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M8 9h12v3l-6 1a6 6 0 1 1-6-4z" />
      <circle cx="8" cy="15" r="2" />
      <path d="M14 9V6" />
    </svg>
  );
}

export function IconSpark({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M13 2L5 13h6l-1 9 8-11h-6z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconShield({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function IconChip({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <path d="M12 9.8l.7 1.5 1.5.7-1.5.7-.7 1.5-.7-1.5-1.5-.7 1.5-.7z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconToken({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity=".15" />
      <circle cx="12" cy="12" r="6.2" />
      <path d="M13 7.5 10 12.3h3l-2 4.2" />
    </svg>
  );
}
