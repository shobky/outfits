"use client";
import { Camera, Check, ImagePlus, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { Analysis } from "@/app/api/items/analyze/route";
import { processGarment, toAnalysisDataUrl, type Stage } from "@/lib/image/process";
import type { ItemInput } from "@/lib/types";
import { cn } from "@/lib/utils";
import { emptyDraft, ItemForm, type Draft } from "./item-form";

interface Entry {
  id: string;
  file: File;
  preview: string;
  stage: Stage | "analyzing" | "ready" | "saving" | "saved" | "error";
  pct?: number;
  cutout?: Blob;
  cutoutUrl?: string;
  original?: Blob;
  back?: Blob;
  backUrl?: string;
  backBusy?: boolean;
  draft: Draft;
  description: string | null;
}

async function upload(blob: Blob) {
  const fd = new FormData();
  fd.append("file", blob);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  if (!r.ok) throw new Error("Upload failed");
  return ((await r.json()) as { url: string }).url;
}

const STAGE_LABEL: Record<string, string> = {
  preparing: "Preparing photo…",
  removing: "Removing background…",
  framing: "Framing & cleaning edges…",
  analyzing: "Recognising the piece…",
  saving: "Saving to your drawer…",
};

export function AddView() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const router = useRouter();

  const update = useCallback((id: string, patch: Partial<Entry>) => setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e))), []);

  const run = useCallback(
    async (e: Entry) => {
      try {
        const { cutout, original } = await processGarment(e.file, (stage, pct) => update(e.id, { stage, pct }));
        update(e.id, { cutout, original, cutoutUrl: URL.createObjectURL(cutout), stage: "analyzing" });
        const r = await fetch("/api/items/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image: await toAnalysisDataUrl(cutout) }),
        });
        const { analysis } = (await r.json()) as { analysis: Analysis | null };
        if (analysis) {
          const { description, ...rest } = analysis;
          update(e.id, { draft: { ...emptyDraft, ...rest, colors: rest.colors as Draft["colors"] }, description, stage: "ready" });
        } else {
          update(e.id, { stage: "ready" });
        }
      } catch (err) {
        console.error(err);
        update(e.id, { stage: "error" });
      }
    },
    [update],
  );

  const backRef = useRef<HTMLInputElement>(null);
  const addBack = async (id: string, file: File) => {
    update(id, { backBusy: true });
    try {
      const { cutout } = await processGarment(file, () => {});
      update(id, { back: cutout, backUrl: URL.createObjectURL(cutout), backBusy: false });
    } catch {
      update(id, { backBusy: false });
      toast.error("Couldn't process the back photo");
    }
  };

  const addFiles = (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    const fresh = list.map<Entry>((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), stage: "preparing", draft: emptyDraft, description: null }));
    setEntries((es) => [...es, ...fresh]);
    if (!activeId && fresh[0]) setActiveId(fresh[0].id);
    // process sequentially — the segmentation model is heavy
    fresh.reduce((p, e) => p.then(() => run(e)), Promise.resolve());
  };

  const save = async (e: Entry) => {
    if (!e.cutout) return;
    if (!e.draft.name.trim()) return toast.error("Give it a name first");
    update(e.id, { stage: "saving" });
    try {
      const [image_url, original_image_url, back_url] = await Promise.all([
        upload(e.cutout),
        e.original ? upload(e.original) : Promise.resolve(null),
        e.back ? upload(e.back) : Promise.resolve(null),
      ]);
      const body: ItemInput = {
        ...e.draft,
        image_url,
        original_image_url,
        images: back_url ? [{ url: back_url, view: "back" }] : [],
        description: e.description,
        status: "active",
        in_laundry: false,
        is_favorite: false,
      };
      await fetch("/api/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      update(e.id, { stage: "saved" });
      mutate((k) => typeof k === "string" && k.startsWith("/api/items"));
      toast.success(`${e.draft.name} added`);
      const next = entries.find((x) => x.id !== e.id && x.stage !== "saved");
      setActiveId(next?.id ?? null);
    } catch {
      update(e.id, { stage: "error" });
      toast.error("Couldn't save — try again");
    }
  };

  const active = entries.find((e) => e.id === activeId);
  const busy = active && STAGE_LABEL[active.stage];

  return (
    <div className="pb-32 lg:pb-12">
      <PageHeader title="Add pieces" right={entries.some((e) => e.stage === "saved") ? <Button size="sm" variant="surface" onClick={() => router.push("/")}>Done</Button> : null} />
      <div className="mx-auto max-w-5xl space-y-5 px-4 md:px-8">
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
        <input
          ref={backRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && activeId) addBack(activeId, f);
            e.target.value = "";
          }}
        />
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />

        {!entries.length || !active ? (
          <div
            onDragOver={(e) => (e.preventDefault(), setDrag(true))}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => (e.preventDefault(), setDrag(false), addFiles(e.dataTransfer.files))}
            className={cn(
              "flex flex-col items-center gap-4 rounded-[32px] border-2 border-dashed border-border-strong px-6 py-14 text-center transition-colors",
              drag && "border-accent bg-accent/5",
            )}
          >
            <div className="grid size-16 place-items-center rounded-2xl bg-surface-2">
              <ImagePlus className="size-7 text-muted" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-semibold tracking-tight">Drop photos here</h2>
              <p className="mx-auto max-w-xs text-sm text-muted">Lay a piece flat or hang it on a plain wall, good light. We remove the background, frame it and fill in the details.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="lg" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="size-4" /> Choose photos
              </Button>
              <Button size="lg" variant="surface" onClick={() => camRef.current?.click()}>
                <Camera className="size-4" /> Take photo
              </Button>
            </div>
            <p className="text-xs text-faint">First run downloads the cut-out model (~40MB), then it&apos;s cached.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="space-y-3 md:sticky md:top-20 md:self-start">
              <div className="relative grid aspect-square place-items-center overflow-hidden rounded-[32px] bg-tile p-[10%]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={active.cutoutUrl ?? active.preview} alt="" className={cn("h-full w-full object-contain transition-all duration-700", active.cutoutUrl ? "garment" : "scale-95 opacity-40 blur-[1px]")} />
                {busy && (
                  <div className="glass absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium">
                    <Loader2 className="size-4 animate-spin" />
                    <span className="shimmer-text">{STAGE_LABEL[active.stage]}</span>
                    {active.stage === "removing" && active.pct ? <span className="text-faint">{active.pct}%</span> : null}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-surface p-2 pr-3">
                <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-tile p-1">
                  {active.backUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={active.backUrl} alt="Back" className="garment h-full w-full object-contain" />
                  ) : active.backBusy ? (
                    <Loader2 className="size-4 animate-spin text-muted" />
                  ) : (
                    <span className="text-[10px] font-semibold uppercase text-faint">Back</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{active.backUrl ? "Back view added" : "Add a back photo"}</p>
                  <p className="text-[12px] text-muted">Optional — shows both sides in your drawer</p>
                </div>
                <Button size="sm" variant="surface" disabled={active.backBusy} onClick={() => backRef.current?.click()}>
                  {active.backUrl ? "Replace" : "Add"}
                </Button>
              </div>
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                {entries.map((e) => (
                  <button key={e.id} onClick={() => setActiveId(e.id)} className={cn("relative size-16 shrink-0 overflow-hidden rounded-2xl bg-tile p-1.5", e.id === activeId && "ring-2 ring-text")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={e.cutoutUrl ?? e.preview} alt="" className="h-full w-full object-contain" />
                    {e.stage === "saved" && (
                      <span className="absolute inset-0 grid place-items-center bg-black/40">
                        <Check className="size-5 text-white" />
                      </span>
                    )}
                  </button>
                ))}
                <button onClick={() => fileRef.current?.click()} className="grid size-16 shrink-0 place-items-center rounded-2xl border-2 border-dashed border-border-strong text-muted" aria-label="Add more">
                  <ImagePlus className="size-5" />
                </button>
              </div>
            </div>

            <div className="space-y-5">
              {active.stage === "error" && <p className="rounded-2xl bg-danger/10 p-4 text-sm text-danger">Something went wrong processing this photo. You can still fill the details and save, or remove it.</p>}
              {active.description && (
                <p className="flex gap-2 rounded-2xl bg-surface p-4 text-sm text-muted">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" /> {active.description}
                </p>
              )}
              <ItemForm value={active.draft} onChange={(d) => update(active.id, { draft: d })} />
              <div className="flex gap-2 pb-4">
                <Button variant="surface" size="lg" onClick={() => (setEntries((es) => es.filter((x) => x.id !== active.id)), setActiveId(entries.find((x) => x.id !== active.id)?.id ?? null))}>
                  <Trash2 className="size-4" />
                </Button>
                <Button size="lg" className="flex-1" disabled={!active.cutout || active.stage === "saving" || active.stage === "saved"} onClick={() => save(active)}>
                  {active.stage === "saved" ? "Saved" : active.stage === "saving" ? "Saving…" : "Add to drawer"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
