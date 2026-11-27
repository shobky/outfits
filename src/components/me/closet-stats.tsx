"use client";
import { GarmentImage } from "@/components/drawer/item-card";
import { useItems } from "@/lib/hooks";
import type { Item } from "@/lib/types";

const STALE_DAYS = 30;

function daysSince(iso: string | null) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3 py-2.5 text-center">
      <p className="text-lg font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="text-[11px] leading-tight text-muted">{label}</p>
    </div>
  );
}

function WornRow({ item }: { item: Item }) {
  return (
    <li className="flex items-center gap-3">
      <div className="size-11 shrink-0 overflow-hidden rounded-xl bg-surface-2">
        <GarmentImage src={item.image_url} alt={item.name} compact className="size-full object-contain" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium">{item.name}</p>
        <p className="text-[12px] text-muted">
          {item.last_worn_at ? `Last worn ${new Date(item.last_worn_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : "Not worn yet"}
        </p>
      </div>
      <p className="shrink-0 text-[13px] font-semibold tabular-nums text-muted">
        {item.wear_count}×
      </p>
    </li>
  );
}

/** Wear-log driven closet summary: what gets worn, what sits. */
const isCatalog = (i: Item) => i.notes?.includes("[catalog:");

export function ClosetStats() {
  const { data } = useItems();
  const all = (data?.items ?? []).filter((i) => i.status === "active");
  const items = all.filter((i) => !isCatalog(i));
  const catalogCount = all.length - items.length;
  if (!data || items.length === 0) return null;

  const totalWears = items.reduce((sum, i) => sum + i.wear_count, 0);
  const favorites = items.filter((i) => i.is_favorite).length;
  const laundry = items.filter((i) => i.in_laundry).length;
  const mostWorn = [...items].filter((i) => i.wear_count > 0).sort((a, b) => b.wear_count - a.wear_count).slice(0, 5);
  const neverWorn = items.filter((i) => i.wear_count === 0);
  const stale = items.filter((i) => i.wear_count > 0 && daysSince(i.last_worn_at) >= STALE_DAYS);

  return (
    <section aria-label="Closet stats" className="space-y-4 rounded-[28px] bg-surface p-5">
      <div className="space-y-1">
        <h2 className="font-semibold tracking-tight">Closet stats</h2>
        <p className="text-[13px] text-muted">From the pieces you log as worn, in Outfits.</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Stat value={items.length} label="pieces" />
        <Stat value={totalWears} label="wears logged" />
        <Stat value={favorites} label="favorites" />
        <Stat value={laundry} label="in laundry" />
      </div>
      {mostWorn.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="text-[13px] font-semibold text-muted">Most worn</h3>
          <ul className="space-y-2.5">
            {mostWorn.map((item) => (
              <WornRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
      )}
      {(neverWorn.length > 0 || stale.length > 0) && (
        <div className="space-y-1 rounded-2xl bg-surface-2 p-3 text-[13px] text-muted">
          {neverWorn.length > 0 && (
            <p>
              {neverWorn.length} {neverWorn.length === 1 ? "piece hasn't" : "pieces haven't"} been worn yet.
            </p>
          )}
          {stale.length > 0 && (
            <p>
              {stale.length} not worn in {STALE_DAYS}+ days.
            </p>
          )}
        </div>
      )}
      {totalWears === 0 && <p className="text-[13px] text-muted">Log what you wear from the Outfits tab and your stats build themselves.</p>}
      {catalogCount > 0 && <p className="text-[13px] text-faint">+ {catalogCount} catalog {catalogCount === 1 ? "piece" : "pieces"} ready to try on, not counted above.</p>}
    </section>
  );
}
