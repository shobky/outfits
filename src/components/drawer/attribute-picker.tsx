"use client";
import { COLORS } from "@/lib/taxonomy";
import { cn, titleCase } from "@/lib/utils";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</p>
      {children}
    </div>
  );
}

export function MultiChips<T extends string>({
  options,
  value,
  onChange,
  single,
}: {
  options: readonly T[];
  value: T[];
  onChange: (v: T[]) => void;
  single?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(single ? [o] : on ? value.filter((v) => v !== o) : [...value, o])}
            className={cn(
              "h-8 rounded-full px-3 text-[12.5px] font-medium transition-colors",
              on ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted hover:text-text",
            )}
          >
            {titleCase(o)}
          </button>
        );
      })}
    </div>
  );
}

export function ColorSwatches({ value, onChange, single }: { value: string[]; onChange: (v: string[]) => void; single?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(COLORS).map(([name, hex]) => {
        const on = value.includes(name);
        return (
          <button
            key={name}
            type="button"
            title={titleCase(name)}
            aria-label={titleCase(name)}
            aria-pressed={on}
            onClick={() => onChange(single ? (on ? [] : [name]) : on ? value.filter((v) => v !== name) : [...value, name])}
            className={cn(
              "size-8 rounded-full border border-border-strong transition-transform",
              on && "ring-2 ring-inset ring-text outline-2 outline-offset-[-4px] outline-bg-elevated",
            )}
            style={{ background: hex }}
          />
        );
      })}
    </div>
  );
}

export function Scale({ value, onChange, labels }: { value: number; onChange: (v: number) => void; labels: readonly string[] }) {
  return (
    <div className="flex gap-1 rounded-full bg-surface-2 p-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cn("h-8 flex-1 rounded-full text-[11.5px] font-medium", value === n ? "bg-surface text-text shadow-soft" : "text-muted")}
        >
          {labels[n]}
        </button>
      ))}
    </div>
  );
}
