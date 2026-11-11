import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Outfits — AI wardrobe & stylist",
    short_name: "Outfits",
    id: "/",
    scope: "/",
    description: "Your wardrobe, digitised — with a stylist that knows every piece you own.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    share_target: {
      action: "/share/target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [{ name: "files", accept: ["image/jpeg", "image/png", "image/webp"] }],
      },
    },
    shortcuts: [
      { name: "Style a photo", short_name: "Style photo", url: "/share", icons: [{ src: "/icons/icon-192.png?v=neon-1", sizes: "192x192" }] },
      { name: "Save a product", short_name: "Save product", url: "/share", icons: [{ src: "/icons/icon-192.png?v=neon-1", sizes: "192x192" }] },
    ],
    background_color: "#0e1014",
    theme_color: "#0e1014",
    icons: [
      { src: "/icons/icon-192.png?v=neon-1", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png?v=neon-1", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png?v=neon-1", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png?v=neon-1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
