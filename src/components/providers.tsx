"use client";
import { ThemeProvider } from "next-themes";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      {children}
      <Toaster
        position="top-center"
        duration={3500}
        swipeDirections={["top", "left", "right"]}
        offset={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
        mobileOffset={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
        // An open sheet turns off pointer events on the rest of the page, toasts included.
        style={{ pointerEvents: "auto" }}
        toastOptions={{ className: "!rounded-2xl !bg-surface !text-text !border-border" }}
      />
    </ThemeProvider>
  );
}
