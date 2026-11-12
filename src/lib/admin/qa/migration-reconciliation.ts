/**
 * Server contract for the Commerce and Settings migration reconciliation UI.
 *
 * A future migration mapping implementation must provide evidence through this
 * contract. The UI must never infer a match from SKU, email, or order number.
 */

export const RECONCILIATION_SCOPES = ["commerce", "settings"] as const;
export type ReconciliationScope = (typeof RECONCILIATION_SCOPES)[number];

export const RECONCILIATION_STATUSES = [
  "match",
  "missing",
  "mismatch",
  "duplicate",
  "unsupported",
  "unverified",
] as const;
export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];

export type ReconciliationEntity =
  | "products"
  | "orders"
  | "discounts"
  | "customers"
  | "account_profile"
  | "team_members"
  | "email_templates"
  | "payments"
  | "delivery"
  | "web_address"
  | "app_integrations";

export type ReconciliationRecord = {
  sourceEntity: ReconciliationEntity;
  sourceId: string;
  /** Opaque, run-bound selector for privileged record evidence; never a raw source ID. */
  reference?: string;
  targetCollection: string | null;
  /** One or more confirmed PW2 identifiers; never encode multiples in a string. */
  targetIds: string[];
  label: string;
  /** Safe business-field sample from the same F42 generation, attached after sanitization. */
  preview?: { label: string; pw1: string | null; pw2: string | null; status: ReconciliationStatus; explanation?: string };
  status: ReconciliationStatus;
  reason: string;
  fields: Array<{
    section?: string;
    /** PW1 source table.column; rendered only as mapping metadata. */
    sourceKey?: string;
    /** PW2 target collection.field when an approved mapping exists. */
    targetKey?: string;
    label: string;
    pw1: string | null;
    pw2: string | null;
    status: ReconciliationStatus;
  }>;
  relations?: Array<{
    label: string;
    pw1Total: number;
    pw2Total: number;
    status: ReconciliationStatus;
  }>;
};

export type ReconciliationSummary = Record<ReconciliationStatus, number> & {
  pw1Total: number;
  pw2Total: number;
};

export type ReconciliationSnapshot = {
  scope: ReconciliationScope;
  storeId: string | null;
  generatedAt: string;
  evidence: {
    available: boolean;
    mode: "unavailable" | "demo" | "verified";
    contractVersion: string | null;
    message: string;
  };
  /** F42 field generation used for the visible previews and record drill-down. */
  fieldGeneration?: { generationId: string; digest: string };
  summary: ReconciliationSummary;
  records: ReconciliationRecord[];
};

/** Safe run selector DTO. It is intentionally free of source provenance. */
export type ReconciliationRun = {
  runId: string;
  storeId: string;
  updatedAt: string;
};

/** Safe issue DTO. Source identifiers and exception detail never reach the UI. */
export type ReconciliationIssue = {
  id: string;
  sourceEntity: string;
  isRunLevel: boolean;
  severity: "WARNING" | "BLOCKER";
  errorCode: string;
};

export type MigrationEvidenceProvider = {
  getSnapshot(input: {
    scope: ReconciliationScope;
    storeId: string | null;
    /**
     * F42 ledger run selected explicitly by an authorised operator. Never use
     * a "latest run" fallback: different runs can belong to the same store.
     */
    runId?: string | null;
  }): Promise<ReconciliationSnapshot>;
};

