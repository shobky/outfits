import "server-only";

import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import sharp from "sharp";
import { parseShopHtml, parseShopJsonLdProduct, parseTownTeamSearchRecord, type TownTeamSearchRecord } from "./parser";
import type { ShopProduct, ShopProductResult, ShopSearchResult, ShopStoreId } from "./types";

const DOCUMENT_TIMEOUT_MS = 8_000;
const MAX_DOCUMENT_BYTES = 1_500_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 25_000_000;
const MAX_REDIRECTS = 3;
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_LIMIT = 80;

const STORE_NAMES: Record<ShopStoreId, string> = { townteam: "Town Team", defacto: "DeFacto Egypt", amazon: "Amazon Egypt" };
const STORE_SEARCH_URLS: Record<ShopStoreId, string> = {
  townteam: "https://townteam.com/search?q=",
  defacto: "https://www.defacto.com.eg/en-eg/search?q=",
  amazon: "https://www.amazon.eg/s?k=",
};

/** Explicit domains prevent the URL supplied by a model or client from becoming an SSRF primitive. */
const TRUSTED_RETAILER_HOSTS = new Set([
  "townteam.com", "www.townteam.com",
  "defacto.com.eg", "www.defacto.com.eg", "defacto.com", "www.defacto.com",
  "amazon.eg", "www.amazon.eg", "amazon.com", "www.amazon.com", "amazon.co.uk", "www.amazon.co.uk", "amazon.de", "www.amazon.de", "amazon.ae", "www.amazon.ae",
  "zara.com", "www.zara.com", "hm.com", "www2.hm.com", "lcwaikiki.com", "www.lcwaikiki.com", "lcwaikiki.eg", "www.lcwaikiki.eg",
  "nike.com", "www.nike.com", "adidas.com", "www.adidas.com", "asos.com", "www.asos.com", "uniqlo.com", "www.uniqlo.com", "mango.com", "shop.mango.com", "nextdirect.com", "www.nextdirect.com",
  "shein.com", "www.shein.com", "noon.com", "www.noon.com", "jollychic.com", "www.jollychic.com",
  "cdn.shopify.com", "dfcdn.defacto.com.tr", "images-na.ssl-images-amazon.com", "m.media-amazon.com", "images.amazon.com",
]);

const TRUSTED_HOST_SUFFIXES = [".cdn.shopify.com", ".dfcdn.defacto.com.tr"];

type CacheEntry = { expires: number; value: ShopProductResult };
const productCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<ShopProductResult>>();
const searchCache = new Map<string, { expires: number; value: ShopSearchResult }>();
const searchInFlight = new Map<string, Promise<ShopSearchResult>>();

function remember(key: string, value: ShopProductResult) {
  productCache.delete(key);
  productCache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
  while (productCache.size > CACHE_LIMIT) productCache.delete(productCache.keys().next().value!);
  return value;
}

function cached(key: string) {
  const entry = productCache.get(key);
  if (!entry) return undefined;
  if (entry.expires <= Date.now()) { productCache.delete(key); return undefined; }
  productCache.delete(key);
  productCache.set(key, entry);
  return entry.value;
}

function isPrivateIp(raw: string) {
  const ip = raw.toLowerCase().replace(/^\[|\]$/g, "");
  if (ip.startsWith("::ffff:")) return isPrivateIp(ip.slice(7));
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (isIP(ip) === 6) {
    const parts = ip.split(":");
    const zeroOnly = parts.length === 8 && parts.every((part) => /^0*$/i.test(part));
    const loopbackExpanded = parts.length === 8 && parts.slice(0, 7).every((part) => /^0*$/i.test(part)) && /^0*1$/i.test(parts[7]);
    return ip === "::" || ip === "::1" || zeroOnly || loopbackExpanded || /^f[cd]/i.test(ip) || /^fe[89ab]/i.test(ip);
  }
  return true;
}

function isTrustedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return TRUSTED_RETAILER_HOSTS.has(host) || TRUSTED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function validateUrl(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || (url.port && url.port !== "80" && url.port !== "443")) return null;
  if (url.hostname === "localhost" || url.hostname.endsWith(".local") || url.hostname.endsWith(".internal")) return null;
  if (!isTrustedHost(url.hostname)) return null;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && isPrivateIp(host)) return null;
  return url;
}

