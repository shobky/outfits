"use client";

import {
  Bookmark,
  Check,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { ProfileLink } from "@/components/app-nav";
import { GarmentImage } from "@/components/drawer/item-card";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { useWishlist } from "@/lib/hooks";
import type { Item, WishlistItem, WishlistStatus } from "@/lib/types";
import type { ShopProduct, ShopProductResult, ShopSearchResult, ShopStoreId } from "@/lib/shop/types";
import { api, cn } from "@/lib/utils";

type Tab = "idea" | "saved" | "bought";
type StoreFilter = "all" | ShopStoreId;
type SortOrder = "newest" | "priority" | "price";

const stores: { value: StoreFilter; label: string }[] = [
  { value: "all", label: "All stores" },
  { value: "townteam", label: "Town Team" },
  { value: "defacto", label: "DeFacto" },
  { value: "amazon", label: "Amazon Egypt" },
];

async function updateWishlistStatus(id: string, status: WishlistStatus, message: string) {
  try {
    await api(`/api/wishlist/${id}`, "PATCH", { status });
    await mutate("/api/wishlist");
    toast(message);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Couldn't update that item");
  }
}

async function dismissSuggestion(id: string) {
  try {
    await api(`/api/wishlist/${id}`, "PATCH", { status: "dismissed" });
    await mutate("/api/wishlist");
    toast("Dismissed", {
      action: { label: "Undo", onClick: () => void updateWishlistStatus(id, "idea", "Suggestion restored") },
    });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Couldn't dismiss that suggestion");
  }
}

export function ShopHome({ onAdd, onSearch }: { onAdd: () => void; onSearch: (query: string) => void }) {
  const { data, isLoading, error: wishlistError, mutate: reloadWishlist } = useWishlist();
  const [tab, setTab] = useState<Tab>("idea");
  const [searchQuery, setSearchQuery] = useState("");
  const [wishlistQuery, setWishlistQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("newest");
  const list = useMemo(() => {
    const needle = wishlistQuery.trim().toLowerCase();
    return (data?.wishlist.filter((item) => {
      if (item.status !== tab) return false;
      if (!needle) return true;
      return [item.title, item.retailer, item.brand, item.reason].filter(Boolean).some((value) => value!.toLowerCase().includes(needle));
    }) ?? []).sort((a, b) => {
      if (sort === "priority") return a.priority - b.priority;
      if (sort === "price") return (a.currency ?? "ZZZ").localeCompare(b.currency ?? "ZZZ") || (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY);
      return b.created_at.localeCompare(a.created_at);
    });
  }, [data?.wishlist, sort, tab, wishlistQuery]);
  const byId = new Map(data?.items.map((item) => [item.id, item]));

  return (
    <div className="pb-nav lg:pb-12">
      <PageHeader
        title="Shop"
        left={<Button variant="surface" size="sm" onClick={onAdd}><Plus className="size-3.5" /> Add</Button>}
        right={<ProfileLink />}
        sub={<div className="flex justify-center"><Segmented value={tab} onChange={setTab} options={[{ value: "idea", label: "Suggestions" }, { value: "saved", label: "Wishlist" }, { value: "bought", label: "Bought" }]} /></div>}
      />
      <div className="space-y-4 px-4 md:px-8">
        <form className="rounded-[26px] bg-surface p-4 shadow-soft" onSubmit={(event) => { event.preventDefault(); if (searchQuery.trim()) onSearch(searchQuery.trim()); }}>
          <div className="mb-2 flex items-center gap-2"><Search className="size-4 text-muted" aria-hidden="true" /><p className="text-[14px] font-medium">Find a real product</p></div>
          <div className="flex gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Search products</span><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="linen shirt, white sneakers…" className="h-10 w-full rounded-full border border-border bg-bg px-4 text-[14px] outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-accent/60" /></label><Button size="md" type="submit">Search</Button></div>
          <p className="mt-2 text-[12px] text-muted">Retailer facts are shown as published. Unknown measurements stay unknown.</p>
        </form>
        <ProductCheck />
        <Link href="/stylist?q=Analyse%20my%20wardrobe%20and%20suggest%20what%20to%20buy%20next" className="flex items-center gap-3 rounded-[26px] bg-gradient-to-br from-accent/90 to-accent/60 p-4 text-accent-fg shadow-soft active:scale-[0.99]">
          <div className="grid size-11 place-items-center rounded-2xl bg-black/10" aria-hidden="true"><Sparkles className="size-5" /></div>
          <div className="flex-1"><p className="font-semibold">Find my wardrobe gaps</p><p className="text-[13px] opacity-75">The stylist checks what you own and suggests what unlocks the most outfits.</p></div>
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1"><span className="sr-only">Filter saved products</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden="true" /><input value={wishlistQuery} onChange={(event) => setWishlistQuery(event.target.value)} placeholder="Filter your list" className="h-10 w-full rounded-full border border-border bg-surface pl-9 pr-4 text-[14px] outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-accent/60" /></label>
          <label className="flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-3 text-[13px] text-muted"><SlidersHorizontal className="size-3.5" aria-hidden="true" /><span className="sr-only">Sort products</span><select value={sort} onChange={(event) => setSort(event.target.value as SortOrder)} className="bg-transparent outline-none"><option value="newest">Newest</option><option value="priority">Priority</option><option value="price">Price</option></select></label>
        </div>
        {wishlistError ? <Empty icon={<ShoppingBag className="size-6" />} title="Wishlist unavailable" body="Check your connection and try again." action={<Button variant="surface" onClick={() => void reloadWishlist()}>Try again</Button>} /> : isLoading ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading wishlist">{[0, 1, 2].map((i) => <div key={i} className="h-48 animate-pulse rounded-[26px] bg-surface-2" />)}</div> : list.length === 0 ? <Empty icon={<ShoppingBag className="size-6" />} title={tab === "idea" ? "No suggestions yet" : tab === "saved" ? "Wishlist is empty" : "Nothing bought yet"} body={wishlistQuery ? "Nothing in this list matches your search." : tab === "idea" ? "Search real stores or ask the stylist what's missing." : "Save products you like to keep track of them."} action={wishlistQuery ? <Button variant="surface" size="sm" onClick={() => setWishlistQuery("")}>Clear search</Button> : undefined} /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{list.map((item) => <WishCard key={item.id} item={item} pairs={item.pairs_with.map((id) => byId.get(id)).filter(Boolean) as Item[]} />)}</div>}
      </div>
    </div>
  );
}

export function ProductSearchSheet({ open, onOpenChange, initialQuery = "" }: { open: boolean; onOpenChange: (open: boolean) => void; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [store, setStore] = useState<StoreFilter>("all");
  const [maxPrice, setMaxPrice] = useState("");
  const [result, setResult] = useState<ShopSearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    setBusy(true); setError(null); setResult(null);
    try { setResult(await api<ShopSearchResult>("/api/shop/search", "POST", { query: query.trim(), store: store === "all" ? undefined : store, maxPrice: maxPrice ? Number(maxPrice) : undefined })); }
    catch (err) { setError(err instanceof Error ? err.message : "Search is unavailable right now"); }
    finally { setBusy(false); }
  };
  return <Sheet open={open} onOpenChange={onOpenChange} title="Search stores" className="md:w-[min(760px,92vw)]"><div className="space-y-4 pb-6"><form onSubmit={search} className="space-y-3 rounded-[24px] bg-surface p-3"><label className="block text-[12px] font-medium text-muted" htmlFor="shop-search-query">Search term</label><input id="shop-search-query" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="linen shirt, white sneakers…" className="h-11 w-full rounded-2xl border border-border bg-bg px-4 text-[15px] outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-accent/60" /><div className="grid gap-2 sm:grid-cols-2"><label className="block text-[12px] font-medium text-muted">Store<select value={store} onChange={(event) => setStore(event.target.value as StoreFilter)} className="mt-1 h-10 w-full rounded-2xl border border-border bg-bg px-3 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-accent/60">{stores.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="block text-[12px] font-medium text-muted">Maximum price (EGP, optional)<input type="number" min="0" inputMode="decimal" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="EGP" className="mt-1 h-10 w-full rounded-2xl border border-border bg-bg px-3 text-[14px] outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-accent/60" /></label></div><Button type="submit" size="lg" className="w-full" disabled={busy || !query.trim()}>{busy ? <><Loader2 className="size-4 animate-spin" /> Searching…</> : "Search stores"}</Button></form>{error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-[13px] text-danger">{error}</p>}{result && <SearchResults result={result} />}</div></Sheet>;
}

function SearchResults({ result }: { result: ShopSearchResult }) {
  return <div className="space-y-3">{result.stores.filter((store) => store.status === "unavailable").map((store) => <p key={store.id} className="rounded-2xl bg-surface-2 px-4 py-3 text-[12.5px] text-muted">{store.name}: {store.message ?? "This store could not be searched."} <a href={store.search_url} target="_blank" rel="noreferrer" className="underline underline-offset-2">Search {store.name}</a></p>)}{result.products.length === 0 ? <Empty icon={<Search className="size-6" />} title="No products found" body="Try a broader description or another store." /> : <div className="grid gap-3 sm:grid-cols-2">{result.products.map((product) => <ProductCard key={product.url} product={product} />)}</div>}</div>;
}

function ProductCard({ product }: { product: ShopProduct }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving || saved) return;
    setSaving(true);
    try { await api("/api/wishlist", "POST", { title: product.title, url: product.url, image_url: product.image_url ?? null, price: product.currency ? product.price ?? null : null, currency: product.currency ?? null, retailer: product.retailer, brand: product.brand ?? null, reason: `Saved from ${product.retailer}.`, status: "saved" }); setSaved(true); await mutate("/api/wishlist"); toast("Added to wishlist"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't save that product"); }
    finally { setSaving(false); }
  };
  return <article className="overflow-hidden rounded-[26px] border border-border bg-surface shadow-soft"><Link href={`/shop/product?url=${encodeURIComponent(product.url)}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/70"><div className="grid aspect-[4/3] place-items-center bg-tile p-3"><RetailerImage src={product.image_url} alt={product.title} className="h-full w-full" /></div><div className="space-y-1 p-3"><p className="line-clamp-2 text-[14px] font-semibold">{product.title}</p><p className="text-[12px] text-muted">{product.retailer}</p><p className="text-[13px] font-semibold">{formatPrice(product.price, product.currency)}</p></div></Link><div className="flex items-center gap-2 px-3 pb-3"><Button size="sm" className="flex-1" onClick={save} disabled={saved || saving}>{saved ? <><Check className="size-3.5" /> Saved</> : <><Bookmark className="size-3.5" /> Wishlist</>}</Button><a href={product.url} target="_blank" rel="noreferrer" className="grid size-8 place-items-center rounded-full bg-surface-2" aria-label={`Open ${product.title} at ${product.retailer}`}><ExternalLink className="size-3.5" /></a></div></article>;
}

export function RetailerImage({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return <div className={cn("grid place-items-center text-center text-[12px] text-faint", className)}><ShoppingBag className="size-7" aria-hidden="true" /><span>Image unavailable</span></div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img key={src} src={src} referrerPolicy="no-referrer" alt={alt} loading="lazy" onError={() => setFailedSrc(src)} className={cn("object-contain", className)} />;
}

function WishCard({ item, pairs }: { item: WishlistItem; pairs: Item[] }) {
  const router = useRouter();
  return <article className="flex gap-3 rounded-[26px] border border-border bg-surface p-3 shadow-soft"><button type="button" onClick={() => item.url && router.push(`/shop/product?url=${encodeURIComponent(item.url)}`)} className={cn("grid size-28 shrink-0 place-items-center overflow-hidden rounded-[20px] bg-tile", item.url && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70")} aria-label={item.url ? `View ${item.title}` : undefined}><RetailerImage src={item.image_url ?? undefined} alt={item.title} className="h-full w-full" /></button><div className="flex min-w-0 flex-1 flex-col gap-1.5"><div className="flex items-start gap-2"><div className="min-w-0 flex-1">{item.url ? <Link href={`/shop/product?url=${encodeURIComponent(item.url)}`} className="line-clamp-2 text-[14.5px] font-semibold leading-snug hover:underline">{item.title}</Link> : <p className="line-clamp-2 text-[14.5px] font-semibold leading-snug">{item.title}</p>}</div>{item.status === "idea" && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", item.priority === 1 ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted")}>{item.priority === 1 ? "Top pick" : `P${item.priority}`}</span>}</div>{item.retailer && <p className="text-[11px] text-muted">{item.retailer}</p>}{item.reason && <p className="line-clamp-3 text-[12.5px] text-muted">{item.reason}</p>}{pairs.length > 0 && <div className="flex items-center gap-1"><span className="text-[11px] text-faint">Pairs with</span>{pairs.slice(0, 4).map((pair) => <span key={pair.id} className="grid size-7 place-items-center rounded-lg bg-tile p-0.5" title={pair.name}><GarmentImage src={pair.image_url} alt={pair.name} className="h-full w-full" /></span>)}</div>}<div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1"><span className="w-full text-[13px] font-semibold">{formatPrice(item.price ?? undefined, item.currency ?? undefined)}</span>{item.url && <a href={item.url} target="_blank" rel="noreferrer" className="grid size-8 place-items-center rounded-full bg-surface-2" aria-label={`Open ${item.title}`}><ExternalLink className="size-3.5" /></a>}{item.status === "idea" && <><button type="button" onClick={() => void dismissSuggestion(item.id)} className="grid size-8 place-items-center rounded-full bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70" aria-label={`Dismiss ${item.title}`}><X className="size-3.5" /></button><Button size="sm" onClick={() => void updateWishlistStatus(item.id, "saved", "Added to wishlist")}><Bookmark className="size-3.5" /> Wishlist</Button></>}{item.status === "saved" && <Button size="sm" onClick={() => void updateWishlistStatus(item.id, "bought", "Marked as bought")}><Check className="size-3.5" /> Bought</Button>}{item.status === "bought" && <Link href="/add" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-[13px] font-medium text-primary-fg"><Plus className="size-3.5" /> Add to drawer</Link>}</div></div></article>;
}

export function formatPrice(price?: number, currency?: string) {
  if (price == null || !currency) return "Price unavailable";
  return `${price.toLocaleString()} ${currency}`;
}

export function AddWish({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [fields, setFields] = useState({ title: "", url: "", price: "", currency: "", image_url: "" });
  const [busy, setBusy] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const input = "h-11 w-full rounded-2xl border border-border bg-surface px-4 text-[15px] outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-accent/60";
  const lookup = async () => {
    if (!fields.url.trim()) return;
    setLookupBusy(true); setMessage(null);
    try { const result = await api<ShopProductResult>("/api/shop/product", "POST", { url: fields.url.trim() }); if (result.status === "ok") { const product = result.product; setFields((old) => ({ ...old, title: product.title || old.title, image_url: product.image_url ?? old.image_url, price: product.price == null ? old.price : String(product.price), currency: product.currency ?? old.currency })); setMessage("Retailer details filled in. Check them before saving."); } else setMessage(result.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Couldn't read that product link"); }
    finally { setLookupBusy(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!fields.title.trim()) return;
    if (fields.price && !fields.currency.trim()) { setMessage("Add the currency when you enter a price."); return; }
    setBusy(true);
    try { await api("/api/wishlist", "POST", { title: fields.title.trim(), url: fields.url.trim() || null, image_url: fields.image_url.trim() || null, price: fields.price ? Number(fields.price) : null, currency: fields.currency.trim() || null, status: "saved" }); await mutate("/api/wishlist"); setFields({ title: "", url: "", price: "", currency: "", image_url: "" }); onOpenChange(false); toast("Added to wishlist"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't save that item"); }
    finally { setBusy(false); }
  };
  return <Sheet open={open} onOpenChange={onOpenChange} title="Add to wishlist"><form className="space-y-3 pb-6" onSubmit={submit}><label className="block text-[12px] font-medium text-muted" htmlFor="wishlist-title">Name<input id="wishlist-title" required className={input} placeholder="What is it?" value={fields.title} onChange={(event) => setFields({ ...fields, title: event.target.value })} /></label><label className="block text-[12px] font-medium text-muted" htmlFor="wishlist-url">Product link (optional)<div className="mt-1 flex gap-2"><input id="wishlist-url" type="url" disabled={lookupBusy} className={cn(input, "mt-0 min-w-0 flex-1")} placeholder="https://…" value={fields.url} onChange={(event) => setFields({ ...fields, url: event.target.value })} /><Button type="button" size="sm" variant="surface" disabled={lookupBusy || !fields.url.trim()} onClick={() => void lookup()}>{lookupBusy ? <Loader2 className="size-3.5 animate-spin" /> : "Read"}</Button></div></label>{message && <p role="status" className="rounded-2xl bg-surface-2 px-3 py-2 text-[12px] text-muted">{message}</p>}<label className="block text-[12px] font-medium text-muted" htmlFor="wishlist-image">Image URL (optional)<input id="wishlist-image" type="url" className={input} placeholder="Filled from a retailer when available" value={fields.image_url} onChange={(event) => setFields({ ...fields, image_url: event.target.value })} /></label><div className="grid gap-2 sm:grid-cols-2"><label className="block text-[12px] font-medium text-muted" htmlFor="wishlist-price">Price (optional)<input id="wishlist-price" type="number" min="0" step="any" inputMode="decimal" className={input} placeholder="Amount" value={fields.price} onChange={(event) => setFields({ ...fields, price: event.target.value })} /></label><label className="block text-[12px] font-medium text-muted" htmlFor="wishlist-currency">Currency {fields.price && <span className="text-danger">required</span>}<input id="wishlist-currency" className={input} placeholder="EGP, USD…" value={fields.currency} onChange={(event) => setFields({ ...fields, currency: event.target.value })} /></label></div><Button size="lg" className="w-full" type="submit" disabled={busy || lookupBusy}>{busy ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : "Save"}</Button></form></Sheet>;
}

function ProductCheck() {
  const [url, setUrl] = useState("");
  const router = useRouter();
  return <form className="space-y-2 rounded-[26px] bg-surface p-4" onSubmit={(event) => { event.preventDefault(); router.push(`/stylist?q=${encodeURIComponent(`Does this work with what I own? ${url.trim()}`)}`); }}><p className="text-[14px] font-medium">Thinking of buying something?</p><div className="flex gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Product link to check</span><input type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Paste a product link" className="h-10 w-full rounded-full border border-border bg-bg px-4 text-[14px] outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-accent/60" /></label><Button size="md" type="submit">Check it</Button></div></form>;
}
