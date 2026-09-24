import { approvedSourceExclusionReason } from '../source-exclusions'
import { missingProductData } from './catalog-policy'
import { PRODUCT_EXCLUSION_CODE, PRODUCT_CATALOG_EXCLUSION_CODE } from '../product-exclusions'
import { inactiveOnlyProduct, packageWeightKg } from "./catalog-policy";
import { productLexical } from "./product-lexical";
import { sourceCatalog } from "./catalog-source";
import {
  sanitizeProductDocument,
  validateProductDocument,
  findProductSkuCollisions,
} from "../../pw2-product-migration.mjs";
import {
  ref,
  live,
  type MappingContext,
  type Doc,
  type Row,
} from "../contracts";
import { timestamp, numberValue, safeUrl, compareIds } from "../primitives";

const fields = (row: Row, names: string[]) =>
  names.filter((name) => name in row);
const dates = (row: Row, ctx: MappingContext) => ({
  createdAt: timestamp(row.created_at, ctx.config),
  updatedAt: timestamp(row.updated_at, ctx.config),
});

export function mapCatalog(ctx: MappingContext): void {
  const tenant = ref("tenants", "stores", ctx.storeId);
  const site = String(ctx.output.sites[0]?._ref ?? "");
  const activeOnly = ctx.config.migrationPolicy?.activeCatalogOnly === true;
  const resolveDuplicateCategorySlugs =
    ctx.config.migrationPolicy?.resolveDuplicateCategorySlugs === true;
  const resolveDuplicateCategoryNames =
    ctx.config.migrationPolicy?.resolveDuplicateCategoryNames === true;
  const categories = ctx
    .rows("categories")
    .filter((row) => live(row) && (!activeOnly || row.status !== "0"))
    .sort((a, b) => compareIds(a.id ?? "", b.id ?? ""));
  const categoryMap = new Map(categories.map((row) => [row.id, row]));
  const promoted = new Set<string>();
  const effectiveParent = new Map<string, string>();
  for (const row of categories) {
    const parentId = row.parent_id && row.parent_id !== "0" ? row.parent_id : "";
    const sourceParent = parentId ? ctx.find("categories", parentId) : undefined;
    const promote = activeOnly &&
      ctx.config.migrationPolicy?.promoteActiveCategoriesToRoot === true &&
      row.status === "1" && sourceParent?.store_id === ctx.storeId &&
      live(sourceParent) && sourceParent.status === "0";
    effectiveParent.set(row.id ?? "", promote ? "" : parentId);
    if (promote) promoted.add(row.id ?? "");
  }
  const seenCategorySlugs = new Map<string, string>();
  const seenSiblingNames = new Map<string, string>();
  for (const row of categories) {
    try {
      if (!row.id || !row.name?.trim() || !row.slug?.trim())
        throw new Error("REQUIRED_FIELD_MISSING");
      if (activeOnly && row.status !== "1") throw new Error("STATUS_UNKNOWN");
      const trail: Row[] = [row];
      let parent = effectiveParent.get(row.id);
      while (parent && parent !== "0") {
        const ancestor = categoryMap.get(parent);
        if (!ancestor) throw new Error("PARENT_MISSING_OR_NOT_LIVE_IN_STORE");
        if (trail.some((item) => item.id === parent))
          throw new Error("PARENT_CYCLE");
        if (trail.length >= 3) throw new Error("TARGET_DEPTH_LIMIT");
        trail.unshift(ancestor);
        parent = effectiveParent.get(parent);
      }
      if (resolveDuplicateCategoryNames) {
        const parentKey = effectiveParent.get(row.id ?? "") ?? "0";
        const normalizedName = row.name.trim().toLowerCase();
        const siblingKey = `${parentKey}::${normalizedName}`;
        const existingOwner = seenSiblingNames.get(siblingKey);
        if (!existingOwner || existingOwner === row.id) {
          seenSiblingNames.set(siblingKey, row.id);
        } else {
          ctx.issue(
            "CATEGORY_SIBLING_NAME_COLLISION_RESOLVED",
            "categories",
            row.id,
            "name",
            "warning",
            "CATEGORY_SIBLING_NAME_COLLISION_RESOLVED",
          );
        }
      } else {
        const hasSiblingDuplicate = categories.some(
          (other) =>
            other.id !== row.id &&
            effectiveParent.get(other.id ?? "") === effectiveParent.get(row.id ?? "") &&
            other.name?.trim().toLowerCase() === row.name?.trim().toLowerCase(),
        );
        if (hasSiblingDuplicate) {
          throw new Error("DUPLICATE_SIBLING_NAME");
        }
      }
      let resolvedSlug = row.slug.trim();
      if (resolveDuplicateCategorySlugs) {
        const normalized = resolvedSlug.toLowerCase();
        const existingOwner = seenCategorySlugs.get(normalized);
        if (!existingOwner || existingOwner === row.id) {
          seenCategorySlugs.set(normalized, row.id);
        } else {
          const suffix = `-C${row.id}`;
          let candidate = `${resolvedSlug}${suffix}`;
          let collisionCounter = 1;
          while (
            seenCategorySlugs.has(candidate.toLowerCase()) &&
            seenCategorySlugs.get(candidate.toLowerCase()) !== row.id
          ) {
            candidate = `${resolvedSlug}-C${row.id}-${collisionCounter}`;
            collisionCounter++;
          }
          seenCategorySlugs.set(candidate.toLowerCase(), row.id);
          ctx.issue(
            "CATEGORY_SLUG_COLLISION_RESOLVED",
            "categories",
            row.id,
            "slug",
            "warning",
            "CATEGORY_SLUG_COLLISION_RESOLVED",
          );
          resolvedSlug = candidate;
        }
      } else {
        const hasSlugDuplicate = categories.some(
          (other) => other.id !== row.id && other.slug === row.slug,
        );
        if (hasSlugDuplicate) {
          throw new Error("DUPLICATE_SLUG_IN_STORE");
        }
      }
      const doc: Doc = {
        _ref: ref("categories", "categories", row.id),
        tenant,
        site,
        name: row.name,
        slug: resolveDuplicateCategorySlugs ? resolvedSlug : row.slug,
        breadcrumbs: trail.map((item) => item.name).join(" > "),
        ...dates(row, ctx),
      };
      const targetParent = effectiveParent.get(row.id);
      if (targetParent)
        doc.parent = ref("categories", "categories", targetParent);
      if (promoted.has(row.id))
        ctx.issue("CATEGORY_INACTIVE_PARENT_PROMOTED", "categories", row.id, "parent_id", "warning");
      if (row.description) doc.description = row.description;
      ctx.output.categories.push(doc);
      ctx.contribute(
        "categories",
        row,
        fields(row, [
          "id",
          "store_id",
          "name",
          "slug",
          "parent_id",
          "description",
          "created_at",
          "updated_at",
        ]),
        String(doc._ref),
        "master-5.1",
      );
      if (row.status !== "1")
        ctx.issue("CATEGORY_STATUS_PARITY", "categories", row.id, "status");
    } catch (error) {
      const reasons = new Set([
        "STATUS_UNKNOWN",
        "REQUIRED_FIELD_MISSING",
        "PARENT_MISSING_OR_NOT_LIVE_IN_STORE",
        "PARENT_CYCLE",
        "TARGET_DEPTH_LIMIT",
        "DUPLICATE_SLUG_IN_STORE",
        "DUPLICATE_SIBLING_NAME",
      ]);
      const reason =
        error instanceof Error && reasons.has(error.message)
          ? error.message
          : "TIMESTAMP_OR_MAPPING_INVALID";
      ctx.issue(
        "CATEGORY_INVALID",
        "categories",
        row.id,
        undefined,
        "blocker",
        reason,
      );
    }
  }
  // Invalid active ancestors still quarantine descendants; only verified inactive parents are promoted above.
  let changed = true;
  while (changed) {
    const refs = new Set(ctx.output.categories.map((doc) => doc._ref));
    const rejected = ctx.output.categories.filter(
      (doc) => doc.parent && !refs.has(doc.parent),
    );
    changed = rejected.length > 0;
    for (const doc of rejected)
      ctx.issue(
        "CATEGORY_PARENT_QUARANTINED",
        "categories",
        String(doc._ref).split(":").at(-1),
      );
    ctx.output.categories = ctx.output.categories.filter(
      (doc) => !rejected.includes(doc),
    );
  }
  const skusByProduct = new Map<string, Row[]>();
  for (const sku of ctx.tables.product_skus ?? []) {
    const key = sku.product_id ?? "";
    const rows = skusByProduct.get(key) ?? [];
    rows.push(sku);
    skusByProduct.set(key, rows);
  }
  const store = ctx.find("stores", ctx.storeId);
  const currency = ctx.find("currencies", store?.currency_id)?.code ?? "";
  const firstProductBySlug = new Map<string, string>();
  const seenSkusInStore = new Map<string, string>();
  for (const row of ctx.rows("products").filter(live).sort((a, b) => compareIds(a.id ?? "", b.id ?? ""))) {
    const diagnosticStart = ctx.diagnostics.length, contributionStart = ctx.contributions.length;
    const productStart = ctx.output.products.length, mediaStart = ctx.output.media.length;
    try {
      if (!row.id) throw new Error("PRODUCT_ID");
      const slugKey = row.slug?.trim().toLowerCase();
      if (ctx.config.migrationPolicy?.excludeDuplicateProductSlugs && slugKey) {
        if (firstProductBySlug.has(slugKey)) {
          ctx.issue(PRODUCT_CATALOG_EXCLUSION_CODE, "products", row.id, undefined, "warning", "DUPLICATE_PRODUCT_SLUG");
          continue;
        }
        firstProductBySlug.set(slugKey, row.id);
      }
      if (!["0", "1"].includes(row.status ?? "")) {
        ctx.issue("PRODUCT_STATUS_UNVERIFIED", "products", row.id, "status");
        continue;
      }
      if (
        activeOnly &&
        !(row.status === "0" && ctx.config.migrationPolicy?.allowInactiveSkusForInactiveProduct) &&
        inactiveOnlyProduct(row, skusByProduct.get(row.id ?? "") ?? [])
      ) {
        ctx.issue(
          "PRODUCT_INACTIVE_SKUS_EXCLUDED",
          "products",
          row.id,
          undefined,
          "warning",
        );
        continue;
      }
      const exclusion = missingProductData(row, skusByProduct.get(row.id) ?? [], ctx.config.migrationPolicy?.allowInactiveSkusForInactiveProduct);
      if (exclusion) {
        ctx.issue(PRODUCT_EXCLUSION_CODE, "products", row.id, undefined, "warning", exclusion.reason);
        continue;
      }
      const sourceCategory = ctx.find("categories", row.category_id);
      const omittedCategory =
        activeOnly &&
        sourceCategory?.store_id === ctx.storeId &&
        live(sourceCategory) &&
        sourceCategory.status === "0";
      if (omittedCategory && ctx.config.migrationPolicy?.excludeProductsInInactiveCategories) {
        ctx.issue(PRODUCT_CATALOG_EXCLUSION_CODE, "products", row.id, undefined, "warning", "INACTIVE_CATEGORY");
        continue;
      }
      if (omittedCategory)
        ctx.issue(
          "PRODUCT_INACTIVE_CATEGORY_OMITTED",
          "products",
          row.id,
          "category_id",
          "warning",
        );
      const catalog = sourceCatalog(ctx, row);
      if (catalog.errors.length && ctx.config.migrationPolicy?.excludeProductsWithoutValidVariants && catalog.fields.hasVariants === true && Array.isArray(catalog.fields.variants) && catalog.fields.variants.length === 0 && catalog.errors.every(error => ['SOURCE_NO_VALID_VARIANT', 'SOURCE_VARIANT_DOMAIN_MISSING'].includes(error.code))) {
        ctx.issue(PRODUCT_CATALOG_EXCLUSION_CODE, "products", row.id, undefined, "warning", catalog.errors.some(error => error.code === 'SOURCE_VARIANT_DOMAIN_MISSING') ? 'MISSING_VARIANT_DOMAIN' : 'NO_VALID_VARIANTS');
        continue;
      }
      if (catalog.errors.length) {
        for (const error of catalog.errors)
          ctx.issue(
            error.code,
            "products",
            row.id,
            error.reason === "MISSING_PRICE" ? "price" : error.reason === "MISSING_STOCK" ? "stock" : undefined,
            "blocker",
            error.reason,
          );
        continue;
      }
      for (const warning of catalog.warnings) ctx.issue(warning.code, "product_skus", warning.sourceSkuId, undefined, "warning", "CANONICAL_SKU_ALIAS");
      for (const excluded of catalog.excludedSkus) ctx.issue("PRODUCT_VARIANT_SKU_EXCLUDED", "product_skus", excluded.sourceSkuId, undefined, "warning", excluded.reasons[0]);
      const images = (ctx.tables.product_images ?? [])
        .filter((image) => image.product_id === row.id && live(image))
        .sort(
          (a, b) =>
            numberValue(a.order) - numberValue(b.order) ||
            compareIds(a.id ?? "", b.id ?? ""),
        );
      const imageDocs: Doc[] = [];
      for (const image of images) {
        if (image.store_id && image.store_id !== ctx.storeId)
          throw new Error("MEDIA_OWNER");
        const url = safeUrl(image.url);
        const mediaRef = ref("media", "product_images", image.id ?? "");
        if (!image.id) throw new Error("MEDIA_ID");
        if (!ctx.output.media.some((doc) => doc._ref === mediaRef))
          ctx.output.media.push({
            _ref: mediaRef,
            url,
            sourceUrl: url,
            alt: row.name ?? "",
            ...dates(image, ctx),
          });
        imageDocs.push({ image: mediaRef, alt: row.name ?? "" });
        ctx.contribute(
          "product_images",
          image,
          fields(image, [
            "id",
            "product_id",
            "url",
            "order",
            "created_at",
            "updated_at",
          ]),
          mediaRef,
          "master-5.2-images",
        );
      }
      const doc: Doc = {
        _ref: ref("products", "products", row.id),
        tenant,
        site,
        name: row.name?.trim() ?? "",
        slug: row.slug?.trim() ?? "",
        currency,
        status: row.status === "1" ? "active" : "draft",
        halalCertified: false,
        aiReviewPending: false,
        category: omittedCategory
          ? []
          : [ref("categories", "categories", row.category_id ?? "")],
        images: imageDocs,
        tags: [],
        attributes: [],
        ...catalog.fields,
        ...dates(row, ctx),
      };
      if (row.featured_description)
        doc.shortDescription = row.featured_description;
      const weight = packageWeightKg(row);
      if (weight !== undefined) doc.weight = weight;
      const dimensions: Doc = {};
      for (const dimension of ["length", "width", "height"])
        if (row[`package_${dimension}`])
          dimensions[dimension] = numberValue(row[`package_${dimension}`]);
      if (Object.keys(dimensions).length) doc.dimensions = dimensions;
      const clean = sanitizeProductDocument(doc, { ...row, description: null, description_ms: null }, {
        sourceInstanceToken: ctx.config.sourceInstanceToken,
      });
      // A missing code is distinct from a missing source price row.
      for (const item of [clean, ...((clean.variants as Doc[]) ?? [])]) {
        if (item.sku == null || (typeof item.sku === "string" && !item.sku.trim()))
          delete item.sku;
      }
      if (ctx.config.migrationPolicy?.resolveDuplicateSkus) {
        // Preserve untouched sibling codes, even when they resemble a generated suffix.
        const reservedSkus = new Set(
          [clean, ...((clean.variants as Doc[]) ?? [])]
            .map(item => item.sku)
            .filter((sku): sku is string => typeof sku === "string" && Boolean(sku.trim()))
            .map(sku => sku.trim().toLowerCase()),
        );
        const resolveSku = (rawSku: unknown, targetPath: string): string | undefined => {
          if (typeof rawSku !== "string" || !rawSku.trim()) return undefined;
          const trimmed = rawSku.trim();
          const normalized = trimmed.toLowerCase();
          if (!seenSkusInStore.has(normalized)) {
            seenSkusInStore.set(normalized, row.id!);
            return trimmed;
          }
          // Each target field needs a unique code, including siblings in this product.
          const suffix = `-P${row.id}`;
          const maxBaseLength = Math.max(1, 50 - suffix.length);
          let candidate = `${trimmed.slice(0, maxBaseLength)}${suffix}`;
          let collisionCounter = 1;
          while (seenSkusInStore.has(candidate.toLowerCase()) || reservedSkus.has(candidate.toLowerCase())) {
            const indexedSuffix = `-P${row.id}-${collisionCounter}`;
            const maxLen = Math.max(1, 50 - indexedSuffix.length);
            candidate = `${trimmed.slice(0, maxLen)}${indexedSuffix}`;
            collisionCounter++;
          }
          seenSkusInStore.set(candidate.toLowerCase(), row.id!);
          ctx.issue(
            "SKU_COLLISION_RESOLVED",
            "products",
            row.id,
            targetPath,
            "warning",
            "SKU_COLLISION_RESOLVED",
          );
          return candidate;
        };

        if (clean.sku) {
          const resolved = resolveSku(clean.sku, "sku");
          if (resolved) clean.sku = resolved;
        }
        if (Array.isArray(clean.variants)) {
          for (let vi = 0; vi < clean.variants.length; vi++) {
            const v = clean.variants[vi] as Doc;
            if (v.sku) {
              const resolved = resolveSku(v.sku, `variants.${vi}.sku`);
              if (resolved) v.sku = resolved;
            }
          }
        }
      }
      if (row.description != null)
        clean.description = productLexical(ctx, row, "description");
      if (row.description_ms != null)
        clean.descriptionBM = productLexical(ctx, row, "description_ms");
      const errors = validateProductDocument(clean, {
        allowEmptyCategory: omittedCategory,
        tenantRef: tenant,
        siteRefs: new Set([site]),
        categoryRefs: new Set(ctx.output.categories.map((item) => item._ref)),
        mediaRefs: new Set(ctx.output.media.map((item) => item._ref)),
      });
      if (errors.length) {
        for (const error of errors)
          ctx.issue(error.code, "products", row.id, error.path);
        continue;
      }
      ctx.output.products.push(clean);
      const domain = (ctx.tables.product_attributes ?? []).filter(
        (item) => item.product_id === row.id && live(item) && catalog.identities.some(tier => tier.attributeId === item.attribute_id && tier.options.some(option => option.attributeValueId === item.attribute_value_id)),
      );
      for (const entry of (ctx.tables.product_attributes ?? []).filter(item => item.product_id === row.id && live(item) && !domain.includes(item))) {
        const reason = clean.hasVariants ? "UNREFERENCED_TIER" : "SIMPLE_PRODUCT_ATTRIBUTES";
        if ((clean.hasVariants && ctx.config.migrationPolicy?.pruneUnreferencedTiers) || (!clean.hasVariants && ctx.config.migrationPolicy?.treatSingleSkuWithoutSelectionsAsSimple))
          ctx.issue("PRODUCT_VARIANT_DEFINITION_RETAINED", "product_attributes", entry.id, undefined, "warning", reason);
      }
      for (const entry of domain) {
        ctx.contribute(
          "product_attributes",
          entry,
          fields(entry, [
            "id",
            "product_id",
            "attribute_id",
            "attribute_value_id",
          ]),
          String(clean._ref) + ".variantConfigs",
          "master-16-eav-domain",
        );
      }
      const selectedSkuIds = new Set(catalog.skuCrosswalk.map(item => item.sourceSkuId));
      const definitionSources = [...domain, ...(ctx.tables.product_variants ?? []).filter(
        item => selectedSkuIds.has(item.product_sku_id ?? "") && live(item),
      )];
      for (const entry of definitionSources) {
        for (const [table, id] of [
          ["attributes", entry.attribute_id],
          ["attribute_values", entry.attribute_value_id],
        ]) {
          const definition = ctx.find(table!, id);
          if (definition)
            ctx.contribute(
              table!,
              definition,
              fields(definition, [
                "id",
                "store_id",
                "attribute_id",
                "code",
                "name",
                "name_ms",
              ]),
              String(clean._ref) + ".variantConfigs",
              "master-16-eav-definition",
            );
        }
      }
      ctx.contribute(
        "products",
        row,
        fields(row, [
          "id",
          "store_id",
          "name",
          "slug",
          "category_id",
          "description",
          "description_ms",
          "status",
          "featured_description",
          "package_weight",
          ...(weight !== undefined ? ["package_weight_type"] : []),
          "package_length",
          "package_width",
          "package_height",
          "created_at",
          "updated_at",
        ]),
        String(clean._ref),
        "master-5.2",
      );
      for (const sku of (ctx.tables.product_skus ?? []).filter(
        (item) =>
          item.product_id === row.id &&
          item.store_id === ctx.storeId &&
          live(item) &&
          (item.status === "1" || (row.status === "0" && ctx.config.migrationPolicy?.allowInactiveSkusForInactiveProduct && item.status === "0")) &&
          !catalog.excludedSkus.some(excluded => excluded.sourceSkuId === item.id),
      )) {
        const variant = catalog.skuCrosswalk.find(
          (item) => item.sourceSkuId === sku.id,
        );
        for (const entry of (ctx.tables.product_variants ?? []).filter(
          (item) => item.product_sku_id === sku.id && live(item),
        ))
          ctx.contribute(
            "product_variants",
            entry,
            fields(entry, [
              "id",
              "product_sku_id",
              "attribute_id",
              "attribute_value_id",
            ]),
            String(clean._ref) + "." + (variant?.targetPath ?? "variants"),
            "master-16-eav-tuple",
          );
        ctx.contribute(
          "product_skus",
          sku,
          fields(sku, [
            "id",
            "product_id",
            "store_id",
            // Alias identity is mapped, but canonical SKU alone supplies values.
            ...(!variant || catalog.skuCrosswalk.find(item => item.targetId === variant.targetId)?.sourceSkuId === sku.id
              ? ["sku", "price", "stock"] : []),
            "status",
          ]),
          `${clean._ref}${variant ? "." + variant.targetPath : ""}`,
          "master-16-sku-crosswalk",
        );
      }
    } catch (error) {
      const sourceReason = error instanceof Error && approvedSourceExclusionReason('products', error.message) ? error.message : undefined;
      ctx.issue(
        sourceReason ?? (error instanceof Error && /^PRODUCT_[A-Z_]+$/.test(error.message) ? error.message : "PRODUCT_MAPPING_INVALID"),
        "products", row.id, undefined, 'blocker', sourceReason ? undefined : 'UNEXPECTED_MAPPING_ERROR',
      );
    } finally {
      const issues = ctx.diagnostics.slice(diagnosticStart).filter(d => d.severity === 'blocker');
      if (ctx.config.migrationPolicy?.excludeInvalidProducts && row.id && issues.length && issues.every(d => d.table === 'products' && d.sourceId === row.id && approvedSourceExclusionReason('products', d.code))) {
        ctx.output.products.length = productStart;
        ctx.output.media.length = mediaStart;
        ctx.contributions.splice(contributionStart);
        ctx.diagnostics.splice(diagnosticStart);
        for (const [key, owner] of seenSkusInStore) if (owner === row.id) seenSkusInStore.delete(key);
        ctx.issue('SOURCE_ENTITY_EXCLUDED', 'products', row.id, undefined, 'warning', issues[0].code);
      }
    }
  }
  const collisions = findProductSkuCollisions(ctx.output.products);
  if (collisions.size) {
    // Validation reports all colliding products; never keep whichever CSV row appeared first.
    const refs = new Set(collisions.keys());
    for (const product of ctx.output.products.filter((doc) =>
      refs.has(String(doc._ref)),
    ))
      ctx.issue(
        "PRODUCT_SKU_COLLISION",
        "products",
        String(product._ref).split(":").at(-1),
      );
    ctx.output.products = ctx.output.products.filter(
      (doc) => !refs.has(String(doc._ref)),
    );
  }
}
