"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated private image URLs. */
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { TryOnRun } from "@/lib/types";
import { api, fetcher } from "@/lib/utils";
import { TryOnSheet } from "./try-on";

export function SavedTryOns() {
  const { data, error, isLoading, mutate } = useSWR<{ runs: TryOnRun[] }>("/api/try-on", fetcher);
  const [selected, setSelected] = useState<TryOnRun | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  return <section id="saved-try-ons" className="space-y-4 rounded-[28px] bg-surface p-5" aria-labelledby="saved-try-ons-title">
    <div><h2 id="saved-try-ons-title" className="font-semibold">Saved try-ons</h2><p className="mt-1 text-xs text-muted">Your fitting-room archive. Reopen a look, compare it with its original photo, or recreate it.</p></div>
    {isLoading && <p role="status" className="text-sm text-muted">Loading your looks…</p>}
    {error && <div role="alert"><p className="text-sm text-danger">Couldn’t load saved try-ons.</p><Button variant="surface" onClick={() => void mutate()}>Retry</Button></div>}
    {data && !data.runs.length && <p className="text-sm text-muted">Your first preview will be saved here automatically.</p>}
    <div className="grid grid-cols-2 gap-3">
      {data?.runs.map((run) => <article key={run.id} className="overflow-hidden rounded-2xl bg-tile">
        <button type="button" aria-label={`Open saved try-on: ${run.recipe.title}`} className="w-full text-left" onClick={() => setSelected(run)}><img src={run.result_url} alt={run.recipe.title} className="aspect-[2/3] w-full object-contain" /><span className="block p-3 text-xs font-medium">{run.recipe.title}<span className="mt-1 block text-faint">{new Date(run.created_at).toLocaleDateString()}{run.recipe.cost_usd != null ? ` · $${run.recipe.cost_usd.toFixed(3)}` : ""}</span><span className="mt-1 block text-[11px] font-normal text-faint">AI preview · exact fit is not measured</span></span></button>
        <Button variant="ghost" size="sm" disabled={busy === run.id} className="mb-2 ml-2 text-danger" onClick={async () => {
          if (!confirm("Delete this saved preview and its reference copies?")) return;
          setBusy(run.id);
          try { await api("/api/try-on", "DELETE", { id: run.id }); await mutate(); }
          catch (error) { toast.error(error instanceof Error ? error.message : "Couldn’t delete this preview"); }
          finally { setBusy(null); }
        }}>Delete saved preview</Button>
      </article>)}
    </div>
    {selected && <TryOnSheet key={selected.id} initialRun={selected} itemIds={selected.recipe.item_ids} product={selected.recipe.product} onClose={() => setSelected(null)} />}
  </section>;
}
