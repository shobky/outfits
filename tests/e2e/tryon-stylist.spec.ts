import { expect, test } from "@playwright/test";

test("the demo stylist proposes try-on without generating and pieces open details", async ({ page }) => {
  let generations = 0;
  await page.route("**/api/try-on", (route) => {
    if (route.request().method() === "POST") generations++;
    return route.fulfill({ status: 400, json: { error: "Generation is not part of this test" } });
  });
  await page.goto("/stylist?q=Try%20on%20an%20outfit%20on%20me");
  await expect(page.getByRole("heading", { name: "Picture yourself in this" })).toBeVisible({ timeout: 45000 });
  expect(generations).toBe(0);
  await page.getByRole("button", { name: /^View / }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(generations).toBe(0);
});

test("saved outfit pieces open a detail sheet", async ({ page }) => {
  await page.goto("/outfits");
  await page.getByRole("button", { name: /^View / }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Edit", exact: true })).toBeVisible();
});
