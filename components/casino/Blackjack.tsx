"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { fmt, payout, stake, useWallet } from "@/lib/wallet";
import TokenBar from "./TokenBar";

// Rules: 6-deck shoe, dealer peeks for blackjack and stands on soft 17, blackjack pays 3:2,
// double on any first two cards, split once (split aces get one card each). No insurance.
type Card = { r: string; s: string };
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];
const DECKS = 6;
const STAKES = [10, 25, 50, 100];

function newShoe(): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < DECKS; d++) for (const s of SUITS) for (const r of RANKS) cards.push({ r, s });
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

const cardValue = (c: Card) => (c.r === "A" ? 11 : ["J", "Q", "K"].includes(c.r) ? 10 : Number(c.r));

function total(cards: Card[]) {
  let sum = 0;
  let aces = 0;
  for (const c of cards) {
    sum += cardValue(c);
    if (c.r === "A") aces++;
  }
  while (sum > 21 && aces) {
    sum -= 10;
    aces--;
  }
  return { sum, soft: aces > 0 };
}

const isBlackjack = (cards: Card[]) => cards.length === 2 && total(cards).sum === 21;

interface Hand {
  cards: Card[];
  bet: number;
  done: boolean;
  split?: boolean;
  outcome?: "win" | "lose" | "push" | "blackjack";
  paid?: number;
}

type Phase = "bet" | "player" | "dealer" | "done";

