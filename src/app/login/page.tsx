"use client";
import { ArrowRight, Mail } from "lucide-react";
import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ChatGPTButton, useChatGPT } from "@/components/chatgpt";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const display = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], display: "swap" });

const URL_ERRORS: Record<string, string> = {
  auth: "That sign-in link is invalid or expired. Request a new one from Outfits.",
  expired: "That sign-in link or code has expired. Request a new one below.",
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
const RESEND_COOLDOWN_SECONDS = 60;

function explainEmailError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/rate|too many|429|60 seconds|once every/i.test(message)) {
    return "Too many sign-in emails were requested. Wait a moment, then use the newest email.";
  }
  if (/expired|invalid|otp/i.test(message)) {
    return "That sign-in link or code has expired. Request a new one below.";
  }
  return message || "We couldn't send a sign-in email. Please try again.";
}

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
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const urlError = URL_ERRORS[params.get("error") ?? ""] ?? null;
  const visibleError = err ?? urlError;

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!window.location.hash) return;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const fragmentError = fragment.get("error_description") ?? fragment.get("error_code") ?? fragment.get("error");
    if (!fragmentError) return;
    const next = new URL(window.location.href);
    next.hash = "";
    next.searchParams.set("error", /expired|invalid|otp/i.test(fragmentError) ? "expired" : "auth");
    router.replace(`${next.pathname}${next.search}`, { scroll: false });
  }, [router]);

  async function sendLink() {
    setLoading(true);
    setErr(null);
    if (urlError) router.replace("/login", { scroll: false });
    try {
      const { error } = await createClient().auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) {
        setErr(explainEmailError(error));
        return false;
      }
      setSent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      return true;
    } catch (error) {
      setErr(explainEmailError(error));
      return false;
    } finally {
      setLoading(false);
    }
  }

  function changeEmail() {
    setSent(false);
    setCode("");
    setCooldown(0);
    setErr(null);
  }

  if (sent) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-3xl bg-surface p-5">
          <Mail className="size-5 shrink-0 text-accent" />
          <p className="text-sm">
            Check <b>{email}</b> for the newest sign-in email. {EMAIL_HAS_CODE ? "Open its link here, or enter the code below." : "Open its link in this browser; if you used another browser, request a new link below."}
          </p>
        </div>
        {EMAIL_HAS_CODE && (
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              setErr(null);
              try {
                const { error } = await createClient().auth.verifyOtp({ email, token: code.trim(), type: "email" });
                if (error) {
                  setErr(explainEmailError(error));
                  return;
                }
                router.replace("/");
                router.refresh();
              } catch (error) {
                setErr(explainEmailError(error));
              } finally {
                setLoading(false);
              }
            }}
          >
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" required placeholder="Code from the email" aria-label="Code from the email" className={field} />
            <Button size="lg" className="w-full" disabled={loading}>
              {loading ? "Checking…" : "Sign in with code"} <ArrowRight className="size-4" />
            </Button>
          </form>
        )}
        <div className="flex items-center justify-between gap-3 px-1 text-[13px] text-muted">
          <button type="button" className="underline underline-offset-2 disabled:no-underline disabled:opacity-50" onClick={() => void sendLink()} disabled={loading || cooldown > 0}>
            {cooldown > 0 ? `Send again in ${cooldown}s` : "Send a new link"}
          </button>
          <button type="button" className="underline underline-offset-2" onClick={changeEmail} disabled={loading}>
            Use a different email
          </button>
        </div>
        {visibleError && <p role="alert" className="text-center text-sm text-danger">{visibleError}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ChatGPTOption />
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await sendLink();
        }}
      >
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" aria-label="Email" className={field} />
        <Button variant="surface" size="lg" className="w-full shadow-none" disabled={loading}>
          {loading ? "Sending…" : "Continue with email"}
        </Button>
      </form>
      {visibleError && <p role="alert" className="text-center text-sm text-danger">{visibleError}</p>}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-12">
        <div className="space-y-4 text-center">
          <BrandMark size={80} className="mx-auto" />
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
