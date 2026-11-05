import "server-only";
import type { Repo } from "./data/repo";
import { FEATURES, type FeatureName } from "./features-shared";
import { isDeveloper } from "./developer";

/** `FEATURE_MULTI_PHOTO=0` stops a feature for everyone at once, including developers. */
export const featureEnabledGlobally = (name: FeatureName) => process.env[`FEATURE_${name.toUpperCase()}`] !== "0";

/** Which features this person has. Paid work depends on it, so a failed lookup means off. */
export async function enabledFeatures(repo: Repo): Promise<FeatureName[]> {
  try {
    const mine = isDeveloper(repo) ? ((await repo.getProfile()).dev_features ?? []) : await repo.memberFeatures();
    return (Object.keys(FEATURES) as FeatureName[]).filter((f) => mine.includes(f) && featureEnabledGlobally(f));
  } catch (e) {
    console.error("[features] couldn't read features", e);
    return [];
  }
}

export async function hasFeature(repo: Repo, name: FeatureName) {
  return (await enabledFeatures(repo)).includes(name);
}
