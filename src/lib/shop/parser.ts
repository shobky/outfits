import type { ShopProduct } from "./types";

type JsonRecord = Record<string, unknown>;

export interface ParsedShopDocument {
  product: Omit<ShopProduct, "url" | "checked_at" | "source"> | null;
  /** A page can be reachable while still being a category, search, or home page. */
  isProduct: boolean;
}

const asRecord = (value: unknown): JsonRecord | undefined => (value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : undefined);

function decode(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

function plainText(value: unknown) {
  if (typeof value !== "string") return undefined;
  const text = decode(value.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return text || undefined;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? decode(value) : undefined;
}

function number(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/[^\d.,-]/g, "").replace(/,(?=\d{3}(?:\D|$))/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function sourcePrice(value: unknown, scale: "minor" | "major") {
  const parsed = number(value);
  return parsed === undefined ? undefined : scale === "minor" ? parsed / 100 : parsed;
}

function valueId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return text(value);
}

function metaTag(html: string, name: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (key?.toLowerCase() !== name.toLowerCase()) continue;
    const content = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(tag);
    const value = content?.[1] ?? content?.[2];
    if (value) return decode(value);
  }
  return undefined;
}

function linkTag(html: string, rel: string) {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const foundRel = /rel\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!foundRel?.toLowerCase().split(/\s+/).includes(rel.toLowerCase())) continue;
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (href) return decode(href);
  }
  return undefined;
}

const TRUSTED_ASSET_HOSTS = new Set(["cdn.shopify.com", "dfcdn.defacto.com.tr", "images-na.ssl-images-amazon.com", "m.media-amazon.com", "images.amazon.com"]);

function absoluteUrl(raw: unknown, pageUrl: URL, asset = false) {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    const url = new URL(decode(raw), pageUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || /^127\.|^10\.|^192\.168\.|^169\.254\./.test(host)) return undefined;
    if (asset && host !== pageUrl.hostname.toLowerCase() && !host.endsWith(`.${pageUrl.hostname.toLowerCase()}`) && !TRUSTED_ASSET_HOSTS.has(host)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function jsonLdNodes(html: string) {
  const roots: unknown[] = [];
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = match[1].trim();
    try {
      roots.push(JSON.parse(raw));
    } catch {
      try {
        roots.push(JSON.parse(decode(raw)));
      } catch {
        // Some storefronts leave malformed JSON-LD beside valid scripts.
      }
    }
  }
  return roots;
}

interface Candidate {
  node: JsonRecord;
  group: boolean;
  related: boolean;
}

function collectCandidates(value: unknown, related = false, output: Candidate[] = []) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectCandidates(entry, related, output));
    return output;
  }
  const node = asRecord(value);
  if (!node) return output;
  const type = node["@type"];
  const types = Array.isArray(type) ? type.filter((entry): entry is string => typeof entry === "string") : typeof type === "string" ? [type] : [];
  const group = types.includes("ProductGroup");
  if (types.includes("Product") || group) output.push({ node, group, related });
  for (const [key, child] of Object.entries(node)) {
    const childRelated = related || ["itemListElement", "isRelatedTo", "isSimilarTo", "recommendation", "relatedLink", "relatedProducts"].includes(key);
    if (key !== "hasVariant" || group) collectCandidates(child, childRelated, output);
  }
  return output;
}

function candidateMatchesPage(candidate: Candidate, canonicalUrl: string | undefined, pageUrl: URL) {
  const raw = text(candidate.node.url) ?? text(candidate.node["@id"]);
  if (!raw) return false;
  const absolute = absoluteUrl(raw, pageUrl);
  if (!absolute) return false;
  try {
    const target = new URL(absolute);
    const canonical = canonicalUrl ? new URL(canonicalUrl, pageUrl) : undefined;
    return target.pathname === (canonical?.pathname ?? pageUrl.pathname);
  } catch {
    return false;
  }
}

