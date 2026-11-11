import type { ReactNode } from "react";

export function PageHeader({ title, left, right, sub }: { title: string; left?: ReactNode; right?: ReactNode; sub?: ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-30 bg-bg/80 backdrop-blur-xl">
      <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 md:px-8">
        <div className="flex justify-start">{left}</div>
        <h1 className="font-display text-[27px] leading-none md:text-[30px]">{title}</h1>
        <div className="flex justify-end">{right}</div>
      </div>
      {sub && <div className="px-4 pb-3 md:px-8">{sub}</div>}
    </header>
  );
}
