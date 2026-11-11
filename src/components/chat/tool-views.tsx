"use client";
import { ArrowLeftRight, Bookmark, CalendarCheck, Check, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, ExternalLink, Heart, ShoppingBag, Sun, Wind } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { mutate } from "swr";
import { GarmentImage } from "@/components/drawer/item-card";
import { ItemSheet } from "@/components/drawer/item-sheet";
import { OutfitBoard } from "@/components/outfit/outfit-board";
import { TryOnButton, TryOnSheet } from "@/components/tryon/try-on";
import { Button } from "@/components/ui/button";
import type { VisualItem } from "@/lib/ai/tools";
import type { Occasion } from "@/lib/taxonomy";
import { track } from "@/lib/events";
import { markWorn, useItems } from "@/lib/hooks";
import type { WeatherSnapshot, WishlistItem } from "@/lib/types";
import { api, cn, titleCase } from "@/lib/utils";
import { fetcher } from "@/lib/utils";
import type { TryOnRun } from "@/lib/types";

export type WeatherResult = WeatherSnapshot;

export function TryOnSuggestion({ items, reason, available, needs_photo, error, chatId, toolCallId }: { items: VisualItem[]; reason: string; available: boolean; needs_photo: boolean; error?: string; chatId?: string; toolCallId?: string }) {
  const { data } = useSWR<{ runs: TryOnRun[] }>(chatId ? "/api/try-on" : null, fetcher);
  const saved = data?.runs.find((run) => run.recipe.chat_id === chatId && run.recipe.tool_call_id === toolCallId);
  const [openSaved, setOpenSaved] = useState(false);
  return (
    <div className="max-w-[420px] space-y-4 rounded-[28px] border border-border bg-surface p-4 shadow-soft">
      <div><p className="text-xs font-medium text-muted">YOUR FITTING ROOM</p><h3 className="mt-1 text-lg font-semibold">Picture yourself in this</h3></div>
      <p className="text-sm text-muted">{error ?? reason}</p>
      <ItemStrip items={items} />
      {!error && available && <TryOnButton itemIds={items.map((i) => i.id)} chatId={chatId} toolCallId={toolCallId} />}
      {saved && <><button type="button" className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 p-2 text-left" onClick={() => setOpenSaved(true)}><img src={saved.result_url} alt="Saved try-on preview" className="size-14 rounded-xl object-cover" /><span className="text-xs font-medium">Open saved preview<span className="mt-0.5 block font-normal text-muted">Generated {new Date(saved.created_at).toLocaleDateString()}</span></span></button>{openSaved && <TryOnSheet initialRun={saved} itemIds={saved.recipe.item_ids} product={saved.recipe.product} chatId={chatId} toolCallId={toolCallId} onClose={() => setOpenSaved(false)} />}</>}
      {needs_photo && <Link href="/me#try-on-profile" className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">Set up your photo profile</Link>}
      {!available && !error && <p className="text-xs text-muted">Try-on isn’t enabled for this account yet.</p>}
      <p className="text-xs text-faint">AI visual preview. Your photos and saved details guide the result; exact fit isn’t measured.</p>
    </div>
  );
}

function WeatherIcon({ condition }: { condition: string }) {
  const c = condition.toLowerCase();
  const className = "size-7";
  if (c.includes("thunder")) return <CloudLightning className={className} />;
  if (c.includes("snow")) return <CloudSnow className={className} />;
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower")) return <CloudRain className={className} />;
  if (c.includes("fog")) return <CloudFog className={className} />;
  if (c.includes("overcast")) return <Cloud className={className} />;
  if (c.includes("partly")) return <CloudSun className={className} />;
  return <Sun className={className} />;
}

function dayLabel(date: string) {
  const d = new Date(`${date}T12:00:00`);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
}

export function WeatherCard({ weather: w }: { weather: WeatherResult }) {
  return (
    <div className="flex w-full max-w-[420px] items-center gap-4 rounded-[26px] border border-border bg-surface p-4 shadow-soft">
      <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-surface-2">
        <WeatherIcon condition={w.condition} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] text-muted">
          {w.location} · {dayLabel(w.date)}
        </p>
        <p className="flex items-baseline gap-2">
          <span className="text-[26px] font-semibold tracking-tight">{w.temp_c}°</span>
          <span className="truncate text-[13px] font-medium">{w.condition}</span>
        </p>
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-muted">
          {w.temp_min_c !== undefined && w.temp_max_c !== undefined && <span>{w.temp_min_c}° to {w.temp_max_c}°</span>}
          {w.rain_chance !== undefined && w.rain_chance !== null && (
            <span className="flex items-center gap-1">
              <Droplets className="size-3" /> {w.rain_chance}%
            </span>
          )}
          {w.wind_kmh !== undefined && (
            <span className="flex items-center gap-1">
              <Wind className="size-3" /> {w.wind_kmh} km/h
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

export interface OutfitResult {
  name: string;
  occasion: string | null;
  why: string;
  /** Older saved chats have a plain-text swap instead. */
  swap?: string | null;
  swaps?: { replace_id: string; replace_name: string; with: VisualItem; note: string }[];
  problems: string[];
  items: VisualItem[];
}

export function OutfitCard({ outfit }: { outfit: OutfitResult }) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data: wardrobe } = useItems();
  const openDetail = (id: string) => {
    if (wardrobe?.items.some((i) => i.id === id)) setDetailId(id);
    else toast.error(wardrobe ? "This piece is no longer in your drawer." : "Your drawer is still loading. Please try again.");
  };
  const [saved, setSaved] = useState(false);
  const [worn, setWorn] = useState(false);
  const [applied, setApplied] = useState<number[]>([]);
  const swaps = outfit.swaps ?? [];
  const items = outfit.items.map((item) => {
    const swap = swaps.find((x, n) => applied.includes(n) && x.replace_id === item.id);
    return swap ? swap.with : item;
  });

  const toggleSwap = (n: number) => {
    // Two swaps can target one piece, so tapping one turns off any other for that piece.
    setApplied((on) => (on.includes(n) ? on.filter((x) => x !== n) : [...on.filter((x) => swaps[x].replace_id !== swaps[n].replace_id), n]));
    setSaved(false);
    setWorn(false);
  };

  const save = async () => {
    try {
      await api("/api/outfits", "POST", {
        name: outfit.name,
        occasion: outfit.occasion as Occasion | null,
        notes: outfit.why,
        source: "ai",
        items: items.map((i) => ({ item_id: i.id, slot: i.slot })),
      });
      setSaved(true);
      track("outfit_saved");
      mutate("/api/outfits");
      toast.success("Outfit saved");
    } catch (e) {
      toast.error(`Couldn't save the outfit: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const wear = async () => {
    try {
      const logged = await markWorn(items.map((i) => i.id));
      setWorn(true);
      toast.success(logged ? "Logged as worn today" : "Already logged for today");
    } catch (e) {
      toast.error(`Couldn't log that: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="w-full max-w-[420px] overflow-hidden rounded-[30px] border border-border bg-surface p-2 shadow-soft">
      <OutfitBoard items={items} onItemClick={openDetail} />
      {detailId && <ItemSheet key={detailId} item={wardrobe?.items.find((i) => i.id === detailId) ?? null} onClose={() => setDetailId(null)} />}
      <div className="space-y-3 px-3 pb-2 pt-4">
        <div>
          <h3 className="text-[17px] font-semibold tracking-tight">{outfit.name}</h3>
          {outfit.occasion && <p className="text-xs text-muted">{titleCase(outfit.occasion)}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={saved ? "surface" : "primary"} onClick={save} disabled={saved}>
            {saved ? <Check className="size-3.5" /> : <Bookmark className="size-3.5" />}
            {saved ? "Saved" : "Save outfit"}
          </Button>
          <Button size="sm" variant="surface" onClick={wear} disabled={worn}>
            {worn ? <Check className="size-3.5" /> : <CalendarCheck className="size-3.5" />}
            {worn ? "Logged today" : "Wore it today"}
          </Button>
          <TryOnButton itemIds={items.map((i) => i.id)} />
        </div>
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {items.map((i) => (
            <button type="button" onClick={() => openDetail(i.id)} key={i.id} className="min-h-11 shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[11.5px] font-medium">
              {i.name}
            </button>
          ))}
        </div>
        {swaps.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">Swaps</p>
            {swaps.map((x, n) => (
              <button
                key={n}
                aria-pressed={applied.includes(n)}
                onClick={() => toggleSwap(n)}
                className={cn("flex w-full items-center gap-2.5 rounded-2xl border p-1.5 pr-3 text-left transition-colors", applied.includes(n) ? "border-accent bg-accent/10" : "border-border hover:bg-surface-2")}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-tile p-1">
                  <GarmentImage src={x.with.image_url} alt="" compact className="h-full w-full" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium">{x.with.name}</span>
                  <span className="block truncate text-[11.5px] text-muted">
                    Instead of {x.replace_name.toLowerCase()} · {x.note}
                  </span>
                </span>
                {applied.includes(n) ? <Check className="size-4 shrink-0" /> : <ArrowLeftRight className="size-4 shrink-0 text-faint" />}
              </button>
            ))}
          </div>
        )}
        {outfit.swap && !swaps.length && <p className="text-[12.5px] text-muted">{outfit.swap}</p>}
        {outfit.problems.length > 0 && <p className="text-xs text-danger">⚠ {outfit.problems.join(" · ")}</p>}
      </div>
    </div>
  );
}

export function ItemStrip({ items, caption }: { items: VisualItem[]; caption?: string }) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data: wardrobe } = useItems();
  const openDetail = (id: string) => {
    if (wardrobe?.items.some((i) => i.id === id)) setDetailId(id);
    else toast.error(wardrobe ? "This piece is no longer in your drawer." : "Your drawer is still loading. Please try again.");
  };
  return (
    <div className="w-full space-y-2">
      {detailId && <ItemSheet key={detailId} item={wardrobe?.items.find((i) => i.id === detailId) ?? null} onClose={() => setDetailId(null)} />}
      {caption && <p className="text-sm text-muted">{caption}</p>}
      <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
        {items.map((i) => (
          <div key={i.id} className="w-32 shrink-0 space-y-1.5">
            <button type="button" aria-label={`View ${i.name}`} onClick={() => openDetail(i.id)} className="grid aspect-[4/5] w-full place-items-center rounded-[22px] border-4 border-surface bg-tile p-3 shadow-soft">
              <GarmentImage src={i.image_url} alt={i.name} className="h-full w-full" />
            </button>
            <p className="truncate px-1 text-[12px] font-medium">{i.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatPrice(price: number, currency: string | null) {
  if (!currency) return String(price);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(price);
  } catch {
    return `${price} ${currency}`;
  }
}

function ProductCard({ item: w }: { item: WishlistItem }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [saved, setSaved] = useState(w.status === "saved");
  const save = async () => {
    try {
      await api(`/api/wishlist/${w.id}`, "PATCH", { status: "saved" });
      setSaved(true);
      mutate("/api/wishlist");
      toast.success("Saved to your wishlist");
    } catch (e) {
      toast.error(`Couldn't save it: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  return (
    <div className="flex w-60 shrink-0 flex-col gap-2 rounded-[24px] border border-border bg-surface p-3 shadow-soft">
      <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl bg-tile">
        {w.image_url && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={w.image_url} alt={w.title} referrerPolicy="no-referrer" onError={() => setImageFailed(true)} className="h-full w-full object-contain" />
        ) : (
          <ShoppingBag className="size-7 text-faint" />
        )}
      </div>
      <div>
        <p className="line-clamp-2 text-[13.5px] font-semibold">{w.title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px]">
          <span className="font-medium">{w.price ? formatPrice(w.price, w.currency) : "Price not found"}</span>
          {w.retailer && <span className="truncate text-muted">· {w.retailer}</span>}
        </p>
      </div>
      <p className="line-clamp-3 text-[12px] text-muted">{w.reason}</p>
      <div className="mt-auto flex items-center gap-2 pt-1">
        <Button size="sm" variant="surface" className="flex-1" onClick={save} disabled={saved}>
          {saved ? <Check className="size-3.5" /> : <Heart className="size-3.5" />}
          {saved ? "Saved" : "Save"}
        </Button>
        {w.url && (
          <Link href={`/shop/product?url=${encodeURIComponent(w.url)}`} onClick={() => track("shop_suggestion_tap", { where: "chat" })} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-[13px] font-medium text-primary-fg">
            View <ExternalLink className="size-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

export interface ProductCheckResult {
  url: string;
  readable: boolean;
  title: string | null;
  image_url: string | null;
  price: number | null;
  currency: string | null;
  retailer: string | null;
}

export function ProductCheckCard({ product: p }: { product: ProductCheckResult }) {
  const [imageFailed, setImageFailed] = useState(false);
  let host = p.url;
  try {
    host = new URL(p.url).hostname.replace(/^www\./, "");
  } catch {}
  return (
    <Link href={`/shop/product?url=${encodeURIComponent(p.url)}`} onClick={() => track("shop_suggestion_tap", { where: "check" })} className="flex w-full max-w-[420px] items-center gap-3 rounded-[26px] border border-border bg-surface p-3 shadow-soft">
      <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-tile">
        {p.image_url && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image_url} alt="" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} className="size-full object-contain" />
        ) : (
          <ShoppingBag className="size-6 text-faint" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-[13.5px] font-semibold">{p.title ?? (p.readable ? host : "We couldn't read this page")}</span>
        <span className="block truncate text-[12.5px] text-muted">{[p.price ? formatPrice(p.price, p.currency) : null, p.retailer ?? host].filter(Boolean).join(" · ")}</span>
      </span>
      <ExternalLink className="size-4 shrink-0 text-faint" />
    </Link>
  );
}

export function SuggestionCards({ items }: { items: WishlistItem[] }) {
  return (
    <div className="w-full space-y-2">
      <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
        {items.map((w) => (
          <ProductCard key={w.id} item={w} />
        ))}
      </div>
      <Link href="/shop" className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-text">
        <ShoppingBag className="size-3.5" /> In your Shop tab →
      </Link>
    </div>
  );
}

export function QuickReplies({
  question,
  options,
  answered,
  onAnswer,
}: {
  question: string;
  options: string[];
  answered?: string;
  onAnswer: (a: string) => void;
}) {
  return (
    <div className="w-full space-y-2.5">
      <p className="text-[15px] font-medium">{question}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            disabled={!!answered}
            onClick={() => onAnswer(o)}
            className={cn(
              "h-9 rounded-full border px-4 text-[13px] font-medium transition-all",
              answered === o ? "border-transparent bg-primary text-primary-fg" : answered ? "border-border text-faint" : "border-border-strong bg-surface hover:bg-surface-2 active:scale-95",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
