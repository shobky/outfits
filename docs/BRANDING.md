# Outfits brand assets

The supplied `Neon Hanger Shirt App Icon.png` is the source artwork. Keep it outside
`public/`; the application serves only the optimized derivatives.

Run `node scripts/gen-icons.mjs` to regenerate everything. It uses the existing
Sharp dependency, trims the transparent export margin, preserves the artwork's
aspect ratio, strips metadata, and compresses each output for its purpose.

- `public/brand/logo.webp`: 256px app navigation and Stylist marks.
- `public/brand/logo-512.webp`: larger reusable brand image.
- `public/brand/social-card.jpg`: 1200×630 Open Graph and Twitter sharing card.
- `public/icons/icon-{16,32,48}.png`: browser icons.
- `src/app/favicon.ico`: multi-resolution 16/32/48px favicon, wired automatically by Next.js.
- `public/icons/icon-{192,512}.png`: standard PWA icons.
- `public/icons/icon-maskable-{192,512}.png`: opaque Android icons with safe padding.
- `public/icons/apple-touch-icon*.png`: opaque 120/152/167/180px iPhone/iPad icons.

`src/app/manifest.ts` and root layout metadata declare the applicable assets.
`BrandMark` shares the optimized WebP across app surfaces. Installed apps may need
to be reopened or reinstalled before their launcher updates its cached icon.
