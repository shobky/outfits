"use client";
import { Plus, Search, Shirt, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ProfileLink } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { Chip, ChipRow } from "@/components/ui/chip";
import { Empty } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import { filterItems } from "@/lib/data/filters";
import { useItems } from "@/lib/hooks";
import { CATEGORIES, CATEGORY_LABELS, OCCASIONS, SEASONS, type Category, type Occasion, type Season } from "@/lib/taxonomy";
import type { Item } from "@/lib/types";
import { ColorSwatches, Field, MultiChips } from "./attribute-picker";
import { ItemCard } from "./item-card";
import { ItemSheet } from "./item-sheet";

type View = "active" | "laundry" | "archived";

export function DrawerView() {
  const { data, isLoading } = useItems();
  const [cat, setCat] = useState<Category | "all" | "favorite">("all");
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [color, setColor] = useState<string[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [view, setView] = useState<View>("active");
  const [openId, setOpenId] = useState<string | null>(null);

  const all = data?.items;
  const items = useMemo(() => {
    if (!all) return [];
    let list = filterItems(all, {
      status: view === "archived" ? "archived" : "active",
      category: cat === "all" || cat === "favorite" ? undefined : cat,
      favorite: cat === "favorite" || undefined,
      color: color[0],
      q,
    });
    if (view === "laundry") list = list.filter((i) => i.in_laundry);
    if (seasons.length) list = list.filter((i) => seasons.some((s) => i.seasons.includes(s)));
    if (occasions.length) list = list.filter((i) => occasions.some((o) => i.occasions.includes(o)));
    return list;
  }, [all, cat, color, q, seasons, occasions, view]);

  const open: Item | null = all?.find((i) => i.id === openId) ?? null;
  const activeFilters = color.length + seasons.length + occasions.length + (view !== "active" ? 1 : 0);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    all?.filter((i) => i.status === "active").forEach((i) => (c[i.category] = (c[i.category] ?? 0) + 1));
    return c;
  }, [all]);

  return (
    <div className="pb-32 lg:pb-12">
      <PageHeader
        title="Drawer"
        left={
          searching ? null : (
            <Button variant="surface" size="sm" onClick={() => setSearching(true)}>
              <Search className="size-3.5" /> Search
            </Button>
          )
        }
        right={
          <div className="flex items-center gap-2">
            <Link href="/add" className="hidden h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-medium shadow-soft sm:flex">
              <Plus className="size-3.5" /> Upload
            </Link>
            <ProfileLink />
          </div>
        }
        sub={
          searching && (
            <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 shadow-soft">
              <Search className="size-4 text-faint" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search linen, navy, loafers…" className="h-11 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" />
              <button onClick={() => (setQ(""), setSearching(false))} aria-label="Close search">
                <X className="size-4 text-muted" />
              </button>
            </div>
          )
        }
      />

      <div className="space-y-4 px-4 md:px-8">
        <div className="flex items-center gap-2">
          <ChipRow className="flex-1">
            <Chip active={cat === "favorite"} onClick={() => setCat("favorite")}>
              Favorite
            </Chip>
            <Chip active={cat === "all"} onClick={() => setCat("all")}>
              All
            </Chip>
            {(Object.keys(CATEGORIES) as Category[]).filter((c) => counts[c] || c === cat).map((c) => (
              <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
                {CATEGORY_LABELS[c]}
                <span className="opacity-50">{counts[c] ?? 0}</span>
              </Chip>
            ))}
          </ChipRow>
          <Button variant="surface" size="icon" className="relative shrink-0" onClick={() => setFiltersOpen(true)} aria-label="Filters">
            <SlidersHorizontal className="size-4" />
            {activeFilters > 0 && <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-fg">{activeFilters}</span>}
          </Button>
        </div>

        {isLoading ? (
          <Grid>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-[26px] bg-surface-2" />
            ))}
          </Grid>
        ) : items.length ? (
          <Grid>
            {items.map((it) => (
              <ItemCard key={it.id} item={it} onOpen={(i) => setOpenId(i.id)} />
            ))}
          </Grid>
        ) : (
          <Empty
            icon={<Shirt className="size-6" />}
            title={all?.length ? "Nothing matches" : "Your drawer is empty"}
            body={all?.length ? "Try removing a filter." : "Snap photos of your clothes — we'll cut them out and tag them for you."}
            action={
              !all?.length && (
                <Link href="/add" className="mt-2 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-fg">
                  <Plus className="size-4" /> Add your first piece
                </Link>
              )
            }
          />
        )}
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen} title="Filters">
        <div className="space-y-6 pb-6">
          <Field label="Show">
            <MultiChips single options={["active", "laundry", "archived"] as const} value={[view]} onChange={([v]) => setView(v)} />
          </Field>
          <Field label="Color">
            <ColorSwatches single value={color} onChange={setColor} />
          </Field>
          <Field label="Season">
            <MultiChips options={SEASONS} value={seasons} onChange={setSeasons} />
          </Field>
          <Field label="Occasion">
            <MultiChips options={OCCASIONS} value={occasions} onChange={setOccasions} />
          </Field>
          <div className="flex gap-2">
            <Button variant="surface" className="flex-1" onClick={() => (setColor([]), setSeasons([]), setOccasions([]), setView("active"))}>
              Reset
            </Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              Show {items.length}
            </Button>
          </div>
        </div>
      </Sheet>

      <ItemSheet key={openId ?? "none"} item={open} onClose={() => setOpenId(null)} />
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">{children}</div>;
}
