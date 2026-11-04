import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

/**
 * "Demo stylist" — a scripted model that exercises the full agent loop
 * (reasoning → tool calls → tool results → outfit board → streamed text)
 * without an API key. It reads real tool results from the prompt, so the
 * outfits it composes use real wardrobe items. Used when OPENAI_API_KEY is
 * missing or the user picks "Demo stylist".
 */

type Prompt = { role: string; content: unknown }[];
type Part = { type: string; toolName?: string; output?: { type: string; value: unknown }; text?: string };

const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
};

function turnState(prompt: Prompt) {
  let lastUser = -1;
  prompt.forEach((m, i) => m.role === "user" && (lastUser = i));
  const userParts = (prompt[lastUser]?.content as Part[]) ?? [];
  const text = userParts.filter((p) => p.type === "text").map((p) => p.text).join(" ").toLowerCase();
  const results: Record<string, unknown> = {};
  for (const m of prompt.slice(lastUser + 1)) {
    if (m.role !== "tool" && m.role !== "assistant") continue;
    for (const p of m.content as Part[]) {
      if (p.type === "tool-result" && p.toolName) results[p.toolName] = p.output?.value;
    }
  }
  return { text, results };
}

let n = 0;
const id = (p: string) => `${p}-${Date.now()}-${n++}`;

function textChunks(kind: "text" | "reasoning", text: string) {
  const tid = id(kind);
  const words = text.match(/\S+\s*/g) ?? [];
  return [
    { type: `${kind}-start`, id: tid },
    ...words.map((w) => ({ type: `${kind}-delta`, id: tid, delta: w })),
    { type: `${kind}-end`, id: tid },
  ];
}

function toolCall(toolName: string, input: unknown) {
  return { type: "tool-call", toolCallId: id("call"), toolName, input: JSON.stringify(input) };
}

function finish(reason: "stop" | "tool-calls") {
  return { type: "finish", finishReason: { unified: reason, raw: undefined }, usage };
}

type Brief = { id: string; type: string; colors: string[]; in_laundry?: boolean; formality: number };

function pickOutfit(items: Brief[], dressy: boolean) {
  const avail = items.filter((i) => !i.in_laundry);
  const by = (cat: string) =>
    avail
      .filter((i) => i.type.startsWith(cat + "/"))
      .sort((a, b) => (dressy ? b.formality - a.formality : a.formality - b.formality));
  const pick = [by("outerwear")[0], by("top")[0], by("bottom")[0], by("footwear")[0]].filter(Boolean);
  return pick.map((i) => i.id);
}

export function createMockModel() {
  return new MockLanguageModelV4({
    provider: "drawer",
    modelId: "demo",
    doStream: async (options) => {
      const { text, results } = turnState(options.prompt as Prompt);
      const shopping = /buy|shop|missing|gap|need|suggest/.test(text);
      const answer = String((results.ask_user as { answer?: string } | undefined)?.answer ?? "").toLowerCase();
      const dressy = /date|dinner|office|work|wedding|formal|interview/.test(`${text} ${answer}`);
      const vague = /tonight|going out|what should i wear|outfit$/.test(text) && !dressy;
      let chunks: unknown[];

      if (shopping) {
        if (!results.wardrobe_stats) {
          chunks = [
            ...textChunks("reasoning", "The user wants shopping advice. First I'll look at the closet composition to find real gaps, then load the gap-analysis rules."),
            toolCall("load_skill", { name: "wardrobe-gaps" }),
            toolCall("wardrobe_stats", {}),
            finish("tool-calls"),
          ];
        } else if (!results.suggest_purchases) {
          chunks = [
            ...textChunks("reasoning", "Tops skew black/white, only one pair of shorts (in the laundry), no rain-ready outer layer. Prioritise versatile pieces."),
            toolCall("suggest_purchases", {
              suggestions: [
                { title: "Olive linen camp-collar shirt", category: "top", subcategory: "shirt", color: "olive", reason: "Adds colour and texture to a black/white tee rotation; pairs with stone chinos, navy shorts and brown loafers.", priority: 1, pairs_with: ["demo-chinos-beige", "demo-shorts-navy", "demo-loafers-brown"] },
                { title: "Stone pleated shorts", category: "bottom", subcategory: "shorts", color: "beige", reason: "Your only shorts are in the wash — a smarter pair covers summer dinners.", priority: 2 },
                { title: "Navy water-resistant mac", category: "outerwear", subcategory: "coat", color: "navy", reason: "Nothing in the closet handles rain; a mac works over knits and shirts.", priority: 2 },
              ],
            }),
            finish("tool-calls"),
          ];
        } else {
          chunks = [
            ...textChunks("text", "I saved **3 ideas** to your Shop tab, ranked by how many new outfits they unlock:\n\n1. **Olive linen camp-collar shirt** — breaks up the black/white tee rotation and works with 3 pieces you own.\n2. **Stone pleated shorts** — a smarter summer option while your navy pair is in the wash.\n3. **Navy water-resistant mac** — your first rain-ready layer.\n\n_Demo mode: connect an OpenAI key to search real products with prices and links._"),
            finish("stop"),
          ];
        }
      } else if (vague && !results.ask_user) {
        chunks = [
          ...textChunks("reasoning", "Not enough context — the occasion changes everything. Ask one quick question."),
          toolCall("ask_user", { question: "Where are you heading?", options: ["Dinner date", "Drinks with friends", "Office", "Just a walk"] }),
          finish("tool-calls"),
        ];
      } else if (!results.search_wardrobe) {
        chunks = [
          ...textChunks("reasoning", `Planning an outfit${dressy ? " for a dressier occasion" : ""}. I need the weather, the composition rules and candidate pieces from the closet.`),
          toolCall("load_skill", { name: "outfit-composition" }),
          toolCall("get_weather", {}),
          toolCall("search_wardrobe", { include_laundry: false }),
          finish("tool-calls"),
        ];
      } else if (!results.compose_outfit) {
        const sw = results.search_wardrobe as { items: Brief[] };
        const w = results.get_weather as { temp_c?: number; condition?: string } | undefined;
        const ids = pickOutfit(sw.items, dressy);
        chunks = [
          ...textChunks(
            "reasoning",
            `${w?.temp_c !== undefined ? `Weather: ${w.temp_c}°C, ${w.condition}.` : "No forecast available, so I'll layer to be safe."} Keeping formality consistent, matching leathers and mixing textures.`,
          ),
          toolCall("compose_outfit", {
            name: dressy ? "Evening, easy" : "Off-duty classic",
            occasion: dressy ? "date" : "casual",
            item_ids: ids,
            why: "Tonal neutrals with one warm layer — textures do the talking, and every piece sits at the same formality.",
            swap: "Swap the outer layer for just the top if it warms up.",
          }),
          finish("tool-calls"),
        ];
      } else {
        const w = results.get_weather as { temp_c?: number; condition?: string; location?: string } | undefined;
        chunks = [
          ...textChunks(
            "text",
            `Here's what I'd wear${w?.temp_c !== undefined ? ` — it's **${w.temp_c}°C** and ${w.condition?.toLowerCase()} in ${w.location}` : ""}.\n\nThe look stays **tonal and calm**: one warm layer, a clean base and shoes that match the formality. Tap **Save outfit** to keep it.\n\n_Demo mode — add an OpenAI key for real styling._`,
          ),
          finish("stop"),
        ];
      }

      return {
        stream: simulateReadableStream({ chunks: chunks as never[], initialDelayInMs: 350, chunkDelayInMs: 28 }),
      };
    },
  });
}
