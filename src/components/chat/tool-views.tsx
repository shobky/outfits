"use client";
import { ArrowLeftRight, Bookmark, CalendarCheck, Check, Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, ExternalLink, Heart, ShoppingBag, Sun, Wind } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { GarmentImage } from "@/components/drawer/item-card";
import { OutfitBoard } from "@/components/outfit/outfit-board";
import { Button } from "@/components/ui/button";
import type { VisualItem } from "@/lib/ai/tools";
import type { Occasion } from "@/lib/taxonomy";
import { markWorn } from "@/lib/hooks";
import type { WeatherSnapshot, WishlistItem } from "@/lib/types";
import { api, cn, titleCase } from "@/lib/utils";

export type WeatherResult = WeatherSnapshot;

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
      <OutfitBoard items={items} />
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
        </div>
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {items.map((i) => (
            <span key={i.id} className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[11.5px] font-medium">
              {i.name}
            </span>
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
  return (
    <div className="w-full space-y-2">
      {caption && <p className="text-sm text-muted">{caption}</p>}
      <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
        {items.map((i) => (
          <div key={i.id} className="w-32 shrink-0 space-y-1.5">
            <div className="grid aspect-[4/5] place-items-center rounded-[22px] border-4 border-surface bg-tile p-3 shadow-soft">
              <GarmentImage src={i.image_url} alt={i.name} className="h-full w-full" />
            </div>
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
          <img src={w.image_url} alt={w.title} referrerPolicy="no-referrer" onError={() => setImageFailed(true)} className="h-full w-full object-cover" />
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
          <a href={w.url} target="_blank" rel="noreferrer" className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-[13px] font-medium text-primary-fg">
            View <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </div>
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
