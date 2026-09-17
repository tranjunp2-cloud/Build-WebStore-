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