interface SafeBody {
  url: URL;
  status: number;
  contentType: string;
  body: Buffer;
}

class ResponseLimitError extends Error {
  constructor() { super("response_too_large"); }
}

async function resolvePublicAddress(url: URL, timeoutMs = DOCUMENT_TIMEOUT_MS) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return isPrivateIp(host) ? null : { address: host, family: isIP(host) };
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const addresses = await Promise.race([
      lookup(host, { all: true }),
      new Promise<never>((_, reject) => { dnsTimer = setTimeout(() => reject(new Error("dns_timeout")), timeoutMs); }),
    ]);
    const publicAddress = addresses.find((entry) => !isPrivateIp(entry.address));
    return publicAddress ?? null;
  } catch { return null; }
  finally { if (dnsTimer) clearTimeout(dnsTimer); }
}

interface PinnedResponse {
  status: number;
  location: string | undefined;
  contentType: string;
  body: Buffer;
}

/** Fetches through a single DNS-validated address, preserving the original Host/SNI. */
async function requestPinned(url: URL, headers: Record<string, string>, limit: number, timeoutMs = DOCUMENT_TIMEOUT_MS): Promise<PinnedResponse> {
  const address = await resolvePublicAddress(url, timeoutMs);
  if (!address) throw new Error("invalid");
  return new Promise((resolve, reject) => {
    const requestOptions = {
      method: "GET",
      headers,
      servername: url.hostname,
      family: address.family,
      autoSelectFamily: false,
      agent: false,
      lookup: (_hostname: string, _options: object, callback: (error: Error | null, resolvedAddress: string, family: number) => void) => callback(null, address.address, address.family),
    } as unknown as import("node:http").RequestOptions & { servername?: string; autoSelectFamily?: boolean };
    const request = url.protocol === "https:" ? httpsRequest(url, requestOptions) : httpRequest(url, requestOptions);
    let settled = false;
    const timer = setTimeout(() => request.destroy(new Error("timeout")), timeoutMs);
    request.setTimeout(timeoutMs, () => request.destroy(new Error("timeout")));
    request.once("error", (error) => { if (!settled) { settled = true; clearTimeout(timer); reject(error); } });
    request.once("response", (response) => {
      const chunks: Buffer[] = [];
      let total = 0;
      response.on("data", (chunk: Buffer) => {
        total += chunk.byteLength;
        if (total > limit) {
          response.destroy(new ResponseLimitError());
          request.destroy();
          return;
        }
        chunks.push(chunk);
      });
      response.once("error", (error) => { if (!settled) { settled = true; clearTimeout(timer); reject(error); } });
      response.once("end", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ status: response.statusCode ?? 0, location: typeof response.headers.location === "string" ? response.headers.location : undefined, contentType: typeof response.headers["content-type"] === "string" ? response.headers["content-type"].split(";", 1)[0].trim().toLowerCase() : "", body: Buffer.concat(chunks) });
      });
    });
    request.end();
  });
}

async function fetchRetailerDocument(raw: string): Promise<SafeBody | { error: "invalid" | "dead" | "unverified" | "too_large" }> {
  let url = validateUrl(raw);
  if (!url) return { error: "invalid" };
  const deadline = Date.now() + DOCUMENT_TIMEOUT_MS;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      // Validate each hop. The trusted-domain allowlist is also the anti-rebinding boundary.
      url = validateUrl(url.toString());
      if (!url) return { error: "invalid" };
      const remaining = deadline - Date.now();
      if (remaining <= 0) return { error: "unverified" };
      const response = await requestPinned(url, { "user-agent": "Mozilla/5.0 (compatible; OutfitsAppShop/1.0)", accept: "text/html,application/json,application/ld+json,*/*;q=0.1" }, MAX_DOCUMENT_BYTES, remaining);
      const location = response.location;
      if (response.status >= 300 && response.status < 400 && location) { url = new URL(location, url); continue; }
      if (response.status === 404 || response.status === 410) return { error: "dead" };
      if (response.status < 200 || response.status >= 300) return { error: "unverified" };
      const type = response.contentType;
      if (type && !["text/html", "application/json", "application/ld+json", "application/javascript", "text/javascript", "text/plain"].includes(type)) return { error: "unverified" };
      return { url, status: response.status, contentType: type, body: response.body };
    }
    return { error: "unverified" };
  } catch (error) { return { error: error instanceof Error && error.message === "response_too_large" ? "too_large" : "unverified" }; }
}

