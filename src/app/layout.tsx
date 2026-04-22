import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { HUB_SYSTEM_NAME, PRODUCT_TAGLINE } from "@/lib/branding";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: HUB_SYSTEM_NAME,
    template: `%s | ${HUB_SYSTEM_NAME}`,
  },
  description: `${PRODUCT_TAGLINE} Structuring, pricing, and analysis.`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
