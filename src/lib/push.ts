import "server-only";
import { sendNotification } from "web-push";
import type { Repo } from "./data/repo";
import { allowedPushEndpoint } from "./push-rules";

export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

/** Opted-in devices only. Failure to notify never invalidates a saved result. */
export async function notifyTryOnReady(repo: Repo) {
  if (!pushConfigured()) return;
  try {
    const subscriptions = (await repo.listPushSubscriptions()).slice(0, 10);
    await Promise.all(subscriptions.map(async (subscription) => {
      if (!allowedPushEndpoint(subscription.endpoint)) return;
      try {
        await sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          JSON.stringify({ title: "Your look is ready", body: "Open Outfits to see your saved preview.", url: "/me#saved-try-ons", tag: "try-on-ready" }),
          { TTL: 3600, timeout: 5000, vapidDetails: { publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, privateKey: process.env.VAPID_PRIVATE_KEY!, subject: process.env.VAPID_SUBJECT! } });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await repo.deletePushSubscription(subscription.endpoint);
        else console.warn("[push] delivery failed", status ?? "network/configuration");
      }
    }));
  } catch { console.warn("[push] could not read subscriptions"); }
}
