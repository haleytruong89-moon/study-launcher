"use client";

import { useEffect } from "react";

/**
 * Last-resort error page, used when the root layout itself fails (review 12/11/2026). It replaces
 * the whole document, so the app CSS may be missing: inline styles only, no external resources,
 * and never the error text (a child may see it; details go to the console).
 */
export default function GlobalError({
  error,
  retry,
  reset,
}: {
  error: unknown;
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const again = retry ?? reset;
  const button = {
    display: "block",
    width: "100%",
    minHeight: 48,
    borderRadius: 16,
    fontSize: 16,
    fontWeight: 700,
    textAlign: "center",
    lineHeight: "48px",
    textDecoration: "none",
    fontFamily: "inherit",
  } as const;

  return (
    <html lang="vi">
      <body style={{ margin: 0, background: "#F4F5F0", color: "#1C1F1D", fontFamily: "'Be Vietnam Pro', system-ui, sans-serif" }}>
        <title>Study Launcher</title>
        <main style={{ maxWidth: 420, margin: "0 auto", padding: "64px 24px" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 12px" }}>Có lỗi nhỏ, không sao đâu</h1>
          <p style={{ fontSize: 16, lineHeight: 1.5, margin: "0 0 24px", opacity: 0.8 }}>
            Ứng dụng chưa mở được. Bấm &ldquo;Thử lại&rdquo; nhé. Nếu vẫn chưa được, báo bố mẹ.
          </p>
          {again && (
            <button
              type="button"
              onClick={() => again()}
              style={{ ...button, border: 0, background: "#2B5D4F", color: "#fff", cursor: "pointer", marginBottom: 12, padding: 0 }}
            >
              Thử lại
            </button>
          )}
          {/* Plain <a>: a full reload is the safest way out when the root layout broke. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ ...button, border: "2px solid #2B5D4F", color: "#2B5D4F", boxSizing: "border-box", lineHeight: "44px" }}>
            Về trang đầu
          </a>
        </main>
      </body>
    </html>
  );
}