const SECRET_FIELD_PATTERN = /(password|secret|token|api[_-]?key|key_string|dns_token|credential|authorization|private[_-]?key|signing[_-]?key)/i;
const PII_FIELD_PATTERN = /(email|phone|hotline|address|post_code|postal|customer_name|account_name|account_id)/i;
const MAX_DISPLAY_TEXT_LENGTH = 240;
const PUBLIC_ID_PATTERN = /^[A-Za-z0-9:_-]{1,128}$/;
const INTERNAL_RECORD_ID_PATTERN = /^(?:\d{1,19}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
/**
 * Immutable, Security-reviewed field registry for real adapter output. Add a
 * key only with the mapping-contract change that documents its classification.
 */
export const APPROVED_RECONCILIATION_FIELD_KEYS = [
  "products.name",
  "products.slug",
  "products.status",
  "products.package_length",
  "products.package_width",
  "products.package_height",
  "products.package_weight",
  "product_skus.sku",
  "product_skus.price",
  "product_skus.cost",
  "product_skus.status",
  "promotions.name",
  "promotions.start_date",
  "promotions.end_date",
  "promotions.discount_value",
  "orders.code",
  "orders.currency_id",
  "orders.sub_total",
  "orders.total_discount",
  "orders.total_shipping",
  "orders.total_tax",
  "orders.status",
] as const;
const PUBLIC_FIELD_ALLOWLIST = new Set<string>(APPROVED_RECONCILIATION_FIELD_KEYS);
const ENTITY_TARGET_COLLECTIONS: Record<ReconciliationEntity, readonly string[]> = {
  products: ["products"],
  orders: ["orders"],
  discounts: ["discounts"],
  customers: ["customers"],
  account_profile: ["sites"],
  team_members: ["users"],
  email_templates: ["email-template-settings"],
  payments: ["payments"],
  delivery: ["sites"],
  web_address: ["domains"],
  app_integrations: ["integrations"],
};

const SAFE_STATUS_REASONS: Record<ReconciliationStatus, string> = {
  match: "Có đúng một bản ghi PW2 được evidence xác nhận tương ứng với PW1.",
  missing: "Có bản ghi ở PW1 nhưng chưa có bản ghi PW2 được evidence xác nhận.",
  mismatch: "Đã có mapping định danh, nhưng ít nhất một trường cho kết quả khác.",
  duplicate: "Một bản ghi PW1 đang được evidence nối với nhiều bản ghi PW2.",
  unsupported: "PW2 chưa có trường hoặc cấu trúc tương ứng để đối soát.",
  unverified: "Chưa có evidence mapping định danh để kết luận migration.",
};

function isStatus(value: unknown): value is ReconciliationStatus {
  return typeof value === "string" && RECONCILIATION_STATUSES.includes(value as ReconciliationStatus);
}

function toSafeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, MAX_DISPLAY_TEXT_LENGTH) || null;
}

function maskPii(value: string | null): string | null {
  if (!value) return value;
  const email = value.match(/^([^@\s]+)@([^@\s]+)$/);
  if (email) return `${email[1].slice(0, 1)}***@${email[2]}`;
  return "••••";
}

function isPublicIdentifier(value: unknown): value is string {
  const identifier = toSafeText(value);
  return Boolean(identifier && PUBLIC_ID_PATTERN.test(identifier));
}

function toPublicLabel(value: unknown, isPersonRecord: boolean, isTrustedDemo: boolean): string {
  const label = toSafeText(value);
  if (!isTrustedDemo || !label || isPersonRecord || SECRET_FIELD_PATTERN.test(label) || PII_FIELD_PATTERN.test(label)) {
    return "Bản ghi đã che dữ liệu";
  }
  return label;
}

function normalizedStatus(status: unknown, targetIds: string[]): ReconciliationStatus {
  if (!isStatus(status)) return "unverified";
  if (status === "match" && targetIds.length !== 1) return "unverified";
  if (status === "missing" && targetIds.length !== 0) return "unverified";
  if (status === "duplicate" && targetIds.length < 2) return "unverified";
  if (status === "mismatch" && targetIds.length !== 1) return "unverified";
  return status;
}

function hasValidMappingIdentity(record: ReconciliationRecord): boolean {
  if (!isPublicIdentifier(record.sourceId)) return false;
  const targetIds = Array.isArray(record.targetIds) ? record.targetIds : [];
  if (!targetIds.every(isPublicIdentifier) || new Set(targetIds).size !== targetIds.length) return false;
  if (targetIds.length === 0) return record.targetCollection === null;
  const allowedCollections = ENTITY_TARGET_COLLECTIONS[record.sourceEntity];
  return record.targetCollection !== null && Boolean(allowedCollections?.includes(record.targetCollection));
}

/**
 * Converts adapter output into the public, Tester-facing DTO. This boundary is
 * deliberately defensive: values for credentials are removed, PII is masked,
 * and adapter-provided prose is replaced with an approved status explanation.
 */
