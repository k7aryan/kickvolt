"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { CAREERS, type Career } from "@/lib/careers";
import TeamCrest from "./TeamCrest";

const ROUND = 5;
const BASE = 100;
const COST_CLUB = 15;
const COST_HINT = 10;
const COST_WRONG = 5;
const SEEN_KEY = "kickvolt-career-seen";
const BEST_KEY = "kickvolt-career-best";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function isCorrect(guess: string, p: Career) {
  const g = norm(guess);
  if (!g) return false;
  const surname = norm(p.name).split(" ").slice(-1)[0];
  return [p.name, ...(p.aliases ?? [])].map(norm).includes(g) || g === surname;
}

const clubTla = (club: string) => {
  const words = club.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter((w) => w.length > 1 && !["FC", "CF", "AC", "SC", "CP", "de", "da"].includes(w));
  return (words.length > 1 ? words[0][0] + words[1].slice(0, 2) : (words[0] ?? club).slice(0, 3)).toUpperCase();
};

function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
}

function pickRound(): Career[] {
  const seen = new Set(read<string[]>(SEEN_KEY, []));
  const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
  const fresh = shuffle(CAREERS.filter((p) => !seen.has(p.name)));
  const old = shuffle(CAREERS.filter((p) => seen.has(p.name)));
  const list = [...fresh, ...old].slice(0, ROUND);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...list.map((p) => p.name), ...seen].slice(0, CAREERS.length - ROUND)));
  } catch {}
  return list;
}

type State = "intro" | "guessing" | "revealed" | "finished";

