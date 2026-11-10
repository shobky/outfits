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

/**
 * "dead" means the retailer says the page doesn't exist, so the link should go.
 * "unverified" means we couldn't tell: many shops block servers, and that doesn't make a link wrong.
 */
export async function checkProductUrl(raw: string): Promise<ProductCheck> {
  try {
    new URL(raw);
  } catch {
    return { status: "dead" };
  }
  try {
    const { getShopProduct } = await import("../shop/service");
    const result = await getShopProduct(raw);
    if (result.status === "dead") return { status: "dead" };
    if (result.status !== "ok") return { status: "unverified" };
    return {
      status: "ok",
      url: result.product.url,
      facts: {
        title: result.product.title,
        image_url: result.product.image_url,
        price: result.product.price,
        currency: result.product.currency,
        retailer: result.product.retailer,
      },
    };
  } catch {
    return { status: "unverified" };
  }
}
