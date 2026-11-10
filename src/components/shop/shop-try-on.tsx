"use client";
import { TryOnButton } from "@/components/tryon/try-on";

export function ShopTryOnButton({ productUrl, imageUrl, disabled }: { productUrl: string; imageUrl: string; disabled?: boolean }) {
  return <TryOnButton itemIds={[]} product={{ url: productUrl, image_url: imageUrl }} disabled={disabled} />;
}
