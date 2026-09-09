/**
 * Migration Reconciliation Engine & Deep Field-by-Field Database Diff Inspector (PW1 -> PW2)
 * Comprehensive 1-to-1 Field Matching across ALL Merchant Data:
 * Products & Variants, Banners & Media Links, RichText & Embeds, Categories & Nav Menus, Posts, Store Settings & Footer
 */

export type EntityGroupType = "products" | "variants" | "banners" | "richtext" | "categories" | "navigation" | "posts" | "settings" | "blocks";

export interface FieldDiffItem {
  fieldName: string;
  fieldLabel: string;
  legacyKey: string;      // e.g. "banners.link_url" (MySQL)
  migratedKey: string;    // e.g. "hero.cta.url" (PostgreSQL)
  legacyValue: string | number | boolean | null;
  migratedValue: string | number | boolean | null;
  status: "match" | "warning" | "error";
  classification: "P0 Blocker" | "P1 Warning" | "P2 Info" | "100% Match";
  diffExplanation?: string;
  remediationAction?: string;
}

export interface EntityDiffRecord {
  id: string;
  /** Page IDs where this entity is rendered in the migrated storefront. */
  pageIds: string[];
  legacyId: string | number;
  migratedId?: string | number | null;
  entityGroup: EntityGroupType;
  entityName: string;
  entityIdentifier: string; // e.g. "Vị trí: Hero #01" or "SKU: ONG-RUNG"
  matchStatus: "match" | "warning" | "error" | "missing_in_pw2" | "orphan_in_pw2";
  totalFields: number;
  matchedFields: number;
  discrepancyCount: number;
  fields: FieldDiffItem[];
}

/**
 * Keeps the field inspector scoped to the storefront page the QA tester has
 * selected. An entity can belong to more than one page (for example products
 * are rendered on both Home and Catalog), so ownership is intentionally an
 * array rather than a single page ID.
 */
export function getFieldDiffRecordsForPage(
  audit: StoreFieldDiffAudit,
  pageId: string,
): EntityDiffRecord[] {
  return audit.records.filter(
    (record) => Array.isArray(record.pageIds) && record.pageIds.includes(pageId),
  );
}

export interface StoreFieldDiffAudit {
  storeId: string;
  summary: {
    totalEntitiesV1: number;
    totalEntitiesV2: number;
    matchedEntities: number;
    missingInPW2Count: number;
    orphanInPW2Count: number;
    fieldMatchRate: string;
    groupStats: Record<EntityGroupType, { total: number; pass: number; warn: number; fail: number }>;
  };
  records: EntityDiffRecord[];
}

export interface StoreSummary {
  id: string;
  name: string;
  ownerEmail: string;
  domain: string;
  sslReady?: boolean;
  templateCode: string;
  templateName: string;
  sector: string;
  coverImg?: string;
  fileV2?: string;
  larkUrl?: string;
  legacyDomain: string;
  migratedDomain: string;
  score: string;
  status: "passed" | "warning" | "failed";
  failedBlocks: string[];
  subdomain1: string;
  subdomain2: string;
  pageCount: number;
  textScore: string;
  mediaScore: string;
  commerceScore: string;
  blockScore: string;
  lastCheckedAt?: string;
}

/**
 * Checks whether a merchant store domain supports SSL for secure iframe embedding.
 * Prioritizes database verified sslReady flag, fallback to wildcard or HTTPS domains.
 */
export function isStoreDomainSslReady(store?: { domain?: string; sslReady?: boolean } | null): boolean {
  if (!store || !store.domain) return false;
  if (typeof store.sslReady === "boolean") return store.sslReady;
  const lower = store.domain.toLowerCase();
  return lower.includes("ecommercehub.my") || lower.includes("vnami") || lower.startsWith("https://");
}

export interface DefectItem {
  type: "p0" | "p1" | "p2";
  icon: string;
  title: string;
  desc: string;
  fix: string;
  affectedField?: string;
  entityType?: "products" | "variants" | "categories" | "posts" | "stores" | "blocks" | "richtext" | "pages" | "media" | "text_format";
}

export interface MediaAuditItem {
  id: string;
  label: string;
  pw1Url: string;
  pw2Url: string;
  httpStatusV1: number;
  httpStatusV2: number;
  altTextV1: string;
  altTextV2: string;
  dimensionsV1: string;
  dimensionsV2: string;
  status: "pass" | "warn" | "fail";
  issueNote?: string;
}

export interface TextFormatAuditItem {
  id: string;
  context: string;
  pw1Html: string;
  pw2Lexical: string;
  utf8Check: "pass" | "fail";
  stylingCheck: {
    hasBold: boolean;
    hasItalic: boolean;
    hasLists: boolean;
    hasTable: boolean;
    tableColumnsCount?: number;
    paragraphsCount: number;
  };
  pw2StylingCheck: {
    hasBold: boolean;
    hasItalic: boolean;
    hasLists: boolean;
    hasTable: boolean;
    tableColumnsCount?: number;
    paragraphsCount: number;
  };
  status: "pass" | "warn" | "fail";
  issueNote?: string;
}

export interface BlockBreakdownItem {
  pos: string;
  leg: string;
  mig: string;
  layer: string;
  layerCls: string;
  status: string;
  badge: "badge-pass" | "badge-warn" | "badge-fail";
  pw1Val: string;
  pw2Val: string;
  fix: string;
}

export interface PageBlockItem {
  id: string;
  order: number;
  blockType: "hero" | "banner" | "richtext" | "products" | "categories" | "blog" | "footer" | "contact" | "filter" | "tracking" | "gallery" | "variants" | "cart" | "checkout";
  title: string;
  pw1Component: string;
  pw2Block: string;
  pw1Preview: {
    headline?: string;
    subheadline?: string;
    bodyText?: string;
    imageCount?: number;
    hasTable?: boolean;
    productCount?: number;
    badgeText?: string;
    imageUrl?: string;
    buttonText?: string;
    articleItems?: Array<{
      id?: number | string;
      title: string;
      image?: string;
      summary?: string;
      date?: string;
      slug?: string;
    }>;
    productCards?: Array<{
      id?: number | string;
      name: string;
      price: string;
      sku: string;
      image?: string;
      category?: string;
    }>;
    categoryCards?: Array<{
      id?: number | string;
      name: string;
      image?: string;
      ctaText?: string;
      countText?: string;
      slug?: string;
    }>;
  };
  pw2Preview: {
    headline?: string;
    subheadline?: string;
    bodyText?: string;
    imageCount?: number;
    hasTable?: boolean;
    productCount?: number;
    badgeText?: string;
    imageUrl?: string;
    buttonText?: string;
    articleItems?: Array<{
      id?: number | string;
      title: string;
      image?: string;
      summary?: string;
      date?: string;
      slug?: string;
    }>;
    productCards?: Array<{
      id?: number | string;
      name: string;
      price: string;
      sku: string;
      image?: string;
      category?: string;
    }>;
    categoryCards?: Array<{
      id?: number | string;
      name: string;
      image?: string;
      ctaText?: string;
      countText?: string;
      slug?: string;
    }>;
  };
  status: "pass" | "warn" | "fail";
  discrepancyNote?: string;
}

export interface DynamicStorePage {
  id: string;
  name: string;
  path: string;
  pageType: "home" | "catalog" | "product_detail" | "blog" | "contact" | "custom_page";
  existsInPW1: boolean;
  existsInPW2: boolean;
  totalBlocks: number;
  blocks: PageBlockItem[];
  breakdown: BlockBreakdownItem[];
  defects: DefectItem[];
  mediaAudits: MediaAuditItem[];
  textFormatAudits: TextFormatAuditItem[];
}

export interface StoreDeepDiff {
  id: string;
  name: string;
  ownerEmail: string;
  domain: string;
  sslReady?: boolean;
  templateCode: string;
  templateName: string;
  sector: string;
  coverImg?: string;
  fileV2?: string;
  larkUrl?: string;
  legacyDomain: string;
  migratedDomain: string;
  score: string;
  status: "passed" | "warning" | "failed";
  textScore: string;
  mediaScore: string;
  commerceScore: string;
  blockScore: string;
  totalPagesInPW1: number;
  totalPagesInPW2: number;
  missingPagesCount: number;
  pages: DynamicStorePage[];
  fieldDiffAudit: StoreFieldDiffAudit;
  reconciliationAudit: {
    totalProductsV1: number;
    totalProductsV2: number;
    matchedProducts: number;
    missingVariantsCount: number;
    droppedBrandCount: number;
    missingCostCount: number;
    brokenMediaCount: number;
    searchParity: string;
    cartParity: string;
    filterParity: string;
    richTextParity: string;
  };
}

export interface MigrationDashboardMetrics {
  totalStores: number;
  passedStores: number;
  warningStores: number;
  failedStores: number;
  avgScore: string;
  p0BlockersCount: number;
  lastSyncTimestamp: string;
}

