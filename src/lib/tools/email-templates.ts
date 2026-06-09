/**
 * Canonical library of reusable rep email templates surfaced at `/tools/email-templates`.
 *
 * Bodies are stored verbatim. Merge fields use the `{{Field Name}}` convention; literal dollar
 * signs in front of a field (e.g. `${{Loan Amount}}`) are escaped as `\${{...}}` so they survive
 * template-literal parsing. Keep this module pure (no client/runtime deps) so it can be unit tested
 * and imported from both server and client components.
 */

export type EmailTemplateCategory =
  | "Prospecting & Follow-up"
  | "Intake & Onboarding"
  | "Status Updates"
  | "Underwriting & Scope"
  | "Approval & Conditions"
  | "Closing & Servicing"
  | "Growth & Referrals";

export type EmailTemplate = {
  /** Stable slug used for anchors / selection state. */
  id: string;
  category: EmailTemplateCategory;
  title: string;
  /** Suggested subject line (omitted for templates meant to be sent inline / as a reply draft). */
  subject?: string;
  body: string;
};

/** Display order for category groupings in the UI. */
export const EMAIL_TEMPLATE_CATEGORY_ORDER: EmailTemplateCategory[] = [
  "Prospecting & Follow-up",
  "Intake & Onboarding",
  "Status Updates",
  "Underwriting & Scope",
  "Approval & Conditions",
  "Closing & Servicing",
  "Growth & Referrals",
];

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "cold-call-follow-up",
    category: "Prospecting & Follow-up",
    title: "Cold Call Follow-up",
    body: `Hey {{contact.firstname}},

Thanks for taking my call today! As promised, here's a quick recap of how Tier One Funding can make your next deal easier and more profitable:

8.5 - 9.5 % Rates (Credit Score Dependent)
0.5 - 1.0 origination points (Credit Score Dependent)
$1,195 Service Fee
No Appraisal, no inspection pre close
3 Day Close
100% rehab financing, Funds Advanced, not reimbursed. No proof of purchase, receipts or invoices necessary.

If you get approved to borrow with us by the end of next week, I will lock in your first loan with us at 8.75% interest and a $2,000 flat fee (no origination points), whenever you bring us that first loan. I have attached our application here. Let me know if you would like me to send a copy for e-signature.

Please reach out anytime. My cell for call or text is 208.247.9442

Best,
Barrett`,
  },
  {
    id: "new-deal-intake",
    category: "Intake & Onboarding",
    title: "New Deal Intake / What I Need for a Term Sheet",
    subject: "Info needed for term sheet — {{Property Address}}",
    body: `Hi {{First Name}},

Here is what I need to provide a term sheet and pricing for this deal:
Property address
Purchase price
Rehab budget
Estimated ARV
Target closing date
Exit plan — flip or hold

Here is what I need to get the loan started and keep it moving toward closing:
Purchase contract
Escrow/title officer contact information
Hazard insurance contact information
Scope of work / rehab budget
Interior photos of the property, if available

If your scope is currently in a different format, send it to me and I can translate it into our template.

My cell is {{Your Cell}}. Looking forward to working on this with you.

Thanks,
Barrett`,
  },
  {
    id: "approved-borrower-handoff",
    category: "Intake & Onboarding",
    title: "New Borrower / Approved Borrower Handoff",
    subject: "Next steps for your next property approval",
    body: `Hi {{First Name}},

Congrats on getting approved with Tier One Funding.

I'll be your main point of contact for property approvals going forward. When you have a deal you want us to review, send me the following:
Address
Purchase price
Rehab budget
Estimated ARV
Target close date
Purchase contract, if already under contract
Title/escrow contact
Insurance contact
Scope of work and photos, if available

Once I have those items, I can size the deal, provide terms, and let you know what we need to move toward closing.

Thanks,
Barrett`,
  },
  {
    id: "received-processing",
    category: "Status Updates",
    title: `Quick "Received — I'll Process This" Reply`,
    subject: "Re: {{Property Address}}",
    body: `Hi {{First Name}},

Received, thank you.

I'll begin processing this now and will reach back out with any remaining questions, as well as the next steps for the deal.

Thanks,
Barrett`,
  },
  {
    id: "deal-status-single",
    category: "Status Updates",
    title: "Deal Status Update — Single Property",
    subject: "{{Property Address}} update",
    body: `Hi {{First Name}},

I wanted to give you a status update on {{Property Address}} as we track toward closing on {{Target Close Date}}.

Current Status
Your loan is currently {{Status: in underwriting / conditionally approved / in closing}}, and we've already cleared {{Cleared Items}}.
We're in a good position, but we still need to finalize a few remaining items before we can move to docs.

Outstanding Items
{{Outstanding Item 1}}
{{Outstanding Item 2}}
{{Outstanding Item 3}}

Action Needed
Please {{specific action: review and approve the scope / send the insurance binder / sign the disclosures / confirm the closing date}}.

Once these are complete, we can move directly into {{next step: final approval / loan documents / funding}}.

Let me know once you've reviewed, or if anything comes up.

Thanks,
Barrett`,
  },
  {
    id: "pipeline-update",
    category: "Status Updates",
    title: "Multi-Property Pipeline Update",
    subject: "{{Date}} pipeline follow-up",
    body: `Hello,

I wanted to provide a quick status update on the properties below.

{{Property 1 Address}}
{{Status update. Example: Closing documents have been sent, and funding is currently planned for {{Date}}.}}

{{Property 2 Address}}
{{Status update. Example: This file is in closing. Our closer and escrow are actively coordinating, and closing docs should be out shortly.}}

{{Property 3 Address}}
{{Status update. Example: This loan is conditionally approved for up to \${{Amount}}. The last condition is {{Condition}}.}}

{{Property 4 Address}}
This loan is conditionally approved for a total of \${{Amount}} once the remaining conditions are cleared.

Outstanding items:
{{Item 1}}
{{Item 2}}
{{Item 3}}

Regards,
Barrett`,
  },
  {
    id: "scope-needs-detail",
    category: "Underwriting & Scope",
    title: "Scope of Work Needs More Detail",
    subject: "Scope of Work updates needed — {{Property Address}}",
    body: `Hi {{First Name}},

Thanks for sending over the construction budget. I reviewed it and started transferring it into Tier One's Scope of Work template so we can move it toward approval.

A few updates are needed before valuation can fully review it.

1. Post-rehab property details
Please confirm the post-rehab:
Bed count
Bath count
Living area / square footage, if changing
Any layout changes

2. More detail for line items with a dollar amount
For each budget line item greater than $0, we need enough detail for construction review and draw approvals.
Please include:
Repair vs. replace
Finish level — rental grade / mid-grade / high-end
Material or product type
Kitchen details — cabinets, counters, appliances, sink/faucet, flooring, lighting
Bathroom details — tub/shower, tile/surround, vanity, toilet, fixtures, flooring
Interior finishes — paint, trim, doors, hardware, ceiling work
If there is a large lump-sum line item, please break it out trade-by-trade: demo, flooring, paint, kitchen, baths, plumbing, electrical, etc.

3. Project summary
Please add a short 2–3 sentence summary of the project. The summary should include:
Renovation strategy
Finish level
Intended end-use — flip or rental
Major upgrades being completed

4. Contingency
Reminder: Tier One requires a minimum 10% contingency on all scopes of work. Rehab funds are non-dutch, meaning you do not pay interest on contingency funds unless they are actually drawn.

Once you send the updated scope back, I'll review it right away and move it forward internally.

Thanks,
Barrett`,
  },
  {
    id: "scope-valuation-cleared",
    category: "Underwriting & Scope",
    title: "Scope + Valuation Cleared / Max Leverage Confirmed",
    subject: "{{Property Address}} — scope and valuation update",
    body: `Hi {{First Name}},

The scope has been approved, and valuation has been confirmed.

We estimated the ARV at \${{Confirmed ARV}}. This is {{higher/lower}} than the original figure, but it is still high enough to secure maximum leverage.

Based on the approved valuation, we can offer:
Initial loan: \${{Initial Loan Amount}}
Rehab holdback: \${{Holdback Amount}}
Total loan: \${{Total Loan Amount}}
Loan-to-ARV: {{LTV/ARV %}}

The last item needed for full loan approval is {{Final Condition}}.

Once we have that, we should be ready to send closing docs.

{{Optional personal line: You seem to have found a strong deal on this one.}}

Thanks,
Barrett`,
  },
  {
    id: "formal-approval",
    category: "Approval & Conditions",
    title: "Formal Loan Approval / Confirm Terms",
    subject: "Confirm Terms — {{Property Address}}",
    body: `Hey {{First Name}},

I am excited to announce that your loan has been approved.

Thank you for all your help gathering the required documentation. Please confirm the following loan terms so we can send the loan document package for execution.

Subject Property — {{Property Address}}
Borrower — {{Borrower Entity}}
Guarantor — {{Guarantor Name}}
Loan Term — {{Loan Term}} Months
Interest Rate — {{Interest Rate}}
Origination Points — {{Origination Points}}
Estimated Loan Fees — \${{Loan Fees}}
Initial Loan Amount — \${{Initial Loan Amount}}
Holdback Amount — \${{Holdback Amount}}
Estimated Close of Escrow Date — {{Close Date}}

Please reply with approval if everything looks correct.

Barrett Abel
{{Email}}
{{Phone}}
Tier One Funding Inc.`,
  },
  {
    id: "conditional-approval",
    category: "Approval & Conditions",
    title: "Conditional Approval / Remaining Items Before Docs",
    subject: "{{Property Address}} — remaining items before closing docs",
    body: `Hi {{First Name}},

Here is an update on our current status:
The scope of work has been approved.
The ARV has been confirmed at \${{ARV}}.
This is high enough to lock in {{Leverage Summary}}.

We are currently working through the final items needed before closing docs.

The remaining items are:
{{Item 1}}
{{Item 2}}
{{Item 3}}

Once these clear, we should be ready to move into closing documents.

One thing to know on payment timing: our monthly payments are collected in arrears. Since this transaction is closing in {{Month}}, we will collect {{Per Diem / Prepaid Interest Details}} at closing, and your first payment will come due on {{First Payment Date}}.

Regards,
Barrett`,
  },
  {
    id: "insurance-binder",
    category: "Approval & Conditions",
    title: "Insurance Binder Request",
    subject: "Insurance requirements — {{Property Address}}",
    body: `Hi {{First Name}},

You can pass this along to the insurance agent.

Please provide Evidence of Insurance on a binder for hazard insurance reflecting the following:

Loan Information
Borrower Name: {{Borrower Name}}
Property Address: {{Property Address}}
Loan Amount: \${{Loan Amount}}
Loan Term: {{Loan Term}} months
Transaction Type: {{Purchase / Refinance}}
Occupancy Status: Investment Property
Loan Number: {{Loan Number}}

Requirements
Acord 27 form listing Tier One Funding as Additional Interest, with Mortgagee and Loss Payee boxes checked; or
EOI Certificate listing Tier One Funding as Mortgagee and Loss Payee under Additional Interest
Coverage amount equal to 100% of the loan amount or 100% of replacement cost
If coverage equals 100% of replacement cost, please provide the Replacement Cost Estimate
Policy must provide coverage for the full duration of the loan term
Invoice showing premium amount due to be paid at closing, or proof of payment / paid receipt
Required policy type: {{DP-3 / DP-1 with Extended Coverage / Other}}

Mortgagee / Loss Payee
{{Tier One Funding Entity Name}}
{{Address}}
{{ISAOA / ATIMA Wording}}

Thanks,
Barrett`,
  },
  {
    id: "ein-verification",
    category: "Approval & Conditions",
    title: "EIN / Entity Verification Request",
    subject: "{{Entity Name}} EIN verification",
    body: `Hi {{First Name}},

I wanted to reach out regarding a document we need to confirm the full EIN for {{Entity Name}}.

The EIN shown on your application appears to be missing a few digits, so we need an official IRS document that shows the complete number for our records.

The document may be called:
CP 575 — the original IRS EIN assignment letter, or
147C letter — an IRS EIN verification letter

Either one is acceptable as long as it shows:
Business name
Full EIN
IRS confirmation of the number assigned

You may have received this when the EIN was originally issued, or used it previously for tax, payroll, banking, or business verification.

I apologize for raising this after the original approval, but we do need to get the EIN properly verified at this point.

If you have the document, please send it over. If not, you can request a replacement from the IRS by calling 800-829-4933 and asking for a 147C EIN verification letter.

Thank you,
Barrett`,
  },
  {
    id: "signing-authority",
    category: "Approval & Conditions",
    title: "Signing Authority / Unanimous Consent Request",
    subject: "Signing authority documentation needed — {{Entity Name}}",
    body: `Hi {{First Name}},

Our investors reviewed the operating agreement for {{Entity Name}} and determined that we need additional documentation for signing authority.

The agreement shows {{Signing Authority Issue}}. As a result, we cannot proceed with only {{Signer Name}} signing unless we receive supporting authorization.

To satisfy this, we need one of the following:
Signatures from all required members on the closing docs, or
A signed member consent / borrowing resolution authorizing {{Signer Name}} to sign on behalf of the company for this transaction

I've attached a copy of our unanimous consent form, which we typically use to clear this condition. We only need to collect it once.

I can send it via DocuSign to make it easy.

Please confirm the best email addresses for signature.

Thank you,
Barrett`,
  },
  {
    id: "draw-wire-instructions",
    category: "Closing & Servicing",
    title: "Draw Wire Instructions / Rehab Funds Setup",
    subject: "Draw disbursement account — {{Property Address}}",
    body: `Good morning {{First Name}},

As we get ready for the rehab phase, I need to confirm the bank account you'd like us to use to disburse your construction draw funds.

Do you typically:
Use one bank account for all projects, or
Use different accounts by property/project?

If you'd like the draws sent to the same account associated with the voided check you already provided, just reply confirming "same account," and I will pre-fill the attached draw disbursement/wire instructions form and send it back for e-signature.

If you'd prefer to use a different account, please send the account details or a voided check for that account, and I'll update the form accordingly.

Thank you,
Barrett`,
  },
  {
    id: "funded-servicing",
    category: "Closing & Servicing",
    title: "Funded Loan / Servicing Instructions",
    subject: "Your loan is funded — servicing contacts + payoff requests",
    body: `Hi {{First Name}},

Congrats — your loan on {{Property Address}} is officially funded.

Servicing & Payment Questions
{{Servicer Name}}
{{Servicer Address}}
{{Phone Number}}

Payments are drafted via ACH on the first business day of the month. If you want to request a different draft date, contact {{Servicer Name}} directly. Changes are not guaranteed, and draft dates cannot be set later than the 10th.

Payoff Statements
When you need a payoff statement for a refinance, sale, or title request, email me directly and I'll get it turned around quickly.

Please include:
Property address
Estimated payoff date
Escrow/title contact name and email, if applicable

Thanks,
Barrett`,
  },
  {
    id: "prequal-next-deal",
    category: "Growth & Referrals",
    title: "Pre-Qual / Term Sheet for Next Deal",
    subject: "Need a pre-qual letter or term sheet for your next deal?",
    body: `Hi {{First Name}},

If you're looking at another purchase, we can move quickly on the front end.

I can provide:
A pre-qualification letter, and/or
A term sheet for a prospective deal

Reply with whatever you have, even if it's early:
Address or neighborhood/city
Estimated purchase price
Rehab yes/no
Rough rehab budget, if applicable
Target close date

We'll turn it around quickly so you can make offers with confidence.

Barrett`,
  },
  {
    id: "referral-ask",
    category: "Growth & Referrals",
    title: "Referral Ask",
    subject: "Referral perk for your next loan",
    body: `Hi {{First Name}},

One quick perk to keep in mind:

If you refer another investor who closes a loan with us, we offer referral discounts that can be applied to your next Tier One loan.

If you have someone in mind, reply with their name and email/phone, or just CC me on an intro email, and I'll take it from there.

Thanks,
Barrett`,
  },
];

/**
 * Extract unique `{{merge field}}` names from a template's subject + body, preserving first-seen
 * order. Used to show reps which fields still need to be filled before sending.
 */
export function extractTemplateVariables(template: EmailTemplate): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const source = `${template.subject ?? ""}\n${template.body}`;
  const re = /\{\{([^{}]+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const name = m[1]!.trim();
    if (name !== "" && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/** Full plain-text (subject + body) used for the "copy entire email" action. */
export function templateToPlainText(template: EmailTemplate): string {
  if (template.subject) {
    return `Subject: ${template.subject}\n\n${template.body}`;
  }
  return template.body;
}
