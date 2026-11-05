import { getRepo, unauthorized } from "@/lib/data";
import { isFeatureName } from "@/lib/features-shared";
import { isDeveloper } from "@/lib/usage";

/** Checked twice: here by address, and again in the database by the admins table. */
async function adminRepo() {
  const repo = await getRepo();
  if (!repo) return { denied: unauthorized() };
  if (!isDeveloper(repo)) return { denied: Response.json({ error: "Not allowed" }, { status: 403 }) };
  return { repo };
}

const flags = () => ({
  inviteOnly: process.env.INVITE_ONLY === "1",
  studioEnabled: process.env.AI_STUDIO_ENABLED !== "0",
  dailyBudget: Number(process.env.AI_DAILY_BUDGET_USD) || 5,
  freeShots: Number(process.env.STUDIO_FREE_SHOTS) || 15,
  chatLimit: Number(process.env.CHAT_DAILY_LIMIT) || 20,
});

export async function GET() {
  const { repo, denied } = await adminRepo();
  if (!repo) return denied;
  try {
    return Response.json({ ...(await repo.adminOverview()), flags: flags() });
  } catch (e) {
    console.error("[admin]", e);
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 403 });
  }
}

type Body =
  | { action: "set_features"; user_id: string; features: string[] }
  | { action: "create_invite"; code: string; note?: string; max_uses?: number }
  | { action: "revoke_invite"; code: string };

export async function POST(req: Request) {
  const { repo, denied } = await adminRepo();
  if (!repo) return denied;
  const body = (await req.json().catch(() => ({}))) as Body;
  try {
    switch (body.action) {
      case "set_features":
        if (!body.features.every(isFeatureName)) return Response.json({ error: "Unknown feature" }, { status: 400 });
        await repo.adminSetFeatures(body.user_id, body.features);
        break;
      case "create_invite":
        if (!/^[A-Za-z0-9-]{4,40}$/.test(body.code ?? "")) return Response.json({ error: "Codes are 4 to 40 letters, numbers or dashes" }, { status: 400 });
        await repo.adminCreateInvite(body.code, body.note ?? null, body.max_uses ?? 1);
        break;
      case "revoke_invite":
        await repo.adminRevokeInvite(body.code);
        break;
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
    return Response.json({ ...(await repo.adminOverview()), flags: flags() });
  } catch (e) {
    console.error("[admin]", e);
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
