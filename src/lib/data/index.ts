import "server-only";
import { connection } from "next/server";
import { demoRepo } from "./demo";
import { isSupabaseConfigured, type Repo } from "./repo";

export type { Repo } from "./repo";
export { isSupabaseConfigured } from "./repo";

/** Returns the repo for the current request, or null if not signed in. */
export async function getRepo(): Promise<Repo | null> {
  await connection(); // always request-time (never prerender user data)
  if (!isSupabaseConfigured()) return demoRepo;
  const { createClient } = await import("../supabase/server");
  const { supabaseRepo } = await import("./supabase");
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  return supabaseRepo(sb, data.user.id);
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
