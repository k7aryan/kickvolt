"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { QUESTIONS, QUIZ_CATEGORIES, type QuizCat, type QuizQuestion } from "@/lib/quizQuestions";
import Link from "next/link";
import { IconQuiz } from "./icons";

const PER_ROUND = 10;
const SECONDS = 15;

function shuffle<T>(a: T[]) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

const readBest = () => {
  try {
    return Number(localStorage.getItem("kickvolt-quiz-best") || 0);
  } catch {
    return 0;
  }
};

// Remember recently seen questions so new rounds prefer ones you haven't had yet.
const SEEN_KEY = "kickvolt-quiz-seen";
const readSeen = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
  } catch {
    return [];
  }
};
function rememberSeen(list: QuizQuestion[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...list.map((q) => q.q), ...readSeen()].slice(0, 250)));
  } catch {}
}
function pickFresh(pool: QuizQuestion[], n: number) {
  const seen = new Set(readSeen());
  const fresh = shuffle(pool.filter((q) => !seen.has(q.q)));
  const old = shuffle(pool.filter((q) => seen.has(q.q)));
  return [...fresh, ...old].slice(0, n);
}

async function fetchOnline(n: number): Promise<QuizQuestion[]> {
  try {
    const res = await fetch(`/api/quiz/online?n=${n}`, { cache: "no-store" });
    const data = (await res.json()) as { questions: { q: string; a: string; wrong: string[] }[] };
    return data.questions.map((x) => ({ cat: "online" as QuizCat, ...x }));
  } catch {
    return [];
  }
}

type Phase = "menu" | "loading" | "play" | "done";

