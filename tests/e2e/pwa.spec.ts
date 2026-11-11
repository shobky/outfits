import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "allow" });

test("installed app exposes share shortcuts and a private-data-free offline fallback", async ({ page, context, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ id: "/", scope: "/", display: "standalone", share_target: { action: "/share/target", method: "POST" } });
  expect(manifest.shortcuts).toHaveLength(2);
  await page.goto("/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.goto("/me");
  const cached = await page.evaluate(async () => {
    const cache = await caches.open("outfits-v3");
    return (await cache.keys()).map((entry) => new URL(entry.url).pathname);
  });
  expect(cached).not.toContain("/me");
  expect(cached.some((path) => path.startsWith("/api/"))).toBe(false);
  await context.setOffline(true);
  await page.goto("/outfits");
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Outfits", exact: true })).toBeVisible();
});
