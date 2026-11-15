import { expect, test } from "@playwright/test";

const savedRuns = () => [1, 2, 3, 4].map((n) => ({
  id: `mobile-run-${n}`,
  created_at: `2026-11-${String(20 - n).padStart(2, "0")}T10:00:00.000Z`,
  result_url: "/demo/tee-white.svg",
  recipe: {
    item_ids: [],
    person_url: "/demo/person.jpg",
    identity_urls: [],
    garment_urls: ["/demo/tee-white.svg"],
    fit_context: "",
    garment_context: "",
    title: n === 1 ? "A very long saved look title that should wrap without pushing actions out of the card" : `Saved look ${n}`,
  },
}));

async function enableTryOn(page: import("@playwright/test").Page) {
  await page.route("**/api/usage", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, features: [...new Set([...(body.features ?? []), "try_on"])] } });
  });
}

test("saved try-ons stay within the profile card and support a longer history", async ({ page }) => {
  let runs = savedRuns();
  await page.route("**/api/try-on", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { runs } });
    if (route.request().method() === "DELETE") {
      const body = route.request().postDataJSON() as { id?: string };
      runs = runs.filter((run) => run.id !== body.id);
      return route.fulfill({ json: { ok: true } });
    }
    return route.continue();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/me");
  const archive = page.locator("#saved-try-ons");
  await expect(archive.getByRole("heading", { name: "Saved try-ons" })).toBeVisible();
  await expect(archive.getByRole("button", { name: /Open saved try-on/ })).toHaveCount(3);
  await expect(archive.getByRole("button", { name: "Show all 4" })).toBeVisible();

  const firstCard = archive.locator("article").first();
  const cardRect = await firstCard.boundingBox();
  const menuRect = await firstCard.getByRole("button", { name: /More actions/ }).boundingBox();
  expect(cardRect).not.toBeNull();
  expect(menuRect).not.toBeNull();
  expect(menuRect!.x + menuRect!.width).toBeLessThanOrEqual(cardRect!.x + cardRect!.width);

  await archive.getByRole("button", { name: "Show all 4" }).click();
  await expect(archive.getByRole("button", { name: /Open saved try-on/ })).toHaveCount(4);
  await archive.getByRole("button", { name: /Open saved try-on: Saved look 4/ }).click();
  await expect(page.getByRole("dialog", { name: "Try it on", exact: true })).toBeVisible();
});

test("deleting a saved try-on removes it and returns focus to the archive", async ({ page }) => {
  let runs = savedRuns();
  await page.route("**/api/try-on", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { runs } });
    if (route.request().method() === "DELETE") {
      const body = route.request().postDataJSON() as { id?: string };
      runs = runs.filter((run) => run.id !== body.id);
      return route.fulfill({ json: { ok: true } });
    }
    return route.continue();
  });
  page.on("dialog", (dialog) => void dialog.accept());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/me");
  const archive = page.locator("#saved-try-ons");
  await archive.getByRole("button", { name: /More actions for/ }).first().click();
  await page.getByRole("menuitem", { name: "Delete saved preview" }).click();
  await expect(archive.getByRole("button", { name: /Open saved try-on/ })).toHaveCount(3);
  await expect(archive.getByRole("button", { name: /More actions for Saved look 2/ })).toBeFocused();
});

test("outfit primary actions fit beside each other on a narrow card", async ({ page }) => {
  await enableTryOn(page);
  await page.route("**/api/outfits", (route) => route.fulfill({ json: {
    outfits: [{ id: "mobile-outfit", user_id: "demo", name: "A very long outfit name that wraps", occasion: "casual", notes: null, source: "user", is_favorite: false, weather: null, items: [], created_at: new Date().toISOString() }],
    items: [],
  } }));
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/outfits");
  const card = page.locator("article").filter({ hasText: "Wore it today" });
  await expect(card.getByRole("button", { name: "Wore it today" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Try it on" })).toBeVisible();
  const cardRect = await card.boundingBox();
  const actionRects = await Promise.all(["Wore it today", "Try it on"].map((name) => card.getByRole("button", { name }).boundingBox()));
  expect(cardRect).not.toBeNull();
  for (const rect of actionRects) {
    expect(rect).not.toBeNull();
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(cardRect!.x + cardRect!.width);
    expect(rect!.height).toBeGreaterThanOrEqual(44);
  }
});

test("wear fills the outfit footer when try-on is unavailable", async ({ page }) => {
  await page.route("**/api/usage", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ json: { ...await response.json(), features: [] } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/outfits");
  const wear = page.getByRole("button", { name: "Wore it today", exact: true }).first();
  await expect(wear).toBeVisible();
  await expect(page.getByRole("button", { name: "Try it on", exact: true })).toHaveCount(0);
  const width = await wear.evaluate((element) => ({ button: element.getBoundingClientRect().width, footer: element.parentElement!.getBoundingClientRect().width }));
  expect(width.button).toBeGreaterThanOrEqual(width.footer - 1);
});
