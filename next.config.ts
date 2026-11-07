import type { NextConfig } from "next";

// Our own Supabase (R6a review): the CSP of the page loaded first stays for pages opened from it
// without a reload, so leaving Góc bình yên for Hôm nay must still allow photo uploads there.
const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

// Next.js needs inline scripts for hydration; `next dev` also needs eval (never in production).
const BY_CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${SUPABASE_ORIGIN ? ` ${SUPABASE_ORIGIN}` : ""}`,
  "font-src 'self'",
  `connect-src 'self'${SUPABASE_ORIGIN ? ` ${SUPABASE_ORIGIN}` : ""}`,
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Service worker must never be cached by the browser, so updates ship immediately.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        // Góc bình yên (BINH_YEN.md §1): only our own scripts, styles, fonts and requests — no
        // analytics, no embedded players, no third party. Not framed by other sites.
        source: "/binh-yen/:path*", // also matches /binh-yen itself
        headers: [
          { key: "Content-Security-Policy", value: BY_CSP },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
