"use client";
import { Loader2, Shirt, Trash2, Upload, Wand2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { refreshUsage, useUsage } from "@/components/usage/usage";
import { useProfile } from "@/lib/hooks";
import { preparePhoto } from "@/lib/image/process";
import { uploadImage } from "@/lib/image/upload";
import { api, cn } from "@/lib/utils";

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Shows only for people who have the try-on feature. */
export function TryOnButton({ itemIds, compact }: { itemIds: string[]; compact?: boolean }) {
  const { data } = useUsage();
  const [open, setOpen] = useState(false);
  if (!data?.features.includes("try_on")) return null;
  return (
    <>
      {compact ? (
        <button type="button" aria-label="Try it on" title="Try it on" onClick={() => setOpen(true)} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2">
          <Wand2 className="size-4" />
        </button>
      ) : (
        <Button size="sm" variant="surface" onClick={() => setOpen(true)}>
          <Wand2 className="size-3.5" /> Try it on
        </Button>
      )}
      {open && <TryOnSheet itemIds={itemIds} onClose={() => setOpen(false)} />}
    </>
  );
}

function TryOnSheet({ itemIds, onClose }: { itemIds: string[]; onClose: () => void }) {
  const { data, mutate: reloadProfile } = useProfile();
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photo = data?.profile.try_on_photo_url ?? null;

  /** Previews aren't saved, so the file goes when it's replaced or closed. */
  const discard = (url: string | null) => {
    if (url) void api("/api/try-on", "DELETE", { url }).catch(() => {});
  };

  const choose = async (file: File) => {
    setBusy("Uploading…");
    try {
      const url = await uploadImage(await preparePhoto(file));
      await api("/api/try-on/photo", "POST", { url });
      await reloadProfile();
      // A preview of the old photo would be misleading next to the new one.
      discard(result);
      setResult(null);
      await mutate("/api/profile");
    } catch (e) {
      toast.error(`Couldn't save that photo: ${reason(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    setBusy("Dressing you, this takes about a minute…");
    const previous = result;
    try {
      const { url } = await api<{ url: string }>("/api/try-on", "POST", { item_ids: itemIds });
      setResult(url);
      discard(previous);
      refreshUsage();
    } catch (e) {
      toast.error(reason(e));
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = async () => {
    if (!confirm("Remove your photo? You can add another any time.")) return;
    setBusy("Removing…");
    try {
      await api("/api/try-on/photo", "DELETE");
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
    <Sheet open onOpenChange={(o) => !o && close()} title="Try it on">
      <div className="space-y-4 pb-6">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.heic,.heif"
          hidden
          data-testid="try-on-photo"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) choose(f);
          }}
        />
        <div className={cn("relative grid place-items-center overflow-hidden rounded-[28px] bg-tile", result || photo ? "aspect-[2/3]" : "py-12")}>
          {result || photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={result ?? photo!} alt={result ? "AI preview of you wearing these pieces" : "Your photo"} className={cn("size-full object-cover", !result && busy && "opacity-50")} />
          ) : (
            <div className="space-y-2 px-6 text-center">
              <Shirt className="mx-auto size-7 text-faint" />
              <p className="text-[15px] font-semibold tracking-tight">Add a photo of yourself</p>
              <p className="text-[13px] text-muted">Standing, head to toe, in good light. Only you, please: don&apos;t use a photo of anyone else.</p>
            </div>
          )}
          {busy && (
            <div className="glass absolute bottom-3 left-1/2 flex max-w-[92%] -translate-x-1/2 items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] font-medium">
              <Loader2 className="size-3.5 shrink-0 animate-spin" /> <span className="truncate">{busy}</span>
            </div>
          )}
        </div>

        {result && <p className="text-[12.5px] text-muted">AI preview, not a real photo. Fit, drape and small details are guessed, and it can subtly change how you look. It isn&apos;t saved after you close this.</p>}

        {photo ? (
          <div className="space-y-2">
            <Button size="lg" className="w-full" disabled={!!busy} onClick={generate}>
              <Wand2 className="size-4" /> {result ? "Try again" : "See it on me"}
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="surface" className="flex-1" disabled={!!busy} onClick={() => fileRef.current?.click()}>
                <Upload className="size-3.5" /> Change photo
              </Button>
              <Button size="sm" variant="surface" className="flex-1" disabled={!!busy} onClick={removePhoto}>
                <Trash2 className="size-3.5" /> Remove photo
              </Button>
            </div>
          </div>
        ) : (
          <Button size="lg" className="w-full" disabled={!!busy} onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Choose a photo
          </Button>
        )}
        <p className="text-[12px] text-faint">Your photo is sent to OpenAI to make the preview. It stays in your account until you remove it. It isn&apos;t used for face recognition.</p>
      </div>
    </Sheet>
  );
}
