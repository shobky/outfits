"use client";
import { Layers, MessageCircle, Plus, Shirt, ShoppingBag, UserRound } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Drawer", icon: Shirt },
  { href: "/outfits", label: "Outfits", icon: Layers },
  { href: "/add", label: "Add", icon: Plus, primary: true },
  { href: "/stylist", label: "Stylist", icon: MessageCircle },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
] as const;

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

/** Floating glass tab bar (mobile) — hidden inside the full-screen chat. */
export function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/stylist")) return null;
  return (
    <nav aria-label="Primary navigation" className="pb-safe fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 lg:hidden">
      <div className="glass flex w-full max-w-[380px] items-center gap-0.5 rounded-full border border-border p-1.5 shadow-soft">
        {TABS.map(({ href, label, icon: Icon, ...t }) => {
          const active = isActive(path, href);
          if ("primary" in t)
            return (
              <Link key={href} href={href} aria-label={label} aria-current={active ? "page" : undefined} className="mx-0.5 grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-fg shadow-soft active:scale-95">
                <Icon className="size-5" strokeWidth={2.2} />
              </Link>
            );
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-0.5 text-[10px] font-medium transition-colors",
                active ? "text-text" : "text-faint",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-[21px]" strokeWidth={active ? 2.2 : 1.7} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Desktop side rail. */
export function SideRail() {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[84px] shrink-0 flex-col items-center gap-2 border-r border-border py-5 lg:flex">
      <Link href="/" className="mb-4 grid size-10 place-items-center rounded-2xl" aria-label="Outfits home">
        <BrandMark />
      </Link>
      {TABS.map(({ href, label, icon: Icon, ...t }) => {
        const active = isActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex w-16 flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-medium transition-colors",
              "primary" in t ? "bg-surface-2 text-text" : active ? "bg-surface text-text shadow-soft" : "text-faint hover:text-text",
            )}
          >
            <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
            {label}
          </Link>
        );
      })}
      <div className="flex-1" />
      <Link href="/me" className={cn("grid size-10 place-items-center rounded-full", isActive(path, "/me") ? "bg-surface shadow-soft" : "text-faint hover:text-text")} aria-label="Profile">
        <UserRound className="size-5" />
      </Link>
    </aside>
  );
}

export function ProfileLink() {
  return (
    <Link href="/me" aria-label="Profile" className="grid size-11 place-items-center rounded-full bg-surface text-text shadow-soft lg:hidden">
      <UserRound className="size-[18px]" />
    </Link>
  );
}
