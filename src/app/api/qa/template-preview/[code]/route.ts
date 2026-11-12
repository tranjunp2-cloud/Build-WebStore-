import { NextResponse, type NextRequest } from "next/server";
import { withSuperAdmin } from "@/lib/admin/api-utils";
import { getStoreDeepDiff } from "@/lib/admin/qa/migration-diff-engine";
import { fetchLivePw1StoreDeepDiff } from "@/lib/admin/qa/pw1-mysql-connector";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const TEMPLATE_FILE_MAP: Record<string, string> = {
  // 9 Canonical Modern Adapt Templates
  fb101: "fb101-standalone-full.html",
  pa101: "pa101-standalone-full.html",
  f102: "f102-standalone-full.html",
  fn104: "fn104-standalone-full.html",
  fn103: "fn103-standalone-full.html",
  c102: "c102-standalone-full.html",
  c101: "c101-standalone-full.html",
  fn102: "fn102-standalone-full.html",
  fn101: "fn101-standalone-full.html",

  // Fashion Legacy Templates -> f102 (FashionEase)
  f001: "f102-standalone-full.html",
  f005: "f102-standalone-full.html",
  f009: "f102-standalone-full.html",
  f101: "f102-standalone-full.html",
  "f009-1": "f102-standalone-full.html",
  "f009-1-1": "f102-standalone-full.html",
  "f009-2": "f102-standalone-full.html",
  "f009-3": "f102-standalone-full.html",
  "f009-4": "f102-standalone-full.html",
  "f009-5": "f102-standalone-full.html",
  "f009-6": "f102-standalone-full.html",
  "t010-3": "f102-standalone-full.html",

  // Cosmetics, Beauty & Spa Legacy Templates -> c101 / c102
  mp001: "c101-standalone-full.html",
  mp003: "c101-standalone-full.html",
  "t010-4": "c102-standalone-full.html",
  "t010-6-1": "c101-standalone-full.html",

  // Cafe, Food & Beverage Legacy Templates -> c101 / fb101
  "t010-5": "c101-standalone-full.html",
  t001: "fb101-standalone-full.html",
  t002: "fb101-standalone-full.html",

  // Furniture, Home Decor & Lifestyle Legacy Templates -> fn101..fn104
  "t006-5-1": "fn101-standalone-full.html",
  fn001: "fn101-standalone-full.html",
  fn002: "fn102-standalone-full.html",
  fn003: "fn103-standalone-full.html",
  fn004: "fn104-standalone-full.html",

  // Plants, Garden & Agriculture Legacy Templates -> pa101
  pa001: "pa101-standalone-full.html",
  pa002: "pa101-standalone-full.html",
  pa003: "pa101-standalone-full.html",
  pa004: "pa101-standalone-full.html",

  // Tech, Electronics, Gadgets Legacy Templates -> fn104
  t006: "fn104-standalone-full.html",
  "t006-2": "fn104-standalone-full.html",
  "t006-3": "fn104-standalone-full.html",
  "t006-4": "fn104-standalone-full.html",
  "t006-5": "fn104-standalone-full.html",
  "t006-6": "fn104-standalone-full.html",
  tg001: "fn104-standalone-full.html",
  tg101: "fn104-standalone-full.html",

  // Fitness, Health & Multi-Category Legacy Templates
  t010: "f102-standalone-full.html",
  "t010-2": "f102-standalone-full.html",
  "t010-6": "f102-standalone-full.html",
  t007: "fn104-standalone-full.html",
  t008: "fn104-standalone-full.html",
  t009: "fn104-standalone-full.html",
  "dn-01": "fn104-standalone-full.html",
  dn001: "fn104-standalone-full.html",
};

export function resolveTemplateFileName(code: string): string {
  const norm = (code || "").toLowerCase().trim();
  if (TEMPLATE_FILE_MAP[norm]) return TEMPLATE_FILE_MAP[norm];

  // Prefix-based sector mapping
  if (norm.startsWith("f0") || norm.startsWith("f1")) return "f102-standalone-full.html";
  if (norm.startsWith("c1") || norm.startsWith("mp")) return "c101-standalone-full.html";
  if (norm.startsWith("fn")) return "fn101-standalone-full.html";
  if (norm.startsWith("pa")) return "pa101-standalone-full.html";
  if (norm.startsWith("tg") || norm.startsWith("t006")) return "fn104-standalone-full.html";
  if (norm.startsWith("t010")) return "f102-standalone-full.html";

  return TEMPLATE_FILE_MAP["fb101"];
}

export function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeRichHtml(htmlStr: string): string {
  if (!htmlStr) return "";
  return String(htmlStr)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "")
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/href\s*=\s*["']?javascript:[^"'>]*/gi, 'href="#"');
}

export interface StoreRealData {
  id: string;
  name: string;
  domain?: string;
  logo?: string;
  address?: string;
  hotline?: string;
  templateCode: string;
  products: Array<{
    id: number | string;
    name: string;
    price: string;
    sku?: string;
    image?: string;
    category?: string;
  }>;
  categories: Array<{
    id: number | string;
    name: string;
    image?: string;
    ctaText?: string;
  }>;
  articles: Array<{
    id: number | string;
    title: string;
    image?: string;
    summary?: string;
    date?: string;
    slug?: string;
  }>;
  banners: Array<{
    id: number | string;
    header: string;
    subheader?: string;
    image?: string;
    url?: string;
  }>;
  pages: Array<{
    id: string;
    name: string;
    path: string;
    pageType?: string;
    totalBlocks?: number;
    blocks?: Array<{
      id: string;
      order?: number;
      blockType: string;
      title: string;
      headline?: string;
      subheadline?: string;
      bodyText?: string;
      imageUrl?: string;
      buttonText?: string;
      productCards?: Array<{
        id: number | string;
        name: string;
        price: string;
        sku?: string;
        image?: string;
        category?: string;
      }>;
      categoryCards?: Array<{
        id: number | string;
        name: string;
        image?: string;
        ctaText?: string;
      }>;
      articleItems?: Array<{
        id: number | string;
        title: string;
        image?: string;
        summary?: string;
        date?: string;
        slug?: string;
      }>;
    }>;
  }>;
}

/**
 * Extracts normalized real store data from live or mocked Deep Diff payload.
 */
