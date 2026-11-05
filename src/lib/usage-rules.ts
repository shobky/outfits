/** Daily allowances. Pure, so the rules can be tested without a database. */
export const DEFAULT_CHAT_DAILY_LIMIT = 20;
export const DEFAULT_PHOTO_DAILY_LIMIT = 60;
/** The app starts warning when this many are left. */
export const WARN_AT = 5;

export function envNumber(v: string | undefined, fallback: number) {
  const n = Number(v);
  return v && Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** All daily allowances come back at the same moment: midnight UTC. */
export function nextReset(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}

export function startOfDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export function canChat(s: { used: number; limit: number; limitsOff: boolean }) {
  return s.limitsOff || s.used < s.limit;
}

export interface UsageAllowance {
  used: number;
  limit: number;
  resetsAt: string;
}

export interface Usage {
  chat: UsageAllowance | null;
  photos: UsageAllowance | null;
  studio: { used: number; limit: number } | null;
  developer: boolean;
  limitsOff: boolean;
  /** Only sent to developers. */
  spentToday: number | null;
}

/** "in 3h 12m", for a reset time in the future. */
export function timeUntil(iso: string, now = new Date()) {
  const mins = Math.max(1, Math.ceil((new Date(iso).getTime() - now.getTime()) / 60000));
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}