function CardView({ c, hidden, i }: { c?: Card; hidden?: boolean; i: number }) {
  const red = c && (c.s === "♥" || c.s === "♦");
  return (
    <div
      className={clsx(
        "relative h-28 w-20 shrink-0 rounded-xl border shadow-xl animate-rise md:h-32 md:w-[5.5rem]",
        hidden ? "border-volt/40 bg-[repeating-linear-gradient(45deg,#0f2419_0_6px,#163a26_6px_12px)]" : "border-black/10 bg-white",
      )}
      style={{ marginLeft: i ? -28 : 0, animationDelay: `${i * 40}ms` }}
    >
      {hidden ? (
        <div className="grid h-full place-items-center font-display text-2xl text-volt">K</div>
      ) : (
        c && (
          <div className={clsx("flex h-full flex-col justify-between p-2 font-bold", red ? "text-red-600" : "text-gray-900")}>
            <div className="leading-none">
              <div className="text-lg">{c.r}</div>
              <div className="text-base">{c.s}</div>
            </div>
            <div className="self-center text-4xl">{c.s}</div>
            <div className="rotate-180 leading-none">
              <div className="text-lg">{c.r}</div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

export default function Blackjack() {
  const w = useWallet();
  const shoe = useRef<Card[] | null>(null);
  const [bet, setBet] = useState(25);
  const [phase, setPhase] = useState<Phase>("bet");
  const [dealer, setDealer] = useState<Card[]>([]);
  const [shown, setShown] = useState(1); // how many dealer cards are face up
  const [hands, setHands] = useState<Hand[]>([]);
  const [active, setActive] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  function draw(): Card {
    if (!shoe.current || shoe.current.length < 52 * DECKS * 0.25) shoe.current = newShoe(); // reshuffle at 75% penetration
    return shoe.current.pop()!;
  }

  function settle(final: Hand[], dealerCards: Card[]) {
    const d = total(dealerCards).sum;
    const dealerBJ = isBlackjack(dealerCards);
    let paidTotal = 0;
    const out = final.map((h) => {
      const p = total(h.cards).sum;
      let outcome: Hand["outcome"];
      let paid = 0;
      if (p > 21) outcome = "lose";
      else if (isBlackjack(h.cards) && !h.split && !dealerBJ) {
        outcome = "blackjack";
        paid = Math.round(h.bet * 2.5);
      } else if (dealerBJ && !(isBlackjack(h.cards) && !h.split)) outcome = "lose";
      else if (d > 21 || p > d) {
        outcome = "win";
        paid = h.bet * 2;
      } else if (p === d) {
        outcome = "push";
        paid = h.bet;
      } else outcome = "lose";
      paidTotal += paid;
      return { ...h, done: true, outcome, paid };
    });
    if (paidTotal) payout(paidTotal, "blackjack", out.map((h) => h.outcome).join(" / "));
    const staked = out.reduce((s, h) => s + h.bet, 0);
    setHands(out);
    setPhase("done");
    setMsg(paidTotal > staked ? `You win ${fmt(paidTotal - staked)}!` : paidTotal === staked ? "Push: stake returned" : "Dealer wins");
  }

  function dealerPlay(final: Hand[], dealerCards: Card[]) {
    setPhase("dealer");
    const cards = [...dealerCards];
    const anyAlive = final.some((h) => total(h.cards).sum <= 21);
    if (anyAlive) {
      while (total(cards).sum < 17) cards.push(draw()); // stands on all 17s, including soft 17
    }
    setDealer(cards);
    // Reveal the hole card, then each extra card, one by one.
    for (let i = 2; i <= cards.length; i++) setTimeout(() => setShown(i), (i - 1) * 550);
    setTimeout(() => settle(final, cards), cards.length * 550 + 150);
  }

  function advance(next: Hand[], from: number) {
    const idx = next.findIndex((h, i) => i > from && !h.done);
    if (idx === -1) {
      setHands(next);
      dealerPlay(next, dealer);
    } else {
      setHands(next);
      setActive(idx);
    }
  }

  function deal() {
    if (!stake(bet, "blackjack", `Deal (${bet})`)) {
      setMsg("Not enough tokens for that stake.");
      return;
    }
    setMsg(null);
    const p = [draw(), draw()];
    const d = [draw(), draw()];
    // deal order: player, dealer, player, dealer
    const player = [p[0], p[1]];
    const dealerCards = [d[0], d[1]];
    const hand: Hand = { cards: player, bet, done: false };
    setDealer(dealerCards);
    setShown(1);
    setActive(0);
    setHands([hand]);

    const up = dealerCards[0];
    const peek = up.r === "A" || cardValue(up) === 10;
    if ((peek && isBlackjack(dealerCards)) || isBlackjack(player)) {
      setShown(2);
      setTimeout(() => settle([{ ...hand, done: true }], dealerCards), 500);
      setPhase("dealer");
      return;
    }
    setPhase("player");
  }

  const cur = hands[active];

  function hit() {
    const next = hands.map((h, i) => (i === active ? { ...h, cards: [...h.cards, draw()] } : h));
    const s = total(next[active].cards).sum;
    if (s >= 21) {
      next[active] = { ...next[active], done: true };
      advance(next, active);
    } else setHands(next);
  }

  function standHand() {
    const next = hands.map((h, i) => (i === active ? { ...h, done: true } : h));
    advance(next, active);
  }

  function double() {
    if (!stake(cur.bet, "blackjack", "Double down")) return;
    const next = hands.map((h, i) => (i === active ? { ...h, bet: h.bet * 2, cards: [...h.cards, draw()], done: true } : h));
    advance(next, active);
  }

  function split() {
    if (!stake(cur.bet, "blackjack", "Split")) return;
    const [a, b] = cur.cards;
    const aces = a.r === "A";
    const h1: Hand = { cards: [a, draw()], bet: cur.bet, done: aces, split: true };
    const h2: Hand = { cards: [b, draw()], bet: cur.bet, done: aces, split: true };
    const next = [h1, h2];
    if (aces) advance(next, 1);
    else {
      setHands(next);
      setActive(0);
    }
  }

  const canDouble = phase === "player" && cur && cur.cards.length === 2 && w.balance >= cur.bet;
  const canSplit = phase === "player" && hands.length === 1 && cur?.cards.length === 2 && cardValue(cur.cards[0]) === cardValue(cur.cards[1]) && w.balance >= cur.bet;
  const dealerTotal = total(dealer.slice(0, shown));

  return (
    <div className="mx-auto max-w-3xl">
      <TokenBar title="Blackjack" />

      <section className="card relative overflow-hidden bg-[radial-gradient(ellipse_at_top,#14532d_0%,#0a2416_60%,#06140c_100%)] p-5 md:p-8">
        <div className="text-center text-[11px] font-bold uppercase tracking-[0.25em] text-volt/60">Blackjack pays 3 to 2 · Dealer stands on 17</div>

        {/* Dealer */}
        <div className="mt-5 flex flex-col items-center">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-mist">Dealer {dealer.length > 0 && <span className="text-chalk">· {dealerTotal.sum}</span>}</div>
          <div className="flex h-28 items-center md:h-32">
            {dealer.map((c, i) => (
              <CardView key={i} c={c} hidden={i >= shown} i={i} />
            ))}
          </div>
        </div>

        <div className="my-5 h-7 text-center">
          {msg && <span className={clsx("inline-block font-display text-2xl tracking-wide animate-rise", /^you win/i.test(msg) ? "text-volt" : "text-chalk")}>{msg.toUpperCase()}</span>}
        </div>

        {/* Player hands */}
        <div className="flex flex-wrap justify-center gap-8">
          {hands.map((h, hi) => {
            const t = total(h.cards);
            return (
              <div key={hi} className={clsx("flex flex-col items-center rounded-2xl p-2 transition", phase === "player" && hi === active && hands.length > 1 && "bg-volt/10 ring-1 ring-volt/40")}>
                <div className="flex h-28 items-center md:h-32">
                  {h.cards.map((c, i) => (
                    <CardView key={i} c={c} i={i} />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="font-bold">{t.sum > 21 ? "Bust" : isBlackjack(h.cards) && !h.split ? "Blackjack!" : `${t.soft && t.sum < 21 ? "Soft " : ""}${t.sum}`}</span>
                  <span className="text-mist">· {h.bet}</span>
                  {h.outcome && (
                    <span className={clsx("rounded-md px-2 py-0.5 text-[11px] font-bold uppercase", h.outcome === "lose" ? "bg-loss/20 text-loss" : h.outcome === "push" ? "bg-white/10" : "bg-volt/20 text-volt")}>
                      {h.outcome === "lose" ? "lose" : h.outcome === "push" ? "push" : `+${fmt(h.paid! - h.bet)}`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {!hands.length && <div className="grid h-36 place-items-center text-mist">Choose a stake and deal</div>}
        </div>

        {/* Controls */}
        <div className="mt-6">
          {phase === "player" ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button onClick={hit} className="rounded-xl bg-volt py-3 font-display text-xl tracking-wider text-night">
                HIT
              </button>
              <button onClick={standHand} className="rounded-xl bg-white/10 py-3 font-display text-xl tracking-wider">
                STAND
              </button>
              <button onClick={double} disabled={!canDouble} className="rounded-xl bg-white/10 py-3 font-display text-xl tracking-wider disabled:opacity-30">
                DOUBLE
              </button>
              <button onClick={split} disabled={!canSplit} className="rounded-xl bg-white/10 py-3 font-display text-xl tracking-wider disabled:opacity-30">
                SPLIT
              </button>
            </div>
          ) : phase === "dealer" ? (
            <div className="py-3 text-center text-sm text-mist">Dealer&apos;s turn…</div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
                <span className="text-sm text-mist">Stake</span>
                {STAKES.map((s) => (
                  <button key={s} onClick={() => setBet(s)} className="chip" data-active={bet === s}>
                    {s}
                  </button>
                ))}
              </div>
              <button onClick={deal} disabled={w.balance < bet} className="w-full rounded-2xl bg-volt py-4 font-display text-2xl tracking-wider text-night transition hover:brightness-110 disabled:opacity-40">
                {phase === "done" ? `DEAL AGAIN · ${bet}` : `DEAL · ${bet}`}
              </button>
            </>
          )}
        </div>
      </section>

      <section className="card mt-6 p-5 text-sm text-mist">
        <h2 className="mb-2 font-display text-xl tracking-wide text-chalk">HOW TO PLAY</h2>
        <p>Get closer to 21 than the dealer without going over. Picture cards count 10, aces count 1 or 11. <b className="text-chalk">Hit</b> takes another card, <b className="text-chalk">Stand</b> keeps your total, <b className="text-chalk">Double</b> doubles your stake for exactly one more card, and <b className="text-chalk">Split</b> turns a pair into two hands. A blackjack (ace + 10-value card) pays 3:2. Even with perfect play, the house keeps a small edge.</p>
      </section>
    </div>
  );
}
