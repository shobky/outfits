import { Suspense } from "react";
import { StylistView } from "@/components/chat/stylist-view";

export const metadata = { title: "Stylist" };

export default function StylistPage() {
  return (
    <Suspense>
      <StylistView />
    </Suspense>
  );
}
