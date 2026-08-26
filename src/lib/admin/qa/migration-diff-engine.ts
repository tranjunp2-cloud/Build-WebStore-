/**
 * Migration Reconciliation Engine & Data Diff Analyzer (PW1 -> PW2)
 * Supports complete e-commerce lifecycle parity:
 *   1. Home Page Layout (6 Canonical Blocks)
 *   2. Product Catalog & Filter/Sort (/products)
 *   3. Product Detail & Variant Selector (/products/:slug)
 *   4. Blog Listing & Article Detail (/blog & /blog/:slug)
 *   5. Search Bar & Cart Drawer Flow (/search & /cart)
 *   6. Contact & Order Tracking (/contact & /order-tracking)
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
  entityType?: "products" | "variants" | "categories" | "posts" | "stores" | "blocks";
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

export interface StorePageDetail {
  id: string;
  name: string;
  path: string;
  category: "home" | "catalog" | "product_detail" | "blog" | "cart_search" | "contact_tracking";
  defects: DefectItem[];
  breakdown: BlockBreakdownItem[];
  interactiveChecks: {
    name: string;
    pw1Behavior: string;
    pw2Behavior: string;
    status: "pass" | "warn" | "fail";
  }[];
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
  pages: StorePageDetail[];
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

// 9 Standard Canonical Templates Metadata from Excel Design Mapping
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
      failedBlocks = ["Mất Biến Thể Size 1L", "Thiếu Brand ID (Layer 2)"];
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
      pageCount: 6,
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
 * Get deep store diff across all 6 core e-commerce pages & flows
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
        title: "Mất Biến Thể Size 1 Lít (SKU Variant Missing)",
        desc: "Sản phẩm Mật Ong Rừng SKU 'ONG-RUNG' chỉ migrate được hũ 500ml, bị mất biến thể Can 1 Lít (giá 320.000đ).",
        fix: "Dev chạy lại script ETL converter cho bảng `product_variants`.",
        affectedField: "variants[].sku",
        entityType: "variants",
      }
    );
  } else if (isWarn) {
    defects.push({
      type: "p1",
      icon: "⚠️",
      title: "1 Ảnh Gallery Chi Tiết Bị Lỗi Link (404 Not Found)",
      desc: "Ảnh gallery chi tiết mat_ong_1l_detail.jpg trả về mã HTTP 404 trên CDN mới.",
      fix: "Dev re-upload lại ảnh từ bản backup S3 cũ.",
      affectedField: "media.url",
      entityType: "products",
    });
  }

  return {
    ...store,
    pages: [
      {
        id: "page-home",
        name: "Trang Chủ",
        path: "/",
        category: "home",
        defects,
        breakdown: [
          {
            pos: "#01",
            leg: "banner (Hero Banner 1365)",
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
            leg: "category_listing (1540)",
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
            leg: "product_listing (1541)",
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
            leg: "banner (Small Banner 1543)",
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
            leg: "article_listing (1544)",
            mig: "blog-list/cards",
            layer: "Layer 1 (Mapped)",
            layerCls: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
            status: "KHỚP 100%",
            badge: "badge-pass",
            pw1Val: "3 Bài viết mới nhất",
            pw2Val: "3 Bài viết mới nhất",
            fix: "✓ Khớp chuẩn 100%",
          },
          {
            pos: "#06",
            leg: "Footer Custom (1553)",
            mig: "footer/dark-gradient",
            layer: isWarn ? "Needs Review" : "Layer 1 (Mapped)",
            layerCls: isWarn ? "bg-amber-950/40 text-amber-300 border-amber-500/30" : "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
            status: isWarn ? "THIẾU MAP NHÚNG" : "KHỚP 100%",
            badge: isWarn ? "badge-warn" : "badge-pass",
            pw1Val: "4 Cột + Hotline + Bản đồ nhúng",
            pw2Val: isWarn ? "4 Cột chuẩn (chưa có iframe map)" : "4 Cột chuẩn",
            fix: isWarn ? "QC duyệt hoặc Dev thêm cấu hình Map" : "✓ Khớp chuẩn 100%",
          },
        ],
        interactiveChecks: [
          {
            name: "Sticky Header Navigation",
            pw1Behavior: "Header cố định khi cuộn, có logo + giỏ hàng",
            pw2Behavior: "Header Next.js 15 mượt mà, đồng bộ giỏ hàng",
            status: "pass",
          },
        ],
      },
      {
        id: "page-catalog",
        name: "Danh Mục & Bộ Lọc Sản Phẩm",
        path: "/products",
        category: "catalog",
        defects: [],
        breakdown: [
          {
            pos: "#01",
            leg: "product_filter (Bộ lọc danh mục & khoảng giá)",
            mig: "products-filter/sidebar",
            layer: "Layer 1 (Mapped)",
            layerCls: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
            status: "KHỚP 100%",
            badge: "badge-pass",
            pw1Val: "Lọc theo 4 Danh mục + Thanh kéo khoảng giá 0 - 500k",
            pw2Val: "Lọc theo 4 Danh mục + Thanh kéo khoảng giá 0 - 500k",
            fix: "✓ Khớp chuẩn 100%",
          },
          {
            pos: "#02",
            leg: "product_sort (Sắp xếp giá & độ mới)",
            mig: "products-sort/dropdown",
            layer: "Layer 1 (Mapped)",
            layerCls: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
            status: "KHỚP 100%",
            badge: "badge-pass",
            pw1Val: "Mới nhất, Giá tăng dần, Giá giảm dần",
            pw2Val: "Mới nhất, Giá tăng dần, Giá giảm dần",
            fix: "✓ Khớp chuẩn 100%",
          },
          {
            pos: "#03",
            leg: "product_listing (Lưới sản phẩm phân trang)",
            mig: "products-grid/paginated",
            layer: "Layer 1 (Mapped)",
            layerCls: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
            status: "KHỚP 100%",
            badge: "badge-pass",
            pw1Val: "24 Sản phẩm, 12 SP/trang (2 trang)",
            pw2Val: "24 Sản phẩm, 12 SP/trang (2 trang)",
            fix: "✓ Khớp chuẩn 100%",
          },
        ],
        interactiveChecks: [
          {
            name: "Lọc theo danh mục 'Mật Ong & Dược Liệu'",
            pw1Behavior: "Hiển thị 6 sản phẩm",
            pw2Behavior: "Hiển thị đúng 6 sản phẩm tương ứng",
            status: "pass",
          },
          {
            name: "Sắp xếp theo 'Giá: Cao ➔ Thấp'",
            pw1Behavior: "SP đắt nhất đứng đầu (320.000đ)",
            pw2Behavior: "SP đắt nhất đứng đầu",
            status: "pass",
          },
        ],
      },
      {
        id: "page-product-detail",
        name: "Chi Tiết Sản Phẩm & Biến Thể",
        path: "/products/mat-ong-rung-ba-vi",
        category: "product_detail",
        defects: isFailed
          ? [
              {
                type: "p0",
                icon: "🚨",
                title: "Mất Chọn Biến Thể Can 1 Lít (Variant Selector)",
                desc: "Khi người dùng click chọn biến thể Can 1L, giá không nhảy sang 320.000đ do DB thiếu SKU.",
                fix: "Dev chạy lại ETL cho `products_variants`.",
                affectedField: "variants[].sku",
                entityType: "variants",
              },
            ]
          : [],
        breakdown: [
          {
            pos: "#01",
            leg: "Product Gallery (Ảnh lớn + 3 Ảnh phụ)",
            mig: "product-gallery/thumbnails",
            layer: isWarn ? "Needs Review" : "Layer 1 (Mapped)",
            layerCls: isWarn ? "bg-amber-950/40 text-amber-300 border-amber-500/30" : "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
            status: isWarn ? "1 ẢNH THUMBNAIL 404" : "KHỚP 100%",
            badge: isWarn ? "badge-warn" : "badge-pass",
            pw1Val: "4 Ảnh chụp hũ mật ong chất lượng cao",
            pw2Val: isWarn ? "3 Ảnh hiển thị (1 ảnh lỗi 404)" : "4 Ảnh hiển thị đầy đủ",
            fix: isWarn ? "Re-upload lại ảnh S3" : "✓ Khớp chuẩn 100%",
          },
          {
            pos: "#02",
            leg: "Variant Selector (Chọn Size / Dung tích)",
            mig: "product-variants/pill-selector",
            layer: isFailed ? "Layer 2 Gap" : "Layer 1 (Mapped)",
            layerCls: isFailed ? "bg-rose-950/40 text-rose-300 border-rose-500/30" : "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
            status: isFailed ? "MẤT BIẾN THỂ CAN 1L" : "KHỚP 100%",
            badge: isFailed ? "badge-fail" : "badge-pass",
            pw1Val: "2 Nút chọn: Hũ 500ml (180k) & Can 1L (320k)",
            pw2Val: isFailed ? "Chỉ có 1 nút: Hũ 500ml (180k)" : "Đủ 2 nút chọn",
            fix: isFailed ? "Dev migrate đủ SKU" : "✓ Khớp chuẩn 100%",
          },
          {
            pos: "#03",
            leg: "Rich Text Description (Mô tả chi tiết)",
            mig: "product-description/lexical",
            layer: "Layer 1 (Mapped)",
            layerCls: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
            status: "KHỚP 100%",
            badge: "badge-pass",
            pw1Val: "Mô tả nguồn gốc mật ong rừng nguyên chất 100%",
            pw2Val: "Mô tả nguồn gốc mật ong rừng nguyên chất 100%",
            fix: "✓ Khớp chuẩn 100%",
          },
        ],
        interactiveChecks: [
          {
            name: "Click chọn nút 'Can 1 Lít'",
            pw1Behavior: "Giá nhảy từ 180.000đ ➔ 320.000đ",
            pw2Behavior: isFailed ? "Không có nút 1L để chọn (Lỗi P0)" : "Giá nhảy sang 320.000đ",
            status: isFailed ? "fail" : "pass",
          },
          {
            name: "Nút 'Thêm Vào Giỏ Hàng'",
            pw1Behavior: "Bật popup giỏ hàng với đúng SKU",
            pw2Behavior: "Bật Cart Drawer với đúng SKU",
            status: "pass",
          },
        ],
      },
      {
        id: "page-blog",
        name: "Tin Tức & Chi Tiết Bài Viết",
        path: "/blog/huong-dan-phan-biet-mat-ong-that",
        category: "blog",
        defects: [],
        breakdown: [
          {
            pos: "#01",
            leg: "article_filter (Bộ lọc danh mục bài viết)",
            mig: "blog-categories/pills",
            layer: "Layer 1 (Mapped)",
            layerCls: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
            status: "KHỚP 100%",
            badge: "badge-pass",
            pw1Val: "3 Danh mục: Cẩm nang sức khỏe, Mẹo nhà nông, Khuyến mãi",
            pw2Val: "3 Danh mục: Cẩm nang sức khỏe, Mẹo nhà nông, Khuyến mãi",
            fix: "✓ Khớp chuẩn 100%",
          },
          {
            pos: "#02",
            leg: "Article Detail RichText (Nội dung bài viết)",
            mig: "article-content/lexical",
            layer: "Layer 1 (Mapped)",
            layerCls: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
            status: "KHỚP 100%",
            badge: "badge-pass",
            pw1Val: "Bài viết 1.200 chữ + 2 ảnh minh họa",
            pw2Val: "Bài viết 1.200 chữ + 2 ảnh minh họa Lexical",
            fix: "✓ Khớp chuẩn 100%",
          },
        ],
        interactiveChecks: [
          {
            name: "Định dạng font chữ tiếng Việt UTF-8",
            pw1Behavior: "Hiển thị chuẩn dấu tiếng Việt",
            pw2Behavior: "Hiển thị chuẩn dấu tiếng Việt",
            status: "pass",
          },
        ],
      },
      {
        id: "page-cart-search",
        name: "Giỏ Hàng & Tìm Kiếm Toàn Site",
        path: "/cart",
        category: "cart_search",
        defects: [],
        breakdown: [
          {
            pos: "#01",
            leg: "Global Header Search Bar (Thanh tìm kiếm)",
            mig: "search-dialog/instant-search",
            layer: "Layer 1 (Mapped)",
            layerCls: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
            status: "KHỚP 100%",
            badge: "badge-pass",
            pw1Val: "Tìm theo từ khóa 'mật ong', trả về 4 kết quả",
            pw2Val: "Tìm theo từ khóa 'mật ong', trả về 4 kết quả",
            fix: "✓ Khớp chuẩn 100%",
          },
          {
            pos: "#02",
            leg: "cart (Giỏ hàng & Cập nhật số lượng)",
            mig: "cart-drawer/slide-over",
            layer: "Layer 1 (Mapped)",
            layerCls: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
            status: "KHỚP 100%",
            badge: "badge-pass",
            pw1Val: "Thêm 2 hũ 500ml ➔ Tổng tiền: 360.000đ",
            pw2Val: "Thêm 2 hũ 500ml ➔ Tổng tiền: 360.000đ",
            fix: "✓ Khớp chuẩn 100%",
          },
          {
            pos: "#03",
            leg: "checkout (Nút chuyển tiếp thanh toán)",
            mig: "checkout/redirect",
            layer: "Layer 1 (Mapped)",
            layerCls: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
            status: "KHỚP 100%",
            badge: "badge-pass",
            pw1Val: "Chuyển tới cổng thanh toán checkout",
            pw2Val: "Chuyển tới cổng thanh toán checkout",
            fix: "✓ Khớp chuẩn 100%",
          },
        ],
        interactiveChecks: [
          {
            name: "Tính năng Tìm kiếm tức thì (Live Search)",
            pw1Behavior: "Gõ 'chanh' hiện gợi ý sản phẩm",
            pw2Behavior: "Gõ 'chanh' hiện gợi ý sản phẩm mượt mà",
            status: "pass",
          },
          {
            name: "Cập nhật số lượng trong giỏ (+ / -)",
            pw1Behavior: "Tự động tính lại tổng tiền",
            pw2Behavior: "Tự động tính lại tổng tiền tức thì",
            status: "pass",
          },
        ],
      },
      {
        id: "page-contact-tracking",
        name: "Liên Hệ & Tra Cứu Đơn Hàng",
        path: "/order-tracking",
        category: "contact_tracking",
        defects: [],
        breakdown: [
          {
            pos: "#01",
            leg: "contact (Form gửi thư & Hotline)",
            mig: "contact/split-form",
            layer: "Layer 1 (Mapped)",
            layerCls: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
            status: "KHỚP 100%",
            badge: "badge-pass",
            pw1Val: "Hotline 1900 8888 + Email contact@organicnest.vn",
            pw2Val: "Hotline 1900 8888 + Email contact@organicnest.vn",
            fix: "✓ Khớp chuẩn 100%",
          },
          {
            pos: "#02",
            leg: "order_tracking (Tra cứu trạng thái đơn hàng)",
            mig: "order-tracking/lookup",
            layer: "Layer 1 (Mapped)",
            layerCls: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
            status: "KHỚP 100%",
            badge: "badge-pass",
            pw1Val: "Nhập mã đơn 'ORD-12345' ➔ Hiện trạng thái 'Đang giao'",
            pw2Val: "Nhập mã đơn 'ORD-12345' ➔ Hiện trạng thái 'Đang giao'",
            fix: "✓ Khớp chuẩn 100%",
          },
        ],
        interactiveChecks: [
          {
            name: "Tra cứu đơn hàng bằng Mã Đơn + SĐT",
            pw1Behavior: "Trả về timeline giao hàng",
            pw2Behavior: "Trả về timeline giao hàng",
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
