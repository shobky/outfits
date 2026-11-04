"use client";
import { Bookmark, Check, ExternalLink, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { GarmentImage } from "@/components/drawer/item-card";
import { OutfitBoard } from "@/components/outfit/outfit-board";
import { Button } from "@/components/ui/button";
import type { VisualItem } from "@/lib/ai/tools";
import type { Occasion } from "@/lib/taxonomy";
import type { WishlistItem } from "@/lib/types";
import { api, cn, titleCase } from "@/lib/utils";

export function OutfitCard({
  outfit,
}: {
  outfit: { name: string; occasion: string | null; why: string; swap: string | null; problems: string[]; items: VisualItem[] };
}) {
  const [saved, setSaved] = useState(false);
  const save = async () => {
    await api("/api/outfits", "POST", {
      name: outfit.name,
      occasion: outfit.occasion as Occasion | null,
      notes: outfit.why,
      source: "ai",
      items: outfit.items.map((i) => ({ item_id: i.id, slot: i.slot })),
    });
    setSaved(true);
    mutate("/api/outfits");
    toast.success("Outfit saved");
  };
  return (
    <div className="w-full max-w-[420px] overflow-hidden rounded-[30px] border border-border bg-surface p-2 shadow-soft">
      <OutfitBoard items={outfit.items} />
      <div className="space-y-3 px-3 pb-2 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[17px] font-semibold tracking-tight">{outfit.name}</h3>
            {outfit.occasion && <p className="text-xs text-muted">{titleCase(outfit.occasion)}</p>}
          </div>
          <Button size="sm" variant={saved ? "surface" : "primary"} onClick={save} disabled={saved}>
            {saved ? <Check className="size-3.5" /> : <Bookmark className="size-3.5" />}
            {saved ? "Saved" : "Save outfit"}
          </Button>
        </div>
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {outfit.items.map((i) => (
            <span key={i.id} className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[11.5px] font-medium">
              {i.name}
            </span>
          ))}
        </div>
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

export function SuggestionCards({ items }: { items: WishlistItem[] }) {
  return (
    <div className="w-full space-y-2">
      <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
        {items.map((w) => (
          <div key={w.id} className="flex w-60 shrink-0 flex-col gap-2 rounded-[24px] border border-border bg-surface p-3 shadow-soft">
            <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl bg-tile">
              {w.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.image_url} alt={w.title} className="h-full w-full object-cover" />
              ) : (
                <ShoppingBag className="size-7 text-faint" />
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="line-clamp-1 text-[13.5px] font-semibold">{w.title}</p>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", w.priority === 1 ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted")}>P{w.priority}</span>
            </div>
            <p className="line-clamp-3 text-[12px] text-muted">{w.reason}</p>
            <div className="mt-auto flex items-center justify-between pt-1 text-[12px]">
              <span className="font-medium">{w.price ? `${w.price} ${w.currency ?? ""}` : "—"}</span>
              {w.url && (
                <a href={w.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-muted hover:text-text">
                  {w.retailer ?? "Shop"} <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      <Link href="/shop" className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-text">
        <ShoppingBag className="size-3.5" /> Saved to your Shop tab →
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