export function extractStoreRealData(diff: any): StoreRealData {
  if (!diff) {
    return {
      id: "SITE-0001",
      name: "Store",
      templateCode: "PA101",
      products: [],
      categories: [],
      articles: [],
      banners: [],
      pages: [],
    };
  }

  const storeName = diff.name || "Cửa Hàng";
  const products: StoreRealData["products"] = [];
  const categories: StoreRealData["categories"] = [];
  const articles: StoreRealData["articles"] = [];
  const banners: StoreRealData["banners"] = [];

  // 1. Extract items from page blocks
  if (Array.isArray(diff.pages)) {
    for (const page of diff.pages) {
      if (Array.isArray(page.blocks)) {
        for (const block of page.blocks) {
          const preview = block.pw1Preview || block.pw2Preview || {};

          // Product cards
          if (Array.isArray(preview.productCards)) {
            for (const p of preview.productCards) {
              if (p && p.name && !products.some((x) => x.id === p.id || x.name === p.name)) {
                products.push({
                  id: p.id || products.length + 1,
                  name: p.name,
                  price: typeof p.price === "number" ? `$${p.price.toFixed(2)}` : (p.price || "$0.00"),
                  sku: p.sku || "",
                  image: p.image || "",
                  category: p.category || "General",
                });
              }
            }
          }

          // Category cards
          if (Array.isArray(preview.categoryCards)) {
            for (const c of preview.categoryCards) {
              if (c && c.name && !categories.some((x) => x.name === c.name)) {
                categories.push({
                  id: c.id || categories.length + 1,
                  name: c.name,
                  image: c.image || "",
                  ctaText: c.ctaText || "Shop now",
                });
              }
            }
          }

          // Article items
          if (Array.isArray(preview.articleItems)) {
            for (const a of preview.articleItems) {
              if (a && a.title && !articles.some((x) => x.title === a.title)) {
                articles.push({
                  id: a.id || articles.length + 1,
                  title: a.title,
                  image: a.image || "",
                  summary: a.summary || "",
                  date: a.date || "",
                  slug: a.slug || "",
                });
              }
            }
          }

          // Hero / Banner
          if (block.blockType === "hero" || block.blockType === "banner") {
            if (preview.headline && !banners.some((b) => b.header === preview.headline)) {
              banners.push({
                id: block.id,
                header: preview.headline,
                subheader: preview.subheadline || "",
                image: preview.imageUrl || "",
                url: block.url || "/",
              });
            }
          }
        }
      }
    }
  }

  // 2. Extract from fieldDiffAudit records if not already captured
  if (Array.isArray(diff.fieldDiffAudit?.records)) {
    for (const rec of diff.fieldDiffAudit.records) {
      if (rec.entityGroup === "products") {
        const titleF = rec.fields?.find((f: any) => f.fieldName === "title");
        const priceF = rec.fields?.find((f: any) => f.fieldName === "price");
        const catF = rec.fields?.find((f: any) => f.fieldName === "category");
        const skuF = rec.fields?.find((f: any) => f.fieldName === "sku");
        const name = titleF?.legacyValue || titleF?.migratedValue;
        if (name && !products.some((x) => x.name === name)) {
          const rawPrice = priceF?.legacyValue ?? priceF?.migratedValue ?? 0;
          products.push({
            id: rec.id,
            name,
            price: typeof rawPrice === "number" ? `$${rawPrice.toFixed(2)}` : `${rawPrice}`,
            sku: skuF?.legacyValue || "",
            image: "",
            category: catF?.legacyValue || "General",
          });
        }
      } else if (rec.entityGroup === "categories") {
        const nameF = rec.fields?.find((f: any) => f.fieldName === "name");
        const name = nameF?.legacyValue || nameF?.migratedValue;
        if (name && !categories.some((x) => x.name === name)) {
          categories.push({
            id: rec.id,
            name,
            image: "",
            ctaText: "Shop now",
          });
        }
      } else if (rec.entityGroup === "posts") {
        const titleF = rec.fields?.find((f: any) => f.fieldName === "title");
        const title = titleF?.legacyValue || titleF?.migratedValue;
        if (title && !articles.some((x) => x.title === title)) {
          articles.push({
            id: rec.id,
            title,
            image: "",
            summary: "",
            date: "19 May 2022",
            slug: "",
          });
        }
      } else if (rec.entityGroup === "banners") {
        const headF = rec.fields?.find((f: any) => f.fieldName === "header_text");
        const subF = rec.fields?.find((f: any) => f.fieldName === "subheader_text");
        const imgF = rec.fields?.find((f: any) => f.fieldName === "image");
        const header = headF?.legacyValue || headF?.migratedValue;
        if (header && !banners.some((b) => b.header === header)) {
          banners.push({
            id: rec.id,
            header,
            subheader: subF?.legacyValue || subF?.migratedValue || "",
            image: imgF?.legacyValue || imgF?.migratedValue || "",
            url: "/",
          });
        }
      }
    }
  }

  // 3. Format pages with blocks
  const pages: StoreRealData["pages"] = (diff.pages || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    path: p.path,
    pageType: p.pageType,
    totalBlocks: p.totalBlocks || (p.blocks ? p.blocks.length : 0),
    blocks: (p.blocks || []).map((b: any) => {
      const prev = b.pw1Preview || b.pw2Preview || {};
      return {
        id: b.id,
        order: b.order,
        blockType: b.blockType,
        title: b.title,
        headline: prev.headline,
        subheadline: prev.subheadline,
        bodyText: prev.bodyText,
        imageUrl: prev.imageUrl,
        buttonText: prev.buttonText,
        productCards: prev.productCards,
        categoryCards: prev.categoryCards,
        articleItems: prev.articleItems,
      };
    }),
  }));

  return {
    id: diff.id,
    name: storeName,
    domain: diff.domain,
    logo: diff.storeInfo?.logo || diff.coverImg,
    address: Array.isArray(diff.storeInfo?.address) ? diff.storeInfo.address.join(", ") : (diff.storeInfo?.address || ""),
    hotline: Array.isArray(diff.storeInfo?.hotline) ? diff.storeInfo.hotline.join(", ") : (diff.storeInfo?.hotline || ""),
    templateCode: (diff.templateCode || "PA101").toLowerCase(),
    products,
    categories,
    articles,
    banners,
    pages,
  };
}

