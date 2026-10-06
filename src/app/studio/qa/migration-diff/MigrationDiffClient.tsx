"use client";

import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import DOMPurify from "dompurify";
import type { Detail as F42MigrationDetail } from "./WebsiteMigrationEvidence";
import type { MigrationStore } from "@/lib/admin/qa/website-migration-compare";
import { ReconciliationInspector } from "./ReconciliationInspector";
import { QuickQcMenu } from "./QuickQcMenu";
import { FieldEvidencePanel } from './FieldEvidencePanel';
import { classifyMigrationReport } from '@/lib/admin/qa/migration-report-status';

const REPORT_LABELS = { passed: 'Đạt đối soát', review: 'Cần kiểm tra', failed: 'Có lỗi', insufficient: 'Chưa đủ dữ liệu' } as const;
type ReportFilter = 'all' | keyof typeof REPORT_LABELS;
const REPORT_COLORS = { passed: 'text-emerald-300 bg-emerald-500/10', review: 'text-amber-300 bg-amber-500/10', failed: 'text-rose-300 bg-rose-500/10', insufficient: 'text-sky-300 bg-sky-500/10' } as const;
import {
  type ReconciliationIssue,
  type ReconciliationRun,
  type ReconciliationScope,
  type ReconciliationSnapshot,
} from "@/lib/admin/qa/migration-reconciliation";
import {
  generateReconciliationCatalog,
  getFieldDiffRecordsForPage,
  getStoreDeepDiff,
  getDashboardMetrics,
  CANONICAL_TEMPLATES,
  getVisualDiffGapLabel,
  getFieldEvidenceVisualState,
  hasEntityDiffIssue,
  isStoreDomainSslReady,
  type StoreSummary,
  type StoreDeepDiff,
  type DynamicStorePage,
  type PageBlockItem,
  type EntityGroupType,
  type EntityDiffRecord,
  type FieldDiffItem,
  type StoreFieldDiffAudit,
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
  Info,
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

type FieldDiffSource =
  | "ui_fixture"
  | "catalog_fixture"
  | "pw1_snapshot_unverified"
  | "f42_evidence";
type LoadedFieldDiff = { data: StoreDeepDiff; source: FieldDiffSource };

function getDisplayEvidenceState(field: FieldDiffItem, source: FieldDiffSource) {
  return source === "ui_fixture" || source === "f42_evidence"
    ? getFieldEvidenceVisualState(field)
    : "attention" as const;
}

function isSafeF42FrameUrl(value: string | null | undefined): value is string {
  return Boolean(value?.startsWith("/sites/"));
}

function isSafeF42ExternalUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

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

function websiteStoreSummary(store: MigrationStore): StoreSummary {
  return {
    id: store.storeId, name: store.name, ownerEmail: store.name, domain: store.url,
    templateCode: "—", templateName: "Chưa có evidence template", sector: "",
    legacyDomain: "", migratedDomain: store.url, score: "Chưa đo",
    status: store.qcStatus === "unverified" ? "warning" : store.qcStatus,
    failedBlocks: [`Migrate: ${store.migration}`, `Publish: ${store.publish}`, `Audit: ${store.auditStatus}`, `${store.errors} lỗi / ${store.warnings} cảnh báo`],
    subdomain1: "", subdomain2: "", pageCount: store.pageCount,
    textScore: "Chưa đo", mediaScore: "Chưa đo", commerceScore: "Chưa đo", blockScore: "Chưa đo",
  };
}

function f42BlockType(kind: string): PageBlockItem["blockType"] {
  const normalized = kind.toLowerCase();
  if (normalized.includes("hero")) return "hero";
  if (normalized.includes("banner")) return "banner";
  if (normalized.includes("product")) return "products";
  if (normalized.includes("categor")) return "categories";
  if (normalized.includes("blog") || normalized.includes("post")) return "blog";
  if (normalized.includes("footer")) return "footer";
  if (normalized.includes("contact")) return "contact";
  if (normalized.includes("gallery")) return "gallery";
  return "richtext";
}

function f42PagePath(url: string | null): string {
  if (!url) return "/";
  try {
    return new URL(url, "https://f42.local").pathname || "/";
  } catch {
    return "/";
  }
}

function f42FieldItem(field: {
  field: string;
  source: string;
  current: string;
  status: "match" | "mismatch" | "unverified";
}): FieldDiffItem {
  const isMatch = field.status === "match";
  return {
    fieldName: field.field,
    fieldLabel: field.field,
    legacyKey: `F42 source.${field.field}`,
    migratedKey: `PW2 current.${field.field}`,
    legacyValue: field.source,
    migratedValue: field.current,
    status: isMatch ? "match" : "warning",
    classification: isMatch ? "100% Match" : "P1 Warning",
    diffExplanation:
      field.status === "unverified"
        ? "F42 chưa xác minh field này."
        : field.status === "mismatch"
          ? "F42 ghi nhận giá trị nguồn và PW2 khác nhau."
          : undefined,
  };
}

function emptyF42GroupStats(): StoreFieldDiffAudit["summary"]["groupStats"] {
  return {
    products: { total: 0, pass: 0, warn: 0, fail: 0 },
    variants: { total: 0, pass: 0, warn: 0, fail: 0 },
    banners: { total: 0, pass: 0, warn: 0, fail: 0 },
    richtext: { total: 0, pass: 0, warn: 0, fail: 0 },
    categories: { total: 0, pass: 0, warn: 0, fail: 0 },
    navigation: { total: 0, pass: 0, warn: 0, fail: 0 },
    posts: { total: 0, pass: 0, warn: 0, fail: 0 },
    settings: { total: 0, pass: 0, warn: 0, fail: 0 },
    blocks: { total: 0, pass: 0, warn: 0, fail: 0 },
  };
}

/** Adapts only recorded F42 evidence to the established F40 inspector contract. */
function f42DetailToStoreDeepDiff(detail: F42MigrationDetail): StoreDeepDiff {
  const records: EntityDiffRecord[] = [];
  const pages: DynamicStorePage[] = detail.pages.map((page, pageIndex) => {
    const pageFields = page.fields.map(f42FieldItem);
    if (pageFields.length) {
      records.push({
        id: `f42-page-${page.sourceId}`,
        pageIds: [page.sourceId],
        legacyId: page.sourceId,
        migratedId: page.destinationId,
        entityGroup: "blocks",
        entityName: page.title,
        entityIdentifier: "F42 page mapping",
        matchStatus: pageFields.every((field) => field.status === "match")
          ? "match"
          : "warning",
        totalFields: pageFields.length,
        matchedFields: pageFields.filter((field) => field.status === "match").length,
        discrepancyCount: pageFields.filter((field) => field.status !== "match").length,
        fields: pageFields,
      });
    }
    const blocks: PageBlockItem[] = page.blocks.map((block, blockIndex) => {
      const fields = block.fields.map(f42FieldItem);
      records.push({
        id: `f42-block-${page.sourceId}-${block.sourceId}`,
        pageIds: [page.sourceId],
        legacyId: block.sourceId,
        // F42 only records the source block id. It does not expose a target
        // block id, so copying it here would claim a mapping that does not exist.
        migratedId: null,
        entityGroup: "blocks",
        entityName: block.kind,
        entityIdentifier: `F42 block ${block.sourceId}`,
        matchStatus:
          block.status === "match"
            ? "match"
            : block.status === "mismatch"
              ? "warning"
              : "warning",
        totalFields: fields.length,
        matchedFields: fields.filter((field) => field.status === "match").length,
        discrepancyCount: fields.filter((field) => field.status !== "match").length,
        fields,
      });
      const sourcePreview = Object.fromEntries(
        block.sourceContent.map((item) => [item.field, item.value]),
      );
      return {
        id: block.sourceId,
        order: blockIndex + 1,
        blockType: f42BlockType(block.kind),
        title: `Khối #${blockIndex + 1}: ${block.kind}`,
        pw1Component: block.kind,
        pw2Block: "F42 không lưu loại block PW2",
        pw1Preview: {
          headline: String(sourcePreview.headline ?? sourcePreview.title ?? ""),
          bodyText: String(sourcePreview.description ?? ""),
        },
        pw2Preview: {
          headline: block.fields.find((field) => field.field === "headline")?.current,
          bodyText: block.fields.find((field) => field.field === "description")?.current,
        },
        status: block.status === "match" ? "pass" : "warn",
        discrepancyNote:
          block.status === "unverified"
            ? "F42 chưa xác minh block này."
            : block.status === "mismatch"
              ? "F42 ghi nhận khác biệt cần kiểm tra."
              : undefined,
      };
    });
    return {
      id: page.sourceId,
      name: page.title || `Trang ${pageIndex + 1}`,
      path: f42PagePath(page.url),
      pageType: pageIndex === 0 ? "home" : "custom_page",
      // A page mapping is evidence PW1 existed; it is not evidence of a matching PW1 URL.
      existsInPW1: true,
      existsInPW2: page.destinationId !== null,
      totalBlocks: blocks.length,
      blocks,
      breakdown: [],
      defects: page.audit?.findings.map((finding) => ({
        type: finding.severity.toLowerCase() === "p0" || finding.severity.toLowerCase() === "error" ? "p0" : finding.severity.toLowerCase() === "p2" || finding.severity.toLowerCase() === "info" ? "p2" : "p1",
        icon: "⚠",
        title: finding.code,
        desc: finding.detail,
        fix: "Xem evidence audit F42 và xác minh thủ công.",
      })) ?? [],
      mediaAudits: [],
      textFormatAudits: [],
    };
  });
  if (!pages.length) {
    pages.push({
      id: "f42-no-page-mapping",
      name: "Chưa có page mapping trong F42",
      path: "/",
      pageType: "custom_page",
      existsInPW1: false,
      existsInPW2: false,
      totalBlocks: 0,
      blocks: [],
      breakdown: [],
      defects: [],
      mediaAudits: [],
      textFormatAudits: [],
    });
  }
  const matchedRecords = records.filter((record) => record.matchStatus === "match").length;
  const audit: StoreFieldDiffAudit = {
    storeId: detail.storeId,
    summary: {
      // These are records observed by F42, not database population totals.
      totalEntitiesV1: records.length,
      totalEntitiesV2: 0,
      matchedEntities: matchedRecords,
      missingInPW2Count: pages.filter((page) => !page.existsInPW2).length,
      orphanInPW2Count: 0,
      fieldMatchRate: "F42 không cung cấp % tổng",
      groupStats: emptyF42GroupStats(),
    },
    records,
  };
  const qcStatus = detail.review?.current ? detail.review.verdict : "unverified";
  return {
    id: detail.storeId,
    name: detail.name,
    ownerEmail: "F42 không lưu email chủ shop",
    domain: detail.sourceUrl ?? "Chưa có URL PW1",
    sslReady: Boolean(detail.sourceUrl),
    templateCode: "F42",
    templateName: "Evidence migration",
    sector: "",
    legacyDomain: detail.sourceUrl ?? "",
    migratedDomain: detail.url,
    score: "Chưa đo",
    status:
      qcStatus === "passed"
        ? "passed"
        : qcStatus === "failed"
          ? "failed"
          : "warning",
    textScore: "Chưa đo",
    mediaScore: "Chưa đo",
    commerceScore: "Chưa đo",
    blockScore: "Chưa đo",
    totalPagesInPW1: pages.length,
    totalPagesInPW2: pages.filter((page) => page.existsInPW2).length,
    missingPagesCount: pages.filter((page) => !page.existsInPW2).length,
    pages,
    fieldDiffAudit: audit,
    reconciliationAudit: {
      totalProductsV1: 0,
      totalProductsV2: 0,
      matchedProducts: 0,
      missingVariantsCount: 0,
      droppedBrandCount: 0,
      missingCostCount: 0,
      brokenMediaCount: 0,
      searchParity: "F42 chưa có evidence commerce",
      cartParity: "F42 chưa có evidence commerce",
      filterParity: "F42 chưa có evidence commerce",
      richTextParity: "F42 chưa có evidence commerce",
    },
  };
}

const liveStateLabels: Record<string, string> = {
  completed: "Đã migrate",
  pending: "Chờ migrate",
  running: "Đang migrate",
  failed: "Migrate lỗi",
  published: "Đã publish",
  draft: "Draft",
  checked: "Đã audit",
  "not-checked": "Chưa audit",
  historical: "Audit lịch sử",
  stale: "Audit cũ",
  "needs-fix": "Có lỗi audit",
  "needs-review": "Cần review",
};

function LiveStateBadge({ value }: { value: string }) {
  const color = ["completed", "published", "checked"].includes(value)
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : ["failed", "needs-fix"].includes(value)
      ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
      : "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${color}`}
    >
      {liveStateLabels[value] ?? value}
    </span>
  );
}

