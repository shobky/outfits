"use client";
import { Copy, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { FEATURES, type FeatureName } from "@/lib/features-shared";
import type { AdminOverview } from "@/lib/types";
import { api, cn, fetcher } from "@/lib/utils";

const money = (n: number) => `$${Number(n).toFixed(2)}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "Never");
const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-[22px] bg-surface p-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {sub && <p className="text-[12.5px] text-muted">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <p className="text-[18px] font-semibold tracking-tight">{value}</p>
      <p className="text-[11.5px] text-muted">{label}</p>
    </div>
  );
}

export function AdminView() {
  const { data, error, mutate } = useSWR<AdminOverview>("/api/admin", fetcher);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (body: object, done?: string) => {
    setBusy(true);
    try {
      await mutate(await api<AdminOverview>("/api/admin", "POST", body), { revalidate: false });
      if (done) toast(done);
      return true;
    } catch (e) {
      toast.error(reason(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="pb-nav lg:pb-12">
        <PageHeader title="Dashboard" />
        <p role="alert" className="mx-auto max-w-xl px-4 text-sm text-muted">
          This page is for the app&apos;s owner.
        </p>
      </div>
    );
  }
  if (!data) return <PageHeader title="Dashboard" />;

  const spentToday = data.spend.reduce((n, s) => n + Number(s.today), 0);
  const spentWeek = data.spend.reduce((n, s) => n + Number(s.week), 0);
  const { health } = data;

  return (
    <div className="pb-nav lg:pb-12">
      <PageHeader title="Dashboard" />
      <div className="mx-auto max-w-2xl space-y-4 px-4">
        <Card title="Spend" sub={`Daily budget ${money(data.flags.dailyBudget)}. Each person counts for at most $2 of it. Web searches aren't included.`}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Today" value={money(spentToday)} />
            <Stat label="Last 7 days" value={money(spentWeek)} />
          </div>
          {data.spend.length > 0 && (
            <ul className="divide-y divide-border text-[13px]">
              {data.spend.map((s) => (
                <li key={s.kind} className="flex justify-between gap-3 py-2">
                  <span className="capitalize">{s.kind.replace("_", " ")}</span>
                  <span className="text-muted">
                    {s.calls} calls · {money(s.total)} total
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[12.5px] text-muted">
            Off switches live in Vercel: <code>AI_STUDIO_ENABLED=0</code> and <code>FEATURE_…=0</code>. Studio shots are {data.flags.studioEnabled ? "on" : "off"}. Sign-up is {data.flags.inviteOnly ? "invite-only" : "limited to your allowed addresses"}.
          </p>
        </Card>

        <Card title="Is it working?" sub="Worth reading only once a few people have been here for two weeks.">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="People" value={String(health.users)} />
            <Stat label="Pieces, median" value={String(health.median_pieces)} />
            <Stat label="Shop taps" value={String(health.shop_taps)} />
          </div>
          <p className="text-[13px]">
            Back in week 2: <b>{health.old_enough ? `${health.back_in_week_2} of ${health.old_enough}` : "not enough time yet"}</b>
          </p>
        </Card>

        <Card title="People" sub="Premium features are off until you switch them on here. Addresses in ALLOWED_EMAILS use their own developer menu instead.">
          <ul className="divide-y divide-border">
            {data.people.map((p) => (
              <li key={p.id} className="space-y-2 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-[13.5px] font-medium">{p.email ?? "No email"}</p>
                  <p className="shrink-0 text-[12px] text-muted">{money(p.spend_total)}</p>
                </div>
                <p className="text-[12px] text-muted">
                  {p.pieces} pieces · joined {day(p.joined)} · last seen {day(p.last_seen)}
                  {p.invite_code ? ` · invite ${p.invite_code}` : ""}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(FEATURES) as FeatureName[]).map((f) => {
                    const on = p.features.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={on}
                        disabled={busy}
                        onClick={() => send({ action: "set_features", user_id: p.id, features: on ? p.features.filter((x) => x !== f) : [...p.features, f] })}
                        className={cn("h-8 rounded-full border px-3 text-[12px] font-medium transition-colors disabled:opacity-50", on ? "border-transparent bg-accent text-accent-fg" : "border-border-strong text-muted")}
                      >
                        {FEATURES[f].label}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Invites" sub="One code per person shows who came from where. They only matter once INVITE_ONLY=1 and custom email are set.">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await send({ action: "create_invite", code, note }, "Invite created")) {
                setCode("");
                setNote("");
              }
            }}
          >
            <input aria-label="Invite code" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="FRIEND-SARA" className="h-10 min-w-0 flex-1 rounded-full border border-border bg-surface-2 px-4 text-[14px] uppercase outline-none" />
            <input aria-label="Who it's for" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Who it's for" className="h-10 min-w-0 flex-1 rounded-full border border-border bg-surface-2 px-4 text-[14px] outline-none" />
            <Button disabled={busy}>Create</Button>
          </form>
          {data.invites.length ? (
            <ul className="divide-y divide-border">
              {data.invites.map((i) => (
                <li key={i.code} className="flex items-center gap-2 py-2 text-[13px]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{i.code}</p>
                    <p className="truncate text-[12px] text-muted">
                      {i.note ? `${i.note} · ` : ""}
                      {i.used_count} of {i.max_uses} used
                    </p>
                  </div>
                  <button type="button" aria-label={`Copy ${i.code}`} onClick={() => navigator.clipboard.writeText(i.code).then(() => toast("Copied"))} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2">
                    <Copy className="size-4" />
                  </button>
                  <button type="button" aria-label={`Revoke ${i.code}`} disabled={busy} onClick={() => confirm(`Revoke ${i.code}? People who already used it keep their access.`) && send({ action: "revoke_invite", code: i.code }, "Invite revoked")} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">No invites yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