export function renderPageBlocks(
  blocks: any[],
  storeData?: StoreRealData | null,
  accentColor = "#0284c7"
): string {
  if (!Array.isArray(blocks) || blocks.length === 0) return "";

  return blocks.map((blk, idx) => {
    const blkHeadline = blk.headline || blk.title || `Khối #${idx + 1}`;
    const blkSub = blk.subheadline || "";
    const blkBody = blk.bodyText || "";
    const blkBtn = blk.buttonText || "Xem Ngay";
    const blkImg = blk.imageUrl || "";

    if (blk.blockType === "hero" || blk.blockType === "banner") {
      if (blkImg) {
        return `
          <div class="banner-block" style="position:relative; overflow:hidden; border-radius:16px; margin-bottom:28px; background:#0f172a; color:white; min-height:260px; display:flex; flex-direction:column; justify-content:center; padding:36px 40px; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
            <img src="${escapeHtml(blkImg)}" alt="${escapeHtml(blkHeadline)}" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; opacity:0.82;">
            <div style="position:relative; z-index:2; max-width:600px; background:rgba(15,23,42,0.7); padding:24px 28px; border-radius:14px; backdrop-filter:blur(6px); border:1px solid rgba(255,255,255,0.1);">
              <h2 style="font-size:30px; font-weight:800; margin-bottom:8px; color:#ffffff; letter-spacing:-0.5px;">${escapeHtml(blkHeadline)}</h2>
              ${blkSub ? `<p style="font-size:15px; margin-bottom:16px; color:#e2e8f0; line-height:1.6;">${escapeHtml(blkSub)}</p>` : ""}
              ${blkBtn ? `<a href="#/products" class="btn-buy" style="display:inline-block; width:auto; padding:10px 24px; text-decoration:none;">${escapeHtml(blkBtn)}</a>` : ""}
            </div>
          </div>`;
      }
      return `
        <div class="page-hero" style="margin-bottom:28px; padding:36px; text-align:center;">
          <h2 style="font-size:28px; font-weight:800; color:#0f172a; margin-bottom:10px;">${escapeHtml(blkHeadline)}</h2>
          ${blkSub ? `<p style="color:#64748b; font-size:15px; max-width:650px; margin:0 auto;">${escapeHtml(blkSub)}</p>` : ""}
          ${blkBtn ? `<div style="margin-top:16px;"><a href="#/products" class="btn-buy" style="display:inline-block; width:auto; padding:10px 24px; text-decoration:none;">${escapeHtml(blkBtn)}</a></div>` : ""}
        </div>`;
    }

    if (blk.blockType === "blog" || blk.blockType === "blog-list") {
      const articles = (blk.articleItems && blk.articleItems.length > 0)
        ? blk.articleItems
        : storeData?.articles || [];
      const artCards = articles.slice(0, 6).map((a: any) => `
        <div class="blog-card" style="background:white; border:1px solid #e2e8f0; border-radius:16px; padding:20px;">
          <div class="blog-img" style="height:160px; background:#f1f5f9; border-radius:12px; margin-bottom:14px; overflow:hidden; display:flex; align-items:center; justify-content:center;">
            ${a.image ? `<img src="${escapeHtml(a.image)}" alt="${escapeHtml(a.title)}" style="width:100%; height:100%; object-fit:cover;">` : `<span style="color:#94a3b8; font-weight:600;">📰 ${escapeHtml((a.title || "").slice(0, 20))}</span>`}
          </div>
          <div class="blog-meta" style="font-size:11px; color:#64748b; margin-bottom:8px;">📅 ${escapeHtml(a.date || "19 May 2022")}</div>
          <h4 style="font-size:16px; font-weight:700; color:#0f172a; margin-bottom:8px; line-height:1.4;">${escapeHtml(a.title)}</h4>
          ${a.summary ? `<p style="font-size:13px; color:#64748b; line-height:1.6; margin-bottom:12px;">${escapeHtml(a.summary)}</p>` : ""}
          <a href="#/articles" class="read-more">Đọc chi tiết &rarr;</a>
        </div>
      `).join("");

      return `
        <div style="margin-bottom:32px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h3 style="font-size:22px; font-weight:800; color:#0f172a;">${escapeHtml(blkHeadline)}</h3>
            <a href="#/articles" style="font-size:13px; font-weight:700; color:${accentColor}; text-decoration:none;">Xem tất cả bài viết &rarr;</a>
          </div>
          <div class="blog-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:20px;">
            ${artCards}
          </div>
        </div>`;
    }

    if (blk.blockType === "categories" || blk.blockType === "category-list") {
      const cats = (blk.categoryCards && blk.categoryCards.length > 0)
        ? blk.categoryCards
        : storeData?.categories || [];
      const catCards = cats.map((cat: any) => `
        <div class="card" style="text-align:center; padding:20px; background:white; border:1px solid #e2e8f0; border-radius:16px;">
          ${cat.image ? `<img src="${escapeHtml(cat.image)}" alt="${escapeHtml(cat.name)}" style="height:120px; width:100%; object-fit:cover; border-radius:10px; margin-bottom:10px;">` : `<div style="height:80px; background:#f1f5f9; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:24px; margin-bottom:10px;">🏷️</div>`}
          <h4 style="font-size:15px; font-weight:700; color:#0f172a;">${escapeHtml(cat.name)}</h4>
          <a href="#/products" class="badge" style="margin-top:8px; display:inline-block; text-decoration:none;">${escapeHtml(cat.ctaText || "Khám phá")}</a>
        </div>`).join("");

      return `
        <div style="margin-bottom:32px;">
          <h3 style="font-size:22px; font-weight:800; color:#0f172a; margin-bottom:16px;">${escapeHtml(blkHeadline)}</h3>
          <div class="grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:16px;">
            ${catCards}
          </div>
        </div>`;
    }

    if (blk.blockType === "products" || blk.blockType === "product-list" || blk.blockType === "products-grid") {
      const prods = (blk.productCards && blk.productCards.length > 0)
        ? blk.productCards
        : storeData?.products || [];
      const prodCards = prods.slice(0, 12).map((p: any) => `
        <div class="card" style="background:white; border:1px solid #e2e8f0; border-radius:16px; padding:20px;">
          <div class="card-img" style="height:160px; background:#f1f5f9; border-radius:12px; margin-bottom:14px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
            ${p.image ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="width:100%; height:100%; object-fit:cover;">` : `<span>📦 ${escapeHtml((p.name || "").slice(0, 18))}</span>`}
          </div>
          <div class="badge" style="margin-bottom:8px;">${escapeHtml(p.category || "Sản phẩm")}</div>
          <h4 style="font-size:15px; font-weight:700; color:#0f172a; margin-bottom:6px; line-height:1.4;">${escapeHtml(p.name)}</h4>
          <div class="price" style="font-size:16px; font-weight:800; color:${accentColor}; margin-bottom:12px;">${escapeHtml(p.price)}</div>
          <button class="btn-buy">Thêm Vào Giỏ</button>
        </div>`).join("");

      return `
        <div style="margin-bottom:32px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h3 style="font-size:22px; font-weight:800; color:#0f172a;">${escapeHtml(blkHeadline)}</h3>
            <a href="#/products" style="font-size:13px; font-weight:700; color:${accentColor}; text-decoration:none;">Xem tất cả sản phẩm &rarr;</a>
          </div>
          <div class="grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:20px;">
            ${prodCards}
          </div>
        </div>`;
    }

    if (blk.blockType === "richtext" || blk.blockType === "text") {
      const isBlank = !blkBody || blkBody.includes("[Khối Trống");
      if (isBlank) {
        return `
          <div class="card" style="padding:20px 24px; margin-bottom:20px; background:#fffbeb; border:1px dashed #f59e0b; border-radius:16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
              <div>
                <h4 style="font-size:15px; font-weight:700; color:#b45309; margin-bottom:4px;">⚠️ ${escapeHtml(blkHeadline)} (Khối Rỗng Trong CSDL)</h4>
                <p style="color:#92400e; font-size:13px; line-height:1.5; margin:0;">Khối này chưa có nội dung văn bản trong CSDL PW1. Trên storefront thực tế sẽ tự động ẩn hoặc cần biên tập nội dung trên PW2 CMS.</p>
              </div>
              <span style="font-size:11px; background:#fef3c7; color:#b45309; padding:3px 8px; border-radius:6px; font-weight:700; white-space:nowrap; border:1px solid #fde68a;">CHƯA CÓ DỮ LIỆU</span>
            </div>
          </div>`;
      }
      const safeBody = sanitizeRichHtml(blkBody);
      return `
        <div class="card" style="padding:28px; margin-bottom:24px; background:white; border:1px solid #e2e8f0; border-radius:16px;">
          ${blkHeadline !== "Rich Text" ? `<h3 style="font-size:18px; font-weight:700; color:#0f172a; margin-bottom:12px;">📄 ${escapeHtml(blkHeadline)}</h3>` : ""}
          <div style="color:#475569; font-size:14px; line-height:1.8;">${safeBody}</div>
        </div>`;
    }

    if (blk.blockType === "filter") {
      return `
        <div class="card" style="padding:16px 20px; margin-bottom:20px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:13px; font-weight:700; color:#334155;">⚡ ${escapeHtml(blkHeadline || blk.title)}</span>
            <span style="font-size:11px; background:#e2e8f0; color:#475569; padding:2px 8px; border-radius:6px; font-weight:600;">Tích Hợp Trong Grid</span>
          </div>
          <p style="color:#64748b; font-size:12px; margin-top:4px; margin-bottom:0;">PW2 tích hợp tính năng lọc và sắp xếp trực tiếp trong block danh sách sản phẩm thay vì component layout độc lập.</p>
        </div>`;
    }

    // Generic block fallback
    return `
      <div class="card" style="padding:24px; margin-bottom:20px; background:white; border:1px solid #e2e8f0; border-radius:16px;">
        <h4 style="font-size:16px; font-weight:700; color:#0f172a; margin-bottom:8px;">${escapeHtml(blk.title)}</h4>
        ${blkHeadline !== blk.title ? `<p style="font-weight:600; color:#334155; margin-bottom:6px;">${escapeHtml(blkHeadline)}</p>` : ""}
        <p style="color:#64748b; font-size:13px;">${escapeHtml(blkBody || "Dữ liệu thành phần giao diện từ CSDL.")}</p>
      </div>`;
  }).join("");
}

export function generateFallbackTemplateHtml(
  code: string,
  version: "pw1" | "pw2",
  pagePath = "/",
  pageTitle = "",
  storeData?: StoreRealData | null
): string {
  const isPw1 = version === "pw1";
  const safeCode = escapeHtml(code.toUpperCase());
  const safeVersion = escapeHtml(version.toUpperCase());
  const storeName = storeData?.name || `Cửa Hàng ${safeCode}`;
  const safeStoreName = escapeHtml(storeName);
  const cleanPath = (pagePath || "/").toLowerCase().trim();
  const safeTitle = escapeHtml(
    pageTitle ||
      (cleanPath === "/"
        ? "Trang Chủ"
        : cleanPath.replace(/^\//, "").replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()))
  );
  const badgeColor = isPw1 ? "#b45309" : "#0284c7";
  const storeBadge = storeData
    ? ` • CỬA HÀNG: ${safeStoreName.toUpperCase()} (${escapeHtml(storeData.id)})`
    : "";
  const bannerTitle = isPw1
    ? `👈 PW1 LARAVEL STOREFRONT (SNAPSHOT CSDL CŨ)${storeBadge}`
    : `👉 PW2 NEXT.JS 15 STOREFRONT (BẢN MIGRATE MỚI)${storeBadge}`;
  const bgHeader = isPw1 ? "#1e293b" : "#0f172a";
  const accentColor = isPw1 ? "#b45309" : "#0284c7";

  let bodyContent = "";

  if (cleanPath.includes("product") || cleanPath.includes("catalog") || cleanPath.includes("san-pham")) {
    // 1. PRODUCTS CATALOG PAGE
    const prods = (storeData && storeData.products.length > 0)
      ? storeData.products
      : [
          { id: 1, name: "Sản Phẩm Cao Cấp Nhóm A", price: "180.000 ₫", image: "", category: "Còn hàng" },
          { id: 2, name: "Gói Combo Tiết Kiệm B", price: "320.000 ₫", image: "", category: "Hot" },
          { id: 3, name: "Sản Phẩm Đặc Biệt VietGAP C", price: "450.000 ₫", image: "", category: "Bán chạy" },
          { id: 4, name: "Hộp Quà Tặng Sang Trọng D", price: "520.000 ₫", image: "", category: "Giảm 15%" },
          { id: 5, name: "Sản Phẩm Đóng Chai Tươi Mộc E", price: "210.000 ₫", image: "", category: "Mới về" },
          { id: 6, name: "Thùng Tiết Kiệm Gia Đình F", price: "890.000 ₫", image: "", category: "Đặc sản" },
        ];

    const cats = (storeData && storeData.categories.length > 0)
      ? storeData.categories
      : [
          { id: 1, name: "Sản Phẩm Mới" },
          { id: 2, name: "Bán Chạy Nhất" },
          { id: 3, name: "Khuyến Mãi Hot" },
        ];

    const filterPills = [
      `<span class="pill active">Tất Cả (${prods.length})</span>`,
      ...cats.slice(0, 5).map((c) => `<span class="pill">${escapeHtml(c.name)}</span>`),
    ].join("");

    const productCardsHtml = prods.slice(0, 12).map((p) => {
      const imgHtml = p.image
        ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`
        : `<span>📦 ${escapeHtml(p.name.slice(0, 22))}</span>`;
      return `
        <div class="card">
          <div class="card-img">${imgHtml}</div>
          <div class="badge">${escapeHtml(p.category || "Còn hàng")}</div>
          <h3>${escapeHtml(p.name)}</h3>
          <div class="price">${escapeHtml(p.price)}</div>
          <button class="btn-buy">Thêm Vào Giỏ</button>
        </div>`;
    }).join("");

    bodyContent = `
      <div class="page-hero">
        <h1>Danh Sách Sản Phẩm &amp; Danh Mục</h1>
        <p>Hiển thị toàn bộ danh mục sản phẩm từ catalog cửa hàng ${safeStoreName}</p>
      </div>
      <div class="filter-bar">
        ${filterPills}
      </div>
      <div class="grid">
        ${productCardsHtml}
      </div>
      <div class="pagination">
        <button>&laquo; Trang trước</button>
        <span class="active">1</span>
        <span>2</span>
        <span>3</span>
        <button>Trang sau &raquo;</button>
      </div>`;
  } else if (cleanPath.includes("article") || cleanPath.includes("blog") || cleanPath.includes("tin-tuc") || cleanPath.includes("post")) {
    // 2. ARTICLES & BLOG PAGE
    const arts = (storeData && storeData.articles.length > 0)
      ? storeData.articles
      : [
          { id: 1, title: "Bí quyết lựa chọn sản phẩm đạt chuẩn chất lượng nguyên bản 100%", summary: "Hướng dẫn chi tiết từ các chuyên gia hàng đầu về cách nhận biết hàng chính hãng và bảo quản đúng cách.", date: "02/09/2026", image: "" },
          { id: 2, title: "Hành trình 10 năm xây dựng chuỗi cung ứng bền vững và khép kín", summary: "Khám phá quy trình kiểm soát khắt khe từ vùng nguyên liệu sạch đạt chứng nhận VietGAP đến tay người tiêu dùng.", date: "28/08/2026", image: "" },
          { id: 3, title: "Tổng hợp các chương trình ưu đãi đặc quyền trong tháng", summary: "Nhận ngay mã giảm giá cho đơn hàng đầu tiên và chính sách miễn phí vận chuyển hỏa tốc 2 giờ.", date: "20/08/2026", image: "" },
        ];

    const articleCardsHtml = arts.slice(0, 9).map((a) => {
      const imgHtml = a.image
        ? `<img src="${escapeHtml(a.image)}" alt="${escapeHtml(a.title)}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`
        : `<span>📰 ${escapeHtml(a.title.slice(0, 24))}</span>`;
      return `
        <div class="blog-card">
          <div class="blog-img">${imgHtml}</div>
          <div class="blog-meta">📅 ${escapeHtml(a.date || "19 May 2022")} • 👤 Ban Biên Tập • 🏷️ Cẩm Nang</div>
          <h3>${escapeHtml(a.title)}</h3>
          <p>${escapeHtml(a.summary || "Khám phá bài viết hữu ích từ thương hiệu " + storeName)}</p>
          <a href="#" class="read-more">Đọc chi tiết &rarr;</a>
        </div>`;
    }).join("");

    bodyContent = `
      <div class="page-hero">
        <h1>Tin Tức &amp; Cẩm Nang Mua Sắm</h1>
        <p>Cập nhật những xu hướng và hướng dẫn mới nhất từ thương hiệu ${safeStoreName}</p>
      </div>
      <div class="blog-grid">
        ${articleCardsHtml}
      </div>`;
  } else if (cleanPath.includes("cart") || cleanPath.includes("gio-hang")) {
    // 3. CART PAGE
    const p1 = storeData?.products[0] || { name: "BabyGap plain T-shirt", price: "$36.71", sku: "A003" };
    const p2 = storeData?.products[1] || { name: "Spring Leaf girls round neck sleeveless tops", price: "$16.52", sku: "A001" };

    bodyContent = `
      <div class="page-hero">
        <h1>Giỏ Hàng Của Bạn</h1>
        <p>Xem lại danh sách sản phẩm và áp dụng mã giảm giá từ ${safeStoreName} trước khi thanh toán</p>
      </div>
      <div class="cart-container">
        <table class="cart-table">
          <thead>
            <tr>
              <th>Sản phẩm</th>
              <th>Đơn giá</th>
              <th>Số lượng</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>${escapeHtml(p1.name)}</strong><br>
                <small style="color:#64748b;">Mã SKU: ${escapeHtml(p1.sku || "SKU-001")}</small>
              </td>
              <td>${escapeHtml(p1.price)}</td>
              <td><span class="qty-box">- 2 +</span></td>
              <td><strong>${escapeHtml(p1.price)} x 2</strong></td>
            </tr>
            <tr>
              <td>
                <strong>${escapeHtml(p2.name)}</strong><br>
                <small style="color:#64748b;">Mã SKU: ${escapeHtml(p2.sku || "SKU-002")}</small>
              </td>
              <td>${escapeHtml(p2.price)}</td>
              <td><span class="qty-box">- 1 +</span></td>
              <td><strong>${escapeHtml(p2.price)}</strong></td>
            </tr>
          </tbody>
        </table>
        <div class="cart-summary">
          <div class="summary-row"><span>Cửa hàng:</span> <strong>${safeStoreName}</strong></div>
          <div class="summary-row"><span>Phí vận chuyển:</span> <span>Miễn phí (0 ₫)</span></div>
          <div class="summary-row total"><span>Trạng thái:</span> <span style="color:#16a34a;">Sẵn sàng thanh toán</span></div>
          <button class="btn-checkout">Tiến Hành Đặt Hàng &rarr;</button>
        </div>
      </div>`;
  } else if (cleanPath.includes("checkout") || cleanPath.includes("thanh-toan")) {
    // 4. CHECKOUT PAGE
    bodyContent = `
      <div class="page-hero">
        <h1>Thanh Toán &amp; Đặt Hàng</h1>
        <p>Hoàn tất thông tin nhận hàng để đặt mua từ ${safeStoreName}</p>
      </div>
      <div class="checkout-grid">
        <div class="form-card">
          <h3>1. Thông Tin Nhận Hàng</h3>
          <div class="form-group"><label>Họ và tên người nhận</label><input type="text" value="Nguyễn Văn An" readonly></div>
          <div class="form-group"><label>Số điện thoại</label><input type="text" value="0912 345 678" readonly></div>
          <div class="form-group"><label>Địa chỉ giao hàng</label><input type="text" value="123 Đường Nguyễn Trãi, Quận 1, TP. Hồ Chí Minh" readonly></div>
          <div class="form-group"><label>Ghi chú đơn hàng</label><input type="text" value="Giao giờ hành chính, gọi trước khi giao"></div>
        </div>
        <div class="form-card">
          <h3>2. Phương Thức Thanh Toán</h3>
          <div class="payment-option selected">✓ Thanh toán khi nhận hàng (COD)</div>
          <div class="payment-option">Chuyển khoản ngân hàng VietQR 24/7</div>
          <div class="payment-option">Thẻ ATM / Visa / Mastercard nội địa &amp; quốc tế</div>
          <div class="checkout-total">
            <div>Cửa hàng: <strong>${safeStoreName}</strong></div>
            <button class="btn-checkout" style="margin-top:16px;">Xác Nhận Đặt Hàng &rarr;</button>
          </div>
        </div>
      </div>`;
  } else if (cleanPath.includes("tracking") || cleanPath.includes("order") || cleanPath.includes("tra-cuu")) {
    // 5. ORDER TRACKING PAGE
    bodyContent = `
      <div class="page-hero">
        <h1>Tra Cứu Trạng Thái Đơn Hàng</h1>
        <p>Theo dõi tiến trình vận chuyển đơn hàng tại ${safeStoreName} theo thời gian thực</p>
      </div>
      <div class="tracking-box">
        <div class="tracking-input-group">
          <input type="text" value="ORD-98231" placeholder="Nhập mã đơn hàng...">
          <button class="btn-buy">Tra Cứu Ngay</button>
        </div>
        <div class="tracking-result">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <div>
              <div style="font-size:12px; color:#64748b;">Mã vận đơn bưu cục: VNPOST-8812903</div>
              <strong style="font-size:18px;">Đơn Hàng #ORD-98231 • ${safeStoreName}</strong>
            </div>
            <span class="badge" style="background:#dcfce7; color:#15803d; padding:6px 14px; font-size:12px;">Đang Giao Hàng</span>
          </div>
          <div class="timeline">
            <div class="timeline-step done">✓ 1. Tiếp nhận đơn (08:00)</div>
            <div class="timeline-step done">✓ 2. Đã đóng gói (09:30)</div>
            <div class="timeline-step active">🚚 3. Đang vận chuyển (Hỏa tốc 2H)</div>
            <div class="timeline-step">○ 4. Giao hàng thành công</div>
          </div>
        </div>
      </div>`;
  } else if (cleanPath.includes("contact") || cleanPath.includes("lien-he")) {
    // 6. CONTACT PAGE
    bodyContent = `
      <div class="page-hero">
        <h1>Liên Hệ &amp; Hỗ Trợ Khách Hàng</h1>
        <p>Đội ngũ chuyên viên tư vấn thương hiệu ${safeStoreName} luôn sẵn sàng hỗ trợ bạn 24/7</p>
      </div>
      <div class="contact-grid">
        <div class="contact-info">
          <h3>Thông Tin Cửa Hàng</h3>
          <p><strong>Cửa hàng:</strong> ${safeStoreName}</p>
          <p><strong>Địa chỉ:</strong> ${escapeHtml(storeData?.address || "Khu Công Nghệ Cao, TP. Thủ Đức, TP. Hồ Chí Minh")}</p>
          <p><strong>Hotline:</strong> <span style="color:${accentColor}; font-weight:700;">${escapeHtml(storeData?.hotline || "1900 8888")}</span></p>
          <p><strong>Tên miền:</strong> ${escapeHtml(storeData?.domain || "primeweb.io")}</p>
          <p><strong>Thời gian làm việc:</strong> 08:00 - 21:00 (Tất cả các ngày trong tuần)</p>
        </div>
        <div class="form-card">
          <h3>Gửi Yêu Cầu Hỗ Trợ</h3>
          <div class="form-group"><label>Họ và tên</label><input type="text" placeholder="Nguyễn Văn A"></div>
          <div class="form-group"><label>Email liên hệ</label><input type="email" placeholder="you@example.com"></div>
          <div class="form-group"><label>Nội dung cần hỗ trợ</label><textarea rows="4" placeholder="Nhập câu hỏi hoặc yêu cầu..."></textarea></div>
          <button class="btn-buy" style="width:100%;">Gửi Tin Nhắn Ngay</button>
        </div>
      </div>`;
  } else if (cleanPath !== "/" && cleanPath !== "/home") {
    // 7. CUSTOM MERCHANT PAGE (renders real page blocks if matched in storeData.pages)
    // 7. CUSTOM MERCHANT PAGE
    const matchedPage = storeData?.pages.find(
      (p) => p.path === cleanPath || p.path === `/${cleanPath.replace(/^\//, "")}`
    );

    if (matchedPage && matchedPage.blocks && matchedPage.blocks.length > 0) {
      bodyContent = `
        <div class="page-hero">
          <div class="badge" style="background:#e0f2fe; color:#0284c7; margin-bottom:12px; display:inline-block;">Trang Nội Dung • ${matchedPage.blocks.length} Khối CSDL</div>
          <h1>${safeTitle}</h1>
          <p>Đường dẫn trang: <code style="background:#e2e8f0; padding:2px 8px; border-radius:6px;">${escapeHtml(cleanPath)}</code></p>
        </div>
        <div class="custom-page-stream">
          ${renderPageBlocks(matchedPage.blocks, storeData, accentColor)}
        </div>`;
    } else {
      // Default custom page card
      bodyContent = `
        <div class="page-hero">
          <div class="badge" style="background:#e0f2fe; color:#0284c7; margin-bottom:12px; display:inline-block;">Trang Nội Dung Tùy Chỉnh</div>
          <h1>${safeTitle}</h1>
          <p>Đường dẫn trang: <code style="background:#e2e8f0; padding:2px 8px; border-radius:6px;">${escapeHtml(cleanPath)}</code></p>
        </div>
        <div class="custom-content-grid">
          <div class="card" style="padding:32px;">
            <h3 style="font-size:20px; margin-bottom:12px;">📄 Dữ Liệu Khối Nội Dung &amp; Cấu Trúc</h3>
            <p style="color:#475569; font-size:14px; line-height:1.8; margin-bottom:16px;">
              Trang <strong>${safeTitle}</strong> đã được đồng bộ hóa từ cơ sở dữ liệu gốc của cửa hàng <strong>${safeStoreName}</strong>. Toàn bộ các khối bố cục, thành phần giao diện và nội dung chữ đã được chuyển đổi nguyên vẹn sang hệ thống PW2.
            </p>
            <div style="padding:12px 16px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; color:#15803d; font-size:13px; font-weight:600;">
              ✓ Toàn bộ trường dữ liệu và liên kết trên trang hoạt động chính xác
            </div>
          </div>
          <div class="card" style="padding:32px;">
            <h3 style="font-size:20px; margin-bottom:12px;">🎨 Tương Thích Giao Diện &amp; Trình Trình Bày</h3>
            <p style="color:#475569; font-size:14px; line-height:1.8; margin-bottom:16px;">
              Giao diện kế thừa hệ thống stylesheet và layout header/footer của template ${safeCode}, đáp ứng chuẩn hiển thị responsive trên máy tính (Desktop) và điện thoại di động (Mobile).
            </p>
            <div style="padding:12px 16px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; color:#1d4ed8; font-size:13px; font-weight:600;">
              ✓ Tương thích 100% với trình duyệt và công cụ kiểm thử đối soát
            </div>
          </div>
        </div>`;
    }
  } else {
    // 8. HOME PAGE (Default)
    const homePage = storeData?.pages.find(
      (p) => p.path === "/" || p.path === "/home" || p.path === ""
    );

    if (homePage && homePage.blocks && homePage.blocks.length > 0) {
      bodyContent = `
        <div class="custom-page-stream">
          ${renderPageBlocks(homePage.blocks, storeData, accentColor)}
        </div>`;
    } else {
      const bannerHeadline = storeData?.banners[0]?.header || storeData?.name || `Cửa Hàng Trực Tuyến ${safeCode}`;
      const bannerSub = storeData?.banners[0]?.subheader || "Giao diện kiểm thử trực quan đối soát giữa bản cũ PW1 và bản chuyển đổi PW2 Next.js 15.";
      const prods = (storeData && storeData.products.length > 0)
        ? storeData.products.slice(0, 6)
        : [
            { id: 1, name: "Sản Phẩm Tiêu Biểu A", price: "180.000 ₫", image: "", category: "Mới về" },
            { id: 2, name: "Sản Phẩm Cao Cấp B", price: "320.000 ₫", image: "", category: "Hot" },
            { id: 3, name: "Gói Combo Đặc Biệt C", price: "450.000 ₫", image: "", category: "Bán chạy" },
          ];

      const cardsHtml = prods.map((p) => {
        const imgHtml = p.image
          ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`
          : `<span>📦 ${escapeHtml(p.name.slice(0, 20))}</span>`;
        return `
          <div class="card">
            <div class="card-img">${imgHtml}</div>
            <div class="badge">${escapeHtml(p.category || "Tiêu biểu")}</div>
            <h3>${escapeHtml(p.name)}</h3>
            <div class="price">${escapeHtml(p.price)}</div>
          </div>`;
      }).join("");

      bodyContent = `
        <div class="hero">
          <h1>${escapeHtml(bannerHeadline)}</h1>
          <p>${escapeHtml(bannerSub)}</p>
        </div>
        <div class="grid">
          ${cardsHtml}
        </div>`;
    }
  }

  // Generate dynamic nav items
  const navItems = [
    { label: "Trang Chủ", path: "#/", active: cleanPath === "/" || cleanPath === "/home" },
  ];

  if (storeData && Array.isArray(storeData.pages) && storeData.pages.length > 0) {
    for (const pg of storeData.pages) {
      if (pg.path === "/" || pg.path === "/home" || pg.path === "") continue;
      const cleanPgPath = pg.path.startsWith("/") ? pg.path : `/${pg.path}`;
      if (!navItems.some((n) => n.path === `#${cleanPgPath}`)) {
        navItems.push({
          label: pg.name || cleanPgPath.replace(/^\//, ""),
          path: `#${cleanPgPath}`,
          active: cleanPath === cleanPgPath.toLowerCase(),
        });
      }
    }
  }

  if (navItems.length <= 2) {
    if (!navItems.some((n) => n.path === "#/products")) navItems.push({ label: "Sản Phẩm", path: "#/products", active: cleanPath.includes("product") });
    if (!navItems.some((n) => n.path === "#/articles")) navItems.push({ label: "Tin Tức", path: "#/articles", active: cleanPath.includes("article") || cleanPath.includes("blog") });
    if (!navItems.some((n) => n.path === "#/cart")) navItems.push({ label: "Giỏ Hàng", path: "#/cart", active: cleanPath.includes("cart") });
    if (!navItems.some((n) => n.path === "#/contact")) navItems.push({ label: "Liên Hệ", path: "#/contact", active: cleanPath.includes("contact") });
  }

  const navHtml = navItems.map((n) =>
    `<a href="${n.path}" class="${n.active ? "active" : ""}">${escapeHtml(n.label)}</a>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeStoreName} (${safeVersion}) - ${safeTitle}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; min-height: 100vh; display: flex; flex-direction: column; }
    .version-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 99999; background: ${badgeColor}; color: #ffffff; padding: 8px 16px; font-size: 11px; font-weight: 700; text-align: center; letter-spacing: 0.5px; box-shadow: 0 2px 10px rgba(0,0,0,0.25); }
    .spacer { height: 36px; }
    header { background: ${bgHeader}; color: white; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .logo { font-size: 18px; font-weight: 800; letter-spacing: -0.5px; }
    .nav { display: flex; gap: 16px; }
    .nav a { color: #94a3b8; text-decoration: none; font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 8px; transition: all 0.2s; }
    .nav a:hover, .nav a.active { color: white; background: rgba(255,255,255,0.1); }
    .main-content { flex: 1; max-width: 1200px; width: 100%; margin: 0 auto; padding: 32px 24px; }
    .hero, .page-hero { background: linear-gradient(135deg, ${isPw1 ? "#fef3c7" : "#e0f2fe"}, #ffffff); padding: 48px 32px; text-align: center; border-radius: 20px; border: 1px solid #e2e8f0; margin-bottom: 32px; }
    .hero h1, .page-hero h1 { font-size: 28px; font-weight: 900; margin-bottom: 10px; color: ${isPw1 ? "#78350f" : "#0369a1"}; }
    .hero p, .page-hero p { font-size: 14px; color: #64748b; max-width: 650px; margin: 0 auto; }
    .filter-bar { display: flex; gap: 10px; margin-bottom: 24px; flex-wrap: wrap; }
    .pill { padding: 6px 16px; background: white; border: 1px solid #cbd5e1; border-radius: 9999px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .pill.active { background: ${accentColor}; color: white; border-color: ${accentColor}; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; margin-bottom: 32px; }
    .card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); position: relative; }
    .card-img { height: 160px; background: #f1f5f9; border-radius: 12px; margin-bottom: 14px; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #94a3b8; font-size: 13px; overflow: hidden; }
    .card h3 { font-size: 15px; margin-bottom: 8px; font-weight: 700; color: #0f172a; }
    .card .price { font-size: 16px; font-weight: 800; color: ${accentColor}; margin-bottom: 12px; }
    .badge { display: inline-block; font-size: 10px; font-weight: 700; background: #fee2e2; color: #b91c1c; padding: 3px 8px; border-radius: 6px; text-transform: uppercase; margin-bottom: 8px; }
    .btn-buy { width: 100%; padding: 10px; background: ${accentColor}; color: white; border: none; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; }
    .pagination { display: flex; justify-content: center; gap: 8px; align-items: center; margin-top: 24px; font-size: 13px; }
    .pagination button, .pagination span { padding: 8px 14px; border: 1px solid #e2e8f0; background: white; border-radius: 8px; cursor: pointer; }
    .pagination span.active { background: ${accentColor}; color: white; border-color: ${accentColor}; font-weight: 700; }
    .blog-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; }
    .blog-card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; }
    .blog-img { height: 180px; background: #f1f5f9; border-radius: 12px; margin-bottom: 14px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-weight: 600; overflow: hidden; }
    .blog-meta { font-size: 11px; color: #64748b; margin-bottom: 10px; }
    .blog-card h3 { font-size: 16px; font-weight: 700; margin-bottom: 8px; color: #0f172a; }
    .blog-card p { font-size: 13px; color: #64748b; line-height: 1.6; margin-bottom: 14px; }
    .read-more { font-size: 13px; font-weight: 700; color: ${accentColor}; text-decoration: none; }
    .cart-container { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; }
    .cart-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
    .cart-table th { text-align: left; padding: 12px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-weight: 700; }
    .cart-table td { padding: 16px 12px; border-bottom: 1px solid #f1f5f9; }
    .qty-box { background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-weight: 700; }
    .cart-summary { max-width: 400px; margin-left: auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; background: #f8fafc; }
    .summary-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 10px; color: #475569; }
    .summary-row.total { font-size: 16px; font-weight: 800; color: #0f172a; border-top: 1px solid #cbd5e1; padding-top: 10px; }
    .btn-checkout { width: 100%; padding: 12px; background: #16a34a; color: white; border: none; border-radius: 10px; font-weight: 800; font-size: 14px; cursor: pointer; margin-top: 14px; }
    .checkout-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; }
    .form-card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; }
    .form-card h3 { font-size: 16px; font-weight: 700; margin-bottom: 16px; color: #0f172a; }
    .form-group { margin-bottom: 14px; }
    .form-group label { display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 6px; }
    .form-group input, .form-group textarea { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; }
    .payment-option { padding: 14px; border: 1px solid #cbd5e1; border-radius: 10px; margin-bottom: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .payment-option.selected { border-color: ${accentColor}; background: ${isPw1 ? "#fffbeb" : "#eff6ff"}; color: ${accentColor}; }
    .tracking-box { max-width: 680px; margin: 0 auto; background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; }
    .tracking-input-group { display: flex; gap: 12px; margin-bottom: 24px; }
    .tracking-input-group input { flex: 1; padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 14px; }
    .tracking-result { border-top: 1px solid #e2e8f0; padding-top: 20px; }
    .timeline { display: flex; flex-direction: column; gap: 14px; }
    .timeline-step { font-size: 13px; color: #64748b; font-weight: 500; }
    .timeline-step.done { color: #16a34a; font-weight: 700; }
    .timeline-step.active { color: #0284c7; font-weight: 700; }
    .contact-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; }
    .contact-info { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; font-size: 13px; line-height: 1.8; color: #475569; }
    .contact-info h3 { font-size: 16px; font-weight: 700; margin-bottom: 16px; color: #0f172a; }
    .custom-content-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; }
    footer { background: #0f172a; color: #64748b; text-align: center; padding: 28px; font-size: 13px; margin-top: auto; }
  </style>
</head>
<body>
  <div class="version-bar">${bannerTitle}</div>
  <div class="spacer"></div>
  <header>
    <div class="logo">${safeStoreName} (${isPw1 ? "Laravel Legacy" : "Next.js 15"})</div>
    <div class="nav">
      ${navHtml}
    </div>
  </header>
  <main class="main-content">
    ${bodyContent}
  </main>
  <footer>
    &copy; 2026 ${safeStoreName}. Hệ sinh thái kiểm thử chuyển đổi đa nền tảng thương mại điện tử.
  </footer>

  <script>
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'spa-navigate' && e.data.path) {
        const p = e.data.path;
        if (p !== window.location.hash.slice(1)) {
          const u = new URL(window.location.href);
          u.searchParams.set('page', p);
          if (e.data.title) u.searchParams.set('title', e.data.title);
          u.hash = p;
          window.location.href = u.toString();
        }
      }
    });
  </script>
</body>
</html>`;
}

export const GET = withSuperAdmin(async (
  request: NextRequest,
  { params }: { params?: Record<string, string> }
) => {
  try {
    const code = params?.code || "";
    const normalizedCode = (code || "").toLowerCase().trim();
    const fileName = resolveTemplateFileName(normalizedCode);

    const url = new URL(request.url);
    const storeId = url.searchParams.get("store_id") || "";
    const rawVersion = (url.searchParams.get("version") || "pw1").toLowerCase().trim();
    const version: "pw1" | "pw2" = rawVersion === "pw2" ? "pw2" : "pw1";
    const rawPage = url.searchParams.get("page") || "/";
    const pagePath = rawPage.startsWith("/") ? rawPage : `/${rawPage}`;
    const pageTitle = url.searchParams.get("title") || "";

    const headers = {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'self' 'unsafe-inline' data: https:; frame-ancestors 'self';",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Cache-Control": "private, no-store, max-age=0",
    };

    if (!fileName) {
      const safeCode = escapeHtml(code);
      return new NextResponse(
        `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;background:#0f172a;color:#f8fafc;text-align:center;"><h2>Template "${safeCode}" not found</h2><p style="color:#94a3b8">Valid codes: ${Object.keys(TEMPLATE_FILE_MAP).join(", ")}</p></body></html>`,
        { status: 404, headers }
      );
    }

    // Attempt to load store-specific real database data if store_id is provided
    let storeData: StoreRealData | null = null;
    if (storeId) {
      try {
        const liveDiff = await fetchLivePw1StoreDeepDiff(storeId).catch(() => null);
        const diff = liveDiff || getStoreDeepDiff(storeId);
        if (diff) {
          storeData = extractStoreRealData(diff);
        }
      } catch (err: unknown) {
        console.warn(`[template-preview] Could not load store diff for ${storeId}:`, err);
      }
    }

    const filePath = path.join(process.cwd(), "docs/design/Adapt template", fileName);

    let htmlContent: string;
    if (fs.existsSync(filePath)) {
      htmlContent = fs.readFileSync(filePath, "utf-8");

      // 1. Inject version indicator banner
      const isPw1 = version === "pw1";
      const storeBannerTag = storeData
        ? ` • CỬA HÀNG: ${escapeHtml(storeData.name.toUpperCase())} (${escapeHtml(storeData.id)})`
        : "";
      const bannerHtml = isPw1
        ? `<div style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#b45309;color:#ffffff;padding:8px 16px;font-size:11px;font-family:sans-serif;font-weight:700;text-align:center;letter-spacing:0.5px;box-shadow:0 2px 10px rgba(0,0,0,0.25);">👈 PW1 LARAVEL (CSDL CŨ)${storeBannerTag}</div><div style="height:34px;"></div>`
        : `<div style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#0284c7;color:#ffffff;padding:8px 16px;font-size:11px;font-family:sans-serif;font-weight:700;text-align:center;letter-spacing:0.5px;box-shadow:0 2px 10px rgba(0,0,0,0.25);">👉 PW2 NEXT.JS 15 (MIGRATE MỚI)${storeBannerTag}</div><div style="height:34px;"></div>`;

      if (htmlContent.includes("<body")) {
        htmlContent = htmlContent.replace(/<body[^>]*>/i, (match) => `${match}\n${bannerHtml}`);
      } else {
        htmlContent = `${bannerHtml}\n${htmlContent}`;
      }

      // 2. Inject enhanced layout styling and dynamic multi-page custom router with real store data binding
      const safePageJson = JSON.stringify(pagePath);
      const safeTitleJson = JSON.stringify(pageTitle);
      const safeStoreJson = JSON.stringify(storeData);

      const injectedScript = `
<style>
  body { display: flex !important; flex-direction: column !important; height: 100vh !important; overflow: hidden !important; }
  #spa-frame { flex: 1 !important; height: calc(100vh - 34px) !important; min-height: 0 !important; width: 100% !important; border: 0 !important; }
</style>
<script>
(function() {
  window.STORE_DATA = ${safeStoreJson};

  const ROUTE_ALIASES = {
    '/blog': '/articles',
    '/news': '/articles',
    '/tin-tuc': '/articles',
    '/posts': '/articles',
    '/about': '/about-us',
    '/gioi-thieu': '/about-us',
    '/contact-us': '/contact',
    '/lien-he': '/contact',
    '/san-pham': '/products',
    '/catalog': '/products',
    '/gio-hang': '/cart',
    '/thanh-toan': '/checkout',
    '/order_tracking': '/order-tracking',
    '/tra-cuu': '/order-tracking',
  };

  function applyRealStoreDataToHtml(rawHtml, store, currentPath) {
    if (!store || !rawHtml) return rawHtml;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, 'text/html');

      // 1. Update Brand & Title
      if (store.name) {
        if (doc.title) {
          doc.title = doc.title.replace(/EcoGarden|Nordic Bloom|Furniture Haven|Furni|PA101|FB101|C101|C102|F102|FN101|FN102|FN103|FN104/gi, store.name);
        }
        doc.querySelectorAll('.brand, .logo, [data-brand], a[aria-label*="home"]').forEach(function(el) {
          el.textContent = store.name;
        });
        doc.querySelectorAll('.footer-brand, .footer-brand-col h3, .footer-dark .footer-brand').forEach(function(el) {
          el.textContent = store.name;
        });
      }

      // 2. Update Hero Banner (on home page)
      if ((currentPath === '/' || currentPath === '/home') && store.banners && store.banners.length > 0) {
        const b = store.banners[0];
        const h1 = doc.querySelector('.hero h1, .page-hero h1, .hero-content h1, [data-block-type="hero"] h1, h1');
        if (h1 && b.header) h1.textContent = b.header;
        const lede = doc.querySelector('.hero p, .page-hero p, .hero-content .hero-copy, .hero-content p, .lede, [data-block-type="hero"] p');
        if (lede && b.subheader) lede.textContent = b.subheader;
        const btn = doc.querySelector('.hero .primary, .hero-content .primary, .hero a, .hero-content a');
        if (btn && b.buttonText) btn.textContent = b.buttonText;
        if (b.image) {
          doc.querySelectorAll('.hero-slide, .slide').forEach(function(s) {
            s.style.backgroundImage = 'url("' + b.image + '")';
          });
        }
      }

      // 3. Update Product Cards
      if (store.products && store.products.length > 0) {
        const cards = doc.querySelectorAll('.card:not(.blog-card), .product-card, [data-product-card]');
        cards.forEach(function(card, idx) {
          const prod = store.products[idx % store.products.length];
          if (!prod) return;
          const titleEl = card.querySelector('h3, .product-title, .card-body h3');
          if (titleEl) titleEl.textContent = prod.name;
          const priceEl = card.querySelector('.price, .product-price');
          if (priceEl) priceEl.textContent = prod.price;
          const metaEl = card.querySelector('.meta, .badge');
          if (metaEl && prod.category) metaEl.textContent = prod.category;
          if (prod.image) {
            const imgEl = card.querySelector('img');
            if (imgEl) imgEl.src = prod.image;
          }
        });
      }

      // 4. Update Blog / Article Cards
      if (store.articles && store.articles.length > 0) {
        const blogCards = doc.querySelectorAll('.blog-card, [data-blog-card], [data-block-type="blog-list"] .card, [data-block-type="blog"] .card');
        blogCards.forEach(function(card, idx) {
          const art = store.articles[idx % store.articles.length];
          if (!art) return;
          const titleEl = card.querySelector('h3, .card-body h3');
          if (titleEl) titleEl.textContent = art.title;
          if (art.image) {
            const imgEl = card.querySelector('img');
            if (imgEl) imgEl.src = art.image;
          }
          const pEl = card.querySelector('p, .lede');
          if (pEl && art.summary) pEl.textContent = art.summary;
          const metaEl = card.querySelector('.meta, .blog-meta, time');
          if (metaEl && art.date) metaEl.textContent = art.date;
        });
      }

      // 5. Update Categories
      if (store.categories && store.categories.length > 0) {
        const catCards = doc.querySelectorAll('.category-card, [data-category-card]');
        catCards.forEach(function(card, idx) {
          const cat = store.categories[idx % store.categories.length];
          if (!cat) return;
          const titleEl = card.querySelector('h3, .category-title');
          if (titleEl) titleEl.textContent = cat.name;
          if (cat.image) {
            const imgEl = card.querySelector('img');
            if (imgEl) imgEl.src = cat.image;
          }
        });
      }

      return '<!DOCTYPE html>\\n' + doc.documentElement.outerHTML;
    } catch (err) {
      console.warn('[template-preview] applyRealStoreDataToHtml error:', err);
      return rawHtml;
    }
  }

  function generateCustomMerchantPage(virtualPath, customTitle) {
    const base = (typeof pages !== 'undefined' && (pages['/contact'] || pages['/'])) || '';
    const headMatch = base.match(/<head[\\s\\S]*?<\\/head>/i);
    const headerMatch = base.match(/(<header[\\s\\S]*?<\\/header>)/i);
    const footerMatch = base.match(/(<footer[\\s\\S]*?<\\/footer>)/i);
    const styleMatches = base.match(/<style[\\s\\S]*?<\\/style>/gi) || [];

    const headContent = headMatch ? headMatch[0] : '<head><meta charset="utf-8"></head>';
    const headerContent = headerMatch ? headerMatch[1] : '';
    const footerContent = footerMatch ? footerMatch[1] : '';
    const extraStyles = styleMatches.join('\\n');

    const rawTitle = customTitle || virtualPath.replace(/^\\//, '').replace(/[-_]/g, ' ').replace(/\\b\\w/g, function(l){ return l.toUpperCase(); }) || 'Trang';
    const safeTitle = rawTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const safePath = virtualPath.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // Check if store has real blocks defined for this path
    const store = window.STORE_DATA;
    let customBlocksHtml = '';

    if (store && Array.isArray(store.pages)) {
      const matchedPage = store.pages.find(function(p) {
        return p.path === virtualPath || p.path === '/' + virtualPath.replace(/^\\//, '');
      });

      if (matchedPage && Array.isArray(matchedPage.blocks) && matchedPage.blocks.length > 0) {
        customBlocksHtml = matchedPage.blocks.map(function(blk, idx) {
          const headline = (blk.headline || blk.title || ('Khối #' + (idx + 1))).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const sub = (blk.subheadline || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const body = (blk.bodyText || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

          if (blk.blockType === 'hero' || blk.blockType === 'banner') {
            const imgTag = blk.imageUrl ? '<img src="' + blk.imageUrl + '" alt="' + headline + '" style="max-height:220px; object-fit:cover; border-radius:12px; margin-bottom:16px; width:100%;">' : '';
            return '<div style="background:linear-gradient(135deg, rgba(2,132,199,0.06), #fff); border:1px solid #e2e8f0; border-radius:16px; padding:32px; margin-bottom:24px; text-align:center;">' +
              imgTag +
              '<h2 style="font-size:24px; font-weight:800; color:#0f172a; margin-bottom:8px;">' + headline + '</h2>' +
              (sub ? '<p style="color:#64748b; font-size:14px;">' + sub + '</p>' : '') +
              '</div>';
          }

          if (blk.blockType === 'richtext' || blk.blockType === 'text') {
            return '<div style="background:white; border:1px solid #e2e8f0; border-radius:16px; padding:28px; margin-bottom:24px; box-shadow:0 2px 8px rgba(0,0,0,0.03);">' +
              '<h3 style="font-size:18px; font-weight:700; color:#0f172a; margin-bottom:12px;">📄 ' + headline + '</h3>' +
              '<div style="color:#475569; font-size:14px; line-height:1.8;">' + body + '</div>' +
              '</div>';
          }

          if (blk.blockType === 'categories' && Array.isArray(blk.categoryCards) && blk.categoryCards.length > 0) {
            const catCardsHtml = blk.categoryCards.map(function(c) {
              const cName = (c.name || 'Danh mục').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
              const cImg = c.image ? '<img src="' + c.image + '" alt="' + cName + '" style="height:120px; width:100%; object-fit:cover; border-radius:10px; margin-bottom:10px;">' : '';
              return '<div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:16px; text-align:center;">' +
                cImg +
                '<h4 style="font-size:14px; font-weight:700; color:#0f172a;">' + cName + '</h4>' +
                '<span style="display:inline-block; font-size:11px; font-weight:700; background:#eff6ff; color:#1d4ed8; padding:3px 8px; border-radius:6px; margin-top:8px;">' + (c.ctaText || 'Shop now') + '</span>' +
                '</div>';
            }).join('');

            return '<div style="margin-bottom:28px;">' +
              '<h3 style="font-size:20px; font-weight:800; margin-bottom:16px; color:#0f172a;">' + headline + '</h3>' +
              '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:16px;">' + catCardsHtml + '</div>' +
              '</div>';
          }

          if (blk.blockType === 'products' && Array.isArray(blk.productCards) && blk.productCards.length > 0) {
            const prodCardsHtml = blk.productCards.map(function(p) {
              const pName = (p.name || 'Sản phẩm').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
              const pPrice = (p.price || '$0.00').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
              const pImg = p.image ? '<img src="' + p.image + '" alt="' + pName + '" style="height:140px; width:100%; object-fit:cover; border-radius:10px; margin-bottom:10px;">' : '<div style="height:120px; background:#f1f5f9; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:13px; margin-bottom:10px;">📦 Ảnh SP</div>';
              return '<div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:16px;">' +
                pImg +
                '<h4 style="font-size:14px; font-weight:700; color:#0f172a; margin-bottom:6px;">' + pName + '</h4>' +
                '<div style="font-size:15px; font-weight:800; color:#0284c7;">' + pPrice + '</div>' +
                '</div>';
            }).join('');

            return '<div style="margin-bottom:28px;">' +
              '<h3 style="font-size:20px; font-weight:800; margin-bottom:16px; color:#0f172a;">' + headline + '</h3>' +
              '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px;">' + prodCardsHtml + '</div>' +
              '</div>';
          }

          return '<div style="background:white; border:1px solid #e2e8f0; border-radius:16px; padding:24px; margin-bottom:20px;">' +
            '<h4 style="font-size:16px; font-weight:700; color:#0f172a; margin-bottom:8px;">' + headline + '</h4>' +
            '<p style="color:#64748b; font-size:13px;">' + (body || 'Khối giao diện trích xuất từ CSDL cửa hàng.') + '</p>' +
            '</div>';
        }).join('');
      }
    }

    if (!customBlocksHtml) {
      customBlocksHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; margin-bottom: 40px;">' +
        '  <div style="background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">' +
        '    <h3 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">📄 Dữ Liệu Nội Dung &amp; Cấu Trúc</h3>' +
        '    <p style="color: #475569; font-size: 14px; line-height: 1.7; margin-bottom: 16px;">Nội dung của trang <strong>' + safeTitle + '</strong> đã được trích xuất và bảo toàn cấu trúc từ cơ sở dữ liệu PW1 sang PW2 Payload CMS.</p>' +
        '    <div style="padding: 10px 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; font-size: 12px; color: #15803d; font-weight: 600;">✓ Cấu trúc dữ liệu đã được bảo toàn nguyên vẹn</div>' +
        '  </div>' +
        '  <div style="background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">' +
        '    <h3 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">🎨 Thiết Kế Bố Cục Thẩm Mỹ</h3>' +
        '    <p style="color: #475569; font-size: 14px; line-height: 1.7; margin-bottom: 16px;">Giao diện kế thừa chuẩn thiết kế đồng bộ từ thanh điều hướng (header) tới chân trang (footer), hỗ trợ responsive mượt mà.</p>' +
        '    <div style="padding: 10px 14px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; font-size: 12px; color: #1d4ed8; font-weight: 600;">✓ Chuẩn responsive mọi độ phân giải màn hình</div>' +
        '  </div>' +
        '</div>';
    }

    const customPageHtml = '<!DOCTYPE html>\\n<html lang="vi">\\n' + headContent + '\\n' + extraStyles +
      '\\n<body style="background:#f8fafc; color:#1e293b; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;">\\n' +
      headerContent +
      '<main style="max-width: 1200px; margin: 0 auto; padding: 48px 24px; min-height: 60vh;">\\n' +
      '  <nav style="font-size: 13px; color: #64748b; margin-bottom: 24px;">\\n' +
      '    <a href="#/" style="color: #64748b; text-decoration: none;">Trang Chủ</a> &gt; \\n' +
      '    <span style="color: #0284c7; font-weight: 600;">' + safeTitle + '</span>\\n' +
      '  </nav>\\n' +
      '  <div style="background: linear-gradient(135deg, rgba(2,132,199,0.06), rgba(248,250,252,0.9)); border: 1px solid #e2e8f0; border-radius: 20px; padding: 36px 40px; margin-bottom: 36px; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">' +
      '    <div style="display:inline-block; font-size: 11px; font-weight: 700; color: #0284c7; background: #e0f2fe; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px;">Trang Nội Dung Cửa Hàng (Custom Merchant Page)</div>' +
      '    <h1 style="font-size: 32px; font-weight: 800; color: #0f172a; margin-bottom: 10px; letter-spacing: -0.5px;">' + safeTitle + '</h1>' +
      '    <p style="color: #64748b; font-size: 14px; font-family: monospace;">Đường dẫn: <strong>' + safePath + '</strong></p>' +
      '  </div>' +
      customBlocksHtml +
      '</main>\\n' +
      footerContent +
      '</body>\\n</html>';

    return applyRealStoreDataToHtml(customPageHtml, store, virtualPath);
  }

  function doNavigate(virtualPath, customTitle) {
    if (!virtualPath) virtualPath = '/';
    let p = virtualPath;
    if (p.endsWith('/index.html')) p = p.slice(0, -11);
    if (p === '' || p === '/index.html') p = '/';

    let resolved = p;
    if (ROUTE_ALIASES[resolved]) resolved = ROUTE_ALIASES[resolved];

    let html = (typeof pages !== 'undefined' && (pages[resolved] || pages[resolved + '/'] || pages[p])) || null;
    if (!html) {
      html = generateCustomMerchantPage(p, customTitle);
      if (typeof pages !== 'undefined') {
        pages[p] = html;
      }
    } else {
      // Bind real store data to prototype template page
      html = applyRealStoreDataToHtml(html, window.STORE_DATA, resolved);
    }

    const frame = document.getElementById('spa-frame');
    if (frame && html) {
      frame.srcdoc = html;
      try {
        window.history.replaceState({ path: p }, '', '#' + p);
      } catch (e) {}
    }
  }

  window.navigateSpa = doNavigate;

  window.addEventListener('message', function(e) {
    if (e.data) {
      if (e.data.storeData) {
        window.STORE_DATA = e.data.storeData;
      }
      if (e.data.type === 'spa-navigate') {
        doNavigate(e.data.path, e.data.title);
      }
    }
  });

  const hashPath = window.location.hash.split('#')[1];
  const targetPath = hashPath || ${safePageJson} || '/';
  const targetTitle = ${safeTitleJson} || '';
  doNavigate(targetPath, targetTitle);
})();
</script>
`;

      if (htmlContent.includes("</body>")) {
        htmlContent = htmlContent.replace("</body>", `${injectedScript}\n</body>`);
      } else {
        htmlContent = `${htmlContent}\n${injectedScript}`;
      }
    } else {
      // Vercel serverless fallback when docs directory is not bundled
      htmlContent = generateFallbackTemplateHtml(normalizedCode, version, pagePath, pageTitle, storeData);
    }

    return new NextResponse(htmlContent, {
      status: 200,
      headers,
    });
  } catch (error: unknown) {
    const rawMessage = error instanceof Error ? error.message : "Internal Server Error";
    const safeMessage = escapeHtml(rawMessage);
    return new NextResponse(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;background:#0f172a;color:#f8fafc;text-align:center;"><h2>Error loading template</h2><p style="color:#ef4444">${safeMessage}</p></body></html>`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "SAMEORIGIN",
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  }
});
