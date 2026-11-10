import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { proxy } from "../../src/proxy";

test.describe("local Supabase session host", () => {
  const env = { ...process.env };
  test.beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
    delete process.env.VERCEL;
  });
  test.afterEach(() => { process.env = { ...env }; });

  for (const host of ["localhost:3000", "[::1]:3000"]) {
    test("starts sessions on OpenAI's callback host from " + host, async () => {
      const request = new NextRequest("http://localhost:3000/login?error=auth", { headers: { host } });
      const response = await proxy(request);
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://127.0.0.1:3000/login?error=auth");
    });
  }

  test("keeps the requested port, path and query on local plan linking", async () => {
    const request = new NextRequest("http://localhost:3456/auth/chatgpt/start?account=new", { headers: { host: "localhost:3456" } });
    expect((await proxy(request)).headers.get("location")).toBe("http://127.0.0.1:3456/auth/chatgpt/start?account=new");
  });

  test("demo mode keeps its existing localhost address", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const response = await proxy(new NextRequest("http://localhost:3000/", { headers: { host: "localhost:3000" } }));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
