# Tier 3 purchase policy repair — 2026-10-21

## Scope and authority

Barrett authorized repairing the policy configuration issue and rerunning Kayla's example. This is an indicative calculator repair, not a borrower approval or a full credit-policy implementation. No borrower credit score is inferred. The existing hidden Loan Calculator remains hidden. Tier 1/2 and refinance behavior, pricing, and unrelated configuration are not being re-underwritten in this change.

Verified source: [Tier One Funding Credit Policy ver. 8.2026](https://docs.google.com/document/d/1oQ6Gni0qvOHFCbVfLcnRGUnFXXGq5CdZJSyxH2XnPxo/edit), modified 2026-10-19T20:07:43.912Z. Sections 2.2 and 4.1 establish initial-loan LTC and Tier 3's 85% LTC / 75% ARV limits; section 8.1 requires the full approved scope-of-work holdback, up to estimated rehab cost.

## Root cause

- Production database `xsbbojmvnjiqqpgkncyi` had no published `calculator_assumptions` rule set and no `deal_engine` calculator binding. The engine therefore used embedded generic defaults.
- Tier 3 used a total-cost cap and a proportional rehab allocation. Publishing an 85% generic LTC scalar alone would not correct that allocation.
- The form's automatic requested amount used a fixed Tier 1/2-style 90% acquisition advance regardless of selected tier.

## Runtime configuration

The adjacent JSON is the exact proposed runtime payload. Its Tier 3 rule is sourced from the policy above. The eight legacy scalar assumptions are deliberately unchanged to avoid silently modifying other products or estimates. They are **not** certified as the complete current credit policy. No placeholder rate table is published. The `_provenance` field is stored audit metadata; only validated calculator fields drive calculations.

Publish a versioned `calculator_assumptions` row and a published `deal_engine` / `calculator_assumptions_rule_set` binding to that exact row. Publishing a rule alone does not create or retarget its binding. Preserve the existing rural rule and both rural bindings. Read back the rule, binding, and exact payload after publication. Do not run the broad initial-data seed.

## Regression example

Purchase price $517,500; future rehab $27,500; ARV $680,000; Tier 3; borrowing rehab funds; FICO blank.

| Scenario | Acquisition | Rehab | Total |
| --- | ---: | ---: | ---: |
| Maximum / original $493,250 request | $439,875 | $27,500 | $467,375 |
| Kayla's lower manual $467,300 request | $439,800 | $27,500 | $467,300 |

Calculation: 85% × $517,500 = $439,875; full rehab $27,500; total $467,375 is below 75% × $680,000 = $510,000. The lower manual request is honored, with the $75 difference taken from acquisition rather than reducing the holdback. Initial LTC is acquisition divided by purchase price for this example; future rehab is not added to that acquisition basis. No prior improvements, assignment fees, or seller concessions were supplied.

Additional checks: ARV-binding requests, lower requested amounts, rehab-first allocation, cents rounding, missing/invalid tier configuration, unchanged Tier 1/2 and refinance calculations, manual input preservation, and the FICO-missing warning. Configured Tier 3 requests whose total cannot fund the full SOW holdback must be marked for review and have policy-backed amounts withheld.

## Rollback boundary

Before repair, there was no calculator rule or binding to restore. To disable this configuration without deleting audit history, archive only this repair's exact calculator binding and rule IDs after checking for newer versions. New code must withhold Tier 3 policy-backed amounts when its rule is absent. Do not roll back to the old proportional Tier 3 calculation as an unqualified current-policy result.

## Separate access-control finding

The existing policy tables grant writes to anonymous/authenticated API roles and have row-level security disabled. This repair does not modify grants, RLS, or API exposure. A separate authorized security review/remediation is required; do not treat successful calculation tests as a security sign-off.

## Execution record

Staged in production as draft (not yet active at the time of this record):

- Rule ID: `3ac472b1-48ce-4675-936b-d1aa2682a970`
- Binding ID: `7d82c923-7c7d-40c3-8c17-9796e18d5ada`

Publication is gated on regression tests and the production build. Final deployment status, read-back verification, and live example amounts must be confirmed in the repair handoff; draft creation alone is not completion.
