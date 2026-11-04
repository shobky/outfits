"use client";
import { code } from "@streamdown/code";
import { Check, Copy, Link2 } from "lucide-react";
import { memo, useState } from "react";
import { Streamdown } from "streamdown";
import type { DrawerUIMessage } from "@/lib/ai/tools";
import { cn } from "@/lib/utils";
import { AgentSteps, PROCESS_TOOLS, type StepPart } from "./agent-steps";
import { ItemStrip, OutfitCard, QuickReplies, SuggestionCards } from "./tool-views";

type Part = DrawerUIMessage["parts"][number];
type AnyTool = { type: string; toolCallId: string; state: string; input?: unknown; output?: unknown; errorText?: string };

type Block =
  | { kind: "steps"; steps: StepPart[] }
  | { kind: "text"; text: string }
  | { kind: "tool"; part: AnyTool; name: string }
  | { kind: "file"; url: string; mediaType: string }
  | { kind: "source"; url: string; title?: string };

function toBlocks(parts: Part[], streaming: boolean): Block[] {
  const blocks: Block[] = [];
  const pushStep = (s: StepPart) => {
    const last = blocks[blocks.length - 1];
    if (last?.kind === "steps") last.steps.push(s);
    else blocks.push({ kind: "steps", steps: [s] });
  };
  for (const p of parts) {
    if (p.type === "reasoning") pushStep({ kind: "reasoning", text: p.text, streaming: streaming && p.state === "streaming" });
    else if (p.type === "text") {
      if (p.text) blocks.push({ kind: "text", text: p.text });
    }
    else if (p.type === "file") blocks.push({ kind: "file", url: p.url, mediaType: p.mediaType });
    else if (p.type === "source-url") blocks.push({ kind: "source", url: p.url, title: p.title });
    else if (p.type.startsWith("tool-")) {
      const t = p as unknown as AnyTool;
      const name = t.type.slice(5);
      if (PROCESS_TOOLS.has(name)) pushStep({ kind: "tool", name, state: t.state, input: t.input, output: t.output, error: t.errorText });
      else blocks.push({ kind: "tool", part: t, name });
    }
  }
  return blocks;
}

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      aria-label="Copy message"
      onClick={() => navigator.clipboard.writeText(text).then(() => (setOk(true), setTimeout(() => setOk(false), 1500)))}
      className="grid size-7 place-items-center rounded-full text-faint opacity-0 transition-opacity hover:bg-surface-2 hover:text-text group-hover:opacity-100 max-md:opacity-100"
    >
      {ok ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

export const Message = memo(function Message({
  message,
  streaming,
  onAnswer,
}: {
  message: DrawerUIMessage;
  streaming: boolean;
  onAnswer: (toolCallId: string, answer: string) => void;
}) {
  if (message.role === "user") {
    const text = message.parts.filter((p) => p.type === "text").map((p) => p.text).join("\n");
    const files = message.parts.filter((p) => p.type === "file");
    return (
      <div className="flex flex-col items-end gap-2">
        {files.length > 0 && (
          <div className="flex gap-2">
            {files.map((f, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={f.url} alt="" className="size-24 rounded-2xl object-cover" />
            ))}
          </div>
        )}
        {text && <div className="max-w-[85%] whitespace-pre-wrap rounded-[22px] rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-relaxed text-primary-fg">{text}</div>}
      </div>
    );
  }

  const blocks = toBlocks(message.parts, streaming);
  const fullText = message.parts.filter((p) => p.type === "text").map((p) => p.text).join("\n\n");
  const lastIdx = blocks.length - 1;

  return (
    <div className="group flex gap-3">
      <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-fg">D</div>
      <div className="min-w-0 flex-1 space-y-3">
        {blocks.map((b, i) => {
          switch (b.kind) {
            case "steps":
              return <AgentSteps key={i} steps={b.steps} active={streaming && i === lastIdx} />;
            case "text":
              return (
                <Streamdown key={i} plugins={{ code }} isAnimating={streaming && i === lastIdx} className="prose-chat text-[15px] leading-relaxed [&_li]:my-0.5 [&_p]:my-2 [&_strong]:font-semibold">
                  {b.text}
                </Streamdown>
              );
            case "file":
              // eslint-disable-next-line @next/next/no-img-element
              return <img key={i} src={b.url} alt="" className="max-w-xs rounded-2xl" />;
            case "source":
              return (
                <a key={i} href={b.url} target="_blank" rel="noreferrer" className="mr-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11.5px] text-muted hover:text-text">
                  <Link2 className="size-3" /> <span className="truncate">{b.title ?? new URL(b.url).hostname}</span>
                </a>
              );
            case "tool":
              return <ToolBlock key={i} part={b.part} name={b.name} onAnswer={onAnswer} />;
          }
        })}
        {!streaming && fullText && (
          <div className="-ml-1.5 flex">
            <CopyButton text={fullText} />
          </div>
        )}
      </div>
    </div>
  );
});

function ToolBlock({ part, name, onAnswer }: { part: AnyTool; name: string; onAnswer: (id: string, a: string) => void }) {
  const ready = part.state === "output-available";
  if (part.state === "output-error") return <p className="text-sm text-danger">Tool {name} failed: {part.errorText}</p>;

  switch (name) {
    case "ask_user": {
      const input = part.input as { question?: string; options?: string[] } | undefined;
      if (!input?.question) return null;
      return (
        <QuickReplies
          question={input.question}
          options={input.options ?? []}
          answered={(part.output as { answer?: string } | undefined)?.answer}
          onAnswer={(a) => onAnswer(part.toolCallId, a)}
        />
      );
    }
    case "compose_outfit":
      return ready ? <OutfitCard outfit={part.output as Parameters<typeof OutfitCard>[0]["outfit"]} /> : <Skeleton className="aspect-[4/5] max-w-[420px]" label="Laying out the outfit…" />;
    case "show_items":
      return ready ? <ItemStrip {...(part.output as Parameters<typeof ItemStrip>[0])} /> : <Skeleton className="h-44 max-w-md" label="Pulling pieces…" />;
    case "suggest_purchases":
      return ready ? <SuggestionCards items={(part.output as { items: Parameters<typeof SuggestionCards>[0]["items"] }).items} /> : <Skeleton className="h-56 max-w-md" label="Curating suggestions…" />;
    default:
      return null;
  }
}

function Skeleton({ className, label }: { className?: string; label: string }) {
  return (
    <div className={cn("grid w-full animate-pulse place-items-center rounded-[28px] bg-surface-2", className)}>
      <span className="shimmer-text text-[13px] font-medium">{label}</span>
    </div>
  );
}
