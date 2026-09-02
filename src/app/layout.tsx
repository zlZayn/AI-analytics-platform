import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

// Self-hosted Geist: avoids runtime font downloads (fonts.gstatic.com) in
// dev/build; keeps CI and offline machines reproducible.
const geistSans = localFont({
  src: "./fonts/geist-sans.woff2",
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/geist-mono.woff2",
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Analytics Platform",
  description: "通用型 AI 数据分析平台，支持 PostgreSQL 数据库接入",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
