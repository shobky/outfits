"use client";

import { ImagePlus, Loader2, Save, Sparkles, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import type { ShareIntent } from "@/lib/types";
import { api } from "@/lib/utils";

export function ShareView() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const [intent, setIntent] = useState<ShareIntent | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fallbackUrl, setFallbackUrl] = useState("");

  useEffect(() => {
    if (!id) return;
    void api<ShareIntent>(`/api/share/${encodeURIComponent(id)}`, "GET")
      .then(setIntent)
      .catch((e) => setError(e instanceof Error ? e.message : "That share has expired."));
  }, [id]);

  const discard = async () => {
    if (!id || busy) return;
    setBusy("discard");
    try {
      await api(`/api/share/${encodeURIComponent(id)}`, "DELETE");
      router.replace("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't discard that share");
    } finally {
      setBusy(null);
    }
  };

  const addToDrawer = async () => {
    if (!id || !intent?.photos.length || busy) return;
    setBusy("drawer");
    try {
      await api("/api/intake", "POST", { photos: intent.photos, kind: "closet" });
      await api(`/api/share/${encodeURIComponent(id)}?keepPhotos=1`, "DELETE");
      toast("Photos are on their way to your drawer");
      router.replace("/add");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add those photos");
    } finally {
      setBusy(null);
    }
  };

  const stylePhotos = () => {
    if (!id || !intent?.photos.length || busy) return;
    router.push(`/stylist?share=${encodeURIComponent(id)}`);
  };

  const saveLink = async () => {
    if (!id || !intent?.url || busy) return;
    setBusy("wishlist");
    try {
      const facts = await api<{ status: "ok" | "unverified" | "dead"; product?: { title: string; url: string; image_url?: string; price?: number; currency?: string; retailer?: string; brand?: string } }>("/api/shop/product", "POST", { url: intent.url }).catch(() => null);
      const product = facts?.status === "ok" ? facts.product : undefined;
      await api("/api/wishlist", "POST", {
        title: product?.title ?? intent.title ?? "Shared product",
        url: product?.url ?? intent.url,
        image_url: product?.image_url ?? null,
        price: product?.price ?? null,
        currency: product?.currency ?? null,
        retailer: product?.retailer ?? null,
        brand: product?.brand ?? null,
        reason: "Saved from the share sheet.",
        status: "saved",
      });
      await api(`/api/share/${encodeURIComponent(id)}`, "DELETE");
      toast("Added to wishlist");
      router.replace("/shop");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save that product");
    } finally {
      setBusy(null);
    }
  };

  if (!id) return <ShareCapture fileRef={fileRef} url={fallbackUrl} onUrl={setFallbackUrl} />;
  if (error) return <ShareEmpty title="Share expired" body={error} />;
  if (!intent) return <div className="grid min-h-dvh place-items-center"><Loader2 className="size-5 animate-spin text-muted" aria-label="Loading shared content" /></div>;

  return (
    <div className="pb-nav lg:pb-12">
      <PageHeader title="Shared with Outfits" />
      <main className="mx-auto max-w-xl space-y-5 px-4">
        <section className="space-y-2 rounded-[28px] bg-surface p-5 shadow-soft">
          <p className="text-[12px] font-medium uppercase tracking-wider text-muted">Review before saving</p>
          <h1 className="text-xl font-semibold tracking-tight">{intent.title ?? (intent.photos.length ? "Photos to style" : "A product to save")}</h1>
          {intent.text && <p className="whitespace-pre-wrap break-words text-[13.5px] text-muted">{intent.text}</p>}
          {intent.url && <a href={intent.url} target="_blank" rel="noreferrer" className="block break-all text-[13px] text-muted underline underline-offset-2">{intent.url}</a>}
        </section>

        {intent.photos.length > 0 && <section className="grid grid-cols-2 gap-2 rounded-[28px] bg-surface p-3 shadow-soft sm:grid-cols-3">{intent.photos.map((photo) => <img key={photo} src={photo} alt="Shared clothing" className="aspect-square w-full rounded-2xl bg-tile object-contain" />)}</section>}

        <section className="space-y-2 rounded-[28px] bg-surface p-4 shadow-soft">
          {intent.photos.length > 0 && <>
            <Button size="lg" className="w-full" onClick={stylePhotos} disabled={Boolean(busy)}><Sparkles className="size-4" /> Style these photos</Button>
            <Button size="lg" variant="surface" className="w-full" onClick={() => void addToDrawer()} disabled={Boolean(busy)}><ImagePlus className="size-4" /> Add to my drawer</Button>
          </>}
          {intent.url && <Button size="lg" variant={intent.photos.length ? "surface" : "primary"} className="w-full" onClick={() => void saveLink()} disabled={Boolean(busy)}><Save className="size-4" /> Save product to wishlist</Button>}
          <Button size="lg" variant="ghost" className="w-full text-muted" onClick={() => void discard()} disabled={Boolean(busy)}><Trash2 className="size-4" /> Discard</Button>
          {busy && <p className="text-center text-[12px] text-muted" role="status">Working…</p>}
        </section>
      </main>
    </div>
  );
}

