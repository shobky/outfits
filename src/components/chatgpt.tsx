"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { MANAGE_USAGE_URL, type ChatGPTStatus } from "@/lib/chatgpt/shared";
import { cn, fetcher } from "@/lib/utils";

export function useChatGPT() {
  return useSWR<ChatGPTStatus>("/auth/chatgpt/status", fetcher, { revalidateOnFocus: false });
}

/** OpenAI's mark. A mask, so it always takes the text colour of the button it's in. */
export function ChatGPTMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-[21px] shrink-0 bg-current", className)}
      style={{ mask: "url(/brand/chatgpt.svg) center / contain no-repeat", WebkitMask: "url(/brand/chatgpt.svg) center / contain no-repeat" }}
    />
  );
}

/** OpenAI's approved button: its wording and mark, in black or white only. A plain link because the server starts the flow. */
export function ChatGPTButton({ className, account }: { className?: string; account?: "new" }) {
  return (
    <a
      href={`/auth/chatgpt/start${account ? `?account=${account}` : ""}`}
      data-oai-siwc-button=""
      className={cn(
        "flex h-13 w-full items-center justify-center gap-2.5 rounded-full bg-black text-[15px] font-medium text-white transition-[opacity,transform] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-[0.97] dark:bg-white dark:text-black",
        className,
      )}
    >
      <ChatGPTMark />
      Continue with ChatGPT
    </a>
  );
}

export function ManageUsage({ className }: { className?: string }) {
  return (
    <a href={MANAGE_USAGE_URL} target="_blank" rel="noreferrer" className={cn("font-medium underline underline-offset-2", className)}>
      Manage usage
    </a>
  );
}

/** Shown once, straight after the first sign-in with a ChatGPT account. */
export function ChatGPTWelcome() {
  const params = useSearchParams();
  const router = useRouter();
  const open = params.get("chatgpt") === "welcome";
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && router.replace("/")}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-[28px] bg-bg-elevated p-7">
          <ChatGPTMark className="size-8" />
          <Dialog.Title className="text-xl font-semibold tracking-tight">You&apos;re using your ChatGPT plan</Dialog.Title>
          <Dialog.Description className="text-sm leading-relaxed text-muted">
            Eligible AI requests in Outfits use your plan. You can manage your usage in ChatGPT settings.
          </Dialog.Description>
          <Dialog.Close asChild>
            <Button size="lg" className="w-full">Got it</Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
