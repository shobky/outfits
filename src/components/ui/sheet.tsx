"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Bottom sheet on mobile, centered panel on desktop. */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  side = "bottom",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
  side?: "bottom" | "left";
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex flex-col bg-bg-elevated text-text shadow-2xl outline-none",
            side === "bottom" &&
              "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[28px] md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[86dvh] md:w-[min(560px,92vw)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[28px]",
            side === "left" && "pt-safe inset-y-0 left-0 w-[86vw] max-w-[320px] rounded-r-[28px]",
            className,
          )}
        >
          {side === "bottom" && <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border-strong md:hidden" />}
          <div className="flex items-center justify-between px-5 pb-2 pt-4">
            <Dialog.Title className="text-[17px] font-semibold tracking-tight">{title}</Dialog.Title>
            <Dialog.Close className="grid size-8 place-items-center rounded-full bg-surface-2 text-muted hover:text-text" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-safe pt-1">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
