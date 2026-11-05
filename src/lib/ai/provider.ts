import "server-only";
import { createOpenAI, openai, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import { accessTokenFor, accountFor, hasPlanAccess, ReconnectNeeded } from "../chatgpt/oauth";
import { USAGE_LIMIT_MESSAGE } from "../chatgpt/shared";

const API_BASE = "https://api.openai.com/v1";

function planFetch(owner: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("authorization", `Bearer ${await accessTokenFor(owner)}`);
    // A redirect would forward the token and the request to another origin.
    return fetch(input, { ...init, headers, redirect: "error" });
  };
}

type CatalogEntry = { id: string; label: string };
const CATALOG_TTL_MS = 5 * 60 * 1000;
const catalogs: Map<string, { at: number; models: CatalogEntry[] }> = ((globalThis as { __chatgptCatalogs?: Map<string, { at: number; models: CatalogEntry[] }> }).__chatgptCatalogs ??= new Map());

/** The models this account may use. It differs per account, so nothing here is hardcoded. */
export async function planModels(owner: string): Promise<CatalogEntry[]> {
  const cached = catalogs.get(owner);
  if (cached && Date.now() - cached.at < CATALOG_TTL_MS) return cached.models;
  const res = await planFetch(owner)(`${API_BASE}/models`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`The ChatGPT model list returned ${res.status}`);
  const body = (await res.json()) as { models?: { slug?: string; display_name?: string; visibility?: string }[] };
  const models = (body.models ?? []).flatMap((m) => (m.visibility === "list" && m.slug ? [{ id: m.slug, label: m.display_name || m.slug }] : []));
  catalogs.set(owner, { at: Date.now(), models });
  return models;
}

/**
 * Who pays for this person's AI. A connected plan always wins and never falls back to
 * the API key: when the plan can't serve a request, they're told so instead of the
 * owner of the key quietly being charged.
 */
export type AIAccess =
  | { source: "plan"; provider: ReturnType<typeof createOpenAI>; options: OpenAILanguageModelResponsesOptions; maxRetries: 0; pickModel: PickModel }
  | { source: "key"; provider: typeof openai; options: OpenAILanguageModelResponsesOptions; maxRetries: undefined; pickModel: PickModel }
  | { source: "none" };

/** `light` asks for a small model when the wanted one isn't available. */
type PickModel = (wanted?: string, light?: boolean) => Promise<string>;
/** OpenAI's API names gpt-6-luna as the faster model for gpt-6.1-sol. */
const LIGHT_MODEL = /luna/i;

export function resolveAI(owner: string): AIAccess {
  if (hasPlanAccess(accountFor(owner))) {
    return {
      source: "plan",
      provider: createOpenAI({ baseURL: API_BASE, apiKey: "chatgpt-plan-token", fetch: planFetch(owner) }),
      // Required on this route: nothing is stored at OpenAI, so history is resent, and "system" items are refused.
      options: { store: false, systemMessageMode: "developer" },
      // Retrying wouldn't help at a usage limit, and the docs ask for it to be reported immediately.
      maxRetries: 0,
      pickModel: async (wanted, light) => {
        const models = await planModels(owner);
        if (!models.length) throw new Error("This ChatGPT account has no models available for use here.");
        const exact = models.find((m) => m.id === wanted);
        // The catalog lists its largest model first, which would spend the plan on routine work.
        const small = light ? models.find((m) => LIGHT_MODEL.test(m.id)) : undefined;
        return (exact ?? small ?? models[0]).id;
      },
    };
  }
  if (process.env.OPENAI_API_KEY) return { source: "key", provider: openai, options: {}, maxRetries: undefined, pickModel: async (wanted) => wanted ?? "" };
  return { source: "none" };
}

const PLAN_ERRORS: Record<string, string> = {
  subscription_sharing_usage_limit_exceeded: USAGE_LIMIT_MESSAGE,
  subscription_sharing_user_not_eligible: "ChatGPT plan usage isn't available for this account or workspace.",
  subscription_sharing_usage_unavailable: "ChatGPT couldn't check your plan's usage just now. Try again in a moment.",
  subscription_sharing_user_unavailable: "ChatGPT couldn't check your account just now. Try again in a moment.",
  subscription_sharing_unsupported_capability: "Your ChatGPT plan doesn't support this request here. Try another model.",
};

/** A sentence the person can act on. The codes can arrive in the response body or mid-stream. */
export function explainAIError(e: unknown) {
  if (e instanceof ReconnectNeeded) return e.message;
  // Mid-stream failures arrive as the provider's plain event object rather than an Error.
  const err = e as { message?: string; responseBody?: string; cause?: { responseBody?: string; message?: string } } | undefined;
  const text = e instanceof Error ? [err?.message, err?.responseBody, err?.cause?.responseBody, err?.cause?.message].filter(Boolean).join(" ") : JSON.stringify(e) ?? "";
  for (const [code, message] of Object.entries(PLAN_ERRORS)) if (text.includes(code)) return message;
  return e instanceof Error ? e.message : "Something went wrong";
}
