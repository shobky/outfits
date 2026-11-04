"use client";
import { ArrowRight, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const URL_ERRORS: Record<string, string> = {
  auth: "That sign-in link didn't work. Links must be opened in the browser that requested them, so send a new one from there.",
  denied: "This email doesn't have access to Outfits.",
};

/** Supabase's default email has only a link. Turn this on once custom SMTP sends a template with {{ .Token }}. */
const EMAIL_HAS_CODE = process.env.NEXT_PUBLIC_AUTH_EMAIL_CODE === "1";

const field = "h-13 w-full rounded-full border border-border-strong bg-surface px-5 text-[15px] outline-none placeholder:text-faint";

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(URL_ERRORS[params.get("error") ?? ""] ?? null);
  const [loading, setLoading] = useState(false);

  if (sent && !EMAIL_HAS_CODE) {
    return (
      <div className="flex items-center gap-3 rounded-3xl bg-surface p-5">
        <Mail className="size-5 shrink-0 text-accent" />
        <p className="text-sm">
          Check <b>{email}</b> for a sign-in link, and open it in this browser.
        </p>
      </div>
    );
  }

  if (sent) {
    return (
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          setErr(null);
          const { error } = await createClient().auth.verifyOtp({ email, token: code.trim(), type: "email" });
          if (error) {
            setLoading(false);
            setErr(error.message);
            return;
          }
          router.replace("/");
          router.refresh();
        }}
      >
        <div className="flex items-center gap-3 rounded-3xl bg-surface p-5">
          <Mail className="size-5 shrink-0 text-accent" />
          <p className="text-sm">
            Check <b>{email}</b>. Tap the link, or enter the code from the email. Use the code if you&apos;re in the home-screen app.
          </p>
        </div>
        <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" required placeholder="Code from the email" aria-label="Code from the email" className={field} />
        <Button size="lg" className="w-full" disabled={loading}>
          {loading ? "Checking…" : "Sign in"} <ArrowRight className="size-4" />
        </Button>
        {err && <p role="alert" className="text-center text-sm text-danger">{err}</p>}
      </form>
    );
  }

  return (
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
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className={field} />
      <Button size="lg" className="w-full" disabled={loading}>
        {loading ? "Sending…" : "Continue with email"} <ArrowRight className="size-4" />
      </Button>
      {err && <p role="alert" className="text-center text-sm text-danger">{err}</p>}
    </form>
  );
}

export default function LoginPage() {
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
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
