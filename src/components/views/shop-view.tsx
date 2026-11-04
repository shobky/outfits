"use client";
import { Bookmark, Check, ExternalLink, Plus, ShoppingBag, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
import { api, cn } from "@/lib/utils";

type Tab = "idea" | "saved" | "bought";

async function setStatus(id: string, status: WishlistStatus, msg: string) {
  await api(`/api/wishlist/${id}`, "PATCH", { status });
  mutate("/api/wishlist");
  toast(msg);
}

export function ShopView() {
  const { data, isLoading } = useWishlist();
  const [tab, setTab] = useState<Tab>("idea");
  const [adding, setAdding] = useState(false);
  const list = data?.wishlist.filter((w) => w.status === tab) ?? [];
  const byId = new Map(data?.items.map((i) => [i.id, i]));

  return (
    <div className="pb-32 lg:pb-12">
      <PageHeader
        title="Shop"
        left={
          <Button variant="surface" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" /> Add
          </Button>
        }
        right={<ProfileLink />}
        sub={
          <div className="flex justify-center">
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: "idea", label: "Suggestions" },
                { value: "saved", label: "Wishlist" },
                { value: "bought", label: "Bought" },
              ]}
            />
          </div>
        }
      />
      <div className="space-y-4 px-4 md:px-8">
        <Link
          href="/stylist?q=Analyse%20my%20wardrobe%20and%20suggest%20what%20to%20buy%20next"
          className="flex items-center gap-3 rounded-[26px] bg-gradient-to-br from-accent/90 to-accent/60 p-4 text-accent-fg shadow-soft active:scale-[0.99]"
        >
          <div className="grid size-11 place-items-center rounded-2xl bg-black/10">
            <Sparkles className="size-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Find my wardrobe gaps</p>
            <p className="text-[13px] opacity-75">The stylist checks what you own and suggests what unlocks the most outfits.</p>
          </div>
        </Link>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-[26px] bg-surface-2" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <Empty
            icon={<ShoppingBag className="size-6" />}
            title={tab === "idea" ? "No suggestions yet" : tab === "saved" ? "Wishlist is empty" : "Nothing bought yet"}
            body={tab === "idea" ? "Ask the stylist what's missing — suggestions land here." : "Save suggestions you like to keep track of them."}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((w) => (
              <WishCard key={w.id} w={w} pairs={w.pairs_with.map((id) => byId.get(id)).filter(Boolean) as Item[]} />
            ))}
          </div>
        )}
      </div>
      <AddWish open={adding} onOpenChange={setAdding} />
    </div>
  );
}

function WishCard({ w, pairs }: { w: WishlistItem; pairs: Item[] }) {
  return (
    <div className="flex gap-3 rounded-[26px] border border-border bg-surface p-3 shadow-soft">
      <div className="grid size-28 shrink-0 place-items-center overflow-hidden rounded-[20px] bg-tile">
        {w.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={w.image_url} alt={w.title} className="h-full w-full object-cover" />
        ) : (
          <ShoppingBag className="size-7 text-faint" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <p className="line-clamp-2 flex-1 text-[14.5px] font-semibold leading-snug">{w.title}</p>
          {w.status === "idea" && (
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", w.priority === 1 ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted")}>
              {w.priority === 1 ? "Top pick" : `P${w.priority}`}
            </span>
          )}
        </div>
        {w.reason && <p className="line-clamp-3 text-[12.5px] text-muted">{w.reason}</p>}
        {pairs.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-faint">Pairs with</span>
            {pairs.slice(0, 4).map((p) => (
              <span key={p.id} className="grid size-7 place-items-center rounded-lg bg-tile p-0.5" title={p.name}>
                <GarmentImage src={p.image_url} alt={p.name} className="h-full w-full" />
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center gap-1.5 pt-1">
          <span className="mr-auto text-[13px] font-semibold">{w.price ? `${w.price} ${w.currency ?? ""}` : ""}</span>
          {w.url && (
            <a href={w.url} target="_blank" rel="noreferrer" className="grid size-8 place-items-center rounded-full bg-surface-2" aria-label="Open product">
              <ExternalLink className="size-3.5" />
            </a>
          )}
          {w.status === "idea" && (
            <>
              <button onClick={() => setStatus(w.id, "dismissed", "Dismissed")} className="grid size-8 place-items-center rounded-full bg-surface-2" aria-label="Dismiss">
                <X className="size-3.5" />
              </button>
              <Button size="sm" onClick={() => setStatus(w.id, "saved", "Added to wishlist")}>
                <Bookmark className="size-3.5" /> Wishlist
              </Button>
            </>
          )}
          {w.status === "saved" && (
            <Button size="sm" onClick={() => setStatus(w.id, "bought", "Nice! Add it to your drawer when it arrives.")}>
              <Check className="size-3.5" /> Bought
            </Button>
          )}
          {w.status === "bought" && (
            <Link href="/add" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-[13px] font-medium text-primary-fg">
              <Plus className="size-3.5" /> Add to drawer
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function AddWish({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [f, setF] = useState({ title: "", url: "", price: "", image_url: "" });
  const input = "h-11 w-full rounded-2xl border border-border bg-surface px-4 text-[15px] outline-none placeholder:text-faint";
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add to wishlist">
      <form
        className="space-y-3 pb-6"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!f.title) return;
          await api("/api/wishlist", "POST", { title: f.title, url: f.url || null, image_url: f.image_url || null, price: f.price ? Number(f.price) : null, status: "saved" });
          mutate("/api/wishlist");
          setF({ title: "", url: "", price: "", image_url: "" });
          onOpenChange(false);
          toast("Added to wishlist");
        }}
      >
        <input className={input} placeholder="What is it?" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <input className={input} placeholder="Link (optional)" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
        <input className={input} placeholder="Image URL (optional)" value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} />
        <input className={input} placeholder="Price (optional)" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        <Button size="lg" className="w-full" type="submit">
          Save
        </Button>
      </form>
    </Sheet>
  );
}
