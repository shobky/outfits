// Network-first app shell plus the push/notification bridge. API calls and
// private images are never cached, and push payloads are treated as untrusted.
const CACHE = "outfits-v3";
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/offline.html", "/icons/icon-192.png?v=neon-1"])).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
));
self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const cacheable = ["script", "style", "font"].includes(e.request.destination) || url.pathname === "/manifest.webmanifest";
  if (e.request.method !== "GET" || url.pathname.startsWith("/api/") || url.origin !== location.origin) return;
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/offline.html").then((cached) => cached ?? new Response("You’re offline. Reconnect to open Outfits.", { status: 503, headers: { "content-type": "text/plain" } }))));
    return;
  }
  if (!cacheable) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((cached) => cached ?? new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } }))),
  );
});

self.addEventListener("push", (e) => {
  let payload = {};
  try { payload = e.data?.json() ?? {}; } catch { payload = { body: e.data?.text() ?? "" }; }
  const title = typeof payload.title === "string" && payload.title.length <= 80 ? payload.title : "Outfits";
  const body = typeof payload.body === "string" && payload.body.length <= 240 ? payload.body : "Your stylist has something for you.";
  let url = "/";
  if (typeof payload.url === "string") {
    try {
      const candidate = new URL(payload.url, self.location.origin);
      if (candidate.origin === self.location.origin && !candidate.href.startsWith(`${self.location.origin}//`)) url = `${candidate.pathname}${candidate.search}${candidate.hash}`;
    } catch {}
  }
  e.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/icons/icon-192.png?v=neon-1",
    badge: "/icons/icon-192.png?v=neon-1",
    tag: typeof payload.tag === "string" ? payload.tag.slice(0, 64) : "outfits",
    data: { url },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const path = e.notification.data?.url;
  let target = new URL("/", self.location.origin).href;
  if (typeof path === "string") {
    try {
      const candidate = new URL(path, self.location.origin);
      if (candidate.origin === self.location.origin) target = candidate.href;
    } catch {}
  }
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const existing = list.find((client) => "focus" in client);
    if (existing && "navigate" in existing) return existing.navigate(target).then((client) => client?.focus());
    return clients.openWindow(target);
  }));
});
