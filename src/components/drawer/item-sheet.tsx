"use client";
import { Archive, ArchiveRestore, Heart, Pencil, Sparkles, Trash2, WashingMachine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { deleteItem, patchItem } from "@/lib/hooks";
import { COLORS, FORMALITY_LABELS, WARMTH_LABELS } from "@/lib/taxonomy";
import type { Item } from "@/lib/types";
import { cn, titleCase } from "@/lib/utils";
import { ItemForm, type Draft } from "./item-form";
import { ItemPhotos } from "./item-photos";
import { TryOnButton } from "@/components/tryon/try-on";
import { ShareButton } from "@/components/share/share-button";

export function ItemSheet({ item, onClose }: { item: Item | null; onClose: () => void }) {
  // parent remounts this sheet per item (key), so state starts fresh
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(item);
  const router = useRouter();

  if (!item) return null;
  const removeItem = async () => {
    if (!confirm(`Delete "${item.name}" permanently?`)) return;
    await deleteItem(item.id);
    toast("Deleted");
    onClose();
  };
  const toggle = (patch: Partial<Item>, msg: string) => patchItem(item.id, patch).then(() => toast(msg));

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()} title={editing ? "Edit piece" : item.name}>
      {!editing && <div className="mb-4"><TryOnButton itemIds={[item.id]} disabled={!item.image_url || item.status === "archived" || item.in_laundry} /></div>}
      {editing && draft ? (
        <div className="space-y-5 pb-6">
          <ItemForm value={draft} onChange={setDraft} />
          <div className="flex gap-2">
            <Button variant="surface" className="flex-1" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={async () => {
                await patchItem(item.id, draft);
                setDraft(draft);
                toast("Saved");
                setEditing(false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5 pb-6">
          <ItemPhotos item={item} onDeleteItem={removeItem} />

          <div className="grid grid-cols-4 gap-2">
            <Action icon={Heart} label="Favorite" on={item.is_favorite} onClick={() => toggle({ is_favorite: !item.is_favorite }, item.is_favorite ? "Removed from favorites" : "Added to favorites")} />
            <Action icon={WashingMachine} label="Laundry" on={item.in_laundry} onClick={() => toggle({ in_laundry: !item.in_laundry }, item.in_laundry ? "Back in the drawer" : "Marked as in the wash")} />
            <Action
              icon={item.status === "archived" ? ArchiveRestore : Archive}
              label={item.status === "archived" ? "Restore" : "Archive"}
              on={item.status === "archived"}
              onClick={() => toggle({ status: item.status === "archived" ? "active" : "archived" }, item.status === "archived" ? "Restored" : "Archived — the stylist won't use it")}
            />
            <Action icon={Pencil} label="Edit" onClick={() => setEditing(true)} />
          </div>

          <Button variant="accent" size="lg" className="w-full" onClick={() => router.push(`/stylist?q=${encodeURIComponent(`Style my ${item.name.toLowerCase()} (id ${item.id}) for today`)}`)}>
            <Sparkles className="size-4" /> Style this piece
          </Button>
          {item.image_url && <ShareButton title={`Style my ${item.name}`} text={`Style my ${item.name} with Outfits.`} url={`/stylist?q=${encodeURIComponent(`Style my ${item.name.toLowerCase()} (id ${item.id}) for today`)}`} files={[{ url: item.image_url, name: `${item.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "piece"}.jpg`, type: "image/jpeg" }]} label="Share this piece" />}

          <dl className="divide-y divide-border rounded-3xl bg-surface px-4">
            <Row k="Type" v={`${titleCase(item.category)} · ${titleCase(item.subcategory)}`} />
            <Row
              k="Colors"
              v={
                <span className="flex items-center gap-1.5">
                  {item.colors.map((c) => (
                    <span key={c} className="size-4 rounded-full border border-border-strong" style={{ background: COLORS[c] }} title={c} />
                  ))}
                  <span className="ml-1">{item.colors.map(titleCase).join(", ")}</span>
                </span>
              }
            />
            <Row k="Seasons" v={item.seasons.map(titleCase).join(", ") || "—"} />
            <Row k="Occasions" v={item.occasions.map(titleCase).join(", ") || "—"} />
            <Row k="Formality" v={FORMALITY_LABELS[item.formality]} />
            <Row k="Warmth" v={WARMTH_LABELS[item.warmth]} />
            {item.material && <Row k="Material" v={titleCase(item.material)} />}
            {item.brand && <Row k="Brand" v={item.brand} />}
            <Row k="Worn" v={`${item.wear_count}×`} />
          </dl>
          {item.description && <p className="text-sm text-muted">{item.description}</p>}

          <Button
            variant="danger"
            className="w-full"
            onClick={removeItem}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function Action({ icon: Icon, label, on, onClick }: { icon: typeof Heart; label: string; on?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center gap-1.5 rounded-2xl py-3 text-[11.5px] font-medium transition-colors", on ? "bg-primary text-primary-fg" : "bg-surface text-text")}>
      <Icon className={cn("size-5", on && label === "Favorite" && "fill-heart text-heart")} />
      {label}
    </button>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