export default function CareerGame() {
  const [state, setState] = useState<State>("intro");
  const [round, setRound] = useState<Career[]>([]);
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(2);
  const [hints, setHints] = useState<{ nation: boolean; position: boolean }>({ nation: false, position: false });
  const [wrong, setWrong] = useState(0);
  const [guess, setGuess] = useState("");
  const [shake, setShake] = useState(false);
  const [results, setResults] = useState<{ name: string; pts: number }[]>([]);
  const [best, setBest] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- read localStorage after hydration
  useEffect(() => setBest(read<number>(BEST_KEY, 0)), []);

  const p = round[idx];
  const startShown = (pl: Career) => Math.min(2, pl.clubs.length - 1);
  const points = Math.max(10, BASE - (shown - (p ? startShown(p) : 2)) * COST_CLUB - (Number(hints.nation) + Number(hints.position)) * COST_HINT - wrong * COST_WRONG);

  function begin() {
    const r = pickRound();
    setRound(r);
    setIdx(0);
    setResults([]);
    resetFor(r[0]);
    setState("guessing");
  }

  function resetFor(pl: Career) {
    setShown(startShown(pl));
    setHints({ nation: false, position: false });
    setWrong(0);
    setGuess("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!p || !guess.trim()) return;
    if (isCorrect(guess, p)) {
      setResults((r) => [...r, { name: p.name, pts: points }]);
      setShown(p.clubs.length);
      setState("revealed");
    } else {
      setWrong((w) => w + 1);
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  }

  function giveUp() {
    setResults((r) => [...r, { name: p.name, pts: 0 }]);
    setShown(p.clubs.length);
    setState("revealed");
  }

  function next() {
    if (idx + 1 >= round.length) {
      const total = results.reduce((s, r) => s + r.pts, 0);
      if (total > best) {
        setBest(total);
        try {
          localStorage.setItem(BEST_KEY, JSON.stringify(total));
        } catch {}
      }
      setState("finished");
      return;
    }
    setIdx(idx + 1);
    resetFor(round[idx + 1]);
    setState("guessing");
  }

  const total = results.reduce((s, r) => s + r.pts, 0);
  const last = results[results.length - 1];

  if (state === "intro")
    return (
      <div className="mx-auto max-w-lg text-center animate-rise">
        <div className="mb-4 text-6xl">🔎</div>
        <h1 className="font-display text-5xl tracking-wide md:text-6xl">
          GUESS THE <span className="text-volt">PLAYER</span>
        </h1>
        <p className="mt-3 text-mist">You get a footballer&apos;s career path, one club at a time. Name them in as few clues as possible.</p>
        <div className="card mt-6 space-y-2 p-5 text-left text-sm">
          <div className="flex justify-between"><span>Correct guess</span><b className="text-volt">{BASE} pts</b></div>
          <div className="flex justify-between"><span>Each extra club revealed</span><b>−{COST_CLUB}</b></div>
          <div className="flex justify-between"><span>Nationality or position hint</span><b>−{COST_HINT}</b></div>
          <div className="flex justify-between"><span>Wrong guess</span><b>−{COST_WRONG}</b></div>
          <p className="pt-1 text-xs text-mist">Surnames are fine (e.g. &quot;Henry&quot;). {ROUND} players per game, {CAREERS.length} in the pool. Your best: <b className="text-volt">{best}</b></p>
        </div>
        <button onClick={begin} className="mt-6 w-full rounded-2xl bg-volt py-4 font-display text-2xl tracking-wider text-night">
          START
        </button>
        <Link href="/quiz" className="mt-4 inline-block text-sm font-semibold text-mist hover:text-chalk">
          ← Back to quiz
        </Link>
      </div>
    );

  if (state === "finished")
    return (
      <div className="mx-auto max-w-md text-center animate-rise">
        <h1 className="font-display text-5xl tracking-wide">{total >= best && total > 0 ? "🏆 NEW BEST!" : "FULL TIME!"}</h1>
        <div className="mt-4 font-display text-8xl text-volt">{total}</div>
        <div className="text-mist">out of {ROUND * BASE}</div>
        <div className="card mt-6 divide-y divide-line text-left">
          {results.map((r) => (
            <div key={r.name} className="flex justify-between px-4 py-2.5 text-sm">
              <span>{r.name}</span>
              <b className={r.pts ? "text-volt" : "text-mist"}>{r.pts}</b>
            </div>
          ))}
        </div>
        <button onClick={begin} className="mt-6 w-full rounded-2xl bg-volt py-4 font-bold text-night">
          Play again
        </button>
        <Link href="/quiz" className="mt-3 block p-2 text-sm font-semibold text-mist">
          Back to quiz
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between text-sm font-bold">
        <Link href="/quiz" className="text-mist">
          ✕ Quit
        </Link>
        <span>
          Player {idx + 1}/{round.length}
        </span>
        <span className="rounded-full border border-line px-3 py-1">{total} pts</span>
      </div>

      <section className="card p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-display text-3xl tracking-wide">CAREER PATH</h1>
          {state === "guessing" && <span className="rounded-full bg-volt/15 px-3 py-1 text-sm font-bold text-volt">Worth {points}</span>}
        </div>

        <ol className="relative space-y-2 border-l-2 border-line pl-5">
          {p.clubs.map((s, i) => {
            const visible = i < shown;
            return (
              <li key={i} className={clsx("relative", visible && "animate-rise")}>
                <span className={clsx("absolute -left-[27px] top-3.5 size-3 rounded-full border-2", visible ? "border-volt bg-volt" : "border-line bg-night")} />
                {visible ? (
                  <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5">
                    <TeamCrest team={{ name: s.club, tla: clubTla(s.club), crest: null }} size={28} />
                    <span className="flex-1 font-semibold">{s.club}</span>
                    {s.loan && <span className="rounded bg-sky/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky">loan</span>}
                    <span className="text-sm text-mist tabular">{s.years}</span>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-mist">? ? ?</div>
                )}
              </li>
            );
          })}
        </ol>

        {(hints.nation || hints.position || state === "revealed") && (
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {(hints.nation || state === "revealed") && <span className="rounded-full bg-white/5 px-3 py-1">🌍 {p.nation}</span>}
            {(hints.position || state === "revealed") && <span className="rounded-full bg-white/5 px-3 py-1">🎽 {p.position}</span>}
          </div>
        )}

        {state === "guessing" ? (
          <>
            <form onSubmit={submit} className="mt-5 flex gap-2">
              <input
                ref={inputRef}
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                                autoComplete="off"
                spellCheck={false}
                placeholder="Who is it?"
                className={clsx("flex-1 rounded-xl border bg-white/[0.04] px-4 py-3 outline-none transition placeholder:text-mist focus:border-volt/60", shake ? "border-loss" : "border-line")}
              />
              {/* <datalist id="kv-players">
                {CAREERS.map((c) => (
                  <option key={c.name} value={c.name} />
                ))}
              </datalist> */}
              <button className="rounded-xl bg-volt px-5 font-bold text-night">Guess</button>
            </form>
            {wrong > 0 && <p className="mt-2 text-xs text-loss">Not them. {wrong} wrong guess{wrong > 1 ? "es" : ""} (−{wrong * COST_WRONG})</p>}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button onClick={() => setShown((n) => Math.min(p.clubs.length, n + 1))} disabled={shown >= p.clubs.length} className="rounded-xl border border-line py-2.5 text-sm font-semibold disabled:opacity-30">
                Next club −{COST_CLUB}
              </button>
              <button onClick={() => setHints((h) => ({ ...h, nation: true }))} disabled={hints.nation} className="rounded-xl border border-line py-2.5 text-sm font-semibold disabled:opacity-30">
                Nationality −{COST_HINT}
              </button>
              <button onClick={() => setHints((h) => ({ ...h, position: true }))} disabled={hints.position} className="rounded-xl border border-line py-2.5 text-sm font-semibold disabled:opacity-30">
                Position −{COST_HINT}
              </button>
              <button onClick={giveUp} className="rounded-xl border border-loss/40 py-2.5 text-sm font-semibold text-loss">
                Give up
              </button>
            </div>
          </>
        ) : (
          <div className="mt-5 animate-rise">
            <div className={clsx("font-display text-3xl tracking-wide", last?.pts ? "text-volt" : "text-chalk")}>{p.name.toUpperCase()}</div>
            <div className="text-sm text-mist">{last?.pts ? `Correct! +${last.pts} points` : "No points this time"}</div>
            <button onClick={next} className="mt-4 w-full rounded-xl bg-volt py-3 font-bold text-night">
              {idx + 1 >= round.length ? "See results" : "Next player →"}
            </button>
          </div>
        )}
      </section>
      <p className="mt-3 text-center text-xs text-mist">Senior clubs in order. Active players&apos; paths run up to the 2025–26 season.</p>
    </div>
  );
}
