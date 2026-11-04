"use client";
import { CATEGORIES, CATEGORY_LABELS, FITS, FORMALITY_LABELS, MATERIALS, OCCASIONS, PATTERNS, SEASONS, WARMTH_LABELS, type Category } from "@/lib/taxonomy";
import type { ItemInput } from "@/lib/types";
import { ColorSwatches, Field, MultiChips, Scale } from "./attribute-picker";

export type Draft = Pick<
  ItemInput,
  "name" | "category" | "subcategory" | "colors" | "pattern" | "material" | "fit" | "seasons" | "occasions" | "formality" | "warmth" | "brand" | "size" | "notes"
>;

export const emptyDraft: Draft = {
  name: "",
  category: "top",
  subcategory: "t-shirt",
  colors: [],
  pattern: "solid",
  material: null,
  fit: null,
  seasons: [],
  occasions: [],
  formality: 2,
  warmth: 2,
  brand: null,
  size: null,
  notes: null,
};

const input = "h-11 w-full rounded-2xl border border-border bg-surface px-4 text-[15px] outline-none placeholder:text-faint focus:border-border-strong";

export function ItemForm({ value, onChange }: { value: Draft; onChange: (d: Draft) => void }) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...value, [k]: v });
  const cats = Object.keys(CATEGORIES) as Category[];
  return (
    <div className="space-y-5">
      <Field label="Name">
        <input className={input} value={value.name} placeholder="e.g. Grey wool overshirt" onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Category">
        <div className="flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ ...value, category: c, subcategory: CATEGORIES[c][0] })}
              className={`h-8 rounded-full px-3 text-[12.5px] font-medium ${value.category === c ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted"}`}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <MultiChips single options={CATEGORIES[value.category]} value={[value.subcategory]} onChange={([s]) => set("subcategory", s)} />
      </Field>
      <Field label="Colors (dominant first)">
        <ColorSwatches value={value.colors} onChange={(c) => set("colors", c as Draft["colors"])} />
      </Field>
      <Field label="Seasons">
        <MultiChips options={SEASONS} value={value.seasons} onChange={(v) => set("seasons", v)} />
      </Field>
      <Field label="Occasions">
        <MultiChips options={OCCASIONS} value={value.occasions} onChange={(v) => set("occasions", v)} />
      </Field>
      <Field label="Formality">
        <Scale value={value.formality} onChange={(v) => set("formality", v)} labels={FORMALITY_LABELS} />
      </Field>
      <Field label="Warmth">
        <Scale value={value.warmth} onChange={(v) => set("warmth", v)} labels={WARMTH_LABELS} />
      </Field>
      <Field label="Pattern">
        <MultiChips single options={PATTERNS} value={[value.pattern]} onChange={([v]) => set("pattern", v)} />
      </Field>
      <Field label="Material">
        <MultiChips single options={MATERIALS} value={value.material ? [value.material] : []} onChange={([v]) => set("material", v ?? null)} />
      </Field>
      <Field label="Fit">
        <MultiChips single options={FITS} value={value.fit ? [value.fit] : []} onChange={([v]) => set("fit", v ?? null)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Brand">
          <input className={input} value={value.brand ?? ""} placeholder="Optional" onChange={(e) => set("brand", e.target.value || null)} />
        </Field>
        <Field label="Size">
          <input className={input} value={value.size ?? ""} placeholder="M / 32 / 43" onChange={(e) => set("size", e.target.value || null)} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea
          className={`${input} h-auto min-h-20 py-3`}
          value={value.notes ?? ""}
          placeholder="Fits a bit large, dry clean only…"
          onChange={(e) => set("notes", e.target.value || null)}
        />
      </Field>
    </div>
  );
}
