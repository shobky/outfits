import "server-only";
import { isListedEmail } from "../access";
import type { Repo } from "../data/repo";
import { decideStudio, limitsFromEnv, type Decision } from "./limits";

/** If limits can't be read, spending stops: an outage must not become an open-ended bill. */
export async function checkStudio(repo: Repo): Promise<Decision> {
  try {
    const limits = limitsFromEnv();
    const [spentToday, used] = await Promise.all([repo.aiSpendToday(), repo.studioShotsUsed()]);
    return decideStudio({ ...limits, spentToday, used, unlimited: isListedEmail(repo.email) });
  } catch (e) {
    console.error("[budget] couldn't read limits", e);
    return { ok: false, note: "We couldn't make a studio shot just now, so this piece uses your photo." };
  }
}

/** Reading photos is cheap but still spends, so it respects the same daily cap. */
export async function canReadPhotos(repo: Repo) {
  try {
    return (await repo.aiSpendToday()) < limitsFromEnv().dailyBudget;
  } catch (e) {
    console.error("[budget] couldn't read limits", e);
    return false;
  }
}

export async function record(repo: Repo, kind: "vision" | "studio", usd: number) {
  await repo.recordAiSpend(kind, usd).catch((e) => console.error("[budget] spend not recorded", e));
}