function urlKey(url: URL) { return `${url.origin}${url.pathname}${url.search}`; }
function errorResult(error: "invalid" | "dead" | "unverified" | "too_large"): ShopProductResult {
  if (error === "dead") return { status: "dead", message: "The retailer reported that this product page no longer exists." };
  if (error === "too_large") return { status: "unverified", message: "The retailer page is too large to inspect safely." };
  if (error === "invalid") return { status: "unverified", message: "This retailer URL is not supported or could not be verified safely." };
  return { status: "unverified", message: "The retailer page could not be read right now, so its details were not guessed." };
}

function errorMessage(error: "invalid" | "dead" | "unverified" | "too_large") {
  const result = errorResult(error);
  return result.status === "ok" ? "The retailer response could not be verified." : result.message;
}

function shopProduct(result: Omit<ShopProduct, "url" | "checked_at" | "source">, url: URL): ShopProductResult {
  if (!result.title || (!result.image_url && result.images.length === 0 && !result.price)) return { status: "unverified", message: "The page did not expose enough product facts to verify it." };
  return { status: "ok", product: { ...result, url: url.toString(), checked_at: new Date().toISOString(), source: "retailer" } };
}

function parseTownTeamJson(value: unknown, url: URL): ShopProductResult {
  const product = parseShopJsonLdProduct(value, url.toString(), "Town Team");
  return product ? shopProduct(product, url) : { status: "unverified", message: "Town Team did not expose product facts for this page." };
}

async function getTownTeamProduct(url: URL): Promise<ShopProductResult> {
  if (url.pathname.endsWith(".js")) return { status: "unverified", message: "Use the Town Team product page URL, not its JSON resource URL." };
  const resource = new URL(url.toString());
  resource.search = "";
  resource.pathname = `${resource.pathname.replace(/\/$/, "")}.js`;
  const fetched = await fetchRetailerDocument(resource.toString());
  if (!("body" in fetched)) return errorResult(fetched.error);
  try { return parseTownTeamJson(JSON.parse(fetched.body.toString("utf8")), url); } catch { return { status: "unverified", message: "Town Team returned an unreadable product record." }; }
}

async function getHtmlProduct(url: URL): Promise<ShopProductResult> {
  const fetched = await fetchRetailerDocument(url.toString());
  if (!("body" in fetched)) return errorResult(fetched.error);
  const parsed = parseShopHtml(fetched.body.toString("utf8"), fetched.url.toString());
  if (!parsed.product || !parsed.isProduct) return { status: "unverified", message: "The page is reachable, but it is not a verifiable product page." };
  return shopProduct(parsed.product, fetched.url);
}

export async function getShopProduct(rawUrl: string): Promise<ShopProductResult> {
  const url = validateUrl(rawUrl);
  if (!url) return errorResult("invalid");
  const key = urlKey(url);
  const hit = cached(key);
  if (hit) return hit;
  const running = inFlight.get(key);
  if (running) return running;
  const task = (async () => {
    const result = url.hostname.toLowerCase().includes("townteam.com") && /\/products?\//i.test(url.pathname) ? await getTownTeamProduct(url) : await getHtmlProduct(url);
    return remember(key, result);
  })();
  inFlight.set(key, task);
  try { return await task; } finally { inFlight.delete(key); }
}

function townTeamProductUrl(record: TownTeamSearchRecord) { return new URL(record.url ?? "/", "https://townteam.com").toString().split("?")[0]; }

