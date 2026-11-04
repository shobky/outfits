import { expect, test } from "@playwright/test";
import { hasAccess, isEmailAllowed } from "../../src/lib/access";
import { decideStudio } from "../../src/lib/intake/limits";

const allowed = { enabled: true, spentToday: 1, dailyBudget: 5, used: 3, allowance: 15 };

test.describe("studio limits", () => {
  test("allows a shot within every limit", () => {
    expect(decideStudio(allowed).ok).toBe(true);
  });
  for (const [name, change, text] of [
    ["the off switch", { enabled: false }, "paused"],
    ["the daily budget, exactly at the cap", { spentToday: 5 }, "today's limit"],
    ["the personal allowance, exactly at the cap", { used: 15 }, "15 free studio shots"],
  ] as const) {
    test(`stops at ${name}, with a reason`, () => {
      const d = decideStudio({ ...allowed, ...change });
      expect(d.ok).toBe(false);
      if (!d.ok) expect(d.note).toContain(text);
    });
  }
});

test("the owner skips the allowance, but not the off switch or the daily budget", () => {
  expect(decideStudio({ ...allowed, used: 500, unlimited: true }).ok).toBe(true);
  expect(decideStudio({ ...allowed, used: 500, unlimited: true, spentToday: 5 }).ok).toBe(false);
  expect(decideStudio({ ...allowed, unlimited: true, enabled: false }).ok).toBe(false);
});

test.describe("access", () => {
  const env = { ...process.env };
  test.afterEach(() => {
    process.env = { ...env };
  });
  const member = (found: boolean, error: unknown = null) =>
    ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: found ? { user_id: "u" } : null, error }) }) }) }) });

  test("open when nothing is configured", async () => {
    delete process.env.ALLOWED_EMAILS;
    delete process.env.INVITE_ONLY;
    expect(isEmailAllowed("a@b.c")).toBe(true);
    expect(await hasAccess(member(false), { id: "u", email: "a@b.c" })).toBe(true);
  });
  test("an email list keeps others out, and invites don't count without invite mode", async () => {
    process.env.ALLOWED_EMAILS = "Owner@x.com";
    delete process.env.INVITE_ONLY;
    expect(await hasAccess(member(false), { id: "u", email: "owner@X.com" })).toBe(true);
    expect(await hasAccess(member(true), { id: "u", email: "other@x.com" })).toBe(false);
  });
  test("invite mode admits members and the owner only", async () => {
    process.env.ALLOWED_EMAILS = "owner@x.com";
    process.env.INVITE_ONLY = "1";
    expect(await hasAccess(member(false), { id: "u", email: "owner@x.com" })).toBe(true);
    expect(await hasAccess(member(true), { id: "u", email: "friend@x.com" })).toBe(true);
    expect(await hasAccess(member(false), { id: "u", email: "stranger@x.com" })).toBe(false);
  });
  test("invite mode with no email list is still closed to strangers", async () => {
    delete process.env.ALLOWED_EMAILS;
    process.env.INVITE_ONLY = "1";
    expect(await hasAccess(member(false), { id: "u", email: "stranger@x.com" })).toBe(false);
  });
  test("a failed membership lookup means no access", async () => {
    process.env.INVITE_ONLY = "1";
    delete process.env.ALLOWED_EMAILS;
    expect(await hasAccess(member(true, new Error("down")), { id: "u", email: "friend@x.com" })).toBe(false);
  });
});

test("events accept only the known list", async ({ request }) => {
  expect((await request.post("/api/events", { data: { name: "app_open" } })).status()).toBe(200);
  expect((await request.post("/api/events", { data: { name: "anything_else" } })).status()).toBe(400);
});

test("the privacy page is readable and names who gets the photos", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy", exact: true })).toBeVisible();
  await expect(page.getByText("OpenAI", { exact: true })).toBeVisible();
  await expect(page.getByText("Delete my account")).toBeVisible();
});

test("the invite page renders", async ({ page }) => {
  await page.goto("/invite");
  await expect(page.getByRole("textbox", { name: "Invite code" })).toBeVisible();
});

test("account deletion isn't offered in local mode, and the route refuses", async ({ page, request }) => {
  await page.goto("/me");
  await expect(page.getByRole("button", { name: "Delete my account" })).toHaveCount(0);
  expect((await request.delete("/api/account")).status()).toBe(500);
});

test("studio allowance doesn't show when AI is off", async ({ page }) => {
  await page.goto("/me");
  await expect(page.getByText(/Studio shots/)).toHaveCount(0);
});

test("shop: pasting a product asks the stylist, and a card shows what was checked", async ({ page }) => {
  await page.goto("/shop");
  await page.getByRole("textbox", { name: "Product link" }).fill("http://localhost/private-page");
  await page.getByRole("button", { name: "Check it" }).click();
  await expect(page).toHaveURL(/\/stylist/);
  // A local address is refused by the safety check, so the card explains that it couldn't read the page.
  await expect(page.getByText("We couldn't read this page").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Demo mode/).first()).toBeVisible({ timeout: 30_000 });
});
