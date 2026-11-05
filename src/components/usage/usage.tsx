"use client";
import { FlaskConical, Moon, Shirt } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";
import { timeUntil, WARN_AT, type Usage, type UsageAllowance } from "@/lib/usage-rules";
import { api, cn, fetcher } from "@/lib/utils";

export function useUsage() {
  return useSWR<Usage>("/api/usage", fetcher, { revalidateOnFocus: true });
}

export const refreshUsage = () => mutate("/api/usage");

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Whether this model and these numbers mean the stylist has to wait. */
export function chatIsOut(usage: Usage | undefined, model: string) {
  if (!usage?.chat || usage.limitsOff || model === "demo") return false;
  return usage.chat.used >= usage.chat.limit;
}

/** Sits above the composer once only a few messages are left. */
export function ChatAllowanceNote({ usage, model }: { usage: Usage | undefined; model: string }) {
  if (!usage?.chat || usage.limitsOff || model === "demo") return null;
  const left = usage.chat.limit - usage.chat.used;
  if (left > WARN_AT || left <= 0) return null;
  return (
    <p className="mb-2 text-center text-[12.5px] text-muted">
      {left} message{left === 1 ? "" : "s"} left today. More at {clock(usage.chat.resetsAt)}.
    </p>
  );
}

/** Takes the composer's place when the day's messages are used up. */
export function ChatRestCard({ usage }: { usage: Usage }) {
  const chat = usage.chat!;
  return (
    <div className="flex flex-col items-center gap-3 rounded-[28px] border border-border bg-surface px-5 py-5 text-center">
      <div className="grid size-11 place-items-center rounded-2xl bg-surface-2">
        <Moon className="size-5 text-muted" />
      </div>
      <div className="space-y-1">
        <p className="text-[15px] font-semibold tracking-tight">That&apos;s today&apos;s styling done</p>
        <p className="text-[13px] text-muted">
          You&apos;ve used all {chat.limit} messages. Your stylist is back at {clock(chat.resetsAt)}, {timeUntil(chat.resetsAt)}.
        </p>
      </div>
      <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-fg">
        <Shirt className="size-4" /> Open my drawer
      </Link>
    </div>
  );
}

/** Quiet line on the Add screen. Only appears when it matters. */
export function PhotoAllowanceNote() {
  const { data } = useUsage();
  if (!data?.photos || data.limitsOff) return null;
  const left = data.photos.limit - data.photos.used;
  if (left > 10) return null;
  return (
    <p className="text-center text-[12.5px] text-muted">
      {left > 0 ? `${left} photo${left === 1 ? "" : "s"} left today.` : "That's all your photos for today."} More at {clock(data.photos.resetsAt)}.
    </p>
  );
}

function Meter({ label, a, unit }: { label: string; a: UsageAllowance; unit: string }) {
  const left = Math.max(0, a.limit - a.used);
  return (
    <Row label={label} value={`${left} of ${a.limit} ${unit} left`}>
      <Bar share={a.limit ? a.used / a.limit : 1} />
    </Row>
  );
}

function Row({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="font-medium">{label}</span>
        <span className="text-right text-muted">{value}</span>
      </div>
      {children}
    </div>
  );
}

function Bar({ share }: { share: number }) {
  const used = Math.min(1, Math.max(0, share));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="presentation">
      <div className={cn("h-full rounded-full bg-text/70 transition-[width]")} style={{ width: `${used * 100}%` }} />
    </div>
  );
}

/** Profile: what's left today, and when it comes back. */
export function UsageCard() {
  const { data } = useUsage();
  if (!data) return null;
  const reset = data.chat?.resetsAt ?? data.photos?.resetsAt;
  return (
    <section className="space-y-3.5 rounded-[22px] bg-surface p-4">
      <div>
        <h2 className="text-[14px] font-semibold tracking-tight">Your usage</h2>
        <p className="text-[12.5px] text-muted">{data.limitsOff ? "Limits are off for your account." : reset ? `Daily allowances come back at ${clock(reset)}, ${timeUntil(reset)}.` : "Free while we're in beta."}</p>
      </div>
      {data.chat && <Meter label="Stylist messages" a={data.chat} unit="today" />}
      {data.photos && <Meter label="Photos" a={data.photos} unit="today" />}
      {data.studio && (
        <Row label="Studio shots" value={`${Math.max(0, data.studio.limit - data.studio.used)} of ${data.studio.limit} free left`}>
          <Bar share={data.studio.limit ? data.studio.used / data.studio.limit : 1} />
          <p className="text-[12px] text-muted">These don&apos;t reset. After the last one, pieces use your own photo.</p>
        </Row>
      )}
    </section>
  );
}

/** Only shown to developers. The server decides who that is, and checks again on every change. */
export function DeveloperMenu() {
  const { data } = useUsage();
  const [busy, setBusy] = useState(false);
  if (!data?.developer) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      const next = await api<Usage>("/api/dev", "POST", { limits_off: !data.limitsOff });
      await mutate("/api/usage", next, { revalidate: false });
      toast(next.limitsOff ? "Limits off. AI spend is uncapped for you" : "Limits back on");
    } catch (e) {
      toast.error(`Couldn't change that: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-[22px] border border-dashed border-border-strong p-4">
      <h2 className="flex items-center gap-2 text-[14px] font-semibold tracking-tight">
        <FlaskConical className="size-4 text-muted" /> Developer
      </h2>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium">Turn off usage limits</p>
          <p className="text-[12.5px] text-muted">For your account: messages, photos, studio shots and the daily budget. This spends real money with no cap.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={data.limitsOff}
          aria-label="Turn off usage limits"
          disabled={busy}
          onClick={toggle}
          className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50", data.limitsOff ? "bg-accent" : "bg-surface-2")}
        >
          <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow-soft transition-[left]", data.limitsOff ? "left-[22px]" : "left-0.5")} />
        </button>
      </div>
      {data.spentToday !== null && <p className="text-[12.5px] text-muted">AI spend today: ${data.spentToday.toFixed(2)}. Web searches aren&apos;t included. Each person counts for at most $2 of this.</p>}
    </section>
  );
}
