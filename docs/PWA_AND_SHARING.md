# PWA, sharing and notifications

## What ships in code

- Install manifest with stable ID/scope, standalone display, maskable icons,
  share target and shortcuts for photo styling/product saving.
- Service worker caches static resources only. Authenticated documents, API
  responses and private photos are network-only. Offline navigation shows a
  generic reconnect page, never another session's cached wardrobe.
- `/share` accepts a product URL or up to four JPEG/PNG/WebP photos. Uploaded
  files are decoded, oriented, bounded to 2048px and stored privately. The review
  screen asks whether to style, add to the Drawer, save a product or discard.
- Product facts are verified where possible; otherwise the URL is saved with
  no invented image, price or currency. Existing wishlist deduplication applies.
- Explicit Drawer handoff transfers private source-photo lifetime to the
  intake batch. Chat handoff embeds image data in saved history before removing
  staging files. Discard removes staged photos. The share intent is owner-scoped
  and expires after a day, but abandoned expired objects still need scheduled
  cleanup before large-scale operation. Expiry alone is not file deletion.
- Push opt-in on Profile; authenticated subscription storage; encrypted Web Push
  delivery after a try-on result is saved. Failures never delete or invalidate
  results. Expired subscriptions (404/410) are removed. Notification content is
  generic and contains no user photos or measurements.

## Setup before deployment

Apply the saved-try-on migration plus `20261111120000_share_intents_and_push.sql`; this
code has not applied production migrations. Existing private bucket migrations
0009/0010 are prerequisites. Retain the migration runner's ordering safeguards.

Generate a stable VAPID pair with:

```sh
pnpm exec web-push generate-vapid-keys --json
```

Store the public key as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, private key as
`VAPID_PRIVATE_KEY`, and a real contact URI as `VAPID_SUBJECT`. Rebuild after
setting the public key. Never commit the private key. No keys were generated or
production alerts sent during this review. All three settings are required;
without them the app explains that alerts are not configured.

Push uses browser services from Apple, Google and Mozilla. The server checks an
endpoint allowlist at both registration and delivery to prevent arbitrary
outbound requests. Daily scheduled outfit alerts are not implemented; only
completed try-on notifications are wired.

## Platform behavior

On supported Android browsers, install Outfits, sign in, then choose Outfits
from another app's Share menu. The receiving review screen makes no AI call
until an action is chosen. The manifest requests supported image types only.
Some browsers/OS versions do not expose manifest shortcuts.

On iPhone/iPad, incoming PWA share targets are not supported like Android's.
Use Profile → Open share inbox to choose photos or paste a copied product link.
A native iOS Share Extension would require a native container/app distribution;
this implementation does not pretend that a manifest enables it. Outgoing
sharing uses Web Share where available with a clipboard fallback.

If signed out when sharing, the app asks the user to sign in and share again;
the original POST is not forwarded to the login page. Anonymous photo staging
and preserving OS payloads across authentication are not implemented. The login
notice states this explicitly. Do not claim seamless signed-out handoff.

Web Push on iPhone/iPad requires an installed Home Screen web app (iOS/iPadOS
16.4+) and permission granted through a direct user action. Use HTTPS in
production. A desktop browser screenshot or mocked subscription cannot prove
delivery on a real device.

Sources checked 11 November 2026:
[WebKit Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/),
[MDN share_target](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target),
[Web Push library API](https://github.com/web-push-libs/web-push).

## Required release checks

Install from HTTPS on Android and iPhone; test share-sheet availability,
multi-photo shares, copied retailer links, signed-out recovery, Home Screen
launch, permission denial, opt-in/out, a completed try-on notification while the
app is backgrounded, notification navigation, and offline reconnect. Test two
Supabase accounts for intent/run isolation. Local demo tests do not prove RLS
or real-device delivery.
