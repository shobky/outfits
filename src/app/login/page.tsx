"use client";
import { ArrowRight, Mail } from "lucide-react";
import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ChatGPTButton, useChatGPT } from "@/components/chatgpt";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const display = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], display: "swap" });

const URL_ERRORS: Record<string, string> = {
  auth: "That sign-in link didn't work. Links must be opened in the browser that requested them, so send a new one from there.",
  denied: "This email doesn't have access to Outfits.",
  "chatgpt-cancelled": "ChatGPT sign-in was cancelled. Nothing was changed.",
  "chatgpt-failed": "We couldn't finish signing in with ChatGPT. Please try again.",
  "chatgpt-email": "Your ChatGPT account needs a verified email to sign in here.",
  "chatgpt-setup": "ChatGPT sign-in isn't set up on this copy of Outfits yet. Add SUPABASE_SERVICE_ROLE_KEY to .env.local.",
  "chatgpt-hosted": "ChatGPT sign-in only works when Outfits runs on your own computer. Use your email here.",
};

/** Supabase's default email has only a link. Turn this on once custom SMTP sends a template with {{ .Token }}. */
const EMAIL_HAS_CODE = process.env.NEXT_PUBLIC_AUTH_EMAIL_CODE === "1";

const field = "h-13 w-full rounded-full border border-border-strong bg-surface px-5 text-[15px] outline-none placeholder:text-faint";

function ChatGPTOption() {
  const { data } = useChatGPT();
  if (!data?.canSignIn) return null;
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <ChatGPTButton />
        <p className="text-center text-[13px] leading-relaxed text-muted">Styling runs on your ChatGPT Plus or Pro plan. No API key needed.</p>
        {data.knownAccount && (
          <a href="/auth/chatgpt/start?account=new" className="block text-center text-[13px] text-muted underline underline-offset-2 hover:text-text">
            Use another ChatGPT account
          </a>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs text-faint">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

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
    <div className="space-y-6">
      <ChatGPTOption />
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
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" aria-label="Email" className={field} />
        <Button variant="surface" size="lg" className="w-full shadow-none" disabled={loading}>
          {loading ? "Sending…" : "Continue with email"}
        </Button>
      </form>
      {err && <p role="alert" className="text-center text-sm text-danger">{err}</p>}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-12">
        <div className="space-y-4 text-center">
          <h1 className={cn(display.className, "text-[64px] leading-[0.95] tracking-tight")}>
            Your drawer,
            <br />
            <em>styled.</em>
          </h1>
          <p className="text-[15px] text-muted">Snap your clothes. Get outfits from what you already own.</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="text-center text-[12.5px]">
          <Link href="/privacy" className="text-muted underline">
            Privacy
          </Link>
        </p>
      </div>
    </div>
  );
}
