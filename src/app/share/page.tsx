import { Suspense } from "react";
import { ShareView } from "@/components/share/share-view";

export const metadata = { title: "Shared with Outfits" };

export default function SharePage() {
  return <Suspense fallback={<div className="grid min-h-dvh place-items-center text-sm text-muted">Loading share…</div>}><ShareView /></Suspense>;
}
