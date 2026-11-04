import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Checks a product link the model found and reads real data from the retailer's page,
 * so cards show what the page says rather than what the model remembers.
 */
export interface ProductFacts {
  title?: string;
  image_url?: string;
  price?: number;
  currency?: string;
  retailer?: string;
}

export type ProductCheck = { status: "ok"; url: string; facts: ProductFacts } | { status: "unverified" } | { status: "dead" };

const TIMEOUT_MS = 5000;
const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;

function isPrivateIp(ip: string) {
  if (ip.includes(":")) return /^(::1?$|f[cd]|fe[89ab]|::ffff:(10|127|192\.168|169\.254|172\.(1[6-9]|2\d|3[01]))\.)/i.test(ip);
  const [a, b] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** The URL comes from model output, so it must never reach the server's own network. */
async function isPublicUrl(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (isIP(host)) return !isPrivateIp(host);
  try {
    const addresses = await lookup(host, { all: true });
    return addresses.every((a) => !isPrivateIp(a.address));
  } catch {
    return false;
  }
}

function decode(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function metaTag(html: string, name: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (key?.toLowerCase() !== name) continue;
    const content = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(tag);
    const value = content?.[1] ?? content?.[2];
    if (value) return decode(value);
  }
  return undefined;
}

function findProduct(node: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findProduct(n);
      if (hit) return hit;
    }
    return undefined;
  }
  if (!node || typeof node !== "object") return undefined;
  const o = node as Record<string, unknown>;
  const type = o["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) return o;
  return findProduct(o["@graph"]);
}

const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);
const text = (v: unknown) => (typeof v === "string" && v.trim() ? decode(v) : undefined);

function parsePrice(v: unknown) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/,/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Structured Product data wins over Open Graph tags, which are often generic site-wide values. */
export function parseProductPage(html: string): ProductFacts {
  let product: Record<string, unknown> | undefined;
  for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      product = findProduct(JSON.parse(m[1]));
    } catch {
      continue; // retailers often ship invalid JSON-LD
    }
    if (product) break;
  }
  const offer = first(product?.offers) as Record<string, unknown> | undefined;
  const image = first(product?.image);
  const imageUrl = typeof image === "string" ? image : text((image as Record<string, unknown> | undefined)?.url);
  return {
    title: text(product?.name) ?? metaTag(html, "og:title"),
    image_url: imageUrl ?? metaTag(html, "og:image"),
    price: parsePrice(offer?.price ?? offer?.lowPrice) ?? parsePrice(metaTag(html, "product:price:amount") ?? metaTag(html, "og:price:amount")),
    currency: text(offer?.priceCurrency) ?? metaTag(html, "product:price:currency") ?? metaTag(html, "og:price:currency"),
    retailer: metaTag(html, "og:site_name"),
  };
}

async function readCapped(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => {});
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * "dead" means the retailer says the page doesn't exist, so the link should go.
 * "unverified" means we couldn't tell: many shops block servers, and that doesn't make a link wrong.
 */
export async function checkProductUrl(raw: string): Promise<ProductCheck> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { status: "dead" };
  }
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await isPublicUrl(url))) return { status: "dead" };
      const res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": "Mozilla/5.0 (compatible; OutfitsApp/1.0)", accept: "text/html" },
      });
      const next = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && next) {
        url = new URL(next, url);
        continue;
      }
      if (res.status === 404 || res.status === 410) return { status: "dead" };
      if (!res.ok) return { status: "unverified" };
      return { status: "ok", url: url.toString(), facts: parseProductPage(await readCapped(res)) };
    }
    return { status: "unverified" };
  } catch {
    return { status: "unverified" };
  }
}
