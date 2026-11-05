import { devices, expect, test } from "@playwright/test";

const { viewport, deviceScaleFactor, isMobile, hasTouch } = devices["iPhone 14 Pro"];
test.use({ viewport, deviceScaleFactor, isMobile, hasTouch });

async function openSheet(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Stone chinos", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  return sheet;
}

async function dragHandle(page: import("@playwright/test").Page, by: number) {
  const box = (await page.getByTestId("sheet-drag").boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + 8;
  await page.mouse.move(x, y);
  await page.mouse.down();
  // Slow steps, so this tests distance and not a flick.
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(x, y + (by * i) / 10);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
}

test("dragging the handle far enough closes the drawer", async ({ page }) => {
  await openSheet(page);
  await dragHandle(page, 220);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a small drag springs back and stays open", async ({ page }) => {
  const sheet = await openSheet(page);
  await dragHandle(page, 40);
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(350);
  await expect.poll(() => sheet.evaluate((el) => (el as HTMLElement).style.transform)).toBe("");
});

test("a quick flick closes the drawer", async ({ page }) => {
  await openSheet(page);
  const box = (await page.getByTestId("sheet-drag").boundingBox())!;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + 8);
  await page.mouse.down();
  // Real time between moves, so the speed is measurable. Well under the 110px distance rule.
  await page.waitForTimeout(16);
  await page.mouse.move(x, box.y + 40);
  await page.waitForTimeout(16);
  await page.mouse.move(x, box.y + 90);
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the close button still works", async ({ page }) => {
  const sheet = await openSheet(page);
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("scrolling inside the drawer doesn't move it", async ({ page }) => {
  const sheet = await openSheet(page);
  await sheet.getByText("Favorite").first().scrollIntoViewIfNeeded();
  await expect(sheet).toBeVisible();
  expect(await sheet.evaluate((el) => (el as HTMLElement).style.transform)).toBe("");
});

test("a toast over an open drawer can be touched, and doesn't close the drawer", async ({ page }) => {
  const sheet = await openSheet(page);
  await sheet.getByRole("button", { name: "Favorite" }).click();
  const toast = page.locator("[data-sonner-toast]").first();
  await expect(toast).toBeVisible();
  const pointer = await toast.evaluate((el) => getComputedStyle(el).pointerEvents);
  expect(pointer).not.toBe("none");
  // The toast slides in, so measuring it too early makes the click miss it and hit the overlay.
  await page.waitForTimeout(600);
  const box = (await toast.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(sheet).toBeVisible();
});

async function swipeToast(page: import("@playwright/test").Page) {
  const toast = page.locator("[data-sonner-toast]").first();
  await expect(toast).toBeVisible();
  await page.waitForTimeout(500); // past the entrance animation
  const box = (await toast.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(x + i * 25, y);
    await page.waitForTimeout(16);
  }
  const during = await toast.evaluate((el) => ({ swiping: (el as HTMLElement).dataset.swiping, dir: (el as HTMLElement).dataset.swipeDirection, x: getComputedStyle(el).getPropertyValue("--swipe-amount-x") }));
  await page.mouse.up();
  console.log("toast during swipe", JSON.stringify(during));
}

test("a toast can be swiped away over an open drawer", async ({ page }) => {
  const sheet = await openSheet(page);
  await sheet.getByRole("button", { name: "Laundry" }).click();
  await swipeToast(page);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 1500 });
});

test("a toast can be swiped away with no drawer open", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Favorite", exact: false }).first().click().catch(() => {});
  await page.evaluate(() => 0);
  const sheet = await openSheet(page);
  await sheet.getByRole("button", { name: "Favorite" }).click();
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await swipeToast(page);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 1500 });
});

for (const url of ["/", "/outfits", "/add", "/shop", "/me"]) {
  test(`the end of ${url} clears the tab bar`, async ({ page }) => {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(200);
    const result = await page.evaluate(() => {
      const nav = document.querySelector("nav")!.getBoundingClientRect();
      const main = document.querySelector("main")!;
      const content = [...main.querySelectorAll("button, a, p, input, h2, img")].filter((el) => el.getBoundingClientRect().height > 0);
      const bottom = Math.max(...content.map((el) => el.getBoundingClientRect().bottom));
      return { navTop: nav.top, bottom };
    });
    expect(result.bottom).toBeLessThanOrEqual(result.navTop);
  });
}

test("fields are 16px on touch screens, so iOS doesn't zoom the page", async ({ page }) => {
  await page.goto("/add");
  await page.goto("/me");
  const input = page.locator("input").first();
  await expect(input).toBeVisible();
  expect(await input.evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
});
