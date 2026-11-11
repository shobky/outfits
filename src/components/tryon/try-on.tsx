"use client";
/* eslint-disable @next/next/no-img-element -- Private reference images use authenticated same-origin requests. */

import {
  ArrowDownToLine,
  ChevronRight,
  ImagePlus,
  Info,
  Loader2,
  Shirt,
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
import type { Item, Profile, TryOnRun } from "@/lib/types";
import { api, cn } from "@/lib/utils";

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

type ExtendedProfile = Profile & {
  try_on_photos?: { url: string; kind: "full_body" | "face" | "side" }[];
};

function primaryProfilePhoto(profile?: Profile) {
  if (!profile) return null;
  const p = profile as ExtendedProfile;
  return p.try_on_photos?.find((photo) => photo.kind === "full_body")?.url ?? p.try_on_photo_url ?? null;
}

/** Shows only for people who have the try-on feature. */
export function TryOnButton({ itemIds, compact, product, disabled, chatId, toolCallId }: { itemIds: string[]; compact?: boolean; product?: { url: string; image_url: string }; disabled?: boolean; chatId?: string; toolCallId?: string }) {
  const { data } = useUsage();
  const [open, setOpen] = useState(false);
  if (!data?.features.includes("try_on")) return null;
  return (
    <>
      {compact ? (
        <button type="button" disabled={disabled} aria-label="Try it on" title="Try it on" onClick={() => setOpen(true)} className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70">
          <Wand2 className="size-4" aria-hidden="true" />
        </button>
      ) : (
        <Button size="sm" variant="surface" disabled={disabled} onClick={() => setOpen(true)}>
          <Wand2 className="size-3.5" aria-hidden="true" /> Try it on
        </Button>
      )}
      {open && <TryOnSheet itemIds={itemIds} product={product} chatId={chatId} toolCallId={toolCallId} onClose={() => setOpen(false)} />}
    </>
  );
}

export function TryOnSheet({ itemIds, product, chatId, toolCallId, onClose, initialRun }: { itemIds: string[]; product?: { url: string; image_url: string }; chatId?: string; toolCallId?: string; onClose: () => void; initialRun?: TryOnRun }) {
  const { data } = useProfile();
  const { data: itemData } = useItems();
  const [selectedIds, setSelectedIds] = useState(() => itemIds.slice(0, 4));
  const [activeItemId, setActiveItemId] = useState<string | null>(itemIds[0] ?? null);
  const [result, setResult] = useState<string | null>(initialRun?.result_url ?? null);
  const [savedRun, setSavedRun] = useState<TryOnRun | null>(initialRun ?? null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [productSize, setProductSize] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [oneOff, setOneOff] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => () => { if (oneOff) URL.revokeObjectURL(oneOff.url); }, [oneOff]);
  const fileRef = useRef<HTMLInputElement>(null);
  const active = useRef(true);
  const resultRef = useRef<string | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const photo = savedRun?.recipe.person_url ?? oneOff?.url ?? primaryProfilePhoto(data?.profile);
  const items = useMemo(() => {
    const byId = new Map((itemData?.items ?? []).map((item) => [item.id, item]));
    return selectedIds.map((id) => byId.get(id)).filter((item): item is Item => Boolean(item));
  }, [itemData?.items, selectedIds]);
  const activeItem = items.find((item) => item.id === activeItemId) ?? items[0] ?? null;

  const discard = (url: string | null) => {
    if (resultRef.current === url) resultRef.current = null;
  };

  const choose = async (file: File) => {
    setBusy("Preparing your reference…");
    try {
      const blob = await preparePhoto(file);
      if (!active.current) return;
      if (blob.size > 4.4 * 1024 * 1024) throw new Error("Choose a photo smaller than 4.4MB");
      setOneOff({ blob, url: URL.createObjectURL(blob) });
      discard(result);
      setResult(null);
      setSavedRun(null);
      setShowOriginal(false);
      toast.success("Ready for this look. Your profile photo is unchanged.");
    } catch (e) {
      toast.error(`Couldn't save that photo: ${reason(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    if (!selectedIds.length && !product && !savedRun) {
      toast("Choose at least one piece");
      return;
    }
    setBusy("Dressing you — this takes about a minute…");
    const previous = result;
    try {
      const payload = savedRun ? { recreate_id: savedRun.id, chat_id: chatId, tool_call_id: toolCallId } : product ? { product, selected_size: productSize, chat_id: chatId, tool_call_id: toolCallId } : { item_ids: selectedIds, chat_id: chatId, tool_call_id: toolCallId };
      const send = async (): Promise<{ url: string; run?: TryOnRun }> => {
        if (!oneOff || savedRun) return api("/api/try-on", "POST", payload);
        const form = new FormData();
        form.append("payload", JSON.stringify(payload));
        form.append("reference", oneOff.blob, "reference.jpg");
        const response = await fetch("/api/try-on", { method: "POST", body: form });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Could not generate this preview");
        return body;
      };
      const { url, run } = await send();
      void mutate("/api/try-on");
      if (!active.current) {
        discard(url);
        return;
      }
      setResult(url);
      setSavedRun(run ?? null);
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

  const useSavedPhoto = () => {
    setOneOff(null);
    setSavedRun(null);
    setResult(null);
    setShowOriginal(false);
  };

  const close = () => {
    discard(result);
    onClose();
  };

  return (
    <Sheet open onOpenChange={(open) => !open && close()} title="Try it on">
      <div className="space-y-4 pb-6">
        {product && <p className="rounded-2xl bg-surface-2 p-3 text-[13px] leading-relaxed text-muted">Preview this retailer photo on you. The AI may change product details and cannot measure fit. Nothing is generated until you choose “See it on me”.</p>}
        {product && !savedRun && <label className="block space-y-2 text-sm">Size you’re considering (optional)<input value={productSize} onChange={(event) => setProductSize(event.target.value)} maxLength={80} disabled={Boolean(busy)} placeholder="For example, EU 42 or size L" className="h-11 w-full rounded-xl border border-border bg-surface px-3" /><span className="block text-xs text-muted">The retailer’s garment measurements are unknown. A size label alone cannot predict fit.</span></label>}
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
              <button type="button" aria-pressed={!showOriginal} onClick={() => setShowOriginal(false)} className={cn("h-11 flex-1 rounded-full text-[12px] font-medium transition-colors", !showOriginal ? "bg-surface text-text shadow-soft" : "text-muted")}>AI result</button>
              <button type="button" aria-pressed={showOriginal} disabled={!photo} onClick={() => setShowOriginal(true)} className={cn("h-11 flex-1 rounded-full text-[12px] font-medium transition-colors", showOriginal ? "bg-surface text-text shadow-soft" : "text-muted")}>Original</button>
            </div>
            <div className="flex items-start gap-2 text-[12px] leading-relaxed text-muted"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><p>AI preview, not a real photo. Drape, fit and small details are estimated; use your saved measurements and retailer size charts for real-world fit.</p></div>
            <a href={result} download="outfits-try-on.jpg" className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-3 text-[12.5px] font-medium transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"><ArrowDownToLine className="size-3.5" aria-hidden="true" /> Download image</a>
          </div>
        )}

        {!photo && <div className="space-y-2"><Button size="lg" className="w-full" disabled={Boolean(busy)} onClick={() => fileRef.current?.click()}><Upload className="size-4" aria-hidden="true" /> Choose a photo</Button><Link href="/me#try-on-profile" className="flex items-center justify-center gap-1 text-[12.5px] text-muted underline underline-offset-2">Set up all profile angles <ChevronRight className="size-3.5" aria-hidden="true" /></Link></div>}

        {!product && itemIds.length > 0 && (
          <section className="space-y-2" aria-labelledby="try-on-pieces-title">
            <div className="flex items-center justify-between gap-3"><h2 id="try-on-pieces-title" className="text-[13px] font-semibold">Pieces in this look</h2><span className="text-[11.5px] text-muted">{selectedIds.length}/4 selected</span></div>
            <div className="grid grid-cols-4 gap-2">
              {(itemData?.items ?? []).filter((item) => itemIds.includes(item.id)).map((item) => {
                const selected = selectedIds.includes(item.id);
                return <button key={item.id} type="button" disabled={Boolean(busy)} aria-pressed={selected} aria-label={`${selected ? "Remove" : "Add"} ${item.name}`} onClick={() => { setSelectedIds((current) => selected ? current.filter((id) => id !== item.id) : current.length < 4 ? [...current, item.id] : current); setActiveItemId(item.id); discard(result); setResult(null); setSavedRun(null); setShowOriginal(false); }} className={cn("overflow-hidden rounded-2xl border text-left transition-[border,transform] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70", selected ? "border-accent bg-accent/10" : "border-border bg-surface-2")}>{item.image_url ? <img src={item.image_url} alt="" className="aspect-square w-full object-contain p-1 outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" /> : <div className="grid aspect-square place-items-center text-faint"><ImagePlus className="size-4" aria-hidden="true" /></div>}<span className="block truncate px-1.5 pb-1.5 pt-1 text-[10.5px] font-medium">{item.name}</span></button>;
              })}
            </div>
            {activeItem && <div className="flex items-start gap-2 rounded-xl bg-surface-2/70 p-2.5 text-[11.5px] leading-relaxed text-muted"><Shirt className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><p><span className="font-medium text-text">{activeItem.name}.</span> {activeItem.description ?? "Selected from your Drawer."}</p></div>}
          </section>
        )}

        {photo && <div className="space-y-2"><Button size="lg" className="w-full" disabled={Boolean(busy)} onClick={() => void generate()}><Wand2 className="size-4" aria-hidden="true" /> {result ? "Recreate · uses 1 try-on" : "See it on me"}</Button><div className="flex gap-2"><Button size="sm" variant="surface" className="flex-1" disabled={Boolean(busy)} onClick={() => fileRef.current?.click()}><Upload className="size-3.5" aria-hidden="true" /> Photo for this look</Button>{(oneOff || savedRun) && <Button size="sm" variant="surface" className="flex-1" disabled={Boolean(busy)} onClick={useSavedPhoto}>Use profile photo</Button>}</div></div>}
        {oneOff && !savedRun && <p className="text-xs text-muted">This photo is only for this look. It is saved privately with the generated result; your profile stays unchanged. Use a photo of yourself.</p>}
        {savedRun && <details className="rounded-2xl bg-surface-2 p-3 text-xs"><summary className="cursor-pointer font-medium">Saved look details</summary><div className="mt-3 space-y-2 break-words"><p>{savedRun.recipe.title}</p><p>{new Date(savedRun.created_at).toLocaleString()} · {savedRun.recipe.model ?? "Model not recorded"}{savedRun.recipe.cost_usd != null ? ` · ${savedRun.recipe.cost_usd.toFixed(4)}` : ""}</p><p className="whitespace-pre-wrap">{savedRun.recipe.garment_context}</p><p>{savedRun.recipe.fit_context}</p></div></details>}
        <p className="text-[12px] text-muted">Generating a preview uses the app’s paid image API and your try-on allowance, including when chat uses your ChatGPT connection.</p>
        <p className="text-[12px] text-faint">Results and a private copy of their inputs are saved to your account. Reopen or delete them in Profile → Saved try-ons. Recreating uses the saved photos and sizing context; the new image may differ.</p>
      </div>
    </Sheet>
  );
}