function chooseCandidate(roots: unknown[], html: string, pageUrl: URL) {
  const canonical = absoluteUrl(linkTag(html, "canonical"), pageUrl);
  const candidates = roots.flatMap((root) => collectCandidates(root));
  return candidates
    .filter((candidate) => !candidate.related)
    .sort((a, b) => {
      const score = (candidate: Candidate) => (candidate.group ? 20 : 10) + (candidateMatchesPage(candidate, canonical, pageUrl) ? 100 : 0) + (candidate.node.offers ? 4 : 0) + (candidate.node.image ? 2 : 0);
      return score(b) - score(a);
    })[0];
}

function imageValues(value: unknown) {
  const values: string[] = [];
  const add = (entry: unknown) => {
    if (typeof entry === "string") values.push(entry);
    else if (Array.isArray(entry)) entry.forEach(add);
    else {
      const record = asRecord(entry);
      if (record) add(record.url ?? record.contentUrl ?? record.thumbnailUrl);
    }
  };
  add(value);
  return values;
}

function availability(value: unknown) {
  const raw = text(value);
  if (!raw) return undefined;
  const state = raw.split("/").pop()?.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, "").toLowerCase();
  if (state === "instock") return "InStock";
  if (state === "outofstock") return "OutOfStock";
  if (state === "preorder") return "PreOrder";
  return raw;
}

function offerValues(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.map(asRecord).filter((entry): entry is JsonRecord => Boolean(entry));
  const record = asRecord(value);
  return record ? [record] : [];
}

function variantValues(node: JsonRecord) {
  const values: JsonRecord[] = [];
  const variants = node.hasVariant;
  if (Array.isArray(variants)) variants.forEach((entry) => { const record = asRecord(entry); if (record) values.push(record); });
  else { const record = asRecord(variants); if (record) values.push(record); }
  const offers = offerValues(node.offers);
  offers.forEach((offer) => {
    const item = asRecord(offer.itemOffered);
    if (item) values.push(item);
  });
  return values;
}

function parseMeasurements(node: JsonRecord): ShopProduct["measurements"] {
  const properties = Array.isArray(node.additionalProperty) ? node.additionalProperty : node.additionalProperty ? [node.additionalProperty] : [];
  return properties.flatMap((entry) => {
    const property = asRecord(entry);
    if (!property) return [];
    const name = text(property.name);
    const numeric = typeof property.value === "number" && Number.isFinite(property.value) ? String(property.value) : undefined;
    const value = text(property.value) ?? numeric ?? text(property.valueReference);
    const unit = text(property.unitText) ?? text(property.unitCode);
    if (!name || !value) return [];
    const explicit = `${text(property.propertyID) ?? ""} ${name}`.toLowerCase();
    const kind = explicit.includes("garment") ? "garment" : explicit.includes("body") ? "body" : explicit.includes("package") ? "package" : "unspecified";
    const measurementName = /(?:measure|dimension|width|height|depth|length|chest|bust|waist|hip|inseam|outseam|sleeve|shoulder|rise|circumference|weight)/i.test(explicit) || kind !== "unspecified";
    const numericWithUnit = /\d+(?:\.\d+)?\s*(?:mm|cm|m|in|inch|inches|ft|kg|g|lb|oz)\b/i.test(value) || (Boolean(unit) && /^\s*\d+(?:\.\d+)?\s*$/.test(value));
    if (!measurementName || !numericWithUnit) return [];
    return [{ name, value: unit && !value.endsWith(unit) ? `${value} ${unit}` : value, kind }];
  });
}

function parseReviews(node: JsonRecord): ShopProduct["reviews"] {
  const values = Array.isArray(node.review) ? node.review : node.review ? [node.review] : [];
  return values.flatMap((entry) => {
    const review = asRecord(entry);
    if (!review) return [];
    const reviewBody = plainText(review.reviewBody)?.slice(0, 600);
    if (!reviewBody) return [];
    const rating = number(asRecord(review.reviewRating)?.ratingValue);
    return [{ text: reviewBody, rating, author: text(asRecord(review.author)?.name) }];
  }).slice(0, 12);
}

