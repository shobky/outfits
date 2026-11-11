"use client";
/* eslint-disable @next/next/no-img-element -- Private reference images use authenticated same-origin requests. */

import {
  Check,
  ChevronRight,
  CircleHelp,
  ImagePlus,
  Loader2,
  ScanFace,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/drawer/attribute-picker";
import { Sheet } from "@/components/ui/sheet";
import { useUsage } from "@/components/usage/usage";
import { preparePhoto } from "@/lib/image/process";
import type { Profile } from "@/lib/types";
import { api, cn, titleCase } from "@/lib/utils";

export type ProfilePhotoRole = "full_body" | "face" | "side";

type ProfilePhoto = {
  url: string;
  kind: ProfilePhotoRole;
  created_at?: string;
};

type Suggestion = {
  field: string;
  label?: string;
  value: string | number;
  rationale?: string;
  confidence?: "high" | "medium" | "low" | number;
};

type ExtendedProfile = Profile & {
  try_on_photos?: ProfilePhoto[];
};

const roles: {
  role: ProfilePhotoRole;
  label: string;
  short: string;
  hint: string;
  icon: typeof ScanFace;
}[] = [
  {
    role: "full_body",
    label: "Full body",
    short: "Full body",
    hint: "Head to toe, standing naturally. This anchors proportions and drape.",
    icon: ImagePlus,
  },
  {
    role: "face",
    label: "Face & shoulders",
    short: "Portrait",
    hint: "A clear, front-facing portrait in even light helps preserve your expression.",
    icon: ScanFace,
  },
  {
    role: "side",
    label: "Side view",
    short: "Side view",
    hint: "Relaxed side profile gives the model another angle for silhouette and fit.",
    icon: ChevronRight,
  },
];

const roleLabel = (role: ProfilePhotoRole) => roles.find((r) => r.role === role)?.label ?? titleCase(role);

function readPhotos(profile: Profile): Record<ProfilePhotoRole, string | null> {
  const p = profile as ExtendedProfile;
  const result: Record<ProfilePhotoRole, string | null> = { full_body: null, face: null, side: null };
  const values = p.try_on_photos ?? [];
  for (const value of values) {
    if (value?.url && value.kind && !result[value.kind]) result[value.kind] = value.url;
  }
  // Compatibility with the current single-photo profile.
  result.full_body ??= p.try_on_photo_url ?? null;
  return result;
}

function readSuggestions(profile: Profile): Suggestion[] {
  const insights = (profile as ExtendedProfile).try_on_insights;
  if (!insights) return [];
  return [
    ["shoulders", insights.shoulders],
    ["torso", insights.torso],
    ["leg_line", insights.leg_line],
    ["silhouette", insights.silhouette],
    ["posture", insights.posture],
    ["fit_notes", insights.fit_notes],
  ].filter((entry): entry is [string, string] => Boolean(entry[1])).map(([field, value]) => ({ field, value, rationale: "A qualitative note from your reference photos." }));
}

async function uploadPrivatePhoto(blob: Blob) {
  const form = new FormData();
  form.append("file", blob, "profile-reference.jpg");
  const response = await fetch("/api/try-on/upload", { method: "POST", body: form });
  const body = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!response.ok || !body.url) throw new Error(body.error ?? `Upload failed (${response.status})`);
  return body.url;
}

