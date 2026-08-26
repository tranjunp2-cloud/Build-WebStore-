/**
 * Migration Reconciliation Engine & Full-Stack Dynamic Layout Analyzer (PW1 -> PW2)
 * Supports realistic merchant arbitrary multi-block page streams:
 *   - Arbitrary sequences: Hero -> Multiple Small Banners -> Multiple RichTexts -> Product Grids -> Blog -> Footer
 *   - Synchronized full-page scrolling inspection
 *   - Multi-page selector: Home, About Us, Products Catalog, Product Detail, Blog, Contact
 */

export interface StoreSummary {
  id: string;
  name: string;
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

export interface DefectItem {
  type: "p0" | "p1" | "p2";
  icon: string;
  title: string;
  desc: string;
  fix: string;
  affectedField?: string;
  entityType?: "products" | "variants" | "categories" | "posts" | "stores" | "blocks" | "richtext";
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
  blockType: "hero" | "banner" | "richtext" | "products" | "categories" | "blog" | "footer" | "contact" | "filter";
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
  };
  pw2Preview: {
    headline?: string;
    subheadline?: string;
    bodyText?: string;
    imageCount?: number;
    hasTable?: boolean;
    productCount?: number;
    badgeText?: string;
  };
  status: "pass" | "warn" | "fail";
  discrepancyNote?: string;
}

export interface StorePageStream {
  id: string;
  name: string;
  path: string;
  totalBlocks: number;
  blocks: PageBlockItem[];
  breakdown: BlockBreakdownItem[];
  defects: DefectItem[];
}

export interface StoreDeepDiff {
  id: string;
  name: string;
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
  pages: StorePageStream[];
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
    name: "Minimalist Market",
    sector: "Tối giản & Gia dụng",
    coverImg: "https://tm-prime-web.sgp1.digitaloceanspaces.com/tm-prime-web/images/templates/fn104/cover.png",
    liveDomainV1: "https://fn104.web.dev.ecommercehub.my/",
    fileV2: "fn104-standalone-full.html",
    larkUrl: "https://primecommerce.sg.larksuite.com/file/FXvqbmJvlowIa7xtg3Wly5OEgo5",
    liveDomainV2: "https://fn104.primeweb.io/",
  },
  {
    code: "FN103",
    name: "Viora Home",
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

/**
 * Generate 2,000 canonical store index for fast QA review
 */
export function generateReconciliationCatalog(totalCount = 2000): StoreSummary[] {
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

    if (i % 25 === 0) {
      // Critical P0 Blocker
      const val = (65 + (i % 15) * 1.1).toFixed(1);
      score = `${val}%`;
      status = "failed";
      failedBlocks = ["Mất Biến Thể Size 1L", "Thiếu Brand ID (Layer 2)", "RichText Rớt Bảng VietGAP"];
      textScore = "85.0%";
      mediaScore = "90.0%";
      commerceScore = "65.0%";
      blockScore = "70.0%";
    } else if (i % 7 === 0) {
      // P1 Warning
      const val = (88 + (i % 6) * 1.0).toFixed(1);
      score = `${val}%`;
      status = "warning";
      failedBlocks = ["1 Ảnh Gallery 404", "Footer lệch cột"];
      textScore = "100%";
      mediaScore = "88.0%";
      commerceScore = "95.0%";
      blockScore = "89.0%";
    } else {
      // Passed
      const val = (95 + (i % 5) * 0.9).toFixed(1);
      score = parseFloat(val) > 100 ? "99.4%" : `${val}%`;
      status = "passed";
      failedBlocks = [];
    }

    catalog.push({
      id: `SITE-${String(i).padStart(4, "0")}`,
      name: storeName,
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
      pageCount: 5,
      textScore,
      mediaScore,
      commerceScore,
      blockScore,
      lastCheckedAt: new Date().toISOString(),
    });
  }

  return catalog;
}

/**
 * Get deep store diff with true dynamic multi-block stream layout
 */