function parseStructured(node: JsonRecord, html: string, pageUrl: URL): ParsedShopDocument["product"] {
  const offers = offerValues(node.offers);
  const offer = offers[0];
  const rawVariants = variantValues(node);
  const sizeValues = [text(node.size), ...rawVariants.map((variant) => text(variant.size))]
    .filter((entry): entry is string => Boolean(entry))
    .flatMap((entry) => entry.split(/[\s,/|]+/))
    .filter((entry) => /^(?:XXS|XS|S|M|L|XL|XXL|XXXL|\d{2,3})$/i.test(entry));
  const variants = rawVariants.map((variant, index) => {
    const variantOffers = offerValues(variant.offers);
    const variantOffer = variantOffers[0];
    const image = imageValues(variant.image)[0];
    const state = availability(variantOffer?.availability);
    return {
      id: text(variant.sku) ?? text(variant.mpn) ?? text(variant["@id"]) ?? `variant-${index + 1}`,
      title: text(variant.name) ?? text(variant.size) ?? `Variant ${index + 1}`,
      url: absoluteUrl(variant.url, pageUrl),
      available: state === "InStock" ? true : state === "OutOfStock" ? false : undefined,
      price: number(variantOffer?.price),
      image_url: absoluteUrl(image, pageUrl, true),
    };
  });
  const images = Array.from(new Set(imageValues(node.image).map((entry) => absoluteUrl(entry, pageUrl, true)).filter((entry): entry is string => Boolean(entry))));
  const ratingValue = number(asRecord(node.aggregateRating)?.ratingValue);
  const ratingCount = number(asRecord(node.aggregateRating)?.reviewCount);
  const ratingScale = number(asRecord(node.aggregateRating)?.bestRating) ?? 5;
  const material = text(node.material);
  const description = plainText(node.description);
  const sizeGuide = (html.match(/<a\b[^>]*(?:href\s*=\s*["']([^"']+)["'])[^>]*>[^<]*(?:size\s*(?:guide|chart)|fit\s*(?:guide|chart)|measure(?:ment)?\s*(?:guide|chart))[^<]*<\/a>/i) ?? [])[1];
  return {
    title: text(node.name) ?? metaTag(html, "og:title") ?? "",
    retailer: text(metaTag(html, "og:site_name")) ?? pageUrl.hostname.replace(/^www\./, ""),
    image_url: images[0],
    images,
    price: number(offer?.price) ?? number(offer?.lowPrice),
    currency: text(offer?.priceCurrency),
    description: description?.slice(0, 1600),
    brand: text(asRecord(node.brand)?.name) ?? text(node.brand),
    material: material?.slice(0, 160),
    color: text(node.color),
    sizes: Array.from(new Set(sizeValues)),
    variants,
    availability: availability(offer?.availability),
    measurements: parseMeasurements(node),
    size_guide_url: absoluteUrl(sizeGuide, pageUrl),
    rating: ratingValue ? { value: ratingValue, count: ratingCount, scale: ratingScale } : undefined,
    reviews: parseReviews(node),
  };
}

function hasProductSignals(html: string, pageUrl: URL, structured: boolean) {
  if (structured) return true;
  const type = metaTag(html, "og:type")?.toLowerCase();
  if (type === "product") return true;
  if (metaTag(html, "product:price:amount") || metaTag(html, "og:price:amount")) return true;
  return /\/(?:products?|p|item|goods)\//i.test(pageUrl.pathname) && Boolean(metaTag(html, "og:title") && metaTag(html, "og:image"));
}

export function parseShopHtml(html: string, rawUrl: string): ParsedShopDocument {
  let pageUrl: URL;
  try { pageUrl = new URL(rawUrl); } catch { return { product: null, isProduct: false }; }
  const candidate = chooseCandidate(jsonLdNodes(html), html, pageUrl);
  const structured = Boolean(candidate);
  const product = candidate ? parseStructured(candidate.node, html, pageUrl) : hasProductSignals(html, pageUrl, false) ? {
    title: metaTag(html, "og:title") ?? "",
    retailer: metaTag(html, "og:site_name") ?? pageUrl.hostname.replace(/^www\./, ""),
    image_url: absoluteUrl(metaTag(html, "og:image"), pageUrl, true),
    images: [absoluteUrl(metaTag(html, "og:image"), pageUrl, true)].filter((entry): entry is string => Boolean(entry)),
    price: number(metaTag(html, "product:price:amount") ?? metaTag(html, "og:price:amount")),
    currency: metaTag(html, "product:price:currency") ?? metaTag(html, "og:price:currency"),
    sizes: [], variants: [], measurements: [], reviews: [],
  } : null;
  if (!product?.title || !hasProductSignals(html, pageUrl, structured)) return { product: null, isProduct: false };
  return { product, isProduct: true };
}

