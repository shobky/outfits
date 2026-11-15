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
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors active:scale-[0.97]",
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
  return <div className={cn("no-scrollbar flex min-w-0 gap-2 overflow-x-auto", className)}>{children}</div>;
}
