/** Client-safe pieces of the Sign in with ChatGPT integration. */
export const MANAGE_USAGE_URL = "https://chatgpt.com/settings/usage";

/** Starts every chat error caused by the plan's limit, so the chat can offer "Manage usage". */
export const USAGE_LIMIT_MESSAGE = "Usage limit reached. Review your plan's limit in ChatGPT settings.";

export type ChatGPTStatus = {
  /** This address can complete the sign-in. OpenAI only allows 127.0.0.1 redirects for plan usage. */
  available: boolean;
  /** A new session can be created here, as well as linking a plan to an existing one. */
  canSignIn: boolean;
  connected: boolean;
  /** Connected, and the account allowed its plan to be used. */
  sharing: boolean;
  email: string | null;
  /** A saved account on this computer, offered as "use another account" alongside it. */
  knownAccount: boolean;
  models: { id: string; label: string }[];
};