export function parseShopJsonLdProduct(value: unknown, rawUrl: string, retailer = "Town Team", options: { priceScale?: "minor" | "major" } = {}): ParsedShopDocument["product"] {
  const pageUrl = new URL(rawUrl);
  const priceScale = options.priceScale ?? "minor";
  const record = asRecord(value);
  if (!record) return null;
  const variants = Array.isArray(record.variants) ? record.variants : [];
  const images = Array.from(new Set([
    ...imageValues(record.images),
    ...variants.flatMap((variant) => imageValues(asRecord(variant)?.featured_image)),
  ].map((entry) => absoluteUrl(entry, pageUrl, true)).filter((entry): entry is string => Boolean(entry))));
  const variantData = variants.map((variant, index) => {
    const item = asRecord(variant) ?? {};
    const image = absoluteUrl(imageValues(item.featured_image)[0], pageUrl, true);
    return { id: valueId(item.id) ?? `variant-${index + 1}`, title: text(item.title) ?? `Variant ${index + 1}`, available: item.available === true ? true : item.available === false ? false : undefined, price: sourcePrice(item.price, priceScale), image_url: image };
  });
  const explicitMaterial = plainText(record.description)?.match(/\b(?:made from|material)\s+([^.;]+)/i)?.[1];
  const namedSizeValues = Array.isArray(record.options) ? record.options.flatMap((option) => {
    const optionRecord = asRecord(option);
    const optionName = text(optionRecord?.name)?.toLowerCase() ?? "";
    if (!optionName.includes("size") && !optionName.includes("المقاس")) return [];
    return Array.isArray(optionRecord?.values) ? optionRecord.values.filter((entry): entry is string => typeof entry === "string") : [];
  }) : [];
  const fallbackSizeValues = variants.flatMap((variant) => {
    const item = asRecord(variant);
    return [text(item?.option1), text(item?.option2), text(item?.option3)].filter((entry): entry is string => Boolean(entry));
  }).filter((entry) => /^(?:one\s*size|XXS|XS|S|M|L|XL|XXL|XXXL|\d{2,3}(?:\.\d+)?)$/i.test(entry));
  const sizes = Array.from(new Set([...namedSizeValues, ...fallbackSizeValues]));
  return {
    title: text(record.title) ?? "", retailer, image_url: images[0], images,
    price: sourcePrice(record.price, priceScale),
    currency: "EGP", description: plainText(record.description), brand: undefined, material: explicitMaterial,
    color: text(asRecord(variants[0])?.option1), sizes, variants: variantData,
    availability: record.available === true ? "InStock" : record.available === false ? "OutOfStock" : undefined, measurements: [], reviews: [],
  };
}

export interface TownTeamSearchRecord {
  title?: string; body?: string; description?: string; url?: string; image?: string; price?: string | number; available?: boolean; vendor?: string; tags?: unknown[]; variants?: unknown[]; featured_image?: { url?: string };
}

export function parseTownTeamSearchRecord(value: TownTeamSearchRecord, baseUrl: string) {
  const pageUrl = new URL(value.url ?? "/", baseUrl);
  const raw = { ...value, title: value.title, description: value.body ?? value.description, images: value.image ? [value.image] : [], price: value.price, variants: value.variants ?? [], available: value.available, tags: value.tags ?? [] };
  const parsed = parseShopJsonLdProduct(raw, pageUrl.toString(), "Town Team", { priceScale: "major" });
  return parsed?.title ? parsed : null;
}
