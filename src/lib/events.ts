/** What the beta measures. A fixed list keeps it small, and keeps personal data out of it. */
export const EVENT_NAMES = ["app_open", "batch_created", "piece_added", "chat_sent", "outfit_saved", "worn_logged", "shop_suggestion_tap", "product_check", "share_received"] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export const isEventName = (v: unknown): v is EventName => typeof v === "string" && (EVENT_NAMES as readonly string[]).includes(v);

/** Measurement must never get in the way of the app, so failures are ignored. */
export function track(name: EventName, props?: Record<string, string | number | boolean>) {
  void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, props }), keepalive: true }).catch(() => {});
}
