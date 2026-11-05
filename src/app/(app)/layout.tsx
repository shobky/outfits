import { Suspense } from "react";
import { BottomNav, SideRail } from "@/components/app-nav";
import { ChatGPTWelcome } from "@/components/chatgpt";
import { IntakeProvider, IntakeStatus } from "@/components/intake/intake-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <IntakeProvider>
      <div className="flex min-h-dvh">
        <SideRail />
        <main className="min-w-0 flex-1">{children}</main>
        <IntakeStatus />
        <BottomNav />
      </div>
      <Suspense>
        <ChatGPTWelcome />
      </Suspense>
    </IntakeProvider>
  );
}
