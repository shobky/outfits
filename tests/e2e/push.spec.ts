import { expect, test } from "@playwright/test";
import { allowedPushEndpoint } from "../../src/lib/push-rules";

test("push delivery rejects arbitrary, credentialed and insecure endpoints", () => {
  for (const endpoint of ["http://fcm.googleapis.com/x", "https://localhost/x", "https://127.0.0.1/x", "https://fcm.googleapis.com.evil.test/x", "https://user@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x"])
    expect(allowedPushEndpoint(endpoint)).toBe(false);
  for (const endpoint of ["https://fcm.googleapis.com/fcm/send/example", "https://web.push.apple.com/example", "https://updates.push.services.mozilla.com/wpush/example"])
    expect(allowedPushEndpoint(endpoint)).toBe(true);
});

test("unconfigured push does not invite the user to subscribe", async ({ request, page }) => {
  const response = await request.get("/api/push/subscribe");
  expect((await response.json()).configured).toBe(false);
  await page.goto("/me");
  await expect(page.getByText("Alerts will appear here once push delivery is configured.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable alerts" })).toHaveCount(0);
});
