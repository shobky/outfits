import { expect, test } from "@playwright/test";
import { wishUrlKey } from "../../src/lib/shop/wishlist";

test("wishlist identity retains selected variants but ignores marketing parameters", () => {
  expect(wishUrlKey("https://townteam.com/products/shirt?variant=12&utm_source=chat#photo")).toBe("https://townteam.com/products/shirt?variant=12");
  expect(wishUrlKey("https://townteam.com/products/shirt?variant=13")).not.toBe(wishUrlKey("https://townteam.com/products/shirt?variant=12"));
});

test("shop endpoints reject malformed search and product input", async ({ request }) => {
  for (const data of [{ query: "x" }, { query: "shirt", maxPrice: -1 }, { query: "shirt", store: "made-up" }]) {
    expect((await request.post("/api/shop/search", { data })).status()).toBe(400);
  }
  expect((await request.post("/api/shop/product", { data: { url: "not a URL" } })).status()).toBe(400);
  const unsafe = await request.post("/api/shop/product", { data: { url: "http://127.0.0.1:3100/api/profile" } });
  expect(unsafe.ok()).toBe(true);
  expect((await unsafe.json()).status).not.toBe("ok");
});

test("wishlist validates currency and links, and restricts writable fields", async ({ request }) => {
  for (const data of [{ title: "" }, { title: "Shirt", price: 300 }, { title: "Shirt", url: "javascript:alert(1)" }, { title: "Shirt", price: -2, currency: "EGP" }]) {
    expect((await request.post("/api/wishlist", { data })).status()).toBe(400);
  }
  const data = { title: `Shop API test ${Date.now()}`, price: 300, currency: "EGP", url: "https://townteam.com/products/test?variant=12", status: "saved" };
  const saved = await (await request.post("/api/wishlist", { data })).json();
  try {
    const duplicate = await (await request.post("/api/wishlist", { data: { ...data, url: `${data.url}&utm_source=chat` } })).json();
    expect(duplicate.id).toBe(saved.id);
    await request.patch(`/api/wishlist/${saved.id}`, { data: { status: "idea" } });
    const promoted = await (await request.post("/api/wishlist", { data })).json();
    expect(promoted.id).toBe(saved.id);
    expect(promoted.status).toBe("saved");
    expect((await request.patch(`/api/wishlist/${saved.id}`, { data: { user_id: "someone-else", source: "ai" } })).status()).toBe(400);
    expect((await request.patch(`/api/wishlist/${saved.id}`, { data: { status: "dismissed" } })).ok()).toBe(true);
    expect((await request.get("/api/wishlist")).ok()).toBe(true);
    expect((await request.patch(`/api/wishlist/${saved.id}`, { data: { status: "saved" } })).ok()).toBe(true);
  } finally {
    await request.delete(`/api/wishlist/${saved.id}`);
  }
});

test("shop try-on stays gated without triggering a model call", async ({ request }) => {
  const response = await request.post("/api/try-on", { data: { product: { url: "https://townteam.com/products/shirt", image_url: "https://example.com/shirt.jpg" } } });
  expect([400, 403]).toContain(response.status());
  expect((await response.json()).error).toBeTruthy();
});
