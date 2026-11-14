"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { IconAI, IconChip, IconFixtures, IconLive, IconOdds, IconQuiz, IconTable, LogoMark } from "./icons";

const LINKS = [
  { href: "/", label: "Live", Icon: IconLive },
  { href: "/matches", label: "Fixtures", Icon: IconFixtures },
  { href: "/tables", label: "Tables", Icon: IconTable },
  { href: "/odds", label: "Odds & Picks", Icon: IconOdds },
  { href: "/chat", label: "Ask AI", Icon: IconAI },
  { href: "/casino", label: "Arcade", Icon: IconChip },
  { href: "/quiz", label: "Quiz", Icon: IconQuiz },
];

export default function Nav() {
  return <NavView path={usePathname()} />;
}

/** Static version (no active tab) used while the current path streams in. */
export function NavView({ path }: { path: string }) {
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-night/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={34} />
            <span className="font-display text-2xl tracking-wide">
              KICK<span className="text-volt">VOLT</span>
            </span>
          </Link>
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {LINKS.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition",
                  active(href) ? "bg-volt text-night" : "text-mist hover:bg-white/5 hover:text-chalk",
                )}
              >
                <Icon size={17} />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-night/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-7">
          {LINKS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx("flex flex-col items-center gap-1 py-2.5 text-[9.5px] font-semibold", active(href) ? "text-volt" : "text-mist")}
            >
              <Icon size={21} />
              {label.split(" ")[0]}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