export default function Quiz() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [cat, setCat] = useState<QuizCat | null>(null);
  const [qs, setQs] = useState<QuizQuestion[]>([]);
  const [opts, setOpts] = useState<string[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [time, setTime] = useState(SECONDS);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [grid, setGrid] = useState<string[]>([]);
  const [best, setBest] = useState(0);
  const [record, setRecord] = useState(false);
  const [copied, setCopied] = useState("");
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- read localStorage after hydration
  useEffect(() => setBest(readBest()), []);

  const load = useCallback((list: QuizQuestion[], idx: number) => {
    setOpts(shuffle([list[idx].a, ...list[idx].wrong]));
    setPicked(null);
    setTime(SECONDS);
  }, []);

  async function start(c: QuizCat | null) {
    let list: QuizQuestion[];
    setNote("");
    if (c === "online" || c === null) {
      setPhase("loading");
      const online = pickFresh(await fetchOnline(20), c === "online" ? PER_ROUND : 3);
      if (c === "online") {
        list = online.length >= PER_ROUND ? online : [...online, ...pickFresh(QUESTIONS, PER_ROUND - online.length)];
        if (online.length < PER_ROUND) setNote(online.length ? `Only ${online.length} online questions were available, so the rest are from Kickvolt's own bank.` : "Couldn't reach Open Trivia DB right now, so this round uses Kickvolt's own questions.");
      } else {
        list = shuffle([...online, ...pickFresh(QUESTIONS, PER_ROUND - online.length)]);
      }
    } else {
      list = pickFresh(QUESTIONS.filter((q) => q.cat === c), PER_ROUND);
    }
    rememberSeen(list);
    setCat(c);
    setQs(list);
    setI(0);
    setScore(0);
    setCorrect(0);
    setStreak(0);
    setBestStreak(0);
    setGrid([]);
    setRecord(false);
    setCopied("");
    load(list, 0);
    setPhase("play");
  }

  const answer = useCallback(
    (choice: string | null) => {
      if (picked !== null) return;
      const q = qs[i];
      setPicked(choice ?? "");
      if (choice === q.a) {
        const s = streak + 1;
        setStreak(s);
        setBestStreak((b) => Math.max(b, s));
        setCorrect((c) => c + 1);
        setScore((x) => x + 100 + time * 10 + (s - 1) * 25);
        setGrid((g) => [...g, "🟩"]);
      } else {
        setStreak(0);
        setGrid((g) => [...g, choice === null ? "⬛" : "🟥"]);
      }
      setTimeout(() => {
        if (i + 1 < qs.length) {
          setI(i + 1);
          load(qs, i + 1);
        } else {
          setPhase("done");
        }
      }, 1300);
    },
    [picked, qs, i, streak, time, load],
  );

  // countdown
  useEffect(() => {
    if (phase !== "play" || picked !== null) return;
    timer.current = setInterval(() => setTime((t) => t - 1), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [phase, picked, i]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- timer ran out
    if (phase === "play" && time <= 0 && picked === null) answer(null);
  }, [time, phase, picked, answer]);

  // save high score
  useEffect(() => {
    if (phase !== "done") return;
    if (score > readBest()) {
      try {
        localStorage.setItem("kickvolt-quiz-best", String(score));
      } catch {}
      // eslint-disable-next-line react-hooks/set-state-in-effect -- new record saved
      setBest(score);
      setRecord(true);
    }
  }, [phase, score]);

  if (phase === "menu")
    return (
      <div className="mx-auto max-w-lg animate-rise">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 grid size-16 place-items-center rounded-3xl bg-sky/15 text-sky">
            <IconQuiz size={34} />
          </span>
          <h1 className="font-display text-6xl tracking-wide">
            FOOTBALL <span className="text-volt">QUIZ</span>
          </h1>
          <p className="mt-2 text-mist">
            10 questions · 15 seconds each · faster answers and streaks score more. High score: <b className="text-volt">{best}</b>
          </p>
        </div>
        <div className="space-y-2.5">
          <button onClick={() => start(null)} className="flex w-full items-center gap-4 rounded-2xl bg-volt p-4 text-left font-bold text-night">
            <span className="text-2xl">⚡</span>
            <span>
              Quick Play<span className="block text-sm font-medium opacity-70">All topics, plus a few online questions</span>
            </span>
          </button>
          <Link href="/quiz/career" className="flex w-full items-center gap-4 rounded-2xl border border-sky/40 bg-sky/10 p-4 text-left font-bold">
            <span className="text-2xl">🔎</span>
            <span>
              Guess the Player<span className="block text-sm font-medium text-mist">Name the star from their career path</span>
            </span>
            <span className="ml-auto rounded-full bg-sky px-2 py-0.5 text-[10px] font-extrabold text-night">NEW</span>
          </Link>
          {(Object.keys(QUIZ_CATEGORIES) as QuizCat[]).map((c) => (
            <button key={c} onClick={() => start(c)} className="card flex w-full items-center gap-4 p-4 text-left transition hover:border-volt/40">
              <span className="text-2xl">{QUIZ_CATEGORIES[c].emoji}</span>
              <span className="font-semibold">
                {QUIZ_CATEGORIES[c].name}
                <span className="block text-sm font-normal text-mist">{QUIZ_CATEGORIES[c].sub}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );

  if (phase === "loading")
    return (
      <div className="grid min-h-[50vh] place-items-center text-center">
        <div>
          <div className="mx-auto mb-3 size-10 animate-spin rounded-full border-4 border-volt border-t-transparent" />
          <p className="text-mist">Fetching fresh questions…</p>
        </div>
      </div>
    );

  if (phase === "done") {
    const title = record ? "🏆 NEW RECORD!" : correct >= 8 ? "WORLD CLASS!" : correct >= 5 ? "FULL TIME!" : "BACK TO TRAINING";
    const share = `⚽ Kickvolt Quiz – ${cat ? QUIZ_CATEGORIES[cat].name : "Quick Play"}\n${grid.join("")}\n${correct}/${qs.length} · ${score} pts`;
    return (
      <div className="mx-auto max-w-md text-center animate-rise">
        <h1 className="font-display text-5xl tracking-wide">{title}</h1>
        <div className="mt-4 font-display text-8xl text-volt">{score}</div>
        <div className="text-mist">points</div>
        <div className="my-6 grid grid-cols-3 gap-3">
          {[
            [`${correct}/${qs.length}`, "Correct"],
            [bestStreak, "Best streak"],
            [best, "High score"],
          ].map(([v, k]) => (
            <div key={k as string} className="card p-4">
              <div className="text-2xl font-bold">{v}</div>
              <div className="text-xs text-mist">{k}</div>
            </div>
          ))}
        </div>
        <div className="mb-6 text-2xl tracking-widest">{grid.join("")}</div>
        <div className="space-y-2.5">
          <button onClick={() => start(cat)} className="w-full rounded-2xl bg-volt p-4 font-bold text-night">
            Play again
          </button>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(share);
                setCopied("Copied! Send it to your mates.");
              } catch {
                setCopied(share);
              }
            }}
            className="card w-full p-4 font-bold"
          >
            Copy result to share
          </button>
          <button onClick={() => setPhase("menu")} className="w-full p-3 font-semibold text-mist">
            Menu
          </button>
          {copied && <p className="whitespace-pre-line text-sm text-mist">{copied}</p>}
        </div>
      </div>
    );
  }

  const q = qs[i];
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col">
      <div className="flex items-center justify-between text-sm font-bold">
        <button onClick={() => setPhase("menu")} className="text-mist">
          ✕ Quit
        </button>
        <span className="text-volt">{streak >= 2 ? `🔥 ${streak}` : ""}</span>
        <span className="rounded-full border border-line px-3 py-1">{score} pts</span>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5">
        <div className={clsx("h-full rounded-full transition-all duration-1000 ease-linear", time <= 5 ? "bg-live" : "bg-volt")} style={{ width: `${(Math.max(0, time) / SECONDS) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs font-semibold text-mist">
        <span>
          Q {i + 1}/{qs.length}
        </span>
        <span>{Math.max(0, time)}s</span>
      </div>
      {note && i === 0 && <p className="mt-2 text-center text-xs text-mist">{note}</p>}
      <div className="flex flex-1 flex-col justify-center py-10 text-center" key={i}>
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-volt">
          {QUIZ_CATEGORIES[q.cat].emoji} {QUIZ_CATEGORIES[q.cat].name}
        </div>
        <h2 className="text-2xl font-extrabold leading-snug animate-rise">{q.q}</h2>
        <div className={clsx("mt-4 h-6 font-bold", picked === q.a ? "text-volt" : "text-live")}>{picked === null ? "" : picked === q.a ? "Correct! 🎯" : picked === "" ? "⏰ Time's up!" : "Not quite!"}</div>
      </div>
      <div className="space-y-2.5">
        {opts.map((o) => (
          <button
            key={o}
            disabled={picked !== null}
            onClick={() => answer(o)}
            className={clsx(
              "w-full rounded-2xl border p-4 font-semibold transition",
              picked === null && "card hover:border-volt/40 active:scale-[0.98]",
              picked !== null && o === q.a && "border-win bg-win text-white",
              picked !== null && o === picked && o !== q.a && "border-loss bg-loss text-white",
              picked !== null && o !== q.a && o !== picked && "border-line opacity-40",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
