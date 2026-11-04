/**
 * Who may use a deployed app. Signing in is open to any email, and the app spends
 * on the owner's API keys, so production sets ALLOWED_EMAILS. Unset means anyone.
 */
export function isEmailAllowed(email: string | undefined) {
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length) return true;
  return !!email && allowed.includes(email.toLowerCase());
}