function ShareCapture({ fileRef, url, onUrl }: { fileRef: RefObject<HTMLInputElement | null>; url: string; onUrl: (value: string) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const files = [...(fileRef.current?.files ?? [])];
    if (!files.length && !url.trim()) { setError("Choose a photo or paste a product link."); return; }
    setBusy(true); setError(null);
    try {
      const body = new FormData(event.currentTarget);
      const response = await fetch("/share/target", { method: "POST", body, headers: { accept: "application/json" } });
      const result = (await response.json().catch(() => null)) as { location?: string; error?: string } | null;
      if (!response.ok || !result?.location) throw new Error(result?.error ?? "We couldn't receive that share.");
      router.push(result.location);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't receive that share.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="pb-nav lg:pb-12">
      <PageHeader title="Share with Outfits" />
      <main className="mx-auto max-w-xl space-y-5 px-4">
        <section className="space-y-2 rounded-[28px] bg-surface p-5 shadow-soft"><h1 className="text-xl font-semibold tracking-tight">Bring in a photo or link</h1><p className="text-[13.5px] leading-relaxed text-muted">On iPhone, use this screen to choose a photo or paste a product link. Android and supported browsers can send directly from the system share sheet.</p></section>
        <form className="space-y-4 rounded-[28px] bg-surface p-4 shadow-soft" onSubmit={(event) => void submit(event)}>
          <label className="block text-[12px] font-medium text-muted" htmlFor="share-capture-url">Product link (optional)<input id="share-capture-url" name="url" type="url" value={url} onChange={(event) => onUrl(event.target.value)} placeholder="https://…" className="mt-1 h-11 w-full rounded-2xl border border-border bg-bg px-4 text-[14px] outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-accent/60" /></label>
          <label className="block text-[12px] font-medium text-muted" htmlFor="share-capture-files">Photos (optional)<input id="share-capture-files" ref={fileRef} name="files" type="file" accept="image/jpeg,image/png,image/webp" multiple className="mt-1 block w-full rounded-2xl border border-border bg-bg px-3 py-3 text-[13px] file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-fg" /></label>
          {error && <p role="alert" className="rounded-2xl bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{error}</p>}
          <Button size="lg" className="w-full" type="submit" disabled={busy}>{busy ? <><Loader2 className="size-4 animate-spin" /> Receiving…</> : "Continue"}</Button>
        </form>
      </main>
    </div>
  );
}

function ShareEmpty({ title, body }: { title: string; body: string }) {
  return <div className="mx-auto max-w-xl px-4 pt-20"><Empty icon={<Sparkles className="size-6" />} title={title} body={body} /></div>;
}
