"use client";
import { CircleCheck, CircleDashed, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GarmentImage } from "@/components/drawer/item-card";
import { toast } from "sonner";
import { Field, MultiChips } from "@/components/drawer/attribute-picker";
import { Button } from "@/components/ui/button";
import { DeveloperMenu, UsageCard } from "@/components/usage/usage";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { deleteItem, useItems, useProfile } from "@/lib/hooks";
import type { Item, Profile } from "@/lib/types";
import { api } from "@/lib/utils";

const input = "h-11 w-full rounded-2xl border border-border bg-surface px-4 text-[15px] outline-none placeholder:text-faint focus:border-border-strong";
const STYLE_OPTIONS = ["minimal", "smart casual", "classic", "streetwear", "old money", "workwear", "scandi", "sporty", "earth tones", "monochrome", "preppy", "techwear"];
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export function MeView() {
  const { data, mutate } = useProfile();
  if (!data) return <PageHeader title="Profile" />;
  return <ProfileForm data={data} onSaved={() => mutate()} />;
}

function ProfileForm({ data, onSaved }: { data: NonNullable<ReturnType<typeof useProfile>["data"]>; onSaved: () => Promise<unknown> | void }) {
  const [p, setP] = useState<Profile>(data.profile);
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP({ ...p, [k]: v });

  return (
    <div className="pb-32 lg:pb-12">
      <PageHeader title="Profile" />
      <div className="mx-auto max-w-xl space-y-6 px-4">
        <div className="grid grid-cols-2 gap-2">
          <Status ok={data.supabase || data.local} label={data.supabase ? "Synced (Supabase)" : data.local ? "Saved on this machine" : "Demo data (in memory)"} />
          <Status ok={data.ai} label={data.ai ? "AI connected" : "AI in demo mode"} />
        </div>

        <UsageCard />

        <SampleItems />
        <MissingPhotos />

        <Field label="Appearance">
          <Segmented value={(theme as "dark" | "light") ?? "dark"} onChange={setTheme} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} />
        </Field>

        <section className="space-y-5 rounded-[28px] bg-surface p-5">
          <h2 className="font-semibold tracking-tight">About you</h2>
          <p className="-mt-3 text-[13px] text-muted">The stylist uses this for fit, sizing and color advice. You can also just tell it in chat.</p>
          <Field label="Name">
            <input className={input} value={p.display_name ?? ""} onChange={(e) => set("display_name", e.target.value)} />
          </Field>
          <Field label="I shop">
            <MultiChips single options={["menswear", "womenswear", "both"] as const} value={[p.menswear]} onChange={([v]) => set("menswear", v)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Height (cm)">
              <input className={input} inputMode="numeric" value={p.height_cm ?? ""} onChange={(e) => set("height_cm", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="Weight (kg)">
              <input className={input} inputMode="numeric" value={p.weight_kg ?? ""} onChange={(e) => set("weight_kg", e.target.value ? Number(e.target.value) : null)} />
            </Field>
          </div>
          <Field label="Build">
            <input className={input} placeholder="slim, athletic, broad shoulders…" value={p.build ?? ""} onChange={(e) => set("build", e.target.value || null)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {(["top", "waist", "inseam", "shoe_eu"] as const).map((k) => (
              <Field key={k} label={k === "shoe_eu" ? "Shoe (EU)" : `${k[0].toUpperCase()}${k.slice(1)} size`}>
                <input className={input} value={p.sizes[k] ?? ""} onChange={(e) => set("sizes", { ...p.sizes, [k]: e.target.value })} />
              </Field>
            ))}
          </div>
          <Field label="Home city">
            <input className={input} placeholder="For weather" value={p.home_city ?? ""} onChange={(e) => set("home_city", e.target.value || null)} />
          </Field>
        </section>

        <section className="space-y-5 rounded-[28px] bg-surface p-5">
          <h2 className="font-semibold tracking-tight">Taste</h2>
          <Field label="Style">
            <MultiChips options={STYLE_OPTIONS} value={p.style_keywords} onChange={(v) => set("style_keywords", v)} />
          </Field>
          <Field label="Favorite colors (comma separated)">
            <input className={input} value={p.favorite_colors.join(", ")} onChange={(e) => set("favorite_colors", list(e.target.value))} />
          </Field>
          <Field label="Avoid (colors, fits, items)">
            <input className={input} value={p.avoid.join(", ")} onChange={(e) => set("avoid", list(e.target.value))} />
          </Field>
          <Field label="Budget">
            <MultiChips single options={["low", "mid", "high"] as const} value={p.budget ? [p.budget] : []} onChange={([v]) => set("budget", v)} />
          </Field>
          <Field label="Currency">
            <input className={input} value={p.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
          </Field>
          <Field label="Anything else the stylist should know">
            <textarea className={`${input} h-auto min-h-24 py-3`} value={p.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} />
          </Field>
        </section>

        <Button
          size="lg"
          className="w-full"
          onClick={async () => {
            await api("/api/profile", "PATCH", p);
            await onSaved();
            toast.success("Profile saved");
          }}
        >
          Save profile
        </Button>

        {data.supabase && (
          <Button
            variant="ghost"
            className="w-full text-muted"
            onClick={async () => {
              const { createClient } = await import("@/lib/supabase/client");
              await createClient().auth.signOut();
              router.replace("/login");
              router.refresh();
            }}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        )}

        <DeveloperMenu />

        {data.supabase && <DeleteAccount />}

        <p className="pb-2 text-center text-[12.5px]">
          <Link href="/privacy" className="text-muted underline">
            Privacy
          </Link>
        </p>
      </div>
    </div>
  );
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-surface px-3 py-2.5 text-[12.5px] font-medium">
      {ok ? <CircleCheck className="size-4 text-accent" /> : <CircleDashed className="size-4 text-amber-400" />}
      {label}
    </div>
  );
}

function SampleItems() {
  const { data } = useItems();
  const samples = data?.items.filter((i) => i.id.startsWith("demo-")) ?? [];
  if (!samples.length) return null;
  return (
    <div className="flex items-center gap-3 rounded-[22px] bg-surface p-4">
      <div className="flex-1">
        <p className="text-[14px] font-medium">{samples.length} sample pieces in your drawer</p>
        <p className="text-[12.5px] text-muted">Remove them once you&apos;ve added your own clothes.</p>
      </div>
      <Button
        size="sm"
        variant="surface"
        onClick={async () => {
          if (!confirm("Remove all sample pieces?")) return;
          for (const i of samples) await deleteItem(i.id);
          toast("Sample pieces removed");
        }}
      >
        Remove
      </Button>
    </div>
  );
}

const photoLoads = (url: string) =>
  new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });

function MissingPhotos() {
  const { data } = useItems();
  const [found, setFound] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState(false);
  const items = data?.items ?? [];
  if (!items.length) return null;

  const check = async () => {
    setBusy(true);
    const loaded = await Promise.all(items.map((i) => (i.image_url ? photoLoads(i.image_url) : false)));
    setFound(items.filter((_, n) => !loaded[n]));
    setBusy(false);
  };

  const removeAll = async () => {
    if (!found || !confirm(`Permanently delete ${found.length} piece${found.length === 1 ? "" : "s"} with no photo?`)) return;
    setBusy(true);
    try {
      for (const i of found) await deleteItem(i.id);
      setFound([]);
      toast("Pieces deleted");
    } catch (e) {
      toast.error(`Couldn't delete them all: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-[22px] bg-surface p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-[14px] font-medium">Missing photos</p>
          <p className="text-[12.5px] text-muted">
            {found === null ? "Find pieces whose photo is gone or won't load." : found.length ? `${found.length} piece${found.length === 1 ? "" : "s"} found. Open one in your drawer to re-upload.` : "All your pieces have working photos."}
          </p>
        </div>
        <Button size="sm" variant="surface" disabled={busy} onClick={check}>
          {busy ? "Working…" : "Check"}
        </Button>
      </div>
      {!!found?.length && (
        <>
          <ul className="divide-y divide-border">
            {found.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2 text-[13px]">
                <div className="size-9 shrink-0 rounded-lg bg-tile p-1">
                  <GarmentImage src={null} alt="" compact className="h-full w-full" />
                </div>
                <span className="truncate">{i.name}</span>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="danger" className="w-full" disabled={busy} onClick={removeAll}>
            Delete {found.length === 1 ? "this piece" : `these ${found.length} pieces`}
          </Button>
        </>
      )}
    </div>
  );
}

function DeleteAccount() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="danger"
      className="w-full"
      disabled={busy}
      onClick={async () => {
        if (!confirm("Permanently delete your account, clothes, chats and photos? This can't be undone.")) return;
        setBusy(true);
        try {
          await api("/api/account", "DELETE");
          const { createClient } = await import("@/lib/supabase/client");
          await createClient().auth.signOut().catch(() => {});
          location.replace("/login");
        } catch (e) {
          toast.error(`Couldn't delete your account: ${e instanceof Error ? e.message : String(e)}`);
          setBusy(false);
        }
      }}
    >
      {busy ? "Deleting…" : "Delete my account"}
    </Button>
  );
}
