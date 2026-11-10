"use client";
import { BookOpen, Brain, CheckCircle2, ChevronDown, CloudSun, Globe, Loader2, PieChart, Search, UserRound, XCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type StepPart =
  | { kind: "reasoning"; text: string; streaming: boolean }
  | { kind: "tool"; name: string; state: string; input: unknown; output: unknown; error?: string };

const TOOL_META: Record<string, { label: string; icon: typeof Search; summary?: (input: unknown, output: unknown) => string }> = {
  load_skill: { label: "Loading skill", icon: BookOpen, summary: (i) => String((i as { name?: string })?.name ?? "") },
  get_weather: {
    label: "Checking weather",
    icon: CloudSun,
    summary: (_i, o) => {
      const w = o as { location?: string; temp_c?: number; condition?: string; error?: string } | undefined;
      return w?.error ?? (w?.temp_c !== undefined ? `${w.location} · ${w.temp_c}°C · ${w.condition}` : "");
    },
  },
  search_wardrobe: {
    label: "Searching wardrobe",
    icon: Search,
    summary: (i, o) => {
      const f = Object.entries((i as object) ?? {}).map(([k, v]) => `${k}: ${v}`).join(", ");
      const c = (o as { count?: number })?.count;
      return [f, c !== undefined ? `${c} pieces` : ""].filter(Boolean).join(" → ");
    },
  },
  wardrobe_stats: { label: "Analysing closet", icon: PieChart, summary: (_i, o) => ((o as { total?: number })?.total !== undefined ? `${(o as { total: number }).total} pieces` : "") },
  get_profile: { label: "Reading your profile", icon: UserRound },
  update_profile: { label: "Updating your profile", icon: UserRound, summary: (_i, o) => ((o as { saved?: string[] })?.saved ?? []).join(", ") },
  web_search: { label: "Searching the web", icon: Globe, summary: (i) => String((i as { query?: string })?.query ?? "") },
  search_products: { label: "Searching stores", icon: Search, summary: (i) => String((i as { query?: string })?.query ?? "") },
};

export const PROCESS_TOOLS = new Set(Object.keys(TOOL_META));

export function toolLabel(name: string) {
  if (name === "check_product") return "Reading the product page";
  return TOOL_META[name]?.label ?? name.replace(/_/g, " ");
}

/** Collapsible "Agent thought / tool execution" drawer. */
export function AgentSteps({ steps, active }: { steps: StepPart[]; active: boolean }) {
  const [open, setOpen] = useState(false);
  const last = steps[steps.length - 1];
  const headline = active
    ? last?.kind === "reasoning"
      ? "Thinking…"
      : last
        ? `${toolLabel(last.name)}…`
        : "Working…"
    : (() => {
        const n = steps.filter((s) => s.kind === "tool").length;
        return n ? `${n} step${n > 1 ? "s" : ""} · done` : "Thought process";
      })();

  return (
    <div className="w-full">
      <button onClick={() => setOpen(!open)} className="group flex items-center gap-2 rounded-full py-1 pr-2 text-[13px] text-muted hover:text-text">
        {active ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5 text-accent" />}
        <span className={cn(active && "shimmer-text")}>{headline}</span>
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ol className="mt-1.5 space-y-0.5 border-l border-border pl-4 animate-in fade-in slide-in-from-top-1">
          {steps.map((s, i) => (
            <li key={i} className="relative py-1.5 text-[13px]">
              <span className="absolute -left-[21px] top-2.5 size-2 rounded-full bg-border-strong" />
              {s.kind === "reasoning" ? (
                <div className="flex gap-2 text-muted">
                  <Brain className="mt-0.5 size-3.5 shrink-0" />
                  <p className="whitespace-pre-wrap italic">{s.text || "…"}</p>
                </div>
              ) : (
                <ToolRow step={s} />
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ToolRow({ step }: { step: Extract<StepPart, { kind: "tool" }> }) {
  const [raw, setRaw] = useState(false);
  const meta = TOOL_META[step.name];
  const Icon = meta?.icon ?? Search;
  const running = step.state === "input-streaming" || step.state === "input-available";
  const failed = step.state === "output-error";
  const summary = meta?.summary?.(step.input, step.output);
  return (
    <div>
      <button onClick={() => setRaw(!raw)} className="flex w-full items-start gap-2 text-left">
        <Icon className="mt-0.5 size-3.5 shrink-0 text-muted" />
        <span className="font-medium">{meta?.label ?? step.name}</span>
        <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-faint">{step.name}</code>
        <span className="ml-auto shrink-0">
          {running ? <Loader2 className="size-3.5 animate-spin text-muted" /> : failed ? <XCircle className="size-3.5 text-danger" /> : <CheckCircle2 className="size-3.5 text-muted" />}
        </span>
      </button>
      {summary && <p className="ml-5.5 mt-0.5 line-clamp-2 text-[12px] text-muted">{summary}</p>}
      {failed && <p className="ml-5.5 text-[12px] text-danger">{step.error}</p>}
      {raw && (
        <pre className="ml-5.5 mt-1.5 max-h-60 overflow-auto rounded-xl bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-muted">
          {JSON.stringify({ input: step.input, output: step.output }, null, 2)}
        </pre>
      )}
    </div>
  );
}
