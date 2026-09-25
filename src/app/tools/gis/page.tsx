import type { Metadata } from "next";
import { redirect } from "next/navigation";

const T1F_GIS_URL =
  "https://tier-one-market-intelligence.barrett248037.chatgpt.site/";

export const metadata: Metadata = {
  title: "T1F GIS",
  description: "Open the T1F Geo-spatial Information market explorer.",
};

export default function T1FGisPage() {
  redirect(T1F_GIS_URL);
}
