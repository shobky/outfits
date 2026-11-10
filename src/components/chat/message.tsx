"use client";
import { code } from "@streamdown/code";
import { Check, Copy, Link2 } from "lucide-react";
import { memo, useState } from "react";
import { Streamdown } from "streamdown";
import { BrandMark } from "@/components/brand-mark";
import { stripCitationMarkers } from "@/lib/ai/citations";
import type { DrawerUIMessage } from "@/lib/ai/tools";
import { cn } from "@/lib/utils";
import { AgentSteps, PROCESS_TOOLS, type StepPart } from "./agent-steps";
import { ItemStrip, OutfitCard, ProductCheckCard, QuickReplies, SuggestionCards, TryOnSuggestion, WeatherCard, type OutfitResult, type ProductCheckResult, type WeatherResult } from "./tool-views";

type Part = DrawerUIMessage["parts"][number];
type AnyTool = { type: string; toolCallId: string; state: string; input?: unknown; output?: unknown; errorText?: string };

type Block =
  | { kind: "steps"; steps: StepPart[] }
  | { kind: "text"; text: string }
  | { kind: "tool"; part: AnyTool; name: string }
  | { kind: "weather"; weather: WeatherResult }
  | { kind: "file"; url: string; mediaType: string }
  | { kind: "source"; url: string; title?: string };

function toBlocks(parts: Part[], streaming: boolean): Block[] {
  const blocks: Block[] = [];
  // Weather stays in the steps drawer and also shows as a card right after that group of steps.
  let waiting: WeatherResult[] = [];
  const flushWeather = () => {
    waiting.forEach((weather) => blocks.push({ kind: "weather", weather }));
    waiting = [];
  };
  const pushStep = (s: StepPart) => {
    const last = blocks[blocks.length - 1];
    if (last?.kind === "steps") last.steps.push(s);
    else blocks.push({ kind: "steps", steps: [s] });
  };
  for (const p of parts) {
    const isStep = p.type === "reasoning" || (p.type.startsWith("tool-") && PROCESS_TOOLS.has(p.type.slice(5)));
    if (!isStep && (p.type !== "text" || p.text)) flushWeather();
    if (p.type === "reasoning") pushStep({ kind: "reasoning", text: p.text, streaming: streaming && p.state === "streaming" });
    else if (p.type === "text") {
      const text = stripCitationMarkers(p.text);
      if (text) blocks.push({ kind: "text", text });
    }
    else if (p.type === "file") blocks.push({ kind: "file", url: p.url, mediaType: p.mediaType });
    else if (p.type === "source-url") blocks.push({ kind: "source", url: p.url, title: p.title });
    else if (p.type.startsWith("tool-")) {
      const t = p as unknown as AnyTool;
      const name = t.type.slice(5);
      if (PROCESS_TOOLS.has(name)) {
        pushStep({ kind: "tool", name, state: t.state, input: t.input, output: t.output, error: t.errorText });
        const w = t.output as WeatherResult | { error: string } | undefined;
        if (name === "get_weather" && t.state === "output-available" && w && !("error" in w)) waiting.push(w);
      } else blocks.push({ kind: "tool", part: t, name });
    }
  }
  flushWeather();
  return blocks;
}

/** Outfits offered together sit side by side instead of pushing the answer off screen. */
function isOutfit(b: Block | undefined) {
  return b?.kind === "tool" && b.name === "compose_outfit";
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
  const fullText = message.parts.filter((p) => p.type === "text").map((p) => stripCitationMarkers(p.text)).join("\n\n");
  const lastIdx = blocks.length - 1;

  return (
    <div className="group flex gap-3">
      <BrandMark size={28} className="mt-0.5" />
      <div className="min-w-0 flex-1 space-y-3">
        {blocks.map((b, i) => {
          if (isOutfit(b)) {
            if (isOutfit(blocks[i - 1])) return null; // already drawn with the first of its group
            let end = i;
            while (isOutfit(blocks[end + 1])) end++;
            const group = blocks.slice(i, end + 1) as Extract<Block, { kind: "tool" }>[];
            if (group.length === 1) return <ToolBlock key={i} part={group[0].part} name={group[0].name} onAnswer={onAnswer} />;
            return (
              <div key={i} className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
                {group.map((g) => (
                  <div key={g.part.toolCallId} className="w-[86%] max-w-[420px] shrink-0 snap-start">
                    <ToolBlock part={g.part} name={g.name} onAnswer={onAnswer} />
                  </div>
                ))}
              </div>
            );
          }
          switch (b.kind) {
            case "steps":
              return <AgentSteps key={i} steps={b.steps} active={streaming && i === lastIdx} />;
            case "weather":
              return <WeatherCard key={i} weather={b.weather} />;
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
      return ready ? <OutfitCard outfit={part.output as OutfitResult} /> : <Skeleton className="aspect-[4/5] max-w-[420px]" label="Laying out the outfit…" />;
    case "suggest_try_on":
      return ready ? <TryOnSuggestion {...(part.output as Parameters<typeof TryOnSuggestion>[0])} /> : <Skeleton className="h-44 max-w-md" label="Preparing your fitting room…" />;
    case "check_product":
      return ready ? <ProductCheckCard product={part.output as ProductCheckResult} /> : <Skeleton className="h-24 max-w-[420px]" label="Reading the product page…" />;
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
