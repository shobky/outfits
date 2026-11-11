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
  usdPerM?: { input: number; output: number; cached: number; write?: number };
}

export const MODELS: ModelOption[] = [
  { id: "gpt-6-luna", label: "GPT-6 Luna", provider: "openai", hint: "Quick styling · default", usdPerM: { input: 0.1, output: 0.5, cached: 0.01, write: 0.125 } },
  { id: "gpt-6.1-terra", label: "GPT-6.1 Terra", provider: "openai", hint: "Detailed styling", developerOnly: true, usdPerM: { input: 1, output: 5, cached: 0.05, write: 1.25 } },
  { id: "demo", label: "Demo stylist", provider: "demo", hint: "Offline simulation, no API key" },
];

export const DEFAULT_MODEL_ID = "gpt-6-luna";
