"use client";
import { Camera, Check, ImagePlus, Info, Loader2, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { Analysis } from "@/app/api/items/analyze/route";
import { isImageFile, PhotoReadError, processGarment, toAnalysisDataUrl, type Stage } from "@/lib/image/process";
import { uploadImage } from "@/lib/image/upload";
import type { ItemInput } from "@/lib/types";
import { api, cn } from "@/lib/utils";
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
  /** Blocking problem with this photo, shown with a retry. */
  error?: string;
  /** Something fell back (cut-out, auto-fill). Saving still works. */
  notice?: string;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Applies AI values only to the fields the user hasn't already changed. */
function mergeAnalysis(current: Draft, analysis: Partial<Draft>): Draft {
  const out: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(analysis)) {
    if (out[k] === emptyDraft[k as keyof Draft]) out[k] = v;
  }
  return out as unknown as Draft;
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
  /** Background work may finish after the user saved, so it never moves a saved piece back a stage. */
  const progress = useCallback(
    (id: string, patch: Partial<Entry>) =>
      setEntries((es) =>
        es.map((e) => {
          if (e.id !== id) return e;
          const done = e.stage === "saving" || e.stage === "saved";
          return { ...e, ...patch, stage: done ? e.stage : (patch.stage ?? e.stage) };
        }),
      ),
    [],
  );

  const analyze = useCallback(
    async (id: string, cutout: Blob) => {
      try {
        const r = await fetch("/api/items/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image: await toAnalysisDataUrl(cutout) }),
        });
        const body = (await r.json().catch(() => ({}))) as { analysis?: Analysis | null; reason?: string; error?: string };
        const analysis = r.ok ? body.analysis : null;
        if (!analysis) throw new Error(body.reason ?? body.error ?? `Request failed (${r.status})`);
        const { description, ...rest } = analysis;
        setEntries((es) => es.map((e) => (e.id === id ? { ...e, draft: mergeAnalysis(e.draft, rest as Partial<Draft>), description } : e)));
      } catch (err) {
        console.warn("Auto-fill failed", err);
        setEntries((es) => es.map((e) => (e.id === id ? { ...e, notice: [e.notice, `Details weren't filled in automatically: ${message(err)}`].filter(Boolean).join(" ") } : e)));
      }
      progress(id, { stage: "ready" });
    },
    [progress],
  );

  const run = useCallback(
    async (e: Entry) => {
      progress(e.id, { error: undefined, notice: undefined });
      try {
        const { cutout, original, cutoutProblem } = await processGarment(
          e.file,
          (stage, pct) => progress(e.id, { stage, pct }),
          (blob) => progress(e.id, { original: blob, preview: URL.createObjectURL(blob) }),
        );
        progress(e.id, { cutout, original, cutoutUrl: URL.createObjectURL(cutout), stage: "analyzing", notice: cutoutProblem ?? undefined });
        if (cutoutProblem) toast.warning(cutoutProblem);
        await analyze(e.id, cutout);
      } catch (err) {
        console.error(err);
        const text = err instanceof PhotoReadError ? err.message : `Something went wrong processing this photo: ${message(err)}`;
        progress(e.id, { stage: "error", error: text });
        toast.error(text);
      }
    },
    [analyze, progress],
  );

  const backRef = useRef<HTMLInputElement>(null);
  const addBack = async (id: string, file: File) => {
    update(id, { backBusy: true });
    try {
      const { cutout } = await processGarment(file, () => {});
      update(id, { back: cutout, backUrl: URL.createObjectURL(cutout), backBusy: false });
    } catch (err) {
      update(id, { backBusy: false });
      toast.error(err instanceof PhotoReadError ? err.message : `Couldn't process the back photo: ${message(err)}`);
    }
  };

  const addFiles = (files: FileList | File[]) => {
    const all = [...files];
    const list = all.filter(isImageFile);
    const skipped = all.filter((f) => !isImageFile(f));
    if (skipped.length) toast.error(`Not a photo, so it was skipped: ${skipped.map((f) => f.name).join(", ")}`);
    const fresh = list.map<Entry>((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), stage: "preparing", draft: emptyDraft, description: null }));
    setEntries((es) => [...es, ...fresh]);
    if (!activeId && fresh[0]) setActiveId(fresh[0].id);
    // process sequentially — the segmentation model is heavy
    fresh.reduce((p, e) => p.then(() => run(e)), Promise.resolve());
  };

  const save = async (e: Entry) => {
    if (!e.draft.name.trim()) return toast.error("Give it a name first");
    update(e.id, { stage: "saving", error: undefined });
    // A failed photo upload never loses the piece: it's saved without that image and can be re-uploaded.
    const failures: string[] = [];
    const tryUpload = async (blob: Blob | undefined) => {
      if (!blob) return null;
      try {
        return await uploadImage(blob);
      } catch (err) {
        failures.push(message(err));
        return null;
      }
    };
    const [front, original_image_url, back_url] = await Promise.all([tryUpload(e.cutout ?? e.original), e.cutout ? tryUpload(e.original) : Promise.resolve(null), tryUpload(e.back)]);
    const body: ItemInput = {
      ...e.draft,
      image_url: front ?? original_image_url,
      original_image_url,
      images: back_url ? [{ url: back_url, view: "back" }] : [],
      description: e.description,
      status: "active",
      in_laundry: false,
      is_favorite: false,
    };
    try {
      await api("/api/items", "POST", body);
    } catch (err) {
      const text = `Couldn't save "${e.draft.name}": ${message(err)}`;
      update(e.id, { stage: "ready", error: text });
      toast.error(text);
      return;
    }
    update(e.id, { stage: "saved" });
    mutate((k) => typeof k === "string" && k.startsWith("/api/items"));
    if (failures.length) toast.warning(`${e.draft.name} saved, but a photo didn't upload: ${failures[0]}. Open the piece to re-upload it.`);
    else if (!body.image_url) toast.success(`${e.draft.name} added without a photo. Open the piece to add one.`);
    else toast.success(`${e.draft.name} added`);
    const next = entries.find((x) => x.id !== e.id && x.stage !== "saved");
    setActiveId(next?.id ?? null);
  };

  const active = entries.find((e) => e.id === activeId);
  const busy = active && STAGE_LABEL[active.stage];

  return (
    <div className="pb-32 lg:pb-12">
      <PageHeader title="Add pieces" right={entries.some((e) => e.stage === "saved") ? <Button size="sm" variant="surface" onClick={() => router.push("/")}>Done</Button> : null} />
      <div className="mx-auto max-w-5xl space-y-5 px-4 md:px-8">
        <input ref={fileRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => {
            const picked = [...(e.target.files ?? [])];
            e.target.value = ""; // lets the same file be picked again after a failure
            addFiles(picked);
          }} />
        <input
          ref={backRef}
          type="file"
          accept="image/*,.heic,.heif"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && activeId) addBack(activeId, f);
            e.target.value = "";
          }}
        />
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => {
            const picked = [...(e.target.files ?? [])];
            e.target.value = ""; // lets the same file be picked again after a failure
            addFiles(picked);
          }} />

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
            <p className="text-xs text-faint">First run downloads the cut-out model (~40MB) and can take a couple of minutes. You can save before it finishes.</p>
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
              {active.error && (
                <div role="alert" className="space-y-3 rounded-2xl bg-danger/10 p-4 text-sm text-danger">
                  <p>{active.error}</p>
                  {active.stage === "error" && (
                    <Button size="sm" variant="surface" onClick={() => run(active)}>
                      <RotateCcw className="size-3.5" /> Try again
                    </Button>
                  )}
                </div>
              )}
              {active.notice && (
                <p className="flex gap-2 rounded-2xl bg-surface p-4 text-sm text-muted">
                  <Info className="mt-0.5 size-4 shrink-0" /> {active.notice}
                </p>
              )}
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
                <Button size="lg" className="flex-1" disabled={active.stage === "preparing" || active.stage === "saving" || active.stage === "saved"} onClick={() => save(active)}>
                  {active.stage === "saved" ? "Saved" : active.stage === "saving" ? "Saving…" : active.cutout || active.original ? "Add to drawer" : "Save without photo"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
