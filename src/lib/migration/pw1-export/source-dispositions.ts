import { PRODUCT_EXCLUSION_CODE, PRODUCT_EXCLUSION_RULE, type ProductExclusion } from './product-exclusions';
import { EXTERNAL_SOURCE_RULE, externalSourceField, externalSourcePath } from './external-source';
import { createSourceClassifier, type Ownership } from './source-classification';
import { inactiveOnlyProduct } from "./mappers/catalog-policy";
import type { Contribution, Diagnostic, Row } from "./contracts";
import type { LoadedSource } from "./csv-loader";
import {
  ARCHIVE_TABLES,
  SECRET_FIELDS,
  SOURCE_HEADERS,
} from "./source-registry";
export interface RowDisposition {
  productExclusion?: ProductExclusion;
  table: string;
  sourceId: string;
  storeId: string | null;
  record: number;
  disposition:
    | "mapped"
    | "partial"
    | "retained-source"
    | "excluded"
    | "unresolved";
  fields: Record<string, string>;
  contributions: Contribution[];
  ownership?: Ownership;
  fieldRetentionRules?: Record<string, string>;
}
export function dispositions(
  source: LoadedSource,
  contributions: Contribution[],
  diagnostics: Diagnostic[],
): RowDisposition[] {
  const links = new Map<string, Contribution[]>();
  for (const c of contributions) {
    const key = `${c.table}\0${c.sourceId}`;
    const list = links.get(key) ?? [];
    list.push(c);
    links.set(key, list);
  }
  const skuById = new Map(
    (source.tables.product_skus ?? []).map((row) => [row.id, row]),
  );
  const skusByProduct = new Map<string, Row[]>();
  for (const sku of source.tables.product_skus ?? []) {
    const key = sku.product_id ?? "";
    const rows = skusByProduct.get(key) ?? [];
    rows.push(sku);
    skusByProduct.set(key, rows);
  }
  const excludedProducts = new Map(diagnostics.filter(d => d.code === PRODUCT_EXCLUSION_CODE && d.storeId && d.sourceId).map(d => [`${d.storeId}:${d.sourceId}`, { productId: d.sourceId!, reason: d.reason as ProductExclusion['reason'] }]));
  const result: RowDisposition[] = [];
  const classifier = createSourceClassifier(source.tables, source.config, diagnostics);
  for (const file of source.files.filter((f) => f.selected)) {
    const table = file.table!,
      rows = source.tables[table];
    if (!SOURCE_HEADERS[table])
      diagnostics.push({
        code: "UNKNOWN_SOURCE_TABLE",
        severity: "blocker",
        table,
      });
    for (const field of file.headers)
      if (!SOURCE_HEADERS[table]?.includes(field))
        diagnostics.push({
          code: "UNKNOWN_SOURCE_FIELD",
          severity: "blocker",
          table,
          field,
        });
    const unresolved = new Set<string | null>();
    rows.forEach((row: Row, index) => {
      const sourceId = row.id ?? `record:${index + 1}`,
        used = links.get(`${table}\0${sourceId}`) ?? [];
      const owner = classifier.ownership(table, row);
      const fieldRetentionRules: Record<string, string> = Object.create(null);
      if (owner.rule.startsWith('OWNERSHIP_')) diagnostics.push({
        code: 'SOURCE_OWNERSHIP_UNRESOLVED', severity: 'blocker', table, sourceId, reason: owner.rule,
      });
      const policy = source.config.migrationPolicy;
      const approvedRetention =
        (policy?.deferredStoreIds?.includes((table === "stores" ? row.id : row.store_id) ?? "") ?? false) ||
        (policy?.deferEmailTemplates && table === "store_email_templates") ||
        (policy?.activeCatalogOnly &&
          (((table === "categories" || table === "product_skus") &&
            row.status === "0") ||
            (table === "products" &&
              inactiveOnlyProduct(
                row,
                skusByProduct.get(row.id ?? "") ?? [],
              )) ||
            (table === "product_variants" &&
              skuById.get(row.product_sku_id)?.status === "0")));
      const productId = table === 'products' ? row.id : ['product_skus','product_attributes','product_images'].includes(table) ? row.product_id : ['product_variants','product_sku_images','product_sku_promotion_prices'].includes(table) ? skuById.get(row.product_sku_id)?.product_id : table === 'model_settings' && owner.parentTable === 'products' ? owner.parentId : undefined;
      const productExclusion = !owner.rule.startsWith('OWNERSHIP_') && owner.storeId && productId && used.length === 0 && file.headers.every(field => SOURCE_HEADERS[table]?.includes(field)) ? excludedProducts.get(`${owner.storeId}:${productId}`) : undefined;
      const mappedUsed = used.filter(c => c.rule !== EXTERNAL_SOURCE_RULE);
      const fields: Record<string, string> = Object.create(null);
      for (const field of file.headers) {
        const hasMapping = mappedUsed.some((c) => c.fields.includes(field));
        const external = !owner.rule.startsWith('OWNERSHIP_') && externalSourceField(table, field) && used.some(c => c.rule === EXTERNAL_SOURCE_RULE && c.targetPath === externalSourcePath(table) && c.fields.includes(field));
        const retentionRule = productExclusion ? PRODUCT_EXCLUSION_RULE : external ? EXTERNAL_SOURCE_RULE : classifier.retention(table, row, field, owner);
        if (retentionRule && !hasMapping && !SECRET_FIELDS.has(field)) fieldRetentionRules[field] = retentionRule;
        fields[field] = SECRET_FIELDS.has(field)
          ? "security-excluded"
          : hasMapping
            ? "mapped"
            : retentionRule || approvedRetention ||
                ARCHIVE_TABLES.has(table) ||
                (table === "notifications" &&
                  source.config.acceptedExclusions?.some(
                    (e) => e.collection === "notifications",
                  ))
              ? "retained-source"
              : row.deleted_at
                ? "deleted-retained-source"
                : table === "users" && row.is_frontend === "1"
                  ? "technical-user-excluded"
                  : field === "id" || field === "store_id"
                    ? "source-identity"
                    : "unresolved";
      }
      const pending = Object.values(fields).includes("unresolved");
      if (pending) unresolved.add(owner.storeId);
      const disposition = productExclusion ? "retained-source" : pending
        ? mappedUsed.length
          ? "partial"
          : "unresolved"
        : mappedUsed.length
          ? "mapped"
          : row.deleted_at || row.is_frontend === "1"
            ? "excluded"
            : "retained-source";
      result.push({
        ...(productExclusion ? { productExclusion } : {}),
        table,
        sourceId,
        storeId: owner.storeId,
        ownership: owner,
        ...(Object.keys(fieldRetentionRules).length ? { fieldRetentionRules } : {}),
        record: index + 1,
        disposition,
        fields,
        contributions: used,
      });
    });
    for (const storeId of unresolved)
      diagnostics.push({
        code: "SOURCE_FIELDS_UNRESOLVED",
        severity: "blocker",
        table,
        ...(storeId ? { storeId } : {}),
      });
  }
  return result;
}
