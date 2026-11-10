"use client";

import { ArrowLeft, Bookmark, Check, ExternalLink, ShoppingBag, Star } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { ShopTryOnButton } from "@/components/shop/shop-try-on";
import type { ShopProduct, ShopProductResult } from "@/lib/shop/types";
import { api, cn } from "@/lib/utils";
import { formatPrice, RetailerImage } from "./shop-home";

export function ShopProductPage() {
  const params = useSearchParams();
  const rawUrl = params.get("url") ?? "";
  const [product, setProduct] = useState<ShopProduct | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | undefined>();
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!rawUrl) {
      return () => { alive = false; };
    }
    void api<ShopProductResult>("/api/shop/product", "POST", { url: rawUrl })
      .then((result) => {
        if (!alive) return;
        if (result.status !== "ok") {
          setLoadedUrl(rawUrl);
          setStatus("error");
          setMessage(result.message);
          return;
        }
        setProduct(result.product);
        const requestedVariant = new URL(rawUrl).searchParams.get("variant");
        const initialVariant = result.product.variants.find((v) => v.id === requestedVariant) ?? result.product.variants[0];
        setSelectedImage(initialVariant?.image_url ?? result.product.image_url ?? result.product.images[0]);
        setSelectedVariant(initialVariant?.id ?? "");
        setSaved(false);
        setLoadedUrl(rawUrl);
        setStatus("ready");
      })
      .catch((error) => {
        if (!alive) return;
        setLoadedUrl(rawUrl);
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Couldn't read this product");
      });
    return () => { alive = false; };
  }, [rawUrl]);

  const gallery = useMemo(() => {
    if (!product) return [];
    return Array.from(new Set([product.image_url, ...product.images, ...product.variants.map((variant) => variant.image_url)].filter(Boolean))) as string[];
  }, [product]);
  const variant = product?.variants.find((item) => item.id === selectedVariant);
  const activeImage = selectedImage ?? variant?.image_url ?? gallery[0];
  const selectedUrl = useMemo(() => {
    if (!product) return "";
    if (variant?.url) return variant.url;
    const url = new URL(product.url);
    if (/(^|\.)townteam\.com$/.test(url.hostname) && variant && /^\d+$/.test(variant.id)) url.searchParams.set("variant", variant.id);
    return url.toString();
  }, [product, variant]);
  const selectedPrice = variant ? variant.price : product?.price;
  const availability = variant?.available === true ? "In stock" : variant?.available === false ? "Out of stock" : variant ? "Not verified for this variant" : product?.availability ?? "Not verified";

  const save = async () => {
    if (!product || saving) return;
    setSaving(true);
    try {
      const variantLabel = variant ? ` Size/variant: ${variant.title}.` : "";
      await api("/api/wishlist", "POST", { title: variant ? `${product.title} — ${variant.title}` : product.title, url: selectedUrl, image_url: activeImage ?? null, price: product.currency ? selectedPrice ?? null : null, currency: product.currency ?? null, retailer: product.retailer, brand: product.brand ?? null, reason: `Saved from ${product.retailer}.${variantLabel}`, status: "saved" });
      setSaved(true);
      await mutate("/api/wishlist");
      toast("Added to wishlist");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-nav lg:pb-12">
      <PageHeader title="Product" left={<Link href="/shop" className="grid size-8 place-items-center rounded-full bg-surface-2" aria-label="Back to shop"><ArrowLeft className="size-4" /></Link>} />
      <div className="mx-auto max-w-5xl space-y-5 px-4 md:px-8">
        {rawUrl && (status === "loading" || rawUrl !== loadedUrl) && <div className="space-y-4" aria-busy="true"><div className="aspect-[4/3] animate-pulse rounded-[28px] bg-surface-2" /><div className="h-24 animate-pulse rounded-[26px] bg-surface-2" /></div>}
        {((status === "error" && rawUrl === loadedUrl) || !rawUrl) && <Empty icon={<ShoppingBag className="size-6" />} title="Product unavailable" body={!rawUrl ? "This product link is missing." : message ?? "This retailer page could not be read."} action={<Link href="/shop" className="inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm text-primary-fg">Back to shop</Link>} />}
        {status === "ready" && rawUrl === loadedUrl && product && <article className="grid min-w-0 grid-cols-1 gap-5 break-words lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <section className="min-w-0 space-y-3" aria-label="Product images">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-tile"><RetailerImage src={activeImage} alt={product.title} className="absolute inset-0 h-full w-full p-3" /></div>
            {gallery.length > 1 && <div className="flex gap-2 overflow-x-auto pb-1">{gallery.map((image) => <button key={image} type="button" onClick={() => setSelectedImage(image)} className={cn("grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-tile p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70", selectedImage === image && "ring-2 ring-accent")} aria-label={`Show another view of ${product.title}`}><RetailerImage src={image} alt="" className="h-full w-full" /></button>)}</div>}
          </section>
          <section className="space-y-4 rounded-[28px] border border-border bg-surface p-4 shadow-soft">
            <div><p className="text-[12px] font-medium text-muted">{product.retailer}{product.brand ? ` · ${product.brand}` : ""}</p><h1 className="mt-1 text-xl font-semibold tracking-tight">{product.title}</h1><p className="mt-2 text-lg font-semibold">{formatPrice(selectedPrice, product.currency)}</p><p className="mt-1 text-[11px] text-muted">Checked from the retailer {new Date(product.checked_at).toLocaleString()}</p></div>
            {product.rating && <div className="flex items-center gap-2 text-[13px]"><span className="flex items-center gap-1"><Star className="size-4 fill-accent text-accent" aria-hidden="true" /> {product.rating.value.toFixed(1)}/{product.rating.scale}</span>{product.rating.count != null && <span className="text-muted">({product.rating.count} reviews)</span>}</div>}
            {product.variants.length > 0 && <label className="block text-[12px] font-medium text-muted" htmlFor="product-variant">Size or variant<select id="product-variant" value={selectedVariant} onChange={(event) => { const next = product.variants.find((item) => item.id === event.target.value); setSelectedVariant(event.target.value); setSelectedImage(next?.image_url ?? product.image_url ?? product.images[0]); setSaved(false); }} className="mt-1 h-11 w-full rounded-2xl border border-border bg-bg px-3 text-[14px] text-text outline-none focus-visible:ring-2 focus-visible:ring-accent/60">{product.variants.map((item) => <option key={item.id} value={item.id}>{item.title}{item.available === false ? " · unavailable" : ""}</option>)}</select></label>}
            <p className="text-[13px] text-muted">Availability: <span className="text-text">{availability}</span></p>
            <div className="flex flex-wrap gap-2"><Button size="lg" className="flex-1" onClick={save} disabled={saved || saving}>{saved ? <><Check className="size-4" /> Saved</> : <><Bookmark className="size-4" /> {saving ? "Saving…" : "Add to wishlist"}</>}</Button>{activeImage && <ShopTryOnButton productUrl={selectedUrl} imageUrl={activeImage} disabled={variant?.available === false} />}</div>
            <a href={selectedUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 text-[13px] font-medium text-muted hover:text-text"><ExternalLink className="size-3.5" /> Open at {product.retailer}</a>
          </section>
          <section className="space-y-4 lg:col-span-2"><InfoSection title="About this item">{product.description ? <p className="whitespace-pre-line text-[14px] leading-relaxed text-muted">{product.description}</p> : <Unknown />}{(product.material || (!product.variants.length && product.color)) && <div className="grid gap-2 text-[13px] text-muted sm:grid-cols-2">{product.material && <p><span className="font-medium text-text">Material:</span> {product.material}</p>}{!product.variants.length && product.color && <p><span className="font-medium text-text">Colour:</span> {product.color}</p>}</div>}</InfoSection>
            <InfoSection title="Measurements and size guide">{product.measurements.length > 0 ? <div className="grid gap-2 sm:grid-cols-2">{product.measurements.map((measurement) => <div key={`${measurement.name}-${measurement.value}`} className="rounded-2xl bg-surface p-3 text-[13px]"><p className="font-medium">{measurement.name}</p><p className="text-muted">{measurement.value}</p><p className="mt-1 text-[11px] text-faint">{measurement.kind === "garment" ? "Garment measurement" : measurement.kind === "body" ? "Body measurement" : measurement.kind === "package" ? "Package measurement" : "Measurement type not published"}</p></div>)}</div> : <Unknown label="No measurements retrieved from this page." />}{product.size_guide_url && <a href={product.size_guide_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[13px] font-medium text-muted hover:text-text">Open size guide <ExternalLink className="size-3.5" /></a>}</InfoSection>
            <InfoSection title="Reviews">{product.reviews.length > 0 ? <div className="space-y-2">{product.reviews.map((review, index) => <blockquote key={`${review.text}-${index}`} className="rounded-2xl bg-surface p-3 text-[13px] text-muted">{review.rating != null && <span className="mr-2 font-medium text-text">Rating {review.rating}</span>}{review.text}{review.author && <footer className="mt-1 text-[11px] text-faint">— {review.author}</footer>}</blockquote>)}</div> : <Unknown label="Reviews were not retrieved from this page." />}</InfoSection>
          </section>
        </article>}
      </div>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) { return <section className="rounded-[26px] border border-border bg-surface p-4"><h2 className="mb-3 text-[15px] font-semibold">{title}</h2>{children}</section>; }
function Unknown({ label = "Not published by retailer" }: { label?: string }) { return <p className="text-[13px] text-muted">{label}</p>; }
