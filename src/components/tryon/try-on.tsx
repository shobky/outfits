"use client";
/* eslint-disable @next/next/no-img-element -- Private reference images use authenticated same-origin requests. */

import {
  ArrowDownToLine,
  ChevronRight,
  ImagePlus,
  Info,
  Loader2,
  Shirt,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { refreshUsage, useUsage } from "@/components/usage/usage";
import { useItems, useProfile } from "@/lib/hooks";
import { preparePhoto } from "@/lib/image/process";
import type { Item, Profile } from "@/lib/types";
import { api, cn } from "@/lib/utils";

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function uploadPrivatePhoto(blob: Blob) {
  const form = new FormData();
  form.append("file", blob, "try-on-reference.jpg");
  const response = await fetch("/api/try-on/upload", { method: "POST", body: form });
  const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!response.ok || !body.url) throw new Error(body.error ?? `Upload failed (${response.status})`);
  return body.url;
}

type ExtendedProfile = Profile & {
  try_on_photos?: { url: string; kind: "full_body" | "face" | "side" }[];
};

function primaryProfilePhoto(profile?: Profile) {
  if (!profile) return null;
  const p = profile as ExtendedProfile;
  return p.try_on_photos?.find((photo) => photo.kind === "full_body")?.url ?? p.try_on_photo_url ?? null;
}

/** Shows only for people who have the try-on feature. */
export function TryOnButton({ itemIds, compact, product, disabled }: { itemIds: string[]; compact?: boolean; product?: { url: string; image_url: string }; disabled?: boolean }) {
  const { data } = useUsage();
  const [open, setOpen] = useState(false);
  if (!data?.features.includes("try_on")) return null;
  return (
    <>
      {compact ? (
        <button type="button" disabled={disabled} aria-label="Try it on" title="Try it on" onClick={() => setOpen(true)} className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70">
          <Wand2 className="size-4" aria-hidden="true" />
        </button>
      ) : (
        <Button size="sm" variant="surface" disabled={disabled} onClick={() => setOpen(true)}>
          <Wand2 className="size-3.5" aria-hidden="true" /> Try it on
        </Button>
      )}
      {open && <TryOnSheet itemIds={itemIds} product={product} onClose={() => setOpen(false)} />}
    </>
  );
}

