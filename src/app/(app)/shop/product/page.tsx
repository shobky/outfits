import { Suspense } from "react";
import { ShopProductPage } from "@/components/shop/product-page";

export const metadata = { title: "Product · Shop" };

export default function ShopProductRoute() {
  return <Suspense fallback={<div className="min-h-screen bg-bg" />}><ShopProductPage /></Suspense>;
}