export function sanitizeReconciliationSnapshot(
  snapshot: ReconciliationSnapshot,
  options: {
    allowDemoFixture?: boolean;
    /** Adds run-bound extras from the original record, so callers never pair by array index. */
    decorateRecord?: (original: ReconciliationRecord) => Pick<ReconciliationRecord, "reference" | "preview">;
  } = {},
): ReconciliationSnapshot {
  const isTrustedDemo = options.allowDemoFixture === true && snapshot.evidence?.mode === "demo";
  const mode = isTrustedDemo ? "demo" : snapshot.evidence?.mode === "verified" ? "verified" : "unavailable";
  const records = Array.isArray(snapshot.records) ? snapshot.records.map((record, recordIndex) => {
    const identityValid = hasValidMappingIdentity(record);
    const targetIds = identityValid ? record.targetIds : [];
    const status = identityValid ? normalizedStatus(record.status, targetIds) : "unverified";
    const displayTargetIds = status === "unverified" ? [] : targetIds;
    const isPersonRecord = record.sourceEntity === "customers" || record.sourceEntity === "team_members";
    // The reconciliation workspace is Super Admin-only. Numeric/UUID internal
    // IDs are useful crosswalks; personal field values remain protected below.
    const showInternalIds = !isTrustedDemo && snapshot.scope === "commerce";
    const fields = Array.isArray(record.fields) ? record.fields.flatMap((field) => {
      const key = `${field.sourceKey ?? ""} ${field.targetKey ?? ""} ${field.label ?? ""}`;
      if (SECRET_FIELD_PATTERN.test(key)) return [];
      // Real adapter values remain fail-closed until Security approves explicit
      // PW1 field keys. Demo data is synthetic and exists solely for UI review.
      if (!isTrustedDemo && !PUBLIC_FIELD_ALLOWLIST.has(field.sourceKey ?? "")) return [];

      const pii = isPersonRecord || PII_FIELD_PATTERN.test(key);
      return [{
        section: toSafeText(field.section) ?? undefined,
        sourceKey: toSafeText(field.sourceKey) ?? undefined,
        targetKey: toSafeText(field.targetKey) ?? undefined,
        label: toSafeText(field.label) ?? "Trường không xác định",
        pw1: pii ? maskPii(toSafeText(field.pw1)) : toSafeText(field.pw1),
        pw2: pii ? maskPii(toSafeText(field.pw2)) : toSafeText(field.pw2),
        status: isStatus(field.status) ? field.status : "unverified",
      }];
    }) : [];

    return {
      ...options.decorateRecord?.(record),
      sourceEntity: record.sourceEntity,
      sourceId: isTrustedDemo && isPublicIdentifier(record.sourceId)
        ? record.sourceId
        : showInternalIds && INTERNAL_RECORD_ID_PATTERN.test(record.sourceId)
          ? record.sourceId
          : `PW1 record #${recordIndex + 1}`,
      targetCollection: toSafeText(record.targetCollection),
      targetIds: isTrustedDemo ? displayTargetIds : displayTargetIds.map((id, index) =>
        showInternalIds && INTERNAL_RECORD_ID_PATTERN.test(id)
          ? id
          : `PW2 record #${recordIndex + 1}.${index + 1}`),
      label: showInternalIds ? "Tên/chi tiết đã ẩn" : toPublicLabel(record.label, isPersonRecord, isTrustedDemo),
      status,
      reason: SAFE_STATUS_REASONS[status],
      fields,
      relations: Array.isArray(record.relations) ? record.relations.map((relation) => ({
        label: toSafeText(relation.label) ?? "Dữ liệu liên quan",
        pw1Total: Number.isSafeInteger(relation.pw1Total) && relation.pw1Total >= 0 ? relation.pw1Total : 0,
        pw2Total: Number.isSafeInteger(relation.pw2Total) && relation.pw2Total >= 0 ? relation.pw2Total : 0,
        status: isStatus(relation.status) ? relation.status : "unverified",
      })) : [],
    };
  }) : [];

  const summary = records.reduce<ReconciliationSummary>((result, record) => {
    result.pw1Total += 1;
    result.pw2Total += record.targetIds.length;
    result[record.status] += 1;
    return result;
  }, { ...EMPTY_SUMMARY });

  return {
    scope: snapshot.scope,
    storeId: toSafeText(snapshot.storeId),
    generatedAt: toSafeText(snapshot.generatedAt) ?? new Date(0).toISOString(),
    evidence: {
      available: mode === "verified" && snapshot.evidence?.available === true,
      mode,
      contractVersion: toSafeText(snapshot.evidence?.contractVersion),
      message: mode === "verified"
        ? "Đã nạp evidence mapping đã được xác nhận. Giá trị riêng tư không có trong evidence hiển thị."
        : mode === "demo"
          ? "Dữ liệu mẫu để xem giao diện; không phải kết quả migration thực tế."
          : "Chưa có mapping định danh PW1 → PW2 được xác nhận. Hệ thống không suy đoán kết quả migration.",
    },
    summary,
    records,
  };
}