function parseDefactoSearch(html: string, maxPrice?: number) {
  const products: ShopProduct[] = [];
  for (const match of html.matchAll(/<div\b[^>]+class=["'][^"']*product-card[^"']*["'][^>]*>[\s\S]*?(?=<div\b[^>]+class=["'][^"']*product-card[^"']*["']|$)/gi)) {
    const card = match[0];
    const documentMatch = /data-documents\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(card);
    const rawDocument = documentMatch?.[1] ?? documentMatch?.[2] ?? documentMatch?.[3];
    if (!rawDocument) continue;
    let document: Record<string, unknown>;
    try { document = JSON.parse(rawDocument.replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")); } catch { continue; }
    const price = typeof document.DiscountedPrice === "number" ? document.DiscountedPrice : typeof document.Price === "number" ? document.Price : undefined;
    if (maxPrice !== undefined && (price === undefined || price > maxPrice)) continue;
    const hrefMatch = /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(card);
    const imageMatch = /<img\b[^>]*src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(card);
    const path = hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3];
    const image = imageMatch?.[1] ?? imageMatch?.[2] ?? imageMatch?.[3];
    if (!path || !image || !/^https?:\/\//i.test(image)) continue;
    const pageUrl = new URL(path, "https://www.defacto.com.eg");
    const imageUrl = new URL(image, pageUrl);
    if (!isTrustedHost(imageUrl.hostname)) continue;
    const sizes = Array.isArray(document.Sizes) ? document.Sizes.map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>).SizeName : undefined)).filter((entry): entry is string => typeof entry === "string") : [];
    products.push({ url: pageUrl.toString(), title: typeof document.Name === "string" ? document.Name : "DeFacto product", retailer: "DeFacto Egypt", image_url: imageUrl.toString(), images: [imageUrl.toString()], price, currency: "EGP", color: typeof document.ColorName === "string" ? document.ColorName : undefined, sizes: Array.from(new Set(sizes)), variants: [], availability: typeof document.Stock === "number" ? (document.Stock > 0 ? "InStock" : "OutOfStock") : undefined, measurements: [], reviews: [], checked_at: new Date().toISOString(), source: "retailer" });
    if (products.length >= 6) break;
  }
  return products;
}

async function searchTownTeam(query: string, maxPrice?: number) {
  const url = new URL("https://townteam.com/search/suggest.json");
  url.searchParams.set("q", query.slice(0, 100));
  url.searchParams.set("resources[type]", "product");
  url.searchParams.set("resources[limit]", "6");
  const fetched = await fetchRetailerDocument(url.toString());
  if (!("body" in fetched)) return { products: [] as ShopProduct[], status: "unavailable" as const, message: errorMessage(fetched.error) };
  try {
    const json = JSON.parse(fetched.body.toString("utf8")) as { resources?: { results?: { products?: TownTeamSearchRecord[] } } };
    const products = (json.resources?.results?.products ?? []).map((record) => ({ record, entry: parseTownTeamSearchRecord(record, "https://townteam.com") })).filter((pair): pair is { record: TownTeamSearchRecord; entry: NonNullable<typeof pair.entry> } => Boolean(pair.entry)).filter(({ entry }) => maxPrice === undefined || (entry.price !== undefined && entry.price <= maxPrice)).slice(0, 6).map(({ record, entry }) => ({ ...entry, url: townTeamProductUrl(record), checked_at: new Date().toISOString(), source: "retailer" as const }));
    return { products, status: "ok" as const };
  } catch { return { products: [] as ShopProduct[], status: "unavailable" as const, message: "Town Team returned an unreadable search response." }; }
}

async function searchDefacto(query: string, maxPrice?: number) {
  const url = new URL(STORE_SEARCH_URLS.defacto);
  url.searchParams.set("q", query.slice(0, 100));
  const fetched = await fetchRetailerDocument(url.toString());
  if (!("body" in fetched)) return { products: [] as ShopProduct[], status: "unavailable" as const, message: errorMessage(fetched.error) };
  const products = parseDefactoSearch(fetched.body.toString("utf8"), maxPrice);
  const advertisedCount = /id=["']product-container["'][^>]*data-count=(\d+)/i.exec(fetched.body.toString("utf8"))?.[1];
  if (products.length === 0 && advertisedCount !== "0") return { products, status: "unavailable" as const, message: "DeFacto returned a page without readable product cards; no details were guessed." };
  return { products, status: "ok" as const };
}

export async function searchShopProducts({ query, store, maxPrice }: { query: string; store?: ShopStoreId; maxPrice?: number }): Promise<ShopSearchResult> {
  const cleanQuery = query.trim().slice(0, 100);
  if (!cleanQuery) return { products: [], stores: [] };
  const cacheKey = `${store ?? "all"}:${cleanQuery.toLowerCase()}:${maxPrice ?? ""}`;
  const cachedSearch = searchCache.get(cacheKey);
  if (cachedSearch && cachedSearch.expires > Date.now()) return cachedSearch.value;
  if (cachedSearch) searchCache.delete(cacheKey);
  const pending = searchInFlight.get(cacheKey);
  if (pending) return pending;
  const storeIds = store ? [store] : (["townteam", "defacto", "amazon"] as ShopStoreId[]);
  const task = (async () => {
    const results = await Promise.all(storeIds.map(async (id) => {
      if (id === "amazon") return { id, name: STORE_NAMES[id], status: "unavailable" as const, search_url: `${STORE_SEARCH_URLS[id]}${encodeURIComponent(cleanQuery)}`, message: "Automatic Amazon search is unavailable in this beta. Open the retailer search or paste a product link." };
      const result = id === "townteam" ? await searchTownTeam(cleanQuery, maxPrice) : await searchDefacto(cleanQuery, maxPrice);
      return { id, name: STORE_NAMES[id], status: result.status, search_url: `${STORE_SEARCH_URLS[id]}${encodeURIComponent(cleanQuery)}`, message: result.status === "unavailable" ? result.message : undefined, products: result.products };
    }));
    const products: ShopProduct[] = [];
    for (let index = 0; products.length < 6; index++) {
      let added = false;
      for (const result of results) {
        const product = result.products?.[index];
        if (product) { products.push(product); added = true; if (products.length >= 6) break; }
      }
      if (!added) break;
    }
    const storeStatuses = results.map((result) => {
      const { products: ignoredProducts, ...storeResult } = result;
      void ignoredProducts;
      return storeResult;
    });
    const value = { products, stores: storeStatuses };
    searchCache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, value });
    while (searchCache.size > 20) searchCache.delete(searchCache.keys().next().value!);
    return value;
  })();
  searchInFlight.set(cacheKey, task);
  try { return await task; } finally { searchInFlight.delete(cacheKey); }
}

