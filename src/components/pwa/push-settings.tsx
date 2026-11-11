"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/utils";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function decodeKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const bytes = atob(`${value.replace(/-/g, "+").replace(/_/g, "/")}${padding}`);
  return Uint8Array.from(bytes, (char) => char.charCodeAt(0));
}

export function PushSettings() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!publicKey || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (active) setSupported(false);
        return;
      }
      try {
        const config = await api<{ configured: boolean; endpoints: string[] }>("/api/push/subscribe", "GET");
        if (!config.configured) { if (active) setSupported(false); return; }
        if (active) setConfigured(true);
        const registration = await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("No service worker")), 5000))]);
        const subscription = await registration.pushManager.getSubscription();
        if (active) { setSupported(true); setEnabled(Boolean(subscription && config.endpoints.includes(subscription.endpoint))); }
      } catch {
        if (active) setSupported(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const toggle = async () => {
    if (!publicKey || !supported || busy) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.getSubscription();
      if (current && enabled) {
        await api("/api/push/subscribe", "DELETE", { endpoint: current.endpoint });
        await current.unsubscribe();
        setEnabled(false);
        toast("Outfit alerts turned off");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Allow notifications in your browser settings to turn alerts on.");
      const subscription = current ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(publicKey) });
      try { await api("/api/push/subscribe", "POST", subscription.toJSON()); }
      catch (error) { if (!current) await subscription.unsubscribe(); throw error; }
      setEnabled(true);
      toast("Outfit alerts turned on");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update outfit alerts");
    } finally {
      setBusy(false);
    }
  };

  if (supported === null) return null;
  return (
    <section className="space-y-3 rounded-[28px] bg-surface p-5">
      <div className="flex items-center gap-3">
        {enabled ? <Bell className="size-5 text-accent" /> : <BellOff className="size-5 text-muted" />}
        <div className="min-w-0 flex-1"><h2 className="font-semibold tracking-tight">Outfit alerts</h2><p className="text-[13px] text-muted">Get a nudge when your try-on is saved and ready.</p></div>
      </div>
      {configured && supported ? <Button variant={enabled ? "surface" : "primary"} className="w-full" disabled={busy} onClick={() => void toggle()}>{busy && <Loader2 className="size-4 animate-spin" />}{enabled ? "Turn off alerts" : "Enable alerts"}</Button> : <p className="text-[12.5px] text-muted">{publicKey && configured ? "Use a supported browser. On iPhone or iPad, add Outfits to your Home Screen and open it there to enable alerts." : "Alerts will appear here once push delivery is configured."}</p>}
    </section>
  );
}
