"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { ArrowLeft, Moon, PanelLeft, Plus, Sun, Trash2 } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { Sheet } from "@/components/ui/sheet";
import { ChatAllowanceNote, chatIsOut, ChatRestCard, refreshUsage, useUsage } from "@/components/usage/usage";
import { DEFAULT_MODEL_ID } from "@/lib/ai/models";
import type { DrawerUIMessage } from "@/lib/ai/tools";
import { ManageUsage } from "@/components/chatgpt";
import { USAGE_LIMIT_MESSAGE } from "@/lib/chatgpt/shared";
import { useProfile } from "@/lib/hooks";
import type { ChatSession } from "@/lib/types";
import { api, cn, fetcher } from "@/lib/utils";
import { toolLabel } from "./agent-steps";
import { Composer } from "./composer";
import { Message } from "./message";

const SUGGESTIONS = [
  { title: "What should I wear today?", sub: "Weather-aware, from your drawer" },
  { title: "Dinner date tonight — style me", sub: "Smart casual, one point of interest" },
  { title: "What's missing from my wardrobe?", sub: "Gap analysis + shopping ideas" },
  { title: "Pack for 4 days in Paris next week", sub: "Capsule from what you own" },
];

function readModel() {
  try {
    return localStorage.getItem("outfits:model") ?? DEFAULT_MODEL_ID;
  } catch {
    return DEFAULT_MODEL_ID;
  }
}

