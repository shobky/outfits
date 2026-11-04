import { BottomNav, SideRail } from "@/components/app-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <SideRail />
      <main className="min-w-0 flex-1">{children}</main>
      <BottomNav />
    </div>
  );
}
