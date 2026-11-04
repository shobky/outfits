"use client";
import { Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { track } from "@/lib/events";
import { isStuck, useIntake, type IntakeData } from "@/lib/hooks";
import { isImageFile, PhotoReadError, preparePhoto } from "@/lib/image/process";
import { uploadImage } from "@/lib/image/upload";
import type { IntakeGroup } from "@/lib/types";
import { api } from "@/lib/utils";

export const MAX_PHOTOS = 8;

/** A photo still on this device. Once it reaches storage the server owns the rest. */
export interface PendingPhoto {
  id: string;
  file: File;
  preview: string;
  status: "waiting" | "uploading" | "uploaded" | "failed";
  url?: string;
  error?: string;
}

export interface PendingUpload {
  id: string;
  photos: PendingPhoto[];
  sending: boolean;
  error?: string;
}

interface Ctx {
  uploads: PendingUpload[];
  data: IntakeData | undefined;
  addFiles: (files: File[]) => void;
  retryUpload: (id: string) => void;
  discardUpload: (id: string) => void;
  refresh: () => void;
}

const IntakeContext = createContext<Ctx | null>(null);

export function useIntakeQueue() {
  const c = useContext(IntakeContext);
  if (!c) throw new Error("useIntakeQueue must be inside IntakeProvider");
  return c;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
export const isWorking = (g: IntakeGroup) => (g.status === "queued" || g.status === "processing") && !isStuck(g);

/**
 * Sits above every page, so moving around the app never interrupts anything. Photos
 * go to storage first; the server then does the rest even if the app is closed.
 */
export function IntakeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const uploadsRef = useRef(uploads);
  uploadsRef.current = uploads;
  const [polling, setPolling] = useState(false);
  const { data, mutate: reload } = useIntake(polling);

  const active = useMemo(() => {
    if (!data) return false;
    return data.groups.some(isWorking) || data.batches.some((b) => b.status === "analyzing" && !isStuck(b));
  }, [data]);
  useEffect(() => setPolling(active || uploads.length > 0), [active, uploads.length]);

  // Once per visit: this is what retention is measured from.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("outfits:opened")) return;
      sessionStorage.setItem("outfits:opened", "1");
    } catch {}
    track("app_open");
  }, []);

  // Tell the owner about finished pieces wherever they are in the app.
  const known = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    if (!data) return;
    const previous = known.current;
    const next = new Map(data.groups.map((g) => [g.id, g.status]));
    if (previous) {
      for (const g of data.groups) {
        const before = previous.get(g.id);
        if (before === g.status || !before) continue;
        if (g.status === "added") {
          toast.success(`${g.draft.name} is in your drawer`);
          mutate((k) => typeof k === "string" && k.startsWith("/api/items"));
        } else if (g.status === "review") {
          toast(g.error ? `${g.draft.name || "A piece"} needs a retry` : `${g.draft.name || "A piece"} needs a quick check`, { action: { label: "Review", onClick: () => router.push("/add") } });
        }
      }
    }
    known.current = next;
  }, [data, router]);

  const patchUpload = useCallback((id: string, fn: (u: PendingUpload) => PendingUpload) => setUploads((list) => list.map((u) => (u.id === id ? fn(u) : u))), []);
  const patchPhoto = useCallback(
    (uploadId: string, photoId: string, patch: Partial<PendingPhoto>) => patchUpload(uploadId, (u) => ({ ...u, photos: u.photos.map((p) => (p.id === photoId ? { ...p, ...patch } : p)) })),
    [patchUpload],
  );

  const run = useCallback(
    async (uploadId: string) => {
      const upload = uploadsRef.current.find((u) => u.id === uploadId);
      if (!upload) return;
      patchUpload(uploadId, (u) => ({ ...u, error: undefined, sending: true }));
      const urls = new Map(upload.photos.filter((p) => p.url).map((p) => [p.id, p.url!]));
      const todo = upload.photos.filter((p) => !p.url);
      let next = 0;
      const worker = async () => {
        while (next < todo.length) {
          const p = todo[next++];
          patchPhoto(uploadId, p.id, { status: "uploading", error: undefined });
          try {
            const url = await uploadImage(await preparePhoto(p.file));
            urls.set(p.id, url);
            patchPhoto(uploadId, p.id, { status: "uploaded", url });
          } catch (e) {
            console.error(e);
            patchPhoto(uploadId, p.id, { status: "failed", error: e instanceof PhotoReadError ? e.message : `Upload failed: ${message(e)}` });
          }
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      const ordered = upload.photos.map((p) => urls.get(p.id)).filter((u): u is string => !!u);
      if (ordered.length < upload.photos.length) {
        patchUpload(uploadId, (u) => ({ ...u, sending: false, error: "Some photos didn't upload" }));
        return;
      }
      try {
        await api("/api/intake", "POST", { photos: ordered });
        await reload();
        upload.photos.forEach((p) => URL.revokeObjectURL(p.preview));
        setUploads((list) => list.filter((u) => u.id !== uploadId));
      } catch (e) {
        patchUpload(uploadId, (u) => ({ ...u, sending: false, error: message(e) }));
      }
    },
    [patchPhoto, patchUpload, reload],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      const images = files.filter(isImageFile);
      const skipped = files.filter((f) => !isImageFile(f));
      if (skipped.length) toast.error(`Not a photo, so it was skipped: ${skipped.map((f) => f.name).join(", ")}`);
      if (!images.length) return;
      if (images.length > MAX_PHOTOS) toast.warning(`Up to ${MAX_PHOTOS} photos at a time, so the first ${MAX_PHOTOS} are on their way`);
      const id = crypto.randomUUID();
      const upload: PendingUpload = {
        id,
        sending: true,
        photos: images.slice(0, MAX_PHOTOS).map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), status: "waiting" })),
      };
      uploadsRef.current = [...uploadsRef.current, upload];
      setUploads(uploadsRef.current);
      run(id);
    },
    [run],
  );

  const discardUpload = useCallback((id: string) => setUploads((list) => list.filter((u) => u.id !== id)), []);
  const value = useMemo<Ctx>(() => ({ uploads, data, addFiles, retryUpload: run, discardUpload, refresh: () => void reload() }), [uploads, data, addFiles, run, discardUpload, reload]);

  // Warn before closing only while photos are still on this device.
  const hasLocal = uploads.some((u) => u.sending);
  useEffect(() => {
    if (!hasLocal) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasLocal]);

  return <IntakeContext.Provider value={value}>{children}</IntakeContext.Provider>;
}

/** Small status pill shown over the rest of the app. */
export function IntakeStatus() {
  const { uploads, data } = useIntakeQueue();
  const path = usePathname();
  if (path.startsWith("/add") || path.startsWith("/stylist")) return null;
  const uploading = uploads.reduce((n, u) => n + u.photos.filter((p) => !p.url).length, 0);
  const analyzing = data?.batches.some((b) => b.status === "analyzing" && !isStuck(b));
  const working = data?.groups.filter(isWorking).length ?? 0;
  const review = data?.groups.filter((g) => g.status === "review" || g.status === "failed" || (g.status === "processing" && isStuck(g))).length ?? 0;
  const label = uploading ? `Uploading ${uploading} photo${uploading === 1 ? "" : "s"}` : analyzing ? "Reading your photos" : working ? `Styling ${working} piece${working === 1 ? "" : "s"}` : review ? `${review} piece${review === 1 ? "" : "s"} to check` : null;
  if (!label) return null;
  const busy = uploading || analyzing || working;
  return (
    <Link href="/add" className="glass fixed bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+4.75rem)] left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-border px-3.5 py-2 text-[12.5px] font-medium shadow-soft lg:bottom-6">
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-accent" />}
      {label}
    </Link>
  );
}
