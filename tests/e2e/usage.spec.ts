import { expect, test, type Page } from "@playwright/test";
import { canChat, nextReset, startOfDay, timeUntil, type Usage } from "../../src/lib/usage-rules";

const reset = "2031-01-01T00:00:00.000Z";
const usage = (over: Partial<Usage> = {}): Usage => ({
  chat: { used: 0, limit: 20, resetsAt: reset },
  photos: { used: 0, limit: 60, resetsAt: reset },
  studio: { used: 3, limit: 15 },
  developer: true,
  limitsOff: false,
  spentToday: 0.12,
  features: [],
  ...over,
});
const fake = (page: Page, u: Usage) => page.route("**/api/usage", (r) => r.fulfill({ json: u }));

// "Demo stylist" is free and exempt, so these pick a real model. Nothing reaches OpenAI: without a key the server uses the demo.
const realModel = (page: Page) => page.addInitScript(() => localStorage.setItem("outfits:model", "gpt-5.4-mini"));

test.describe("rules", () => {
  test("every day's allowance resets at the next UTC midnight", () => {
    const now = new Date("2026-11-05T22:30:00.000Z");
    expect(nextReset(now)).toBe("2026-11-06T00:00:00.000Z");
    expect(startOfDay(now)).toBe("2026-11-05T00:00:00.000Z");
    expect(nextReset(new Date("2026-12-31T23:59:00.000Z"))).toBe("2027-01-01T00:00:00.000Z");
  });

  test("the limit stops at exactly the limit, and limits off ignores it", () => {
    expect(canChat({ used: 19, limit: 20, limitsOff: false })).toBe(true);
    expect(canChat({ used: 20, limit: 20, limitsOff: false })).toBe(false);
    expect(canChat({ used: 500, limit: 20, limitsOff: true })).toBe(true);
  });

  test("time until reads naturally", () => {
    const now = new Date("2026-11-05T21:00:00.000Z");
    expect(timeUntil("2026-11-06T00:00:00.000Z", now)).toBe("in 3h");
    expect(timeUntil("2026-11-05T22:12:00.000Z", now)).toBe("in 1h 12m");
    expect(timeUntil("2026-11-05T21:30:00.000Z", now)).toBe("in 30m");
  });
});

test.describe("stylist", () => {
  test("plenty left: no warning", async ({ page }) => {
    await realModel(page);
    await fake(page, usage({ chat: { used: 3, limit: 20, resetsAt: reset } }));
    await page.goto("/stylist");
    await expect(page.getByPlaceholder("What are we dressing for?")).toBeVisible();
    await expect(page.getByText(/left today/)).toHaveCount(0);
  });

  test("near the limit: a gentle count with the reset time", async ({ page }) => {
    await realModel(page);
    await fake(page, usage({ chat: { used: 18, limit: 20, resetsAt: reset } }));
    await page.goto("/stylist");
    await expect(page.getByText(/2 messages left today\. More at/)).toBeVisible();
  });

  test("at the limit: a rest card replaces the composer", async ({ page }) => {
    await realModel(page);
    await fake(page, usage({ chat: { used: 20, limit: 20, resetsAt: reset } }));
    await page.goto("/stylist");
    await expect(page.getByText("That's today's styling done")).toBeVisible();
    await expect(page.getByText(/used all 20 messages/)).toBeVisible();
    await expect(page.getByPlaceholder("What are we dressing for?")).toHaveCount(0);
    await page.getByRole("link", { name: "Open my drawer" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("limits off: no rest card even past the limit", async ({ page }) => {
    await realModel(page);
    await fake(page, usage({ chat: { used: 99, limit: 20, resetsAt: reset }, limitsOff: true }));
    await page.goto("/stylist");
    await expect(page.getByPlaceholder("What are we dressing for?")).toBeVisible();
    await expect(page.getByText("That's today's styling done")).toHaveCount(0);
  });

  test("hitting the limit mid-conversation shows the card, not raw JSON", async ({ page }) => {
    await realModel(page);
    let out = false;
    await page.route("**/api/usage", (r) => r.fulfill({ json: usage({ chat: { used: out ? 20 : 19, limit: 20, resetsAt: reset } }) }));
    await page.route("**/api/chat", (r) => {
      out = true;
      return r.fulfill({ status: 429, json: { error: "You've used today's messages.", code: "chat_limit" } });
    });
    await page.goto("/stylist");
    await page.getByPlaceholder("What are we dressing for?").fill("What should I wear?");
    await page.keyboard.press("Enter");
    await expect(page.getByText("That's today's styling done")).toBeVisible();
    await expect(page.getByText(/chat_limit/)).toHaveCount(0);
  });
});

test.describe("profile", () => {
  test("usage is shown with what's left", async ({ page }) => {
    await fake(page, usage({ chat: { used: 8, limit: 20, resetsAt: reset } }));
    await page.goto("/me");
    await expect(page.getByText("12 of 20 today left")).toBeVisible();
    await expect(page.getByText("12 of 15 free left")).toBeVisible();
    await expect(page.getByText(/Daily allowances come back at/)).toBeVisible();
  });

  test("non-developers don't see the developer menu", async ({ page }) => {
    await fake(page, usage({ developer: false, spentToday: null }));
    await page.goto("/me");
    await expect(page.getByText("Your usage")).toBeVisible();
    await expect(page.getByRole("switch", { name: "Turn off usage limits" })).toHaveCount(0);
  });

  test("the developer switch really changes the account, and survives a reload", async ({ page }) => {
    await page.goto("/me");
    const toggle = page.getByRole("switch", { name: "Turn off usage limits" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await page.reload();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("Limits are off for your account.")).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  test("saving the profile can't flip the limits switch", async ({ request }) => {
    await request.patch("/api/profile", { data: { limits_off: true } });
    const u = await (await request.get("/api/usage")).json();
    expect(u.limitsOff).toBe(false);
  });
});
