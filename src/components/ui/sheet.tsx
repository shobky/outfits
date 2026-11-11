"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Dragged this far, or flicked this fast, the sheet closes. Otherwise it springs back. */
const CLOSE_DISTANCE_PX = 110;
const CLOSE_VELOCITY_PX_MS = 0.6;

function useDragToClose(onClose: () => void) {
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; lastY: number; lastT: number; velocity: number } | null>(null);

  const place = (y: number, animate: boolean) => {
    const el = panel.current;
    if (!el) return;
    el.style.transition = animate ? "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)" : "none";
    el.style.transform = y ? `translateY(${y}px)` : "";
  };

  return {
    panel,
    handlers: {
      onPointerDown(e: PointerEvent<HTMLDivElement>) {
        // Desktop shows a centred panel, and buttons in the header must keep working.
        if (window.matchMedia("(min-width: 768px)").matches || (e.target as HTMLElement).closest("button")) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, velocity: 0 };
      },
      onPointerMove(e: PointerEvent<HTMLDivElement>) {
        const d = drag.current;
        if (!d) return;
        const dt = e.timeStamp - d.lastT;
        if (dt > 0) d.velocity = (e.clientY - d.lastY) / dt;
        d.lastY = e.clientY;
        d.lastT = e.timeStamp;
        place(Math.max(0, e.clientY - d.startY), false);
      },
      onPointerUp(e: PointerEvent<HTMLDivElement>) {
        const d = drag.current;
        if (!d) return;
        drag.current = null;
        const moved = e.clientY - d.startY;
        if (moved > CLOSE_DISTANCE_PX || (moved > 20 && d.velocity > CLOSE_VELOCITY_PX_MS)) onClose();
        else place(0, true);
      },
      onPointerCancel() {
        drag.current = null;
        place(0, true);
      },
    },
  };
}

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
  const { panel, handlers } = useDragToClose(() => onOpenChange(false));
  const draggable = side === "bottom";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          ref={panel}
          // A toast sits outside the dialog, and touching one shouldn't close the sheet underneath.
          onInteractOutside={(e) => {
            if ((e.target as HTMLElement | null)?.closest?.("[data-sonner-toaster]")) e.preventDefault();
          }}
          className={cn(
            "fixed z-50 flex flex-col bg-bg-elevated text-text shadow-2xl outline-none",
            side === "bottom" &&
              "inset-x-0 bottom-0 max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] rounded-t-[28px] md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[86dvh] md:w-[min(560px,92vw)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[28px]",
            side === "left" && "pt-safe inset-y-0 left-0 w-[86vw] max-w-[320px] rounded-r-[28px]",
            className,
          )}
        >
          <div {...(draggable ? handlers : {})} data-testid={draggable ? "sheet-drag" : undefined} className={cn("shrink-0", draggable && "touch-none select-none md:touch-auto md:select-auto")}>
            {draggable && (
              <div className="py-2.5 md:hidden">
                <div className="mx-auto h-1 w-10 rounded-full bg-border-strong" />
              </div>
            )}
            <div className={cn("flex items-center justify-between px-5 pb-2", draggable ? "pt-1.5 md:pt-4" : "pt-4")}>
              <Dialog.Title className="text-[17px] font-semibold tracking-tight">{title}</Dialog.Title>
              <Dialog.Close className="grid size-11 place-items-center rounded-full bg-surface-2 text-muted hover:text-text" aria-label="Close">
                <X className="size-4" />
              </Dialog.Close>
            </div>
          </div>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-safe pt-1">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
