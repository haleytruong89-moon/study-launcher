import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterServiceWorker } from "./register-sw";

export const metadata: Metadata = {
  title: "Study Launcher",
  description: "Việc hôm nay của Nguyên và An",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Study Launcher", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#2b5d4f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-dvh antialiased">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