// 9 Standard Canonical Templates Metadata
export const CANONICAL_TEMPLATES = [
  {
    code: "FB101",
    name: "OrganicNest",
    sector: "Thực phẩm sạch & Nông sản",
    coverImg: "https://tm-prime-web.sgp1.digitaloceanspaces.com/tm-prime-web/images/templates/fb101/cover.png",
    liveDomainV1: "https://fb101.web.dev.ecommercehub.my/",
    fileV2: "fb101-standalone-full.html",
    larkUrl: "https://primecommerce.sg.larksuite.com/file/Fe2ibDVeEo9NdfxP3WTlgukkgDb",
    liveDomainV2: "https://fb101.primeweb.io/",
  },
  {
    code: "PA101",
    name: "EcoGarden",
    sector: "Cây cảnh & F&B",
    coverImg: "https://tm-prime-web.sgp1.digitaloceanspaces.com/tm-prime-web/images/templates/pa101/cover.png",
    liveDomainV1: "https://pa101.web.dev.ecommercehub.my/",
    fileV2: "pa101-standalone-full.html",
    larkUrl: "https://primecommerce.sg.larksuite.com/file/SmUVbL51oo9cc5xJiaUlqhTCghf",
    liveDomainV2: "https://pa101.primeweb.io/",
  },
  {
    code: "F102",
    name: "FashionEase",
    sector: "Thời trang & May mặc",
    coverImg: "https://tm-prime-web.sgp1.digitaloceanspaces.com/tm-prime-web/images/templates/f102/cover.png",
    liveDomainV1: "https://f102.web.dev.ecommercehub.my/",
    fileV2: "f102-standalone-full.html",
    larkUrl: "https://primecommerce.sg.larksuite.com/file/DawpbvYyvo8uK2xtIMml625MgqM",
    liveDomainV2: "https://f102.primeweb.io/",
  },
  {
    code: "FN104",
    name: "Minimalist",
    sector: "Tối giản & Gia dụng",
    coverImg: "https://tm-prime-web.sgp1.digitaloceanspaces.com/tm-prime-web/images/templates/fn104/cover.png",
    liveDomainV1: "https://fn104.web.dev.ecommercehub.my/",
    fileV2: "fn104-standalone-full.html",
    larkUrl: "https://primecommerce.sg.larksuite.com/file/FXvqbmJvlowIa7xtg3Wly5OEgo5",
    liveDomainV2: "https://fn104.primeweb.io/",
  },
  {
    code: "FN103",
    name: "Viora",
    sector: "Nội thất cao cấp",
    coverImg: "https://tm-prime-web.sgp1.digitaloceanspaces.com/tm-prime-web/images/templates/fn103/cover.png",
    liveDomainV1: "https://fn103.web.dev.ecommercehub.my/",
    fileV2: "fn103-standalone-full.html",
    larkUrl: "https://primecommerce.sg.larksuite.com/file/DS9ebclb2oEcSGxCFmXl9zK4gAf",
    liveDomainV2: "https://fn103.primeweb.io/",
  },
  {
    code: "C102",
    name: "GlowBeauty",
    sector: "Mỹ phẩm & Spa",
    coverImg: "https://tm-prime-web.sgp1.digitaloceanspaces.com/tm-prime-web/images/templates/c102/cover.png",
    liveDomainV1: "https://c102.web.dev.ecommercehub.my/",
    fileV2: "c102-standalone-full.html",
    larkUrl: "https://primecommerce.sg.larksuite.com/file/TprDbPKw8oxILsxLjaQlIVS5gFf",
    liveDomainV2: "https://c102.primeweb.io/",
  },
  {
    code: "C101",
    name: "BeautyStore",
    sector: "Chăm sóc da & Làm đẹp",
    coverImg: "https://tm-prime-web.sgp1.digitaloceanspaces.com/tm-prime-web/images/templates/c101/cover.png",
    liveDomainV1: "https://c101.web.dev.ecommercehub.my/",
    fileV2: "c101-standalone-full.html",
    larkUrl: "https://primecommerce.sg.larksuite.com/file/U9LsbsT6hoIceDx35Rolcb50g4c",
    liveDomainV2: "https://c101.primeweb.io/",
  },
  {
    code: "FN102",
    name: "FurnitureHub",
    sector: "Đồ gỗ mỹ nghệ",
    coverImg: "https://tm-prime-web.sgp1.digitaloceanspaces.com/tm-prime-web/images/templates/fn102/cover.png",
    liveDomainV1: "https://fn102.web.dev.ecommercehub.my/",
    fileV2: "fn102-standalone-full.html",
    larkUrl: "https://primecommerce.sg.larksuite.com/file/XLkhbz550otkMWxFnrYlIJs4gld",
    liveDomainV2: "https://fn102.primeweb.io/",
  },
  {
    code: "FN101",
    name: "SofaDecor",
    sector: "Trang trí phòng khách",
    coverImg: "https://tm-prime-web.sgp1.digitaloceanspaces.com/tm-prime-web/images/templates/fn101/cover.png",
    liveDomainV1: "https://fn101.web.dev.ecommercehub.my/",
    fileV2: "fn101-standalone-full.html",
    larkUrl: "https://primecommerce.sg.larksuite.com/file/FQ62bN8Cvo44LMxNBBil50l4gOe",
    liveDomainV2: "https://fn101.primeweb.io/",
  },
];

let cachedCatalog: StoreSummary[] | null = null;

export interface SectorThemeData {
  productName: string;
  productSku: string;
  categoryName: string;
  bannerTitle: string;
  voucherTitle: string;
  articleTitle: string;
  tags: string;
}

export const SECTOR_DATA_MAP: Record<string, SectorThemeData> = {
  FB101: {
    productName: "Mật Ong Rừng Ba Vì Nguyên Chất 500ml",
    productSku: "ONG-RUNG-500",
    categoryName: "Mật Ong & Nông Sản Sạch",
    bannerTitle: "MẬT ONG RỪNG TỰ NHIÊN",
    voucherTitle: "VOUCHER 50K - MUA MẬT ONG RỪNG",
    articleTitle: "5 Cách Phân Biệt Mật Ong Thật Và Giả Tại Nhà",
    tags: "mật ong, nông sản, sức khỏe",
  },
  PA101: {
    productName: "Viên Uống Vitamin C 1000mg Tăng Đề Kháng",
    productSku: "VITA-C-1000",
    categoryName: "Dược Phẩm & Thực Phẩm Chức Năng",
    bannerTitle: "CHĂM SÓC SỨC KHỎE GIA ĐÌNH",
    voucherTitle: "VOUCHER 50K - ĐƠN DƯỢC PHẨM",
    articleTitle: "Cẩm Nang Bổ Sung Vi Chất Đúng Cách",
    tags: "vitamin, dược phẩm, sức khỏe",
  },
  F102: {
    productName: "Áo Sơ Mi Linen Form Rộng Thoáng Mát",
    productSku: "SHIRT-LINEN-01",
    categoryName: "Thời Trang Nam Nữ Mùa Hè",
    bannerTitle: "BỘ SƯU TẬP THỜI TRANG HÈ",
    voucherTitle: "GIẢM 50K - THỜI TRANG TỪ 300K",
    articleTitle: "Xu Hướng Phối Đồ Tối Giản Thanh Lịch",
    tags: "thời trang, áo sơ mi, phong cách",
  },
  FN104: {
    productName: "Kệ Sách Đa Năng 4 Tầng Gỗ Thông Tự Nhiên",
    productSku: "SHELF-PINE-04",
    categoryName: "Nội Thất & Tiện Ích Gia Đình",
    bannerTitle: "KHÔNG GIAN SỐNG TỐI GIẢN",
    voucherTitle: "GIẢM 50K - COMBO GIA DỤNG",
    articleTitle: "Bí Quyết Sắp Xếp Bàn Làm Việc Gọn Gàng",
    tags: "kệ sách, gia dụng, tối giản",
  },
  FN103: {
    productName: "Sofa Góc Bọc Da Ý Cao Cấp Sang Trọng",
    productSku: "SOFA-ITALY-L",
    categoryName: "Nội Thất Phòng Khách Cao Cấp",
    bannerTitle: "NỘI THẤT HOÀNG GIA Ý",
    voucherTitle: "VOUCHER 500K - ĐƠN NỘI THẤT",
    articleTitle: "Cách Lựa Chọn Sofa Phù Hợp Không Gian Căn Hộ",
    tags: "sofa, nội thất, sang trọng",
  },
  C102: {
    productName: "Serum Dưỡng Trắng Mờ Thâm Niacinamide 10%",
    productSku: "SERUM-NIA-10",
    categoryName: "Mỹ Phẩm & Tinh Chất Phục Hồi",
    bannerTitle: "LÀN DA TỎA SÁNG KHÔNG TỲ VẾT",
    voucherTitle: "TẶNG 50K - MỸ PHẨM CHÍNH HÃNG",
    articleTitle: "Quy Trình Chăm Sóc Da Ban Đêm Chuẩn Hàn Quốc",
    tags: "serum, mỹ phẩm, skincare",
  },
  C101: {
    productName: "Kem Dưỡng Ẩm Chuyên Sâu Cấp Nước 72H",
    productSku: "CREAM-AQUA-72",
    categoryName: "Chăm Sóc Da & Làm Đẹp",
    bannerTitle: "CẤP ẨM CHUYÊN SÂU LÀN DA",
    voucherTitle: "GIẢM 50K - BỘ ĐÔI DƯỠNG ẨM",
    articleTitle: "Nguyên Nhân Khiến Da Khô Ráp Mùa Đông Và Cách Trị",
    tags: "kem dưỡng, làm đẹp, da khô",
  },
  FN102: {
    productName: "Bàn Trà Gỗ Hương Khảm Trai Tinh Xảo",
    productSku: "TABLE-HUONG-01",
    categoryName: "Đồ Gỗ Mỹ Nghệ Truyền Thống",
    bannerTitle: "TINH HOA ĐỒ GỖ VIỆT",
    voucherTitle: "ƯU ĐÃI 100K - ĐỒ GỖ NGHỆ THUẬT",
    articleTitle: "Tìm Hiểu Giá Trị Phong Thủy Của Bàn Trà Gỗ Tự Nhiên",
    tags: "bàn trà, gỗ hương, mỹ nghệ",
  },
  FN101: {
    productName: "Thảm Trải Sàn Nỉ Dệt Hoa Văn Bohemian",
    productSku: "RUG-BOHO-200",
    categoryName: "Trang Trí Phòng Khách & Nhà Ở",
    bannerTitle: "SẮC MÀU KHÔNG GIAN SỐNG",
    voucherTitle: "VOUCHER 50K - THẢM CAO CẤP",
    articleTitle: "Mẹo Vệ Sinh Thảm Nỉ Luôn Sạch Sẽ Như Mới",
    tags: "thảm, trang trí, bohemian",
  },
};

export function getSectorTheme(templateCode?: string): SectorThemeData {
  const code = (templateCode || "FB101").toUpperCase().trim();
  if (SECTOR_DATA_MAP[code]) return SECTOR_DATA_MAP[code];

  // Map legacy template codes and prefixes to correct sector data
  if (code.startsWith("F0") || code.startsWith("F1")) return SECTOR_DATA_MAP.F102;
  if (code.startsWith("C1") || code.startsWith("MP")) return SECTOR_DATA_MAP.C101;
  if (code.startsWith("FN")) return SECTOR_DATA_MAP.FN101;
  if (code.startsWith("PA")) return SECTOR_DATA_MAP.PA101;
  if (code.startsWith("TG") || code.startsWith("T006")) return SECTOR_DATA_MAP.FN104;
  if (code.startsWith("T010")) return SECTOR_DATA_MAP.F102;

  return SECTOR_DATA_MAP.FB101;
}

/**
 * Generate 2,000 canonical store index for fast QA review
 */
export function generateReconciliationCatalog(totalCount = 2000): StoreSummary[] {
  if (cachedCatalog && cachedCatalog.length === totalCount) {
    return cachedCatalog;
  }

  const catalog: StoreSummary[] = [];

  for (let i = 1; i <= totalCount; i++) {
    const tpl = CANONICAL_TEMPLATES[(i - 1) % CANONICAL_TEMPLATES.length];
    const storeName = i <= 9 ? tpl.name : `${tpl.name} Store #${i}`;
    const slug = storeName.toLowerCase().replace(/[^a-z0-9]/g, "");

    let score = "98.5%";
    let status: "passed" | "warning" | "failed" = "passed";
    let failedBlocks: string[] = [];
    let textScore = "100%";
    let mediaScore = "100%";
    let commerceScore = "100%";
    let blockScore = "98.0%";

    const pageCount = 6;

    if (i === 1) {
      // SITE-0001: Golden Demo Test Site with active defects for QA inspection
      score = "84.5%";
      status = "failed";
      failedBlocks = ["Mất Biến Thể Size 1L", "Thiếu Brand ID (Layer 2)", "RichText Rớt Bảng VietGAP"];
      textScore = "82.0%";
      mediaScore = "89.0%";
      commerceScore = "65.0%";
      blockScore = "70.0%";
    } else if (i % 25 === 0) {
      // Critical P0 Blocker
      const val = (65 + (i % 15) * 1.1).toFixed(1);
      score = `${val}%`;
      status = "failed";
      failedBlocks = ["Mất Biến Thể Size 1L", "Thiếu Brand ID (Layer 2)", "RichText Rớt Bảng VietGAP"];
      textScore = "82.0%";
      mediaScore = "89.0%";
      commerceScore = "65.0%";
      blockScore = "70.0%";
    } else if (i % 7 === 0) {
      // P1 Warning
      const val = (88 + (i % 6) * 1.0).toFixed(1);
      score = `${val}%`;
      status = "warning";
      failedBlocks = ["1 Ảnh Gallery 404", "Footer Thiếu Iframe Map"];
      textScore = "95.0%";
      mediaScore = "88.0%";
      commerceScore = "95.0%";
      blockScore = "89.0%";
    } else {
      // Passed - Clean score calculation without dead > 100 branch
      const val = (95 + (i % 5) * 0.9).toFixed(1);
      score = `${val}%`;
      status = "passed";
      failedBlocks = [];
    }

    const ownerEmail = i === 1 ? "contact@organicnest.vn" : `${slug}@gmail.com`;
    const domain = i === 1 ? "organicnest.vn" : `${slug}.com.vn`;

    catalog.push({
      id: `SITE-${String(i).padStart(4, "0")}`,
      name: storeName,
      ownerEmail,
      domain,
      templateCode: tpl.code,
      templateName: tpl.name,
      sector: tpl.sector,
      coverImg: tpl.coverImg,
      fileV2: tpl.fileV2,
      larkUrl: tpl.larkUrl,
      legacyDomain: tpl.liveDomainV1,
      migratedDomain: tpl.liveDomainV2,
      score,
      status,
      failedBlocks,
      subdomain1: `${slug}.ech.my`,
      subdomain2: `${slug}.primeweb.io`,
      pageCount,
      textScore,
      mediaScore,
      commerceScore,
      blockScore,
      lastCheckedAt: new Date().toISOString(),
    });
  }
  cachedCatalog = catalog;
  return catalog;
}

