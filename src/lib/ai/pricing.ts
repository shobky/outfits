import type { LanguageModelUsage } from "ai";
import { MODELS } from "./models";

// Standard global API rates checked 2026-11-11. Legacy rates support explicit
// deployment overrides; unknown models must be priced before spending on them.
const legacy = {
  "gpt-5.4-mini": { input: 0.75, output: 4.5, cached: 0.075 },
  "gpt-5.5": { input: 5, output: 30, cached: 0.5 },
};
export function textRates(model: string) {
  const rates = MODELS.find((entry) => entry.id === model)?.usdPerM ?? legacy[model as keyof typeof legacy];
  if (!rates) throw new Error(`Configure verified pricing before using model ${model}`);
  return rates;
}

/** Call per provider step: long-context pricing is per request, not per chat. */
export function textCost(model: string, usage: Pick<LanguageModelUsage, "inputTokens" | "outputTokens"> & Partial<Pick<LanguageModelUsage, "inputTokenDetails">>) {
  const rates = textRates(model);
  const input = usage.inputTokens ?? 0;
  const cached = Math.min(input, usage.inputTokenDetails?.cacheReadTokens ?? 0);
  const written = Math.min(input - cached, usage.inputTokenDetails?.cacheWriteTokens ?? 0);
  const ordinary = Math.max(0, input - cached - written);
  const long = input > 272_000 && model !== "gpt-5.4-mini";
  const write = "write" in rates && typeof rates.write === "number" ? rates.write : rates.input;
  return ((ordinary * rates.input + cached * rates.cached + written * write) * (long ? 2 : 1)
    + (usage.outputTokens ?? 0) * rates.output * (long ? 1.5 : 1)) / 1e6;
}

export const WEB_SEARCH_USD = 0.01;
