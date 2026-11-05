"use client";
import { FlipHorizontal2, ImageOff, Loader2, Plus, RefreshCw, RotateCcw, RotateCw, Trash2, Undo2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { preparePhoto } from "@/lib/image/process";
import { uploadImage } from "@/lib/image/upload";
import type { SetPhoto } from "@/lib/item-images";
import type { Item } from "@/lib/types";
import { api, cn } from "@/lib/utils";
import { GarmentImage } from "./item-card";

interface Slide {
  key: string;
  label: string;
  view: SetPhoto["view"];
  url: string | null;
}

function slidesOf(item: Item): Slide[] {
  const back = item.images.find((i) => i.view === "back");
  const extras = item.images.filter((i) => i.view !== "back");
  return [
    { key: "front", label: "Front", view: "front", url: item.image_url },
    ...(back ? [{ key: "back", label: "Back", view: "back" as const, url: back.url }] : []),
    ...extras.map((e, n) => ({ key: e.url, label: e.view === "worn" ? "Worn photo" : `Photo ${n + 1}`, view: "detail" as const, url: e.url })),
  ];
}

const refresh = () => mutate((k) => typeof k === "string" && k.startsWith("/api/items"));
const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function ItemPhotos({ item, onDeleteItem }: { item: Item; onDeleteItem: () => void }) {
  const slides = slidesOf(item);
  const [selected, setSelected] = useState("front");
  const [broken, setBroken] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const pending = useRef<{ view: SetPhoto["view"]; replaces?: string | null }>({ view: "front" });
  const fileRef = useRef<HTMLInputElement>(null);

  const slide = slides.find((s) => s.key === selected) ?? slides[0];
  const missing = !slide.url || broken === slide.url;

  const choose = (view: SetPhoto["view"], replaces?: string | null) => {
    pending.current = { view, replaces };
    fileRef.current?.click();
  };

  const attach = async (file: File) => {
    const { view, replaces } = pending.current;
    setBusy("Uploading…");
    try {
      const url = await uploadImage(await preparePhoto(file));
      setBusy(view === "detail" ? "Saving…" : "Styling your photo…");
      const body: SetPhoto = { view, replaces, url };
      const saved = await api<Item & { warning?: string }>(`/api/items/${item.id}/images`, "POST", body);
      await refresh();
      setBroken(null);
      setSelected(view === "front" ? "front" : view === "back" ? "back" : (saved.images.find((i) => i.view === "detail" && !item.images.some((o) => o.url === i.url))?.url ?? "front"));
      if (saved.warning) toast.warning(saved.warning);
      else toast.success("Photo saved");
    } catch (e) {
      console.error(e);
      toast.error(`Couldn't save that photo: ${reason(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const transform = async (change: { rotate?: 90 | -90; flip?: boolean; useOriginal?: boolean }) => {
    if (!slide.url) return;
    setBusy("Updating…");
    try {
      const saved = await api<Item>(`/api/items/${item.id}/transform`, "POST", { url: slide.url, ...change });
      await refresh();
      setBroken(null);
      if (slide.view === "detail") setSelected(saved.images.filter((i) => i.view !== "back")[slides.filter((x) => x.view === "detail").indexOf(slide)]?.url ?? "front");
    } catch (e) {
      toast.error(`Couldn't update that photo: ${reason(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!slide.url) return;
    if (!confirm(`Delete the ${slide.label.toLowerCase()} photo? This can't be undone.`)) return;
    setBusy("Deleting…");
    try {
      await api(`/api/items/${item.id}/images`, "DELETE", { url: slide.url });
      await refresh();
      setSelected("front");
      toast("Photo deleted");
    } catch (e) {
      toast.error(`Couldn't delete that photo: ${reason(e)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif"
        hidden
        data-testid="item-photo-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) attach(f);
        }}
      />

      <div className="relative grid aspect-square place-items-center rounded-[28px] bg-tile p-[12%]">
        {missing ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <ImageOff className="size-8 text-faint" />
            <p className="text-sm text-muted">{slide.url ? "This photo can't be loaded" : `No ${slide.label.toLowerCase()} photo yet`}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" disabled={!!busy} onClick={() => choose(slide.view, slide.url)}>
                <Upload className="size-3.5" /> Re-upload
              </Button>
              {slide.view === "front" && (
                <Button size="sm" variant="danger" disabled={!!busy} onClick={onDeleteItem}>
                  <Trash2 className="size-3.5" /> Delete piece
                </Button>
              )}
            </div>
          </div>
        ) : (
          <GarmentImage key={slide.url} src={slide.url} alt={`${item.name}, ${slide.label}`} onBroken={() => setBroken(slide.url)} className="h-full w-full animate-in fade-in zoom-in-95" />
        )}
        {busy && (
          <div className="glass absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-medium">
            <Loader2 className="size-3.5 animate-spin" /> {busy}
          </div>
        )}
      </div>

      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
        {slides.map((s) => (
          <button
            key={s.key}
            onClick={() => setSelected(s.key)}
            aria-label={`Show ${s.label} photo`}
            aria-pressed={s.key === slide.key}
            className={cn("relative size-14 shrink-0 overflow-hidden rounded-xl bg-tile p-1", s.key === slide.key && "ring-2 ring-inset ring-text")}
          >
            <GarmentImage src={s.url} alt="" compact className="h-full w-full" />
          </button>
        ))}
        {!slides.some((s) => s.view === "back") && (
          <button disabled={!!busy} onClick={() => choose("back")} className="flex h-14 shrink-0 items-center gap-1.5 rounded-xl border-2 border-dashed border-border-strong px-3 text-[12.5px] font-medium text-muted">
            <Plus className="size-4" /> Back
          </button>
        )}
        <button disabled={!!busy} onClick={() => choose("detail")} className="flex h-14 shrink-0 items-center gap-1.5 rounded-xl border-2 border-dashed border-border-strong px-3 text-[12.5px] font-medium text-muted">
          <Plus className="size-4" /> Photo
        </button>
      </div>

      {item.reconstructed && slide.view === "front" && <p className="text-center text-[12.5px] text-muted">Rebuilt by AI from a worn photo, so details may differ.</p>}

      {!missing && (
        <div className="flex items-center justify-center gap-1">
          <IconAction label="Rotate left" disabled={!!busy} onClick={() => transform({ rotate: -90 })}>
            <RotateCcw className="size-4" />
          </IconAction>
          <IconAction label="Rotate right" disabled={!!busy} onClick={() => transform({ rotate: 90 })}>
            <RotateCw className="size-4" />
          </IconAction>
          <IconAction label="Mirror" disabled={!!busy} onClick={() => transform({ flip: true })}>
            <FlipHorizontal2 className="size-4" />
          </IconAction>
          {slide.view === "front" && item.original_image_url && (
            <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => transform({ useOriginal: true })}>
              <Undo2 className="size-3.5" /> Use my photo
            </Button>
          )}
        </div>
      )}

      {!missing && (
        <div className="flex gap-2">
          <Button size="sm" variant="surface" className="flex-1" disabled={!!busy} onClick={() => choose(slide.view, slide.url)}>
            <RefreshCw className="size-3.5" /> Replace {slide.label.toLowerCase()}
          </Button>
          <Button size="sm" variant="surface" className="flex-1" disabled={!!busy} onClick={remove}>
            <Trash2 className="size-3.5" /> Delete {slide.label.toLowerCase()}
          </Button>
        </div>
      )}
      {missing && slide.url && slide.view !== "front" && (
        <Button size="sm" variant="surface" className="w-full" disabled={!!busy} onClick={remove}>
          <Trash2 className="size-3.5" /> Remove this photo
        </Button>
      )}
    </div>
  );
}

function IconAction({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-40">
      {children}
    </button>
  );
}
