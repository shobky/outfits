import { expect, test } from "@playwright/test";
import { textCost, textRates, WEB_SEARCH_USD } from "../../src/lib/ai/pricing";

test("Luna accounts for ordinary, cached, written, and output tokens", () => {
  expect(textCost("gpt-6-luna", {
    inputTokens: 10000, outputTokens: 1000,
    inputTokenDetails: { noCacheTokens: 5000, cacheReadTokens: 3000, cacheWriteTokens: 2000 },
  })).toBeCloseTo(0.00128, 8);
});

test("long context prices each request at the higher tier", () => {
  expect(textCost("gpt-6-luna", { inputTokens: 300000, outputTokens: 1000 })).toBeCloseTo(0.06075, 8);
  expect(textCost("gpt-6-luna", { inputTokens: 10000, outputTokens: 1000 })).toBeCloseTo(0.0015, 8);
});

test("unknown configured models cannot silently report zero spend", () => {
  expect(() => textRates("unpriced-model")).toThrow("Configure verified pricing");
  expect(textCost("gpt-5.4-mini", { inputTokens: 10000, outputTokens: 1000 })).toBeCloseTo(0.012, 8);
  expect(WEB_SEARCH_USD).toBe(0.01);
});
