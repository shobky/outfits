import { expect, test } from "@playwright/test";

test("drawer load failure offers retry and preserves the empty state distinction", async ({ page }) => {
  let failing = true;
  await page.route("**/api/items?*", (route) => failing
    ? route.fulfill({ status: 503, json: { error: "Unavailable" } })
    : route.continue());
  await page.goto("/");
  await expect(page.getByText("Your drawer is empty", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
  failing = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("button", { name: "White heavyweight tee", exact: true })).toBeVisible();
});

test("failed item save retains its draft and confirmed wardrobe data", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "White heavyweight tee", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Edit piece", exact: true });
  await sheet.locator("input").first().fill("Unsaved rename");
  await page.route("**/api/items/*", (route) => route.abort());
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await expect(sheet.getByRole("alert")).toBeVisible();
  await expect(sheet.locator("input").first()).toHaveValue("Unsaved rename");
  await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "White heavyweight tee", exact: true })).toBeVisible();
});
