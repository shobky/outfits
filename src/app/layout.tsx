import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Instrument_Serif } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const display = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], display: "swap", variable: "--font-display" });

export const metadata: Metadata = {
  title: { default: "Outfits", template: "%s · Outfits" },
  description: "Your wardrobe, digitised — with a stylist that knows every piece you own.",
  applicationName: "Outfits",
  metadataBase: new URL("https://outfits.shobky.com"),
  appleWebApp: { capable: true, title: "Outfits", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/icons/icon-16.png?v=neon-1", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-32.png?v=neon-1", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-48.png?v=neon-1", sizes: "48x48", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png?v=neon-1", sizes: "180x180", type: "image/png" },
      { url: "/icons/apple-touch-icon-167.png?v=neon-1", sizes: "167x167", type: "image/png" },
      { url: "/icons/apple-touch-icon-152.png?v=neon-1", sizes: "152x152", type: "image/png" },
      { url: "/icons/apple-touch-icon-120.png?v=neon-1", sizes: "120x120", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    title: "Outfits — Your wardrobe. Your stylist.",
    description: "Your wardrobe, digitised — with a stylist that knows every piece you own.",
    siteName: "Outfits",
    images: [{ url: "/brand/social-card.jpg", width: 1200, height: 630, alt: "Outfits — neon hanger and shirt logo. Your wardrobe. Your stylist." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Outfits — Your wardrobe. Your stylist.",
    description: "Style what you own with your personal AI stylist.",
    images: ["/brand/social-card.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efefed" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1014" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} ${display.variable} h-full`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
