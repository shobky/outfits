import { expect, test } from "@playwright/test";
import { stripCitationMarkers } from "../../src/lib/ai/citations";
import { parseProductPage } from "../../src/lib/ai/product-page";

test("citation markers are removed, wherever they fall in the text", () => {
  const marker = "citeturn0search0";
  expect(stripCitationMarkers(`Relaxed tailoring. ${marker}\n\nYour look`)).toBe("Relaxed tailoring.\n\nYour look");
  expect(stripCitationMarkers(`One${marker} and two ${marker}.`)).toBe("One and two.");
  expect(stripCitationMarkers("citeturn0search0turn0search1")).toBe("");
  // Still streaming: the rest of the marker hasn't arrived.
  expect(stripCitationMarkers("Almost there citetur")).toBe("Almost there");
  expect(stripCitationMarkers("A normal [link](https://example.com), citing turn 1.")).toBe("A normal [link](https://example.com), citing turn 1.");
});

test("a citation marker split across stream chunks never shows in a reply or its copy", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  // The chunks are split as a real ChatGPT-plan reply split them.
  const chunks = ["Relaxed tailoring is in. ", "cite", "", "turn", "0search0", "", "\n\nWear the charcoal trousers."];
  const events = [{ type: "start" }, { type: "text-start", id: "t" }, ...chunks.map((delta) => ({ type: "text-delta", id: "t", delta })), { type: "text-end", id: "t" }, { type: "finish" }];
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
      body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + "data: [DONE]\n\n",
    }),
  );
  await page.goto("/stylist?q=What%20is%20in%20right%20now");
  const reply = page.locator(".prose-chat").filter({ hasText: "Wear the charcoal trousers." });
  await expect(reply).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Relaxed tailoring is in.")).toBeVisible();
  const shown = await page.locator(".prose-chat").allInnerTexts();
  expect(shown.join(" ")).not.toMatch(/cite|turn0|[-]/);

  await page.getByRole("button", { name: /copy/i }).last().click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("Wear the charcoal trousers.");
  expect(copied).not.toMatch(/cite|turn0|[-]/);
});

/** All of these use the scripted Demo stylist, so they check the components, not answer quality. */
test("outfit card: weather, swaps change the board, and wearing is logged once", async ({ page }) => {
  await page.goto("/stylist?q=Dinner%20date%20tonight");
  const card = page.locator("div.rounded-\\[30px\\]").filter({ hasText: "Wore it today" }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/°C|°/).first()).toBeVisible();

  const swap = card.getByRole("button", { name: /Instead of/ }).first();
  const newName = (await swap.locator("span span").first().textContent())!.trim();
  await expect(card.getByText(newName, { exact: true })).toHaveCount(1); // only the swap row
  await swap.click();
  await expect(swap).toHaveAttribute("aria-pressed", "true");
  await expect(card.getByRole("button", { name: newName, exact: true })).toBeVisible();

  const wornCount = async () => {
    const { items } = await (await page.request.get("/api/items")).json();
    return items.find((i: { name: string }) => i.name === newName).wear_count as number;
  };
  const before = await wornCount();
  await card.getByRole("button", { name: "Wore it today" }).click();
  await expect(page.getByText("Logged as worn today").first()).toBeVisible();
  expect(await wornCount()).toBe(before + 1);
  await page.goto("/");
  await page.getByRole("button", { name: newName, exact: true }).click();
  await expect(page.getByRole("dialog").getByText(`${before + 1}×`)).toBeVisible();
});

test("wearing the same pieces twice in a day counts once", async ({ request }) => {
  const { items } = await (await request.get("/api/items")).json();
  const id = items[0].id;
  const body = { item_ids: [id], date: "2031-01-15" };
  expect((await (await request.post("/api/wear", { data: body })).json()).logged).toBe(1);
  expect((await (await request.post("/api/wear", { data: body })).json()).logged).toBe(0);
  const after = (await (await request.get("/api/items")).json()).items.find((i: { id: string }) => i.id === id);
  expect(after.wear_count).toBe(items[0].wear_count + 1);
});

test("two outfits sit side by side", async ({ page }) => {
  await page.goto("/stylist?q=Give%20me%20two%20looks%20for%20a%20date");
  await expect(page.getByRole("button", { name: "Wore it today" })).toHaveCount(2, { timeout: 30_000 });
  const [a, b] = await page.getByRole("button", { name: "Wore it today" }).all();
  const [boxA, boxB] = [await a.boundingBox(), await b.boundingBox()];
  expect(Math.abs(boxA!.y - boxB!.y)).toBeLessThan(5);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("product cards show saved suggestions and can be saved", async ({ page }) => {
  await page.goto("/stylist?q=What%27s%20missing%20from%20my%20wardrobe%3F");
  await expect(page.getByText("Olive linen camp-collar shirt").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Price not found").first()).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await expect(page.getByText("Saved to your wishlist").first()).toBeVisible();
});

test.describe("reading product pages", () => {
  test("uses structured Product data ahead of Open Graph tags", () => {
    const html = `<meta property="og:image" content="https://shop.test/logo.png"><meta property="og:site_name" content="Shop &amp; Co">
      <script type="application/ld+json">{"@graph":[{"@type":"WebSite"},{"@type":["Product"],"name":"Linen shirt","image":["https://shop.test/shirt.jpg"],"offers":{"price":"59.90","priceCurrency":"EUR"}}]}</script>`;
    expect(parseProductPage(html)).toEqual({ title: "Linen shirt", image_url: "https://shop.test/shirt.jpg", price: 59.9, currency: "EUR", retailer: "Shop & Co" });
  });

  test("falls back to Open Graph and survives broken JSON-LD", () => {
    const html = `<script type="application/ld+json">{not json</script><meta content="https://shop.test/a.jpg" property="og:image"><meta property="product:price:amount" content="1,200.00"><meta property="product:price:currency" content="USD">`;
    const facts = parseProductPage(html);
    expect(facts.image_url).toBe("https://shop.test/a.jpg");
    expect(facts.price).toBe(1200);
    expect(facts.currency).toBe("USD");
  });

  test("reports nothing rather than guessing", () => {
    expect(parseProductPage("<html><body>Hello</body></html>").price).toBeUndefined();
    expect(parseProductPage(`<meta property="product:price:amount" content="call us">`).price).toBeUndefined();
  });
});
