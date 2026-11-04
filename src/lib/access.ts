/**
 * Who may use a deployed app. Anyone can request a sign-in email, and the app spends
 * on the owner's API keys.
 *  - Neither setting: open to anyone.
 *  - ALLOWED_EMAILS: only those addresses.
 *  - INVITE_ONLY=1: those addresses, plus anyone who has redeemed an invite.
 */
const allowedList = () =>
  (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export const inviteOnly = () => process.env.INVITE_ONLY === "1";

export function isEmailAllowed(email: string | undefined) {
  const list = allowedList();
  if (email && list.includes(email.toLowerCase())) return true;
  return !list.length && !inviteOnly();
}

/** Minimal shape of the Supabase client, so both proxy and server code can use this. */
interface MemberLookup {
  from(table: "beta_members"): {
    select(columns: string): {
      eq(column: string, value: string): { maybeSingle(): PromiseLike<{ data: unknown; error: unknown }> };
    };
  };
}

/** A failed lookup means no access: an outage shouldn't open the app to everyone. */
export async function hasAccess(sb: MemberLookup, user: { id: string; email?: string }) {
  if (isEmailAllowed(user.email)) return true;
  if (!inviteOnly()) return false;
  const { data, error } = await sb.from("beta_members").select("user_id").eq("user_id", user.id).maybeSingle();
  return !error && !!data;
}
