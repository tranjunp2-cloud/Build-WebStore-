"use client";

import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import DOMPurify from "dompurify";
import { ReconciliationInspector } from "./ReconciliationInspector";
import { type ReconciliationScope, type ReconciliationSnapshot } from "@/lib/admin/qa/migration-reconciliation";
import {
  generateReconciliationCatalog,
  getFieldDiffRecordsForPage,
  getStoreDeepDiff,
  getDashboardMetrics,
  CANONICAL_TEMPLATES,
  getVisualDiffGapLabel,
  hasEntityDiffIssue,
  isStoreDomainSslReady,
  type StoreSummary,
  type StoreDeepDiff,
  type DynamicStorePage,
  type PageBlockItem,
  type EntityGroupType,
  type EntityDiffRecord,
  type FieldDiffItem,
} from "@/lib/admin/qa/migration-diff-engine";
import {
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LayoutTemplate,
  Sparkles,
  RefreshCw,
  Eye,
  CheckCheck,
  ArrowLeft,
  X,
  Store,
  ArrowRight,
  Database,
  Table as TableIcon,
  Globe,
  Check,
  Filter,
  SlidersHorizontal,
  Package,
  Tags,
  FolderTree,
  Newspaper,
  Settings,
  Grid,
  Compass,
  Link2,
  Image as ImageIcon,
  Code2,
  FileCode,
  CheckCircle,
  FileSpreadsheet,
  Monitor,
  Smartphone,
  Type as TypeIcon,
  ShieldCheck,
  Wrench,
  Layers as BlockTreeIcon,
  Star,
  ShoppingCart,
  Truck,
  Shield,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
} from "lucide-react";
import {
  BlockMigrationEvidence,
  Pw2EvidencePlaceholder,
} from "./BlockMigrationEvidence";
import type {
  BlockRenderEvidence,
  MigrationRenderEvidenceSnapshot,
} from "@/lib/admin/qa/migration-render-evidence";
import { deriveRenderEvidenceOverall } from "@/lib/admin/qa/migration-render-evidence";

/**
 * Renders authentic, high-fidelity visual layout components
 * simulating real e-commerce blocks for both PW1 and PW2 in Desktop & Mobile.
 */