/**
 * Generate Complete 1-to-1 Field-Level Database Diff Audit for any store
 */
export function getFieldDiffAuditForStore(siteId: string, overrideStatus?: "passed" | "warning" | "failed"): StoreFieldDiffAudit {
  const allStores = generateReconciliationCatalog(2000);
  const store = allStores.find((s) => s.id === siteId);
  if (!store) {
    throw new Error(`Store ${siteId} not found`);
  }
  const currentStatus = overrideStatus || store.status;
  const theme = siteId === "SITE-0001" || siteId === "SITE-0025"
    ? SECTOR_DATA_MAP.FB101
    : getSectorTheme(store.templateCode);

  const isFailed = currentStatus === "failed";
  const isWarn = currentStatus === "warning";
  const isPass = currentStatus === "passed";

  const records: EntityDiffRecord[] = [
    // 1. PRODUCTS
    {
      id: "ent-prod-101",
      pageIds: ["page-home", "page-catalog"],
      legacyId: "PROD-101",
      migratedId: "pw2_prod_101",
      entityGroup: "products",
      entityName: `Sản Phẩm: ${theme.productName}`,
      entityIdentifier: `SKU: ${theme.productSku}`,
      matchStatus: isFailed ? "error" : "match",
      totalFields: 7,
      matchedFields: isFailed ? 5 : 7,
      discrepancyCount: isFailed ? 2 : 0,
      fields: [
        {
          fieldName: "title",
          fieldLabel: "Tên Sản Phẩm",
          legacyKey: "products.title",
          migratedKey: "products.title",
          legacyValue: theme.productName,
          migratedValue: theme.productName,
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "slug",
          fieldLabel: "Đường Dẫn Slug",
          legacyKey: "products.slug",
          migratedKey: "products.slug",
          legacyValue: "mat-ong-rung-ba-vi",
          migratedValue: "mat-ong-rung-ba-vi",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "brand_id",
          fieldLabel: "Thương Hiệu (Brand)",
          legacyKey: "products.brand_id",
          migratedKey: "products.brand",
          legacyValue: "Nông Trại Hữu Cơ Ba Vì",
          migratedValue: isFailed ? null : "Nông Trại Hữu Cơ Ba Vì",
          status: isFailed ? "error" : "match",
          classification: isFailed ? "P0 Blocker" : "100% Match",
          diffExplanation: isFailed ? "PW1 có brand 'Nông Trại Hữu Cơ Ba Vì' nhưng PW2 chưa có collection `brands` nên trường bị NULL" : undefined,
          remediationAction: isFailed ? "Tạo collection `brands` và thêm relationship field vào collection `products`." : undefined,
        },
        {
          fieldName: "category_id",
          fieldLabel: "Danh Mục Chính",
          legacyKey: "products.category_id",
          migratedKey: "products.category",
          legacyValue: theme.categoryName,
          migratedValue: theme.categoryName,
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "price",
          fieldLabel: "Giá Niêm Yết",
          legacyKey: "products.price",
          migratedKey: "products.price",
          legacyValue: 180000,
          migratedValue: 180000,
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "cost",
          fieldLabel: "Giá Vốn (Cost)",
          legacyKey: "products.cost",
          migratedKey: "products.cost",
          legacyValue: 120000,
          migratedValue: isWarn ? null : 120000,
          status: isWarn ? "warning" : "match",
          classification: isWarn ? "P1 Warning" : "100% Match",
          diffExplanation: isWarn ? "Giá vốn bị bỏ trống khi migrate từ bảng products cũ" : undefined,
          remediationAction: isWarn ? "Bổ sung map trường `cost` trong ETL transform" : undefined,
        },
        {
          fieldName: "status",
          fieldLabel: "Trạng Thái Xuất Bản",
          legacyKey: "products.status",
          migratedKey: "products._status",
          legacyValue: "published",
          migratedValue: "published",
          status: "match",
          classification: "100% Match",
        },
      ],
    },

    // 2. PRODUCT VARIANTS (VAR-201: Hũ 500ml)
    {
      id: "ent-var-201",
      pageIds: ["page-home", "page-catalog"],
      legacyId: "VAR-201",
      migratedId: "pw2_var_201",
      entityGroup: "variants",
      entityName: "Biến Thể: Hũ Thủy Tinh 500ml",
      entityIdentifier: "SKU: ONG-RUNG-500ML",
      matchStatus: "match",
      totalFields: 5,
      matchedFields: 5,
      discrepancyCount: 0,
      fields: [
        {
          fieldName: "sku",
          fieldLabel: "Mã SKU",
          legacyKey: "product_variants.sku",
          migratedKey: "variants[0].sku",
          legacyValue: "ONG-RUNG-500ML",
          migratedValue: "ONG-RUNG-500ML",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "price",
          fieldLabel: "Giá Biến Thể",
          legacyKey: "product_variants.price",
          migratedKey: "variants[0].price",
          legacyValue: 180000,
          migratedValue: 180000,
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "cost",
          fieldLabel: "Giá Vốn",
          legacyKey: "product_variants.cost",
          migratedKey: "variants[0].cost",
          legacyValue: 120000,
          migratedValue: 120000,
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "inventory_count",
          fieldLabel: "Tồn Kho",
          legacyKey: "product_variants.stock",
          migratedKey: "variants[0].inventory",
          legacyValue: 45,
          migratedValue: 45,
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "options",
          fieldLabel: "Tùy Chọn Dung Tích",
          legacyKey: "product_variants.options",
          migratedKey: "variants[0].options",
          legacyValue: "Dung tích: 500ml",
          migratedValue: "Dung tích: 500ml",
          status: "match",
          classification: "100% Match",
        },
      ],
    },

    // 3. PRODUCT VARIANTS (VAR-202: Can 1 Lít - Mất trong failed store)
    {
      id: "ent-var-202",
      pageIds: ["page-home", "page-catalog"],
      legacyId: "VAR-202",
      migratedId: isFailed ? null : "pw2_var_202",
      entityGroup: "variants",
      entityName: "Biến Thể: Can Tiết Kiệm 1 Lít",
      entityIdentifier: "SKU: ONG-RUNG-1L",
      matchStatus: isFailed ? "missing_in_pw2" : "match",
      totalFields: 5,
      matchedFields: isFailed ? 0 : 5,
      discrepancyCount: isFailed ? 5 : 0,
      fields: [
        {
          fieldName: "sku",
          fieldLabel: "Mã SKU",
          legacyKey: "product_variants.sku",
          migratedKey: "variants[1].sku",
          legacyValue: "ONG-RUNG-1L",
          migratedValue: isFailed ? null : "ONG-RUNG-1L",
          status: isFailed ? "error" : "match",
          classification: isFailed ? "P0 Blocker" : "100% Match",
          diffExplanation: isFailed ? "Biến thể Can 1L có trong MySQL nhưng bị mất hoàn toàn trong mảng variants của PW2" : undefined,
          remediationAction: isFailed ? "Chạy lại migration script cho bảng `product_variants` để import đủ biến thể" : undefined,
        },
        {
          fieldName: "price",
          fieldLabel: "Giá Biến Thể",
          legacyKey: "product_variants.price",
          migratedKey: "variants[1].price",
          legacyValue: 320000,
          migratedValue: isFailed ? null : 320000,
          status: isFailed ? "error" : "match",
          classification: isFailed ? "P0 Blocker" : "100% Match",
        },
        {
          fieldName: "cost",
          fieldLabel: "Giá Vốn",
          legacyKey: "product_variants.cost",
          migratedKey: "variants[1].cost",
          legacyValue: 210000,
          migratedValue: isFailed ? null : 210000,
          status: isFailed ? "error" : "match",
          classification: isFailed ? "P0 Blocker" : "100% Match",
        },
        {
          fieldName: "inventory_count",
          fieldLabel: "Tồn Kho",
          legacyKey: "product_variants.stock",
          migratedKey: "variants[1].inventory",
          legacyValue: 20,
          migratedValue: isFailed ? null : 20,
          status: isFailed ? "error" : "match",
          classification: isFailed ? "P0 Blocker" : "100% Match",
        },
        {
          fieldName: "options",
          fieldLabel: "Tùy Chọn Dung Tích",
          legacyKey: "product_variants.options",
          migratedKey: "variants[1].options",
          legacyValue: "Dung tích: 1 Lít",
          migratedValue: isFailed ? null : "Dung tích: 1 Lít",
          status: isFailed ? "error" : "match",
          classification: isFailed ? "P0 Blocker" : "100% Match",
        },
      ],
    },

    // 4. BANNERS & HERO MEDIA LINKS (BAN-01: Hero Banner)
    {
      id: "ent-ban-01",
      pageIds: ["page-home"],
      legacyId: "BAN-1365",
      migratedId: "pw2_hero_01",
      entityGroup: "banners",
      entityName: "Banner Hero: Tasty & Healthy Organic Food",
      entityIdentifier: "Vị trí: Đầu Trang Chủ (Hero #01)",
      matchStatus: "match",
      totalFields: 7,
      matchedFields: 7,
      discrepancyCount: 0,
      fields: [
        {
          fieldName: "image_url",
          fieldLabel: "Đường Dẫn Ảnh Desktop",
          legacyKey: "banners.image_url",
          migratedKey: "hero.image.url",
          legacyValue: "https://tm-prime-web.sgp1.digitaloceanspaces.com/hero_banner_organic.jpg",
          migratedValue: "https://assets.primeweb.io/media/hero_banner_organic.webp",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "mobile_image_url",
          fieldLabel: "Đường Dẫn Ảnh Mobile (375px)",
          legacyKey: "banners.mobile_image_url",
          migratedKey: "hero.mobileImage.url",
          legacyValue: "https://tm-prime-web.sgp1.digitaloceanspaces.com/hero_mobile.jpg",
          migratedValue: "https://assets.primeweb.io/media/hero_mobile.webp",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "headline",
          fieldLabel: "Tiêu Đề Lớn (Headline)",
          legacyKey: "banners.headline",
          migratedKey: "hero.headline",
          legacyValue: "Tasty & Healthy Organic Food",
          migratedValue: "Tasty & Healthy Organic Food",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "subheadline",
          fieldLabel: "Mô Tả Phụ (Subheadline)",
          legacyKey: "banners.subheadline",
          migratedKey: "hero.subheadline",
          legacyValue: "Nông trại sạch tiêu chuẩn VietGAP thu hoạch hàng ngày.",
          migratedValue: "Nông trại sạch tiêu chuẩn VietGAP thu hoạch hàng ngày.",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "link_url",
          fieldLabel: "Đường Dẫn Nút Bấm (CTA Link)",
          legacyKey: "banners.link_url",
          migratedKey: "hero.cta.link",
          legacyValue: "/products",
          migratedValue: "/products",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "button_text",
          fieldLabel: "Nhãn Nút Bấm (Button Text)",
          legacyKey: "banners.button_text",
          migratedKey: "hero.cta.text",
          legacyValue: "Khám Phá Ngay",
          migratedValue: "Khám Phá Ngay",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "open_new_tab",
          fieldLabel: "Mở Tab Mới (_blank)",
          legacyKey: "banners.open_in_new_tab",
          migratedKey: "hero.cta.newTab",
          legacyValue: false,
          migratedValue: false,
          status: "match",
          classification: "100% Match",
        },
      ],
    },

    // 5. BANNERS (BAN-02: Small Promo Voucher)
    {
      id: "ent-ban-02",
      pageIds: ["page-home"],
      legacyId: "BAN-1543",
      migratedId: "pw2_promo_01",
      entityGroup: "banners",
      entityName: `Banner Khuyến Mãi Nhỏ: ${theme.voucherTitle}`,
      entityIdentifier: "Vị trí: Banner Khuyến Mãi (#02)",
      matchStatus: "match",
      totalFields: 5,
      matchedFields: 5,
      discrepancyCount: 0,
      fields: [
        {
          fieldName: "headline",
          fieldLabel: "Tiêu Đề Voucher",
          legacyKey: "banners.title",
          migratedKey: "cta.title",
          legacyValue: theme.voucherTitle,
          migratedValue: theme.voucherTitle,
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "badge_text",
          fieldLabel: "Huy Hiệu (Badge)",
          legacyKey: "banners.badge",
          migratedKey: "cta.badge",
          legacyValue: "Giảm 50.000đ",
          migratedValue: "Giảm 50.000đ",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "link_url",
          fieldLabel: "Đích Đến Khuyến Mãi (Target URL)",
          legacyKey: "banners.link_url",
          migratedKey: "cta.link",
          legacyValue: "/products/mat-ong-rung-ba-vi",
          migratedValue: "/products/mat-ong-rung-ba-vi",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "image_url",
          fieldLabel: "Ảnh Banner Nhỏ",
          legacyKey: "banners.image_url",
          migratedKey: "cta.image.url",
          legacyValue: "https://tm-prime-web.sgp1.digitaloceanspaces.com/voucher50k.jpg",
          migratedValue: "https://assets.primeweb.io/media/voucher50k.webp",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "open_new_tab",
          fieldLabel: "Mở Tab Mới",
          legacyKey: "banners.open_in_new_tab",
          migratedKey: "cta.newTab",
          legacyValue: false,
          migratedValue: false,
          status: "match",
          classification: "100% Match",
        },
      ],
    },

    // 6. RICHTEXT & EMBEDDED CONTENT (RT-01: Câu Chuyện & Bảng VietGAP)
    {
      id: "ent-rt-01",
      pageIds: ["page-home"],
      legacyId: "RT-501",
      migratedId: "pw2_rt_501",
      entityGroup: "richtext",
      entityName: "RichText: Bảng So Sánh Tiêu Chuẩn VietGAP & Link Nhúng",
      entityIdentifier: "Khối: RichText #07 (Bảng Biểu)",
      matchStatus: isFailed ? "error" : "match",
      totalFields: 5,
      matchedFields: isFailed ? 3 : 5,
      discrepancyCount: isFailed ? 2 : 0,
      fields: [
        {
          fieldName: "headline",
          fieldLabel: "Tiêu Đề Khối Văn Bản",
          legacyKey: "rich_text.headline",
          migratedKey: "lexical.headline",
          legacyValue: "Bảng So Sánh Tiêu Chuẩn Nông Sản VietGAP",
          migratedValue: "Bảng So Sánh Tiêu Chuẩn Nông Sản VietGAP",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "table_structure",
          fieldLabel: "Cấu Trúc Bảng Biểu (<table>, <tr>, <td>)",
          legacyKey: "rich_text.html (<table> 3 cột x 2 hàng)",
          migratedKey: "lexical.root.children[TableNode]",
          legacyValue: "<table><tr><th>Tiêu Chí</th><th>Mật Ong Thường</th><th>Mật Ong Ba Vì</th></tr>...</table>",
          migratedValue: isFailed ? "TextNode('Tiêu Chí Mật Ong Thường Mật Ong Ba Vì...')" : "TableNode(Columns: 3, Rows: 2)",
          status: isFailed ? "error" : "match",
          classification: isFailed ? "P0 Blocker" : "100% Match",
          diffExplanation: isFailed ? "Bảng 3 cột bị mất thẻ <table> và sập thành 1 chuỗi text dồn cục" : undefined,
          remediationAction: isFailed ? "Cập nhật Lexical HTML parser hỗ trợ TableBlock" : undefined,
        },
        {
          fieldName: "inline_images",
          fieldLabel: "Ảnh Nhúng Trong Đoạn Văn",
          legacyKey: "rich_text.html (<img src='trang_trai_ba_vi.jpg'>)",
          migratedKey: "lexical.root.children[ImageNode]",
          legacyValue: "https://tm-prime-web.sgp1.digitaloceanspaces.com/posts/trang_trai_ba_vi.jpg",
          migratedValue: "https://assets.primeweb.io/media/posts/trang_trai_ba_vi.webp",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "hyperlinks",
          fieldLabel: "Link Nhúng Trong Chữ (Anchor <a>)",
          legacyKey: "rich_text.html (<a href='/chinh-sach-doi-tra'>)",
          migratedKey: "lexical.root.children[LinkNode]",
          legacyValue: "href: '/chinh-sach-doi-tra', text: 'Xem Chính Sách Đổi Trả'",
          migratedValue: "href: '/chinh-sach-doi-tra', text: 'Xem Chính Sách Đổi Trả'",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "formatting_tags",
          fieldLabel: "Định Dạng In Đậm & Nghiêng (Strong, Em)",
          legacyKey: "rich_text.html (<strong>, <em>)",
          migratedKey: "lexical.format (BOLD | ITALIC)",
          legacyValue: "Đậm: 4 đoạn, Nghiêng: 2 đoạn",
          migratedValue: "Đậm: 4 đoạn, Nghiêng: 2 đoạn",
          status: "match",
          classification: "100% Match",
        },
      ],
    },

    // 7. NAVIGATION & HEADER MENUS (NAV-01: Header Menu)
    {
      id: "ent-nav-01",
      pageIds: ["page-home", "page-catalog", "page-about", "page-blog", "page-contact", "page-custom-policy"],
      legacyId: "NAV-HEADER",
      migratedId: "pw2_nav_header",
      entityGroup: "navigation",
      entityName: "Menu Điều Hướng Đầu Trang (Header Navigation)",
      entityIdentifier: "Menu Chính (4 Mục)",
      matchStatus: "match",
      totalFields: 4,
      matchedFields: 4,
      discrepancyCount: 0,
      fields: [
        {
          fieldName: "item_home",
          fieldLabel: "Mục 1: Trang Chủ",
          legacyKey: "menu_items[0].url",
          migratedKey: "header.navItems[0].link",
          legacyValue: "Nhãn: 'Trang Chủ', Link: '/'",
          migratedValue: "Nhãn: 'Trang Chủ', Link: '/'",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "item_products",
          fieldLabel: "Mục 2: Sản Phẩm (Dropdown)",
          legacyKey: "menu_items[1].url",
          migratedKey: "header.navItems[1].link",
          legacyValue: "Nhãn: 'Sản Phẩm', Link: '/products', Submenu: 3 mục",
          migratedValue: "Nhãn: 'Sản Phẩm', Link: '/products', Submenu: 3 mục",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "item_blog",
          fieldLabel: "Mục 3: Cẩm Nang",
          legacyKey: "menu_items[2].url",
          migratedKey: "header.navItems[2].link",
          legacyValue: "Nhãn: 'Cẩm Nang', Link: '/blog'",
          migratedValue: "Nhãn: 'Cẩm Nang', Link: '/blog'",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "item_contact",
          fieldLabel: "Mục 4: Liên Hệ & Tra Cứu",
          legacyKey: "menu_items[3].url",
          migratedKey: "header.navItems[3].link",
          legacyValue: "Nhãn: 'Liên Hệ', Link: '/contact'",
          migratedValue: "Nhãn: 'Liên Hệ', Link: '/contact'",
          status: "match",
          classification: "100% Match",
        },
      ],
    },

    // 8. CATEGORIES
    {
      id: "ent-cat-12",
      pageIds: ["page-home", "page-catalog"],
      legacyId: "CAT-12",
      migratedId: "pw2_cat_12",
      entityGroup: "categories",
      entityName: `Danh Mục: ${theme.categoryName}`,
      entityIdentifier: "Slug: danh-muc-chinh",
      matchStatus: "match",
      totalFields: 4,
      matchedFields: 4,
      discrepancyCount: 0,
      fields: [
        {
          fieldName: "name",
          fieldLabel: "Tên Danh Mục",
          legacyKey: "categories.name",
          migratedKey: "categories.name",
          legacyValue: theme.categoryName,
          migratedValue: theme.categoryName,
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "slug",
          fieldLabel: "Slug Danh Mục",
          legacyKey: "categories.slug",
          migratedKey: "categories.slug",
          legacyValue: "mat-ong-nong-san",
          migratedValue: "mat-ong-nong-san",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "description",
          fieldLabel: "Mô Tả Danh Mục",
          legacyKey: "categories.description",
          migratedKey: "categories.description",
          legacyValue: `${theme.categoryName} Chuẩn Chất Lượng`,
          migratedValue: `${theme.categoryName} Chuẩn Chất Lượng`,
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "seo_title",
          fieldLabel: "Tiêu Đề SEO",
          legacyKey: "categories.meta_title",
          migratedKey: "categories.meta.title",
          legacyValue: `${theme.categoryName} Chính Hãng`,
          migratedValue: `${theme.categoryName} Chính Hãng`,
          status: "match",
          classification: "100% Match",
        },
      ],
    },

    // 9. BLOG POSTS
    {
      id: "ent-post-88",
      pageIds: ["page-home", "page-blog"],
      legacyId: "POST-88",
      migratedId: "pw2_post_88",
      entityGroup: "posts",
      entityName: `Bài Viết: ${theme.articleTitle}`,
      entityIdentifier: "Slug: bai-viet-huong-dan",
      matchStatus: "match",
      totalFields: 5,
      matchedFields: 5,
      discrepancyCount: 0,
      fields: [
        {
          fieldName: "title",
          fieldLabel: "Tiêu Đề Bài Viết",
          legacyKey: "articles.title",
          migratedKey: "posts.title",
          legacyValue: theme.articleTitle,
          migratedValue: theme.articleTitle,
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "slug",
          fieldLabel: "Đường Dẫn Slug",
          legacyKey: "articles.slug",
          migratedKey: "posts.slug",
          legacyValue: "5-cach-phan-biet-mat-ong-that-gia",
          migratedValue: "5-cach-phan-biet-mat-ong-that-gia",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "author",
          fieldLabel: "Tác Giả",
          legacyKey: "articles.author_name",
          migratedKey: "posts.author",
          legacyValue: "Nguyễn Văn An",
          migratedValue: "Nguyễn Văn An",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "published_at",
          fieldLabel: "Ngày Xuất Bản",
          legacyKey: "articles.published_at",
          migratedKey: "posts.publishedAt",
          legacyValue: "2026-05-10T08:00:00Z",
          migratedValue: "2026-05-10T08:00:00Z",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "tags",
          fieldLabel: "Từ Khóa Tags",
          legacyKey: "articles.tags",
          migratedKey: "posts.tags",
          legacyValue: "mật ong, sức khỏe",
          migratedValue: "mật ong, sức khỏe",
          status: "match",
          classification: "100% Match",
        },
      ],
    },

    // 10. STORE SETTINGS & FOOTER (SET-01)
    {
      id: "ent-set-01",
      pageIds: ["page-home", "page-catalog", "page-about", "page-blog", "page-contact", "page-custom-policy"],
      legacyId: "SET-01",
      migratedId: "pw2_settings_01",
      entityGroup: "settings",
      entityName: "Cài Đặt Cửa Hàng, Chân Trang & Mạng Xã Hội",
      entityIdentifier: "Tenant: OrganicNest",
      matchStatus: isWarn ? "warning" : "match",
      totalFields: 7,
      matchedFields: isWarn ? 6 : 7,
      discrepancyCount: isWarn ? 1 : 0,
      fields: [
        {
          fieldName: "store_name",
          fieldLabel: "Tên Cửa Hàng",
          legacyKey: "stores.name",
          migratedKey: "tenants.name",
          legacyValue: "OrganicNest",
          migratedValue: "OrganicNest",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "hotline",
          fieldLabel: "Hotline CSKH",
          legacyKey: "stores.hotline",
          migratedKey: "store_settings.hotline",
          legacyValue: "1900 8888",
          migratedValue: "1900 8888",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "email",
          fieldLabel: "Email Hỗ Trợ",
          legacyKey: "stores.email",
          migratedKey: "store_settings.email",
          legacyValue: "contact@organicnest.vn",
          migratedValue: "contact@organicnest.vn",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "address",
          fieldLabel: "Địa Chỉ Trụ Sở",
          legacyKey: "stores.address",
          migratedKey: "store_settings.address",
          legacyValue: "Xã Ba Trại, Huyện Ba Vì, Hà Nội",
          migratedValue: "Xã Ba Trại, Huyện Ba Vì, Hà Nội",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "google_maps_url",
          fieldLabel: "Iframe Bản Đồ Chỉ Đường",
          legacyKey: "stores.map_url",
          migratedKey: "store_settings.googleMapsUrl",
          legacyValue: "https://maps.google.com/?q=bavi",
          migratedValue: isWarn ? null : "https://maps.google.com/?q=bavi",
          status: isWarn ? "warning" : "match",
          classification: isWarn ? "P1 Warning" : "100% Match",
          diffExplanation: isWarn ? "Chưa migrate trường Google Maps Embed URL vào store_settings của PW2" : undefined,
          remediationAction: isWarn ? "Dev bổ sung trường `googleMapsUrl` trong global store-settings" : undefined,
        },
        {
          fieldName: "social_facebook",
          fieldLabel: "Link Facebook Fanpage",
          legacyKey: "stores.facebook",
          migratedKey: "store_settings.socialLinks.facebook",
          legacyValue: "https://facebook.com/organicnest",
          migratedValue: "https://facebook.com/organicnest",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "social_zalo",
          fieldLabel: "Link Zalo OA",
          legacyKey: "stores.zalo",
          migratedKey: "store_settings.socialLinks.zalo",
          legacyValue: "https://zalo.me/0988888888",
          migratedValue: "https://zalo.me/0988888888",
          status: "match",
          classification: "100% Match",
        },
      ],
    },

    // 11. LAYOUT BLOCKS (BLOCKS-01: Hero Banner)
    {
      id: "ent-blk-01",
      pageIds: ["page-home"],
      legacyId: "BLK-1365",
      migratedId: "pw2_blk_hero",
      entityGroup: "blocks",
      entityName: "Khối Giao Diện: Hero Banner 1365",
      entityIdentifier: "Pos: #01 (hero/split-left)",
      matchStatus: "match",
      totalFields: 3,
      matchedFields: 3,
      discrepancyCount: 0,
      fields: [
        {
          fieldName: "component_type",
          fieldLabel: "Loại Khối",
          legacyKey: "page_components.component_type",
          migratedKey: "pages.layout[0].blockType",
          legacyValue: "hero_banner_1365",
          migratedValue: "hero/split-left",
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "order",
          fieldLabel: "Thứ Tự Hiển Thị",
          legacyKey: "page_components.order",
          migratedKey: "pages.layout[0]._order",
          legacyValue: 1,
          migratedValue: 1,
          status: "match",
          classification: "100% Match",
        },
        {
          fieldName: "config_json",
          fieldLabel: "Cấu Hình Tuỳ Chọn",
          legacyKey: "page_components.config",
          migratedKey: "pages.layout[0].config",
          legacyValue: "autoplay: true, speed: 5000",
          migratedValue: "autoplay: true, speed: 5000",
          status: "match",
          classification: "100% Match",
        },
      ],
    },
  ];

  // Calculate statistics
  const totalEntitiesV1 = records.length;
  const missingCount = records.filter((r) => r.matchStatus === "missing_in_pw2").length;
  const totalEntitiesV2 = totalEntitiesV1 - missingCount;
  const matchedEntities = records.filter((r) => r.matchStatus === "match").length;

  const allFields = records.flatMap((r) => r.fields);
  const matchedFieldCount = allFields.filter((f) => f.status === "match").length;
  const totalFieldCount = allFields.length;
  const fieldMatchRate = totalFieldCount > 0 ? `${((matchedFieldCount / totalFieldCount) * 100).toFixed(1)}%` : "100.0%";

  const groupStats: Record<EntityGroupType, { total: number; pass: number; warn: number; fail: number }> = {
    products: { total: 1, pass: isFailed ? 0 : 1, warn: 0, fail: isFailed ? 1 : 0 },
    variants: { total: 2, pass: isFailed ? 1 : 2, warn: 0, fail: isFailed ? 1 : 0 },
    banners: { total: 2, pass: 2, warn: 0, fail: 0 },
    richtext: { total: 1, pass: isFailed ? 0 : 1, warn: 0, fail: isFailed ? 1 : 0 },
    categories: { total: 1, pass: 1, warn: 0, fail: 0 },
    navigation: { total: 1, pass: 1, warn: 0, fail: 0 },
    posts: { total: 1, pass: 1, warn: 0, fail: 0 },
    settings: { total: 1, pass: isWarn ? 0 : 1, warn: isWarn ? 1 : 0, fail: 0 },
    blocks: { total: 1, pass: 1, warn: 0, fail: 0 },
  };

  return {
    storeId: siteId,
    summary: {
      totalEntitiesV1,
      totalEntitiesV2,
      matchedEntities,
      missingInPW2Count: missingCount,
      orphanInPW2Count: 0,
      fieldMatchRate,
      groupStats,
    },
    records,
  };
}

