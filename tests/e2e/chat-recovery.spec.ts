import { expect, test } from "@playwright/test";

test("failed saved chats retain navigation and can retry", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let failing = true;
  await page.route("**/api/chats/recovery-chat", (route) => route.fulfill(failing
    ? { status: 503, json: { error: "Unavailable" } }
    : { json: { messages: [] } }));
  await page.goto("/stylist?c=recovery-chat");
  await expect(page.getByRole("heading", { name: "This chat couldn’t load" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to drawer" })).toBeVisible();
  failing = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByPlaceholder("What are we dressing for?")).toBeVisible();
});

test("leaving a loading chat ignores its late response", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/chats/slow-chat", async (route) => {
    await held;
    await route.fulfill({ json: { messages: [{ id: "late", role: "assistant", parts: [{ type: "text", text: "Stale conversation" }] }] } }).catch(() => undefined);
  });
  await page.goto("/stylist?c=slow-chat");
  await page.getByRole("button", { name: "New chat", exact: true }).first().click();
  release();
  await expect(page).toHaveURL(/\/stylist$/);
  await expect(page.getByPlaceholder("What are we dressing for?")).toBeVisible();
  await expect(page.getByText("Stale conversation")).toHaveCount(0);
});
