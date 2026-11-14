# ⚽ Kickvolt

Live football scores, league tables, bookmaker odds with a prediction model, an AI football assistant and a quiz, built with **Next.js 16**, React 19, TypeScript and Tailwind CSS 4.

It runs straight away in **demo mode** (simulated fixtures, scores and odds), so you can explore everything before signing up for anything.

## Run it

You need **Node.js 20 or newer** (download from nodejs.org).

```bash
npm install        # downloads all dependencies (one time)
npm run dev        # starts the site at http://localhost:3000
```

Open (https://kickvolt.vercel.app/) in your browser.

## Turn on real data

1. Copy `.env.example` to a new file called `.env.local`
2. Paste in any keys you have (each one is optional):

| Key | What it unlocks | Where to get it | Cost |
|---|---|---|---|
| `FOOTBALL_DATA_API_KEY` | Real fixtures, scores, tables, top scorers, head-to-head | football-data.org | Free (scores delayed). About €12/month for real-time |
| `ODDS_API_KEY` | Real bookmaker odds | the-odds-api.com | Free: 500 credits/month |
| `ANTHROPIC_API_KEY` | The AI chatbot | console.anthropic.com | Pay per use |

3. Stop the dev server (Ctrl+C) and run `npm run dev` again.

## What's inside

| Page | What it does |
|---|---|
| `/` Live | Today's matches grouped by league, live minute, goal flash, auto-refresh every 30s, model picks, mini table |
| `/matches` | Any day ±4 days, filter by competition |
| `/match/[id]` | Scoreboard, goals, **prediction model** (1X2, xG, over 2.5, BTTS, likely scores), odds from every bookmaker, **expected value**, head-to-head, form |
| `/tables` | Full standings with form and qualification zones, top scorers |
| `/odds` | Every upcoming fixture with best prices, model probabilities and EV, sorted by value |
| `/chat` | AI assistant with tools: live scores, fixtures, tables, scorers, match analysis, odds, plus web search for news, injuries and transfers |
| `/quiz` | Timed football quiz with streaks, high score and a shareable result |

### Project layout

```
app/                 pages and API routes (App Router)
  api/chat/          streaming AI chat with tool calls
  api/matches/       JSON used for live auto-refresh
components/          UI (LiveBoard, Chat, Quiz, icons…)
lib/
  data.ts            single entry point for football data (real or demo)
  footballData.ts    football-data.org client
  odds.ts            The Odds API client + matching odds to fixtures
  predict.ts         Poisson / Dixon–Coles prediction + value maths
  chatTools.ts       tools the AI can call
  demo.ts            demo data generator
  cache.ts           in-memory cache that protects your free API quotas
  quizQuestions.ts   add quiz questions here
```

## How the prediction model works

For each team it estimates attacking and defensive strength from goals scored and conceded (home and away separately when available), shrinks small samples towards the league average, nudges for last-5 form, then uses a Poisson distribution with a Dixon–Coles correction to get every scoreline's probability. Summing those gives home/draw/away, over 2.5 and both-teams-to-score.

**Expected value** = model probability × best odds − 1. A positive EV means the model thinks a price is generous. It's a statistical estimate and will often be wrong. Please gamble responsibly (18+).

## Deploy for free

1. Push the project to a GitHub repository.
2. Go to vercel.com, sign in with GitHub, choose **Add New → Project**, and import the repo.
3. Add your keys under **Settings → Environment Variables**, then deploy.

## Ideas for next

- Push notifications for goals in your favourite team's matches
- User accounts and favourite teams (Supabase or Clerk)
- Match statistics and lineups (needs a paid data plan, for example API-Football or Sportmonks)
- More quiz modes, such as "guess the player from their career path"
