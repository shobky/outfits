import type { ReactNode } from "react";

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-6 py-20 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">{icon}</div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted">{body}</p>
      {action}
    </div>
  );
}
