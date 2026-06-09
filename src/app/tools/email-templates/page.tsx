import type { Metadata } from "next";
import { EmailTemplatesClient } from "./email-templates-client";

export const metadata: Metadata = {
  title: "Email Templates",
  description:
    "Reusable Tier One Funding email templates for prospecting, intake, status updates, conditions, closing, and servicing.",
};

export default function EmailTemplatesPage() {
  return <EmailTemplatesClient />;
}