export function ProfilePhotoSetup({ profile, onSaved }: { profile: Profile; onSaved: () => Promise<unknown> | void }) {
  const { data: usage } = useUsage();
  const [photos, setPhotos] = useState(() => readPhotos(profile));
  const [busy, setBusy] = useState<ProfilePhotoRole | "analyze" | null>(null);
  const [activeRole, setActiveRole] = useState<ProfilePhotoRole>("full_body");
  const [suggestions, setSuggestions] = useState(() => readSuggestions(profile));
  const [pendingInsights, setPendingInsights] = useState<Profile["try_on_insights"]>(() => (profile as ExtendedProfile).try_on_insights ?? null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(() => new Set(readSuggestions(profile).map((_, i) => i)));
  const [reviewOpen, setReviewOpen] = useState(false);
  const [detail, setDetail] = useState<ProfilePhotoRole | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const completeness = useMemo(() => {
    const checks = [
      Boolean(photos.full_body),
      Boolean(photos.face),
      Boolean(profile.height_cm),
      Boolean(profile.build),
      Boolean(Object.keys(profile.sizes ?? {}).some((key) => profile.sizes[key])),
      Boolean(profile.style_keywords.length),
    ];
    return { done: checks.filter(Boolean).length, total: checks.length };
  }, [photos, profile]);

  const openPicker = (role: ProfilePhotoRole) => {
    setActiveRole(role);
    fileRef.current?.click();
  };

  const savePhoto = async (file: File, role: ProfilePhotoRole) => {
    setBusy(role);
    try {
      const url = await uploadPrivatePhoto(await preparePhoto(file));
      await api("/api/try-on/photo", "POST", { kind: role, url });
      setPhotos((current) => ({ ...current, [role]: url }));
      setSuggestions([]);
      setPendingInsights(null);
      setReviewOpen(false);
      await Promise.all([onSaved(), mutate("/api/profile")]);
      toast.success(`${roleLabel(role)} photo saved`);
    } catch (error) {
      toast.error(`Couldn’t save that photo: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = async (role: ProfilePhotoRole) => {
    const url = photos[role];
    if (!url || !confirm(`Remove your ${roleLabel(role).toLowerCase()} photo?`)) return;
    setBusy(role);
    try {
      await api("/api/try-on/photo", "DELETE", { kind: role });
      setPhotos((current) => ({ ...current, [role]: null }));
      setSuggestions([]);
      setPendingInsights(null);
      await Promise.all([onSaved(), mutate("/api/profile")]);
      toast("Photo removed");
    } catch (error) {
      toast.error(`Couldn’t remove that photo: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const analyze = async () => {
    const photoUrls = Object.values(photos).filter((url): url is string => Boolean(url));
    if (!photoUrls.length) {
      toast("Add at least one photo first");
      return;
    }
    setBusy("analyze");
    try {
      const next = await api<{ insights?: Profile["try_on_insights"] }>("/api/try-on/profile", "POST", { action: "analyze" });
      const values = next.insights ? readSuggestions({ ...profile, try_on_insights: next.insights }) : [];
      setPendingInsights(next.insights ?? null);
      setSuggestions(values);
      setSelectedSuggestions(new Set(values.map((_, i) => i)));
      setReviewOpen(true);
      toast.success(values.length ? "Suggestions ready to review" : "No extra suggestions yet");
    } catch (error) {
      toast.error(`Couldn’t read those photos: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(null);
    }
  };

  const applySuggestions = async () => {
      const chosen = suggestions.filter((_, i) => selectedSuggestions.has(i));
    if (!chosen.length) {
      setReviewOpen(false);
      return;
    }
    setBusy("analyze");
    try {
      const current = pendingInsights ?? (profile as ExtendedProfile).try_on_insights;
      if (current) {
        const patch = { ...current };
        const qualitativeFields = ["shoulders", "torso", "leg_line", "silhouette", "posture", "fit_notes"];
        for (const field of qualitativeFields) {
          if (!chosen.some((suggestion) => suggestion.field === field)) {
            (patch as Record<string, unknown>)[field] = field === "fit_notes" ? "Preserve the person's natural pose and the way fabric falls on their body." : null;
          }
        }
        for (const suggestion of chosen) {
          if (suggestion.field in patch && suggestion.field !== "confidence" && suggestion.field !== "source_photo_urls" && suggestion.field !== "generated_at") {
            (patch as Record<string, unknown>)[suggestion.field] = String(suggestion.value);
          }
        }
        const reviewed = { shoulders: patch.shoulders, torso: patch.torso, leg_line: patch.leg_line, silhouette: patch.silhouette, posture: patch.posture, fit_notes: patch.fit_notes, confidence: patch.confidence, source_photo_urls: patch.source_photo_urls };
        await api("/api/try-on/profile", "POST", { action: "save", insights: reviewed });
      }
      setReviewOpen(false);
      setSuggestions([]);
      setPendingInsights(null);
      await Promise.all([onSaved(), mutate("/api/profile")]);
      toast.success("Profile updated from your review");
    } catch (error) {
      toast.error(`Couldn’t apply those suggestions: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-4 rounded-[28px] bg-surface p-5 shadow-soft" aria-labelledby="profile-photos-title">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/15 text-text">
          <Sparkles className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="profile-photos-title" className="font-semibold tracking-tight">Your try-on profile</h2>
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-muted">{completeness.done}/{completeness.total} ready</span>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">A few angles help the stylist keep your face, silhouette and clothing proportions consistent.</p>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-label={`${completeness.done} of ${completeness.total} profile checks complete`} role="progressbar" aria-valuemin={0} aria-valuemax={completeness.total} aria-valuenow={completeness.done}>
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(completeness.done / completeness.total) * 100}%` }} />
      </div>

      <input
        ref={fileRef}
        hidden
        type="file"
        accept="image/*,.heic,.heif"
        data-testid="profile-photo-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void savePhoto(file, activeRole);
        }}
      />

      {detail && photos[detail] && <Sheet open onOpenChange={(open) => !open && setDetail(null)} title={`${roleLabel(detail)} reference`}><img src={photos[detail]!} alt={`${roleLabel(detail)} reference detail`} className="w-full rounded-2xl object-contain" /></Sheet>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-2">
        {roles.map(({ role, label, short, hint, icon: Icon }) => {
          const url = photos[role];
          const isBusy = busy === role;
          return (
            <div key={role} className={cn("group overflow-hidden rounded-2xl border transition-colors", activeRole === role ? "border-accent/70 bg-accent/5" : "border-border bg-surface-2/40")}>
              <button type="button" disabled={Boolean(busy)} className="flex w-full items-center text-left sm:block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/70" onClick={() => { setActiveRole(role); if (url) setDetail(role); else openPicker(role); }} aria-label={`${label} photo${url ? ", saved" : ", not added"}`}>
                <div className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden bg-tile sm:w-auto">
                  {url ? <img src={url} alt={`${label} reference`} className="size-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" /> : <div className="grid size-full place-items-center text-faint"><Icon className="size-7" aria-hidden="true" /></div>}
                  {url && <span className="absolute left-2 top-2 grid size-6 place-items-center rounded-full bg-accent text-accent-fg shadow-soft"><Check className="size-3.5" aria-hidden="true" /></span>}
                  {isBusy && <div className="absolute inset-0 grid place-items-center bg-bg/60"><Loader2 className="size-5 animate-spin" aria-label="Saving photo" /></div>}
                </div>
                <div className="space-y-0.5 p-2.5">
                  <p className="text-[13px] font-semibold">{short}</p>
                  <p className="text-[12px] leading-relaxed text-muted">{url ? "Saved to your private profile" : hint}</p>
                </div>
              </button>
              <div className="flex gap-1 border-t border-border p-1.5">
                <Button type="button" variant="ghost" size="sm" className="min-h-11 flex-1 px-2 text-[12px]" disabled={Boolean(busy)} onClick={() => openPicker(role)}>
                  <Upload className="size-3.5" aria-hidden="true" /> {url ? "Replace" : "Add"}
                </Button>
                {url && <Button type="button" variant="ghost" size="icon-sm" className="size-11 text-muted hover:text-danger" disabled={Boolean(busy)} onClick={() => void removePhoto(role)} aria-label={`Remove ${label} photo`}><Trash2 className="size-3.5" aria-hidden="true" /></Button>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-2 rounded-2xl bg-surface-2/70 p-3 text-[12px] leading-relaxed text-muted">
        <CircleHelp className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>Use photos of yourself only. The model preserves identity and clothing details as closely as possible, but a generated preview can still change small features and cannot prove real-world fit.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="surface" onClick={() => void analyze()} disabled={Boolean(busy) || !photos.full_body}>
          {busy === "analyze" ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="size-3.5" aria-hidden="true" />}
          {busy === "analyze" ? "Reading photos…" : "Suggest profile details"}
        </Button>
        <span className="text-[11.5px] text-faint">You review every suggestion before it is saved.</span>
      </div>
      {usage && !usage.features.includes("try_on") && <p className="text-xs text-muted">You can prepare your photos now. AI analysis and previews need try-on enabled for your account.</p>}

      {reviewOpen && suggestions.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-accent/30 bg-accent/5 p-3" aria-live="polite">
          <div>
            <h3 className="text-[13.5px] font-semibold">Review photo suggestions</h3>
            <p className="text-[12px] text-muted">These are hints from your photos, not measurements. Keep only what feels true.</p>
          </div>
          <div className="space-y-2">
            {suggestions.map((suggestion, index) => {
              const checked = selectedSuggestions.has(index);
              return (
                <label key={`${suggestion.field}-${index}`} className="flex cursor-pointer items-start gap-2 rounded-xl bg-surface p-2.5">
                  <input type="checkbox" checked={checked} onChange={() => setSelectedSuggestions((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; })} className="mt-0.5 size-4 accent-accent" />
                  <span className="min-w-0 flex-1"><span className="block text-[12.5px] font-medium">{suggestion.label ?? titleCase(suggestion.field)}: {String(suggestion.value)}</span>{suggestion.rationale && <span className="mt-0.5 block text-[11.5px] text-muted">{suggestion.rationale}</span>}</span>
                </label>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" className="flex-1" disabled={busy === "analyze"} onClick={() => void applySuggestions()}>Apply selected</Button>
            <Button type="button" size="sm" variant="surface" onClick={() => setReviewOpen(false)}>Keep editing</Button>
          </div>
        </div>
      )}

      {!suggestions.length && <p className="text-[12px] text-muted">No automatic details are waiting for review.</p>}
      <Field label="Profile setup checklist">
        <ul className="grid gap-1.5 text-[12px] text-muted sm:grid-cols-2">
          {[
            [Boolean(photos.full_body), "Full-body reference"],
            [Boolean(photos.face), "Face reference"],
            [Boolean(profile.height_cm), "Height saved"],
            [Boolean(profile.build), "Build notes saved"],
            [Boolean(Object.values(profile.sizes ?? {}).some(Boolean)), "Sizes saved"],
            [Boolean(profile.style_keywords.length), "Style preferences saved"],
          ].map(([done, label]) => <li key={String(label)} className="flex items-center gap-2"><span className={cn("grid size-4 place-items-center rounded-full", done ? "bg-accent text-accent-fg" : "bg-surface-2 text-faint")}>{done ? <Check className="size-2.5" aria-hidden="true" /> : <span className="size-1 rounded-full bg-current" aria-hidden="true" />}</span>{label}</li>)}
        </ul>
      </Field>
    </section>
  );
}
