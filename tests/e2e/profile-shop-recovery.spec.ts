import { expect, test } from "@playwright/test";

test("profile recovers from a failed load and exposes photo shortcuts", async ({ page }) => {
  let failing = true;
  await page.route("**/api/profile", (route) => failing
    ? route.fulfill({ status: 503, json: { error: "Unavailable" } })
    : route.continue());
  await page.goto("/me");
  await expect(page.getByRole("alert").filter({ hasText: "Couldn’t load your profile" })).toBeVisible();
  failing = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  const shortcuts = page.getByRole("navigation", { name: "Profile sections" });
  await expect(shortcuts).toBeVisible();
  await shortcuts.getByRole("link", { name: "Saved previews" }).click();
  await expect(page.locator("#saved-try-ons")).toBeInViewport();
});

test("shop leads with suggestions and keeps secondary tools reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/shop");
  const card = page.locator("article").first();
  await expect(card).toBeVisible();
  expect((await card.boundingBox())!.y).toBeLessThan(450);
  await expect(page.getByRole("textbox", { name: "Product link to check" })).toBeHidden();
  await page.getByText("Check a product or find wardrobe gaps", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Product link to check" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Find my wardrobe gaps/ })).toBeVisible();
});

test("outfit boards keep repeated slots reachable and show missing image feedback", async ({ page }) => {
  await page.route("**/api/outfits", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const tops = data.items.filter((item: { category: string }) => item.category === "top").slice(0, 2);
    expect(tops).toHaveLength(2);
    data.items = data.items.map((item: { id: string }) => item.id === tops[0].id ? { ...item, image_url: null } : item);
    data.outfits[0].items = tops.map((item: { id: string }) => ({ item_id: item.id, slot: "top" }));
    await route.fulfill({ json: data });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/outfits");
  const card = page.locator("article").first();
  await expect(card.getByText("No photo", { exact: true })).toBeVisible();
  const pieces = card.getByRole("button", { name: /^View / });
  await expect(pieces).toHaveCount(2);
  const first = (await pieces.nth(0).boundingBox())!;
  const second = (await pieces.nth(1).boundingBox())!;
  expect(first.x + first.width).toBeLessThanOrEqual(second.x);
  await pieces.nth(1).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