function RichVisualBlockRenderer({
  block,
  version,
  deviceView,
}: {
  block: PageBlockItem;
  version: "pw1" | "pw2";
  deviceView: "desktop" | "mobile";
}) {
  const isPW1 = version === "pw1";
  const preview = isPW1 ? block.pw1Preview : block.pw2Preview;
  const isMobile = deviceView === "mobile";
  const isFail = block.status === "fail";
  const isWarn = block.status === "warn";

  const blockType = block.blockType || "banner";
  const titleLower = block.title.toLowerCase();

  // 1. HERO / BANNER BLOCK
  if (
    blockType === "hero" ||
    blockType === "banner" ||
    titleLower.includes("banner") ||
    titleLower.includes("hero")
  ) {
    return (
      <div
        className={`w-full rounded-2xl overflow-hidden border relative ${
          isPW1
            ? "border-amber-500/30"
            : isFail
            ? "border-rose-500/40"
            : "border-sky-500/30"
        } min-h-[200px] flex flex-col justify-between p-5 bg-cover bg-center shadow-lg transition`}
        style={{
          backgroundImage: preview.imageUrl
            ? `linear-gradient(to right, rgba(10, 15, 30, 0.82) 0%, rgba(10, 15, 30, 0.45) 55%, rgba(10, 15, 30, 0.75) 100%), url(${preview.imageUrl})`
            : "linear-gradient(to bottom right, #0f172a, #020617)",
        }}
      >
        {/* Top bar info */}
        <div className="flex items-center justify-between z-10">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border backdrop-blur-md ${
              isPW1
                ? "bg-amber-500/30 text-amber-200 border-amber-500/40"
                : "bg-sky-500/30 text-sky-200 border-sky-500/40"
            }`}
          >
            <Sparkles className="size-3" /> {preview.badgeText || "BANNER CHÍNH"}
          </span>
          <span className="text-[10px] font-mono text-slate-300 bg-black/60 px-2 py-0.5 rounded border border-white/10 backdrop-blur-md">
            {isPW1 ? `PW1: ${block.pw1Component}` : `PW2: ${block.pw2Block}`}
          </span>
        </div>

        {/* Content in center */}
        <div className="space-y-1.5 max-w-md py-3 z-10">
          <h4
            className={`font-serif font-bold text-white tracking-wide leading-tight ${
              isMobile ? "text-sm" : "text-lg sm:text-xl"
            }`}
          >
            {preview.headline || block.title}
          </h4>
          {preview.subheadline && (
            <p className="text-slate-200 text-xs font-sans tracking-wide uppercase">
              {preview.subheadline}
            </p>
          )}
        </div>

        {/* Bottom Controls / Button */}
        <div className="flex items-center justify-between z-10 pt-2 border-t border-white/10">
          <button className="px-3.5 py-1.5 rounded bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs shadow-md transition flex items-center gap-1.5">
            <span>{preview.buttonText || "Button"}</span>
          </button>
          <div className="flex items-center gap-1 text-slate-300">
            <span className="size-6 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-xs hover:bg-black/80 cursor-pointer">
              ‹
            </span>
            <span className="size-6 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-xs hover:bg-black/80 cursor-pointer">
              ›
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. BLOG / ARTICLES LISTING BLOCK
  if (
    blockType === "blog" ||
    titleLower.includes("bài viết") ||
    titleLower.includes("blog") ||
    titleLower.includes("article") ||
    titleLower.includes("tin tức")
  ) {
    const articles = preview.articleItems && preview.articleItems.length > 0
      ? preview.articleItems
      : [
          {
            id: 1,
            title: "11 Things the Media Hasn't Told You About Art 1",
            date: "19 May 2022",
            summary: "The weather started getting rough - the tiny ship was tossed.",
            image: "https://tm-prime-web.sgp1.digitaloceanspaces.com/tm-prime-web/images/templates/t010-6-1/blogs/blog-1.jpg"
          },
          {
            id: 2,
            title: "Don't Fall Prey to These Common Art Scams",
            date: "19 May 2022",
            summary: "Lorem ipsum dolor sit amet, eum eu labitur consetetur, ei paulo.",
            image: "https://tm-prime-web.sgp1.digitaloceanspaces.com/tm-prime-web/images/templates/t010-6-1/blogs/blog-2.jpg"
          },
          {
            id: 3,
            title: "Apple iPhone 16 Review: A Good Update… For Some",
            date: "25 Feb 2025",
            summary: "Apple iPhone 16 Review: A Good Update… For Some",
            image: "https://tm-prime-web-dev.sgp1.digitaloceanspaces.com/tm-primeweb-dev/img/2025/5Vta1gxfTdexfoD2VJG9ahU_MpOaurhyXHpu6U44oFU.webp"
          }
        ];

    return (
      <div className="space-y-3">
        <div className="text-center py-1">
          <h3 className="font-serif font-bold text-white text-base sm:text-lg">
            {preview.headline || "Our articles"}
          </h3>
        </div>

        <div className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3"}`}>
          {articles.map((art: any, aIdx: number) => (
            <div
              key={aIdx}
              className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between shadow-md group hover:border-slate-700 transition"
            >
              {art.image ? (
                <div
                  className="w-full h-28 bg-cover bg-center border-b border-slate-800"
                  style={{ backgroundImage: `url(${art.image})` }}
                />
              ) : (
                <div className="w-full h-28 bg-slate-800 flex items-center justify-center text-slate-500">
                  <Newspaper className="size-6 text-slate-600" />
                </div>
              )}
              <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <Calendar className="size-3 text-slate-500" />
                    <span>{art.date || "19 May 2022"}</span>
                  </div>
                  <h5 className="font-serif font-bold text-white text-xs leading-snug line-clamp-2">
                    {art.title}
                  </h5>
                  <p className="text-slate-400 text-[10px] line-clamp-2 leading-relaxed">
                    {art.summary}
                  </p>
                </div>
                <div className="pt-2 text-[10px] font-semibold text-sky-400 flex items-center gap-1 group-hover:underline">
                  <span>Read more</span> <ArrowRight className="size-2.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 3. PRODUCT GRID / VARIANTS BLOCK
  if (
    blockType === "products" ||
    blockType === "variants" ||
    titleLower.includes("sản phẩm") ||
    titleLower.includes("product") ||
    titleLower.includes("lưới")
  ) {
    const pCards = preview.productCards && preview.productCards.length > 0
      ? preview.productCards
      : [
          { id: 1, name: "Spring Leaf girls round neck sleeveless tops", price: "$16.52", sku: "A001", image: "https://tm-prime-web.sgp1.digitaloceanspaces.com/tm-prime-web/images/templates/t006/2017/06/mg5076thumb.jpg" },
          { id: 2, name: "BabyGap plain T-shirt", price: "$36.71", sku: "A003", image: "https://tm-prime-web.sgp1.digitaloceanspaces.com/tm-prime-web/images/templates/t006/2017/06/mg5038thumb.jpg" },
          { id: 3, name: "Boys shirt with Kangnam print", price: "$40.38", sku: "A004", image: "https://tm-prime-web.sgp1.digitaloceanspaces.com/tm-prime-web/images/templates/t006/2017/06/mg5082thumb.jpg" }
        ];

    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="font-bold text-white text-xs flex items-center gap-1.5 font-serif">
            <Package className="size-3.5 text-blue-400" />
            <span>{preview.headline || "Featured Products"}</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {preview.productCount !== undefined ? `${preview.productCount} Sản Phẩm` : `${pCards.length} Sản Phẩm`}
          </span>
        </div>

        <div className={`grid gap-2.5 ${isMobile ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
          {pCards.slice(0, 3).map((prod: any, pIdx: number) => (
            <div
              key={pIdx}
              className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 space-y-1.5 flex flex-col justify-between shadow-sm hover:border-slate-700 transition"
            >
              <div
                className="w-full aspect-square bg-slate-800/80 rounded-lg bg-cover bg-center relative overflow-hidden"
                style={{ backgroundImage: prod.image ? `url(${prod.image})` : undefined }}
              >
                {!prod.image && (
                  <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                    No Image
                  </div>
                )}
                <span className="absolute top-1 left-1 text-[8px] font-bold bg-black/60 text-amber-300 border border-white/10 px-1 rounded backdrop-blur-sm">
                  {prod.sku}
                </span>
              </div>
              <div>
                <div className="font-semibold text-white text-[11px] truncate" title={prod.name}>
                  {prod.name}
                </div>
                <div className="font-bold text-sky-400 text-xs mt-0.5">{prod.price}</div>
              </div>
              <button className="w-full py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold rounded-lg border border-slate-700 transition">
                + Add To Cart
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 3. FILTER / SORT CONTROLS
  if (
    blockType === "filter" ||
    titleLower.includes("bộ lọc") ||
    titleLower.includes("sắp xếp") ||
    titleLower.includes("filter") ||
    titleLower.includes("sort")
  ) {
    return (
      <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-1.5 font-semibold font-serif">
            <SlidersHorizontal className="size-3.5 text-blue-400" />
            <span>{preview.headline || "Bộ Lọc & Sắp Xếp Sản Phẩm"}</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Sắp xếp: Mới nhất ▾</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[10px] font-semibold shadow-sm">
            Tất Cả (50)
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-800">
            👗 Fashion
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-800">
            🧒 Kid
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-800">
            👔 Men
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-800">
            👠 Women
          </span>
        </div>
      </div>
    );
  }

  // 3.5. SHOPPING CART BLOCK
  if (
    blockType === "cart" ||
    titleLower.includes("cart") ||
    titleLower.includes("giỏ hàng")
  ) {
    return (
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="font-bold text-white text-xs flex items-center gap-1.5 font-serif">
            <ShoppingCart className="size-3.5 text-sky-400" />
            <span>{preview.headline || "Your Shopping Cart"}</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">2 Sản phẩm trong giỏ</span>
        </div>

        {/* Cart items */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="size-10 rounded bg-slate-800 flex items-center justify-center text-slate-400 font-mono text-sm">
                👗
              </div>
              <div>
                <div className="font-semibold text-white text-[11px]">Spring Leaf girls round neck sleeveless tops</div>
                <div className="text-[10px] text-slate-400 font-mono">SKU: A001 • Size: M</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-sky-400 text-xs">$16.52</div>
              <div className="text-[10px] text-slate-400 font-mono">SL: 1</div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="size-10 rounded bg-slate-800 flex items-center justify-center text-slate-400 font-mono text-sm">
                👕
              </div>
              <div>
                <div className="font-semibold text-white text-[11px]">BabyGap plain T-shirt</div>
                <div className="text-[10px] text-slate-400 font-mono">SKU: A003 • Size: L</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-sky-400 text-xs">$36.71</div>
              <div className="text-[10px] text-slate-400 font-mono">SL: 1</div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-[10px]">Tạm tính: </span>
            <strong className="text-white font-bold text-xs">$53.23</strong>
          </div>
          <button className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition">
            Tiến Hành Thanh Toán ➔
          </button>
        </div>
      </div>
    );
  }

  // 3.6. ORDER TRACKING BLOCK
  if (
    blockType === "tracking" ||
    titleLower.includes("tracking") ||
    titleLower.includes("tra cứu")
  ) {
    return (
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="font-bold text-white text-xs flex items-center gap-1.5 font-serif">
            <Truck className="size-3.5 text-sky-400" />
            <span>{preview.headline || "Tra Cứu Đơn Hàng (Order Tracking)"}</span>
          </div>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
            Live Tracking
          </span>
        </div>

        {/* Search Input Box */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="size-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              readOnly
              value="ORD-2026-0205"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white outline-none font-mono"
            />
          </div>
          <button className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition">
            Tra Cứu
          </button>
        </div>

        {/* Progress Steps */}
        <div className="grid grid-cols-4 gap-1 text-center pt-2">
          <div className="space-y-1">
            <div className="size-6 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center mx-auto">✓</div>
            <div className="text-[10px] text-white font-semibold">Đã Đặt Hàng</div>
          </div>
          <div className="space-y-1">
            <div className="size-6 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center mx-auto">✓</div>
            <div className="text-[10px] text-white font-semibold">Đã Xác Nhận</div>
          </div>
          <div className="space-y-1">
            <div className="size-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center mx-auto animate-pulse">🚚</div>
            <div className="text-[10px] text-sky-400 font-semibold">Đang Giao Hàng</div>
          </div>
          <div className="space-y-1">
            <div className="size-6 rounded-full bg-slate-800 text-slate-500 font-bold text-xs flex items-center justify-center mx-auto">4</div>
            <div className="text-[10px] text-slate-500">Đã Giao</div>
          </div>
        </div>
      </div>
    );
  }

  // 4. CATEGORIES / COLLECTION HIGHLIGHTS
  if (
    blockType === "categories" ||
    titleLower.includes("danh mục") ||
    titleLower.includes("category")
  ) {
    const catCards = preview.categoryCards && preview.categoryCards.length > 0
      ? preview.categoryCards
      : [
          { id: 1, name: "Fashion", ctaText: "Shop now", image: undefined },
          { id: 2, name: "Kid", ctaText: "Shop now", image: undefined },
          { id: 3, name: "Men", ctaText: "Shop now", image: undefined },
        ];

    return (
      <div className="space-y-3">
        <div className="text-center py-1">
          <h4 className="font-serif font-bold text-white text-xs sm:text-sm leading-snug line-clamp-2">
            {preview.headline || "Categories"}
          </h4>
        </div>

        <div className={`grid gap-2.5 ${isMobile ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
          {catCards.slice(0, 3).map((cat: any, cIdx: number) => (
            <div
              key={cIdx}
              className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between hover:border-slate-700 transition"
            >
              {cat.image ? (
                <div
                  className="w-full h-24 bg-cover bg-center border-b border-slate-800 relative"
                  style={{ backgroundImage: `url(${cat.image})` }}
                />
              ) : (
                <div className="w-full h-24 bg-slate-800 flex items-center justify-center text-slate-500 border-b border-slate-800">
                  <Grid className="size-6 text-slate-600" />
                </div>
              )}
              <div className="p-2.5 text-center space-y-1.5">
                <div className="font-serif font-bold text-white text-[11px] truncate" title={cat.name}>
                  {cat.name}
                </div>
                <button className="w-full py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 text-[10px] font-semibold rounded-lg border border-slate-700 transition">
                  {cat.ctaText || "Explore now"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 5. RICHTEXT / CONTENT BLOCK
  if (
    blockType === "richtext" ||
    titleLower.includes("richtext") ||
    titleLower.includes("nội dung") ||
    titleLower.includes("văn bản")
  ) {
    const isEmpty = !preview.bodyText || preview.bodyText.includes("[Khối Trống") || preview.bodyText.includes("Chưa nhập");

    return (
      <div
        className={`p-4 rounded-xl border space-y-2.5 ${
          isEmpty
            ? "bg-slate-950/60 border-dashed border-slate-800"
            : !isPW1 && isFail
            ? "bg-rose-950/20 border-rose-500/40"
            : "bg-slate-950 border-slate-800"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="font-bold text-white text-xs flex items-center gap-1.5 font-serif">
            <FileCode className="size-3.5 text-indigo-400" />
            <span>{preview.headline || "Rich Text Content"}</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            {isPW1 ? `PW1: ${block.pw1Component}` : `PW2: ${block.pw2Block}`}
          </span>
        </div>

        {isEmpty ? (
          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800/80 text-center space-y-1">
            <div className="text-xs text-slate-400 font-medium">
              📝 Khối Rich Text này đang để trống trong CSDL
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              (Người dùng tạo khối trong layout nhưng chưa nhập văn bản — Khớp 100% rỗng)
            </div>
          </div>
        ) : (
          <div className="text-slate-300 text-xs leading-relaxed space-y-1.5">
            <div className="text-[11px] text-slate-400 font-mono">{preview.subheadline}</div>
            <div
              className="p-4 bg-slate-900/90 rounded-xl border border-slate-800 font-sans text-xs text-slate-200 prose prose-invert max-w-none overflow-hidden [&_img]:max-h-60 [&_img]:rounded-lg [&_img]:mx-auto [&_iframe]:w-full [&_iframe]:rounded-lg [&_a]:text-blue-400 [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(preview.bodyText || "") }}
            />
          </div>
        )}
      </div>
    );
  }

  // 6. FOOTER BLOCK
  if (
    blockType === "footer" ||
    titleLower.includes("footer") ||
    titleLower.includes("chân trang")
  ) {
    return (
      <div
        className={`p-4 rounded-xl border space-y-3 ${
          !isPW1 && isWarn
            ? "bg-amber-950/20 border-amber-500/40"
            : "bg-slate-950 border-slate-800"
        }`}
      >
        <div
          className={`grid gap-3 text-[10px] ${
            isMobile ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"
          }`}
        >
          <div className="space-y-1">
            <div className="font-bold text-white text-[11px]">{preview.headline || "Store Farm"}</div>
            <div className="text-slate-400">📞 1900 6868</div>
            <div className="text-slate-400">📍 Hà Nội & TP.HCM</div>
          </div>
          <div className="space-y-1">
            <div className="font-bold text-white text-[11px]">Về Chúng Tôi</div>
            <div className="text-slate-400">Giới thiệu cửa hàng</div>
            <div className="text-slate-400">Hệ thống phân phối</div>
          </div>
          <div className="space-y-1">
            <div className="font-bold text-white text-[11px]">Hỗ Trợ</div>
            <div className="text-slate-400">Chính sách đổi trả</div>
            <div className="text-slate-400">Bảo mật thông tin</div>
          </div>
          <div className="space-y-1">
            <div className="font-bold text-white text-[11px]">Thanh Toán</div>
            <div className="flex gap-1 pt-0.5">
              <span className="px-1 py-0.5 bg-slate-900 border border-slate-800 rounded text-[9px] text-slate-300">
                VISA
              </span>
              <span className="px-1 py-0.5 bg-slate-900 border border-slate-800 rounded text-[9px] text-slate-300">
                MOMO
              </span>
            </div>
            {!isPW1 && isWarn ? (
              <div className="text-amber-400 text-[9px] font-mono mt-1">⚠️ Thiếu Iframe Map</div>
            ) : (
              <div className="text-emerald-400 text-[9px]">🗺️ Bản đồ Google Map</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 7. DEFAULT GENERIC VISUAL BLOCK
  return (
    <div
      className={`p-4 rounded-xl border space-y-2 ${
        isPW1
          ? "bg-slate-950 border-amber-500/20"
          : isFail
          ? "bg-rose-950/20 border-rose-500/30"
          : isWarn
          ? "bg-amber-950/20 border-amber-500/30"
          : "bg-slate-950 border-slate-800"
      }`}
    >
      <div className="flex items-center justify-between">
        <h5 className="font-bold text-white text-xs">{preview.headline || block.title}</h5>
        {preview.badgeText && (
          <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {preview.badgeText}
          </span>
        )}
      </div>
      {preview.subheadline && (
        <p className="text-slate-300 text-[11px] leading-relaxed">{preview.subheadline}</p>
      )}
      {preview.bodyText && (
        <div className="text-slate-300 text-[11px] leading-relaxed bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
          {preview.bodyText}
        </div>
      )}
    </div>
  );
}

function PW2DiffGapOverlay({
  block,
  enabled,
}: {
  block: PageBlockItem;
  enabled: boolean;
}) {
  const label = enabled ? getVisualDiffGapLabel(block.status, block.discrepancyNote) : null;
  if (!label) return null;

  return (
    <div
      aria-label={`Highlight Diff Gaps: ${label}`}
      className="pointer-events-none absolute inset-0 z-10 rounded-2xl border-2 border-rose-400 bg-rose-500/10 ring-2 ring-rose-400/30 animate-pulse"
    >
      <span className="absolute right-2 top-2 rounded-full border border-rose-300/70 bg-rose-600 px-2 py-1 text-[10px] font-bold text-white shadow-lg">
        Highlight Diff Gaps · {label}
      </span>
    </div>
  );
}

/**
 * Split Swipe Slider comparison with smooth CSS clip-path overlay
 */
function SwipeSliderBlockRenderer({
  block,
  deviceView,
  sliderPosition,
  highlightDiffGaps,
}: {
  block: PageBlockItem;
  deviceView: "desktop" | "mobile";
  sliderPosition: number;
  highlightDiffGaps: boolean;
}) {
  const isMobile = deviceView === "mobile";
  const [localPos, setLocalPos] = useState(sliderPosition);

  useEffect(() => {
    setLocalPos(sliderPosition);
  }, [sliderPosition]);

  return (
    <div className={`space-y-2.5 ${isMobile ? "max-w-[390px] mx-auto" : ""}`}>
      {/* Slider Header Control */}
      <div className="flex items-center justify-between text-xs px-1 select-none">
        <span className="font-mono text-amber-400 font-bold flex items-center gap-1">
          <span>👈 Bản Gốc PW1 ({100 - localPos}%)</span>
        </span>
        <span className="font-mono text-sky-400 font-bold flex items-center gap-1">
          <span>👉 Bản Mới PW2 ({localPos}%)</span>
        </span>
      </div>

      {/* Interactive Range Input */}
      <div className="px-1">
        <input
          type="range"
          min="0"
          max="100"
          value={localPos}
          onChange={(e) => setLocalPos(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-ew-resize accent-blue-500"
        />
      </div>

      {/* Clipped Overlaid Containers */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950 shadow-2xl min-h-[140px]">
        {/* Underlay Layer: PW1 */}
        <div className="w-full">
          <RichVisualBlockRenderer block={block} version="pw1" deviceView={deviceView} />
        </div>

        {/* Overlay Layer: PW2 Clipped via CSS */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            clipPath: `polygon(${localPos}% 0, 100% 0, 100% 100%, ${localPos}% 100%)`,
          }}
        >
          <RichVisualBlockRenderer block={block} version="pw2" deviceView={deviceView} />
          <PW2DiffGapOverlay block={block} enabled={highlightDiffGaps} />
        </div>

        {/* Draggable Vertical Splitter Line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)] pointer-events-none z-20"
          style={{ left: `${localPos}%` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-7 bg-white text-slate-950 rounded-full shadow-xl flex items-center justify-center text-[10px] font-bold border-2 border-blue-600 cursor-ew-resize pointer-events-auto">
            ↔
          </div>
        </div>
      </div>
    </div>
  );
}

export function MigrationDiffClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [catalog, setCatalog] = useState<StoreSummary[]>(() => generateReconciliationCatalog(2000));
  const metrics = useMemo(() => getDashboardMetrics(catalog), [catalog]);

  // Overview Table Filters
  const [filterStatus, setFilterStatus] = useState<"all" | "passed" | "warning" | "failed">("all");
  const [filterTemplate, setFilterTemplate] = useState<string>("all");
  const selectedTemplateObj = useMemo(() => {
    if (filterTemplate === "all") return null;
    return CANONICAL_TEMPLATES.find((t) => t.code === filterTemplate) || null;
  }, [filterTemplate]);
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
  const templateDropdownRef = React.useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [deviceView, setDeviceView] = useState<"desktop" | "mobile">("desktop");
  const [isDeviceDropdownOpen, setIsDeviceDropdownOpen] = useState(false);
  const deviceDropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(event.target as Node)) {
        setIsTemplateDropdownOpen(false);
      }
      if (deviceDropdownRef.current && !deviceDropdownRef.current.contains(event.target as Node)) {
        setIsDeviceDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Detail Modal States
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [parityMode, setParityMode] = useState<"dual_window" | "swipe_slider">("dual_window");
  const [showDiffGaps, setShowDiffGaps] = useState(false);
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [activeViewTab, setActiveViewTab] = useState<"visual_stream" | "live_webview" | "field_diff" | "media_audit" | "text_audit" | "commerce_reconciliation" | "settings_reconciliation">("live_webview");
  const [reconciliationSnapshot, setReconciliationSnapshot] = useState<ReconciliationSnapshot | null>(null);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [reconciliationError, setReconciliationError] = useState<string | null>(null);
  const [reconciliationDemo, setReconciliationDemo] = useState(false);
  const [previewSource, setPreviewSource] = useState<"template" | "live_domain">("template");
  const [iframeReloadKey, setIframeReloadKey] = useState(0);
  const pw1DeskIframeRef = React.useRef<HTMLIFrameElement>(null);
  const reconciliationRequestRef = React.useRef(0);
  const pw2DeskIframeRef = React.useRef<HTMLIFrameElement>(null);
  const pw1MobIframeRef = React.useRef<HTMLIFrameElement>(null);
  const pw2MobIframeRef = React.useRef<HTMLIFrameElement>(null);
  const [activeEntityGroup, setActiveEntityGroup] = useState<"all" | EntityGroupType>("all");
  const [fieldSearchQuery, setFieldSearchQuery] = useState("");
  const [resolvedStoreIds, setResolvedStoreIds] = useState<Set<string>>(new Set());
  const [isReloading, setIsReloading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [renderEvidence, setRenderEvidence] =
    useState<MigrationRenderEvidenceSnapshot | null>(null);
  const [isRenderEvidenceLoading, setIsRenderEvidenceLoading] = useState(false);
  const [renderEvidenceError, setRenderEvidenceError] = useState<string | null>(null);
  const [useDemoRenderEvidence, setUseDemoRenderEvidence] = useState(false);
  const [liveCheckBlockId, setLiveCheckBlockId] = useState<string | null>(null);

  // Live Database Modal States
  const [dbModalOpen, setDbModalOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState<{
    connected: boolean;
    message: string;
    database?: string;
    serverVersion?: string;
    tablesCount?: number;
    latencyMs?: number;
    tables?: string[];
  } | null>(null);
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [customDbUrl, setCustomDbUrl] = useState("");
  const [customDbHost, setCustomDbHost] = useState("");
  const [customDbPort, setCustomDbPort] = useState("3306");
  const [customDbUser, setCustomDbUser] = useState("");
  const [customDbPassword, setCustomDbPassword] = useState("");
  const [customDbName, setCustomDbName] = useState("");
  const [useSeparateFields, setUseSeparateFields] = useState(false);

  const checkLiveDbStatus = async () => {
    try {
      const res = await fetch("/api/qa/migration-diff?mode=db_status");
      const json = await res.json();
      if (json.data) setDbStatus(json.data);
    } catch (err) {
      console.error("[MigrationDiffClient] Failed to check live DB status:", err);
    }
  };

  useEffect(() => {
    void checkLiveDbStatus();
  }, []);

  const handleTestDbConnection = async () => {
    setIsTestingDb(true);
    try {
      const config = useSeparateFields
        ? {
            host: customDbHost.trim(),
            port: parseInt(customDbPort.trim() || "3306", 10),
            user: customDbUser.trim(),
            password: customDbPassword,
            database: customDbName.trim(),
          }
        : customDbUrl.trim()
          ? { url: customDbUrl.trim() }
          : undefined;

      const res = await fetch("/api/qa/migration-diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_db_connection",
          config,
        }),
      });
      const json = await res.json();
      if (json.data) {
        setDbStatus(json.data);
        if (json.data.connected) {
          showToast(`🟢 Kết nối Live MySQL thành công! Đã tìm thấy ${json.data.tablesCount} bảng.`);
        } else {
          showToast(`🔴 Không thể kết nối: ${json.data.message}`);
        }
      }
    } catch (err: any) {
      showToast(`🔴 Lỗi kiểm tra: ${err.message || String(err)}`);
    } finally {
      setIsTestingDb(false);
    }
  };

  const [liveStoreDiff, setLiveStoreDiff] = useState<StoreDeepDiff | null>(null);

  const loadLiveCatalog = async () => {
    try {
      const res = await fetch(`/api/qa/migration-diff?limit=2000&_t=${Date.now()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json.stores && json.stores.length > 0) {
        setCatalog(json.stores);
      }
    } catch (err) {
      console.error("[MigrationDiffClient] Failed to load live catalog:", err);
    }
  };

  useEffect(() => {
    void loadLiveCatalog();
  }, []);

  useEffect(() => {
    if (!activeStoreId) {
      setLiveStoreDiff(null);
      return;
    }
    const fetchDiff = async () => {
      try {
        const res = await fetch(`/api/qa/migration-diff?store_id=${encodeURIComponent(activeStoreId)}&_t=${Date.now()}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (json.data) {
          setLiveStoreDiff(json.data);
        }
      } catch (err) {
        console.error("[MigrationDiffClient] Failed to fetch deep diff, falling back:", err);
      }
    };
    void fetchDiff();
  }, [activeStoreId]);

  useEffect(() => {
    const scope: ReconciliationScope | null = activeViewTab === "commerce_reconciliation" ? "commerce" : activeViewTab === "settings_reconciliation" ? "settings" : null;
    if (!scope || !activeStoreId) return;
    const controller = new AbortController();
    const requestId = ++reconciliationRequestRef.current;
    const load = async () => { setReconciliationSnapshot(null); setReconciliationLoading(true); setReconciliationError(null); try { const response = await fetch(`/api/qa/migration-reconciliation?scope=${scope}&store_id=${encodeURIComponent(activeStoreId)}${reconciliationDemo ? "&demo=1" : ""}`, { cache: "no-store", signal: controller.signal }); if (!response.ok) throw new Error(`HTTP ${response.status}`); const payload: { data?: ReconciliationSnapshot } = await response.json(); if (payload.data?.scope !== scope || payload.data.storeId !== activeStoreId) throw new Error("Phản hồi đối soát không khớp store hoặc phạm vi đang chọn"); if (!controller.signal.aborted && requestId === reconciliationRequestRef.current) setReconciliationSnapshot(payload.data); } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError") && requestId === reconciliationRequestRef.current) { setReconciliationSnapshot(null); setReconciliationError(error instanceof Error ? error.message : "Lỗi không xác định"); } } finally { if (!controller.signal.aborted && requestId === reconciliationRequestRef.current) setReconciliationLoading(false); } };
    void load(); return () => controller.abort();
  }, [activeStoreId, activeViewTab, reconciliationDemo]);

  const selectedDiff: StoreDeepDiff | null = useMemo(() => {
    if (!activeStoreId) return null;
    if (liveStoreDiff && liveStoreDiff.id === activeStoreId) return liveStoreDiff;
    const isResolved = resolvedStoreIds.has(activeStoreId);
    const catalogStore = catalog.find((s) => s.id === activeStoreId);
    const diff = getStoreDeepDiff(activeStoreId, isResolved ? "passed" : undefined);
    if (diff && catalogStore) {
      return {
        ...diff,
        name: catalogStore.name || diff.name,
        templateCode: catalogStore.templateCode || diff.templateCode,
        templateName: catalogStore.templateName || diff.templateName,
        domain: catalogStore.domain || diff.domain,
      };
    }
    return diff;
  }, [activeStoreId, resolvedStoreIds, liveStoreDiff, catalog]);

  const activePage = selectedDiff?.pages[activePageIndex] || selectedDiff?.pages[0];

  useEffect(() => {
    if (!activeStoreId || !activePage) {
      setRenderEvidence(null);
      setRenderEvidenceError(null);
      setIsRenderEvidenceLoading(false);
      return;
    }

    const controller = new AbortController();
    const loadEvidence = async () => {
      setRenderEvidence(null);
      setLiveCheckBlockId(null);
      setIsRenderEvidenceLoading(true);
      setRenderEvidenceError(null);
      try {
        const params = new URLSearchParams({
          store_id: activeStoreId,
          page_id: activePage.id,
          demo: useDemoRenderEvidence ? "1" : "0",
        });
        const response = await fetch(`/api/qa/migration-render-evidence?${params}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          data?: MigrationRenderEvidenceSnapshot;
          error?: string;
        };
        if (!response.ok || !payload.data) {
          throw new Error(payload.error || "Không tải được bằng chứng migration.");
        }
        if (!controller.signal.aborted) setRenderEvidence(payload.data);
      } catch (error) {
        if (controller.signal.aborted) return;
        setRenderEvidence(null);
        setRenderEvidenceError(
          error instanceof Error ? error.message : "Không tải được bằng chứng migration.",
        );
      } finally {
        if (!controller.signal.aborted) setIsRenderEvidenceLoading(false);
      }
    };
    void loadEvidence();
    return () => controller.abort();
  }, [activeStoreId, activePage?.id, useDemoRenderEvidence]);

  const evidenceByLegacyId = useMemo(
    () => new Map(renderEvidence?.blocks.map((item) => [item.legacyId, item]) ?? []),
    [renderEvidence],
  );

  // Dispatch smooth SPA navigation to live storefront iframes when user switches page tabs
  useEffect(() => {
    if (activePage && previewSource === "template") {
      const navMsg = {
        type: "spa-navigate",
        path: activePage.path,
        title: activePage.name,
        storeId: selectedDiff?.id,
      };
      try {
        pw1DeskIframeRef.current?.contentWindow?.postMessage(navMsg, "*");
        pw2DeskIframeRef.current?.contentWindow?.postMessage(navMsg, "*");
        pw1MobIframeRef.current?.contentWindow?.postMessage(navMsg, "*");
        pw2MobIframeRef.current?.contentWindow?.postMessage(navMsg, "*");
      } catch (e) {
        console.warn("[MigrationDiffClient] postMessage failed:", e);
      }
    }
  }, [activePageIndex, activePage, previewSource, selectedDiff?.id]);

  // Default preview source to 'live_domain' if SSL is verified and ready, otherwise use 'template' (authentic MySQL prototype).
  useEffect(() => {
    if (selectedDiff?.id) {
      if (isStoreDomainSslReady(selectedDiff)) {
        setPreviewSource("live_domain");
      } else {
        setPreviewSource("template");
      }
    }
  }, [selectedDiff?.id, selectedDiff?.domain, selectedDiff?.sslReady]);

  // Lock background body scroll and listen for Escape key when inspection modal is active
  useEffect(() => {
    if (activeStoreId) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setActiveStoreId(null);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [activeStoreId]);

  // Filter logic for overview table (Email, Domain, Site ID, Template, Name)
  const filteredStores = useMemo(() => {
    const rawQ = searchQuery.trim().toLowerCase();
    // Normalize URL/Domain search if user pastes full URL or domain
    const cleanQ = rawQ.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");

    return catalog.filter((s) => {
      const matchStatus = filterStatus === "all" || s.status === filterStatus;
      const matchTpl = filterTemplate === "all" || s.templateCode === filterTemplate;

      const matchSearch =
        !cleanQ ||
        s.ownerEmail.toLowerCase().includes(cleanQ) ||
        s.domain.toLowerCase().includes(cleanQ) ||
        s.id.toLowerCase().includes(cleanQ) ||
        s.name.toLowerCase().includes(cleanQ) ||
        s.subdomain1.toLowerCase().includes(cleanQ) ||
        s.subdomain2.toLowerCase().includes(cleanQ) ||
        s.templateCode.toLowerCase().includes(cleanQ) ||
        s.templateName.toLowerCase().includes(cleanQ);

      return matchStatus && matchTpl && matchSearch;
    });
  }, [catalog, filterStatus, filterTemplate, searchQuery]);

  const totalPages = Math.ceil(filteredStores.length / pageSize) || 1;
  const paginatedStores = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStores.slice(start, start + pageSize);
  }, [filteredStores, currentPage, pageSize]);

  // Filtered Field Diff Records
  const filteredFieldRecords = useMemo(() => {
    if (!selectedDiff?.fieldDiffAudit?.records || !activePage) return [];
    return getFieldDiffRecordsForPage(selectedDiff.fieldDiffAudit, activePage.id).filter((r) => {
      const matchGroup = activeEntityGroup === "all" || r.entityGroup === activeEntityGroup;
      const matchErrors = !showOnlyErrors || hasEntityDiffIssue(r);
      const q = fieldSearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        r.entityName.toLowerCase().includes(q) ||
        r.entityIdentifier.toLowerCase().includes(q) ||
        String(r.legacyId).toLowerCase().includes(q) ||
        r.fields.some(
          (f) =>
            f.fieldLabel.toLowerCase().includes(q) ||
            f.legacyKey.toLowerCase().includes(q) ||
            f.migratedKey.toLowerCase().includes(q) ||
            String(f.legacyValue).toLowerCase().includes(q) ||
            String(f.migratedValue).toLowerCase().includes(q)
        );

      return matchGroup && matchErrors && matchSearch;
    });
  }, [selectedDiff, activePage?.id, activeEntityGroup, showOnlyErrors, fieldSearchQuery]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const requestLiveCheck = async (evidence: BlockRenderEvidence) => {
    if (!activeStoreId || !activePage) return;
    setLiveCheckBlockId(evidence.legacyId);
    try {
      const response = await fetch("/api/qa/migration-render-evidence/live-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: activeStoreId,
          page_id: activePage.id,
          legacy_id: evidence.legacyId,
        }),
      });
      const payload = (await response.json()) as {
        data?: {
          legacyId: string;
          status: "rendered" | "not_rendered" | "unverified";
          checkedAt: string | null;
          evidenceRef: string | null;
          reasonCode: string;
          message?: string;
        };
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Không thể yêu cầu live check.");
      if (!payload.data || payload.data.legacyId !== evidence.legacyId) {
        throw new Error("Kết quả live check không khớp với block đang kiểm tra.");
      }
      setRenderEvidence((snapshot) => {
        if (!snapshot || snapshot.storeId !== activeStoreId || snapshot.pageId !== activePage.id) return snapshot;
        return {
          ...snapshot,
          blocks: snapshot.blocks.map((block) => {
            if (block.legacyId !== evidence.legacyId) return block;
            const liveRender = {
              status: payload.data!.status,
              checkedAt: payload.data!.checkedAt,
              evidenceRef: payload.data!.evidenceRef,
              reasonCode: payload.data!.reasonCode,
            };
            return {
              ...block,
              liveRender,
              overall: deriveRenderEvidenceOverall({
                pw2Data: block.pw2Data,
                component: block.component,
                liveRender,
              }),
            };
          }),
        };
      });
      showToast(payload.data?.message || "Đã gửi yêu cầu live check.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể yêu cầu live check.");
    } finally {
      setLiveCheckBlockId(null);
    }
  };

  const handleReloadStoreData = async (storeId: string) => {
    setIsReloading(true);

    try {
      const res = await fetch(`/api/qa/migration-diff?store_id=${encodeURIComponent(storeId)}&_t=${Date.now()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setLiveStoreDiff(json.data);
          if (json.data.status === "passed") {
            setResolvedStoreIds((prev) => new Set([...prev, storeId]));
          } else {
            setResolvedStoreIds((prev) => {
              const next = new Set(prev);
              next.delete(storeId);
              return next;
            });
          }
          setCatalog((prev) =>
            prev.map((s) =>
              s.id === storeId
                ? {
                    ...s,
                    name: json.data.name || s.name,
                    score: json.data.score || s.score,
                    status: json.data.status || s.status,
                    failedBlocks: json.data.failedBlocks || [],
                    textScore: json.data.textScore || s.textScore,
                    mediaScore: json.data.mediaScore || s.mediaScore,
                    blockScore: json.data.blockScore || s.blockScore,
                    commerceScore: json.data.commerceScore || s.commerceScore,
                  }
                : s
            )
          );
        }
      }
    } catch (err) {
      console.error("[MigrationDiffClient] Failed to reload store diff:", err);
    } finally {
      setIframeReloadKey((k) => k + 1);
      setIsReloading(false);
      showToast("✓ Đã quét lại CSDL thành công! Dữ liệu PW1 và PW2 đã được đồng bộ mới nhất.");
    }
  };

  const handleApprovePass = (storeId: string) => {
    showToast(`Không thể duyệt QC Pass cho ${storeId}: cần bằng chứng xác minh toàn bộ website.`);
  };

  const scrollToBlock = (blockId: string) => {
    setSelectedBlockId(blockId);
    const element = document.getElementById(blockId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 md:p-8 space-y-6 font-sans animate-pulse">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 bg-slate-800 rounded-2xl" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-slate-800 rounded" />
              <div className="h-4 w-72 bg-slate-800/60 rounded" />
            </div>
          </div>
          <div className="flex gap-2.5">
            <div className="h-8 w-36 bg-slate-800 rounded-xl" />
            <div className="h-8 w-36 bg-slate-800 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 h-24 space-y-2">
              <div className="h-3 w-20 bg-slate-800 rounded" />
              <div className="h-7 w-16 bg-slate-800 rounded" />
            </div>
          ))}
        </div>
        <div className="h-96 rounded-2xl bg-slate-900/40 border border-slate-800/80" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 md:p-8 space-y-6 font-sans">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400/40 animate-bounce">
          <CheckCheck className="size-5" />
          <span className="font-semibold text-sm">{toastMsg}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
              <Layers className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Website Migration
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                So sánh trực quan <strong>2 Website Song Song (PW1 vs PW2)</strong> & <strong>Đối Soát Trường CSDL 1-to-1</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Database Status Indicators */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setDbModalOpen(true)}
            className={`flex items-center gap-2 border rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
              dbStatus?.connected
                ? "bg-emerald-950/60 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900/60"
                : "bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700"
            }`}
          >
            <span
              className={`size-2 rounded-full ${
                dbStatus?.connected ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            <span className="text-slate-400">
              {dbStatus?.connected ? (
                <>
                  PW1:{" "}
                  <strong className="text-emerald-400 font-mono font-medium">
                    Live MySQL ({dbStatus.tablesCount} bảng)
                  </strong>
                </>
              ) : (
                <>
                  Snapshot:{" "}
                  <strong className="text-emerald-400 font-mono font-medium">PW1 Audit Data</strong>
                </>
              )}
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded ml-0.5 font-mono">
              ⚙️
            </span>
          </button>
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 shadow-sm">
            <span className="size-2 rounded-full bg-sky-400" />
            <span className="text-slate-400">Target: <strong className="text-sky-400 font-mono font-medium">PW2 Next.js</strong></span>
          </div>
          <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] font-semibold text-amber-400">
            Audit Mode
          </span>
          <button
            type="button"
            onClick={() => {
              void checkLiveDbStatus();
              void loadLiveCatalog();
              showToast("Đã làm mới dữ liệu đối soát cho toàn bộ website!");
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-xl border border-slate-700/80 transition shadow-sm"
          >
            <RefreshCw className="size-3.5 text-slate-400" />
            <span>Làm Mới Đối Soát</span>
          </button>
        </div>
      </div>

      {/* 5 Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div
          onClick={() => setFilterStatus("all")}
          className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
            filterStatus === "all"
              ? "bg-slate-900 border-blue-500/80 shadow-[0_0_20px_-3px_rgba(59,130,246,0.2)] ring-1 ring-blue-500/40"
              : "bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80"
          }`}
        >
          <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Tổng Số Website</div>
          <div className="text-2xl font-bold text-white mt-1">{metrics.totalStores.toLocaleString()}</div>
          <div className="text-[11px] text-blue-400 mt-1 flex items-center gap-1 font-medium">
            <Sparkles className="size-3" /> 2.000 Website
          </div>
        </div>

        <div
          onClick={() => setFilterStatus("passed")}
          className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
            filterStatus === "passed"
              ? "bg-emerald-950/20 border-emerald-500/80 shadow-[0_0_20px_-3px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/40"
              : "bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80"
          }`}
        >
          <div className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">Khớp Chuẩn (≥95%)</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{metrics.passedStores}</div>
          <div className="text-[11px] text-emerald-400/80 mt-1 font-medium">Đủ điều kiện Cutover</div>
        </div>

        <div
          onClick={() => setFilterStatus("warning")}
          className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
            filterStatus === "warning"
              ? "bg-amber-950/20 border-amber-500/80 shadow-[0_0_20px_-3px_rgba(245,158,11,0.2)] ring-1 ring-amber-500/40"
              : "bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80"
          }`}
        >
          <div className="text-[11px] text-amber-400 font-semibold uppercase tracking-wider">Cần Xem Lại (85-94%)</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{metrics.warningStores}</div>
          <div className="text-[11px] text-amber-400/80 mt-1 font-medium">Lệch ảnh / Map / Text</div>
        </div>

        <div
          onClick={() => setFilterStatus("failed")}
          className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
            filterStatus === "failed"
              ? "bg-rose-950/20 border-rose-500/80 shadow-[0_0_20px_-3px_rgba(244,63,94,0.2)] ring-1 ring-rose-500/40"
              : "bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80"
          }`}
        >
          <div className="text-[11px] text-rose-400 font-semibold uppercase tracking-wider">Lỗi Dữ Liệu P0 (&lt;85%)</div>
          <div className="text-2xl font-bold text-rose-400 mt-1">{metrics.failedStores}</div>
          <div className="text-[11px] text-rose-400/80 mt-1 font-medium">Chặn Cutover</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/50">
          <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Độ Khớp Trung Bình</div>
          <div className="text-2xl font-bold text-sky-400 mt-1">{metrics.avgScore}</div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">Toàn bộ hệ thống</div>
        </div>
      </div>

      {/* Filter Hub & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800/80 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            {(["all", "passed", "warning", "failed"] as const).map((st) => (
              <button
                key={st}
                onClick={() => {
                  setFilterStatus(st);
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  filterStatus === st
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {st === "all" ? "Tất Cả" : st === "passed" ? "QC Pass" : st === "warning" ? "Cần Xem Lại" : "Lỗi P0"}
              </button>
            ))}
          </div>

          {/* Custom Template Filter Dropdown Popover */}
          <div className="relative" ref={templateDropdownRef}>
            <button
              type="button"
              onClick={() => setIsTemplateDropdownOpen((prev) => !prev)}
              className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border select-none ${
                filterTemplate !== "all"
                  ? "bg-blue-600/10 text-blue-400 border-blue-500/40 hover:bg-blue-600/20"
                  : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <LayoutTemplate className="size-3.5 text-blue-400 shrink-0" />
              <span>
                {selectedTemplateObj
                  ? `${selectedTemplateObj.code} — ${selectedTemplateObj.name}`
                  : "Tất Cả 9 Nhóm Giao Diện"}
              </span>
              <ChevronDown
                className={`size-3.5 text-slate-400 transition-transform duration-200 ${
                  isTemplateDropdownOpen ? "rotate-180 text-blue-400" : ""
                }`}
              />
            </button>

            {isTemplateDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-80 max-h-96 overflow-y-auto bg-slate-900/95 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-2xl z-50 p-1.5 space-y-0.5 ring-1 ring-white/10 scrollbar-thin">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1.5 border-b border-slate-800/60 mb-1">
                  Nhóm Giao Diện Gốc (PW1)
                </div>

                {/* Option All */}
                <button
                  type="button"
                  onClick={() => {
                    setFilterTemplate("all");
                    setIsTemplateDropdownOpen(false);
                    setCurrentPage(1);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                    filterTemplate === "all"
                      ? "bg-blue-600/20 text-blue-300 font-semibold border border-blue-500/30"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-blue-400" />
                    <span>Tất Cả 9 Nhóm Giao Diện Gốc</span>
                  </div>
                  {filterTemplate === "all" && <Check className="size-3.5 text-blue-400" />}
                </button>

                {/* 9 Canonical Template Options */}
                {CANONICAL_TEMPLATES.map((t) => {
                  const isSelected = filterTemplate === t.code;
                  return (
                    <button
                      key={t.code}
                      type="button"
                      onClick={() => {
                        setFilterTemplate(t.code);
                        setIsTemplateDropdownOpen(false);
                        setCurrentPage(1);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between transition ${
                        isSelected
                          ? "bg-blue-600/20 text-blue-300 font-semibold border border-blue-500/30"
                          : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 bg-slate-800 text-sky-400 rounded border border-slate-700">
                            {t.code}
                          </span>
                          <span className="font-bold text-white text-xs">{t.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 pl-0.5">{t.sector}</div>
                      </div>
                      {isSelected && <Check className="size-4 text-blue-400 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="relative w-full md:w-96">
          <Search className="size-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo Email khách hàng, Domain, Mã Site..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 transition shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setCurrentPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-md transition"
              title="Xóa tìm kiếm"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2,000 Stores Grid Table */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800 tracking-wider">
              <tr>
                <th className="py-3.5 px-4 whitespace-nowrap">Email Khách Hàng / Domain</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Giao Diện Mẫu</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Độ Khớp Dữ Liệu</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Trạng Thái QC</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Số Trang & Lỗi / Cảnh Báo</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Đối Soát Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {paginatedStores.map((store) => (
                <tr key={store.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-4 px-4 font-semibold text-white whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
                        {store.id}
                      </span>
                      <span className="text-slate-100 font-semibold">{store.ownerEmail}</span>
                    </div>
                    <div className="text-[12px] text-slate-400 font-normal font-mono mt-1 flex items-center gap-1.5">
                      <Globe className="size-3 text-slate-500 shrink-0" />
                      <span>{store.domain}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span className="font-bold text-slate-200">{store.templateCode}</span>
                    <div className="text-[11px] text-slate-400">{store.templateName}</div>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-white font-mono text-sm">{store.score}</span>
                      <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            store.status === "passed"
                              ? "bg-emerald-400"
                              : store.status === "warning"
                              ? "bg-amber-400"
                              : "bg-rose-500"
                          }`}
                          style={{ width: store.score }}
                        />
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 font-mono">
                      Văn Bản: {store.textScore} | Hình Ảnh: {store.mediaScore} | Bố Cục: {store.blockScore}
                    </div>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    {store.status === "passed" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                        <CheckCircle2 className="size-3.5" /> Khớp Chuẩn
                      </span>
                    )}
                    {store.status === "warning" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
                        <AlertTriangle className="size-3.5" /> Cần Xem Lại
                      </span>
                    )}
                    {store.status === "failed" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 whitespace-nowrap">
                        <AlertOctagon className="size-3.5" /> Lỗi P0 Blocker
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 border border-slate-700/50 px-2 py-0.5 rounded whitespace-nowrap">
                        {store.pageCount} Trang
                      </span>
                      {store.failedBlocks.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {store.failedBlocks.map((fb, idx) => (
                            <span
                              key={idx}
                              className={`text-[10px] px-2 py-0.5 rounded-md font-mono border whitespace-nowrap ${
                                store.status === "failed"
                                  ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
                                  : "bg-amber-500/10 text-amber-300 border-amber-500/20"
                              }`}
                            >
                              {fb}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 whitespace-nowrap">
                          <CheckCircle2 className="size-3.5" /> Khớp 100%
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => {
                        setLiveStoreDiff(null);
                        setActiveStoreId(store.id);
                        setActivePageIndex(0);
                        setSelectedBlockId(null);
                        setActiveViewTab("live_webview");
                        setPreviewSource(isStoreDomainSslReady(store) ? "live_domain" : "template");
                      }}
                      className="px-3.5 py-1.5 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 hover:border-blue-600 rounded-xl font-semibold text-xs transition-all shadow-sm flex items-center gap-1 ml-auto whitespace-nowrap"
                    >
                      <span>So Sánh</span>
                      <ChevronRight className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {paginatedStores.length === 0 && (
            <div className="p-12 text-center space-y-3">
              <div className="size-12 rounded-2xl bg-slate-800/80 border border-slate-700/80 mx-auto flex items-center justify-center text-slate-400">
                <Search className="size-6" />
              </div>
              <div className="text-sm font-semibold text-white">
                Không tìm thấy website nào khớp với từ khóa &ldquo;{searchQuery}&rdquo;
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Vui lòng kiểm tra lại Email khách hàng, Domain hoặc chuyển bộ lọc trạng thái sang &ldquo;Tất Cả&rdquo;.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                {filterStatus !== "all" && (
                  <button
                    onClick={() => setFilterStatus("all")}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-xl border border-slate-700 transition"
                  >
                    Bỏ lọc trạng thái (Tìm trong Tất Cả)
                  </button>
                )}
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-xl transition shadow-md shadow-blue-600/25"
                  >
                    Xóa từ khóa tìm kiếm
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950/90 text-xs text-slate-400">
          <div>
            Đang hiển thị <strong>{paginatedStores.length}</strong> / <strong>{filteredStores.length}</strong> website
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 transition"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="font-semibold text-slate-200 px-2">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 transition"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PROFESSIONAL DETAIL INSPECTOR MODAL WITH FULL 2-WEBSITE STREAM + FIELD DIFF */}
      {/* ========================================================================= */}
      {mounted && typeof document !== "undefined" && selectedDiff && activePage && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-store-title"
          className="fixed inset-0 z-[999999] bg-slate-950 flex flex-col p-0 md:p-3 overscroll-contain animate-in fade-in duration-200"
        >
          <div className="bg-slate-900 border border-slate-700/80 rounded-none md:rounded-3xl w-full h-full flex flex-col shadow-2xl overflow-hidden ring-1 ring-white/10">
            
            {/* Top Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3.5">
                <button
                  onClick={() => setActiveStoreId(null)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                  title="Quay lại danh sách"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-500 text-white rounded-xl shadow-md shadow-blue-500/20 ring-1 ring-white/20">
                  <Store className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 id="modal-store-title" className="text-lg font-bold text-white tracking-tight">{selectedDiff.name}</h2>
                    <span className="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
                      {selectedDiff.id}
                    </span>
                    <span className="text-xs text-slate-200 font-medium bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded-md">
                      📧 {selectedDiff.ownerEmail}
                    </span>
                    <span className="text-xs text-slate-300 font-mono bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                      <Globe className="size-3 text-slate-400" />
                      {selectedDiff.domain}
                    </span>
                    <span
                      className={`text-xs px-3 py-0.5 rounded-full font-semibold border ${
                        selectedDiff.status === "passed"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : selectedDiff.status === "warning"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}
                    >
                      {selectedDiff.status === "passed" ? "✓ QC Pass (99.8%)" : selectedDiff.status === "warning" ? "⚠️ Cần Xem Lại" : "🚨 Lỗi P0 Blocker"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                    <span>Gốc: <strong className="text-slate-200">{selectedDiff.templateCode} ({selectedDiff.templateName})</strong></span>
                    <span>•</span>
                    <span>Tổng số trang: <strong className="text-white">{selectedDiff.totalPagesInPW1} Trang</strong></span>
                    {selectedDiff.missingPagesCount > 0 && (
                      <span className="text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
                        🚨 Thiếu {selectedDiff.missingPagesCount} trang trên PW2
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Header Action Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Device View Mode Switcher (Desktop vs Mobile 375px) */}
                <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 shadow-inner select-none">
                  <button
                    type="button"
                    onClick={() => setDeviceView("desktop")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      deviceView === "desktop"
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                    title="Xem giao diện chuẩn Desktop (100% width)"
                  >
                    <Monitor className="size-3.5" />
                    <span>Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeviceView("mobile")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      deviceView === "mobile"
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                    title="Xem giả lập điện thoại Mobile (375px viewport)"
                  >
                    <Smartphone className="size-3.5" />
                    <span>Mobile (375px)</span>
                  </button>
                </div>

                <button
                  disabled={isReloading}
                  onClick={() => handleReloadStoreData(selectedDiff.id)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700/80 transition shadow-sm disabled:opacity-50"
                  title="Quét lại dữ liệu từ MySQL PW1 và Postgres PW2 sau khi Dev đã sửa"
                >
                  <RefreshCw className={`size-3.5 ${isReloading ? "animate-spin text-blue-400" : "text-slate-400"}`} />
                  <span>{isReloading ? "Đang Quét Lại..." : "Quét Lại CSDL"}</span>
                </button>
                <button
                  type="button"
                  disabled
                  onClick={() => handleApprovePass(selectedDiff.id)}
                  title="Chỉ mở khi có evidence xác minh đầy đủ cho toàn bộ website"
                  className="flex cursor-not-allowed items-center gap-1.5 rounded-xl bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-400 opacity-70"
                >
                  <CheckCircle2 className="size-4" />
                  <span>QC Pass chờ evidence</span>
                </button>
                <button
                  onClick={() => setActiveStoreId(null)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition border border-slate-700/60"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Navigation Bar: Page Selectors & Mode Switcher */}
            <div className="bg-slate-950 px-5 py-2.5 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
              {/* Page Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
                  <Globe className="size-3.5 text-blue-400" /> Trang:
                </span>
                {selectedDiff.pages.map((p, idx) => {
                  const hasErrors = !p.existsInPW2 || p.defects.some((d) => d.type === "p0");
                  const hasWarnings = p.defects.some((d) => d.type === "p1" || d.type === "p2") || p.blocks.some((b) => b.status === "warn");

                  return (
                    <button
                      key={p.id}
                      data-testid={`migration-page-tab-${p.id}`}
                      onClick={() => {
                        setActivePageIndex(idx);
                        setSelectedBlockId(null);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition whitespace-nowrap border ${
                        activePageIndex === idx
                          ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/25"
                          : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <span>{idx + 1}. {p.name}</span>
                      {!p.existsInPW2 ? (
                        <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-md font-bold animate-pulse">
                          THIẾU
                        </span>
                      ) : hasErrors ? (
                        <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-md font-bold">
                          LỖI
                        </span>
                      ) : hasWarnings ? (
                        <span className="bg-amber-500 text-slate-950 text-[9px] px-1.5 py-0.5 rounded-md font-bold">
                          CẦN XEM
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* View Mode Switcher (5 Modes) */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setActiveViewTab("live_webview")}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                      activeViewTab === "live_webview" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Globe className="size-3.5" />
                    <span>Xem Web Thật (Live Iframe)</span>
                  </button>
                  <button
                    onClick={() => setActiveViewTab("visual_stream")}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                      activeViewTab === "visual_stream" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Layers className="size-3.5" />
                    <span>So Sánh Khối</span>
                  </button>
                  <button
                    onClick={() => setActiveViewTab("field_diff")}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                      activeViewTab === "field_diff" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <SlidersHorizontal className="size-3.5" />
                    <span>Soi CSDL 1-to-1</span>
                  </button>
                  <button onClick={() => setActiveViewTab("commerce_reconciliation")} className={`px-3 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${activeViewTab === "commerce_reconciliation" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}><ShoppingCart className="size-3.5" /><span>Đối soát Commerce</span></button>
                  <button onClick={() => setActiveViewTab("settings_reconciliation")} className={`px-3 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${activeViewTab === "settings_reconciliation" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}><Settings className="size-3.5" /><span>Đối soát Settings</span></button>
                </div>

                {/* Filter toggle */}
                <label className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-800 cursor-pointer select-none text-xs text-slate-300 transition">
                  <input
                    type="checkbox"
                    checked={showOnlyErrors}
                    onChange={(e) => setShowOnlyErrors(e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-0 size-3.5"
                  />
                  <span className="font-semibold text-rose-400">Lỗi / cần xem</span>
                </label>
              </div>
            </div>

            {/* Modal Body Area */}
            {activeViewTab === "commerce_reconciliation" || activeViewTab === "settings_reconciliation" ? (
              <ReconciliationInspector scope={activeViewTab === "commerce_reconciliation" ? "commerce" : "settings"} snapshot={reconciliationSnapshot} loading={reconciliationLoading} error={reconciliationError} isDemo={reconciliationDemo} onToggleDemo={setReconciliationDemo} />
            ) : activeViewTab === "visual_stream" ? (
              /* ========================================================================= */
              /* 1. THE CLASSIC DUAL BROWSER PARITY STREAM VIEW (PW1 VS PW2) */
              /* ========================================================================= */
              <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
                
                {/* Left Sidebar: Block Tree Navigator */}
                <div className="w-full md:w-72 bg-slate-950 border-r border-slate-800/80 flex flex-col shrink-0 overflow-y-auto p-4 space-y-3 min-h-0">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                      <BlockTreeIcon className="size-4 text-blue-400" />
                      <span>Cây Bố Cục ({activePage.blocks.length} Khối)</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {activePage.blocks.map((block) => (
                      <button
                        key={block.id}
                        onClick={() => scrollToBlock(block.id)}
                        className={`w-full text-left p-2.5 rounded-xl border text-xs transition flex items-center justify-between ${
                          selectedBlockId === block.id
                            ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/25 font-semibold"
                            : "bg-slate-900/60 text-slate-300 border-slate-800/80 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono text-[10px] font-bold opacity-60">
                            #{String(block.order).padStart(2, "0")}
                          </span>
                          <span className="font-medium truncate">{block.title.replace(/Khối #\d+:\s*/, "")}</span>
                        </div>
                        <span className="size-2 rounded-full bg-slate-500 shrink-0" title="Xem bằng chứng migration trong chi tiết khối" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Main Area: Dual Browser Mockups Comparison Stream */}
                <div className="flex-1 flex flex-col min-h-0 bg-slate-900/30">
                  
                  {/* Fixed Browser Dual Windows Header - Fixed Top Bar With Zero Gap */}
                  <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-800/80 bg-slate-950 shrink-0 shadow-md space-y-2.5">
                    {/* Parity View Sub-Mode Switcher: Side-by-Side Dual vs Split Swipe Slider */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                        <button
                          type="button"
                          onClick={() => setParityMode("dual_window")}
                          className={`px-3 py-1 font-semibold rounded-lg transition ${
                            parityMode === "dual_window"
                              ? "bg-blue-600 text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          📑 Song Song (Dual View)
                        </button>
                        <button
                          type="button"
                          onClick={() => setParityMode("swipe_slider")}
                          className={`px-3 py-1 font-semibold rounded-lg transition ${
                            parityMode === "swipe_slider"
                              ? "bg-blue-600 text-white shadow-sm"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          ↔️ Kéo Trượt (Swipe Slider)
                        </button>
                      </div>

                      <button
                        type="button"
                        aria-pressed={showDiffGaps}
                        onClick={() => setShowDiffGaps((current) => !current)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                          showDiffGaps
                            ? "bg-rose-500/20 text-rose-200 border-rose-400/70 shadow-md shadow-rose-500/20"
                            : "bg-slate-900 text-slate-300 border-slate-800 hover:border-rose-500/50 hover:text-rose-200"
                        }`}
                      >
                        {showDiffGaps ? "✓ Highlight Diff Gaps" : "Highlight Diff Gaps"}
                      </button>

                      {parityMode === "swipe_slider" && (
                        <div className="flex items-center gap-2 text-xs font-mono bg-slate-900/80 px-3 py-1 rounded-xl border border-slate-800 text-slate-300">
                          <span>Vị trí trượt:</span>
                          <span className="font-bold text-sky-400">{sliderPosition}%</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={sliderPosition}
                            onChange={(e) => setSliderPosition(Number(e.target.value))}
                            className="w-24 h-1 bg-slate-800 rounded-lg appearance-none cursor-ew-resize accent-blue-500 ml-1"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
                      <label className="flex cursor-pointer items-center gap-2 text-slate-200">
                        <input
                          type="checkbox"
                          checked={useDemoRenderEvidence}
                          onChange={(event) => setUseDemoRenderEvidence(event.target.checked)}
                          className="size-3.5 rounded border-slate-700 text-blue-600 focus:ring-0"
                        />
                        <span className="font-semibold">Xem dữ liệu mẫu để duyệt UI</span>
                      </label>
                      <span className={useDemoRenderEvidence ? "text-amber-300" : "text-slate-400"}>
                        {isRenderEvidenceLoading
                          ? "Đang tải bằng chứng…"
                          : renderEvidenceError
                            ? renderEvidenceError
                            : renderEvidence?.message ?? "Chưa tải bằng chứng migration."}
                      </span>
                    </div>

                    <div className={`grid gap-6 ${deviceView === "mobile" ? "grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto" : "grid-cols-1 md:grid-cols-2 gap-4"}`}>
                      {/* Left Browser Bar */}
                      <div className={`bg-slate-900/90 px-4 py-2.5 rounded-xl border border-amber-500/30 flex items-center justify-between shadow-sm ${deviceView === "mobile" ? "max-w-[375px] mx-auto w-full" : ""}`}>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1.5">
                            <span className="size-2.5 rounded-full bg-rose-500/80" />
                            <span className="size-2.5 rounded-full bg-amber-500/80" />
                            <span className="size-2.5 rounded-full bg-emerald-500/80" />
                          </div>
                          <span className="font-bold text-xs text-amber-400 font-mono ml-2">
                            {deviceView === "mobile" ? "📱 BẢN CŨ PW1 (MOBILE 375px)" : "👈 BẢN CŨ PW1 (LARAVEL)"}
                          </span>
                        </div>
                        {(() => {
                          const cleanDomain = (selectedDiff.domain || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
                          const pw1HeaderLiveUrl = cleanDomain
                            ? `https://${cleanDomain}${activePage.path === "/" ? "/" : activePage.path.startsWith("/") ? activePage.path : `/${activePage.path}`}`
                            : `${selectedDiff.legacyDomain}${activePage.path.replace("/", "")}`;
                          return (
                            <a href={pw1HeaderLiveUrl} target="_blank" rel="noreferrer" className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-medium">
                              <span>Live V1</span> <ExternalLink className="size-3" />
                            </a>
                          );
                        })()}
                      </div>

                      {/* Right Browser Bar */}
                      <div className={`bg-slate-900/90 px-4 py-2.5 rounded-xl border border-sky-500/30 flex items-center justify-between shadow-sm ${deviceView === "mobile" ? "max-w-[375px] mx-auto w-full" : ""}`}>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1.5">
                            <span className="size-2.5 rounded-full bg-rose-500/80" />
                            <span className="size-2.5 rounded-full bg-amber-500/80" />
                            <span className="size-2.5 rounded-full bg-emerald-500/80" />
                          </div>
                          <span className="font-bold text-xs text-sky-400 font-mono ml-2">
                            {deviceView === "mobile" ? "📱 BẢN MỚI PW2 (MOBILE 375px)" : "👉 BẢN MỚI PW2 (NEXT.JS 15)"}
                          </span>
                        </div>
                        {activePage.existsInPW2 ? (
                          <a href={`${selectedDiff.migratedDomain}${activePage.path.replace("/", "")}`} target="_blank" rel="noreferrer" className="text-xs text-sky-400 hover:underline flex items-center gap-1 font-medium">
                            <span>Live V2</span> <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-rose-400 font-bold font-mono">🚨 CHƯA CÓ TRANG</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Scrollable Stream Content - Scrolls Smoothly Underneath Fixed Header */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 min-h-0">

                  {/* Defects Alert Card */}
                  {activePage.defects.length > 0 && (
                    <div className="space-y-3 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/80 shadow-sm">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                        <Wrench className="size-4 text-blue-400" />
                        <span>Lỗi & Cảnh Báo Trên Trang Này ({activePage.defects.length} Vấn Đề)</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {activePage.defects.map((defect, idx) => (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                              defect.type === "p0"
                                ? "bg-rose-950/20 border-rose-500/30 text-rose-200"
                                : "bg-amber-950/20 border-amber-500/30 text-amber-200"
                            }`}
                          >
                            <div className="flex items-center gap-2 font-bold text-white text-xs">
                              <span>{defect.icon}</span>
                              <span className="font-mono uppercase text-[10px] px-1.5 py-0.5 rounded bg-black/40">
                                {defect.type.toUpperCase()}
                              </span>
                              <span>{defect.title}</span>
                            </div>
                            <p className="text-slate-300 text-[11px] leading-relaxed">{defect.desc}</p>
                            <div className="text-[11px] font-mono text-blue-300 bg-slate-950/80 p-2 rounded border border-slate-800">
                              💡 Khắc phục: <strong>{defect.fix}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sequential Block Stack */}
                  <div className="space-y-4">
                    {activePage.blocks
                      .filter(
                        (block) =>
                          !showOnlyErrors ||
                          evidenceByLegacyId.get(block.id)?.overall !== "pass",
                      )
                      .map((block) => {
                        const blockEvidence: BlockRenderEvidence | null =
                          evidenceByLegacyId.get(block.id) ?? null;
                        const evidenceSurface =
                          blockEvidence?.overall === "failed"
                            ? "bg-rose-950/10 border-rose-500/40 ring-1 ring-rose-500/20 shadow-md"
                            : blockEvidence?.overall === "pass"
                              ? "bg-emerald-950/10 border-emerald-500/30"
                              : selectedBlockId === block.id
                                ? "bg-slate-900 border-blue-500 ring-2 ring-blue-500/30 shadow-xl"
                                : "bg-slate-900/40 border-slate-800/80 hover:border-slate-700/80 shadow-sm";
                        return (
                        <div
                          key={block.id}
                          id={block.id}
                          className={`rounded-2xl border transition-all duration-200 p-4 sm:p-5 space-y-3.5 ${evidenceSurface}`}
                        >
                          {/* Block Header */}
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 flex-wrap gap-2">
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-1 bg-slate-900 text-sky-400 font-mono font-bold text-xs rounded-lg border border-slate-800">
                                #{String(block.order).padStart(2, "0")}
                              </span>
                              <div>
                                <h4 className="font-bold text-white text-sm">{block.title}</h4>
                                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                  PW1: <strong className="text-slate-300">{block.pw1Component}</strong> ➔ PW2: <strong className="text-sky-300">{blockEvidence?.pw2Data.status === "migrated" ? blockEvidence.pw2Data.blockType ?? "Đã mapping, chưa rõ loại block" : blockEvidence?.pw2Data.status === "mismatch" ? blockEvidence.pw2Data.blockType ?? "Đã mapping, dữ liệu lệch" : blockEvidence?.pw2Data.status === "missing" ? "Thiếu block PW2" : "Chưa xác minh"}</strong>
                                </div>
                              </div>
                            </div>

                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-950 text-slate-300 border border-slate-700">
                              {blockEvidence
                                ? "Xem bằng chứng bên dưới"
                                : isRenderEvidenceLoading
                                  ? "Đang tải bằng chứng"
                                  : "Chưa có bằng chứng"}
                            </span>
                          </div>

                          {blockEvidence ? (
                            <BlockMigrationEvidence
                              evidence={blockEvidence}
                              onRequestLiveCheck={requestLiveCheck}
                              isLiveCheckPending={liveCheckBlockId === blockEvidence.legacyId}
                            />
                          ) : (
                            <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-xs text-slate-400">
                              Chưa có mapping PW1 → PW2 đã xác nhận, nên không thể kết luận block này đã migrate hoặc render đúng.
                            </div>
                          )}

                          {/* Dual Column Content Preview - Switches between Desktop, Mobile & Swipe Slider */}
                          {deviceView === "mobile" ? (
                            /* Mobile Phone Mockup View (375px) */
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-start py-2">
                              {/* PW1 Phone Mockup */}
                              <div className="w-full max-w-[375px] mx-auto bg-slate-950/95 border-2 border-amber-500/40 rounded-[2.5rem] p-4 shadow-2xl space-y-3.5 ring-1 ring-amber-500/20 relative">
                                {/* Speaker / Notch */}
                                <div className="w-24 h-3.5 bg-slate-900 border border-slate-800 rounded-full mx-auto flex items-center justify-center gap-1.5 shadow-inner">
                                  <div className="size-1.5 rounded-full bg-slate-700" />
                                  <div className="w-8 h-1 rounded-full bg-slate-800" />
                                </div>
                                <div className="text-[10px] uppercase font-bold text-amber-400 font-mono tracking-wider text-center border-b border-slate-800 pb-1.5 flex items-center justify-center gap-1">
                                  <Smartphone className="size-3" /> PW1 Mobile View (375px)
                                </div>

                                {/* Rich Visual Block Render for PW1 */}
                                <RichVisualBlockRenderer block={block} version="pw1" deviceView="mobile" />

                                {/* Home Bar */}
                                <div className="w-28 h-1 bg-slate-700 rounded-full mx-auto mt-2" />
                              </div>

                              {/* PW2 Phone Mockup */}
                              <div className={`w-full max-w-[375px] mx-auto bg-slate-950/95 border-2 rounded-[2.5rem] p-4 shadow-2xl space-y-3.5 relative ${
                                blockEvidence?.overall === "failed"
                                  ? "border-rose-500/60 ring-2 ring-rose-500/30"
                                  : "border-slate-700 ring-1 ring-slate-800"
                              }`}>
                                {/* Speaker / Notch */}
                                <div className="w-24 h-3.5 bg-slate-900 border border-slate-800 rounded-full mx-auto flex items-center justify-center gap-1.5 shadow-inner">
                                  <div className="size-1.5 rounded-full bg-slate-700" />
                                  <div className="w-8 h-1 rounded-full bg-slate-800" />
                                </div>
                                <div className="text-[10px] uppercase font-bold text-sky-400 font-mono tracking-wider text-center border-b border-slate-800 pb-1.5 flex items-center justify-center gap-1">
                                  <Smartphone className="size-3" /> PW2 Next.js Mobile (375px)
                                </div>

                                {/* Rich Visual Block Render for PW2 */}
                                <Pw2EvidencePlaceholder evidence={blockEvidence} />

                                {/* Home Bar */}
                                <div className="w-28 h-1 bg-slate-700 rounded-full mx-auto mt-2" />
                              </div>
                            </div>
                          ) : (
                            /* Desktop Dual Column View */
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* PW1 Preview Box */}
                              <div className="space-y-1.5">
                                <div className="text-[10px] uppercase font-bold text-amber-400 font-mono tracking-wider px-1">
                                  Giao Diện Bản Gốc PW1 (Laravel)
                                </div>
                                <RichVisualBlockRenderer block={block} version="pw1" deviceView="desktop" />
                              </div>

                              {/* PW2 Preview Box */}
                              <div className="relative space-y-1.5">
                                <div className="text-[10px] uppercase font-bold text-sky-400 font-mono tracking-wider px-1">
                                  Giao Diện Bản Mới PW2 (Next.js 15)
                                </div>
                                <Pw2EvidencePlaceholder evidence={blockEvidence} />
                              </div>
                            </div>
                          )}

                          {/* Raw Field Data & Configuration Inspector for this Block */}
                          <div className="mt-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center justify-between">
                              <span className="text-amber-400">📋 Dữ liệu PW1 của khối #{block.order} ({block.pw1Component})</span>
                              <span className="text-slate-500 font-normal">Chỉ là nguồn PW1, không chứng minh migration PW2</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                                <span className="text-slate-500 block text-[10px]">Tiêu đề (Headline):</span>
                                <span className="text-white font-bold">{block.pw1Preview?.headline || "Không có"}</span>
                              </div>
                              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                                <span className="text-slate-500 block text-[10px]">Tiêu đề phụ / Mô tả:</span>
                                <span className="text-slate-300">{block.pw1Preview?.subheadline || "Không có"}</span>
                              </div>
                            </div>
                            {block.pw1Preview?.bodyText && (
                              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/80 text-[11px] font-mono text-slate-300">
                                <span className="text-slate-500 block text-[10px]">Nội dung chi tiết / Danh sách:</span>
                                <span className="text-sky-300">{block.pw1Preview.bodyText}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : activeViewTab === "live_webview" ? (
              /* ========================================================================= */
              /* 1.5. LIVE STOREFRONT WEBVIEW (100% REAL COMPILED HTML/CSS/JS IFRAME) */
              /* ========================================================================= */
              <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
                {/* Preview Source Selector & Status Header */}
                <div className="px-4 py-2 sm:px-6 sm:py-2.5 border-b border-slate-800/80 bg-slate-900/90 shrink-0 shadow-sm space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                        Nguồn Preview:
                      </span>
                      {(() => {
                        const isDomainSslReady = isStoreDomainSslReady(selectedDiff);
                        return (
                          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                            <button
                              type="button"
                              onClick={() => setPreviewSource("template")}
                              className={`px-3 py-1 font-semibold rounded-lg transition flex items-center gap-1.5 ${
                                previewSource === "template" || !isDomainSslReady
                                  ? "bg-blue-600 text-white shadow-sm"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                              title="Hiển thị giao diện trực quan 100% từ CSDL MySQL gốc không phụ thuộc mạng máy chủ cũ"
                            >
                              <Sparkles className="size-3" />
                              <span>Giao Diện Mẫu (100% CSDL)</span>
                            </button>
                            {isDomainSslReady ? (
                              <button
                                type="button"
                                onClick={() => setPreviewSource("live_domain")}
                                className={`px-3 py-1 font-semibold rounded-lg transition flex items-center gap-1.5 ${
                                  previewSource === "live_domain"
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "text-slate-400 hover:text-slate-200"
                                }`}
                                title="Tải trực tiếp qua tên miền khách hàng có bảo mật SSL"
                              >
                                <Globe className="size-3" />
                                <span>Tên Miền Trực Tiếp (Live Domain)</span>
                              </button>
                            ) : (
                              <a
                                href={`https://${(selectedDiff.domain || "").replace(/^https?:\/\//, "").replace(/\/+$/, "")}${activePage.path === "/" ? "" : activePage.path}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 font-semibold rounded-lg transition flex items-center gap-1 text-slate-400 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40"
                                title="Tên miền này chưa có SSL hợp lệ trên máy chủ PW1 cũ nên trình duyệt chặn nhúng iframe. Bấm để mở tab mới ngoài trình duyệt."
                              >
                                <Globe className="size-3" />
                                <span>Mở Live Tab Ngoài (SSL Cũ)</span>
                                <ExternalLink className="size-2.5 ml-0.5 opacity-70" />
                              </a>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                        <CheckCircle2 className="size-3" />
                        <span>Trang: <strong>{activePage.name}</strong> ({activePage.path})</span>
                      </span>
                    </div>
                  </div>

                  {/* Dual Browser URL Bar */}
                  <div className={`grid gap-4 ${deviceView === "mobile" ? "grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto" : "grid-cols-1 md:grid-cols-2"}`}>
                    {/* Left Browser URL Bar (PW1 Laravel) */}
                    <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-amber-500/30 flex items-center justify-between gap-2 shadow-inner">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex gap-1">
                          <span className="size-2 rounded-full bg-rose-500/80" />
                          <span className="size-2 rounded-full bg-amber-500/80" />
                          <span className="size-2 rounded-full bg-emerald-500/80" />
                        </div>
                        <span className="text-[11px] font-mono text-amber-300 truncate">
                          {(() => {
                            const isSslReady = isStoreDomainSslReady(selectedDiff);
                            const cleanDomain = (selectedDiff.domain || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
                            return previewSource === "template" || !isSslReady
                              ? `👈 PW1 Legacy • Theme ${selectedDiff.templateCode} • ${activePage.path}`
                              : cleanDomain
                                ? `https://${cleanDomain}${activePage.path === "/" ? "/" : activePage.path.startsWith("/") ? activePage.path : `/${activePage.path}`}`
                                : `${selectedDiff.legacyDomain}${activePage.path.replace("/", "")}`;
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIframeReloadKey((k) => k + 1)}
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                          title="Tải lại iframe PW1"
                        >
                          <RefreshCw className="size-3" />
                        </button>
                        <a
                          href={(() => {
                            const isSslReady = isStoreDomainSslReady(selectedDiff);
                            const cleanDomain = (selectedDiff.domain || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
                            return previewSource === "template" || !isSslReady
                              ? `/api/qa/template-preview/${selectedDiff.templateCode.toLowerCase()}?version=pw1&store_id=${encodeURIComponent(selectedDiff.id)}&page=${encodeURIComponent(activePage.path)}&title=${encodeURIComponent(activePage.name)}#${activePage.path}`
                              : cleanDomain
                                ? `https://${cleanDomain}${activePage.path === "/" ? "/" : activePage.path.startsWith("/") ? activePage.path : `/${activePage.path}`}`
                                : `${selectedDiff.legacyDomain}${activePage.path.replace("/", "")}`;
                          })()}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded-lg hover:bg-slate-800 text-amber-400 transition flex items-center gap-0.5 text-[11px] font-semibold"
                          title="Mở tab mới ngoài trình duyệt"
                        >
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                    </div>

                    {/* Right Browser URL Bar (PW2 Next.js 15) */}
                    <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-sky-500/30 flex items-center justify-between gap-2 shadow-inner">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex gap-1">
                          <span className="size-2 rounded-full bg-rose-500/80" />
                          <span className="size-2 rounded-full bg-amber-500/80" />
                          <span className="size-2 rounded-full bg-emerald-500/80" />
                        </div>
                        <span className="text-[11px] font-mono text-sky-300 truncate">
                          {previewSource === "template"
                            ? `👉 PW2 Next.js 15 • Theme ${selectedDiff.templateCode} • ${activePage.path}`
                            : `👉 PW2 Next.js 15 • ${selectedDiff.name} • ${activePage.path}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIframeReloadKey((k) => k + 1)}
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                          title="Tải lại iframe PW2"
                        >
                          <RefreshCw className="size-3" />
                        </button>
                        {activePage.existsInPW2 || previewSource === "template" ? (
                          <a
                            href={
                              previewSource === "template"
                                ? `/api/qa/template-preview/${selectedDiff.templateCode.toLowerCase()}?version=pw2&store_id=${encodeURIComponent(selectedDiff.id)}&page=${encodeURIComponent(activePage.path)}&title=${encodeURIComponent(activePage.name)}#${activePage.path}`
                                : `/api/qa/template-preview/${selectedDiff.templateCode.toLowerCase()}?version=pw2&store_id=${encodeURIComponent(selectedDiff.id)}&page=${encodeURIComponent(activePage.path)}&title=${encodeURIComponent(activePage.name)}#${activePage.path}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded-lg hover:bg-slate-800 text-sky-400 transition flex items-center gap-0.5 text-[11px] font-semibold"
                            title="Mở tab mới ngoài trình duyệt"
                          >
                            <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-rose-400 font-bold font-mono">CHƯA CÓ TRANG</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Iframe Viewport Stream Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0 bg-slate-900/40">
                  {(() => {
                    const activePath = activePage?.path || "/";
                    const encodedPath = encodeURIComponent(activePath);
                    const pageTitle = encodeURIComponent(activePage?.name || "Trang");
                    const tplCode = (selectedDiff.templateCode || "fb101").toLowerCase();

                    const pw1TemplateUrl = `/api/qa/template-preview/${tplCode}?version=pw1&store_id=${encodeURIComponent(selectedDiff.id)}&page=${encodedPath}&title=${pageTitle}&_t=${iframeReloadKey}#${activePath}`;
                    const pw2TemplateUrl = `/api/qa/template-preview/${tplCode}?version=pw2&store_id=${encodeURIComponent(selectedDiff.id)}&page=${encodedPath}&title=${pageTitle}&_t=${iframeReloadKey}#${activePath}`;

                    const cleanDomain = (selectedDiff.domain || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
                    const liveDomainPath = activePath === "/" ? "" : activePath.startsWith("/") ? activePath : `/${activePath}`;
                    const pw1LiveDomainUrl = cleanDomain
                      ? `https://${cleanDomain}${liveDomainPath || "/"}${cleanDomain.includes("?") ? `&_t=${iframeReloadKey}` : `?_t=${iframeReloadKey}`}`
                      : pw1TemplateUrl;
                    const pw2LiveDomainUrl = pw2TemplateUrl;

                    const isDomainSslReady = isStoreDomainSslReady(selectedDiff);
                    const pw1Url = (previewSource === "live_domain" && isDomainSslReady) ? pw1LiveDomainUrl : pw1TemplateUrl;
                    const pw2Url = previewSource === "template" ? pw2TemplateUrl : pw2LiveDomainUrl;
                    const iframeSandbox = "allow-scripts allow-same-origin allow-forms allow-popups";

                    return deviceView === "mobile" ? (
                      /* Mobile 375px Dual Phone Mockups with Real Iframes */
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-start py-4">
                        {/* PW1 Phone Shell */}
                        <div className="w-full max-w-[390px] mx-auto bg-slate-950 border-4 border-amber-500/40 rounded-[3rem] p-3 shadow-2xl space-y-2 ring-1 ring-amber-500/20 flex flex-col items-center">
                          {/* Dynamic Island / Speaker */}
                          <div className="w-24 h-4 bg-slate-900 border border-slate-800 rounded-full mx-auto flex items-center justify-center gap-1.5 shadow-inner my-1">
                            <div className="size-1.5 rounded-full bg-slate-700" />
                            <div className="w-8 h-1 rounded-full bg-slate-800" />
                          </div>
                          {/* Iframe Container */}
                          <div className="w-full h-[620px] rounded-[2rem] overflow-hidden bg-white shadow-inner relative border border-slate-800">
                            <iframe
                              ref={pw1MobIframeRef}
                              key={`pw1-mob-${iframeReloadKey}-${previewSource}-${activePath}`}
                              src={pw1Url}
                              title="PW1 Mobile Storefront"
                              className="w-full h-full border-0"
                              sandbox={iframeSandbox}
                              onLoad={() => {
                                if (previewSource === "template" || !isDomainSslReady) {
                                  pw1MobIframeRef.current?.contentWindow?.postMessage({
                                    type: "spa-navigate",
                                    path: activePath,
                                    title: activePage?.name,
                                    storeId: selectedDiff?.id,
                                  }, "*");
                                }
                              }}
                            />
                          </div>
                          {/* Home Bar */}
                          <div className="w-28 h-1 bg-slate-700 rounded-full mx-auto mt-1" />
                        </div>

                        {/* PW2 Phone Shell */}
                        <div className="w-full max-w-[390px] mx-auto bg-slate-950 border-4 border-sky-500/40 rounded-[3rem] p-3 shadow-2xl space-y-2 ring-1 ring-sky-500/20 flex flex-col items-center">
                          {/* Dynamic Island / Speaker */}
                          <div className="w-24 h-4 bg-slate-900 border border-slate-800 rounded-full mx-auto flex items-center justify-center gap-1.5 shadow-inner my-1">
                            <div className="size-1.5 rounded-full bg-slate-700" />
                            <div className="w-8 h-1 rounded-full bg-slate-800" />
                          </div>
                          {/* Iframe Container */}
                          <div className="w-full h-[620px] rounded-[2rem] overflow-hidden bg-white shadow-inner relative border border-slate-800">
                            <iframe
                              ref={pw2MobIframeRef}
                              key={`pw2-mob-${iframeReloadKey}-${previewSource}-${activePath}`}
                              src={pw2Url}
                              title="PW2 Next.js Mobile Storefront"
                              className="w-full h-full border-0"
                              sandbox={iframeSandbox}
                              onLoad={() => {
                                if (previewSource === "template") {
                                  pw2MobIframeRef.current?.contentWindow?.postMessage({
                                    type: "spa-navigate",
                                    path: activePath,
                                    title: activePage?.name,
                                    storeId: selectedDiff?.id,
                                  }, "*");
                                }
                              }}
                            />
                          </div>
                          {/* Home Bar */}
                          <div className="w-28 h-1 bg-slate-700 rounded-full mx-auto mt-1" />
                        </div>
                      </div>
                    ) : (
                      /* Desktop Dual 50/50 Iframes */
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[720px]">
                        {/* Left PW1 Full Iframe */}
                        <div className="bg-slate-950 rounded-2xl border-2 border-amber-500/30 overflow-hidden flex flex-col shadow-xl">
                          <div className="bg-slate-900/90 px-3.5 py-2 border-b border-slate-800 text-[11px] font-bold text-amber-400 font-mono flex items-center justify-between">
                            <span>👈 PW1 LARAVEL (SNAPSHOT CSDL CŨ)</span>
                            <span className="text-slate-400 font-normal">Desktop Resolution</span>
                          </div>
                          <div className="flex-1 bg-white relative">
                            <iframe
                              ref={pw1DeskIframeRef}
                              key={`pw1-desk-${iframeReloadKey}-${previewSource}-${activePath}`}
                              src={pw1Url}
                              title="PW1 Desktop Storefront"
                              className="w-full h-full border-0"
                              sandbox={iframeSandbox}
                              onLoad={() => {
                                if (previewSource === "template" || !isDomainSslReady) {
                                  pw1DeskIframeRef.current?.contentWindow?.postMessage({
                                    type: "spa-navigate",
                                    path: activePath,
                                    title: activePage?.name,
                                    storeId: selectedDiff?.id,
                                  }, "*");
                                }
                              }}
                            />
                          </div>
                        </div>

                        {/* Right PW2 Full Iframe */}
                        <div className="bg-slate-950 rounded-2xl border-2 border-sky-500/30 overflow-hidden flex flex-col shadow-xl">
                          <div className="bg-slate-900/90 px-3.5 py-2 border-b border-slate-800 text-[11px] font-bold text-sky-400 font-mono flex items-center justify-between">
                            <span>👉 PW2 NEXT.JS 15 (BẢN MIGRATE MỚI)</span>
                            <span className="text-slate-400 font-normal">Desktop Resolution</span>
                          </div>
                          <div className="flex-1 bg-white relative">
                            <iframe
                              ref={pw2DeskIframeRef}
                              key={`pw2-desk-${iframeReloadKey}-${previewSource}-${activePath}`}
                              src={pw2Url}
                              title="PW2 Next.js Desktop Storefront"
                              className="w-full h-full border-0"
                              sandbox={iframeSandbox}
                              onLoad={() => {
                                if (previewSource === "template") {
                                  pw2DeskIframeRef.current?.contentWindow?.postMessage({
                                    type: "spa-navigate",
                                    path: activePath,
                                    title: activePage?.name,
                                    storeId: selectedDiff?.id,
                                  }, "*");
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : activeViewTab === "field_diff" ? (
              /* ========================================================================= */
              /* 2. DEEP FIELD-BY-FIELD DATABASE DIFF INSPECTOR */
              /* ========================================================================= */
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-900/30 min-h-0">
                {/* Header Summary Card */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <SlidersHorizontal className="size-5 text-blue-400" />
                      <span>ĐỐI SOÁT TRƯỜNG DỮ LIỆU CSDL 1-TO-1 (DATABASE FIELD RECONCILIATION)</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Đối chiếu từng trường theo <code>legacy_id</code> giữa MySQL PW1 và Postgres PW2: <strong>Sản Phẩm, Biến Thể, Banners, Link CTA, RichText & Bảng Biểu, Menu Điều Hướng, Danh Mục, Cài Đặt Shop</strong>.
                    </p>
                    <p className="text-xs text-indigo-300 mt-2" data-testid="field-diff-page-scope">
                      Phạm vi trang: <strong>{activePage.name}</strong> ({activePage.path})
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="bg-slate-900/80 px-3.5 py-2 rounded-xl border border-slate-800 text-xs">
                      <div className="text-[10px] text-slate-400 uppercase font-mono font-semibold">Độ Khớp Trường</div>
                      <div className="font-bold text-emerald-400 text-sm font-mono">{selectedDiff.fieldDiffAudit.summary.fieldMatchRate}</div>
                    </div>
                    <div className="bg-slate-900/80 px-3.5 py-2 rounded-xl border border-slate-800 text-xs">
                      <div className="text-[10px] text-slate-400 uppercase font-mono font-semibold">Tổng Record</div>
                      <div className="font-bold text-white text-sm font-mono">{selectedDiff.fieldDiffAudit.summary.totalEntitiesV1}</div>
                    </div>
                    {selectedDiff.fieldDiffAudit.summary.missingInPW2Count > 0 && (
                      <div className="bg-rose-950/30 px-3.5 py-2 rounded-xl border border-rose-500/40 text-xs">
                        <div className="text-[10px] text-rose-400 uppercase font-mono font-semibold">Thiếu Trên PW2</div>
                        <div className="font-bold text-rose-300 text-sm font-mono">🚨 {selectedDiff.fieldDiffAudit.summary.missingInPW2Count} Record</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-group & Search Filter Bar */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto w-full md:w-auto">
                    {(
                      [
                        { key: "all", label: "Tất Cả", icon: Grid },
                        { key: "products", label: "Sản Phẩm", icon: Package },
                        { key: "variants", label: "Biến Thể", icon: Tags },
                        { key: "banners", label: "Banners & Link", icon: ImageIcon },
                        { key: "richtext", label: "RichText & Bảng", icon: TableIcon },
                        { key: "navigation", label: "Menu Điều Hướng", icon: Compass },
                        { key: "categories", label: "Danh Mục", icon: FolderTree },
                        { key: "posts", label: "Tin Tức", icon: Newspaper },
                        { key: "settings", label: "Cài Đặt & Footer", icon: Settings },
                        { key: "blocks", label: "Khối Layout", icon: BlockTreeIcon },
                      ] as const
                    ).map((grp) => {
                      const Icon = grp.icon;
                      const count = grp.key === "all"
                        ? getFieldDiffRecordsForPage(selectedDiff.fieldDiffAudit, activePage.id).length
                        : getFieldDiffRecordsForPage(selectedDiff.fieldDiffAudit, activePage.id).filter((r) => r.entityGroup === grp.key).length;

                      return (
                        <button
                          key={grp.key}
                          onClick={() => setActiveEntityGroup(grp.key)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition border ${
                            activeEntityGroup === grp.key
                              ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/25"
                              : "bg-slate-900/70 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800"
                          }`}
                        >
                          <Icon className="size-3.5" />
                          <span>{grp.label}</span>
                          <span className="text-[10px] bg-slate-950/80 px-1.5 py-0.5 rounded-md font-mono opacity-80">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative w-full md:w-64">
                    <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm trường, SKU, khóa CSDL..."
                      value={fieldSearchQuery}
                      onChange={(e) => setFieldSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Entity Cards & Field Breakdown Tables */}
                <div className="space-y-4">
                  {filteredFieldRecords.map((record) => (
                    <div
                      key={record.id}
                      data-testid={`field-diff-record-${record.id}`}
                      className={`rounded-2xl border overflow-hidden shadow-lg transition ${
                        record.matchStatus === "missing_in_pw2" || record.matchStatus === "error"
                          ? "bg-rose-950/15 border-rose-500 ring-1 ring-rose-500/40"
                          : record.matchStatus === "warning"
                          ? "bg-amber-950/15 border-amber-500 ring-1 ring-amber-500/40"
                          : "bg-slate-950 border-slate-800"
                      }`}
                    >
                      {/* Entity Header */}
                      <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-lg bg-slate-900 text-indigo-400 border border-slate-800">
                            {record.entityGroup}
                          </span>
                          <div>
                            <div className="font-black text-white text-sm flex items-center gap-2">
                              <span>{record.entityName}</span>
                              <span className="text-xs font-mono text-slate-400 font-normal">({record.entityIdentifier})</span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              MySQL Key ID: <strong className="text-amber-400">{record.legacyId}</strong> ➔ Postgres ID:{" "}
                              {record.migratedId ? (
                                <strong className="text-indigo-300">{record.migratedId}</strong>
                              ) : (
                                <strong className="text-rose-400">🚨 CHƯA CÓ TRÊN PW2</strong>
                              )}
                            </div>
                          </div>
                        </div>

                        <div>
                          {record.matchStatus === "missing_in_pw2" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-500 animate-pulse">
                              <AlertOctagon className="size-3.5" /> 🚨 MẤT BẢN GHI TRÊN PW2
                            </span>
                          ) : record.matchStatus === "error" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-500/50">
                              <AlertOctagon className="size-3.5" /> 🚨 LỆCH {record.discrepancyCount} TRƯỜNG P0
                            </span>
                          ) : record.matchStatus === "warning" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-500/50">
                              <AlertTriangle className="size-3.5" /> ⚠️ CẦN XEM {record.discrepancyCount} TRƯỜNG
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                              <CheckCircle2 className="size-3.5" /> ✓ Khớp {record.matchedFields}/{record.totalFields} Trường
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 1-to-1 Field Matrix Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                            <tr>
                              <th className="py-3 px-4">Tên Trường (Field)</th>
                              <th className="py-3 px-4">Khóa MySQL (PW1) ➔ Khóa Postgres (PW2)</th>
                              <th className="py-3 px-4">Giá Trị Bản Cũ (PW1)</th>
                              <th className="py-3 px-4">Giá Trị Bản Mới (PW2)</th>
                              <th className="py-3 px-4">Đánh Giá</th>
                              <th className="py-3 px-4">Hướng Dẫn Khắc Phục (Fix Action)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50 text-[11px] font-mono">
                            {record.fields.map((field, fIdx) => (
                              <tr
                                key={fIdx}
                                className={`hover:bg-slate-900/40 transition ${
                                  field.status === "error"
                                    ? "bg-rose-950/20"
                                    : field.status === "warning"
                                    ? "bg-amber-950/20"
                                    : ""
                                }`}
                              >
                                <td className="py-3.5 px-4 font-sans font-bold text-white">
                                  {field.fieldLabel}
                                  <div className="text-[10px] text-slate-500 font-mono">{field.fieldName}</div>
                                </td>
                                <td className="py-3.5 px-4 text-slate-400">
                                  <span className="text-amber-400/90">{field.legacyKey}</span>
                                  <span className="text-slate-600 mx-1.5">➔</span>
                                  <span className="text-indigo-400/90">{field.migratedKey}</span>
                                </td>
                                <td className="py-3.5 px-4 font-sans text-slate-200">
                                  {field.legacyValue !== null ? (
                                    String(field.legacyValue)
                                  ) : (
                                    <span className="text-slate-600 italic">null</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 font-sans">
                                  {field.migratedValue !== null ? (
                                    <span className="text-slate-200">{String(field.migratedValue)}</span>
                                  ) : (
                                    <span className="text-rose-400 font-bold italic">🚨 NULL (Bị Mất)</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 font-sans">
                                  {field.status === "match" ? (
                                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                                      <Check className="size-3.5" /> Khớp 100%
                                    </span>
                                  ) : field.status === "warning" ? (
                                    <span className="text-amber-400 font-bold flex items-center gap-1">
                                      <AlertTriangle className="size-3.5" /> {field.classification}
                                    </span>
                                  ) : (
                                    <span className="text-rose-400 font-bold flex items-center gap-1">
                                      <AlertOctagon className="size-3.5" /> {field.classification}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 font-sans text-slate-300 max-w-xs">
                                  {field.remediationAction ? (
                                    <div className="text-[11px] bg-slate-900 p-2 rounded-lg border border-slate-800 text-indigo-300">
                                      {field.remediationAction}
                                    </div>
                                  ) : (
                                    <span className="text-emerald-500/80 text-[11px]">✓ Không cần chỉnh sửa</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : activeViewTab === "media_audit" ? (
              /* ========================================================================= */
              /* 3. MEDIA INTEGRITY AUDIT TAB */
              /* ========================================================================= */
              <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-900/40 min-h-0">
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-sm flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <ImageIcon className="size-5 text-indigo-400" />
                      <span>ĐỐI SOÁT HÌNH ẢNH & LINK CDN (MEDIA INTEGRITY AUDIT)</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Kiểm tra link ảnh có bị 404, đối chiếu CDN DigitalOcean S3 sang WebP Payload và thẻ Alt text SEO.
                    </p>
                  </div>
                  <div className="text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                    Trang: <strong className="text-indigo-400">{activePage.name}</strong> ({activePage.path})
                  </div>
                </div>

                <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800 tracking-wider">
                      <tr>
                        <th className="py-3.5 px-5">Vị Trí Ảnh</th>
                        <th className="py-3.5 px-5">Bản Cũ PW1 (DO S3)</th>
                        <th className="py-3.5 px-5">Bản Mới PW2 (WebP CDN)</th>
                        <th className="py-3.5 px-5">HTTP Status</th>
                        <th className="py-3.5 px-5">Alt Text SEO</th>
                        <th className="py-3.5 px-5">Kích Thước</th>
                        <th className="py-3.5 px-5 text-right">Đánh Giá</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {activePage.mediaAudits.map((m) => (
                        <tr key={m.id} className={`hover:bg-slate-900/40 transition ${m.status === "warn" ? "bg-amber-950/15" : ""}`}>
                          <td className="py-4 px-5 font-bold text-white">{m.label}</td>
                          <td className="py-4 px-5 font-mono text-[11px] text-slate-400 truncate max-w-[200px]">
                            <a href={m.pw1Url} target="_blank" rel="noreferrer" className="text-amber-400 hover:underline flex items-center gap-1">
                              <span>{m.pw1Url.split("/").pop()}</span>
                              <ExternalLink className="size-3 shrink-0" />
                            </a>
                          </td>
                          <td className="py-4 px-5 font-mono text-[11px] text-slate-300 truncate max-w-[200px]">
                            {m.status === "warn" ? (
                              <span className="text-rose-400 font-bold">{m.pw2Url.split("/").pop()}</span>
                            ) : (
                              <a href={m.pw2Url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline flex items-center gap-1">
                                <span>{m.pw2Url.split("/").pop()}</span>
                                <ExternalLink className="size-3 shrink-0" />
                              </a>
                            )}
                          </td>
                          <td className="py-4 px-5">
                            {m.httpStatusV2 === 200 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                                200 OK
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-500 text-[10px] font-bold animate-pulse">
                                404 NOT FOUND
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-5 text-slate-300">
                            {m.altTextV2 ? m.altTextV2 : <span className="text-rose-400 italic">Thiếu Alt Text</span>}
                          </td>
                          <td className="py-4 px-5 text-slate-400 font-mono text-[11px]">{m.dimensionsV2}</td>
                          <td className="py-4 px-5 text-right font-bold">
                            {m.status === "pass" ? (
                              <span className="text-emerald-400 inline-flex items-center gap-1">
                                <CheckCircle2 className="size-4" /> Chuẩn 100%
                              </span>
                            ) : (
                              <span className="text-amber-400 inline-flex items-center gap-1">
                                <AlertTriangle className="size-4" /> {m.issueNote}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* ========================================================================= */
              /* 4. TYPOGRAPHY & TEXT FORMAT AUDIT TAB */
              /* ========================================================================= */
              <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-900/40 min-h-0">
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-sm flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <TypeIcon className="size-5 text-indigo-400" />
                      <span>ĐỐI SOÁT ĐỊNH DẠNG VĂN BẢN & BẢNG BIỂU USER INPUT</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Kiểm tra mã hóa Tiếng Việt UTF-8 (chống font rác), định dạng WYSIWYG và cấu trúc thẻ bảng <code>&lt;table&gt;</code>.
                    </p>
                  </div>
                  <div className="text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                    Trang: <strong className="text-indigo-400">{activePage.name}</strong> ({activePage.path})
                  </div>
                </div>

                <div className="space-y-4">
                  {activePage.textFormatAudits.map((item) => (
                    <div
                      key={item.id}
                      className={`p-5 rounded-2xl border transition ${
                        item.status === "fail"
                          ? "bg-rose-950/20 border-rose-500 ring-1 ring-rose-500/40"
                          : "bg-slate-950 border-slate-800 shadow-lg"
                      } space-y-3.5`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="font-bold text-white text-sm flex items-center gap-2">
                          <ShieldCheck className="size-4 text-indigo-400" />
                          <span>{item.context}</span>
                        </div>
                        <div>
                          {item.status === "pass" ? (
                            <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5">
                              <CheckCircle2 className="size-3.5" /> UTF-8 & Cấu Trúc Khớp 100%
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full bg-rose-950 text-rose-300 border border-rose-500 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                              <AlertOctagon className="size-3.5" /> {item.issueNote}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        {/* PW1 Box */}
                        <div className="bg-slate-900/90 p-4 rounded-xl border border-amber-500/30 space-y-2">
                          <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider font-mono">
                            HTML Bản Cũ PW1 (TinyMCE)
                          </div>
                          <div className="text-slate-200 leading-relaxed font-sans bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                            {item.pw1Html}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium pt-1">
                            Đặc tính: In đậm ({item.stylingCheck.hasBold ? "✓" : "✗"}) • In nghiêng ({item.stylingCheck.hasItalic ? "✓" : "✗"}) • Bảng biểu ({item.stylingCheck.hasTable ? `✓ (${item.stylingCheck.tableColumnsCount} cột)` : "✗"})
                          </div>
                        </div>

                        {/* PW2 Box */}
                        <div className={`p-4 rounded-xl border space-y-2 ${
                          item.status === "fail"
                            ? "bg-rose-950/30 border-rose-500"
                            : "bg-slate-900/90 border-indigo-500/30"
                        }`}>
                          <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider font-mono">
                            Lexical AST Bản Mới PW2 (Payload CMS)
                          </div>
                          <div className={`leading-relaxed font-sans p-3 rounded-lg border ${
                            item.status === "fail"
                              ? "bg-rose-950/50 border-rose-500 text-rose-200 font-semibold"
                              : "bg-slate-950/60 border-slate-800 text-slate-200"
                          }`}>
                            {item.pw2Lexical}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium pt-1">
                            Đặc tính: In đậm ({item.pw2StylingCheck.hasBold ? "✓" : "✗"}) • In nghiêng ({item.pw2StylingCheck.hasItalic ? "✓" : "✗"}) • Bảng biểu ({item.pw2StylingCheck.hasTable ? `✓ (${item.pw2StylingCheck.tableColumnsCount} cột)` : "🚨 MẤT THẺ TABLE"})
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Live PW1 MySQL Configuration & Test Modal */}
      {dbModalOpen && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5 text-slate-100 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 rounded-2xl">
                  <Database className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Kết Nối CSDL Live PW1 (MySQL)</h3>
                  <p className="text-xs text-slate-400">Chế độ ĐỌC DỮ LIỆU AN TOÀN (Strictly Read-Only 100%)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDbModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Read-Only Safety Banner */}
            <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
              <ShieldCheck className="size-4 shrink-0 mt-0.5 text-emerald-400" />
              <div className="space-y-1">
                <strong className="font-semibold text-emerald-200">Cam Kết Bảo Mật Read-Only Tuyệt Đối:</strong>
                <p className="text-emerald-400/90 leading-relaxed">
                  Hệ thống chỉ chạy lệnh <code className="bg-emerald-900/60 px-1 py-0.5 rounded font-mono">SELECT</code> và <code className="bg-emerald-900/60 px-1 py-0.5 rounded font-mono">SHOW TABLES</code>. Mọi lệnh ghi (INSERT/UPDATE/DELETE/DROP) đều bị chặn cứng ở cấp mã nguồn và phiên làm việc.
                </p>
              </div>
            </div>

            {/* Connection Status Card */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Trạng Thái Kết Nối Hiện Tại</span>
                {dbStatus?.latencyMs !== undefined && (
                  <span className="text-[11px] font-mono text-slate-500">{dbStatus.latencyMs}ms</span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <span className={`size-3 rounded-full shrink-0 ${dbStatus?.connected ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
                <span className={`text-sm font-bold ${dbStatus?.connected ? "text-emerald-400" : "text-slate-300"}`}>
                  {dbStatus?.connected ? "Đã kết nối Live MySQL thành công" : "Chưa kết nối CSDL thật (Đang dùng dữ liệu mẫu)"}
                </span>
              </div>
              {dbStatus?.message && (
                <p className="text-xs text-slate-400 font-mono bg-slate-900 p-2 rounded-lg border border-slate-800/80 break-all">
                  {dbStatus.message}
                </p>
              )}
              {dbStatus?.connected && dbStatus.tables && (
                <div className="pt-2 text-xs text-slate-300 space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>CSDL: <strong className="text-sky-300 font-mono">{dbStatus.database}</strong> (v{dbStatus.serverVersion})</span>
                    <span>{dbStatus.tablesCount} Bảng</span>
                  </div>
                  <div className="max-h-24 overflow-y-auto bg-slate-900 p-2 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400 flex flex-wrap gap-1">
                    {dbStatus.tables.map((t) => (
                      <span key={t} className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input Form */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  {useSeparateFields ? "Nhập thông số Host / Port / User:" : "Chuỗi kết nối MySQL (PW1_DATABASE_URL):"}
                </label>
                <button
                  type="button"
                  onClick={() => setUseSeparateFields(!useSeparateFields)}
                  className="text-[11px] text-blue-400 hover:text-blue-300 underline font-medium"
                >
                  {useSeparateFields ? "Nhập dạng URL string" : "Nhập từng trường riêng (Host, User...)"}
                </button>
              </div>

              {!useSeparateFields ? (
                <input
                  type="text"
                  placeholder="mysql://user:password@127.0.0.1:3306/legacy_db"
                  value={customDbUrl}
                  onChange={(e) => setCustomDbUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                />
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="col-span-2 sm:col-span-1">
                    <input
                      type="text"
                      placeholder="Host (vd: 127.0.0.1 hoặc db.domain.com)"
                      value={customDbHost}
                      onChange={(e) => setCustomDbHost(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <input
                      type="text"
                      placeholder="Port (mặc định: 3306)"
                      value={customDbPort}
                      onChange={(e) => setCustomDbPort(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="User (vd: qa_readonly)"
                      value={customDbUser}
                      onChange={(e) => setCustomDbUser(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <input
                      type="password"
                      placeholder="Password"
                      value={customDbPassword}
                      onChange={(e) => setCustomDbPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      placeholder="Tên CSDL (Database Name)"
                      value={customDbName}
                      onChange={(e) => setCustomDbName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
              <p className="text-[11px] text-slate-500">
                💡 <em>Mẹo:</em> Bạn cũng có thể lưu trực tiếp vào file <code className="text-slate-400 font-mono">.env.local</code> với biến <code className="text-emerald-400 font-mono">PW1_DATABASE_URL</code> để hệ thống tự động nhận diện vĩnh viễn.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDbModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={isTestingDb}
                onClick={handleTestDbConnection}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-xs font-bold text-white rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 disabled:opacity-50"
              >
                {isTestingDb ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Đang Thử Kết Nối...</span>
                  </>
                ) : (
                  <>
                    <Database className="size-3.5" />
                    <span>⚡ Kiểm Tra Kết Nối MySQL (Ping Test)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
