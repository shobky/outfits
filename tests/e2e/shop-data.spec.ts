import { expect, test } from "@playwright/test";
import { parseShopHtml, parseShopJsonLdProduct } from "../../src/lib/shop/parser";

test("product JSON-LD prefers the page product over related recommendations", () => {
  const html = `
    <link rel="canonical" href="https://example.com/products/linen-shirt">
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Product", "name": "Recommended shirt", "url": "https://example.com/products/other", "image": "https://example.com/other.jpg" },
        { "@type": "Product", "name": "Linen shirt", "url": "https://example.com/products/linen-shirt", "image": ["https://cdn.shopify.com/linen.jpg"], "offers": { "price": "799", "priceCurrency": "EGP" }, "size": "M" },
      ],
    })}</script>`;
  const parsed = parseShopHtml(html, "https://example.com/products/linen-shirt");
  expect(parsed.isProduct).toBe(true);
  expect(parsed.product?.title).toBe("Linen shirt");
  expect(parsed.product?.price).toBe(799);
  expect(parsed.product?.images).toEqual(["https://cdn.shopify.com/linen.jpg"]);
});

test("generic homepage metadata is not presented as a verified product", () => {
  const parsed = parseShopHtml('<meta property="og:title" content="Town Team"><meta property="og:image" content="https://townteam.com/logo.jpg">', "https://townteam.com/");
  expect(parsed.isProduct).toBe(false);
  expect(parsed.product).toBeNull();
});

test("Town Team records preserve real image, size, price and availability facts", () => {
  const parsed = parseShopJsonLdProduct({
    title: "Oversized tee", price: 31900, available: true,
    description: "Made from cotton.", images: ["https://cdn.shopify.com/tee.jpg"],
    variants: [{ id: 1, title: "Camel / M", option1: "Camel", option2: "M", available: true, price: 31900, featured_image: { src: "https://cdn.shopify.com/tee.jpg" } }],
  }, "https://townteam.com/products/tee", "Town Team");
  expect(parsed).toMatchObject({ title: "Oversized tee", price: 319, currency: "EGP", color: "Camel", sizes: ["M"], availability: "InStock" });
  expect(parsed?.images).toContain("https://cdn.shopify.com/tee.jpg");
});

test("unsafe image URLs are discarded instead of being returned as product facts", () => {
  const parsed = parseShopHtml('<meta property="og:type" content="product"><meta property="og:title" content="Tee"><meta property="og:image" content="http://127.0.0.1:8080/image.jpg">', "https://townteam.com/products/tee");
  expect(parsed.isProduct).toBe(true);
  expect(parsed.product?.image_url).toBeUndefined();
  expect(parsed.product?.images).toEqual([]);
});

test("Shopify prices use source units and numeric variant ids survive", () => {
  const parsed = parseShopJsonLdProduct({ title: "Low-price tee", price: 9999, variants: [{ id: 123456, title: "Blue / S", option1: "Blue", option2: "S", price: 9999 }] }, "https://townteam.com/products/tee");
  expect(parsed?.price).toBe(99.99);
  expect(parsed?.variants[0]).toMatchObject({ id: "123456", price: 99.99 });
  expect(parsed?.variants[0].available).toBeUndefined();
  expect(parsed?.availability).toBeUndefined();
  expect(parsed?.sizes).toEqual(["S"]);
  const predictive = parseShopJsonLdProduct({ title: "Search tee", price: "319.00" }, "https://townteam.com/products/tee", "Town Team", { priceScale: "major" });
  expect(predictive?.price).toBe(319);
});

test("structured measurements retain numbers and units without turning material into dimensions", () => {
  const parsed = parseShopHtml(`<script type="application/ld+json">${JSON.stringify({
    "@type": "Product", name: "Measured shirt", url: "https://townteam.com/products/measured", image: "https://cdn.shopify.com/shirt.jpg",
    additionalProperty: [
      { name: "Garment chest width", value: 52, unitText: "cm" },
      { name: "Material", value: "Cotton" },
      { name: "Body waist", value: "80–85 cm" },
    ],
    hasVariant: [{ "@type": "Product", name: "Preorder M", size: "M", offers: { availability: "https://schema.org/PreOrder" } }],
    aggregateRating: { ratingValue: 8.4, bestRating: 10, reviewCount: 25 },
  })}</script>`, "https://townteam.com/products/measured");
  expect(parsed.product?.measurements).toContainEqual({ name: "Garment chest width", value: "52 cm", kind: "garment" });
  expect(parsed.product?.measurements).toContainEqual({ name: "Body waist", value: "80–85 cm", kind: "body" });
  expect(parsed.product?.measurements.some(m => m.name === "Material")).toBe(false);
  expect(parsed.product?.rating).toEqual({ value: 8.4, count: 25, scale: 10 });
  expect(parsed.product?.variants[0].available).toBeUndefined();
});