function TryOnSheet({ itemIds, product, onClose }: { itemIds: string[]; product?: { url: string; image_url: string }; onClose: () => void }) {
  const { data, mutate: reloadProfile } = useProfile();
  const { data: itemData } = useItems();
  const [selectedIds, setSelectedIds] = useState(() => itemIds.slice(0, 4));
  const [activeItemId, setActiveItemId] = useState<string | null>(itemIds[0] ?? null);
  const [result, setResult] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const active = useRef(true);
  const resultRef = useRef<string | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (resultRef.current) void api("/api/try-on", "DELETE", { url: resultRef.current }).catch(() => {});
    };
  }, []);

  const photo = primaryProfilePhoto(data?.profile);
  const items = useMemo(() => {
    const byId = new Map((itemData?.items ?? []).map((item) => [item.id, item]));
    return selectedIds.map((id) => byId.get(id)).filter((item): item is Item => Boolean(item));
  }, [itemData?.items, selectedIds]);
  const activeItem = items.find((item) => item.id === activeItemId) ?? items[0] ?? null;

  const discard = (url: string | null) => {
    if (resultRef.current === url) resultRef.current = null;
    if (url) void api("/api/try-on", "DELETE", { url }).catch(() => {});
  };

  const choose = async (file: File) => {
    setBusy("Uploading your reference…");
    try {
      const url = await uploadPrivatePhoto(await preparePhoto(file));
      await api("/api/try-on/photo", "POST", { kind: "full_body", url });
      await reloadProfile();
      discard(result);
      setResult(null);
      await mutate("/api/profile");
      toast.success("Your try-on reference is ready");
    } catch (e) {
      toast.error(`Couldn't save that photo: ${reason(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    if (!selectedIds.length && !product) {
      toast("Choose at least one piece");
      return;
    }
    setBusy("Dressing you — this takes about a minute…");
    const previous = result;
    try {
      const { url } = await api<{ url: string }>("/api/try-on", "POST", product ? { product } : { item_ids: selectedIds });
      if (!active.current) {
        discard(url);
        return;
      }
      setResult(url);
      resultRef.current = url;
      setShowOriginal(false);
      discard(previous);
      refreshUsage();
    } catch (e) {
      toast.error(reason(e));
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = async () => {
    if (!confirm("Remove your try-on photo? You can add another any time.")) return;
    setBusy("Removing photo…");
    try {
      await api("/api/try-on/photo", "DELETE", { kind: "full_body" });
      await reloadProfile();
      discard(result);
      setResult(null);
    } catch (e) {
      toast.error(reason(e));
    } finally {
      setBusy(null);
    }
  };

  const close = () => {
    discard(result);
    onClose();
  };

  return (
    <Sheet open onOpenChange={(open) => !open && close()} title="Try it on">
      <div className="space-y-4 pb-6">
        {product && <p className="rounded-2xl bg-surface-2 p-3 text-[13px] leading-relaxed text-muted">Preview this retailer photo on you. The AI may change product details and cannot measure fit. Nothing is generated until you choose “See it on me”.</p>}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.heic,.heif"
          hidden
          data-testid="try-on-photo"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void choose(file);
          }}
        />

        <button type="button" aria-label={result ? "Open preview detail" : "Open reference detail"} disabled={!(result || photo)} onClick={() => setDetailOpen(true)} className={cn("relative grid w-full place-items-center overflow-hidden rounded-[28px] bg-tile", result || photo ? "aspect-[2/3]" : "py-12")}>
          {result || photo ? (
            <img src={showOriginal && photo ? photo : result ?? photo!} alt={showOriginal && photo ? "Original reference photo" : result ? "AI preview of you wearing these pieces" : "Your full-body try-on reference"} className={cn("size-full object-contain outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10", !result && busy && "opacity-50")} />
          ) : (
            <div className="space-y-3 px-6 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface-2 text-faint"><Shirt className="size-6" aria-hidden="true" /></div>
              <div className="space-y-1"><p className="text-[15px] font-semibold tracking-tight">Add a photo of yourself</p><p className="text-[13px] leading-relaxed text-muted">Use a clear full-body photo of yourself, standing head to toe in good light. Your other profile angles improve consistency.</p></div>
            </div>
          )}
          {busy && <div className="glass absolute bottom-3 left-1/2 flex max-w-[92%] -translate-x-1/2 items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] font-medium"><Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" /><span className="truncate">{busy}</span></div>}
        </button>
        {detailOpen && (result || photo) && <Sheet open onOpenChange={setDetailOpen} title={showOriginal ? "Original reference" : result ? "Your AI preview" : "Your reference"}><img src={showOriginal && photo ? photo : result ?? photo!} alt="Try-on detail" className="w-full rounded-2xl object-contain" /></Sheet>}

        {result && (
          <div className="space-y-2">
            <div className="flex gap-1 rounded-full bg-surface-2 p-1" role="group" aria-label="Preview view">
              <button type="button" aria-pressed={!showOriginal} onClick={() => setShowOriginal(false)} className={cn("h-8 flex-1 rounded-full text-[12px] font-medium transition-colors", !showOriginal ? "bg-surface text-text shadow-soft" : "text-muted")}>AI result</button>
              <button type="button" aria-pressed={showOriginal} disabled={!photo} onClick={() => setShowOriginal(true)} className={cn("h-8 flex-1 rounded-full text-[12px] font-medium transition-colors", showOriginal ? "bg-surface text-text shadow-soft" : "text-muted")}>Original</button>
            </div>
            <div className="flex items-start gap-2 text-[12px] leading-relaxed text-muted"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><p>AI preview, not a real photo. Drape, fit and small details are estimated; use your saved measurements and retailer size charts for real-world fit.</p></div>
            <a href={result} download="outfits-try-on.jpg" className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-3 text-[12.5px] font-medium transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"><ArrowDownToLine className="size-3.5" aria-hidden="true" /> Save preview</a>
          </div>
        )}

        {!photo && <div className="space-y-2"><Button size="lg" className="w-full" disabled={Boolean(busy)} onClick={() => fileRef.current?.click()}><Upload className="size-4" aria-hidden="true" /> Choose a photo</Button><Link href="/me#try-on-profile" className="flex items-center justify-center gap-1 text-[12.5px] text-muted underline underline-offset-2">Set up all profile angles <ChevronRight className="size-3.5" aria-hidden="true" /></Link></div>}

        {!product && itemIds.length > 0 && (
          <section className="space-y-2" aria-labelledby="try-on-pieces-title">
            <div className="flex items-center justify-between gap-3"><h2 id="try-on-pieces-title" className="text-[13px] font-semibold">Pieces in this look</h2><span className="text-[11.5px] text-muted">{selectedIds.length}/4 selected</span></div>
            <div className="grid grid-cols-4 gap-2">
              {(itemData?.items ?? []).filter((item) => itemIds.includes(item.id)).map((item) => {
                const selected = selectedIds.includes(item.id);
                return <button key={item.id} type="button" disabled={Boolean(busy)} aria-pressed={selected} aria-label={`${selected ? "Remove" : "Add"} ${item.name}`} onClick={() => { setSelectedIds((current) => selected ? current.filter((id) => id !== item.id) : current.length < 4 ? [...current, item.id] : current); setActiveItemId(item.id); discard(result); setResult(null); setShowOriginal(false); }} className={cn("overflow-hidden rounded-2xl border text-left transition-[border,transform] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70", selected ? "border-accent bg-accent/10" : "border-border bg-surface-2")}>{item.image_url ? <img src={item.image_url} alt="" className="aspect-square w-full object-contain p-1 outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" /> : <div className="grid aspect-square place-items-center text-faint"><ImagePlus className="size-4" aria-hidden="true" /></div>}<span className="block truncate px-1.5 pb-1.5 pt-1 text-[10.5px] font-medium">{item.name}</span></button>;
              })}
            </div>
            {activeItem && <div className="flex items-start gap-2 rounded-xl bg-surface-2/70 p-2.5 text-[11.5px] leading-relaxed text-muted"><Shirt className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><p><span className="font-medium text-text">{activeItem.name}.</span> {activeItem.description ?? "Selected from your Drawer."}</p></div>}
          </section>
        )}

        {photo && <div className="space-y-2"><Button size="lg" className="w-full" disabled={Boolean(busy)} onClick={() => void generate()}><Wand2 className="size-4" aria-hidden="true" /> {result ? "Try again" : "See it on me"}</Button><div className="flex gap-2"><Button size="sm" variant="surface" className="flex-1" disabled={Boolean(busy)} onClick={() => fileRef.current?.click()}><Upload className="size-3.5" aria-hidden="true" /> Change photo</Button><Button size="sm" variant="surface" className="flex-1" disabled={Boolean(busy)} onClick={() => void removePhoto()}><Trash2 className="size-3.5" aria-hidden="true" /> Remove photo</Button></div></div>}
        <p className="text-[12px] text-faint">Your references stay until you remove them. They are sent to AI when you request photo analysis or a preview, and are not used for face recognition. Save a preview before closing; closing removes it.</p>
      </div>
    </Sheet>
  );
}
