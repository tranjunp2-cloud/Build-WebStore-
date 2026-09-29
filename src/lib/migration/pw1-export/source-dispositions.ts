import { PAGE_MENU_SCOPE_RULE, PAGE_MENU_SCOPE_CODE, PAGE_MENU_TABLES, TECHNICAL_SCOPE_RULE, TECHNICAL_SCOPE_CODE, TECHNICAL_TABLES } from './approved-source-scope';
import { MODEL_SETTINGS_RETAIN_RULE, MODEL_SETTINGS_RETAIN_CODE, modelSettingsSecurityField } from './model-settings-scope';
import { SOURCE_EXCLUSION_RULE, sourceExclusionDiagnostic, sourceExclusionKey, sourceExclusionFamily, type SourceExclusion } from './source-exclusions';
import { PRODUCT_EXCLUSION_CODE, PRODUCT_EXCLUSION_RULE, PRODUCT_CATALOG_EXCLUSION_CODE, PRODUCT_CATALOG_EXCLUSION_RULE, type ProductExclusion } from './product-exclusions';
import { compareIds } from './primitives';
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
  sourceExclusion?: SourceExclusion;
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
  const sourceOnlyMedia = new Set(diagnostics.filter(d => d.code === 'MEDIA_SOURCE_ONLY' && d.table === 'medias' && d.severity === 'warning' && d.storeId && d.sourceId && ['DELETED','FOLDER','EMPTY_URL'].includes(d.reason ?? '')).map(d => JSON.stringify([d.storeId,d.sourceId])));
  for (const file of source.files) if (file.selected && file.table && TECHNICAL_TABLES.has(file.table)) diagnostics.push({ code: TECHNICAL_SCOPE_CODE, table: file.table, severity: 'warning' });
  for (const file of source.files) if (file.selected && file.table && PAGE_MENU_TABLES.has(file.table)) diagnostics.push({ code: PAGE_MENU_SCOPE_CODE, table: file.table, severity: 'warning' });
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
  const canonicalByProduct = new Map<string,string>();
  const firstBySlug = new Map<string,string>();
  for (const row of [...(source.tables.products ?? [])].filter(row => !row.deleted_at && row.id && row.slug?.trim()).sort((a,b) => compareIds(a.id!, b.id!))) {
    const key = JSON.stringify([row.store_id, row.slug!.trim().toLowerCase()]);
    if (!firstBySlug.has(key)) firstBySlug.set(key, row.id!);
    canonicalByProduct.set(row.id!, firstBySlug.get(key)!);
  }
  const excludedProducts = new Map(diagnostics.filter(d => [PRODUCT_EXCLUSION_CODE, PRODUCT_CATALOG_EXCLUSION_CODE].includes(d.code) && d.storeId && d.sourceId).map(d => [`${d.storeId}:${d.sourceId}`, { productId: d.sourceId!, reason: d.reason as ProductExclusion['reason'], ...(d.reason === 'DUPLICATE_PRODUCT_SLUG' ? { canonicalProductId: canonicalByProduct.get(d.sourceId!) } : {}) }]));
  const excludedSources = new Map(diagnostics.flatMap(d => { const ex=sourceExclusionDiagnostic(d); return ex ? [[sourceExclusionKey(ex.table,ex.sourceId),ex] as const] : [] }));
  const sourceRows = new Map(Object.entries(source.tables).flatMap(([table,rows]) => rows.filter(row=>row.id).map(row=>[sourceExclusionKey(table,row.id!),row] as const)));
  const result: RowDisposition[] = [];
  const classifier = createSourceClassifier(source.tables, source.config, diagnostics, new Set(contributions.filter(c => c.table === 'orders' && c.rule === 'master-7.2' && c.targetPath === `@orders:orders:${c.sourceId}`).map(c => c.sourceId)));
  for (const file of source.files.filter((f) => f.selected)) {
    const table = file.table!,
      rows = source.tables[table];
    if (table === 'model_settings') diagnostics.push({ code: MODEL_SETTINGS_RETAIN_CODE, table, severity: 'warning' });
    if (!SOURCE_HEADERS[table])
      diagnostics.push({
        code: "UNKNOWN_SOURCE_TABLE",
        severity: "blocker",
        table,
      });
    for (const field of file.headers)
      if (table !== 'model_settings' && !TECHNICAL_TABLES.has(table) && !PAGE_MENU_TABLES.has(table) && !SOURCE_HEADERS[table]?.includes(field))
        diagnostics.push({
          code: "UNKNOWN_SOURCE_FIELD",
          severity: "blocker",
          table,
          field,
        });
    const unresolved = new Set<string | null>();
    rows.forEach((row: Row, index) => {
      const sourceId = row.id ?? `record:${index + 1}`;
      let used = links.get(`${table}\0${sourceId}`) ?? [];
      const owner = classifier.ownership(table, row);
      const fieldRetentionRules: Record<string, string> = Object.create(null);
      let sourceExclusion: SourceExclusion | undefined;
      let cursorTable=table, cursorRow: Row | undefined=row;
      const seenParents=new Set<string>();
      while(cursorRow){
        const key=sourceExclusionKey(cursorTable,cursorRow.id??'');if(seenParents.has(key))break;seenParents.add(key);
        const ex=excludedSources.get(key);
        if(ex && sourceExclusionFamily(ex.table,table)){sourceExclusion=ex;break;}
        const cursorOwner=classifier.ownership(cursorTable,cursorRow);
        if(!cursorOwner.parentTable||!cursorOwner.parentId)break;
        cursorTable=cursorOwner.parentTable;cursorRow=sourceRows.get(sourceExclusionKey(cursorTable,cursorOwner.parentId));
      }
      if (table === 'model_settings' || TECHNICAL_TABLES.has(table)) sourceExclusion = undefined;
      if(sourceExclusion && used.every(c=>c.rule===EXTERNAL_SOURCE_RULE)) used=[];
      if(sourceExclusion && (used.length || !file.headers.every(field=>SOURCE_HEADERS[table]?.includes(field)))) sourceExclusion=undefined;
      if (owner.rule.startsWith('OWNERSHIP_')) diagnostics.push({
        code: 'SOURCE_OWNERSHIP_UNRESOLVED', severity: sourceExclusion || table === 'model_settings' || TECHNICAL_TABLES.has(table) || PAGE_MENU_TABLES.has(table) ? 'warning' : 'blocker', table, sourceId, reason: owner.rule,
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
      const productExclusion = table !== 'model_settings' && !TECHNICAL_TABLES.has(table) && !sourceExclusion && !owner.rule.startsWith('OWNERSHIP_') && owner.storeId && productId && used.length === 0 && file.headers.every(field => SOURCE_HEADERS[table]?.includes(field)) ? excludedProducts.get(`${owner.storeId}:${productId}`) : undefined;
      const mappedUsed = used.filter(c => c.rule !== EXTERNAL_SOURCE_RULE);
      const fields: Record<string, string> = Object.create(null);
      for (const field of file.headers) {
        const hasMapping = mappedUsed.some((c) => c.fields.includes(field));
        const external = !owner.rule.startsWith('OWNERSHIP_') && externalSourceField(table, field) && used.some(c => c.rule === EXTERNAL_SOURCE_RULE && c.targetPath === externalSourcePath(table) && c.fields.includes(field));
        const retentionRule = PAGE_MENU_TABLES.has(table) ? PAGE_MENU_SCOPE_RULE : TECHNICAL_TABLES.has(table) ? TECHNICAL_SCOPE_RULE : table === 'model_settings' ? MODEL_SETTINGS_RETAIN_RULE : sourceExclusion ? SOURCE_EXCLUSION_RULE : productExclusion ? (['DUPLICATE_PRODUCT_SLUG', 'NO_VALID_VARIANTS', 'MISSING_VARIANT_DOMAIN', 'INACTIVE_CATEGORY'].includes(productExclusion.reason) ? PRODUCT_CATALOG_EXCLUSION_RULE : PRODUCT_EXCLUSION_RULE) : external ? EXTERNAL_SOURCE_RULE : classifier.retention(table, row, field, owner);
        const securityField = (table === 'model_settings' || TECHNICAL_TABLES.has(table) || PAGE_MENU_TABLES.has(table)) ? modelSettingsSecurityField(field) : SECRET_FIELDS.has(field);
        if (retentionRule && !hasMapping && !securityField) fieldRetentionRules[field] = retentionRule;
        fields[field] = securityField
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
      const disposition = (PAGE_MENU_TABLES.has(table) && mappedUsed.length === 0) || TECHNICAL_TABLES.has(table) || (table === 'model_settings' && mappedUsed.length === 0) || sourceExclusion || productExclusion || (table === 'medias' && sourceOnlyMedia.has(JSON.stringify([owner.storeId, sourceId]))) ? "retained-source" : pending
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
        ...(sourceExclusion ? { sourceExclusion } : {}),
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
