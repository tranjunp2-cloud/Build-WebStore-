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
  const categories = ctx
    .rows("categories")
    .filter((row) => live(row) && (!activeOnly || row.status !== "0"));
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
      if (
        categories.some(
          (other) =>
            other.id !== row.id &&
            (other.slug === row.slug ||
              (effectiveParent.get(other.id ?? "") === effectiveParent.get(row.id ?? "") &&
                other.name?.trim().toLowerCase() ===
                  row.name?.trim().toLowerCase())),
        )
      )
        throw new Error(
          categories.some(
            (other) => other.id !== row.id && other.slug === row.slug,
          )
            ? "DUPLICATE_SLUG_IN_STORE"
            : "DUPLICATE_SIBLING_NAME",
        );
      const doc: Doc = {
        _ref: ref("categories", "categories", row.id),
        tenant,
        site,
        name: row.name,
        slug: row.slug,
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
  for (const row of ctx.rows("products").filter(live)) {
    try {
      if (!row.id) throw new Error("PRODUCT_ID");
      if (
        activeOnly &&
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
      const sourceCategory = ctx.find("categories", row.category_id);
      const omittedCategory =
        activeOnly &&
        sourceCategory?.store_id === ctx.storeId &&
        live(sourceCategory) &&
        sourceCategory.status === "0";
      if (omittedCategory)
        ctx.issue(
          "PRODUCT_INACTIVE_CATEGORY_OMITTED",
          "products",
          row.id,
          "category_id",
          "warning",
        );
      const catalog = sourceCatalog(ctx, row);
      if (catalog.errors.length) {
        for (const error of catalog.errors)
          ctx.issue(
            error.code,
            "products",
            row.id,
            undefined,
            "blocker",
            error.reason,
          );
        continue;
      }
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
        status: "draft",
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
      const clean = sanitizeProductDocument(doc, row, {
        sourceInstanceToken: ctx.config.sourceInstanceToken,
      });
      // A missing code is distinct from a missing source price row.
      for (const item of [clean, ...((clean.variants as Doc[]) ?? [])]) {
        if (item.sku == null || (typeof item.sku === "string" && !item.sku.trim()))
          delete item.sku;
      }
      if (row.description)
        clean.description = productLexical(ctx, row, "description");
      if (row.description_ms)
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
        (item) => item.product_id === row.id && live(item),
      );
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
          item.status === "1",
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
            "sku",
            "price",
            "stock",
            "status",
          ]),
          `${clean._ref}${variant ? "." + variant.targetPath : ""}`,
          "master-16-sku-crosswalk",
        );
      }
    } catch (error) {
      ctx.issue(
        error instanceof Error && /^PRODUCT_[A-Z_]+$/.test(error.message)
          ? error.message
          : "PRODUCT_MAPPING_INVALID",
        "products",
        row.id,
      );
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
