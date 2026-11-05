import { planModels } from "@/lib/ai/provider";
import { accountFor, hasPlanAccess, loopbackAddress } from "@/lib/chatgpt/oauth";
import { canCreateSession } from "@/lib/chatgpt/session";
import type { ChatGPTStatus } from "@/lib/chatgpt/shared";
import { readState } from "@/lib/chatgpt/store";
import { getRepo } from "@/lib/data";

const HOSTED: ChatGPTStatus = { available: false, canSignIn: false, connected: false, sharing: false, email: null, knownAccount: false, models: [] };

export async function GET(request: Request) {
  if (!loopbackAddress(request)) return Response.json(HOSTED);
  const repo = await getRepo();
  const account = accountFor(repo?.userId);
  const sharing = hasPlanAccess(account);
  const models = sharing && repo ? await planModels(repo.userId).catch((e) => (console.warn("[chatgpt] model list failed", (e as Error).message), [])) : [];
  return Response.json({
    available: true,
    canSignIn: canCreateSession(),
    connected: !!account,
    sharing,
    email: account?.email ?? null,
    knownAccount: !!readState().lastClientId,
    models,
  } satisfies ChatGPTStatus);
}
