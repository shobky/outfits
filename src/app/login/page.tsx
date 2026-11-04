"use client";
import { ArrowRight, Mail } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-end overflow-hidden px-6 pb-16 md:justify-center">
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[560px] -translate-x-1/2 rounded-full bg-accent/25 blur-[120px]" />
      <div className="relative w-full max-w-sm space-y-8">
        <div className="space-y-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary text-xl font-bold text-primary-fg">O</div>
          <h1 className="text-[40px] font-semibold leading-[1.05] tracking-tight">
            Your drawer,
            <br />
            styled.
          </h1>
          <p className="text-muted">Snap your clothes. Get outfits from what you already own.</p>
        </div>
        {sent ? (
          <div className="flex items-center gap-3 rounded-3xl bg-surface p-5">
            <Mail className="size-5 text-accent" />
            <p className="text-sm">
              Check <b>{email}</b> for a sign-in link.
            </p>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              setErr(null);
              const { error } = await createClient().auth.signInWithOtp({
                email,
                options: { emailRedirectTo: `${location.origin}/auth/callback` },
              });
              setLoading(false);
              if (error) setErr(error.message);
              else setSent(true);
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="h-13 w-full rounded-full border border-border-strong bg-surface px-5 text-[15px] outline-none placeholder:text-faint"
            />
            <Button size="lg" className="w-full" disabled={loading}>
              {loading ? "Sending…" : "Continue with email"} <ArrowRight className="size-4" />
            </Button>
            {err && <p className="text-center text-sm text-danger">{err}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
