import { getRepo, isSupabaseConfigured, unauthorized } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, rateLimited } from "@/lib/rate-limit";

/** The signed-in member's own invite codes, created lazily (up to 5). */
export async function GET() {
  const repo = await getRepo();
  if (!repo) return unauthorized();
  if (repo.mode !== "supabase") return Response.json({ error: "Invites aren't used in local mode" }, { status: 400 });
  try {
    return Response.json({ invites: await repo.listMyInvites() });
  } catch (e) {
    console.error("[invites]", e);
    return Response.json({ error: "We couldn't load your invites. Please try again." }, { status: 500 });
  }
}

/** Runs before the user has access, so it can't go through getRepo(), which would refuse them. */
export async function POST(req: Request) {
  if (!isSupabaseConfigured()) return Response.json({ error: "Invites aren't used in local mode" }, { status: 400 });
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return Response.json({ error: "Please sign in first" }, { status: 401 });
  if (!(await rateLimit("invite", 10, 600))) return rateLimited();
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code?.trim()) return Response.json({ error: "Enter your invite code" }, { status: 400 });
  const { data: ok, error } = await sb.rpc("redeem_invite", { invite: code });
  if (error) {
    console.error("[invite]", error);
    return Response.json({ error: "We couldn't check that code. Please try again." }, { status: 500 });
  }
  if (!ok) return Response.json({ error: "That code isn't valid or has been used" }, { status: 400 });
  return Response.json({ ok: true });
}
