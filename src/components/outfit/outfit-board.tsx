"use client";
import type { Slot } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

export interface BoardItem {
  id: string;
  name: string;
  image_url: string | null;
  slot: Slot;
}

type Box = { l: number; t: number; w: number; h: number; r: number; z: number };

/**
 * Editorial flat-lay: places real cut-outs like a stylist's mood board.
 * Positions are % of a 4:5 canvas, tuned per combination of slots present.
 * Tweak LAYOUTS to change the look (see docs/DESIGN.md → Outfit board).
 */
function layout(items: BoardItem[]): Map<string, Box> {
  const has = (s: Slot) => items.some((i) => i.slot === s);
  const outer = has("outer");
  const boxes: Record<Slot, Box[]> = {
    outer: [{ l: 2, t: 3, w: 50, h: 46, r: -5, z: 1 }],
    top: outer ? [{ l: 44, t: 4, w: 50, h: 40, r: 4, z: 2 }] : [{ l: 18, t: 2, w: 60, h: 44, r: -2, z: 2 }],
    onepiece: [{ l: outer ? 40 : 22, t: 4, w: 52, h: 88, r: 0, z: 2 }],
    bottom: outer ? [{ l: 24, t: 38, w: 44, h: 58, r: 0, z: 3 }] : [{ l: 10, t: 40, w: 48, h: 57, r: 1, z: 3 }],
    shoes: outer ? [{ l: 66, t: 72, w: 32, h: 24, r: -6, z: 4 }] : [{ l: 58, t: 70, w: 38, h: 26, r: -6, z: 4 }],
    accessory: [
      { l: 2, t: 60, w: 22, h: 18, r: 8, z: 5 },
      { l: 72, t: 48, w: 22, h: 18, r: -8, z: 5 },
      { l: 4, t: 80, w: 20, h: 16, r: -4, z: 5 },
    ],
  };
  const used: Record<string, number> = {};
  const map = new Map<string, Box>();
  for (const it of items) {
    const list = boxes[it.slot];
    const idx = used[it.slot] ?? 0;
    used[it.slot] = idx + 1;
    const b = list[Math.min(idx, list.length - 1)];
    // nudge duplicates so they don't stack exactly
    map.set(it.id, idx >= list.length ? { ...b, l: b.l + 6 * (idx - list.length + 1), t: b.t + 4 } : b);
  }
  return map;
}

export function OutfitBoard({ items, className, compact }: { items: BoardItem[]; className?: string; compact?: boolean }) {
  const boxes = layout(items);
  return (
    <div
      className={cn(
        "relative aspect-[4/5] w-full overflow-hidden rounded-[28px] bg-tile",
        "bg-[radial-gradient(120%_80%_at_50%_0%,rgba(255,255,255,0.55),transparent_60%)] dark:bg-[radial-gradient(120%_80%_at_50%_0%,rgba(255,255,255,0.06),transparent_60%)]",
        className,
      )}
    >
      {items.map((it, i) => {
        const b = boxes.get(it.id)!;
        return (
          <div
            key={it.id}
            className="absolute animate-in fade-in zoom-in-95 fill-mode-both"
            style={{
              left: `${b.l}%`,
              top: `${b.t}%`,
              width: `${b.w}%`,
              height: `${b.h}%`,
              zIndex: b.z,
              transform: `rotate(${b.r}deg)`,
              animationDelay: `${i * 90}ms`,
              animationDuration: "500ms",
            }}
          >
            {it.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.image_url} alt={it.name} title={it.name} className={cn("garment h-full w-full object-contain", compact && "drop-shadow-sm")} draggable={false} />
            )}
          </div>
        );
      })}
    </div>
  );
}
