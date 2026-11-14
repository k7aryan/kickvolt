import { GoogleGenAI, type Content, type FunctionCall, type Part } from "@google/genai";
import { env, isDemoFootball, isDemoOdds } from "@/lib/config";
import { runTool, TOOLS } from "@/lib/chatTools";

export const maxDuration = 60;

type ClientMsg = { role: "user" | "assistant"; content: string };

function systemPrompt() {
  const now = new Date();
  return `You are Kickvolt AI, an expert football (soccer) assistant inside the Kickvolt website.
Today is ${now.toUTCString()}.

How to answer:
- For anything current (live scores, fixtures, results, tables, top scorers, odds, predictions) call the Kickvolt data tools first instead of relying on memory.
- For news, injuries, transfers or leagues the tools don't cover, answer from your own knowledge and say it may be out of date.
- Be concise and punchy like a good pundit. Use short paragraphs, bullet points and small markdown tables where they help.
- Use team names as fans know them.
${isDemoFootball() ? "- NOTE: the site is in DEMO MODE for scores and tables. Tool results with source \"demo\" are simulated. Say so briefly if you use them.\n" : ""}${isDemoOdds() ? "- NOTE: odds are simulated demo prices (source \"demo\"). Mention this when discussing odds.\n" : ""}
Betting questions:
- You may analyse matches and odds: model probabilities, expected value, form, head-to-head, tactical angles.
- Present it as analysis, never as a sure thing. No guarantees, no "locks", no chasing losses, no encouraging bigger stakes.
- End betting answers with one short line: 18+, bet responsibly, BeGambleAware.org.`;
}

// Gemini wants function declarations; tools with no inputs leave the schema out.
const functionDeclarations = TOOLS.map((t) => {
  const props = (t.parameters as { properties?: Record<string, unknown> }).properties;
  return props && Object.keys(props).length
    ? { name: t.name, description: t.description, parametersJsonSchema: t.parameters }
    : { name: t.name, description: t.description };
});

function friendlyError(e: unknown) {
  const text = e instanceof Error ? e.message : String(e);
  if (/503|UNAVAILABLE|high demand|overloaded/i.test(text)) return "Gemini's servers are busy right now. Try again in a minute.";
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(text)) return "Gemini's free rate limit was hit. Wait a minute and try again.";
  if (/API key not valid|API_KEY_INVALID|401|403/i.test(text)) return "Gemini rejected the API key. Check GEMINI_API_KEY in .env.local, then restart npm run dev.";
  if (/not found|404/i.test(text) && /model/i.test(text)) return `Gemini model "${env.geminiModel}" wasn't found. Set GEMINI_MODEL in .env.local to a model listed in Google AI Studio.`;
  return text.slice(0, 300);
}

// When Google's servers are busy (503), wait and retry, then fall back to a lighter model.
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite";

async function streamWithRetry(ai: GoogleGenAI, contents: Content[]) {
  let lastErr: unknown;
  for (const model of [env.geminiModel, FALLBACK_MODEL]) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContentStream({
          model,
          contents,
          config: { systemInstruction: systemPrompt(), tools: [{ functionDeclarations }] },
        });
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        if (!/503|UNAVAILABLE|high demand|overloaded/i.test(msg)) throw e;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: ClientMsg[] };
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      if (!env.geminiKey) {
        send({ t: "text", v: "The AI assistant needs a free Gemini API key. Get one at **aistudio.google.com** (click *Get API key*), add `GEMINI_API_KEY=...` to `.env.local`, then restart `npm run dev`." });
        send({ t: "done" });
        controller.close();
        return;
      }

      const ai = new GoogleGenAI({ apiKey: env.geminiKey });
      const contents: Content[] = messages
        .filter((m) => m.content?.trim())
        .slice(-20)
        .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

      try {
        for (let step = 0; step < 6; step++) {
          const stream = await streamWithRetry(ai, contents);

          // Keep every part the model returns (incl. thought signatures) so the next turn has full context.
          const modelParts: Part[] = [];
          const calls: FunctionCall[] = [];
          for await (const chunk of stream) {
            for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
              modelParts.push(part);
              if (part.functionCall) calls.push(part.functionCall);
              else if (part.text && !part.thought) send({ t: "text", v: part.text });
            }
          }
          contents.push({ role: "model", parts: modelParts });
          if (!calls.length) break;

          const responses: Part[] = [];
          for (const call of calls) {
            send({ t: "tool", name: call.name });
            let out: unknown;
            try {
              out = await runTool(call.name ?? "", call.args ?? {});
            } catch (e) {
              out = { error: e instanceof Error ? e.message : String(e) };
            }
            const json = JSON.stringify(out);
            responses.push({
              functionResponse: { id: call.id, name: call.name, response: { result: JSON.parse(json.length > 30000 ? JSON.stringify({ truncated: json.slice(0, 30000) }) : json) } },
            });
          }
          contents.push({ role: "user", parts: responses });
        }
      } catch (e) {
        send({ t: "error", v: friendlyError(e) });
      }
      send({ t: "done" });
      controller.close();
    },
  });

  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}