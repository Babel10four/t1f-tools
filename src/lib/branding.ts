/**
 * System branding — locked in docs/specs/BRANDING-001.md.
 * Hub chrome (BRAND-001): primary line **Vanguard**, secondary **Built by TheFoundry**.
 */
export const PRODUCT_NAME = "Vanguard";
export const PRODUCT_BUILT_BY = "TheFoundry";
export const PRODUCT_DISPLAY_NAME = "Vanguard by TheFoundry";

export const PRODUCT_TAGLINE =
  "Internal tool hub for AE bridge deal workflows.";

export const HUB_BUILT_BY_LINE = "Built by TheFoundry";

export const HUB_PRIMARY_CTA_HREF = "/tools/loan-structuring-assistant";
export const HUB_PRIMARY_CTA_LABEL = "Start with Deal Structuring Copilot";

/** Same as {@link PRODUCT_NAME} — legacy name in specs. */
export const SYSTEM_NAME = PRODUCT_NAME;
/** Same as {@link PRODUCT_BUILT_BY} — legacy name in specs. */
export const BRAND_OWNER = PRODUCT_BUILT_BY;

/** Primary line in shell header and browser title default. */
export const HUB_SYSTEM_NAME = PRODUCT_NAME;

/**
 * Long-form product string (contracts, external references).
 * Hub UI uses {@link HUB_SYSTEM_NAME} + {@link HUB_BUILT_BY_LINE} instead.
 */
export const PRODUCT_EXPRESSION = PRODUCT_DISPLAY_NAME;