export function MigrationDiffClient({ live = false }: { live?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [catalog, setCatalog] = useState<StoreSummary[]>(() => live ? [] : generateReconciliationCatalog(2000));
  const [liveStores,setLiveStores] = useState<MigrationStore[]>([]);
  const refreshCatalogRef = React.useRef<() => Promise<boolean>>(() => Promise.resolve(false));
  const [catalogError,setCatalogError] = useState("");
  const [catalogLoading,setCatalogLoading] = useState(false);
  const liveCatalogRequestRef=React.useRef(0);
  const [liveDetail, setLiveDetail] = useState<F42MigrationDetail | null>(null);
  const [liveDetailError, setLiveDetailError] = useState("");
  const [liveDetailLoading, setLiveDetailLoading] = useState(false);
  const [liveDetailRefresh, setLiveDetailRefresh] = useState(0);
  const liveDetailRequestRef = React.useRef(0);
  const liveStoreById = useMemo(() => new Map(liveStores.map(store => [store.storeId, store])), [liveStores]);
  const metrics = useMemo(() => live ? {
    ...getDashboardMetrics([]), totalStores: catalog.length,
    passedStores: liveStores.filter(store => store.qcStatus === "passed").length,
    warningStores: liveStores.filter(store => store.qcStatus === "warning").length,
    failedStores: liveStores.filter(store => store.qcStatus === "failed").length,
    avgScore: "Chưa đo",
  } : getDashboardMetrics(catalog), [catalog, live, liveStores]);
  const reportByStoreId = useMemo(() => new Map(liveStores.map(store => [store.storeId, classifyMigrationReport(store)])), [liveStores]);
  const reportCounts = useMemo(() => {
    const counts = { passed: 0, review: 0, failed: 0, insufficient: 0 };
    for (const report of reportByStoreId.values()) counts[report.status]++;
    return counts;
  }, [reportByStoreId]);

  // Overview Table Filters
  const [filterStatus, setFilterStatus] = useState<"all" | "passed" | "warning" | "failed" | "unverified">("all");
  const [liveMetricFilter, setLiveMetricFilter] = useState<ReportFilter>("all");
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
  const [reconciliationSourceStoreId, setReconciliationSourceStoreId] = useState("");
  const [reconciliationRunId, setReconciliationRunId] = useState<string | null>(null);
  const [reconciliationRefresh, setReconciliationRefresh] = useState(0);
  const [reconciliationRuns, setReconciliationRuns] = useState<ReconciliationRun[]>([]);
  const [reconciliationRunsTruncated, setReconciliationRunsTruncated] = useState(false);
  const [reconciliationRunsLoading, setReconciliationRunsLoading] = useState(false);
  const [reconciliationRunsError, setReconciliationRunsError] = useState<string | null>(null);
  const [reconciliationIssues, setReconciliationIssues] = useState<ReconciliationIssue[]>([]);
  const [reconciliationIssuesLoading, setReconciliationIssuesLoading] = useState(false);
  const [reconciliationIssuesError, setReconciliationIssuesError] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<"template" | "live_domain">("template");
  const [iframeReloadKey, setIframeReloadKey] = useState(0);
  const pw1DeskIframeRef = React.useRef<HTMLIFrameElement>(null);
  const reconciliationRequestRef = React.useRef(0);
  const reconciliationRunsRequestRef = React.useRef(0);
  const reconciliationIssuesRequestRef = React.useRef(0);
  const pw2DeskIframeRef = React.useRef<HTMLIFrameElement>(null);
  const pw1MobIframeRef = React.useRef<HTMLIFrameElement>(null);
  const pw2MobIframeRef = React.useRef<HTMLIFrameElement>(null);
  const [activeEntityGroup, setActiveEntityGroup] = useState<"all" | EntityGroupType>("all");
  const [fieldStatusFilter, setFieldStatusFilter] = useState<"attention" | "all" | "matched_value" | "matched_empty">("attention");
  const [fieldSearchQuery, setFieldSearchQuery] = useState("");
  const [fieldDiffUiDemo, setFieldDiffUiDemo] = useState(false);
  const [expandedFieldRecordIds, setExpandedFieldRecordIds] = useState<Set<string>>(new Set());
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
  const [useSeparateFields, setUseSeparateFields] = useState(true);
  const [dbTestError, setDbTestError] = useState("");

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
    if (!live) void checkLiveDbStatus();
  }, []);

  const handleTestDbConnection = async () => {
    setIsTestingDb(true);
    setDbTestError("");
    setDbStatus(null);
    try {
      const config = useSeparateFields && (customDbHost || customDbUser || customDbPassword || customDbName || customDbPort !== "3306")
        ? {
            host: customDbHost.trim(),
            port: parseInt(customDbPort.trim() || "3306", 10),
            user: customDbUser.trim(),
            password: customDbPassword,
            database: customDbName.trim(),
          }
        : !useSeparateFields && customDbUrl.trim()
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
      if (!res.ok || !json.data) {
        throw new Error(json.error || "Không kiểm tra được kết nối PW1.");
      }
      if (json.data) {
        setDbStatus(json.data);
        if (json.data.connected) {
          showToast(`🟢 Kết nối Live MySQL thành công! Đã tìm thấy ${json.data.tablesCount} bảng.`);
        } else {
          showToast(`🔴 Không thể kết nối: ${json.data.message}`);
        }
      }
    } catch (err: unknown) {
      setDbTestError(err instanceof Error ? err.message : "Không kiểm tra được kết nối PW1.");
    } finally {
      setIsTestingDb(false);
    }
  };

  useEffect(() => {
    if (!live) return;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => { void refreshCatalogRef.current(); }, 500); };
    window.addEventListener('website-comparison-updated', refresh);
    return () => { clearTimeout(timer); window.removeEventListener('website-comparison-updated', refresh); };
  }, [live]);
  const [loadedFieldDiff, setLoadedFieldDiff] = useState<LoadedFieldDiff | null>(null);
  const fieldDiffRequestRef = React.useRef(0);

  const loadLiveCatalog = async () => {
    if (live) {
      const requestId=++liveCatalogRequestRef.current;
      setCatalogLoading(true);setCatalogError("");
      try {
        const stores: MigrationStore[]=[];
        for(let page=1;;page++) {
          const response=await fetch(`/api/admin/qa/website-migrations?limit=100&page=${page}`,{cache:"no-store"});
          if(!response.ok) {
            const failure = await response.json().catch(() => null);
            throw new Error(failure?.code === 'F42_SOURCE_UNAVAILABLE'
              ? 'Nguồn F42 chưa sẵn sàng. Nhờ team F42 triển khai schema/evidence tương ứng rồi làm mới.'
              : `Không đọc được báo cáo (HTTP ${response.status}). Vui lòng thử lại.`);
          }
          const body=await response.json();stores.push(...body.data.stores);
          if(stores.length>=body.data.total || !body.data.stores.length) break;
        }
        if(requestId!==liveCatalogRequestRef.current)return false;
        setLiveStores(stores);
        setCatalog(stores.map(websiteStoreSummary));
        return true;
      } catch(error) {if(requestId!==liveCatalogRequestRef.current)return false;setCatalogError(error instanceof Error?error.message:"Không đọc được catalog");setCatalog([]);setLiveStores([]);return false;}
      finally {if(requestId===liveCatalogRequestRef.current)setCatalogLoading(false)}
    }
    try {
      const res = await fetch(`/api/qa/migration-diff?limit=2000&_t=${Date.now()}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json.stores && json.stores.length > 0) {
        setCatalog(json.stores);
        return true;
      }
    } catch (err) {
      console.error("[MigrationDiffClient] Failed to load live catalog:", err);
    }
    return false;
  };
  refreshCatalogRef.current = loadLiveCatalog;

  useEffect(() => {
    void loadLiveCatalog();
  }, []);

  useEffect(() => {
    if (!live || !activeStoreId) {
      setLiveDetail(null);
      setLiveDetailError("");
      setLiveDetailLoading(false);
      return;
    }
    const controller = new AbortController();
    const requestId = ++liveDetailRequestRef.current;
    setLiveDetail(null);
    setLiveDetailError("");
    setLiveDetailLoading(true);
    setActivePageIndex(0);
    setReconciliationSourceStoreId(activeStoreId);
    void fetch(`/api/admin/qa/website-migrations?store=${encodeURIComponent(activeStoreId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
        return body.data as F42MigrationDetail;
      })
      .then((detail) => {
        if (!controller.signal.aborted && requestId === liveDetailRequestRef.current)
          setLiveDetail(detail);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && requestId === liveDetailRequestRef.current)
          setLiveDetailError(error instanceof Error ? error.message : "Không đọc được evidence F42");
      })
      .finally(() => {
        if (!controller.signal.aborted && requestId === liveDetailRequestRef.current)
          setLiveDetailLoading(false);
      });
    return () => controller.abort();
  }, [activeStoreId, live, liveDetailRefresh]);

  useEffect(() => {
    if (live || !activeStoreId) {
      setLoadedFieldDiff(null);
      return;
    }
    const requestId = ++fieldDiffRequestRef.current;
    const controller = new AbortController();
    const expectsUiFixture = fieldDiffUiDemo && activeStoreId === "SITE-0001";
    setLoadedFieldDiff(null);
    const fetchDiff = async () => {
      try {
        const uiDemoParam = expectsUiFixture ? "&ui_demo=1" : "";
        const res = await fetch(`/api/qa/migration-diff?store_id=${encodeURIComponent(activeStoreId)}${uiDemoParam}&_t=${Date.now()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const source = json.source as FieldDiffSource | undefined;
        if (
          !controller.signal.aborted &&
          requestId === fieldDiffRequestRef.current &&
          json.data?.id === activeStoreId &&
          source &&
          (source === "ui_fixture") === expectsUiFixture
        ) {
          setLoadedFieldDiff({ data: json.data, source });
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("[MigrationDiffClient] Failed to fetch deep diff, falling back:", err);
        }
      }
    };
    void fetchDiff();
    return () => controller.abort();
  }, [activeStoreId, fieldDiffUiDemo]);

  useEffect(() => {
    setActiveViewTab("live_webview");
  }, [activeStoreId]);

  useEffect(() => {
    setReconciliationRunId(null);
  }, [activeStoreId, reconciliationSourceStoreId]);

  useEffect(() => {
    const isReconciliationTab = activeViewTab === "commerce_reconciliation" || activeViewTab === "settings_reconciliation";
    if (!activeStoreId || !isReconciliationTab || reconciliationDemo || !reconciliationSourceStoreId) {
      setReconciliationRuns([]);
      setReconciliationRunsTruncated(false);
      setReconciliationRunsLoading(false);
      setReconciliationRunsError(null);
      return;
    }
    const controller = new AbortController();
    const requestId = ++reconciliationRunsRequestRef.current;
    const load = async () => {
      setReconciliationRunsLoading(true);
      setReconciliationRunId(null);
      setReconciliationSnapshot(null);
      setReconciliationRuns([]);
      setReconciliationRunsError(null);
      try {
        const response = await fetch(`/api/qa/migration-reconciliation/runs?store_id=${encodeURIComponent(reconciliationSourceStoreId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload: { data?: ReconciliationRun[]; meta?: { truncated?: boolean } } = await response.json();
        const runs = Array.isArray(payload.data) ? payload.data.filter((run) => run.storeId === reconciliationSourceStoreId) : [];
        if (!controller.signal.aborted && requestId === reconciliationRunsRequestRef.current) {
          setReconciliationRuns(runs);
          setReconciliationRunId(runs[0]?.runId ?? null);
          setReconciliationRunsTruncated(payload.meta?.truncated === true);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError") && requestId === reconciliationRunsRequestRef.current) {
          setReconciliationRuns([]);
          setReconciliationRunsTruncated(false);
          setReconciliationRunsError("Kiểm tra ID store nguồn PW1 hoặc quyền truy cập rồi thử lại.");
        }
      } finally {
        if (!controller.signal.aborted && requestId === reconciliationRunsRequestRef.current) setReconciliationRunsLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [activeStoreId, activeViewTab, reconciliationDemo, reconciliationSourceStoreId, reconciliationRefresh]);

  useEffect(() => {
    const scope: ReconciliationScope | null = activeViewTab === "commerce_reconciliation" ? "commerce" : activeViewTab === "settings_reconciliation" ? "settings" : null;
    const selectedRunIsForActiveStore = reconciliationRuns.some(
      (run) => run.runId === reconciliationRunId && run.storeId === reconciliationSourceStoreId,
    );
    if (!scope || !activeStoreId || (!reconciliationDemo && (!reconciliationSourceStoreId || !selectedRunIsForActiveStore))) {
      setReconciliationSnapshot(null);
      setReconciliationLoading(false);
      setReconciliationError(null);
      return;
    }
    const controller = new AbortController();
    const requestId = ++reconciliationRequestRef.current;
    const runParam = reconciliationDemo ? "" : `&run_id=${encodeURIComponent(reconciliationRunId ?? "")}`;
    const selectedStoreId = reconciliationDemo ? activeStoreId : reconciliationSourceStoreId;
    const load = async () => { setReconciliationSnapshot(null); setReconciliationLoading(true); setReconciliationError(null); try { const response = await fetch(`/api/qa/migration-reconciliation?scope=${scope}&store_id=${encodeURIComponent(selectedStoreId)}${runParam}${reconciliationDemo ? "&demo=1" : ""}`, { cache: "no-store", signal: controller.signal }); if (!response.ok) throw new Error(`HTTP ${response.status}`); const payload: { data?: ReconciliationSnapshot } = await response.json(); if (payload.data?.scope !== scope || payload.data.storeId !== selectedStoreId) throw new Error("Phản hồi đối soát không khớp store hoặc phạm vi đang chọn"); if (!controller.signal.aborted && requestId === reconciliationRequestRef.current) setReconciliationSnapshot(payload.data); } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError") && requestId === reconciliationRequestRef.current) { setReconciliationSnapshot(null); setReconciliationError("Không thể tải đối soát. Kiểm tra run đã chọn và quyền truy cập rồi thử lại."); } } finally { if (!controller.signal.aborted && requestId === reconciliationRequestRef.current) setReconciliationLoading(false); } };
    void load(); return () => controller.abort();
  }, [activeStoreId, activeViewTab, reconciliationDemo, reconciliationRunId, reconciliationRuns, reconciliationSourceStoreId]);

  useEffect(() => {
    const selectedRunIsForActiveStore = reconciliationRuns.some(
      (run) => run.runId === reconciliationRunId && run.storeId === reconciliationSourceStoreId,
    );
    if (!activeStoreId || !selectedRunIsForActiveStore || reconciliationDemo) {
      setReconciliationIssues([]);
      setReconciliationIssuesLoading(false);
      setReconciliationIssuesError(null);
      return;
    }
    const controller = new AbortController();
    const requestId = ++reconciliationIssuesRequestRef.current;
    const load = async () => {
      setReconciliationIssuesLoading(true);
      setReconciliationIssuesError(null);
      try {
        const response = await fetch(`/api/qa/migration-reconciliation/issues?store_id=${encodeURIComponent(reconciliationSourceStoreId)}&run_id=${encodeURIComponent(reconciliationRunId ?? "")}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload: { data?: ReconciliationIssue[] } = await response.json();
        if (!controller.signal.aborted && requestId === reconciliationIssuesRequestRef.current) {
          setReconciliationIssues(Array.isArray(payload.data) ? payload.data : []);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError") && requestId === reconciliationIssuesRequestRef.current) {
          setReconciliationIssues([]);
          setReconciliationIssuesError("Kiểm tra migration run đã chọn rồi thử lại.");
        }
      } finally {
        if (!controller.signal.aborted && requestId === reconciliationIssuesRequestRef.current) setReconciliationIssuesLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [activeStoreId, reconciliationDemo, reconciliationRunId, reconciliationRuns, reconciliationSourceStoreId]);

  const selectedDiff: StoreDeepDiff | null = useMemo(() => {
    if (live) return liveDetail ? f42DetailToStoreDeepDiff(liveDetail) : null;
    if (!activeStoreId) return null;
    if (loadedFieldDiff?.data.id === activeStoreId) return loadedFieldDiff.data;
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
  }, [activeStoreId, resolvedStoreIds, loadedFieldDiff, catalog, live, liveDetail]);

  const fieldDiffSource: FieldDiffSource = live
    ? "f42_evidence"
    : loadedFieldDiff?.data.id === activeStoreId
      ? loadedFieldDiff.source
      : "catalog_fixture";

  const activePage = selectedDiff?.pages[activePageIndex] || selectedDiff?.pages[0];

  useEffect(() => {
    if (live || !activeStoreId || !activePage) {
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
  }, [activeStoreId, activePage?.id, useDemoRenderEvidence, live]);

  const evidenceByLegacyId = useMemo(
    () => new Map(renderEvidence?.blocks.map((item) => [item.legacyId, item]) ?? []),
    [renderEvidence],
  );

  // Dispatch smooth SPA navigation to live storefront iframes when user switches page tabs
  useEffect(() => {
    if (!live && activePage && previewSource === "template") {
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
  }, [activePageIndex, activePage, previewSource, selectedDiff?.id, live]);

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
      const matchStatus = live || filterStatus === "all" || s.status === filterStatus;
      const matchMetric =
        !live ||
        liveMetricFilter === "all" ||
        reportByStoreId.get(s.id)?.status === liveMetricFilter;
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

      return matchStatus && matchMetric && matchTpl && matchSearch;
    });
  }, [
    catalog,
    filterStatus,
    filterTemplate,
    searchQuery,
    live,
    liveMetricFilter,
    liveStoreById,
    reportByStoreId,
  ]);

  const totalPages = Math.ceil(filteredStores.length / pageSize) || 1;
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);
  const paginatedStores = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStores.slice(start, start + pageSize);
  }, [filteredStores, currentPage, pageSize]);

  const scopedFieldRecords = useMemo(() => {
    if (!selectedDiff?.fieldDiffAudit?.records || !activePage) return [];
    return getFieldDiffRecordsForPage(selectedDiff.fieldDiffAudit, activePage.id);
  }, [selectedDiff, activePage?.id]);

  // Apply the non-status filters first so summary counts always describe the current scope.
  const baseFilteredFieldRecords = useMemo(() => {
    return scopedFieldRecords.filter((r) => {
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
  }, [scopedFieldRecords, activeEntityGroup, showOnlyErrors, fieldSearchQuery]);

  const filteredFieldRecords = useMemo(() => {
    if (fieldStatusFilter === "all") return baseFilteredFieldRecords;
    return baseFilteredFieldRecords.filter((record) =>
      fieldStatusFilter === "attention"
        ? fieldDiffSource !== "ui_fixture" || hasEntityDiffIssue(record)
        : record.fields.some((field) => getDisplayEvidenceState(field, fieldDiffSource) === fieldStatusFilter),
    );
  }, [baseFilteredFieldRecords, fieldStatusFilter, fieldDiffSource]);

  const fieldEvidenceCounts = useMemo(() => {
    const fields = baseFilteredFieldRecords.flatMap((record) => record.fields);
    return {
      attention: fields.filter((field) => getDisplayEvidenceState(field, fieldDiffSource) === "attention").length,
      matched_value: fields.filter((field) => getDisplayEvidenceState(field, fieldDiffSource) === "matched_value").length,
      matched_empty: fields.filter((field) => getDisplayEvidenceState(field, fieldDiffSource) === "matched_empty").length,
      recordsWithAttention: fieldDiffSource === "ui_fixture" || fieldDiffSource === "f42_evidence"
        ? baseFilteredFieldRecords.filter(hasEntityDiffIssue).length
        : baseFilteredFieldRecords.length,
    };
  }, [baseFilteredFieldRecords, fieldDiffSource]);

  useEffect(() => {
    setExpandedFieldRecordIds(
      new Set(scopedFieldRecords.filter(hasEntityDiffIssue).map((record) => record.id)),
    );
  }, [activeStoreId, activePage?.id, scopedFieldRecords]);

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
    const requestId = ++fieldDiffRequestRef.current;
    const expectsUiFixture = fieldDiffUiDemo && storeId === "SITE-0001";
    let acceptedSource: FieldDiffSource | null = null;

    try {
      const uiDemoParam = expectsUiFixture ? "&ui_demo=1" : "";
      const res = await fetch(`/api/qa/migration-diff?store_id=${encodeURIComponent(storeId)}${uiDemoParam}&_t=${Date.now()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        const source = json.source as FieldDiffSource | undefined;
        if (
          json.data?.id === storeId &&
          source &&
          requestId === fieldDiffRequestRef.current &&
          (source === "ui_fixture") === expectsUiFixture
        ) {
          setLoadedFieldDiff({ data: json.data, source });
          acceptedSource = source;
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
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      console.error("[MigrationDiffClient] Failed to reload store diff:", err);
    } finally {
      if (requestId === fieldDiffRequestRef.current) {
        setIsReloading(false);
        if (acceptedSource) {
          setIframeReloadKey((k) => k + 1);
          showToast(
            acceptedSource === "pw1_snapshot_unverified"
              ? "✓ Đã đọc lại PW1. PW2 vẫn chưa được kết nối để đối soát."
              : acceptedSource === "ui_fixture"
              ? "✓ Đã nạp lại dữ liệu mẫu UI."
              : "✓ Đã nạp lại catalog đối soát.",
          );
        } else {
          showToast("⚠ Không thể nạp lại dữ liệu đối soát. Vui lòng thử lại.");
        }
      }
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
    <div data-testid={live ? "website-migration-live" : undefined} className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 md:p-8 space-y-6 font-sans">
      {live && <><p className="rounded-xl border border-sky-800 bg-sky-950/30 p-3 text-sm text-sky-200">Độ khớp nội dung website so với PW2 hiện tại; kết luận QC thủ công hiển thị riêng. {!catalogLoading && !catalogError && <>Phạm vi: {catalog.length} website trong catalog hiện tại, chưa phải toàn bộ nguồn migration. </>}Làm mới tính lại đối soát nội dung website; không chạy lại audit trình duyệt hoặc đối soát Commerce/BE.</p>{catalogLoading && <p role="status">Đang đọc danh sách migrate…</p>}{catalogError && <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 text-amber-200">{catalogError} Chưa thể xác định số website hoặc kết quả đối soát.</p>}</>}
      {live && activeStoreId && liveDetailLoading && (
        <div className="fixed inset-0 z-[999999] grid place-items-center bg-slate-950/80 text-sm text-slate-200">
          Đang đọc evidence F42…
        </div>
      )}
      {live && activeStoreId && liveDetailError && (
        <div className="fixed inset-0 z-[999999] grid place-items-center bg-slate-950/80 p-6">
          <div className="max-w-md rounded-2xl border border-rose-500/40 bg-slate-900 p-5 text-sm text-rose-200">
            <p>{liveDetailError}</p>
            <button className="mt-4 rounded-lg border border-slate-600 px-3 py-2 text-slate-100" onClick={() => setActiveStoreId(null)}>
              Đóng
            </button>
          </div>
        </div>
      )}
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
            aria-label="Cấu hình nguồn dữ liệu"
            aria-haspopup="dialog"
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
              {live ? <strong className="text-sky-300">Migration DB / audit</strong> : dbStatus?.connected ? (
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
            disabled={catalogLoading}
            onClick={async () => {
              if (!live) void checkLiveDbStatus();
              const loaded = await loadLiveCatalog();
              if (loaded) showToast(live ? "Đã đọc lại evidence đã lưu cho catalog website." : "Đã làm mới dữ liệu đối soát.");
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-xl border border-slate-700/80 transition shadow-sm"
          >
            <RefreshCw className="size-3.5 text-slate-400" />
            <span>{catalogLoading ? "Đang tải…" : live ? "Làm mới evidence" : "Làm Mới Đối Soát"}</span>
          </button>
        </div>
      </div>

      {/* 5 Metric Summary Cards */}
      {(!live || (!catalogLoading && !catalogError)) && <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <button
          type="button"
          aria-pressed={filterStatus === "all" && liveMetricFilter === "all"}
          data-testid={live ? "migration-metric-all" : undefined}
          onClick={() => {
            setFilterStatus("all");
            setLiveMetricFilter("all");
            setCurrentPage(1);
          }}
          className={`w-full cursor-pointer p-4 rounded-2xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
            filterStatus === "all" && liveMetricFilter === "all"
              ? "bg-slate-900 border-2 border-blue-400 shadow-[0_0_24px_-3px_rgba(59,130,246,0.38)] ring-2 ring-blue-500/40"
              : "bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80"
          }`}
        >
          <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Tổng Số Website</div>
          <div className="text-2xl font-bold text-white mt-1">{metrics.totalStores.toLocaleString()}</div>
          <div className="text-[11px] text-blue-400 mt-1 flex items-center gap-1 font-medium">
            <Sparkles className="size-3" /> {live ? `${catalog.length} Website` : "2.000 Website"}
          </div>
        </button>

        <button
          type="button"
          aria-pressed={live ? liveMetricFilter === "passed" : filterStatus === "passed"}
          data-testid={live ? "migration-metric-passed" : undefined}
          onClick={() => {
            setFilterStatus(live ? "all" : "passed");
            setLiveMetricFilter(live ? "passed" : "all");
            setCurrentPage(1);
          }}
          className={`w-full cursor-pointer p-4 rounded-2xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
            (live ? liveMetricFilter === "passed" : filterStatus === "passed")
              ? "bg-emerald-950/20 border-2 border-emerald-400 shadow-[0_0_24px_-3px_rgba(16,185,129,0.38)] ring-2 ring-emerald-500/40"
              : "bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80"
          }`}
        >
          <div className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">{live ? "Đạt đối soát" : "Khớp Chuẩn (≥95%)"}</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{live ? reportCounts.passed : metrics.passedStores}</div>
          <div className="text-[11px] text-emerald-400/80 mt-1 font-medium">{live ? "Đủ bằng chứng toàn bộ phạm vi" : "Đủ điều kiện Cutover"}</div>
        </button>

        <button
          type="button"
          aria-pressed={live ? liveMetricFilter === "review" : filterStatus === "warning"}
          data-testid={live ? "migration-metric-review" : undefined}
          onClick={() => {
            setFilterStatus(live ? "all" : "warning");
            setLiveMetricFilter(live ? "review" : "all");
            setCurrentPage(1);
          }}
          className={`w-full cursor-pointer p-4 rounded-2xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
            (live ? liveMetricFilter === "review" : filterStatus === "warning")
              ? "bg-amber-950/20 border-2 border-amber-400 shadow-[0_0_24px_-3px_rgba(245,158,11,0.38)] ring-2 ring-amber-500/40"
              : "bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80"
          }`}
        >
          <div className="text-[11px] text-amber-400 font-semibold uppercase tracking-wider">{live ? "Cần kiểm tra" : "Cần Xem Lại (85-94%)"}</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{live ? reportCounts.review : metrics.warningStores}</div>
          <div className="text-[11px] text-amber-400/80 mt-1 font-medium">{live ? "Cảnh báo / cần kiểm chứng lại" : "Lệch ảnh / Map / Text"}</div>
        </button>

        <button
          type="button"
          aria-pressed={live ? liveMetricFilter === "failed" : filterStatus === "failed"}
          data-testid={live ? "migration-metric-failed" : undefined}
          onClick={() => {
            setFilterStatus(live ? "all" : "failed");
            setLiveMetricFilter(live ? "failed" : "all");
            setCurrentPage(1);
          }}
          className={`w-full cursor-pointer p-4 rounded-2xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
            (live ? liveMetricFilter === "failed" : filterStatus === "failed")
              ? "bg-rose-950/20 border-2 border-rose-400 shadow-[0_0_24px_-3px_rgba(244,63,94,0.38)] ring-2 ring-rose-500/40"
              : "bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80"
          }`}
        >
          <div className="text-[11px] text-rose-400 font-semibold uppercase tracking-wider">{live ? "Có lỗi" : "Lỗi Dữ Liệu P0 (<85%)"}</div>
          <div className="text-2xl font-bold text-rose-400 mt-1">{live ? reportCounts.failed : metrics.failedStores}</div>
          <div className="text-[11px] text-rose-400/80 mt-1 font-medium">{live ? "Migration / audit / dữ liệu sai lệch" : "Chặn Cutover"}</div>
        </button>

        <button
          type="button"
          aria-pressed={live && liveMetricFilter === "insufficient"}
          data-testid={live ? "migration-metric-insufficient" : undefined}
          onClick={() => {
            if (!live) return;
            setFilterStatus("all");
            setLiveMetricFilter("insufficient");
            setCurrentPage(1);
          }}
          className={`w-full cursor-pointer p-4 rounded-2xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
            live ? "cursor-pointer" : ""
          } ${
            live && liveMetricFilter === "insufficient"
              ? "border-2 border-sky-400 bg-sky-950/20 ring-2 ring-sky-500/40 shadow-[0_0_24px_-3px_rgba(56,189,248,0.38)]"
              : "border-slate-800/80 bg-slate-900/50"
          }`}
        >
          <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{live ? "Chưa đủ dữ liệu" : "Độ Khớp Trung Bình"}</div>
          <div className="text-2xl font-bold text-sky-400 mt-1">{live ? reportCounts.insufficient : metrics.avgScore}</div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">{live ? "Team migration bổ sung evidence" : "Toàn bộ hệ thống"}</div>
        </button>
      </div>

      {/* Filter Hub & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800/80 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {live && (
            <span className="text-[11px] font-semibold text-slate-400">
              Kết quả tự động:
            </span>
          )}
          <div
            aria-label={live ? "Lọc kết quả tự động" : undefined}
            className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800"
          >
            {live ? (['all', 'passed', 'review', 'failed', 'insufficient'] as ReportFilter[]).map(status => (
              <button key={status} type="button" aria-pressed={liveMetricFilter === status}
                onClick={() => { setLiveMetricFilter(status); setCurrentPage(1); }}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${liveMetricFilter === status ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-400 hover:text-slate-200'}`}>
                {status === 'all' ? 'Tất cả' : `${REPORT_LABELS[status]} (${reportCounts[status]})`}
              </button>
            )) : (["all", "passed", "warning", "failed"] as Array<typeof filterStatus>).map((st) => (
              <button
                key={st}
                onClick={() => {
                  setFilterStatus(st);
                  setLiveMetricFilter("all");
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  filterStatus === st
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {st === "all"
                  ? "Tất Cả"
                  : st === "passed"
                    ? "QC Pass"
                    : st === "warning"
                      ? "Cần Xem Lại"
                      : "Lỗi P0"}
              </button>
            ))}
          </div>

          {/* Custom Template Filter Dropdown Popover */}
          {!live && <div className="relative" ref={templateDropdownRef}>
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
          </div>}
        </div>

        <div className="relative w-full md:w-96">
          <Search className="size-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label={live ? "Tìm store" : undefined}
            placeholder={live ? "Tìm tên store, đường dẫn, ID PW1…" : "Tìm theo Email khách hàng, Domain, Mã Site..."}
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
          <table className={`w-full text-left text-xs text-slate-300 ${live ? "min-w-[1040px] table-fixed" : ""}`}>
            {live && <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '32%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>}
            <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800 tracking-wider">
              <tr>
                <th className="py-3.5 px-4 whitespace-nowrap">{live ? "Store / Đường dẫn PW2" : "Email Khách Hàng / Domain"}</th>
                <th className="py-3.5 px-4 whitespace-nowrap">{live ? "Migration / Publish" : "Giao Diện Mẫu"}</th>
                <th className="py-3.5 px-4">{live ? "Độ khớp website (%) / Kết quả tự động" : "Độ Khớp Dữ Liệu"}</th>
                <th className="py-3.5 px-4 whitespace-nowrap">{live ? "QC thủ công" : "Trạng Thái QC"}</th>
                <th className="py-3.5 px-4 whitespace-nowrap">{live ? "Số trang" : "Số Trang & Lỗi / Cảnh Báo"}</th>
                <th className="py-3.5 px-4 text-right">Đối Soát Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {paginatedStores.map((store) => (
                <tr key={store.id} data-testid={`migration-store-row-${store.id}`} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-4 px-4 font-semibold text-white whitespace-nowrap overflow-hidden">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 font-mono text-xs font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
                        {store.id}
                      </span>
                      <span className="truncate text-slate-100 font-semibold" title={store.ownerEmail}>{store.ownerEmail}</span>
                    </div>
                    <div className="text-[12px] text-slate-400 font-normal font-mono mt-1 flex items-center gap-1.5">
                      <Globe className="size-3 text-slate-500 shrink-0" />
                      <span>{store.domain}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    {live ? (
                      <div className="flex flex-col items-start gap-1.5">
                        <LiveStateBadge value={liveStoreById.get(store.id)?.migration ?? "pending"} />
                        <LiveStateBadge value={liveStoreById.get(store.id)?.publish ?? "draft"} />
                      </div>
                    ) : (
                      <>
                        <span className="font-bold text-slate-200">{store.templateCode}</span>
                        <div className="text-[11px] text-slate-400">{store.templateName}</div>
                      </>
                    )}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    {live ? (
                      (() => {
                        const source = liveStoreById.get(store.id);
                        const evidence = source?.websiteComparison;
                        const report = reportByStoreId.get(store.id);
                        const percentage = evidence?.percentage ?? null;
                        const noDataReason = !evidence?.total ? 'Chưa có dữ liệu đối soát website' : null;
                        const accepted = percentage === 100;
                        const tone = accepted ? 'bg-emerald-400' : (percentage ?? 0) >= 85 ? 'bg-amber-400' : 'bg-rose-500';
                        const track = accepted ? 'bg-emerald-400/15' : (percentage ?? 0) >= 85 ? 'bg-amber-400/15' : 'bg-rose-500/15';
                        const fieldErrors = evidence?.mismatched ?? 0;
                        const primaryReason = report?.reasons.find(reason => !/trường|field evidence|Audit hiện tại báo lỗi|cảnh báo audit/.test(reason));
                        const shortReason = primaryReason
                          ?.replace('Chưa có audit hoàn chỉnh cho phiên bản hiện tại.', 'Chưa audit phiên bản này')
                          .replace('Migration thất bại; kiểm tra lỗi của lần chạy F42.', 'Migration thất bại')
                          .replace('Audit đã cũ hoặc chưa xác nhận phiên bản; cần chạy lại audit.', 'Audit cũ — cần chạy lại')
                          .replace('Kết luận QC trước không còn hiệu lực; cần kiểm tra lại phần thay đổi.', 'Dữ liệu thay đổi — cần QC lại')
                          .replace('Website PW2 chưa publish; cần kiểm tra trạng thái phát hành.', 'PW2 chưa publish')
                          .replace('Audit còn hạng mục chờ dữ liệu backend.', 'Audit chờ dữ liệu backend');
                        const historicalAudit = source?.auditStatus === 'stale' || source?.auditStatus === 'historical';
                        return <div data-testid="migration-match-rate" className="max-w-sm space-y-1 text-[11px] text-slate-400"
                          title="Độ khớp website = field website khớp / tổng field cần đối soát. Gồm xác nhận ảnh thủ công còn hiệu lực; không phải tỷ lệ Commerce/BE hoặc kết luận QC giao diện.">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold font-mono tabular-nums text-white">{percentage === null ? '—' : `${percentage}%`}</span>
                            <>{percentage !== null && <div role="progressbar" aria-label="Độ khớp website" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}
                              aria-valuetext={`${percentage}% khớp`} className={`h-1.5 w-24 overflow-hidden rounded-full ${track}`}>
                              <div className={`h-full rounded-full ${tone}`} style={{ width: `${percentage}%` }} />
                            </div>}</>
                          </div>
                          {report && <span data-testid="migration-auto-status" title={report.reasons.join('\n')} className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${REPORT_COLORS[report.status]}`}>{REPORT_LABELS[report.status]}</span>}
                          {noDataReason && <p className="text-amber-200">{noDataReason}</p>}
                          {evidence && evidence.total > 0 && <p>Khớp {evidence.matched}/{evidence.total} field website{fieldErrors > 0 ? ` · ${fieldErrors} field khác` : ''}{evidence.unverified > 0 ? ` · ${evidence.unverified} chưa xác minh` : ''}</p>}
                          {shortReason && <p className="truncate" title={primaryReason}>{shortReason}</p>}
                          {source && source.errors + source.warnings > 0 && <p>Audit{historicalAudit ? ' cũ' : ''}: {source.errors} lỗi · {source.warnings} cảnh báo</p>}
                        </div>;
                      })()
                    ) : (
                      <>
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
                      </>
                    )}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    {store.status === "passed" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                        <CheckCircle2 className="size-3.5" /> {live ? "Pass" : "Khớp Chuẩn"}
                      </span>
                    )}
                    {live && liveStoreById.get(store.id)?.qcStatus === "unverified" && <span className="text-xs text-slate-400">Chưa kiểm chứng</span>}
                    {store.status === "warning" && (!live || liveStoreById.get(store.id)?.qcStatus !== "unverified") && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
                        <AlertTriangle className="size-3.5" /> Cần Xem Lại
                      </span>
                    )}
                    {store.status === "failed" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 whitespace-nowrap">
                        <AlertOctagon className="size-3.5" /> {live ? "Failed" : "Lỗi P0 Blocker"}
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 border border-slate-700/50 px-2 py-0.5 rounded whitespace-nowrap">
                        {store.pageCount} Trang
                      </span>
                      {!live && (store.failedBlocks.length > 0 ? (
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
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right whitespace-nowrap">
                    <button
                      data-testid={`migration-store-compare-${store.id}`}
                      onClick={() => {
                        setLoadedFieldDiff(null);
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
                {live
                  ? "Không có website thuộc kết quả tự động và từ khóa đã chọn."
                  : <>Không tìm thấy website nào khớp với từ khóa &ldquo;{searchQuery}&rdquo;</>}
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Vui lòng kiểm tra lại Email khách hàng, Domain hoặc chuyển bộ lọc trạng thái sang &ldquo;Tất Cả&rdquo;.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                {(filterStatus !== "all" || liveMetricFilter !== "all") && (
                  <button
                    onClick={() => {
                      setFilterStatus("all");
                      setLiveMetricFilter("all");
                      setCurrentPage(1);
                    }}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-xl border border-slate-700 transition"
                  >
                    Bỏ lọc (Tìm trong Tất Cả)
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
          <div
            data-testid="migration-pagination"
            className="flex items-center gap-2"
          >
            <button
              aria-label="Trang trước"
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
              aria-label="Trang sau"
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
      </>}
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
            <div className="relative p-4 pr-16 sm:p-5 sm:pr-16 border-b border-slate-800/80 bg-slate-950 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0">
              <div className="flex min-w-0 flex-1 items-center gap-3.5">
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
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 id="modal-store-title" className="text-lg font-bold text-white tracking-tight">{selectedDiff.name}</h2>
                    <span className="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
                      {selectedDiff.id}
                    </span>
                    {!live && (
                      <span className="text-xs text-slate-200 font-medium bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded-md">
                        📧 {selectedDiff.ownerEmail}
                      </span>
                    )}
                    <span className="min-w-0 max-w-full break-all text-xs text-slate-300 font-mono bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded-md flex items-center gap-1">
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
                      {live
                        ? liveDetail?.review?.current && liveDetail.review.verdict
                          ? `QC: ${liveDetail.review.verdict === "passed" ? "Pass" : liveDetail.review.verdict === "failed" ? "Failed" : "Cần xem lại"}`
                          : "QC chưa kiểm chứng"
                        : selectedDiff.status === "passed"
                          ? "✓ QC Pass (99.8%)"
                          : selectedDiff.status === "warning"
                            ? "⚠️ Cần Xem Lại"
                            : "🚨 Lỗi P0 Blocker"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                    <span>Gốc: <strong className="text-slate-200">{live ? "F42 evidence migration" : `${selectedDiff.templateCode} (${selectedDiff.templateName})`}</strong></span>
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
              <div className="flex max-w-full shrink-0 items-center gap-2.5 overflow-x-auto whitespace-nowrap [&>*]:shrink-0">
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
                  onClick={() => {
                    setReconciliationRefresh((value) => value + 1);
                    if (live) {
                      setLiveDetailRefresh((value) => value + 1);
                      void loadLiveCatalog();
                      return;
                    }
                    void handleReloadStoreData(selectedDiff.id);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700/80 transition shadow-sm disabled:opacity-50"
                  title={live ? "Đọc lại evidence F42 và trạng thái PW2" : "Quét lại dữ liệu từ MySQL PW1 và Postgres PW2 sau khi Dev đã sửa"}
                >
                  <RefreshCw className={`size-3.5 ${isReloading ? "animate-spin text-blue-400" : "text-slate-400"}`} />
                  <span>{isReloading ? "Đang Quét Lại..." : live ? "Làm mới evidence" : "Quét Lại CSDL"}</span>
                </button>
                {live && activeStoreId && <QuickQcMenu
                  key={activeStoreId}
                  store={activeStoreId}
                  version={liveDetail?.review?.version}
                  ready={liveDetail?.migration === "completed" && Boolean(liveDetail?.attemptId)}
                  onSaved={() => {
                    setLiveDetailRefresh((value) => value + 1);
                    void loadLiveCatalog();
                    showToast("Đã lưu đánh giá QC.");
                  }}
                />}
              </div>
              <button
                type="button"
                aria-label="Đóng màn hình so sánh"
                title="Đóng màn hình so sánh"
                onClick={() => setActiveStoreId(null)}
                className="absolute right-4 top-4 sm:right-5 sm:top-5 flex size-9 items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition border border-slate-700/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
              >
                <X className="size-4" />
              </button>
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
              <div className="min-h-0 flex-1 overflow-y-auto" data-testid="migration-reconciliation-scroll">
              {live && reconciliationSourceStoreId === activeStoreId && <FieldEvidencePanel
                key={`${activeStoreId}-${activeViewTab}`}
                store={reconciliationSourceStoreId}
                scope={activeViewTab === 'commerce_reconciliation' ? 'commerce' : 'settings'}
                refresh={reconciliationRefresh}
              />}
              <ReconciliationInspector
                scope={activeViewTab === "commerce_reconciliation" ? "commerce" : "settings"}
                snapshot={reconciliationSnapshot}
                loading={reconciliationLoading}
                error={reconciliationError}
                isDemo={reconciliationDemo}
                onToggleDemo={setReconciliationDemo}
                sourceStoreId={reconciliationSourceStoreId}
                onSourceStoreChange={(storeId) => {
                  setReconciliationSourceStoreId(storeId);
                  setReconciliationRunId(null);
                  setReconciliationRuns([]);
                  setReconciliationRunsTruncated(false);
                  setReconciliationSnapshot(null);
                  setReconciliationIssues([]);
                }}
                runId={reconciliationRunId}
                runs={reconciliationRuns}
                runsTruncated={reconciliationRunsTruncated}
                runsLoading={reconciliationRunsLoading}
                runsError={reconciliationRunsError}
                onRunChange={(runId) => {
                  setReconciliationRunId(runId);
                  setReconciliationSnapshot(null);
                  setReconciliationIssues([]);
                }}
                issues={reconciliationIssues}
                issuesLoading={reconciliationIssuesLoading}
                issuesError={reconciliationIssuesError}
              />
              </div>
            ) : activeViewTab === "visual_stream" ? (
              live ? (
                <div className="flex-1 overflow-y-auto bg-slate-900/30 p-5 sm:p-6">
                  <section className="mx-auto max-w-6xl space-y-5">
                    <div className="rounded-2xl border border-sky-500/30 bg-slate-950 p-5 shadow-xl">
                      <div className="flex items-start gap-3">
                        <BlockTreeIcon className="mt-0.5 size-5 shrink-0 text-sky-400" />
                        <div>
                          <h3 className="text-base font-bold text-white">Evidence khối từ F42</h3>
                          <p className="mt-1 text-xs leading-5 text-slate-300">
                            F42 lưu nội dung nguồn, giá trị PW2 và trạng thái field. F42 không lưu ảnh chụp hay cấu trúc render của từng block, nên màn này không giả lập giao diện sản phẩm/blog từ dữ liệu mẫu.
                          </p>
                        </div>
                      </div>
                    </div>

                    {liveDetail?.pages
                      .find((page) => page.sourceId === activePage.id)
                      ?.blocks.some((block) => !showOnlyErrors || block.status !== "match") ? (
                      liveDetail.pages
                        .find((page) => page.sourceId === activePage.id)!
                        .blocks.filter((block) => !showOnlyErrors || block.status !== "match")
                        .map((block, index) => (
                          <article key={block.sourceId} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-lg">
                            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/70 px-5 py-4">
                              <div>
                                <p className="font-mono text-[10px] text-slate-500">PW1 block ID: {block.sourceId}</p>
                                <h4 className="mt-1 text-sm font-bold text-white">#{index + 1} · {block.kind}</h4>
                              </div>
                              <LiveStateBadge value={block.status === "match" ? "completed" : block.status === "mismatch" ? "needs-fix" : "not-checked"} />
                            </header>
                            <div className="overflow-x-auto p-5">
                              <table className="w-full min-w-[640px] text-left text-xs">
                                <thead className="border-b border-slate-800 text-[10px] uppercase text-slate-500">
                                  <tr><th className="pb-2 pr-4">Field</th><th className="pb-2 pr-4 text-amber-300">PW1 source</th><th className="pb-2 pr-4 text-sky-300">PW2 current</th><th className="pb-2">F42</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/70 text-slate-300">
                                  {block.fields.map((field) => (
                                    <tr key={field.field}>
                                      <td className="py-3 pr-4 font-mono text-slate-400">{field.field}</td>
                                      <td className="max-w-sm break-words py-3 pr-4">{field.source || <span className="italic text-slate-600">trống</span>}</td>
                                      <td className="max-w-sm break-words py-3 pr-4">{field.current || <span className="italic text-slate-600">trống</span>}</td>
                                      <td className="py-3"><LiveStateBadge value={field.status === "match" ? "checked" : field.status === "mismatch" ? "needs-fix" : "not-checked"} /></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </article>
                        ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 px-6 py-12 text-center text-sm text-slate-400">
                        {showOnlyErrors ? "Không có block F42 cần xem trên trang này." : "F42 chưa có block evidence cho trang này."}
                      </div>
                    )}
                  </section>
                </div>
              ) : (
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
              )
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
                      {live ? (
                        <div className="flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-950/20 px-3 py-1.5 text-xs text-sky-200">
                          <Globe className="size-3" />
                          <span>URL nguồn và URL PW2 từ evidence F42</span>
                        </div>
                      ) : (() => {
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
                    {live && activePageIndex > 0 && (
                      <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
                        F42 chỉ lưu URL PW1 của homepage. Khung bên trái đang hiển thị homepage PW1, không phải URL tương ứng của trang PW2 đang chọn.
                      </p>
                    )}
                    {live && !isSafeF42ExternalUrl(liveDetail?.sourceUrl) && (
                      <p className="rounded-lg border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-xs text-rose-100">
                        F42 không có URL PW1 công khai an toàn. Không thay thế bằng giao diện mẫu.
                      </p>
                    )}
                    {live && isSafeF42ExternalUrl(liveDetail?.sourceUrl) && (
                      <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
                        PW1 được nhúng từ URL snapshot F42 để đối chiếu song song. Nếu khung PW1 trống, server PW1 đang chặn nhúng bằng CSP/X-Frame; cần bổ sung domain của F40 vào <code>frame-ancestors</code> trên PW1.
                      </p>
                    )}
                    {live && (() => {
                      const audit = liveDetail?.pages.find((page) => page.sourceId === activePage.id)?.audit;
                      if (!audit) return null;
                      return (
                        <div className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                          <span className="font-semibold text-sky-200">F42 audit:</span> {audit.status}{audit.stale ? " · dữ liệu audit cũ" : ""}{audit.findings.length ? ` · ${audit.findings.length} finding` : " · không có finding"}
                        </div>
                      );
                    })()}
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
                            if (live)
                              return `👈 PW1 homepage F42 • ${isSafeF42ExternalUrl(liveDetail?.sourceUrl) ? liveDetail.sourceUrl : "Chưa có URL công khai an toàn"}`;
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
                            if (live) return isSafeF42ExternalUrl(liveDetail?.sourceUrl) ? liveDetail.sourceUrl : "#";
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
                          {live
                            ? `👉 PW2 F42 • ${liveDetail?.pages.find((page) => page.sourceId === activePage.id)?.url ?? liveDetail?.url ?? "Chưa có URL"}`
                            : previewSource === "template"
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
                              live
                                ? (() => {
                                    const url = liveDetail?.pages.find((page) => page.sourceId === activePage.id)?.url ?? liveDetail?.url;
                                    return isSafeF42FrameUrl(url) ? url : "#";
                                  })()
                                : previewSource === "template"
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
                    const f42Page = liveDetail?.pages.find(
                      (page) => page.sourceId === activePage.id,
                    );
                    // F42 stores one PW1 homepage URL only. Never synthesize a
                    // PW1 page URL from PW2 path, or replace missing evidence with a template.
                    const f42PW1Url = isSafeF42ExternalUrl(liveDetail?.sourceUrl)
                      ? liveDetail.sourceUrl
                      : null;
                    const f42PW2Candidate = f42Page?.url ?? liveDetail?.url;
                    const f42PW2Url = isSafeF42FrameUrl(f42PW2Candidate)
                      ? f42PW2Candidate
                      : null;

                    const isDomainSslReady = isStoreDomainSslReady(selectedDiff);
                    const pw1Url = live
                      ? f42PW1Url ?? "about:blank"
                      : (previewSource === "live_domain" && isDomainSslReady)
                        ? pw1LiveDomainUrl
                        : pw1TemplateUrl;
                    const pw2Url = live
                      ? f42PW2Url ?? "about:blank"
                      : previewSource === "template"
                        ? pw2TemplateUrl
                        : pw2LiveDomainUrl;
                    const pw1IframeSandbox = live
                      ? "allow-scripts allow-forms allow-popups"
                      : "allow-scripts allow-same-origin allow-forms allow-popups";
                    // PW2 is an internal /sites route from this same trusted app.
                    // It needs same-origin access for Next.js to hydrate correctly.
                    const pw2IframeSandbox = "allow-scripts allow-same-origin allow-forms allow-popups";

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
                              sandbox={pw1IframeSandbox}
                              referrerPolicy="no-referrer"
                              onLoad={() => {
                                if (!live && (previewSource === "template" || !isDomainSslReady)) {
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
                              sandbox={pw2IframeSandbox}
                              referrerPolicy="no-referrer"
                              onLoad={() => {
                                if (!live && previewSource === "template") {
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
                              sandbox={pw1IframeSandbox}
                              referrerPolicy="no-referrer"
                              onLoad={() => {
                                if (!live && (previewSource === "template" || !isDomainSslReady)) {
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
                              sandbox={pw2IframeSandbox}
                              referrerPolicy="no-referrer"
                              onLoad={() => {
                                if (!live && previewSource === "template") {
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
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <SlidersHorizontal className="size-5 text-blue-400" />
                      <span>Đối soát trường dữ liệu 1-to-1</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Quét record cần xem trước, rồi mở chi tiết field khi cần đối chiếu. Không dùng tỷ lệ xanh để thay thế mapping PW1→PW2 đã được xác nhận.
                    </p>
                    <p className="text-xs text-indigo-300 mt-2" data-testid="field-diff-page-scope">
                      Phạm vi trang: <strong>{activePage.name}</strong> ({activePage.path})
                    </p>
                    <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2 text-xs leading-5 text-amber-100/90">
                      <strong>Nguồn dữ liệu:</strong>{" "}
                      {fieldDiffSource === "ui_fixture"
                        ? "fixture UI phục vụ kiểm thử, không phải migration thực tế."
                        : fieldDiffSource === "f42_evidence"
                        ? "evidence thực tế F42: giá trị nguồn/PW2 và trạng thái từng field được đọc từ migration run. F42 không lưu đủ định danh block PW2 hoặc tổng số bản ghi CSDL."
                        : fieldDiffSource === "pw1_snapshot_unverified"
                        ? "mới đọc PW1; PW2 và mapping định danh chưa được đọc. Không có field nào được xem là khớp migration."
                        : "catalog minh họa; chưa thay thế mapping PW1→PW2 đã được xác nhận."}
                    </p>
                    {activeStoreId === "SITE-0001" && (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          data-testid="field-diff-ui-demo-toggle"
                          aria-pressed={fieldDiffUiDemo}
                          onClick={() => setFieldDiffUiDemo((current) => !current)}
                          className={`rounded-lg border px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                            fieldDiffUiDemo
                              ? "border-amber-400/60 bg-amber-950/50 text-amber-100"
                              : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
                          }`}
                        >
                          {fieldDiffUiDemo ? "Tắt dữ liệu mẫu UI" : "Dùng dữ liệu mẫu UI"}
                        </button>
                        {fieldDiffUiDemo && (
                          <span data-testid="field-diff-ui-demo-notice" className="rounded-lg border border-amber-400/40 bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-100">
                            DỮ LIỆU MẪU UI — không phải kết quả migration thực tế.
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-3.5 py-2 text-xs">
                      <div className="text-[10px] font-semibold uppercase text-amber-300/75">Cần xem</div>
                      <div className="font-mono text-sm font-bold text-amber-200">{fieldEvidenceCounts.recordsWithAttention} record</div>
                    </div>
                    <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 px-3.5 py-2 text-xs">
                      <div className="text-[10px] font-semibold uppercase text-rose-300/75">Field lệch / thiếu</div>
                      <div className="font-mono text-sm font-bold text-rose-200">{fieldEvidenceCounts.attention}</div>
                    </div>
                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-3.5 py-2 text-xs">
                      <div className="text-[10px] font-semibold uppercase text-emerald-300/75">Khớp có dữ liệu</div>
                      <div className="font-mono text-sm font-bold text-emerald-200">{fieldEvidenceCounts.matched_value}</div>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs">
                      <div className="text-[10px] font-semibold uppercase text-slate-400">Cả hai trống</div>
                      <div className="font-mono text-sm font-bold text-slate-200">{fieldEvidenceCounts.matched_empty}</div>
                    </div>
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

                  <div className="flex w-full flex-wrap gap-1.5 md:w-auto" aria-label="Lọc theo trạng thái đối soát">
                    {[
                      { key: "attention", label: "Field cần xem", count: fieldEvidenceCounts.attention },
                      { key: "matched_value", label: "Khớp có dữ liệu", count: fieldEvidenceCounts.matched_value },
                      { key: "matched_empty", label: "Cả hai trống", count: fieldEvidenceCounts.matched_empty },
                      { key: "all", label: "Tất cả", count: baseFilteredFieldRecords.length },
                    ].map((filter) => (
                      <button
                        key={filter.key}
                        data-testid={`field-status-filter-${filter.key}`}
                        type="button"
                        onClick={() => {
                          setFieldStatusFilter(filter.key as typeof fieldStatusFilter);
                          if (filter.key !== "attention") setShowOnlyErrors(false);
                        }}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                          fieldStatusFilter === filter.key
                            ? "border-sky-500/60 bg-sky-950/50 text-sky-100"
                            : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                        }`}
                      >
                        {filter.label} <span className="font-mono opacity-75">{filter.count} {filter.key === "all" ? "record" : "field"}</span>
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full md:w-64">
                    <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      aria-label="Tìm trường, SKU hoặc khóa CSDL"
                      placeholder="Tìm trường, SKU, khóa CSDL..."
                      value={fieldSearchQuery}
                      onChange={(e) => setFieldSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Entity Cards & Field Breakdown Tables */}
                <div className="space-y-4">
                  {filteredFieldRecords.length === 0 ? (
                    <div data-testid="field-diff-empty-state" className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 px-6 py-12 text-center">
                      <Search className="mx-auto size-6 text-slate-500" aria-hidden="true" />
                      <p className="mt-3 text-sm font-bold text-slate-200">Không có record phù hợp bộ lọc</p>
                      <p className="mt-1 text-xs text-slate-400">Đổi trạng thái, loại dữ liệu hoặc từ khóa để tiếp tục đối soát.</p>
                      <button
                        type="button"
                        onClick={() => { setFieldStatusFilter("all"); setActiveEntityGroup("all"); setFieldSearchQuery(""); setShowOnlyErrors(false); }}
                        className="mt-4 rounded-lg border border-sky-500/40 px-3 py-2 text-xs font-bold text-sky-200 hover:bg-sky-950/40"
                      >
                        Xóa bộ lọc
                      </button>
                    </div>
                  ) : filteredFieldRecords.map((record) => (
                    <article
                      key={record.id}
                      data-testid={`field-diff-record-${record.id}`}
                      className={`rounded-2xl border overflow-hidden shadow-lg transition ${
                        record.matchStatus === "missing_in_pw2" || record.matchStatus === "orphan_in_pw2" || record.matchStatus === "error"
                          ? "bg-rose-950/15 border-rose-500 ring-1 ring-rose-500/40"
                          : record.matchStatus === "warning"
                          ? "bg-amber-950/15 border-amber-500 ring-1 ring-amber-500/40"
                          : "bg-slate-950 border-slate-800"
                      }`}
                    >
                      {/* Entity Header */}
                      <button
                        type="button"
                        data-testid={`field-diff-toggle-${record.id}`}
                        aria-controls={`field-diff-details-${record.id}`}
                        aria-expanded={expandedFieldRecordIds.has(record.id)}
                        onClick={() => setExpandedFieldRecordIds((current) => {
                          const next = new Set(current);
                          if (next.has(record.id)) next.delete(record.id); else next.add(record.id);
                          return next;
                        })}
                        className="w-full p-4 bg-slate-950/90 border-b border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-left transition hover:bg-slate-900/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400"
                      >
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
                              {fieldDiffSource === "f42_evidence" ? (
                                <>F42 source ID: <strong className="text-amber-400">{record.legacyId}</strong> · PW2 block ID: <strong className="text-slate-500">F42 không lưu</strong></>
                              ) : (
                                <>MySQL Key ID: <strong className="text-amber-400">{record.legacyId}</strong> ➔ Postgres ID:{" "}
                                  {record.migratedId ? (
                                    <strong className="text-indigo-300">{record.migratedId}</strong>
                                  ) : (
                                    <strong className="text-rose-400">🚨 CHƯA CÓ TRÊN PW2</strong>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end md:self-auto">
                          {fieldDiffSource === "catalog_fixture" || fieldDiffSource === "pw1_snapshot_unverified" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-500/50">
                              <Info className="size-3.5" /> CHƯA XÁC MINH PW2
                            </span>
                          ) : record.matchStatus === "missing_in_pw2" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-500 animate-pulse">
                              <AlertOctagon className="size-3.5" /> 🚨 MẤT BẢN GHI TRÊN PW2
                            </span>
                          ) : record.matchStatus === "orphan_in_pw2" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-500/50">
                              <AlertOctagon className="size-3.5" /> ⚠️ BẢN GHI DƯ TRÊN PW2
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
                          <ChevronDown className={`size-4 text-slate-400 transition-transform ${expandedFieldRecordIds.has(record.id) ? "rotate-180" : ""}`} aria-hidden="true" />
                        </div>
                      </button>

                      {/* 1-to-1 Field Matrix Table */}
                      <div
                        id={`field-diff-details-${record.id}`}
                        hidden={!expandedFieldRecordIds.has(record.id)}
                        className="overflow-x-auto"
                      >
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                            <tr>
                              <th className="min-w-56 py-3 px-4">Trường & mapping</th>
                              <th className="min-w-52 py-3 px-4 text-amber-300/80">Giá trị PW1</th>
                              <th className="min-w-52 py-3 px-4 text-sky-300/80">
                                {fieldDiffSource === "pw1_snapshot_unverified" ? "PW2 chưa đọc được" : "Giá trị PW2"}
                              </th>
                              <th className="min-w-56 py-3 px-4">Kết quả / thao tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50 text-[11px] font-mono">
                            {record.fields.filter((field) => fieldStatusFilter === "all" || (
                              fieldStatusFilter === "attention"
                                ? getDisplayEvidenceState(field, fieldDiffSource) === "attention"
                                : getDisplayEvidenceState(field, fieldDiffSource) === fieldStatusFilter
                            )).length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-4 py-5 font-sans text-slate-400">
                                  Bản ghi cần xử lý ở cấp record; chưa có field nào thuộc trạng thái đang lọc để đối chiếu.
                                </td>
                              </tr>
                            ) : record.fields
                              .filter((field) => fieldStatusFilter === "all" || (
                                fieldStatusFilter === "attention"
                                  ? getDisplayEvidenceState(field, fieldDiffSource) === "attention"
                                  : getDisplayEvidenceState(field, fieldDiffSource) === fieldStatusFilter
                              ))
                              .map((field, fIdx) => (
                              <tr
                                key={fIdx}
                                data-evidence-state={getDisplayEvidenceState(field, fieldDiffSource)}
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
                                  <div className="mt-1.5 break-words text-[10px] font-mono font-normal leading-4 text-slate-500">
                                    <span className="text-amber-400/90">{field.legacyKey}</span>
                                    <span className="mx-1 text-slate-600">→</span>
                                    <span className="text-sky-400/90">{field.migratedKey}</span>
                                  </div>
                                </td>
                                <td className={`max-w-sm py-3.5 px-4 font-sans break-words ${getDisplayEvidenceState(field, fieldDiffSource) === "matched_empty" ? "text-slate-500" : "text-slate-200"}`}>
                                  {field.legacyValue !== null ? (
                                    String(field.legacyValue) || <span className="italic">trống</span>
                                  ) : (
                                    <span className="text-slate-600 italic">null</span>
                                  )}
                                </td>
                                <td className={`max-w-sm py-3.5 px-4 font-sans break-words ${getDisplayEvidenceState(field, fieldDiffSource) === "matched_empty" ? "text-slate-500" : "text-slate-200"}`}>
                                  {fieldDiffSource === "pw1_snapshot_unverified" ? (
                                    <span className="text-amber-300 italic">Chưa đọc nguồn PW2</span>
                                  ) : field.migratedValue !== null ? (
                                    <span>{String(field.migratedValue) || <span className="italic">trống</span>}</span>
                                  ) : field.legacyValue === null ? (
                                    <span className="text-slate-500 italic">NULL (cần xác minh)</span>
                                  ) : (
                                    <span className="text-rose-400 font-bold italic">🚨 NULL (Bị Mất)</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 font-sans align-top">
                                  {fieldDiffSource === "catalog_fixture" || fieldDiffSource === "pw1_snapshot_unverified" ? (
                                    <span className="text-amber-300 font-bold flex items-center gap-1">
                                      <Info className="size-3.5" /> Chưa xác minh PW2
                                    </span>
                                  ) : getDisplayEvidenceState(field, fieldDiffSource) === "matched_value" ? (
                                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                                      <Check className="size-3.5" /> Khớp có dữ liệu
                                    </span>
                                  ) : getDisplayEvidenceState(field, fieldDiffSource) === "matched_empty" ? (
                                    <span className="text-slate-400 font-bold flex items-center gap-1">
                                      <Info className="size-3.5" /> Cả hai trống
                                    </span>
                                  ) : field.status === "match" && field.legacyValue === null && field.migratedValue === null ? (
                                    <span className="text-amber-300 font-bold flex items-center gap-1">
                                      <Info className="size-3.5" /> Cả hai NULL — cần xác minh
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
                                  {getDisplayEvidenceState(field, fieldDiffSource) === "attention" && (field.remediationAction ? (
                                    <div className="text-[11px] bg-slate-900 p-2 rounded-lg border border-slate-800 text-indigo-300">
                                      {field.remediationAction}
                                    </div>
                                  ) : (
                                    <span className="mt-2 block text-[11px] text-slate-400">Chưa có hướng dẫn khắc phục.</span>
                                  ))}
                                </td>
                              </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </article>
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
          <div role="dialog" aria-modal="true" aria-labelledby="migration-db-dialog-title" className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5 text-slate-100 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 rounded-2xl">
                  <Database className="size-5" />
                </div>
                <div>
                  <h3 id="migration-db-dialog-title" className="text-base font-bold text-white">{live ? "Nguồn dữ liệu F42 và kết nối PW1" : "Kết Nối CSDL Live PW1 (MySQL)"}</h3>
                  <p className="text-xs text-slate-400">Kiểm tra kết nối dữ liệu nguồn</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDbModalOpen(false)}
                aria-label="Đóng cấu hình nguồn dữ liệu"
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="size-5" />
              </button>
            </div>

            {live && (
              <div className="rounded-2xl border border-sky-500/30 bg-sky-950/30 p-4 text-xs text-sky-100 space-y-2">
                <strong>Nguồn đang dùng: migration F42</strong>
                <p>Danh sách website, mapping và audit được đọc từ DB của hệ thống qua backend.</p>
                <p>Kiểm tra kết nối MySQL PW1 bên dưới không thay đổi nguồn F42 và không chạy lại migration.</p>
              </div>
            )}
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
                <span>Trạng thái kiểm tra MySQL PW1</span>
                {dbStatus?.latencyMs !== undefined && (
                  <span className="text-[11px] font-mono text-slate-500">{dbStatus.latencyMs}ms</span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <span className={`size-3 rounded-full shrink-0 ${dbStatus?.connected ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
                <span className={`text-sm font-bold ${dbStatus?.connected ? "text-emerald-400" : "text-slate-300"}`}>
                  {dbStatus?.connected ? "Đã kết nối MySQL PW1 thành công" : dbStatus ? "Chưa kết nối được MySQL PW1" : "Chưa kiểm tra kết nối MySQL PW1"}
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
              <p className="text-xs text-slate-300">Nhập thông tin để kiểm tra DB PW1. Host/Port phải khớp server PW1 được quản trị viên cấu hình. Kết quả chỉ dùng cho lần kiểm tra này, không lưu mật khẩu hoặc đổi nguồn F42. Để trống toàn bộ để kiểm tra kết nối mặc định.</p>
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
                  type="password"
                  aria-label="URL kết nối MySQL PW1"
                  autoComplete="off"
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
                      aria-label="Host PW1"
                      value={customDbHost}
                      onChange={(e) => setCustomDbHost(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <input
                      type="text"
                      placeholder="Port (mặc định: 3306)"
                      aria-label="Port PW1"
                      value={customDbPort}
                      onChange={(e) => setCustomDbPort(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="User (vd: qa_readonly)"
                      aria-label="User PW1"
                      autoComplete="off"
                      value={customDbUser}
                      onChange={(e) => setCustomDbUser(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <input
                      type="password"
                      placeholder="Password"
                      aria-label="Password PW1"
                      autoComplete="new-password"
                      value={customDbPassword}
                      onChange={(e) => setCustomDbPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      placeholder="Tên CSDL (Database Name)"
                      aria-label="Database PW1"
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

            {dbTestError && <p role="alert" className="text-xs text-rose-300">{dbTestError}</p>}
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
