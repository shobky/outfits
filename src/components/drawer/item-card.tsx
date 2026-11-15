"use client";
import { Heart, ImageOff, WashingMachine } from "lucide-react";
import { useState } from "react";
import { patchItem } from "@/lib/hooks";
import type { Item } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GarmentImage({ src, alt, className, compact, onBroken }: { src: string | null; alt: string; className?: string; compact?: boolean; onBroken?: () => void }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-1.5 text-center text-xs text-faint", className)}>
        <ImageOff className="size-5" />
        {!compact && (src ? "Photo missing" : "No photo")}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- user uploads / data URLs; next/image adds no value here
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={cn("garment object-contain", className)}
      loading="lazy"
      onError={() => {
        setFailed(src);
        onBroken?.();
      }}
    />
  );
}

export function ItemCard({ item, onOpen }: { item: Item; onOpen?: (item: Item) => void }) {
  return (
    <div
      className={cn(
        "group relative aspect-[4/5] overflow-hidden rounded-[26px] border-[5px] border-surface bg-tile shadow-soft transition-transform active:scale-[0.98]",
        item.status === "archived" && "opacity-50",
      )}
    >
      <button type="button" onClick={() => onOpen?.(item)} className="absolute inset-0 flex items-center justify-center p-[12%] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent" aria-label={item.name}>
        <GarmentImage src={item.image_url} alt={item.name} className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]" />
      </button>
      <button
        onClick={() => patchItem(item.id, { is_favorite: !item.is_favorite })}
        aria-label={item.is_favorite ? "Unfavorite" : "Favorite"}
        type="button"
        aria-pressed={item.is_favorite}
        className="absolute right-1.5 top-1.5 grid size-11 place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      >
        <Heart className={cn("size-[22px] transition-all", item.is_favorite ? "fill-heart text-heart" : "fill-white/70 text-transparent dark:fill-white/25")} />
      </button>
      {item.in_laundry && (
        <span className="glass absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium">
          <WashingMachine className="size-3" /> Laundry
        </span>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-tile via-tile/90 to-transparent px-3 pb-2.5 pt-8">
        <p className="line-clamp-2 text-[12.5px] font-medium leading-snug">{item.name}</p>
      </div>
    </div>
  );
}
