"use client";
import { Loader2, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { preparePhoto } from "@/lib/image/process";
import { cropAround } from "@/lib/intake/worn-rules";

type Box = ReturnType<typeof cropAround>;

/**
 * Choose which person in a photo is you. The crop happens here on the device, so anyone
 * else in the picture is never uploaded. There's no face detection of any kind.
 */
export function WornPicker({ onPick }: { onPick: (file: File) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<{ url: string; width: number; height: number } | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [size, setSize] = useState(0.85);
  const [busy, setBusy] = useState(false);
  const lastTap = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => () => void (source && URL.revokeObjectURL(source.url)), [source]);

  const load = async (file: File) => {
    setBusy(true);
    try {
      const blob = await preparePhoto(file);
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = url;
      });
      setSource({ url, width: img.naturalWidth, height: img.naturalHeight });
      lastTap.current = { x: 0.5, y: 0.5 };
      setSize(0.85);
      setBox(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't read that photo");
    } finally {
      setBusy(false);
    }
  };

  const aspect = source ? source.width / source.height : 1;
  const place = (x: number, y: number, s = size) => {
    lastTap.current = { x, y };
    setBox(cropAround({ x, y }, s, aspect));
  };

  const finish = async (area: Box | null) => {
    if (!source) return;
    setBusy(true);
    try {
      const img = new Image();
      img.src = source.url;
      await img.decode();
      const a = area ?? { x: 0, y: 0, width: 1, height: 1 };
      const c = document.createElement("canvas");
      c.width = Math.round(a.width * source.width);
      c.height = Math.round(a.height * source.height);
      c.getContext("2d")!.drawImage(img, -a.x * source.width, -a.y * source.height);
      const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("We couldn't crop that photo"))), "image/jpeg", 0.9));
      onPick(new File([blob], "worn.jpg", { type: "image/jpeg" }));
      setSource(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't crop that photo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif"
        hidden
        data-testid="worn-photo"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) load(f);
        }}
      />
      <Button size="lg" variant="surface" disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <UserRound className="size-4" />} From a photo of me
      </Button>

      <Sheet open={!!source} onOpenChange={(o) => !o && setSource(null)} title="Which one is you?">
        {source && (
          <div className="space-y-4 pb-6">
            <p className="text-[13px] text-muted">Tap yourself, and only that area is sent. If you&apos;re alone in the photo, use all of it. Each new piece costs one studio shot.</p>
            <div
              data-testid="worn-area"
              role="presentation"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                place((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
              }}
              className="relative mx-auto max-h-[52dvh] w-fit cursor-crosshair touch-manipulation overflow-hidden rounded-2xl"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={source.url} alt="Your photo" draggable={false} className="block max-h-[52dvh] w-auto select-none" />
              {box && (
                <div
                  data-testid="worn-box"
                  className="pointer-events-none absolute rounded-xl border-2 border-white shadow-[0_0_0_100vmax_rgba(0,0,0,0.55)]"
                  style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }}
                />
              )}
            </div>
            {box && (
              <label className="block space-y-1 text-[12.5px] text-muted">
                Size of the area
                <input
                  type="range"
                  min={0.3}
                  max={1}
                  step={0.01}
                  value={size}
                  aria-label="Size of the area"
                  onChange={(e) => {
                    const s = Number(e.target.value);
                    setSize(s);
                    place(lastTap.current.x, lastTap.current.y, s);
                  }}
                  className="w-full"
                />
              </label>
            )}
            <div className="flex gap-2">
              <Button size="lg" variant="surface" className="flex-1" disabled={busy} onClick={() => finish(null)}>
                It&apos;s only me
              </Button>
              <Button size="lg" className="flex-1" disabled={busy || !box} onClick={() => finish(box)}>
                Use this area
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
