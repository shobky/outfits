"use client";
import { useState } from "react";
import { AddWish as ShopAddWish, ProductSearchSheet, ShopHome } from "@/components/shop/shop-home";

export function ShopView() {
  const [adding, setAdding] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  return (
    <>
      <ShopHome onAdd={() => setAdding(true)} onSearch={(query) => { setSearchQuery(query); setSearching(true); }} />
      <ShopAddWish open={adding} onOpenChange={setAdding} />
      <ProductSearchSheet key={searchQuery} open={searching} onOpenChange={setSearching} initialQuery={searchQuery} />
    </>
  );
}