const EMPTY_SUMMARY: ReconciliationSummary = {
  pw1Total: 0,
  pw2Total: 0,
  match: 0,
  missing: 0,
  mismatch: 0,
  duplicate: 0,
  unsupported: 0,
  unverified: 0,
};

/**
 * Safe default until the migration team supplies versioned PW1 → PW2 evidence.
 * It intentionally returns no guessed matches and tells the Tester why.
 */
export function createUnverifiedReconciliationSnapshot(input: {
  scope: ReconciliationScope;
  storeId: string | null;
  now?: Date;
}): ReconciliationSnapshot {
  return {
    scope: input.scope,
    storeId: input.storeId,
    generatedAt: (input.now ?? new Date()).toISOString(),
    evidence: {
      available: false,
      mode: "unavailable",
      contractVersion: null,
      message:
        "Chưa có mapping định danh PW1 → PW2 được xác nhận. Hệ thống không suy đoán kết quả migration.",
    },
    summary: { ...EMPTY_SUMMARY },
    records: [],
  };
}

/**
 * Explicit, non-production fixture for reviewing the table UI locally. It is
 * never evidence of a real migration and is only returned for `demo=1`.
 */
export function createDemoReconciliationSnapshot(input: {
  scope: ReconciliationScope;
  storeId: string | null;
  now?: Date;
}): ReconciliationSnapshot {
  const isCommerce = input.scope === "commerce";
  const field = (
    section: string,
    sourceKey: string,
    label: string,
    pw1: string | null,
    pw2: string | null,
    status: ReconciliationStatus = "match",
    targetKey?: string,
  ) => ({ section, sourceKey, targetKey, label, pw1, pw2, status });
  const records: ReconciliationRecord[] = isCommerce
    ? [
        { sourceEntity: "products", sourceId: "PW1-PROD-001", targetCollection: "products", targetIds: ["PW2-PROD-001"], label: "Áo thun mẫu", status: "match", reason: "Dữ liệu mẫu: các trường bắt buộc khớp.", relations: [{ label: "SKU / Variants", pw1Total: 100, pw2Total: 100, status: "match" }, { label: "Hình ảnh", pw1Total: 5, pw2Total: 5, status: "match" }], fields: [{ section: "Thông tin chung", label: "Tên", pw1: "Áo thun mẫu", pw2: "Áo thun mẫu", status: "match" }, { section: "Thông tin chung", label: "Slug", pw1: "ao-thun-mau", pw2: "ao-thun-mau", status: "match" }, { section: "Giá & tồn kho", label: "Giá bán", pw1: "RM 49.00", pw2: "RM 49.00", status: "match" }, { section: "Giá & tồn kho", label: "Tồn kho", pw1: "100", pw2: "100", status: "match" }, { section: "SKU / Variants", label: "SKU", pw1: "DEMO-TS-01", pw2: "DEMO-TS-01", status: "match" }, { section: "SEO", label: "Meta title", pw1: "Áo thun mẫu", pw2: "Áo thun mẫu", status: "match" }] },
        { sourceEntity: "orders", sourceId: "PW1-ORD-1024", targetCollection: null, targetIds: [], label: "Đơn hàng #1024", status: "missing", reason: "Dữ liệu mẫu: không tìm thấy target mapping.", relations: [{ label: "Line items", pw1Total: 3, pw2Total: 0, status: "missing" }], fields: [{ section: "Tổng quan", label: "Tổng tiền", pw1: "RM 120.00", pw2: null, status: "missing" }, { section: "Thanh toán", label: "Trạng thái", pw1: "Paid", pw2: null, status: "missing" }, { section: "Giao hàng", label: "Phương thức", pw1: "Standard", pw2: null, status: "missing" }] },
        { sourceEntity: "discounts", sourceId: "PW1-DIS-NEW10", targetCollection: "discounts", targetIds: ["PW2-DIS-NEW10"], label: "NEW10", status: "mismatch", reason: "Dữ liệu mẫu: giá trị giảm giá khác nhau.", fields: [{ label: "Giá trị", pw1: "10%", pw2: "5%", status: "mismatch" }] },
        { sourceEntity: "customers", sourceId: "PW1-CUS-081", targetCollection: "customers", targetIds: ["PW2-CUS-081-A", "PW2-CUS-081-B"], label: "Khách hàng mẫu", status: "duplicate", reason: "Dữ liệu mẫu: có hơn một target mapping.", fields: [{ label: "Email", pw1: "m***@example.test", pw2: "m***@example.test", status: "duplicate" }] },
        { sourceEntity: "products", sourceId: "PW1-PROD-099", targetCollection: null, targetIds: [], label: "Sản phẩm chờ mapping", status: "unverified", reason: "Dữ liệu mẫu: chưa có mapping định danh.", fields: [{ section: "SKU / Variants", label: "SKU", pw1: "DEMO-PENDING", pw2: null, status: "unverified" }, { section: "Shipping", label: "Kích thước", pw1: "40 × 30 × 5 cm", pw2: null, status: "unsupported" }] },
      ]
    : [
        { sourceEntity: "account_profile", sourceId: "PW1-SET-PROFILE", targetCollection: "sites", targetIds: ["PW2-SITE-001"], label: "Account profile", status: "match", reason: "Dữ liệu mẫu: thông tin cho phép đối soát khớp.", fields: [{ label: "Tên cửa hàng", pw1: "Demo Store", pw2: "Demo Store", status: "match" }] },
        { sourceEntity: "email_templates", sourceId: "PW1-SET-EMAIL", targetCollection: "email_templates", targetIds: ["PW2-EMAIL-001"], label: "Order confirmation", status: "match", reason: "Dữ liệu mẫu: email template đã có mapping.", fields: [{ label: "Subject", pw1: "Xác nhận đơn hàng", pw2: "Xác nhận đơn hàng", status: "match" }] },
        { sourceEntity: "payments", sourceId: "PW1-SET-PAY", targetCollection: null, targetIds: [], label: "Payment methods", status: "missing", reason: "Dữ liệu mẫu: chưa có target mapping.", fields: [{ label: "Phương thức", pw1: "Bank transfer", pw2: null, status: "missing" }] },
        { sourceEntity: "delivery", sourceId: "PW1-SET-DELIVERY", targetCollection: "sites", targetIds: ["PW2-SITE-001"], label: "Delivery settings", status: "mismatch", reason: "Dữ liệu mẫu: cấu hình giao hàng khác nhau.", fields: [{ label: "Phí giao", pw1: "RM 8", pw2: "RM 10", status: "mismatch" }] },
        { sourceEntity: "web_address", sourceId: "PW1-SET-DOMAIN", targetCollection: "domains", targetIds: ["PW2-DOMAIN-001"], label: "demo.example.test", status: "match", reason: "Dữ liệu mẫu: domain đã có mapping.", fields: [{ label: "Domain", pw1: "demo.example.test", pw2: "demo.example.test", status: "match" }] },
        { sourceEntity: "team_members", sourceId: "PW1-SET-TEAM", targetCollection: "users", targetIds: ["PW2-USER-001", "PW2-USER-002"], label: "Team members", status: "duplicate", reason: "Dữ liệu mẫu: trùng target mapping.", fields: [{ label: "Email", pw1: "t***@example.test", pw2: "t***@example.test", status: "duplicate" }] },
        { sourceEntity: "app_integrations", sourceId: "PW1-SET-APP", targetCollection: null, targetIds: [], label: "App integrations", status: "unverified", reason: "Dữ liệu mẫu: chờ mapping định danh.", fields: [{ label: "Loại tích hợp", pw1: "Analytics", pw2: null, status: "unverified" }] },
      ];

  const schemaDetail = new Map<string, ReconciliationRecord["fields"]>([
    ["PW1-PROD-001", [
      field("Thông tin chung · products", "products.category_id", "Danh mục", "Đồ mặc", "Đồ mặc", "match", "products.categories"),
      field("Thông tin chung · products", "products.name_ms", "Tên tiếng Malaysia", "Baju contoh", "Baju contoh", "match", "products.nameMs"),
      field("Nội dung · products", "products.featured_description", "Mô tả nổi bật", "Cotton 100%", "Cotton 100%", "match", "products.featuredDescription"),
      field("Nội dung · products", "products.description", "Mô tả", "Sản phẩm mẫu", "Sản phẩm mẫu", "match", "products.description"),
      field("Trạng thái · products", "products.status", "Trạng thái", "Active", "Published", "match", "products.status"),
      field("Vận chuyển · products", "products.package_length", "Dài kiện hàng", "40 cm", "40 cm", "match", "products.packageLength"),
      field("Vận chuyển · products", "products.package_width", "Rộng kiện hàng", "30 cm", "30 cm", "match", "products.packageWidth"),
      field("Vận chuyển · products", "products.package_height", "Cao kiện hàng", "5 cm", "5 cm", "match", "products.packageHeight"),
      field("Vận chuyển · products", "products.package_weight", "Khối lượng", "0.3 kg", "0.3 kg", "match", "products.packageWeight"),
      field("Tồn kho · products", "products.low_stock_threshold", "Ngưỡng tồn kho thấp", "5", "5", "match", "products.lowStockThreshold"),
      field("SKU / Variants · product_skus", "product_skus.price", "Giá SKU", "RM 49.00", "RM 49.00", "match", "products.variants.price"),
      field("SKU / Variants · product_skus", "product_skus.cost", "Giá vốn SKU", "RM 30.00", "RM 30.00", "match", "products.variants.cost"),
      field("SKU / Variants · product_skus", "product_skus.status", "Trạng thái SKU", "Active", "Active", "match", "products.variants.status"),
      field("Hình ảnh · product_images", "product_images.order", "Thứ tự ảnh", "1–5", "1–5", "match", "media.order"),
      field("Thuộc tính · product_attributes", "product_attributes.attribute_value_id", "Thuộc tính", "Màu: Đen; Size: M", "Màu: Đen; Size: M", "match", "products.variants.options"),
    ]],
    ["PW1-ORD-1024", [
      field("Tổng quan · orders", "orders.code", "Mã đơn", "#1024", null, "missing", "orders.orderNumber"),
      field("Khách hàng · orders", "orders.customer_name", "Tên khách", "Khách mẫu", null, "missing", "orders.customer"),
      field("Khách hàng · orders", "orders.customer_email", "Email", "k***@example.test", null, "missing", "orders.customer.email"),
      field("Thanh toán · orders", "orders.payment_method_id", "Phương thức thanh toán", "Bank transfer", null, "missing", "orders.paymentMethod"),
      field("Tiền tệ · orders", "orders.currency_id", "Tiền tệ", "MYR", null, "missing", "orders.currency"),
      field("Tổng tiền · orders", "orders.sub_total", "Tạm tính", "RM 120.00", null, "missing", "orders.subtotal"),
      field("Tổng tiền · orders", "orders.total_discount", "Giảm giá", "RM 10.00", null, "missing", "orders.discountTotal"),
      field("Tổng tiền · orders", "orders.total_shipping", "Phí giao hàng", "RM 8.00", null, "missing", "orders.shippingTotal"),
      field("Tổng tiền · orders", "orders.total_tax", "Thuế", "RM 0.00", null, "missing", "orders.taxTotal"),
      field("Giao hàng · orders", "orders.tracking_code", "Mã tracking", "DEMO-TRACK-1024", null, "missing", "orders.trackingCode"),
      field("Trạng thái · orders", "orders.status", "Trạng thái đơn", "Paid", null, "missing", "orders.status"),
      field("Hoàn tiền · orders", "orders.refund_status", "Trạng thái hoàn tiền", "Không có", null, "missing", "orders.refundStatus"),
      field("Line items · order_details", "order_details.sku", "SKU dòng hàng", "DEMO-TS-01", null, "missing", "orders.items.sku"),
      field("Line items · order_details", "order_details.quantity", "Số lượng", "3", null, "missing", "orders.items.quantity"),
      field("Line items · order_details", "order_details.total_price", "Tổng dòng hàng", "RM 120.00", null, "missing", "orders.items.total"),
      field("Lịch sử · order_status_histories", "order_status_histories.status", "Lịch sử trạng thái", "Created → Paid", null, "missing", "orders.statusHistory"),
      field("Địa chỉ · addresses", "addresses.full_address", "Địa chỉ giao hàng", "M***, Kuala Lumpur", null, "missing", "orders.shippingAddress"),
    ]],
    ["PW1-DIS-NEW10", [
      field("Khuyến mãi · promotions", "promotions.name", "Tên", "NEW10", "NEW10", "match", "discounts.name"),
      field("Khuyến mãi · promotions", "promotions.start_date", "Bắt đầu", "2026-01-01", "2026-01-01", "match", "discounts.startsAt"),
      field("Khuyến mãi · promotions", "promotions.end_date", "Kết thúc", "2026-12-31", "2026-12-31", "match", "discounts.endsAt"),
      field("Khuyến mãi · promotions", "promotions.discount_value", "Giá trị", "10%", "5%", "mismatch", "discounts.value"),
      field("Khuyến mãi · promotions", "promotions.max_discount_value", "Giảm tối đa", "RM 30", "RM 30", "match", "discounts.maxValue"),
      field("Khuyến mãi · promotions", "promotions.min_payment", "Đơn tối thiểu", "RM 100", "RM 100", "match", "discounts.minimumOrder"),
      field("Khuyến mãi · promotions", "promotions.limit_per_user", "Giới hạn/người", "1", "1", "match", "discounts.perCustomerLimit"),
      field("Áp dụng SKU · promotion_product_skus", "promotion_product_skus.product_sku_id", "SKU áp dụng", "12 SKU", "12 SKU", "match", "discounts.products"),
    ]],
    ["PW1-CUS-081", [
      field("Hồ sơ · customers", "customers.name", "Tên", "Khách hàng mẫu", "Khách hàng mẫu", "duplicate", "customers.name"),
      field("Hồ sơ · customers", "customers.email", "Email", "m***@example.test", "m***@example.test", "duplicate", "customers.email"),
      field("Hồ sơ · customers", "customers.phone", "Điện thoại", "***-***-1234", "***-***-1234", "duplicate", "customers.phone"),
      field("Hồ sơ · customers", "customers.rank_id", "Hạng", "Gold", "Gold", "duplicate", "customers.group"),
      field("Địa chỉ · addresses", "addresses.country_id", "Quốc gia", "Malaysia", "Malaysia", "duplicate", "customers.address.country"),
      field("Địa chỉ · addresses", "addresses.city", "Thành phố", "Kuala Lumpur", "Kuala Lumpur", "duplicate", "customers.address.city"),
      field("Địa chỉ · addresses", "addresses.post_code", "Mã bưu chính", "50000", "50000", "duplicate", "customers.address.postalCode"),
    ]],
    ["PW1-SET-PROFILE", [
      field("Profile · stores", "stores.email", "Email cửa hàng", "d***@example.test", "d***@example.test", "match", "sites.contact.email"),
      field("Profile · stores", "stores.hotline", "Hotline", "03-1234 5678", "03-1234 5678", "match", "sites.contact.phone"),
      field("Profile · stores", "stores.address", "Địa chỉ", "Kuala Lumpur", "Kuala Lumpur", "match", "sites.address"),
      field("Profile · stores", "stores.logo", "Logo", "Có", "Có", "match", "sites.logo"),
      field("Profile · stores", "stores.currency_id", "Tiền tệ", "MYR", "MYR", "match", "sites.currency"),
    ]],
    ["PW1-SET-EMAIL", [
      field("Email · store_email_templates", "store_email_templates.greeting_message", "Lời chào", "Xin chào", "Xin chào", "match", "emailTemplates.greeting"),
      field("Email · store_email_templates", "store_email_templates.button_label", "Nhãn nút", "Xem đơn hàng", "Xem đơn hàng", "match", "emailTemplates.buttonLabel"),
      field("Email · store_email_templates", "store_email_templates.preview_html", "Nội dung HTML", "Checksum: abc123", "Checksum: abc123", "match", "emailTemplates.htmlChecksum"),
      field("Email · store_email_templates", "store_email_templates.status", "Trạng thái", "Enabled", "Enabled", "match", "emailTemplates.enabled"),
    ]],
    ["PW1-SET-PAY", [
      field("Payment · store_payments", "store_payments.payment_method_id", "Phương thức", "Bank transfer", null, "missing", "payments.method"),
      field("Payment · store_payments", "store_payments.account_name", "Tên tài khoản", "D*** Store", null, "missing", "payments.accountName"),
      field("Payment · store_payments", "store_payments.account_id", "Số tài khoản", "***1234", null, "missing", "payments.accountId"),
      field("Payment · store_payments", "store_payments.is_default", "Mặc định", "Có", null, "missing", "payments.default"),
      field("Security", "", "Credential thanh toán", "Đã loại khỏi đối soát", "Đã loại khỏi đối soát", "unsupported"),
    ]],
    ["PW1-SET-DELIVERY", [
      field("Delivery · store_deliveries", "store_deliveries.delivery_provider_id", "Nhà vận chuyển", "Demo Express", "Demo Express", "match", "shipping.provider"),
      field("Delivery · store_deliveries", "store_deliveries.is_default", "Mặc định", "Có", "Có", "match", "shipping.default"),
      field("Delivery · store_deliveries", "store_deliveries.is_support_cod", "COD", "Có", "Có", "match", "shipping.cod"),
      field("Delivery · store_deliveries", "store_deliveries.shipping_fee_config", "Cấu hình phí", "RM 8", "RM 10", "mismatch", "shipping.fees"),
    ]],
    ["PW1-SET-DOMAIN", [
      field("Domain · store_domains", "store_domains.is_default", "Domain mặc định", "Có", "Có", "match", "domains.default"),
      field("Domain · store_domains", "store_domains.is_main", "Domain chính", "Có", "Có", "match", "domains.primary"),
      field("Domain · store_domains", "store_domains.is_supported_https", "HTTPS", "Có", "Có", "match", "domains.https"),
      field("Domain · store_domains", "store_domains.status", "Trạng thái", "Active", "Active", "match", "domains.status"),
    ]],
    ["PW1-SET-TEAM", [
      field("Team · users", "users.name", "Họ tên", "Nhân viên mẫu", "Nhân viên mẫu", "duplicate", "users.name"),
      field("Team · users", "users.email", "Email", "t***@example.test", "t***@example.test", "duplicate", "users.email"),
      field("Team · users", "users.phone", "Điện thoại", "***-***-1234", "***-***-1234", "duplicate", "users.phone"),
      field("Role · model_has_roles", "model_has_roles.role_id", "Vai trò", "Crew", "Crew", "duplicate", "users.roles"),
      field("Security · users", "users.is_enabled_mfa", "MFA", "Đã cấu hình", "Đã cấu hình", "match", "users.mfaConfigured"),
    ]],
    ["PW1-SET-APP", [
      field("Integration · model_settings", "model_settings.key", "Khóa cấu hình", "analytics_provider", null, "unverified", "integrations.provider"),
      field("Integration · model_settings", "model_settings.status", "Trạng thái", "Enabled", null, "unverified", "integrations.enabled"),
      field("Security", "", "Giá trị cấu hình nhạy cảm", "Đã loại khỏi đối soát", "Đã loại khỏi đối soát", "unsupported"),
    ]],
  ]);
  const enrichedRecords = records.map((record) => ({
    ...record,
    fields: [...record.fields, ...(schemaDetail.get(record.sourceId) ?? [])],
  }));

  const summary = enrichedRecords.reduce<ReconciliationSummary>((result, record) => {
    result.pw1Total += 1;
    result.pw2Total += record.targetIds.length;
    result[record.status] += 1;
    return result;
  }, { ...EMPTY_SUMMARY });

  return {
    scope: input.scope,
    storeId: input.storeId,
    generatedAt: (input.now ?? new Date()).toISOString(),
    evidence: {
      available: false,
      mode: "demo",
      contractVersion: null,
      message: "Dữ liệu mẫu để xem giao diện; không phải kết quả migration thực tế.",
    },
    summary,
    records: enrichedRecords,
  };
}

/**
 * Integration seam for the future versioned mapping-evidence adapter.
 * Replace this provider registration only after the migration contract is approved.
 */
let evidenceProvider: MigrationEvidenceProvider | null = null;

export function registerMigrationEvidenceProvider(provider: MigrationEvidenceProvider | null): void {
  evidenceProvider = provider;
}

export async function getReconciliationSnapshot(input: {
  scope: ReconciliationScope;
  storeId: string | null;
  runId?: string | null;
  demo?: boolean;
}): Promise<ReconciliationSnapshot> {
  if (input.demo) {
    return createDemoReconciliationSnapshot(input);
  }

  if (evidenceProvider) {
    return evidenceProvider.getSnapshot(input);
  }

  return createUnverifiedReconciliationSnapshot(input);
}
