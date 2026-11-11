"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ShareFile {
  url: string;
  name: string;
  type?: string;
}

export function ShareButton({ title, text, url, files, label = "Share" }: { title: string; text: string; url: string; files?: ShareFile[]; label?: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const shareUrl = typeof window !== "undefined" ? new URL(url, window.location.href).toString() : url;
    const fallback = `${text}\n${shareUrl}`.trim();
    try {
      if (typeof navigator.share === "function") {
        let shareFiles: File[] = [];
        if (files?.length) {
          shareFiles = await Promise.all(files.slice(0, 4).map(async (file) => {
            const response = await fetch(file.url);
            if (!response.ok) throw new Error("image_unavailable");
            return new File([await response.blob()], file.name, { type: file.type || response.headers.get("content-type") || "image/jpeg" });
          }));
        }
        const payload: ShareData = { title, text, url: shareUrl };
        if (shareFiles.length && (!navigator.canShare || navigator.canShare({ files: shareFiles }))) payload.files = shareFiles;
        await navigator.share(payload);
        return;
      }
      await navigator.clipboard.writeText(fallback);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      toast("Share link copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(fallback);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
        toast("Image sharing isn't available here, so the link was copied");
      } catch {
        toast.error("Couldn't open sharing");
      }
    }
  };

  return <Button type="button" variant="surface" size="lg" className="w-full" onClick={() => void share()}><Share2 className="size-4" /> {copied ? <><Check className="size-4" /> Copied</> : label}</Button>;
}
