import {
  buildProductCatalogFromSource,
  type CatalogResult,
} from "../../pw2-product-eav.mjs";
import type { MappingContext, Row } from "../contracts";

interface CatalogIndex {
  skus: Map<string, Row[]>;
  domains: Map<string, Row[]>;
  selections: Map<string, Row[]>;
  attributes: Map<string, Row>;
  values: Map<string, Row>;
  results: Map<string, CatalogResult>;
}
const indexes = new WeakMap<Readonly<Record<string, Row[]>>, CatalogIndex>();
function group(rows: Row[], field: string): Map<string, Row[]> {
  const result = new Map<string, Row[]>();
  for (const row of rows) {
    const key = row[field] ?? "";
    const list = result.get(key) ?? [];
    list.push(row);
    result.set(key, list);
  }
  return result;
}
/** Build source indexes once per immutable source snapshot; do not rescan all EAV rows per Product or Order item. */
export function sourceCatalog(
  ctx: MappingContext,
  product: Row,
): CatalogResult {
  let index = indexes.get(ctx.tables);
  if (!index) {
    index = {
      skus: group(ctx.tables.product_skus ?? [], "product_id"),
      domains: group(ctx.tables.product_attributes ?? [], "product_id"),
      selections: group(ctx.tables.product_variants ?? [], "product_sku_id"),
      attributes: new Map(
        (ctx.tables.attributes ?? []).map((row) => [row.id ?? "", row]),
      ),
      values: new Map(
        (ctx.tables.attribute_values ?? []).map((row) => [row.id ?? "", row]),
      ),
      results: new Map(),
    };
    indexes.set(ctx.tables, index);
  }
  const id = product.id ?? "",
    cacheKey =
      ctx.config.sourceInstanceToken +
      "\0" +
      id +
      "\0" +
      Boolean(ctx.config.migrationPolicy?.allowSparseVariants);
  const cached = index.results.get(cacheKey);
  if (cached) return cached;
  const skus = index.skus.get(id) ?? [],
    domains = index.domains.get(id) ?? [];
  const selections = skus.flatMap(
    (row) => index!.selections.get(row.id ?? "") ?? [],
  );
  const ids = new Set(
      [...domains, ...selections].map((row) => row.attribute_id ?? ""),
    ),
    valueIds = new Set(
      [...domains, ...selections].map((row) => row.attribute_value_id ?? ""),
    );
  const tables = {
    product_skus: skus,
    product_attributes: domains,
    product_variants: selections,
    attributes: [...ids].flatMap((id) =>
      index!.attributes.has(id) ? [index!.attributes.get(id)!] : [],
    ),
    attribute_values: [...valueIds].flatMap((id) =>
      index!.values.has(id) ? [index!.values.get(id)!] : [],
    ),
  };
  const result = buildProductCatalogFromSource(
    product,
    tables,
    ctx.config.sourceInstanceToken,
    { allowSparseVariants: ctx.config.migrationPolicy?.allowSparseVariants },
  );
  index.results.set(cacheKey, result);
  return result;
}
