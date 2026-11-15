"use client";
import { CalendarCheck, Heart, Layers, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ItemSheet } from "@/components/drawer/item-sheet";
import { toast } from "sonner";
import { mutate } from "swr";
import { ProfileLink } from "@/components/app-nav";
import { OutfitBoard } from "@/components/outfit/outfit-board";
import { TryOnButton } from "@/components/tryon/try-on";
import { Empty } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { markWorn, useOutfits } from "@/lib/hooks";
import { api, cn, titleCase } from "@/lib/utils";

export function OutfitsView() {
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data, isLoading } = useOutfits();
  const byId = new Map(data?.items.map((i) => [i.id, i]));

  return (
    <div className="pb-nav lg:pb-12">
      {detailId && <ItemSheet key={detailId} item={byId.get(detailId) ?? null} onClose={() => setDetailId(null)} />}
      <PageHeader
        title="Outfits"
        right={<ProfileLink />}
        left={
          <Link href="/stylist?q=Make%20me%20a%20new%20outfit%20for%20today" className="flex min-h-10 items-center gap-1.5 rounded-full bg-accent px-3 text-[13px] font-medium text-accent-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <Sparkles className="size-3.5" /> New
          </Link>
        }
      />
      <div className="px-4 md:px-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-[28px] bg-surface-2" />
            ))}
          </div>
        ) : !data?.outfits.length ? (
          <Empty
            icon={<Layers className="size-6" />}
            title="No outfits yet"
            body="Ask the stylist for a look and tap “Save outfit”."
            action={
              <Link href="/stylist" className="mt-2 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-fg">
                <Sparkles className="size-4" /> Open stylist
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {data.outfits.map((o) => {
              const items = o.items.flatMap((oi) => {
                const it = byId.get(oi.item_id);
                return it ? [{ id: it.id, name: it.name, image_url: it.image_url, slot: oi.slot }] : [];
              });
              const unavailable = o.items.some((oi) => byId.get(oi.item_id)?.in_laundry);
              return (
                <article key={o.id} className="min-w-0 overflow-hidden rounded-[28px] border border-border bg-surface p-2 shadow-soft">
                  <OutfitBoard items={items} compact onItemClick={setDetailId} />
                  <div className="space-y-3 px-2 pb-2 pt-3">
                    <div>
                      <h2 className="break-words text-[16px] font-semibold leading-snug tracking-tight">{o.name}</h2>
                      <p className="mt-1 text-[12px] text-muted">
                        {o.occasion ? titleCase(o.occasion) : "Any time"} · {items.length} pieces
                      </p>
                      {unavailable && <p className="mt-1 text-[12px] text-muted">Something is in the wash</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <button
                      type="button"
                      className="flex min-h-11 min-w-[130px] flex-1 items-center justify-center gap-2 rounded-full bg-primary px-3 text-[13px] font-medium text-primary-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      aria-label="Wore it today"
                      title="Wore it today"
                      onClick={async () => {
                        try {
                          const logged = await markWorn(items.map((i) => i.id), o.id);
                          toast.success(logged ? "Logged as worn today" : "Already logged for today");
                        } catch (e) {
                          toast.error(`Couldn't log that: ${e instanceof Error ? e.message : String(e)}`);
                        }
                      }}
                    >
                      <CalendarCheck className="size-4 shrink-0" aria-hidden="true" /> <span>Wore it today</span>
                      </button>
                      <TryOnButton compact itemIds={items.map((i) => i.id)} />
                      <button
                      type="button"
                      className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-text hover:bg-tile focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      aria-label={o.is_favorite ? "Remove from favorites" : "Add to favorites"}
                      aria-pressed={o.is_favorite}
                      onClick={async () => {
                        await api(`/api/outfits/${o.id}`, "PATCH", { is_favorite: !o.is_favorite });
                        mutate("/api/outfits");
                      }}
                    >
                      <Heart className={cn("size-4", o.is_favorite && "fill-heart text-heart")} />
                      </button>
                      <button
                      type="button"
                      className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      aria-label="Delete outfit"
                      onClick={async () => {
                        if (!confirm(`Delete ${o.name}? This cannot be undone.`)) return;
                        await api(`/api/outfits/${o.id}`, "DELETE");
                        mutate("/api/outfits");
                        toast("Outfit deleted");
                      }}
                    >
                      <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
