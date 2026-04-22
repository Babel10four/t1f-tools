import type { DealPurpose } from "../schemas/deal-analyze-constants";
import { V1_SUPPORTED_PRODUCT_TYPE } from "../schemas/deal-engine-v1-enums";

export function isSupportedV1Product(
  purpose: DealPurpose,
  productType: string,
): boolean {
  return (
    (purpose === "purchase" &&
      productType === V1_SUPPORTED_PRODUCT_TYPE.purchase) ||
    (purpose === "refinance" &&
      productType === V1_SUPPORTED_PRODUCT_TYPE.refinance)
  );
}

/** Alias for policy orchestration readability (same semantics as `isSupportedV1Product`). */
export const supportedProduct = isSupportedV1Product;
