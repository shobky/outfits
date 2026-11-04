/**
 * Who gets an AI studio shot. Kept pure so the rules can be tested without a database.
 * A "no" never blocks a piece: it's saved with the owner's real photo instead.
 */
export const DEFAULT_FREE_STUDIO_SHOTS = 15;
export const DEFAULT_DAILY_BUDGET_USD = 5;

export type Decision = { ok: true } | { ok: false; note: string };

export function decideStudio(s: { enabled: boolean; spentToday: number; dailyBudget: number; used: number; allowance: number }): Decision {
  if (!s.enabled) return { ok: false, note: "Studio shots are paused right now, so this piece uses your photo." };
  if (s.spentToday >= s.dailyBudget) return { ok: false, note: "Studio shots have reached today's limit, so this piece uses your photo. Try again tomorrow." };
  if (s.used >= s.allowance) return { ok: false, note: `You've used your ${s.allowance} free studio shots, so this piece uses your photo.` };
  return { ok: true };
}

export function limitsFromEnv() {
  const num = (v: string | undefined, fallback: number) => {
    const n = Number(v);
    return v && Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    enabled: process.env.AI_STUDIO_ENABLED !== "0",
    dailyBudget: num(process.env.AI_DAILY_BUDGET_USD, DEFAULT_DAILY_BUDGET_USD),
    allowance: num(process.env.STUDIO_FREE_SHOTS, DEFAULT_FREE_STUDIO_SHOTS),
  };
}
