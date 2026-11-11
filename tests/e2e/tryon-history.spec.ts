import { expect, test } from "@playwright/test";
import { demoRepo } from "../../src/lib/data/demo";

test("demo repository keeps a try-on snapshot and deletes it by run id", async () => {
  const run = await demoRepo.saveTryOnRun({
    result_url: "/api/try-on/file/result/test.jpg",
    recipe: {
      item_ids: ["tee-white"],
      person_url: "/api/try-on/file/result/person.jpg",
      identity_urls: [],
      garment_urls: ["/api/try-on/file/result/garment.jpg"],
      fit_context: "User-provided height: 180 cm",
      garment_context: "Size L; oversized",
      title: "Saved test look",
      chat_id: crypto.randomUUID(),
      tool_call_id: "tool-test",
      cost_usd: 0.03,
      model: "test-image-model",
    },
  });
  expect((await demoRepo.getTryOnRun(run.id))?.recipe.garment_context).toContain("oversized");
  expect((await demoRepo.listTryOnRuns()).some((entry) => entry.id === run.id)).toBe(true);
  await demoRepo.deleteTryOnRun(run.id);
  expect(await demoRepo.getTryOnRun(run.id)).toBeNull();
});

test("chat try-on cards reopen the matching saved result after reload", async ({ page }) => {
  const chatId = crypto.randomUUID();
  const toolCallId = "tool-history-test";
  await page.route(`**/api/chats/${chatId}`, (route) => route.fulfill({ json: { messages: [{
    id: "assistant-history", role: "assistant", parts: [{ type: "tool-suggest_try_on", toolCallId, state: "output-available", input: { item_ids: [] }, output: { items: [], reason: "Dinner look", available: true, needs_photo: false } }],
  }] } }));
  await page.route("**/api/try-on", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: { runs: [{ id: crypto.randomUUID(), created_at: new Date().toISOString(), result_url: "/demo/tee-white.svg", recipe: { item_ids: ["tee-white"], person_url: "/demo/person.jpg", identity_urls: [], garment_urls: ["/demo/tee-white.svg"], fit_context: "", garment_context: "", title: "Dinner look", chat_id: chatId, tool_call_id: toolCallId } }] } });
    }
    return route.continue();
  });
  await page.goto(`/stylist?c=${chatId}`);
  await expect(page.getByRole("button", { name: /Open saved preview/ })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Open saved preview/ }).click();
  const sheet = page.getByRole("dialog", { name: "Try it on", exact: true });
  await expect(sheet.getByRole("link", { name: "Download image" })).toHaveAttribute("href", "/demo/tee-white.svg");
  await sheet.getByText("Saved look details").click();
  await expect(sheet.getByText("Dinner look", { exact: true })).toBeVisible();
});
