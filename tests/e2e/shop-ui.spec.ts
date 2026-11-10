import path from "node:path";
import { expect, test } from "@playwright/test";

const product = {
  url: "https://townteam.com/products/5638971227",
  title: "T-shirts Oversized fit cotton",
  retailer: "Town Team",
  image_url: "https://cdn.example.test/tee.jpg",
  images: ["https://cdn.example.test/tee-back.jpg"],
  price: 319,
  currency: "EGP",
  description: "Cotton oversized fit tee.",
  brand: "Town Team",
  material: "Cotton",
  color: "Camel",
  sizes: ["S", "M", "L"],
  variants: [{ id: "m", title: "M", available: true, price: 319, image_url: "https://cdn.example.test/tee.jpg" }],
  availability: "In stock",
  measurements: [{ name: "Chest", value: "108 cm", kind: "garment" as const }],
  size_guide_url: "https://townteam.com/pages/size-guide",
  rating: { value: 4.5, count: 24, scale: 5 },
  reviews: [{ text: "Soft and easy to wear.", rating: 5, author: "A shopper" }],
  checked_at: "2026-11-10T10:00:00.000Z",
  source: "retailer" as const,
};

const wishlist = { wishlist: [], items: [] };

async function mockShop(page: import("@playwright/test").Page) {
  await page.route("https://cdn.example.test/**", (route) => route.fulfill({ path: path.resolve("tests/fixtures/tee-phone.jpg") }));
  await page.route("**/api/wishlist", (route) => {
    if (route.request().method() === "POST") return route.fulfill({ contentType: "application/json", body: JSON.stringify({ id: "saved" }) });
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(wishlist) });
  });
  await page.route("**/api/wishlist/*", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) }));
  await page.route("**/api/shop/search", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ products: [product], stores: [{ id: "townteam", name: "Town Team", status: "ok", search_url: "https://townteam.com" }] }) }));
  await page.route("**/api/shop/product", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ status: "ok", product }) }));
}

test("Shop searches, saves, and opens a sourced product", async ({ page }) => {
  await mockShop(page);
  await page.goto("/shop");
  await page.getByRole("textbox", { name: "Search products" }).fill("cotton tee");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Search stores" })).toBeVisible();
  await page.getByRole("button", { name: "Search stores" }).click();
  await expect(page.getByText(product.title)).toBeVisible();
  await expect(page.getByText("319 EGP")).toBeVisible();
  await page.getByRole("button", { name: "Wishlist" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  await page.locator('a[href^="/shop/product?"]').filter({ hasText: product.title }).click();
  await expect(page).toHaveURL(/\/shop\/product\?url=/);
  await expect(page.getByRole("heading", { name: product.title })).toBeVisible();
  await expect(page.getByText("Garment measurement")).toBeVisible();
  await expect(page.getByText("Soft and easy to wear.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to wishlist" })).toBeVisible();

  const screenshotDir = process.env.SHOP_SCREENSHOTS;
  if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, "shop-product-mobile.png"), fullPage: true });
});

test("Shop makes unavailable fields explicit", async ({ page }) => {
  await page.route("**/api/wishlist", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(wishlist) }));
  await page.route("**/api/shop/product", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ status: "ok", product: { ...product, image_url: undefined, images: [], measurements: [], reviews: [], rating: undefined } }) }));
  await page.goto(`/shop/product?url=${encodeURIComponent(product.url)}`);
  await expect(page.getByText("Image unavailable")).toBeVisible();
  await expect(page.getByText("No measurements retrieved from this page.")).toBeVisible();
  await expect(page.getByText("Reviews were not retrieved from this page.")).toBeVisible();
});

test("selected product variants retain the correct link, image and price", async ({ page }) => {
  await mockShop(page);
  const variants = [
    { id: "123", title: "Camel / S", available: true, price: 319, image_url: product.image_url },
    { id: "456", title: "Black / M", available: true, price: 399, image_url: product.images[0] },
  ];
  await page.route("**/api/shop/product", route => route.fulfill({ json: { status: "ok", product: { ...product, variants } } }));
  let saved: { url: string; price: number; image_url: string } | undefined;
  await page.route("**/api/wishlist", route => {
    if (route.request().method() === "POST") saved = route.request().postDataJSON();
    return route.fulfill({ json: route.request().method() === "POST" ? { id: "saved" } : wishlist });
  });
  await page.goto(`/shop/product?url=${encodeURIComponent(product.url + "?variant=456")}`);
  await expect(page.getByLabel("Size or variant")).toHaveValue("456");
  await expect(page.getByText("399 EGP", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add to wishlist" }).click();
  await expect.poll(() => saved?.url).toContain("variant=456");
  expect(saved).toMatchObject({ price: 399, image_url: product.images[0] });
  await page.getByLabel("Size or variant").selectOption("123");
  await expect(page.getByRole("button", { name: "Add to wishlist" })).toBeEnabled();
  await expect(page.getByText("319 EGP", { exact: true })).toBeVisible();
});

test("a full retailer gallery stays within a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockShop(page);
  await page.route("**/api/shop/product", route => route.fulfill({ json: { status: "ok", product: { ...product, images: Array.from({ length: 8 }, (_, i) => `https://cdn.example.test/view-${i}.jpg`) } } }));
  await page.goto(`/shop/product?url=${encodeURIComponent(product.url)}`);
  await expect(page.getByRole("heading", { name: product.title })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const image = page.locator('section[aria-label="Product images"] img').first();
  await expect(image).toBeVisible();
  expect(await image.evaluate(img => img.getBoundingClientRect().height <= img.parentElement!.getBoundingClientRect().height)).toBe(true);
});

for (const viewport of [{ name: "mobile", width: 390, height: 844 }, { name: "desktop", width: 1440, height: 900 }]) {
  for (const theme of ["dark", "light"]) {
    test(`Shop layout fits ${viewport.name} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
      await mockShop(page);
      await page.route("**/api/wishlist", route => route.fulfill({ json: { wishlist: [{ ...product, id: "wish-layout", status: "idea", priority: 1, pairs_with: [], reason: "Pairs with pieces you already own." }], items: [] } }));
      await page.goto("/shop");
      await expect(page.getByRole("heading", { name: "Shop" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const screenshotDir = process.env.SHOP_SCREENSHOTS;
      if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, `shop-${viewport.name}-${theme}.png`), fullPage: true });
    });
  }
}
