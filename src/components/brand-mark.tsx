import Image from "next/image";
import { cn } from "@/lib/utils";

/** Artwork is already compressed; skip runtime re-encoding for these small marks. */
export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return <Image src="/brand/logo.webp" alt="" width={size} height={size} unoptimized className={cn("shrink-0 object-contain", className)} />;
}
