import "server-only";
import { isListedEmail } from "./access";
import type { Repo } from "./data/repo";
import { limitsFromEnv } from "./intake/limits";
import { DEFAULT_CHAT_DAILY_LIMIT, DEFAULT_PHOTO_DAILY_LIMIT, envNumber, nextReset, type Usage } from "./usage-rules";

export const chatDailyLimit = () => envNumber(process.env.CHAT_DAILY_LIMIT, DEFAULT_CHAT_DAILY_LIMIT);
export const photoDailyLimit = () => envNumber(process.env.INTAKE_DAILY_PHOTO_LIMIT, DEFAULT_PHOTO_DAILY_LIMIT);

/** The owner's addresses, and anyone on their own machine in local mode. Decided here, never by the browser. */
export const isDeveloper = (repo: Repo) => repo.mode === "demo" || isListedEmail(repo.email);

/** The switch only counts for developers, so a user setting the column directly gains nothing. */
export async function limitsAreOff(repo: Repo) {
  if (!isDeveloper(repo)) return false;
  return (await repo.getProfile()).limits_off === true;
}

export async function getUsage(repo: Repo): Promise<Usage> {
  const resetsAt = nextReset();
  const developer = isDeveloper(repo);
  // One failed number shouldn't blank the rest of the screen.
  const safe = <T,>(p: Promise<T>) => p.catch((e) => (console.warn("[usage]", e), null));
  const [chats, photos, shots, off, spent] = await Promise.all([
    safe(repo.chatMessagesToday()),
    safe(repo.countIntakePhotosToday()),
    process.env.OPENAI_API_KEY ? safe(repo.studioShotsUsed()) : Promise.resolve(null),
    safe(limitsAreOff(repo)),
    developer ? safe(repo.aiSpendToday()) : Promise.resolve(null),
  ]);
  return {
    chat: chats === null ? null : { used: chats, limit: chatDailyLimit(), resetsAt },
    photos: photos === null ? null : { used: photos, limit: photoDailyLimit(), resetsAt },
    studio: shots === null ? null : { used: shots, limit: limitsFromEnv().allowance },
    developer,
    limitsOff: off === true,
    spentToday: spent,
  };
}