export async function readShopProductImage(productUrl: string, imageUrl: string): Promise<Buffer> {
  const productResult = await getShopProduct(productUrl);
  if (productResult.status !== "ok") throw new Error("product_unverified");
  const requested = validateUrl(imageUrl);
  if (!requested) throw new Error("image_url_not_allowed");
  const requestedKey = requested.toString();
  const allowedImages = new Set([...productResult.product.images, productResult.product.image_url, ...productResult.product.variants.map((variant) => variant.image_url)].filter((entry): entry is string => Boolean(entry)).map((entry) => new URL(entry).toString()));
  if (!allowedImages.has(requestedKey)) throw new Error("image_not_in_product_gallery");
  const fetched = await fetchRetailerImage(requested);
  if (!("body" in fetched)) throw new Error(`image_${fetched.error}`);
  const metadata = await sharp(fetched.body, { failOn: "error" }).metadata();
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_IMAGE_PIXELS) throw new Error("image_dimensions_not_supported");
  return fetched.body;
}

async function fetchRetailerImage(rawUrl: URL): Promise<SafeBody | { error: "invalid" | "dead" | "unverified" | "too_large" }> {
  const validated = validateUrl(rawUrl.toString());
  if (!validated) return { error: "invalid" };
  try {
    let current = validated;
    const deadline = Date.now() + DOCUMENT_TIMEOUT_MS;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) return { error: "unverified" };
      const response = await requestPinned(current, { "user-agent": "Mozilla/5.0 (compatible; OutfitsAppShop/1.0)", accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*;q=0.8" }, MAX_IMAGE_BYTES, remaining);
      if (response.status >= 300 && response.status < 400 && response.location) {
        const next = validateUrl(new URL(response.location, current).toString());
        if (!next) return { error: "invalid" };
        current = next;
        continue;
      }
      if (response.status === 404 || response.status === 410) return { error: "dead" };
      if (response.status < 200 || response.status >= 300) return { error: "unverified" };
      const type = response.contentType;
      if (!type.startsWith("image/") || type === "image/svg+xml") return { error: "unverified" };
      return { url: current, status: response.status, contentType: type, body: response.body };
    }
    return { error: "unverified" };
  } catch (error) { return { error: error instanceof Error && error.message === "response_too_large" ? "too_large" : "unverified" }; }
}

export const shopTrustedHosts = TRUSTED_RETAILER_HOSTS;