/**
 * Get deep store diff with specialized Media, Text Format & Field-by-Field audits
 */
export function getStoreDeepDiff(siteId: string, overrideStatus?: "passed" | "warning" | "failed"): StoreDeepDiff | null {
  const allStores = generateReconciliationCatalog(2000);
  const store = allStores.find((s) => s.id === siteId);
  if (!store) return null;

  const currentStatus = overrideStatus || store.status;
  const theme = siteId === "SITE-0001" || siteId === "SITE-0025"
    ? SECTOR_DATA_MAP.FB101
    : getSectorTheme(store.templateCode);
  const isFailed = currentStatus === "failed";
  const isWarn = currentStatus === "warning";
  const isPass = currentStatus === "passed";

  const defectsHome: DefectItem[] = [];
  if (isFailed) {
    defectsHome.push(
      {
        type: "p0",
        icon: "🚨",
        title: "Thiếu Thương Hiệu Sản Phẩm (products.brand_id)",
        desc: "PW1 lưu brand 'Nông Trại Hữu Cơ Ba Vì' nhưng PW2 chưa có collection `brands` nên bị drop toàn bộ brand.",
        fix: "Dev Backend tạo collection `brands` và thêm relationship field vào `products`.",
        affectedField: "products.brand_id",
        entityType: "products",
      },
      {
        type: "p0",
        icon: "🚨",
        title: "Khối #04 (Product Listing): Mất Biến Thể Size 1 Lít",
        desc: "Sản phẩm Mật Ong Rừng SKU 'ONG-RUNG' chỉ migrate được hũ 500ml, bị mất biến thể Can 1 Lít (giá 320.000đ).",
        fix: "Dev chạy lại script ETL converter cho bảng `product_variants`.",
        affectedField: "variants[].sku",
        entityType: "variants",
      },
      {
        type: "p0",
        icon: "🚨",
        title: "Khối #07 (RichText #2): Bảng Biểu Cam Kết <table> Bị Mất Cấu Trúc (Flattened Text)",
        desc: "Bảng 3 cột cam kết chất lượng VietGAP bị mất thẻ <tr> <td> khi chuyển từ TinyMCE sang Lexical AST, làm văn bản bị dồn cục không còn kẻ cột.",
        fix: "Dev cập nhật Lexical HTML parser hỗ trợ TableBlock.",
        affectedField: "rich_text.content",
        entityType: "richtext",
      }
    );
  } else if (isWarn) {
    defectsHome.push(
      {
        type: "p1",
        icon: "⚠️",
        title: "Khối #04 (Product Listing): 1 Ảnh Thumbnail Bị Lỗi Link (404 Not Found)",
        desc: "Ảnh thumbnail sản phẩm mat_ong_1l_thumb.jpg trả về mã HTTP 404 do link CDN cũ chưa được whitelist.",
        fix: "Dev re-upload lại ảnh từ bản backup S3 hoặc cập nhật CDN domain.",
        affectedField: "media.url",
        entityType: "media",
      },
      {
        type: "p1",
        icon: "⚠️",
        title: "Khối #10 (Footer): Chưa Cấu Hình Nhúng Bản Đồ Google Maps",
        desc: "Bản cũ PW1 có khung nhúng iframe Google Maps chỉ đường tới shop, nhưng bản mới PW2 đang thiếu trường mapUrl.",
        fix: "Dev bổ sung trường `googleMapsEmbedUrl` vào footer settings.",
        affectedField: "stores.map_url",
        entityType: "stores",
      }
    );
  }

  // Specialized Media Audits for this store
  const mediaAuditsHome: MediaAuditItem[] = [
    {
      id: "media-hero-01",
      label: "Hero Banner Cover Image",
      pw1Url: "https://tm-prime-web.sgp1.digitaloceanspaces.com/hero_banner_organic.jpg",
      pw2Url: "https://assets.primeweb.io/media/hero_banner_organic.webp",
      httpStatusV1: 200,
      httpStatusV2: 200,
      altTextV1: "Thực phẩm nông sản sạch hữu cơ VietGAP",
      altTextV2: "Thực phẩm nông sản sạch hữu cơ VietGAP",
      dimensionsV1: "1920x800 px (16:9)",
      dimensionsV2: "1920x800 px (16:9 WebP)",
      status: "pass",
    },
    {
      id: "media-prod-01",
      label: "Ảnh Sản Phẩm: Mật Ong Rừng 500ml",
      pw1Url: "https://tm-prime-web.sgp1.digitaloceanspaces.com/products/mat_ong_500ml.jpg",
      pw2Url: "https://assets.primeweb.io/media/products/mat_ong_500ml.webp",
      httpStatusV1: 200,
      httpStatusV2: 200,
      altTextV1: "Hũ Mật Ong Rừng Ba Vì Nguyên Chất 500ml",
      altTextV2: "Hũ Mật Ong Rừng Ba Vì Nguyên Chất 500ml",
      dimensionsV1: "800x800 px (1:1)",
      dimensionsV2: "800x800 px (1:1 WebP)",
      status: "pass",
    },
    {
      id: "media-prod-02",
      label: "Ảnh Sản Phẩm: Can Mật Ong 1 Lít",
      pw1Url: "https://tm-prime-web.sgp1.digitaloceanspaces.com/products/mat_ong_1l_thumb.jpg",
      pw2Url: isWarn ? "https://assets.primeweb.io/media/broken_link_404.jpg" : "https://assets.primeweb.io/media/products/mat_ong_1l_thumb.webp",
      httpStatusV1: 200,
      httpStatusV2: isWarn ? 404 : 200,
      altTextV1: "Can Mật Ong Rừng 1 Lít Tiết Kiệm",
      altTextV2: isWarn ? "" : "Can Mật Ong Rừng 1 Lít Tiết Kiệm",
      dimensionsV1: "800x800 px (1:1)",
      dimensionsV2: isWarn ? "0x0 px (Broken)" : "800x800 px (1:1 WebP)",
      status: isWarn ? "warn" : "pass",
      issueNote: isWarn ? "HTTP 404 Not Found - Thiếu file trên CDN Storage" : undefined,
    },
    {
      id: "media-richtext-01",
      label: "RichText Inline Image (Ảnh Trang Trại Trong Bài Viết)",
      pw1Url: "https://tm-prime-web.sgp1.digitaloceanspaces.com/posts/trang_trai_ba_vi.jpg",
      pw2Url: "https://assets.primeweb.io/media/posts/trang_trai_ba_vi.webp",
      httpStatusV1: 200,
      httpStatusV2: 200,
      altTextV1: "Khu nuôi ong hoa rừng tự nhiên tại Vườn Quốc Gia Ba Vì",
      altTextV2: "Khu nuôi ong hoa rừng tự nhiên tại Vườn Quốc Gia Ba Vì",
      dimensionsV1: "1200x600 px",
      dimensionsV2: "1200x600 px",
      status: "pass",
    },
  ];

  // Specialized Text Format & UTF-8 Typography Audits
  const textFormatAuditsHome: TextFormatAuditItem[] = [
    {
      id: "text-utf8-vietnamese",
      context: "Tiêu Đề & Nội Dung Tiếng Việt Có Dấu",
      pw1Html: "Nông Trại Hữu Cơ Ba Vì — Đậm đà hương vị mật ong rừng nguyên chất 100%",
      pw2Lexical: "Nông Trại Hữu Cơ Ba Vì — Đậm đà hương vị mật ong rừng nguyên chất 100%",
      utf8Check: "pass",
      stylingCheck: { hasBold: true, hasItalic: false, hasLists: false, hasTable: false, paragraphsCount: 1 },
      pw2StylingCheck: { hasBold: true, hasItalic: false, hasLists: false, hasTable: false, paragraphsCount: 1 },
      status: "pass",
    },
    {
      id: "text-richtext-wysiwyg",
      context: "Khối #03: RichText Câu Chuyện (In Đậm, In Nghiêng, Đoạn Văn)",
      pw1Html: "<p><strong>Hành Trình 10 Năm</strong> gieo mầm xanh.</p><p><em>Cam kết 100% tự nhiên không pha đường.</em></p>",
      pw2Lexical: "Paragraph(Bold: 'Hành Trình 10 Năm') -> Paragraph(Italic: 'Cam kết 100% tự nhiên')",
      utf8Check: "pass",
      stylingCheck: { hasBold: true, hasItalic: true, hasLists: true, hasTable: false, paragraphsCount: 3 },
      pw2StylingCheck: { hasBold: true, hasItalic: true, hasLists: true, hasTable: false, paragraphsCount: 3 },
      status: "pass",
    },
    {
      id: "text-table-structure",
      context: "Khối #07: RichText Bảng Cam Kết Chất Lượng VietGAP (<table>)",
      pw1Html: "<table border='1'><tr><th>Tiêu Chí</th><th>Mật Ong Thường</th><th>Mật Ong Ba Vì</th></tr><tr><td>Độ Ẩm</td><td>>25%</td><td><18.5%</td></tr></table>",
      pw2Lexical: isFailed
        ? "TextNode('Tiêu Chí Mật Ong Thường Mật Ong Ba Vì Độ Ẩm >25% <18.5%')"
        : "TableNode(Columns: 3, Rows: 2, Headers: ['Tiêu Chí', 'Mật Ong Thường', 'Mật Ong Ba Vì'])",
      utf8Check: "pass",
      stylingCheck: { hasBold: true, hasItalic: false, hasLists: false, hasTable: true, tableColumnsCount: 3, paragraphsCount: 1 },
      pw2StylingCheck: {
        hasBold: !isFailed,
        hasItalic: false,
        hasLists: false,
        hasTable: !isFailed,
        tableColumnsCount: isFailed ? 0 : 3,
        paragraphsCount: 1,
      },
      status: isFailed ? "fail" : "pass",
      issueNote: isFailed ? "Mất cấu trúc thẻ <table>, <tr>, <td> làm bảng bị sập thành 1 chuỗi text dồn cục" : undefined,
    },
  ];

  // Dynamic 6 Pages Data
  const dynamicPages: DynamicStorePage[] = [
    // 1. HOME PAGE
    {
      id: "page-home",
      name: "Trang Chủ",
      path: "/",
      pageType: "home",
      existsInPW1: true,
      existsInPW2: true,
      totalBlocks: 10,
      defects: defectsHome,
      mediaAudits: mediaAuditsHome,
      textFormatAudits: textFormatAuditsHome,
      breakdown: [
        {
          pos: "#01",
          leg: "Hero Banner 1365",
          mig: "hero/split-left",
          layer: "Layer 1 (Mapped)",
          layerCls: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
          status: "KHỚP 100%",
          badge: "badge-pass",
          pw1Val: "Headline 'Nông Trại Hữu Cơ Ba Vì' + Button Khám Phá",
          pw2Val: "Headline 'Nông Trại Hữu Cơ Ba Vì' + Button Khám Phá",
          fix: "✓ Khớp chuẩn 100%",
        },
        {
          pos: "#02",
          leg: "Category Listing 1540",
          mig: "portfolio-grid/grid",
          layer: "Layer 1 (Mapped)",
          layerCls: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
          status: "KHỚP 100%",
          badge: "badge-pass",
          pw1Val: "3 Banners: Mật ong rừng, Hạnh nhân, Chanh vàng",
          pw2Val: "3 Banners: Mật ong rừng, Hạnh nhân, Chanh vàng",
          fix: "✓ Khớp chuẩn 100%",
        },
        {
          pos: "#03",
          leg: "Product Listing 1541",
          mig: "products-grid/grid-4",
          layer: isFailed ? "Layer 2 Gap" : isWarn ? "Needs Review" : "Layer 1 (Mapped)",
          layerCls: isFailed ? "bg-rose-950/40 text-rose-300 border-rose-500/30" : isWarn ? "bg-amber-950/40 text-amber-300 border-amber-500/30" : "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
          status: isFailed ? "MẤT BIẾN THỂ & BRAND" : isWarn ? "1 ẢNH THUMB 404" : "KHỚP 100%",
          badge: isFailed ? "badge-fail" : isWarn ? "badge-warn" : "badge-pass",
          pw1Val: "8 Sản phẩm | Đủ 2 biến thể 500ml & 1L | Brand: Nông Trại Ba Vì",
          pw2Val: isFailed ? "8 Sản phẩm | Mất biến thể 1L | brand_id: NULL" : isWarn ? "8 Sản phẩm | 1 ảnh thumb lỗi 404" : "8 Sản phẩm | Đầy đủ 100%",
          fix: isFailed ? "Dev bổ sung collection brands & migrate đủ variant" : isWarn ? "Re-upload lại ảnh S3" : "✓ Khớp chuẩn 100%",
        },
        {
          pos: "#04",
          leg: "Promo Banner 1543",
          mig: "cta/banner-promo",
          layer: "Layer 1 (Mapped)",
          layerCls: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
          status: "KHỚP 100%",
          badge: "badge-pass",
          pw1Val: "Voucher 50K - Mua Mật Ong Rừng",
          pw2Val: "Voucher 50K - Mua Mật Ong Rừng",
          fix: "✓ Khớp chuẩn 100%",
        },
        {
          pos: "#05",
          leg: "RichText 501",
          mig: "lexical-table-node",
          layer: isFailed ? "Layer 2 Gap" : "Layer 1 (Mapped)",
          layerCls: isFailed ? "bg-rose-950/40 text-rose-300 border-rose-500/30" : "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
          status: isFailed ? "MẤT THẺ TABLE" : "KHỚP 100%",
          badge: isFailed ? "badge-fail" : "badge-pass",
          pw1Val: "Bảng So Sánh Tiêu Chuẩn Nông Sản (3 Cột)",
          pw2Val: isFailed ? "Dữ liệu bị dồn cục không có cột" : "Bảng 3 Cột Chuẩn",
          fix: isFailed ? "Cập nhật Lexical Table parser" : "✓ Khớp chuẩn 100%",
        },
      ],
      blocks: [
        {
          id: "home-01",
          order: 1,
          blockType: "hero",
          title: "Khối #01: Hero Banner Đầu Trang",
          pw1Component: "banner (Hero Single 1365)",
          pw2Block: "hero/split-left",
          pw1Preview: { headline: "Nông Trại Hữu Cơ Ba Vì — Đậm Đà Hương Vị Tự Nhiên", subheadline: "Thu hoạch tươi mỗi ngày tại thung lũng Ba Vì theo tiêu chuẩn hữu cơ VietGAP.", badgeText: "100% Thuần Khiết" },
          pw2Preview: { headline: "Nông Trại Hữu Cơ Ba Vì — Đậm Đà Hương Vị Tự Nhiên", subheadline: "Thu hoạch tươi mỗi ngày tại thung lũng Ba Vì theo tiêu chuẩn hữu cơ VietGAP.", badgeText: "100% Thuần Khiết" },
          status: "pass",
        },
        {
          id: "home-02",
          order: 2,
          blockType: "banner",
          title: "Khối #02: Banner 3 Danh Mục Nổi Bật",
          pw1Component: "category_listing (1540)",
          pw2Block: "portfolio-grid/grid",
          pw1Preview: { headline: "3 Danh Mục: Mật Ong Rừng, Hạt Sấy Mộc, Chanh Rừng VietGAP", badgeText: "3 Nhóm SP" },
          pw2Preview: { headline: "3 Danh Mục: Mật Ong Rừng, Hạt Sấy Mộc, Chanh Rừng VietGAP", badgeText: "3 Nhóm SP" },
          status: "pass",
        },
        {
          id: "home-03",
          order: 3,
          blockType: "richtext",
          title: "Khối #03: RichText Câu Chuyện Thương Hiệu (Word-like)",
          pw1Component: "rich_text (WYSIWYG)",
          pw2Block: "about/split (Lexical)",
          pw1Preview: { headline: "Hành Trình 10 Năm Gieo Mầm Nông Sản Sạch Ba Vì", bodyText: "Khởi nguồn từ những đồi hoa tràm và hoa rừng tự nhiên, OrganicNest cam kết không pha đường, không chất bảo quản...", imageCount: 2, hasTable: false },
          pw2Preview: { headline: "Hành Trình 10 Năm Gieo Mầm Nông Sản Sạch Ba Vì", bodyText: "Khởi nguồn từ những đồi hoa tràm và hoa rừng tự nhiên, OrganicNest cam kết không pha đường, không chất bảo quản...", imageCount: 2, hasTable: false },
          status: "pass",
        },
        {
          id: "home-04",
          order: 4,
          blockType: "products",
          title: "Khối #04: Danh Sách Sản Phẩm Nổi Bật (8 SP)",
          pw1Component: "product_listing (1541)",
          pw2Block: "products-grid/grid-4",
          pw1Preview: { headline: "Mật Ong Rừng 500ml (180k), Can 1L (320k), Hạnh Nhân (145k)", productCount: 8, badgeText: "Đủ 2 Biến Thể (500ml & 1L)" },
          pw2Preview: {
            headline: "Mật Ong Rừng 500ml (180k), Can 1L (320k), Hạnh Nhân (145k)",
            productCount: 8,
            badgeText: isFailed ? "🚨 MẤT BIẾN THỂ 1L" : isWarn ? "⚠️ 1 ẢNH THUMB LỖI 404" : "Đủ 2 Biến Thể (500ml & 1L)",
          },
          status: isFailed ? "fail" : isWarn ? "warn" : "pass",
          discrepancyNote: isFailed
            ? "Mất biến thể Can 1L (giá 320.000đ) của SKU ONG-RUNG"
            : isWarn
            ? "Ảnh thumbnail mat_ong_1l_thumb.jpg trả về mã HTTP 404 trên CDN"
            : undefined,
        },
        {
          id: "home-05",
          order: 5,
          blockType: "banner",
          title: "Khối #05: Banner Voucher 50K Giảm Giá",
          pw1Component: "banner (Promo Banner 1543)",
          pw2Block: "cta/banner-promo",
          pw1Preview: { headline: "VOUCHER 50K - MUA MẬT ONG RỪNG", subheadline: "Áp dụng cho đơn hàng từ 300.000đ", badgeText: "Giảm 50.000đ" },
          pw2Preview: { headline: "VOUCHER 50K - MUA MẬT ONG RỪNG", subheadline: "Áp dụng cho đơn hàng từ 300.000đ", badgeText: "Giảm 50.000đ" },
          status: "pass",
        },
        {
          id: "home-06",
          order: 6,
          blockType: "banner",
          title: "Khối #06: Banner Miễn Phí Vận Chuyển Toàn Quốc",
          pw1Component: "banner (Freeship Banner)",
          pw2Block: "cta/banner-minimal",
          pw1Preview: { headline: "MIỄN PHÍ VẬN CHUYỂN CHO ĐƠN TỪ 500K", subheadline: "Giao hỏa tốc 2H tại Hà Nội & TP.HCM", badgeText: "Freeship 0đ" },
          pw2Preview: { headline: "MIỄN PHÍ VẬN CHUYỂN CHO ĐƠN TỪ 500K", subheadline: "Giao hỏa tốc 2H tại Hà Nội & TP.HCM", badgeText: "Freeship 0đ" },
          status: "pass",
        },
        {
          id: "home-07",
          order: 7,
          blockType: "richtext",
          title: "Khối #07: RichText Bảng Cam Kết Chất Lượng VietGAP (<table>)",
          pw1Component: "rich_text (Bảng 3 Cột <table>)",
          pw2Block: "lexical-table-node",
          pw1Preview: { headline: "Bảng So Sánh Tiêu Chuẩn Nông Sản", bodyText: "Tiêu Chí | Mật Ong Thường | Mật Ong Ba Vì (Đậm đặc >23%, Độ ẩm <18.5%)", hasTable: true, imageCount: 1 },
          pw2Preview: { headline: "Bảng So Sánh Tiêu Chuẩn Nông Sản", bodyText: isFailed ? "Tiêu Chí Mật Ong Thường Mật Ong Ba Vì (Dữ liệu bị dồn cục)" : "Tiêu Chí | Mật Ong Thường | Mật Ong Ba Vì", hasTable: !isFailed, imageCount: 1 },
          status: isFailed ? "fail" : "pass",
          discrepancyNote: isFailed ? "Mất thẻ <table> làm số liệu bị dồn thành 1 dòng text thô" : undefined,
        },
        {
          id: "home-08",
          order: 8,
          blockType: "banner",
          title: "Khối #08: Banner Tải App Nhận Quà 100K",
          pw1Component: "banner (App Download Banner)",
          pw2Block: "cta/download-app",
          pw1Preview: { headline: "TẢI APP ORGANICNEST NHẬN QUÀ 100K", subheadline: "Có mặt trên cả App Store và Google Play", badgeText: "Quà 100K" },
          pw2Preview: { headline: "TẢI APP ORGANICNEST NHẬN QUÀ 100K", subheadline: "Có mặt trên cả App Store và Google Play", badgeText: "Quà 100K" },
          status: "pass",
        },
        {
          id: "home-09",
          order: 9,
          blockType: "blog",
          title: "Khối #09: Danh Sách Tin Tức & Cẩm Nang",
          pw1Component: "article_listing (1544)",
          pw2Block: "blog-list/cards-3",
          pw1Preview: { headline: "Cẩm Nang Sức Khỏe & Mẹo Nhà Nông", bodyText: "3 Bài viết mới nhất về phân biệt mật ong thật và cách pha trà" },
          pw2Preview: { headline: "Cẩm Nang Sức Khỏe & Mẹo Nhà Nông", bodyText: "3 Bài viết mới nhất về phân biệt mật ong thật và cách pha trà" },
          status: "pass",
        },
        {
          id: "home-10",
          order: 10,
          blockType: "footer",
          title: "Khối #10: Chân Trang Đa Cột & Bản Đồ (Footer)",
          pw1Component: "Footer Custom (1553)",
          pw2Block: "footer/dark-gradient",
          pw1Preview: { headline: "Hotline 1900 8888, Email contact@organicnest.vn, Bản Đồ Ba Vì", bodyText: "4 Cột chính sách đổi trả, phương thức thanh toán" },
          pw2Preview: {
            headline: "Hotline 1900 8888, Email contact@organicnest.vn",
            bodyText: isWarn ? "4 Cột chính sách (⚠️ Chưa có iframe Google Maps)" : "4 Cột chính sách đổi trả, phương thức thanh toán",
          },
          status: isWarn ? "warn" : "pass",
          discrepancyNote: isWarn ? "Chưa cấu hình nhúng bản đồ Google Maps chỉ đường" : undefined,
        },
      ],
    },

    // 2. PRODUCTS CATALOG PAGE
    {
      id: "page-catalog",
      name: "Sản Phẩm & Danh Mục",
      path: "/products",
      pageType: "catalog",
      existsInPW1: true,
      existsInPW2: true,
      totalBlocks: 6,
      defects: [],
      mediaAudits: [],
      textFormatAudits: [],
      breakdown: [],
      blocks: [
        {
          id: "cat-01",
          order: 1,
          blockType: "banner",
          title: "Banner Đầu Trang Danh Mục",
          pw1Component: "banner (Catalog Banner)",
          pw2Block: "hero/category-header",
          pw1Preview: { headline: "Tất Cả Sản Phẩm Nông Sản Sạch" },
          pw2Preview: { headline: "Tất Cả Sản Phẩm Nông Sản Sạch" },
          status: "pass",
        },
        {
          id: "cat-02",
          order: 2,
          blockType: "filter",
          title: "Bộ Lọc Phân Loại Danh Mục (product_filter)",
          pw1Component: "product_filter",
          pw2Block: "products-filter/sidebar",
          pw1Preview: { headline: "Lọc 4 danh mục + Khoảng giá 0 - 500k" },
          pw2Preview: { headline: "Lọc 4 danh mục + Khoảng giá 0 - 500k" },
          status: "pass",
        },
        {
          id: "cat-03",
          order: 3,
          blockType: "filter",
          title: "Dropdown Sắp Xếp Giá & Độ Mới (product_sort)",
          pw1Component: "product_sort",
          pw2Block: "products-sort/dropdown",
          pw1Preview: { headline: "Mới nhất, Giá tăng dần, Giá giảm dần" },
          pw2Preview: { headline: "Mới nhất, Giá tăng dần, Giá giảm dần" },
          status: "pass",
        },
        {
          id: "cat-04",
          order: 4,
          blockType: "products",
          title: "Lưới 24 Sản Phẩm Phân Trang (product_listing)",
          pw1Component: "product_listing (24 SP, 12 SP/trang)",
          pw2Block: "products-grid/paginated",
          pw1Preview: { productCount: 24, badgeText: "24 SP (2 Trang)" },
          pw2Preview: { productCount: 24, badgeText: "24 SP (2 Trang)" },
          status: "pass",
        },
        {
          id: "cat-05",
          order: 5,
          blockType: "richtext",
          title: "RichText: Hướng Dẫn Bảo Quản Nông Sản Tươi",
          pw1Component: "rich_text (500 chữ)",
          pw2Block: "about/content (Lexical)",
          pw1Preview: { headline: "Mẹo bảo quản rau củ và mật ong không bị lên men" },
          pw2Preview: { headline: "Mẹo bảo quản rau củ và mật ong không bị lên men" },
          status: "pass",
        },
        {
          id: "cat-06",
          order: 6,
          blockType: "footer",
          title: "Chân Trang",
          pw1Component: "Footer",
          pw2Block: "footer",
          pw1Preview: { headline: "Footer 4 Cột" },
          pw2Preview: { headline: "Footer 4 Cột" },
          status: "pass",
        },
      ],
    },

    // 3. ABOUT US PAGE
    {
      id: "page-about",
      name: "Về Chúng Tôi",
      path: "/about",
      pageType: "custom_page",
      existsInPW1: true,
      existsInPW2: true,
      totalBlocks: 5,
      defects: [],
      mediaAudits: [],
      textFormatAudits: [],
      breakdown: [],
      blocks: [
        {
          id: "about-01",
          order: 1,
          blockType: "hero",
          title: "Hero Banner Giới Thiệu Nông Trại",
          pw1Component: "banner (About Cover)",
          pw2Block: "hero/about-header",
          pw1Preview: { headline: "Về Nông Trại OrganicNest Ba Vì" },
          pw2Preview: { headline: "Về Nông Trại OrganicNest Ba Vì" },
          status: "pass",
        },
        {
          id: "about-02",
          order: 2,
          blockType: "richtext",
          title: "RichText: Câu Chuyện Sáng Lập (1.500 chữ + 3 ảnh xưởng)",
          pw1Component: "rich_text",
          pw2Block: "about/content (Lexical)",
          pw1Preview: { headline: "Sứ Mệnh 10 Năm Gieo Mầm Nông Sản Sạch", imageCount: 3, hasTable: false },
          pw2Preview: { headline: "Sứ Mệnh 10 Năm Gieo Mầm Nông Sản Sạch", imageCount: 3, hasTable: false },
          status: "pass",
        },
        {
          id: "about-03",
          order: 3,
          blockType: "banner",
          title: "Banner Chứng Nhận VietGAP & ISO 22000",
          pw1Component: "banner (Certificates)",
          pw2Block: "cta/certificates",
          pw1Preview: { headline: "Chứng Nhận Quốc Tế Tiêu Chuẩn Nông Sản" },
          pw2Preview: { headline: "Chứng Nhận Quốc Tế Tiêu Chuẩn Nông Sản" },
          status: "pass",
        },
        {
          id: "about-04",
          order: 4,
          blockType: "richtext",
          title: "RichText: Giá Trị Cốt Lõi & Trách Nhiệm Xã Hội",
          pw1Component: "rich_text (800 chữ)",
          pw2Block: "about/values (Lexical)",
          pw1Preview: { headline: "Tâm Huyết Với Người Tiêu Dùng Việt Nam" },
          pw2Preview: { headline: "Tâm Huyết Với Người Tiêu Dùng Việt Nam" },
          status: "pass",
        },
        {
          id: "about-05",
          order: 5,
          blockType: "footer",
          title: "Chân Trang",
          pw1Component: "Footer",
          pw2Block: "footer",
          pw1Preview: { headline: "Footer 4 Cột" },
          pw2Preview: { headline: "Footer 4 Cột" },
          status: "pass",
        },
      ],
    },

    // 4. BLOG PAGE
    {
      id: "page-blog",
      name: "Tin Tức & Cẩm Nang",
      path: "/blog",
      pageType: "blog",
      existsInPW1: true,
      existsInPW2: true,
      totalBlocks: 5,
      defects: [],
      mediaAudits: [],
      textFormatAudits: [],
      breakdown: [],
      blocks: [
        {
          id: "blog-01",
          order: 1,
          blockType: "banner",
          title: "Banner Đầu Trang Tin Tức",
          pw1Component: "banner (Blog Header)",
          pw2Block: "hero/blog-header",
          pw1Preview: { headline: "Cẩm Nang Sức Khỏe & Mẹo Nhà Nông" },
          pw2Preview: { headline: "Cẩm Nang Sức Khỏe & Mẹo Nhà Nông" },
          status: "pass",
        },
        {
          id: "blog-02",
          order: 2,
          blockType: "filter",
          title: "Bộ Lọc Chuyên Mục Bài Viết (article_filter)",
          pw1Component: "article_filter",
          pw2Block: "blog-categories/pills",
          pw1Preview: { headline: "3 Danh mục: Cẩm nang sức khỏe, Mẹo nhà nông, Khuyến mãi" },
          pw2Preview: { headline: "3 Danh mục: Cẩm nang sức khỏe, Mẹo nhà nông, Khuyến mãi" },
          status: "pass",
        },
        {
          id: "blog-03",
          order: 3,
          blockType: "blog",
          title: "Danh Sách Bài Viết Mới Nhất (article_listing)",
          pw1Component: "article_listing (6 Bài viết)",
          pw2Block: "blog-list/grid-3",
          pw1Preview: { headline: "6 Bài viết có thumbnail và ngày đăng" },
          pw2Preview: { headline: "6 Bài viết có thumbnail và ngày đăng" },
          status: "pass",
        },
        {
          id: "blog-04",
          order: 4,
          blockType: "richtext",
          title: "RichText: Chi Tiết Bài Viết (1.200 chữ)",
          pw1Component: "rich_text (Lexical Content)",
          pw2Block: "article-content/lexical",
          pw1Preview: { headline: "Thử mật ong với nước lọc và giấy thấm", imageCount: 2 },
          pw2Preview: { headline: "Thử mật ong với nước lọc và giấy thấm", imageCount: 2 },
          status: "pass",
        },
        {
          id: "blog-05",
          order: 5,
          blockType: "footer",
          title: "Chân Trang",
          pw1Component: "Footer",
          pw2Block: "footer",
          pw1Preview: { headline: "Footer 4 Cột" },
          pw2Preview: { headline: "Footer 4 Cột" },
          status: "pass",
        },
      ],
    },

    // 5. CONTACT & ORDER TRACKING
    {
      id: "page-contact",
      name: "Liên Hệ & Tra Cứu",
      path: "/contact",
      pageType: "contact",
      existsInPW1: true,
      existsInPW2: true,
      totalBlocks: 4,
      defects: [],
      mediaAudits: [],
      textFormatAudits: [],
      breakdown: [],
      blocks: [
        {
          id: "contact-01",
          order: 1,
          blockType: "contact",
          title: "Form Gửi Liên Hệ & Hotline 1900 8888 (contact)",
          pw1Component: "contact",
          pw2Block: "contact/split-form",
          pw1Preview: { headline: "Hotline 1900 8888 + Email contact@organicnest.vn" },
          pw2Preview: { headline: "Hotline 1900 8888 + Email contact@organicnest.vn" },
          status: "pass",
        },
        {
          id: "contact-02",
          order: 2,
          blockType: "tracking",
          title: "Form Tra Cứu Trạng Thái Đơn Hàng (order_tracking)",
          pw1Component: "order_tracking",
          pw2Block: "order-tracking/lookup",
          pw1Preview: { headline: "Nhập mã đơn 'ORD-12345' ➔ Hiện trạng thái 'Đang giao'" },
          pw2Preview: { headline: "Nhập mã đơn 'ORD-12345' ➔ Hiện trạng thái 'Đang giao'" },
          status: "pass",
        },
        {
          id: "contact-03",
          order: 3,
          blockType: "richtext",
          title: "RichText: Chính Sách Giao Hàng & Đổi Trả",
          pw1Component: "rich_text (600 chữ)",
          pw2Block: "about/policy (Lexical)",
          pw1Preview: { headline: "Quy định đổi trả trong vòng 7 ngày kể từ khi nhận hàng" },
          pw2Preview: { headline: "Quy định đổi trả trong vòng 7 ngày kể từ khi nhận hàng" },
          status: "pass",
        },
        {
          id: "contact-04",
          order: 4,
          blockType: "footer",
          title: "Chân Trang",
          pw1Component: "Footer",
          pw2Block: "footer",
          pw1Preview: { headline: "Footer 4 Cột" },
          pw2Preview: { headline: "Footer 4 Cột" },
          status: "pass",
        },
      ],
    },

    // 6. CUSTOM MERCHANT LANDING PAGE
    {
      id: "page-custom-policy",
      name: "Chính Sách Đổi Trả",
      path: "/chinh-sach-doi-tra",
      pageType: "custom_page",
      existsInPW1: true,
      existsInPW2: !isFailed,
      totalBlocks: 3,
      defects: isFailed
        ? [
            {
              type: "p0",
              icon: "🚨",
              title: "Thiếu Trang: /chinh-sach-doi-tra (Chưa Được Migrate)",
              desc: "Trang tùy chỉnh của khách hàng tồn tại trong bảng `pages` của PW1 nhưng chưa được tạo trong collection `pages` của PW2.",
              fix: "Dev chạy script migrate pages để bổ sung trang này.",
              affectedField: "pages.slug",
              entityType: "pages",
            },
          ]
        : [],
      mediaAudits: [],
      textFormatAudits: [],
      breakdown: [],
      blocks: [
        {
          id: "policy-01",
          order: 1,
          blockType: "banner",
          title: "Banner Chính Sách Khách Hàng",
          pw1Component: "banner",
          pw2Block: isFailed ? "[THIẾU TRANG]" : "hero/policy-header",
          pw1Preview: { headline: "Quy Định Đổi Trả Sản Phẩm Trong 7 Ngày" },
          pw2Preview: { headline: isFailed ? "🚨 TRANG CHƯA ĐƯỢC TẠO TRÊN PW2" : "Quy Định Đổi Trả Sản Phẩm Trong 7 Ngày" },
          status: isFailed ? "fail" : "pass",
          discrepancyNote: isFailed ? "Trang chưa tồn tại trên PW2" : undefined,
        },
        {
          id: "policy-02",
          order: 2,
          blockType: "richtext",
          title: "RichText: Toàn Văn Điều Khoản Đổi Trả (800 chữ)",
          pw1Component: "rich_text",
          pw2Block: isFailed ? "[THIẾU TRANG]" : "about/policy (Lexical)",
          pw1Preview: { headline: "Điều kiện áp dụng và quy trình gửi trả hàng" },
          pw2Preview: { headline: isFailed ? "🚨 NỘI DUNG CHƯA CÓ TRÊN PW2" : "Điều kiện áp dụng và quy trình gửi trả hàng" },
          status: isFailed ? "fail" : "pass",
          discrepancyNote: isFailed ? "Trang chưa tồn tại trên PW2" : undefined,
        },
        {
          id: "policy-03",
          order: 3,
          blockType: "footer",
          title: "Chân Trang",
          pw1Component: "Footer",
          pw2Block: isFailed ? "[THIẾU TRANG]" : "footer",
          pw1Preview: { headline: "Footer 4 Cột" },
          pw2Preview: { headline: isFailed ? "🚨 KHÔNG CÓ TRANG" : "Footer 4 Cột" },
          status: isFailed ? "fail" : "pass",
        },
      ],
    },
  ];

  return {
    ...store,
    score: isPass ? "99.8%" : store.score,
    status: currentStatus,
    totalPagesInPW1: dynamicPages.length,
    totalPagesInPW2: isFailed ? dynamicPages.length - 1 : dynamicPages.length,
    missingPagesCount: isFailed ? 1 : 0,
    pages: dynamicPages,
    fieldDiffAudit: getFieldDiffAuditForStore(siteId, currentStatus),
    reconciliationAudit: {
      totalProductsV1: 24,
      totalProductsV2: 24,
      matchedProducts: isFailed ? 22 : 24,
      missingVariantsCount: isFailed ? 1 : 0,
      droppedBrandCount: isFailed ? 24 : 0,
      missingCostCount: isFailed ? 2 : 0,
      brokenMediaCount: isWarn ? 1 : 0,
      searchParity: "100% Match",
      cartParity: "100% Match",
      filterParity: "100% Match",
      richTextParity: isFailed ? "65% (Bị mất table)" : "100% Match",
    },
  };
}

/**
 * Compute aggregate summary metrics
 */
export function getDashboardMetrics(catalog: StoreSummary[]): MigrationDashboardMetrics {
  const total = catalog.length;
  let pass = 0;
  let warn = 0;
  let fail = 0;
  let scoreSum = 0;

  for (const s of catalog) {
    if (s.status === "passed") pass++;
    else if (s.status === "warning") warn++;
    else fail++;

    scoreSum += parseFloat(s.score) || 0;
  }

  const avg = total > 0 ? (scoreSum / total).toFixed(1) : "0.0";

  return {
    totalStores: total,
    passedStores: pass,
    warningStores: warn,
    failedStores: fail,
    avgScore: `${avg}%`,
    p0BlockersCount: fail,
    lastSyncTimestamp: new Date().toISOString(),
  };
}