export function getStoreDeepDiff(siteId: string): StoreDeepDiff | null {
  const allStores = generateReconciliationCatalog(2000);
  const store = allStores.find((s) => s.id === siteId) || allStores[0];
  if (!store) return null;

  const isFailed = store.status === "failed";
  const isWarn = store.status === "warning";

  const defects: DefectItem[] = [];
  if (isFailed) {
    defects.push(
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
        title: "Khối #07 (RichText #2): Bảng Biểu Cam Kết <table> Bị Mất Cấu Trúc",
        desc: "Bảng 3 cột cam kết chất lượng VietGAP bị mất thẻ <tr> <td> khi chuyển từ TinyMCE sang Lexical AST.",
        fix: "Dev cập nhật Lexical HTML parser hỗ trợ TableBlock.",
        affectedField: "rich_text.content",
        entityType: "richtext",
      }
    );
  }

  return {
    ...store,
    pages: [
      {
        id: "page-home",
        name: "Trang Chủ (10 Khối Tuần Tự)",
        path: "/",
        totalBlocks: 10,
        defects,
        breakdown: [
          {
            pos: "#01",
            leg: "Hero Banner 1365",
            mig: "hero/split-left",
            layer: "Layer 1 (Mapped)",
            layerCls: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
            status: "KHỚP 100%",
            badge: "badge-pass",
            pw1Val: "Headline 'Tasty & Healthy Organic Food' + Button Explore",
            pw2Val: "Headline 'Tasty & Healthy Organic Food' + Button Explore",
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
            pw1Val: "3 Banners: Green lemon, Almonds, Honey",
            pw2Val: "3 Banners: Green lemon, Almonds, Honey",
            fix: "✓ Khớp chuẩn 100%",
          },
          {
            pos: "#03",
            leg: "Product Listing 1541",
            mig: "products-grid/grid-4",
            layer: isFailed ? "Layer 2 Gap" : "Layer 1 (Mapped)",
            layerCls: isFailed ? "bg-rose-950/40 text-rose-300 border-rose-500/30" : "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
            status: isFailed ? "MẤT BIẾN THỂ & BRAND" : "KHỚP 100%",
            badge: isFailed ? "badge-fail" : "badge-pass",
            pw1Val: "24 Sản phẩm | Đủ 2 biến thể 500ml & 1L | Brand: Nông Trại Ba Vì",
            pw2Val: isFailed ? "24 Sản phẩm | Mất biến thể 1L | brand_id: NULL" : "24 Sản phẩm | Đầy đủ 100%",
            fix: isFailed ? "Dev bổ sung collection brands & migrate đủ variant" : "✓ Khớp chuẩn 100%",
          },
          {
            pos: "#04",
            leg: "Small Promo Banner 1543",
            mig: "cta/banner",
            layer: "Layer 1 (Mapped)",
            layerCls: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
            status: "KHỚP 100%",
            badge: "badge-pass",
            pw1Val: "Original Stock Honey Combo Package",
            pw2Val: "Original Stock Honey Combo Package",
            fix: "✓ Khớp chuẩn 100%",
          },
          {
            pos: "#05",
            leg: "Article Listing 1544",
            mig: "blog-list/cards",
            layer: "Layer 1 (Mapped)",
            layerCls: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
            status: "KHỚP 100%",
            badge: "badge-pass",
            pw1Val: "3 Bài viết mới nhất",
            pw2Val: "3 Bài viết mới nhất",
            fix: "✓ Khớp chuẩn 100%",
          },
        ],
        blocks: [
          {
            id: "block-01",
            order: 1,
            blockType: "hero",
            title: "Khối #01: Hero Banner Đầu Trang",
            pw1Component: "banner (Hero Single 1365)",
            pw2Block: "hero/split-left",
            pw1Preview: {
              headline: "Tasty & Healthy Organic Food",
              subheadline: "Nông trại sạch tiêu chuẩn VietGAP thu hoạch hàng ngày.",
              badgeText: "100% Organic",
            },
            pw2Preview: {
              headline: "Tasty & Healthy Organic Food",
              subheadline: "Nông trại sạch tiêu chuẩn VietGAP thu hoạch hàng ngày.",
              badgeText: "100% Organic",
            },
            status: "pass",
          },
          {
            id: "block-02",
            order: 2,
            blockType: "banner",
            title: "Khối #02: Banner Khuyến Mãi Nhỏ #1",
            pw1Component: "banner (Promo Banner 1543)",
            pw2Block: "cta/banner-promo",
            pw1Preview: {
              headline: "VOUCHER 50K - MUA MẬT ONG RỪNG",
              subheadline: "Áp dụng cho đơn hàng đầu tiên từ 300.000đ",
              badgeText: "Giảm 50.000đ",
            },
            pw2Preview: {
              headline: "VOUCHER 50K - MUA MẬT ONG RỪNG",
              subheadline: "Áp dụng cho đơn hàng đầu tiên từ 300.000đ",
              badgeText: "Giảm 50.000đ",
            },
            status: "pass",
          },
          {
            id: "block-03",
            order: 3,
            blockType: "richtext",
            title: "Khối #03: RichText #1 (Câu Chuyện Thương Hiệu)",
            pw1Component: "rich_text (WYSIWYG Word Editor)",
            pw2Block: "about/split (Lexical RichText)",
            pw1Preview: {
              headline: "Hành Trình 10 Năm Gieo Mầm Xanh Ba Vì",
              bodyText: "Chúng tôi cam kết mang lại thực phẩm thuần khiết 100% tự nhiên không hóa chất...",
              imageCount: 2,
              hasTable: false,
            },
            pw2Preview: {
              headline: "Hành Trình 10 Năm Gieo Mầm Xanh Ba Vì",
              bodyText: "Chúng tôi cam kết mang lại thực phẩm thuần khiết 100% tự nhiên không hóa chất...",
              imageCount: 2,
              hasTable: false,
            },
            status: "pass",
          },
          {
            id: "block-04",
            order: 4,
            blockType: "products",
            title: "Khối #04: Danh Sách Sản Phẩm Nổi Bật",
            pw1Component: "product_listing (Lưới Sản Phẩm 1541)",
            pw2Block: "products-grid/grid-4",
            pw1Preview: {
              headline: "Sản Phẩm Tươi Ngon Bán Chạy",
              productCount: 8,
              badgeText: "Đủ 2 Biến Thể (500ml & 1L)",
            },
            pw2Preview: {
              headline: "Sản Phẩm Tươi Ngon Bán Chạy",
              productCount: 8,
              badgeText: isFailed ? "🚨 MẤT BIẾN THỂ 1L" : "Đủ 2 Biến Thể (500ml & 1L)",
            },
            status: isFailed ? "fail" : "pass",
            discrepancyNote: isFailed ? "Mất biến thể Can 1L (giá 320.000đ) của SKU ONG-RUNG" : undefined,
          },
          {
            id: "block-05",
            order: 5,
            blockType: "banner",
            title: "Khối #05: Banner Khuyến Mãi Nhỏ #2 (Combo)",
            pw1Component: "banner (Combo Promo Banner)",
            pw2Block: "cta/banner-split",
            pw1Preview: {
              headline: "COMBO SỨC KHỎE: MẬT ONG + CHANH VÀNG",
              subheadline: "Tiết kiệm 20% khi mua combo sáng nay",
              badgeText: "Tiết Kiệm 20%",
            },
            pw2Preview: {
              headline: "COMBO SỨC KHỎE: MẬT ONG + CHANH VÀNG",
              subheadline: "Tiết kiệm 20% khi mua combo sáng nay",
              badgeText: "Tiết Kiệm 20%",
            },
            status: "pass",
          },
          {
            id: "block-06",
            order: 6,
            blockType: "banner",
            title: "Khối #06: Banner Khuyến Mãi Nhỏ #3 (Freeship)",
            pw1Component: "banner (Freeship Banner)",
            pw2Block: "cta/banner-minimal",
            pw1Preview: {
              headline: "MIỄN PHÍ VẬN CHUYỂN TOÀN QUỐC",
              subheadline: "Đơn hàng từ 500k được giao hỏa tốc 2H",
              badgeText: "Freeship 0đ",
            },
            pw2Preview: {
              headline: "MIỄN PHÍ VẬN CHUYỂN TOÀN QUỐC",
              subheadline: "Đơn hàng từ 500k được giao hỏa tốc 2H",
              badgeText: "Freeship 0đ",
            },
            status: "pass",
          },
          {
            id: "block-07",
            order: 7,
            blockType: "richtext",
            title: "Khối #07: RichText #2 (Bảng Cam Kết Chất Lượng VietGAP)",
            pw1Component: "rich_text (Bảng 3 Cột <table>)",
            pw2Block: "lexical-table-node",
            pw1Preview: {
              headline: "Bảng So Sánh Tiêu Chuẩn Nông Sản",
              bodyText: "Tiêu Chí | Mật Ong Thường | Mật Ong Ba Vì (Đậm đặc >23%, Ngọt thanh)",
              hasTable: true,
              imageCount: 1,
            },
            pw2Preview: {
              headline: "Bảng So Sánh Tiêu Chuẩn Nông Sản",
              bodyText: isFailed ? "Tiêu Chí Mật Ong Thường Mật Ong Ba Vì (Dữ liệu bị dồn cục)" : "Tiêu Chí | Mật Ong Thường | Mật Ong Ba Vì",
              hasTable: !isFailed,
              imageCount: 1,
            },
            status: isFailed ? "fail" : "pass",
            discrepancyNote: isFailed ? "Mất thẻ <table> làm số liệu bị dồn thành 1 dòng text thô" : undefined,
          },
          {
            id: "block-08",
            order: 8,
            blockType: "banner",
            title: "Khối #08: Banner Khuyến Mãi Nhỏ #4 (Tải App)",
            pw1Component: "banner (App Download Banner)",
            pw2Block: "cta/download-app",
            pw1Preview: {
              headline: "TẢI APP ORGANICNEST NHẬN QUÀ 100K",
              subheadline: "Có mặt trên cả App Store và Google Play",
              badgeText: "Quà 100K",
            },
            pw2Preview: {
              headline: "TẢI APP ORGANICNEST NHẬN QUÀ 100K",
              subheadline: "Có mặt trên cả App Store và Google Play",
              badgeText: "Quà 100K",
            },
            status: "pass",
          },
          {
            id: "block-09",
            order: 9,
            blockType: "blog",
            title: "Khối #09: Danh Sách Tin Tức & Cẩm Nang",
            pw1Component: "article_listing (Blog Posts 1544)",
            pw2Block: "blog-list/cards-3",
            pw1Preview: {
              headline: "Cẩm Nang Sức Khỏe & Mẹo Nhà Nông",
              bodyText: "3 Bài viết mới nhất về phân biệt mật ong thật và cách pha trà",
            },
            pw2Preview: {
              headline: "Cẩm Nang Sức Khỏe & Mẹo Nhà Nông",
              bodyText: "3 Bài viết mới nhất về phân biệt mật ong thật và cách pha trà",
            },
            status: "pass",
          },
          {
            id: "block-10",
            order: 10,
            blockType: "footer",
            title: "Khối #10: Chân Trang Đa Cột (Footer)",
            pw1Component: "Footer Custom Multi-column (1553)",
            pw2Block: "footer/dark-gradient",
            pw1Preview: {
              headline: "Thông Tin Shop, Hotline 1900 8888, Bản Quyền & Map",
              bodyText: "4 Cột chính sách đổi trả, phương thức thanh toán",
            },
            pw2Preview: {
              headline: "Thông Tin Shop, Hotline 1900 8888, Bản Quyền & Map",
              bodyText: "4 Cột chính sách đổi trả, phương thức thanh toán",
            },
            status: "pass",
          },
        ],
      },
      {
        id: "page-about",
        name: "Trang Giới Thiệu (/about)",
        path: "/about",
        totalBlocks: 4,
        defects: [],
        breakdown: [],
        blocks: [
          {
            id: "about-01",
            order: 1,
            blockType: "hero",
            title: "Banner Trang Giới Thiệu",
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
            title: "RichText: Câu Chuyện Sáng Lập (1.500 chữ)",
            pw1Component: "rich_text",
            pw2Block: "about/content (Lexical)",
            pw1Preview: { headline: "Sứ Mệnh 10 Năm", imageCount: 3, hasTable: false },
            pw2Preview: { headline: "Sứ Mệnh 10 Năm", imageCount: 3, hasTable: false },
            status: "pass",
          },
          {
            id: "about-03",
            order: 3,
            blockType: "banner",
            title: "Banner Chứng Nhận VietGAP & ISO",
            pw1Component: "banner (Certification Banner)",
            pw2Block: "cta/certificates",
            pw1Preview: { headline: "Chứng Chỉ Quốc Tế" },
            pw2Preview: { headline: "Chứng Chỉ Quốc Tế" },
            status: "pass",
          },
          {
            id: "about-04",
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
    ],
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
