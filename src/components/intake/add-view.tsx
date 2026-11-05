"use client";
import { AlertCircle, Camera, Check, ChevronLeft, ChevronRight, ImageOff, ImagePlus, Loader2, RotateCcw, Scissors, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { ItemForm, type Draft } from "@/components/drawer/item-form";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import { PhotoAllowanceNote, useUsage } from "@/components/usage/usage";
import { isStuck } from "@/lib/hooks";
import type { IntakeBatch, IntakeGroup } from "@/lib/types";
import { api, cn } from "@/lib/utils";
import { WornPicker } from "./worn-picker";
import { isWorking, MAX_PHOTOS, useIntakeQueue, type PendingUpload } from "./intake-provider";

const coverOf = (g: IntakeGroup) => {
  const front = g.views.find((v) => v.view === "front") ?? g.views[0];
  return front?.result_url ?? front?.photo_url ?? null;
};
const needsOwner = (g: IntakeGroup) => g.status === "review" || g.status === "failed" || (g.status === "processing" && isStuck(g));
const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function act(g: IntakeGroup, action: string, draft?: Draft) {
  await api(`/api/intake/groups/${g.id}`, "POST", { action, draft });
  await mutate("/api/intake");
  mutate((k) => typeof k === "string" && k.startsWith("/api/items"));
}

export function AddView() {
  const { uploads, data, addFiles, retryUpload, discardUpload, refresh } = useIntakeQueue();
  const { data: usage } = useUsage();
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const groups = data?.groups ?? [];
  const batches = data?.batches ?? [];
  const waiting = groups.filter(needsOwner);
  const working = groups.filter(isWorking);
  const added = groups.filter((g) => g.status === "added");
  const ordered = [...waiting, ...working, ...added];
  const analyzing = batches.filter((b) => b.status === "analyzing" && !isStuck(b));
  const brokenBatches = batches.filter((b) => b.status === "failed" || (b.status === "analyzing" && isStuck(b)));
  const rejected = batches.flatMap((b) => b.rejected.map((r) => ({ ...r, batch: b.id })));

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = [...(e.target.files ?? [])];
    e.target.value = ""; // lets the same file be picked again after a failure
    addFiles(picked);
  };

  return (
    <div className="pb-nav lg:pb-12">
      <PageHeader title="Add pieces" />
      <div className="mx-auto max-w-5xl space-y-5 px-4 md:px-8">
        <input ref={fileRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={pick} />
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />

        <div
          onDragOver={(e) => (e.preventDefault(), setDrag(true))}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => (e.preventDefault(), setDrag(false), addFiles([...e.dataTransfer.files]))}
          className={cn("flex flex-col items-center gap-3 rounded-[32px] border-2 border-dashed border-border-strong px-6 text-center transition-colors", ordered.length || uploads.length ? "py-6" : "py-14", drag && "border-accent bg-accent/5")}
        >
          {!ordered.length && !uploads.length && (
            <div className="space-y-1.5">
              <h2 className="text-xl font-semibold tracking-tight">Snap it, we do the rest</h2>
              <p className="mx-auto max-w-sm text-sm text-muted">Add up to {MAX_PHOTOS} photos at once, in any order and from any angle. We work out which photos are the same piece, turn each into a clean studio shot, and fill in the details.</p>
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="lg" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="size-4" /> Choose photos
            </Button>
            <Button size="lg" variant="surface" onClick={() => camRef.current?.click()}>
              <Camera className="size-4" /> Take photo
            </Button>
            {usage?.features.includes("worn_extract") && <WornPicker onPick={(file) => addFiles([file], "worn")} />}
          </div>
          <p className="text-xs text-faint">You can leave this screen. It carries on in the background.</p>
          <PhotoAllowanceNote />
        </div>

        {uploads.map((u) => (
          <UploadCard key={u.id} upload={u} onRetry={() => retryUpload(u.id)} onDiscard={() => discardUpload(u.id)} />
        ))}

        {analyzing.map((b) => (
          <div key={b.id} className="flex items-center gap-3 rounded-[26px] bg-surface p-4">
            <div className="flex -space-x-3">
              {b.photos.slice(0, 4).map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p} src={p} alt="" className="size-11 rounded-xl border-2 border-surface object-cover" />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="shimmer-text text-[14px] font-medium">Looking at your {b.photos.length === 1 ? "photo" : `${b.photos.length} photos`}…</p>
              <p className="text-[12.5px] text-muted">Working out what&apos;s what, and which photos go together</p>
            </div>
            <Loader2 className="size-4 shrink-0 animate-spin text-muted" />
          </div>
        ))}

        {brokenBatches.map((b) => (
          <BrokenBatch key={b.id} batch={b} onDone={refresh} />
        ))}

        {batches.some((b) => b.matched?.length) && (
          <div className="space-y-1 rounded-[22px] bg-surface p-4 text-[13px] text-muted">
            {batches.flatMap((b) => (b.matched ?? []).map((m) => (
              <p key={`${b.id}-${m.item_id}`} className="flex items-center gap-2">
                <Check className="size-3.5 shrink-0" /> Already in your drawer: {m.name}
              </p>
            )))}
          </div>
        )}

        {rejected.length > 0 && (
          <div className="space-y-1 rounded-[22px] bg-surface p-4 text-[13px] text-muted">
            {rejected.slice(0, 4).map((r) => (
              <p key={r.url} className="flex items-center gap-2">
                <ImageOff className="size-3.5 shrink-0" /> A photo was skipped: {r.reason}
              </p>
            ))}
          </div>
        )}

        {ordered.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold tracking-tight">
                {waiting.length ? `${waiting.length} to check` : working.length ? "Working on it" : "All done"}
              </h2>
              {added.length > 0 && !working.length && (
                <Button size="sm" variant="ghost" className="text-muted" onClick={() => Promise.all(added.map((g) => act(g, "clear"))).catch((e) => toast.error(reason(e)))}>
                  Clear finished
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {ordered.map((g) => (
                <PieceCard key={g.id} group={g} onOpen={() => setOpenId(g.id)} />
              ))}
            </div>
          </section>
        )}
      </div>

      <ReviewSheet key={openId ?? "closed"} groups={ordered} openId={openId} onOpen={setOpenId} />
    </div>
  );
}

function UploadCard({ upload, onRetry, onDiscard }: { upload: PendingUpload; onRetry: () => void; onDiscard: () => void }) {
  const total = upload.photos.length;
  const done = upload.photos.filter((p) => p.url).length;
  const failed = upload.photos.filter((p) => p.status === "failed");
  return (
    <div className="space-y-3 rounded-[26px] bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] font-medium">{upload.error ?? `Uploading ${done} of ${total}`}</p>
        {upload.sending ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted" />
        ) : (
          <div className="flex shrink-0 gap-1.5">
            <Button size="sm" onClick={onRetry}>
              <RotateCcw className="size-3.5" /> Try again
            </Button>
            <Button size="sm" variant="surface" onClick={onDiscard}>
              Discard
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {upload.photos.map((p) => (
          <div key={p.id} className="relative size-14 overflow-hidden rounded-xl bg-tile">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt="" className={cn("size-full object-cover", !p.url && "opacity-50")} />
            {p.url && (
              <span className="absolute inset-0 grid place-items-center bg-black/30">
                <Check className="size-4 text-white" />
              </span>
            )}
          </div>
        ))}
      </div>
      {failed.map((p) => (
        <p key={p.id} role="alert" className="text-[12.5px] text-danger">
          {p.error}
        </p>
      ))}
    </div>
  );
}

function BrokenBatch({ batch, onDone }: { batch: IntakeBatch; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div role="alert" className="flex items-center gap-3 rounded-[26px] bg-danger/10 p-4">
      <AlertCircle className="size-5 shrink-0 text-danger" />
      <p className="min-w-0 flex-1 text-[13px] text-danger">{batch.error ?? "Reading these photos took too long."}</p>
      <Button
        size="sm"
        variant="surface"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api("/api/intake", "POST", { photos: batch.photos });
            await api(`/api/intake/batches/${batch.id}`, "DELETE");
            onDone();
          } catch (e) {
            toast.error(reason(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <RotateCcw className="size-3.5" /> Try again
      </Button>
    </div>
  );
}

function PieceCard({ group: g, onOpen }: { group: IntakeGroup; onOpen: () => void }) {
  const cover = coverOf(g);
  const working = isWorking(g);
  const check = needsOwner(g);
  const styled = g.views.some((v) => v.result_url);
  return (
    <button onClick={onOpen} className="group relative block aspect-[4/5] w-full overflow-hidden rounded-[26px] border-[5px] border-surface bg-tile text-left shadow-soft">
      <span className="absolute inset-0 flex items-center justify-center p-[12%]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={g.draft.name} className={cn("size-full object-contain transition-opacity", styled ? "garment" : "rounded-lg opacity-60")} />
        ) : (
          <ImageOff className="size-6 text-faint" />
        )}
      </span>
      <span className="absolute left-2 top-2">
        {working ? (
          <span className="glass flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium">
            <Loader2 className="size-3 animate-spin" /> Styling
          </span>
        ) : check ? (
          <span className="flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-fg">
            <AlertCircle className="size-3" /> {g.error || isStuck(g) ? "Needs retry" : "Check this"}
          </span>
        ) : (
          <span className="glass flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium">
            <Check className="size-3" /> Added
          </span>
        )}
      </span>
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-tile via-tile/80 to-transparent px-3 pb-2.5 pt-6">
        <span className="block truncate text-[12.5px] font-medium">{g.draft.name || "Unnamed piece"}</span>
        {working && g.step && <span className="block truncate text-[11px] text-muted">{g.step}</span>}
        {g.views.length > 1 && !working && <span className="block text-[11px] text-muted">{g.views.length} photos</span>}
      </span>
    </button>
  );
}

function ReviewSheet({ groups, openId, onOpen }: { groups: IntakeGroup[]; openId: string | null; onOpen: (id: string | null) => void }) {
  const at = groups.findIndex((g) => g.id === openId);
  const g = at >= 0 ? groups[at] : null;
  return (
    <Sheet open={!!g} onOpenChange={(o) => !o && onOpen(null)} title={groups.length > 1 && g ? `Piece ${at + 1} of ${groups.length}` : "Your piece"}>
      {g && (
        <div className="space-y-4 pb-6">
          {groups.length > 1 && (
            <div className="flex gap-2">
              <Button size="sm" variant="surface" className="flex-1" disabled={at === 0} onClick={() => onOpen(groups[at - 1].id)}>
                <ChevronLeft className="size-4" /> Previous
              </Button>
              <Button size="sm" variant="surface" className="flex-1" disabled={at === groups.length - 1} onClick={() => onOpen(groups[at + 1].id)}>
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
          <ReviewPiece key={g.id} group={g} onClose={() => onOpen(null)} onNext={() => onOpen(groups[at + 1]?.id ?? null)} />
        </div>
      )}
    </Sheet>
  );
}

function ReviewPiece({ group: g, onClose, onNext }: { group: IntakeGroup; onClose: () => void; onNext: () => void }) {
  const [draft, setDraft] = useState<Draft>(g.draft as Draft);
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(!g.draft.name);
  const [viewAt, setViewAt] = useState(0);
  const view = g.views[viewAt] ?? g.views[0];
  const shown = view?.result_url ?? view?.photo_url ?? null;
  const working = isWorking(g);
  const stuck = g.status === "processing" && isStuck(g);

  const run = async (action: string, then?: () => void) => {
    setBusy(true);
    try {
      await act(g, action, draft);
      then?.();
    } catch (e) {
      toast.error(reason(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative grid aspect-square place-items-center rounded-[28px] bg-tile p-[12%]">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt={draft.name} className={cn("size-full object-contain", view?.result_url && "garment")} />
        ) : (
          <ImageOff className="size-8 text-faint" />
        )}
        {working && (
          <div className="glass absolute bottom-3 left-1/2 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] font-medium">
            <Loader2 className="size-3.5 shrink-0 animate-spin" /> <span className="truncate">{g.step ?? "Working on it"}</span>
          </div>
        )}
      </div>

      {g.views.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {g.views.map((v, n) => (
            <button key={v.photo_url} onClick={() => setViewAt(n)} aria-label={`Show ${v.view} photo`} aria-pressed={n === viewAt} className={cn("size-14 shrink-0 overflow-hidden rounded-xl bg-tile p-1", n === viewAt && "ring-2 ring-inset ring-text")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.result_url ?? v.photo_url} alt="" className="size-full object-contain" />
            </button>
          ))}
        </div>
      )}

      {(g.error || stuck) && (
        <div role="alert" className="flex items-center gap-3 rounded-2xl bg-danger/10 p-3 text-[13px] text-danger">
          <p className="min-w-0 flex-1">{g.error ?? "This took too long."}</p>
          <Button size="sm" variant="surface" disabled={busy} onClick={() => run("retry")}>
            <RotateCcw className="size-3.5" /> Retry
          </Button>
        </div>
      )}
      {g.worn && (
        <p className="flex gap-2 rounded-2xl bg-surface p-3 text-[13px] text-muted">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" /> Rebuilt by AI from your photo, so details may differ from the real piece. Check it before adding.
        </p>
      )}
      {g.question && (
        <p className="flex gap-2 rounded-2xl bg-surface p-3 text-[13.5px]">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" /> {g.question}
        </p>
      )}
      {g.note && <p className="rounded-2xl bg-surface p-3 text-[13px] text-muted">{g.note}</p>}
      {g.description && <p className="text-[13px] text-muted">{g.description}</p>}

      {g.views.length > 1 && g.status !== "added" && (
        <Button size="sm" variant="ghost" className="text-muted" disabled={busy || working} onClick={() => run("split")}>
          <Scissors className="size-3.5" /> These aren&apos;t the same piece
        </Button>
      )}

      {details ? (
        <ItemForm value={draft} onChange={setDraft} />
      ) : (
        <button onClick={() => setDetails(true)} className="w-full rounded-2xl bg-surface p-3 text-left text-[13.5px]">
          <span className="block font-medium">{draft.name}</span>
          <span className="block text-[12.5px] text-muted">{[draft.subcategory, draft.colors.join(", "), draft.material].filter(Boolean).join(" · ")}. Tap to edit.</span>
        </button>
      )}

      {g.status === "added" ? (
        <div className="flex gap-2">
          <Button variant="surface" size="lg" className="flex-1" disabled={busy} onClick={() => run("approve", onClose)}>
            Save changes
          </Button>
          <Link href="/" className="inline-flex h-13 flex-1 items-center justify-center rounded-full bg-primary text-[15px] font-medium text-primary-fg">
            See in drawer
          </Link>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="surface" size="lg" aria-label="Discard this piece" disabled={busy} onClick={() => run("dismiss", onClose)}>
            <Trash2 className="size-4" />
          </Button>
          <Button size="lg" className="flex-1" disabled={busy || working} onClick={() => run("approve", onNext)}>
            {busy ? "Saving…" : "Add to drawer"}
          </Button>
        </div>
      )}
    </div>
  );
}
