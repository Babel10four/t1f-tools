import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PRODUCT_TAGLINE } from "@/lib/branding";
import { ADVANCED_TOOLS } from "@/app/tools/tools-registry";

const dealAnalyzer = ADVANCED_TOOLS[0]!;

export const metadata: Metadata = {
  title: dealAnalyzer.label,
  description: `${dealAnalyzer.description} ${PRODUCT_TAGLINE}`,
};

export default function DealAnalyzerLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
