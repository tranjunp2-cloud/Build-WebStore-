import { live, type Row } from "../contracts";

/** True only for an entirely understood, owned, live but inactive SKU set. */
export function inactiveOnlyProduct(product: Row, skus: Row[]): boolean {
  const rows = skus.filter((sku) => sku.product_id === product.id && live(sku));
  return (
    rows.length > 0 &&
    rows.every((sku) => sku.store_id === product.store_id && sku.status === "0")
  );
}

/** PW1 type 1 is kilograms; type 2 is grams. Never infer an unknown unit. */
export function packageWeightKg(row: Row): number | undefined {
  if (row.package_weight == null || row.package_weight === "") return undefined;
  if (!/^\d+(?:\.\d+)?$/.test(row.package_weight.trim()))
    throw new Error("PRODUCT_WEIGHT_INVALID");
  const weight = Number(row.package_weight);
  if (!Number.isFinite(weight) || weight < 0)
    throw new Error("PRODUCT_WEIGHT_INVALID");
  if (row.package_weight_type === "1") return weight;
  if (row.package_weight_type === "2") return weight / 1000;
  throw new Error("PRODUCT_WEIGHT_UNIT_UNVERIFIED");
}

/** Missing is not invalid: foreign ownership, unknown status and bad numeric values stay blockers. */
export function missingProductData(product: Row, skus: Row[]): import('../product-exclusions').ProductExclusion | undefined {
  if (!product.id || !live(product) || !['0','1'].includes(product.status ?? '')) return undefined
  const owned = skus.filter(s => s.product_id === product.id)
  if (owned.some(s => live(s) && (s.store_id !== product.store_id || !['0','1'].includes(s.status ?? '')))) return undefined
  const eligible = owned.filter(s => live(s) && s.store_id === product.store_id && s.status === '1')
  if (!eligible.length) {
    if (!owned.length) return { productId: product.id, reason: 'NO_SKU_ROWS' }
    if (!owned.some(s => live(s) && s.store_id === product.store_id)) return { productId: product.id, reason: 'NO_LIVE_OWNED_SKU' }
    return undefined
  }
  const absent = (v: string | null | undefined) => v == null || v.trim() === ''
  if (eligible.some(s => (!absent(s.price) && (!Number.isFinite(Number(s.price)) || Number(s.price) < 0 || Number(s.price) > 100_000_000)) || (!absent(s.stock) && (!Number.isInteger(Number(s.stock)) || Number(s.stock) < 0 || Number(s.stock) > 1_000_000)))) return undefined
  const price = eligible.some(s => absent(s.price)), stock = eligible.some(s => absent(s.stock))
  return price || stock ? { productId: product.id, reason: price && stock ? 'MISSING_PRICE_AND_STOCK' : price ? 'MISSING_PRICE' : 'MISSING_STOCK' } : undefined
}
