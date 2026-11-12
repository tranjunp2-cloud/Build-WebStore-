/** SKU length limits shared by server and AI code. The product form keeps its own copy of these numbers. */
export const BASE_SKU_MAX = 50
export const VARIANT_SKU_MAX = 100

export const BASE_SKU_TOO_LONG_MESSAGE = `Base SKU must be ${BASE_SKU_MAX} characters or fewer`
export const VARIANT_SKU_TOO_LONG_MESSAGE = `Variant SKU must be ${VARIANT_SKU_MAX} characters or fewer`
