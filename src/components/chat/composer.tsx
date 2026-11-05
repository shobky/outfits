"use client";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowUp, Check, ChevronDown, Paperclip, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChatGPTMark, ManageUsage, useChatGPT } from "@/components/chatgpt";
import { MODELS, type ModelOption } from "@/lib/ai/models";
import { cn } from "@/lib/utils";

export function Composer({
  onSend,
  onStop,
  busy,
  model,
  onModel,
  aiReady,
  autoFocus,
  developer,
}: {
  onSend: (text: string, files?: FileList) => void;
  onStop: () => void;
  busy: boolean;
  model: string;
  onModel: (id: string) => void;
  aiReady: boolean;
  autoFocus?: boolean;
  developer?: boolean;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FileList | undefined>();
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [text]);

  const submit = () => {
    if (busy || (!text.trim() && !files?.length)) return;
    onSend(text.trim(), files);
    setText("");
    setFiles(undefined);
    if (fileRef.current) fileRef.current.value = "";
  };

  const { data: chatgpt } = useChatGPT();
  const onPlan = !!chatgpt?.sharing;
  // A plan offers what the account can use, not the API's list.
  const options: ModelOption[] = onPlan && chatgpt.models.length ? [...chatgpt.models.map((m) => ({ ...m, provider: "openai" as const, hint: "On your ChatGPT plan" })), MODELS.find((m) => m.provider === "demo")!] : MODELS.filter((m) => developer || !m.developerOnly);
  const current = options.find((m) => m.id === model) ?? options[0];
  const previews = files ? [...files].map((f) => URL.createObjectURL(f)) : [];

  return (
    <div className="rounded-[28px] border border-border-strong bg-surface p-2 shadow-soft transition-colors focus-within:border-faint/60">
      {previews.length > 0 && (
        <div className="flex gap-2 px-2 pb-2 pt-1">
          {previews.map((src, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="size-16 rounded-2xl object-cover" />
              <button onClick={() => setFiles(undefined)} className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-primary text-primary-fg" aria-label="Remove attachment">
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <textarea
        ref={ta}
        rows={1}
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="What are we dressing for?"
        className="block max-h-[200px] w-full resize-none bg-transparent px-3 pb-1 pt-2 text-[15.5px] leading-relaxed outline-none placeholder:text-faint"
      />
      <div className="flex items-center gap-1.5 pt-1">
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => setFiles(e.target.files ?? undefined)} />
        <button onClick={() => fileRef.current?.click()} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label="Attach image">
          <Paperclip className="size-[18px]" />
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="flex h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[12.5px] font-medium text-muted outline-none hover:text-text">
            <span className={cn("size-1.5 rounded-full", current.provider === "demo" || !aiReady ? "bg-amber-400" : "bg-accent")} />
            {aiReady || current.provider === "demo" ? current.label : `${current.label} (demo)`}
            <ChevronDown className="size-3.5" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content side="top" align="start" sideOffset={8} className="z-50 min-w-60 rounded-2xl border border-border bg-bg-elevated p-1.5 shadow-2xl animate-in fade-in zoom-in-95">
              {options.map((m) => (
                <DropdownMenu.Item key={m.id} onSelect={() => onModel(m.id)} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 outline-none data-[highlighted]:bg-surface-2">
                  <div className="flex-1">
                    <p className="text-[13.5px] font-medium">{m.label}</p>
                    <p className="text-[11.5px] text-muted">{m.provider === "openai" && !aiReady ? "Needs OPENAI_API_KEY — runs as demo" : m.hint}</p>
                  </div>
                  {m.id === model && <Check className="size-4" />}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {onPlan ? (
          <span className="ml-auto flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted">
            <ChatGPTMark className="size-3.5" />
            <span className="hidden sm:inline">Using ChatGPT plan ·</span>
            <ManageUsage className="whitespace-nowrap font-normal" />
          </span>
        ) : (
          <span className="ml-auto hidden text-[11px] text-faint md:block">↵ send · ⇧↵ newline</span>
        )}
        {busy ? (
          <button onClick={onStop} className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-fg", onPlan ? "ml-2" : "ml-auto md:ml-2")} aria-label="Stop">
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!text.trim() && !files?.length}
            className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-fg transition-opacity disabled:opacity-25", onPlan ? "ml-2" : "ml-auto md:ml-2")}
            aria-label="Send"
          >
            <ArrowUp className="size-[18px]" strokeWidth={2.4} />
          </button>
        )}
      </div>
    </div>
  );
}
