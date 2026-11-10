import { expect, test } from "@playwright/test";

test("expired Supabase email fragments become a retryable error", async ({ page }) => {
  await page.goto("/login?error=auth#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");

  await expect(page.getByRole("alert").filter({ hasText: /expired.*request a new one/i })).toBeVisible();
  const baseURL = test.info().project.use.baseURL ?? "http://localhost:3100";
  await expect(page).toHaveURL(new URL("/login?error=expired", baseURL).toString());
  await expect(page.getByRole("button", { name: "Continue with email" })).toBeVisible();
});

test("login keeps a recovery path after an auth error", async ({ page }) => {
  await page.goto("/login?error=auth");

  await expect(page.getByRole("alert").filter({ hasText: "sign-in link" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with email" })).toBeEnabled();
});

test("token-hash email links wait for an explicit confirmation", async ({ request }) => {
  const response = await request.get("/auth/callback?token_hash=test-token&type=email");
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('method="post"');
  expect(html).toContain('name="token_hash"');
  expect(html).toContain("test-token");
});

test("token-hash confirmation rejects cross-origin posts with a 303", async ({ request }) => {
  const response = await request.post("/auth/callback", {
    headers: { origin: "https://attacker.example" },
    form: { token_hash: "test-token", type: "email" },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(303);
  expect(response.headers().location).toContain("/login?error=auth");
});
