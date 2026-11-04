import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Chip({
  active,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors active:scale-[0.97]",
        active ? "bg-primary text-primary-fg" : "bg-surface-2 text-text hover:bg-border-strong/40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0", className)}>{children}</div>;
}
