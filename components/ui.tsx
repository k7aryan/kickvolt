import Link from "next/link";
import { COMPETITIONS } from "@/lib/config";

export function ErrorCard({ error }: { error: string }) {
  return (
    <div className="card border-loss/30 p-5 text-sm">
      <b className="text-loss">Couldn&apos;t load data.</b> <span className="text-mist">{error}</span>
    </div>
  );
}

export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="card divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-4">
          <div className="h-4 w-10 animate-pulse rounded bg-white/10" />
          <div className="h-4 flex-1 animate-pulse rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}

export function PageHeader({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 animate-rise">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-volt">{kicker}</p>
      <h1 className="font-display text-5xl tracking-wide md:text-6xl">{title.toUpperCase()}</h1>
      {children && <div className="mt-2 max-w-2xl text-mist">{children}</div>}
    </div>
  );
}

/** Competition filter chips that keep other query params. */
export function CompChips({ base, active, codes, extra, allowAll }: { base: string; active?: string; codes: string[]; extra?: Record<string, string>; allowAll?: boolean }) {
  const href = (code?: string) => {
    const q = new URLSearchParams(extra);
    if (code) q.set("comp", code);
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <div className="scroll-x -mx-4 mb-5 flex gap-2 px-4">
      {allowAll && (
        <Link href={href()} className="chip" data-active={!active}>
          All
        </Link>
      )}
      {COMPETITIONS.filter((c) => codes.includes(c.code)).map((c) => (
        <Link key={c.code} href={href(c.code)} className="chip" data-active={active === c.code}>
          <span>{c.flag}</span>
          {c.name}
        </Link>
      ))}
    </div>
  );
}
