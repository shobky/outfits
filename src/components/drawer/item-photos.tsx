"use client";
import { ImageOff, Loader2, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { preparePhoto, processGarment } from "@/lib/image/process";
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
    ...extras.map((e, n) => ({ key: e.url, label: `Photo ${n + 1}`, view: "detail" as const, url: e.url })),
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
    setBusy("Preparing photo…");
    try {
      const body: SetPhoto = { view, replaces, url: "" };
      if (view === "detail") {
        body.url = await uploadImage(await preparePhoto(file));
      } else {
        const { cutout, original, cutoutProblem } = await processGarment(file, (stage) => setBusy(stage === "removing" ? "Removing background…" : "Preparing photo…"));
        if (cutoutProblem) toast.warning(cutoutProblem);
        setBusy("Uploading…");
        body.url = await uploadImage(cutout);
        if (view === "front") body.original_url = await uploadImage(original);
      }
      await api(`/api/items/${item.id}/images`, "POST", body);
      await refresh();
      setBroken(null);
      setSelected(view === "front" ? "front" : view === "back" ? "back" : body.url);
      toast.success("Photo saved");
    } catch (e) {
      console.error(e);
      toast.error(`Couldn't save that photo: ${reason(e)}`);
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

      <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto p-1">
        {slides.map((s) => (
          <button
            key={s.key}
            onClick={() => setSelected(s.key)}
            aria-label={`Show ${s.label} photo`}
            aria-pressed={s.key === slide.key}
            className={cn("relative size-14 shrink-0 overflow-hidden rounded-xl bg-tile p-1", s.key === slide.key && "ring-2 ring-text")}
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
