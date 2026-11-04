"use client";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/utils";

export default function InvitePage() {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <form
        className="w-full max-w-sm space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          setErr(null);
          try {
            await api("/api/invite", "POST", { code });
            router.replace("/");
            router.refresh();
          } catch (error) {
            setErr(error instanceof Error ? error.message : String(error));
            setLoading(false);
          }
        }}
      >
        <div className="space-y-1.5">
          <h1 className="text-[28px] font-semibold tracking-tight">You&apos;re nearly in</h1>
          <p className="text-sm text-muted">Outfits is invite-only for now. Enter the code you were given.</p>
        </div>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="Invite code"
          aria-label="Invite code"
          className="h-13 w-full rounded-full border border-border-strong bg-surface px-5 text-[15px] uppercase outline-none placeholder:normal-case placeholder:text-faint"
        />
        <Button size="lg" className="w-full" disabled={loading}>
          {loading ? "Checking…" : "Continue"} <ArrowRight className="size-4" />
        </Button>
        {err && (
          <p role="alert" className="text-center text-sm text-danger">
            {err}
          </p>
        )}
      </form>
    </div>
  );
}
