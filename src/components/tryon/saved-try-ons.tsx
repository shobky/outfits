"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated private image URLs. */
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ImageOff, MoreHorizontal } from "lucide-react";
import { useRef, useState } from "react";
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
  const [expanded, setExpanded] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const runs = data?.runs ?? [];
  const visibleRuns = expanded ? runs : runs.slice(0, 3);

  return <section id="saved-try-ons" className="space-y-4 rounded-[28px] bg-surface p-5" aria-labelledby="saved-try-ons-title">
    <div>
      <h2 ref={headingRef} tabIndex={-1} id="saved-try-ons-title" className="font-semibold outline-none">Saved try-ons</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">Your fitting-room archive. Reopen a look, compare it with its original photo, or recreate it.</p>
      <p className="mt-2 text-[11px] leading-relaxed text-faint">AI previews are estimates, so use your saved measurements and retailer size charts for real-world fit.</p>
    </div>
    {isLoading && <p role="status" className="text-sm text-muted">Loading your looks…</p>}
    {error && <div role="alert"><p className="text-sm text-danger">Couldn’t load saved try-ons.</p><Button variant="surface" onClick={() => void mutate()}>Retry</Button></div>}
    {data && !data.runs.length && <p className="text-sm text-muted">Your first preview will be saved here automatically.</p>}
    {visibleRuns.length > 0 && <div className="grid grid-cols-1 gap-3">
      {visibleRuns.map((run) => <article key={run.id} className="flex min-w-0 items-stretch gap-3 overflow-hidden rounded-2xl bg-tile p-2">
        <button type="button" aria-label={`Open saved try-on: ${run.recipe.title}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/70" onClick={() => setSelected(run)}>
          <div className="grid h-28 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2">
            {brokenImages[run.id] ? <ImageOff className="size-5 text-faint" aria-hidden="true" /> : <img src={run.result_url} alt={run.recipe.title} className="size-full object-contain" onError={() => setBrokenImages((current) => ({ ...current, [run.id]: true }))} />}
          </div>
          <span className="min-w-0 py-1 text-xs font-medium">
            <span className="line-clamp-3 break-words">{run.recipe.title}</span>
            <span className="mt-1 block text-faint">{new Date(run.created_at).toLocaleDateString()}</span>
          </span>
        </button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button ref={(element) => { triggerRefs.current[run.id] = element; }} type="button" aria-label={`More actions for ${run.recipe.title}`} disabled={busy === run.id} className="grid size-11 shrink-0 self-center place-items-center rounded-full text-muted outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent/70 disabled:opacity-40">
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-48 rounded-2xl border border-border bg-bg-elevated p-1.5 shadow-2xl">
              <DropdownMenu.Item
                className="cursor-pointer rounded-xl px-3 py-2 text-[13px] text-danger outline-none data-[highlighted]:bg-danger/10"
                onSelect={() => {
                  if (!confirm("Delete this saved preview and its reference copies?")) return;
                  setBusy(run.id);
                  const index = runs.findIndex((entry) => entry.id === run.id);
                  const nextId = runs[index + 1]?.id ?? runs[index - 1]?.id;
                  void api("/api/try-on", "DELETE", { id: run.id })
                    .then(async () => {
                      await mutate();
                      requestAnimationFrame(() => {
                        const nextTrigger = nextId ? triggerRefs.current[nextId] : null;
                        if (nextTrigger) nextTrigger.focus();
                        else headingRef.current?.focus();
                      });
                    })
                    .catch((deleteError) => toast.error(deleteError instanceof Error ? deleteError.message : "Couldn’t delete this preview"))
                    .finally(() => setBusy(null));
                }}
              >
                Delete saved preview
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </article>)}
    </div>}
    {runs.length > 3 && <Button variant="surface" className="w-full" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? "Show fewer" : `Show all ${runs.length}`}</Button>}
    {selected && <TryOnSheet key={selected.id} initialRun={selected} itemIds={selected.recipe.item_ids} product={selected.recipe.product} onClose={() => setSelected(null)} />}
  </section>;
}
