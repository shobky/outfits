/**
 * Model registry shown in the chat's model pill. Add providers here
 * (e.g. `@ai-sdk/anthropic`) — the chat route resolves ids through `resolveModel`.
 * Keep this file client-safe (no secrets); availability is checked server-side.
 */
export interface ModelOption {
  id: string;
  label: string;
  provider: "openai" | "demo";
  hint: string;
  /** Costs far more per message, so ordinary accounts don't get it. */
  developerOnly?: boolean;
  /** $ per million tokens, from OpenAI's pricing page, 2026-11. Used to record spend. */
  usdPerM?: { input: number; output: number };
}

export const MODELS: ModelOption[] = [
  { id: "gpt-5.4-mini", label: "GPT-5.4 mini", provider: "openai", hint: "Fast · default", usdPerM: { input: 0.75, output: 4.5 } },
  { id: "gpt-5.5", label: "GPT-5.5", provider: "openai", hint: "Best taste · slower", developerOnly: true, usdPerM: { input: 5, output: 30 } },
  { id: "demo", label: "Demo stylist", provider: "demo", hint: "Offline simulation, no API key" },
];

export const DEFAULT_MODEL_ID = "gpt-5.4-mini";