export function StylistView() {
  const params = useSearchParams();
  const router = useRouter();
  const [chatId, setChatId] = useState<string>(() => params.get("c") ?? crypto.randomUUID());
  const [initial, setInitial] = useState<DrawerUIMessage[] | null>(params.get("c") ? null : []);
  const [desktopSidebar, setDesktopSidebar] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const { data: chats } = useSWR<{ chats: ChatSession[] }>("/api/chats", fetcher);
  const { data: profile } = useProfile();
  const [model, setModel] = useState(readModel);

  useEffect(() => {
    const c = params.get("c");
    if (c && c !== chatId) open(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    if (initial === null) {
      fetch(`/api/chats/${chatId}`)
        .then((r) => r.json())
        .then((d: { messages: DrawerUIMessage[] }) => setInitial(d.messages ?? []));
    }
  }, [chatId, initial]);

  function open(id: string) {
    setChatId(id);
    setInitial(null);
    setMobileSidebar(false);
  }
  function newChat() {
    setChatId(crypto.randomUUID());
    setInitial([]);
    setMobileSidebar(false);
    router.replace("/stylist");
  }

  const sidebar = (
    <ChatList
      chats={chats?.chats ?? []}
      activeId={chatId}
      onOpen={(id) => (open(id), router.replace(`/stylist?c=${id}`))}
      onNew={newChat}
      onDelete={async (id) => {
        await api(`/api/chats/${id}`, "DELETE");
        mutate("/api/chats");
        if (id === chatId) newChat();
      }}
    />
  );

  return (
    <div className="flex h-dvh">
      <aside className={cn("pt-safe hidden shrink-0 overflow-hidden border-r border-border bg-bg-elevated transition-[width] duration-300 md:block", desktopSidebar ? "w-[280px]" : "w-0 border-r-0")}>
        <div className="h-full w-[280px]">{sidebar}</div>
      </aside>
      <Sheet open={mobileSidebar} onOpenChange={setMobileSidebar} title="Chats" side="left">
        {sidebar}
      </Sheet>

      {initial === null ? (
        <div className="flex-1" />
      ) : (
        <Conversation
          key={chatId}
          chatId={chatId}
          initial={initial}
          model={model}
          aiReady={profile?.ai ?? false}
          onModel={(m) => {
            setModel(m);
            try {
              localStorage.setItem("outfits:model", m);
            } catch {}
          }}
          onToggleSidebar={() => (window.matchMedia("(min-width: 768px)").matches ? setDesktopSidebar((s) => !s) : setMobileSidebar(true))}
          autoPrompt={params.get("q")}
          onNewChat={newChat}
        />
      )}
    </div>
  );
}

function Conversation({
  chatId,
  initial,
  model,
  onModel,
  aiReady,
  onToggleSidebar,
  autoPrompt,
  onNewChat,
}: {
  chatId: string;
  initial: DrawerUIMessage[];
  model: string;
  onModel: (m: string) => void;
  aiReady: boolean;
  onToggleSidebar: () => void;
  autoPrompt: string | null;
  onNewChat: () => void;
}) {
  // model is read from localStorage at send time so auto-continued
  // requests (after ask_user answers) always use the current pick
  const transport = useMemo(
    () =>
      new DefaultChatTransport<DrawerUIMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: { id, messages, model: readModel(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        }),
      }),
    [],
  );
  const { messages, sendMessage, status, stop, addToolOutput, error, regenerate } = useChat<DrawerUIMessage>({
    id: chatId,
    messages: initial,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onFinish: () => (mutate("/api/chats"), refreshUsage()),
    onError: () => refreshUsage(),
  });
  const { data: usage } = useUsage();
  const outOfMessages = chatIsOut(usage, model);

  const sent = useRef(false);
  const router = useRouter();
  useEffect(() => {
    if (autoPrompt && !sent.current && initial.length === 0) {
      sent.current = true;
      sendMessage({ text: autoPrompt });
      router.replace(`/stylist?c=${chatId}`);
    }
  }, [autoPrompt, chatId, initial.length, router, sendMessage]);

  // stick to bottom while streaming, unless the user scrolled up
  const scroller = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);
  useEffect(() => {
    const el = scroller.current;
    if (el && stuck.current) el.scrollTo({ top: el.scrollHeight, behavior: status === "streaming" ? "auto" : "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";
  const agentState = useAgentState(messages, status);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="pt-safe shrink-0 md:px-2">
        <div className="flex h-14 items-center gap-1 px-2 md:h-16 md:px-2">
        <Link href="/" className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text md:hidden" aria-label="Back to drawer">
          <ArrowLeft className="size-5" />
        </Link>
        <button onClick={onToggleSidebar} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label="Toggle chat history">
          <PanelLeft className="size-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <StatusPill state={agentState} />
        </div>
        <ThemeToggle />
        <button onClick={onNewChat} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label="New chat">
          <Plus className="size-5" />
        </button>
        </div>
      </header>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-[760px] space-y-7 px-4 pb-6 pt-2">
          {messages.length === 0 ? (
            <EmptyState onPick={(t) => sendMessage({ text: t })} />
          ) : (
            messages.map((m, i) => (
              <Message
                key={m.id}
                message={m}
                streaming={busy && i === messages.length - 1 && m.role === "assistant"}
                onAnswer={(toolCallId, answer) => addToolOutput({ tool: "ask_user", toolCallId, output: { answer } })}
              />
            ))
          )}
          {status === "submitted" && messages[messages.length - 1]?.role === "user" && (
            <div className="flex items-center gap-3">
              <BrandMark size={28} />
              <span className="shimmer-text text-[14px]">Thinking…</span>
            </div>
          )}
          {error && !error.message.includes("chat_limit") && (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
              <span>{friendlyError(error.message)}</span>
              {error.message === USAGE_LIMIT_MESSAGE ? (
                <ManageUsage className="shrink-0" />
              ) : (
                <button onClick={() => regenerate()} className="font-medium underline">
                  Retry
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[760px] shrink-0 px-3 pb-[max(calc(env(safe-area-inset-bottom)-0.75rem),0px)] pt-2 md:px-4">
        {outOfMessages && usage ? (
          <ChatRestCard usage={usage} />
        ) : (
          <>
            <ChatAllowanceNote usage={usage} model={model} />
            <Composer
              busy={busy}
              onStop={stop}
              model={model}
              onModel={onModel}
              aiReady={aiReady}
              developer={usage?.developer}
              autoFocus={messages.length === 0}
              onSend={(text, files) => sendMessage({ text, files })}
            />
          </>
        )}
        <p className="py-1.5 text-center text-[11px] text-faint">Outfits styles from what you own. It can make mistakes.</p>
      </div>
    </div>
  );
}

/** The server's errors arrive as a JSON string. */
function friendlyError(raw: string) {
  try {
    return (JSON.parse(raw) as { error?: string }).error ?? "Something went wrong.";
  } catch {
    return raw || "Something went wrong.";
  }
}

type AgentState = { label: string; tone: "idle" | "busy" | "done" | "error" };

function useAgentState(messages: DrawerUIMessage[], status: string): AgentState {
  if (status === "error") return { label: "Error", tone: "error" };
  if (status === "submitted") return { label: "Thinking…", tone: "busy" };
  if (status === "streaming") {
    const last = messages[messages.length - 1];
    const p = last?.parts[last.parts.length - 1];
    if (!p) return { label: "Thinking…", tone: "busy" };
    if (p.type === "reasoning") return { label: "Thinking…", tone: "busy" };
    if (p.type.startsWith("tool-")) {
      const name = p.type.slice(5);
      return { label: `Calling tool: ${name}`, tone: "busy" };
    }
    if (p.type === "text") return { label: "Writing…", tone: "busy" };
    return { label: "Working…", tone: "busy" };
  }
  const last = messages[messages.length - 1];
  const waiting = last?.parts.some((p) => p.type === "tool-ask_user" && p.state === "input-available");
  if (waiting) return { label: "Waiting for you", tone: "idle" };
  return messages.length ? { label: "Done", tone: "done" } : { label: "Stylist · ready", tone: "idle" };
}

function StatusPill({ state }: { state: AgentState }) {
  return (
    <div className="flex max-w-full items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[12.5px] font-medium" aria-live="polite">
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          state.tone === "busy" && "animate-pulse bg-accent",
          state.tone === "done" && "bg-accent",
          state.tone === "idle" && "bg-faint",
          state.tone === "error" && "bg-danger",
        )}
      />
      <span className={cn("truncate", state.tone === "busy" && "shimmer-text")} title={state.label}>
        {state.label.startsWith("Calling tool: ") ? `${toolLabel(state.label.slice(14))}…` : state.label}
      </span>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="flex min-h-[55dvh] flex-col justify-end gap-6 pt-10">
      <div className="space-y-2">
        <BrandMark size={44} />
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight md:text-[34px]">
          Hey — what are we
          <br />
          dressing for today?
        </h1>
        <p className="text-[15px] text-muted">I know every piece in your drawer, the weather, and the dress code.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button key={s.title} onClick={() => onPick(s.title)} className="rounded-3xl border border-border bg-surface px-4 py-3.5 text-left transition-colors hover:bg-surface-2 active:scale-[0.99]">
            <p className="text-[14px] font-medium">{s.title}</p>
            <p className="text-[12.5px] text-muted">{s.sub}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatList({
  chats,
  activeId,
  onOpen,
  onNew,
  onDelete,
}: {
  chats: ChatSession[];
  activeId: string;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  const today = new Date().toDateString();
  const groups = [
    { label: "Today", items: chats.filter((c) => new Date(c.updated_at).toDateString() === today) },
    { label: "Earlier", items: chats.filter((c) => new Date(c.updated_at).toDateString() !== today) },
  ].filter((g) => g.items.length);
  return (
    <div className="flex h-full flex-col gap-3 p-3 md:pt-4">
      <div className="hidden items-center gap-2 px-2 md:flex">
        <Link href="/" className="grid size-8 place-items-center rounded-xl" aria-label="Outfits home">
          <BrandMark size={32} />
        </Link>
        <span className="font-semibold tracking-tight">Stylist</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted">
          <span className="size-1.5 rounded-full bg-accent" /> online
        </span>
      </div>
      <button onClick={onNew} className="flex h-11 items-center justify-center gap-2 rounded-full bg-primary text-sm font-medium text-primary-fg active:scale-[0.98]">
        <Plus className="size-4" /> New chat
      </button>
      <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
        {groups.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-faint">No chats yet</p>}
        {groups.map((g) => (
          <div key={g.label} className="space-y-0.5">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">{g.label}</p>
            {g.items.map((c) => (
              <div key={c.id} className={cn("group flex items-center rounded-2xl", c.id === activeId ? "bg-surface-2" : "hover:bg-surface-2/60")}>
                <button onClick={() => onOpen(c.id)} className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-[13.5px]">
                  {c.title}
                </button>
                <button onClick={() => onDelete(c.id)} className="mr-1 grid size-7 place-items-center rounded-full text-faint opacity-0 hover:text-danger group-hover:opacity-100" aria-label="Delete chat">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn("grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text", className)}
      aria-label="Toggle theme"
    >
      <Sun className="hidden size-[18px] dark:block" />
      <Moon className="size-[18px] dark:hidden" />
    </button>
  );
}
