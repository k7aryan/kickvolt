"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";
import { IconAI, IconSpark } from "./icons";

type Msg = { role: "user" | "assistant"; content: string; tools?: string[]; error?: string };

const TOOL_LABEL: Record<string, string> = {
  get_live_scores: "Checking live scores",
  get_matches: "Looking up fixtures",
  get_standings: "Reading the table",
  get_top_scorers: "Checking top scorers",
  get_match_analysis: "Running the match model",
  get_odds: "Comparing bookmaker odds",
  web_search: "Searching the web",
};

const SUGGESTIONS = [
  "What's happening live right now?",
  "Who's top of the Premier League and how's their form?",
  "Best value bets in La Liga this week?",
  "Latest injury news for Arsenal",
  "Explain the offside rule simply",
  "Compare Haaland and Mbappé this season",
];

export default function Chat() {
  const params = useSearchParams();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history: Msg[] = [...messages, { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "", tools: [] }]);
    setInput("");
    setBusy(true);

    const update = (fn: (m: Msg) => Msg) =>
      setMessages((ms) => {
        const copy = [...ms];
        copy[copy.length - 1] = fn(copy[copy.length - 1]);
        return copy;
      });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.body) throw new Error("No response");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as { t: string; v?: string; name?: string };
          if (ev.t === "text") update((m) => ({ ...m, content: m.content + ev.v }));
          if (ev.t === "tool") update((m) => ({ ...m, tools: [...(m.tools ?? []), ev.name!] }));
          if (ev.t === "error") update((m) => ({ ...m, error: ev.v }));
        }
      }
    } catch (e) {
      update((m) => ({ ...m, error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  }

  // Auto-send a question passed as ?q= (e.g. from a match page)
  useEffect(() => {
    const q = params.get("q");
    if (q && !started.current) {
      started.current = true;
      void send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <div className="flex min-h-[70vh] flex-col">
      {!messages.length && (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center animate-rise">
          <span className="mb-4 grid size-16 place-items-center rounded-3xl bg-volt text-night shadow-[0_0_60px_-10px] shadow-volt">
            <IconAI size={34} />
          </span>
          <h2 className="font-display text-4xl tracking-wide">ASK ME ANYTHING FOOTBALL</h2>
          <p className="mt-2 max-w-md text-mist">Live scores, tables, match predictions, odds value, transfer news, history, tactics, rules. I check live data and the web before answering.</p>
          <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="chip text-left">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 space-y-5">
        {messages.map((m, i) => (
          <div key={i} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "user" ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-volt px-4 py-2.5 font-medium text-night">{m.content}</div>
            ) : (
              <div className="card max-w-[95%] rounded-bl-md px-5 py-4 md:max-w-[85%]">
                {!!m.tools?.length && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {[...new Set(m.tools)].map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-mist">
                        <IconSpark size={11} className="text-volt" /> {TOOL_LABEL[t] ?? t}
                      </span>
                    ))}
                  </div>
                )}
                {m.content ? (
                  <div className="prose-chat text-[15px] leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  !m.error && (
                    <div className="flex gap-1 py-1">
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="size-2 animate-pulse-live rounded-full bg-volt" style={{ animationDelay: `${d * 0.2}s` }} />
                      ))}
                    </div>
                  )
                )}
                {m.error && <p className="mt-2 text-sm text-loss">Error: {m.error}</p>}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="sticky bottom-20 mt-6 md:bottom-4"
      >
        <div className="card flex items-center gap-2 p-2 shadow-2xl shadow-black/50">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about any team, match, player or bet…"
            className="flex-1 bg-transparent px-3 py-2 outline-none placeholder:text-mist"
          />
          <button disabled={busy || !input.trim()} className="rounded-xl bg-volt px-5 py-2.5 font-bold text-night transition disabled:opacity-40">
            {busy ? "…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
