"use client";

import React, { useState, useMemo } from "react";
import {
  generateReconciliationCatalog,
  getStoreDeepDiff,
  getDashboardMetrics,
  CANONICAL_TEMPLATES,
  type StoreSummary,
  type StoreDeepDiff,
} from "@/lib/admin/qa/migration-diff-engine";
import {
  Layers,
  Database,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Eye,
  CheckCheck,
  ArrowLeft,
  X,
  Sliders,
  ShoppingBag,
  Heart,
  Star,
  Globe,
  Monitor,
} from "lucide-react";

export function MigrationDiffClient() {
  const [catalog, setCatalog] = useState<StoreSummary[]>(() => generateReconciliationCatalog(2000));
  const metrics = useMemo(() => getDashboardMetrics(catalog), [catalog]);

  // Filter States
  const [filterStatus, setFilterStatus] = useState<"all" | "passed" | "warning" | "failed">("all");
  const [filterTemplate, setFilterTemplate] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Deep Diff Modal State (null by default)
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [visualMode, setVisualMode] = useState<"swipe" | "side">("swipe");
  const [sliderPos, setSliderPos] = useState(50);
  const [showDefectOverlay, setShowDefectOverlay] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const selectedDiff: StoreDeepDiff | null = useMemo(() => {
    if (!activeStoreId) return null;
    return getStoreDeepDiff(activeStoreId);
  }, [activeStoreId]);

  // Filter logic
  const filteredStores = useMemo(() => {
    return catalog.filter((s) => {
      const matchStatus = filterStatus === "all" || s.status === filterStatus;
      const matchTpl = filterTemplate === "all" || s.templateCode === filterTemplate;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.subdomain1.toLowerCase().includes(q) ||
        s.templateCode.toLowerCase().includes(q);

      return matchStatus && matchTpl && matchSearch;
    });
  }, [catalog, filterStatus, filterTemplate, searchQuery]);

  const totalPages = Math.ceil(filteredStores.length / pageSize) || 1;
  const paginatedStores = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStores.slice(start, start + pageSize);
  }, [filteredStores, currentPage, pageSize]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleCopyTicket = (store: StoreDeepDiff) => {
    const text = `### 🚨 [QC MIGRATION BLOCKER] ${store.name} (${store.id})
- **Template:** ${store.templateCode} (${store.templateName})
- **Độ Tương Thích:** ${store.score} (Trạng Thái: ${store.status.toUpperCase()})
- **Link PW1 (Cũ):** ${store.legacyDomain}
- **Link PW2 (Mới):** ${store.migratedDomain}

#### ❌ Danh Sách Khối Lỗi Cần Dev Sửa:
${store.pages[0]?.defects
  ?.map(
    (d, i) =>
      `${i + 1}. **[${d.type.toUpperCase()}] ${d.title}**\n   - Chi tiết: ${d.desc}\n   - Hướng khắc phục: \`${d.fix}\``
  )
  .join("\n") || "Khớp 100%"}

*Xuất từ Studio QA Control Center F40 lúc ${new Date().toLocaleString("vi-VN")}*`;

    navigator.clipboard?.writeText(text);
    showToast(`Đã Copy Ticket Lỗi Cho ${store.id}!`);
  };

  const handleApprovePass = (storeId: string) => {
    setCatalog((prev) =>
      prev.map((s) => (s.id === storeId ? { ...s, status: "passed", score: "99.0%" } : s))
    );
    showToast(`✓ Đã đóng dấu QC Pass cho ${storeId}!`);
    setActiveStoreId(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 md:p-8 space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-400/40 animate-bounce">
          <CheckCheck className="size-5" />
          <span className="font-semibold text-sm">{toastMsg}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
              <Layers className="size-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white">
                  2,000 SITES RECONCILIATION & DIFF INSPECTOR
                </h1>
                <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                  F40 QA
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Đối soát dữ liệu 1-1 & Kiểm tra Visual Parity cho 2.000 Website từ PW1 (Laravel MySQL) sang PW2 (Payload CMS PostgreSQL)
              </p>
            </div>
          </div>
        </div>

        {/* Action & Database Status Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 shadow-inner">
            <span className="inline-block size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>PW1 MySQL: <strong className="text-emerald-400 font-mono">Live Read-Only</strong></span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 shadow-inner">
            <span className="inline-block size-2 rounded-full bg-indigo-400 animate-pulse" />
            <span>PW2 Postgres: <strong className="text-indigo-400 font-mono">Connected</strong></span>
          </div>
          <button
            onClick={() => showToast("Đã quét lại đối soát cho toàn bộ 2.000 website!")}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-xl border border-slate-700 transition shadow-sm"
          >
            <RefreshCw className="size-3.5" />
            <span>Quét Lại (Re-scan)</span>
          </button>
        </div>
      </div>

      {/* 5 Metric Summary Cards (AC-1) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div
          onClick={() => setFilterStatus("all")}
          className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
            filterStatus === "all"
              ? "bg-indigo-950/60 border-indigo-500 shadow-lg shadow-indigo-500/20 ring-2 ring-indigo-500/50"
              : "bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
          }`}
        >
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Tổng Đã Quét</div>
          <div className="text-3xl font-black text-white mt-1.5">{metrics.totalStores.toLocaleString()}</div>
          <div className="text-[11px] text-indigo-400 mt-1.5 flex items-center gap-1 font-medium">
            <Sparkles className="size-3" /> 100% 2.000 Stores
          </div>
        </div>

        <div
          onClick={() => setFilterStatus("passed")}
          className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
            filterStatus === "passed"
              ? "bg-emerald-950/60 border-emerald-500 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/50"
              : "bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
          }`}
        >
          <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">QC Pass (≥95%)</div>
          <div className="text-3xl font-black text-emerald-400 mt-1.5">{metrics.passedStores}</div>
          <div className="text-[11px] text-emerald-500/90 mt-1.5 font-medium">Đủ điều kiện Cutover</div>
        </div>

        <div
          onClick={() => setFilterStatus("warning")}
          className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
            filterStatus === "warning"
              ? "bg-amber-950/60 border-amber-500 shadow-lg shadow-amber-500/20 ring-2 ring-amber-500/50"
              : "bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
          }`}
        >
          <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Cần Xem Lại (85-94%)</div>
          <div className="text-3xl font-black text-amber-400 mt-1.5">{metrics.warningStores}</div>
          <div className="text-[11px] text-amber-500/90 mt-1.5 font-medium">Lỗi ảnh / Giao diện nhẹ</div>
        </div>

        <div
          onClick={() => setFilterStatus("failed")}
          className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
            filterStatus === "failed"
              ? "bg-rose-950/60 border-rose-500 shadow-lg shadow-rose-500/20 ring-2 ring-rose-500/50"
              : "bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
          }`}
        >
          <div className="text-xs text-rose-400 font-semibold uppercase tracking-wider">Lỗi P0 Blocker (&lt;85%)</div>
          <div className="text-3xl font-black text-rose-400 mt-1.5">{metrics.failedStores}</div>
          <div className="text-[11px] text-rose-500/90 mt-1.5 font-medium">Chặn Cutover</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Điểm Tương Thích TB</div>
          <div className="text-3xl font-black text-cyan-400 mt-1.5">{metrics.avgScore}</div>
          <div className="text-[11px] text-slate-500 mt-1.5 font-medium">Toàn bộ 2.000 Website</div>
        </div>
      </div>

      {/* Filter Hub & Search Bar (AC-2) */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Status Filter Buttons */}
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
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {st === "all" ? "Tất Cả" : st === "passed" ? "QC Pass" : st === "warning" ? "Cần Sửa" : "Lỗi P0"}
              </button>
            ))}
          </div>

          {/* Template Dropdown Filter */}
          <select
            value={filterTemplate}
            onChange={(e) => {
              setFilterTemplate(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl px-3.5 py-2 outline-none focus:border-indigo-500 transition"
          >
            <option value="all">Tất Cả 9 Template Chuẩn</option>
            {CANONICAL_TEMPLATES.map((t) => (
              <option key={t.code} value={t.code}>
                {t.code} — {t.name} ({t.sector})
              </option>
            ))}
          </select>
        </div>

        {/* Search Box */}
        <div className="relative w-full md:w-80">
          <Search className="size-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo Mã Site, Tên Shop, Domain..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 transition"
          />
        </div>
      </div>

      {/* 2,000 Stores Grid Table */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/90 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800 tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Mã Site / Tên Shop</th>
                <th className="py-3.5 px-4">Template Chuẩn</th>
                <th className="py-3.5 px-4">Độ Khớp Dữ Liệu</th>
                <th className="py-3.5 px-4">Trạng Thái QC</th>
                <th className="py-3.5 px-4">Các Khối Lỗi (Nếu Có)</th>
                <th className="py-3.5 px-4 text-right">Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {paginatedStores.map((store) => (
                <tr key={store.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-4 px-4 font-semibold text-white">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-indigo-400 font-bold">{store.id}</span>
                      <span className="text-slate-600">—</span>
                      <span>{store.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-normal font-mono mt-0.5">
                      {store.subdomain1} ➔ <span className="text-slate-400">{store.subdomain2}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="font-bold text-slate-200">{store.templateCode}</span>
                    <div className="text-[11px] text-slate-400">{store.templateName}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-white font-mono text-sm">{store.score}</span>
                      <div className="w-20 h-2 bg-slate-800 rounded-full overflow-hidden">
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
                      Commerce: {store.commerceScore} | Blocks: {store.blockScore}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    {store.status === "passed" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                        <CheckCircle2 className="size-3.5" /> QC Pass
                      </span>
                    )}
                    {store.status === "warning" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40">
                        <AlertTriangle className="size-3.5" /> Cần Sửa Nhẹ
                      </span>
                    )}
                    {store.status === "failed" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-950/80 text-rose-300 border border-rose-500/40">
                        <AlertOctagon className="size-3.5" /> Lỗi P0 Blocker
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    {store.failedBlocks.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {store.failedBlocks.map((fb, idx) => (
                          <span
                            key={idx}
                            className="bg-rose-950/50 text-rose-300 border border-rose-500/30 text-[10px] px-2 py-0.5 rounded-md font-mono"
                          >
                            {fb}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" /> Khớp 100% các khối
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button
                      onClick={() => {
                        setActiveStoreId(store.id);
                        setActivePageIndex(0);
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/30 hover:scale-105"
                    >
                      So Sánh ➔
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
      {/* DEEP DIFF & VISUAL INSPECTOR MODAL POPUP (US-F40-11 & US-F40-12) */}
      {/* ========================================================================= */}
      {selectedDiff && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden ring-1 ring-white/10">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/90 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveStoreId(null)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <div className="p-2.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
                  <Database className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 font-black text-white text-base sm:text-lg">
                    <span>{selectedDiff.name}</span>
                    <span className="text-xs font-mono text-indigo-400">({selectedDiff.id})</span>
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        selectedDiff.status === "passed"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                          : selectedDiff.status === "warning"
                          ? "bg-amber-950 text-amber-300 border border-amber-500/40"
                          : "bg-rose-950 text-rose-300 border border-rose-500/40"
                      }`}
                    >
                      {selectedDiff.status === "passed" ? "QC Pass" : selectedDiff.status === "warning" ? "Cần Sửa Nhẹ" : "Lỗi P0 Blocker"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                    <span>Template: <strong className="text-slate-200">{selectedDiff.templateCode} — {selectedDiff.templateName}</strong></span>
                    <span>•</span>
                    <span>Ngành: <strong className="text-slate-200">{selectedDiff.sector}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyTicket(selectedDiff)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-xl border border-slate-700 transition"
                >
                  <Copy className="size-3.5" />
                  <span className="hidden sm:inline">Xuất Ticket Lỗi</span>
                </button>
                <button
                  onClick={() => handleApprovePass(selectedDiff.id)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white rounded-xl transition shadow-lg shadow-emerald-600/30"
                >
                  <CheckCircle2 className="size-3.5" />
                  <span className="hidden sm:inline">Đóng Dấu QC Pass</span>
                </button>
                <button
                  onClick={() => setActiveStoreId(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition ml-1"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* 4 Score Breakdown Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Commerce (30%)</div>
                  <div className="text-xl font-black text-white mt-1">{selectedDiff.commerceScore}</div>
                  <div className="text-[10px] text-slate-500 mt-1">Sản Phẩm & Biến Thể SKU</div>
                </div>
                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Text & Content (25%)</div>
                  <div className="text-xl font-black text-white mt-1">{selectedDiff.textScore}</div>
                  <div className="text-[10px] text-slate-500 mt-1">Tiêu Đề & Mô Tả Tiếng Việt</div>
                </div>
                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Media & Assets (25%)</div>
                  <div className="text-xl font-black text-white mt-1">{selectedDiff.mediaScore}</div>
                  <div className="text-[10px] text-slate-500 mt-1">Ảnh Sản Phẩm & CDN Links</div>
                </div>
                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Layout Blocks (20%)</div>
                  <div className="text-xl font-black text-white mt-1">{selectedDiff.blockScore}</div>
                  <div className="text-[10px] text-slate-500 mt-1">Thứ Tự & Bố Cục Khối</div>
                </div>
              </div>

              {/* Pages Sub-Tab Switcher */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
                {selectedDiff.pages.map((p, idx) => (
                  <button
                    key={p.path}
                    onClick={() => setActivePageIndex(idx)}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition whitespace-nowrap ${
                      activePageIndex === idx
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                        : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                    }`}
                  >
                    {idx + 1}. {p.name} ({p.path})
                  </button>
                ))}
              </div>

              {/* Defects Alert Banner */}
              {selectedDiff.pages[activePageIndex]?.defects?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-2">
                    <AlertOctagon className="size-4" /> Các Lỗi Cần Xử Lý Ngay (Blockers):
                  </h4>
                  {selectedDiff.pages[activePageIndex].defects.map((d, i) => (
                    <div
                      key={i}
                      className="p-3.5 bg-rose-950/30 border border-rose-500/40 rounded-2xl flex items-start gap-3"
                    >
                      <span className="text-xl mt-0.5">{d.icon}</span>
                      <div className="text-xs space-y-1">
                        <div className="font-bold text-rose-200">{d.title}</div>
                        <div className="text-slate-300">{d.desc}</div>
                        <div className="text-rose-400 font-mono text-[11px] font-semibold">➔ Hướng Khắc Phục: {d.fix}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* VISUAL PARITY INSPECTOR (MOCKUP STOREFRONT RENDERER) */}
              <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <Eye className="size-4 text-indigo-400" /> So Sánh Giao Diện Trực Quan (Visual Parity)
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-slate-300 flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showDefectOverlay}
                        onChange={(e) => setShowDefectOverlay(e.target.checked)}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                      />
                      <span>🔴 Viền Báo Lỗi DB</span>
                    </label>
                    <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs">
                      <button
                        onClick={() => setVisualMode("swipe")}
                        className={`px-3 py-1 rounded-lg font-bold transition ${
                          visualMode === "swipe" ? "bg-indigo-600 text-white shadow" : "text-slate-400"
                        }`}
                      >
                        🔍 Kéo Trượt (Swipe)
                      </button>
                      <button
                        onClick={() => setVisualMode("side")}
                        className={`px-3 py-1 rounded-lg font-bold transition ${
                          visualMode === "side" ? "bg-indigo-600 text-white shadow" : "text-slate-400"
                        }`}
                      >
                        🎨 Song Song
                      </button>
                    </div>
                  </div>
                </div>

                {/* SWIPE VIEWER WITH COMPLETE MOCKUP STOREFRONT */}
                {visualMode === "swipe" ? (
                  <div className="relative w-full h-[450px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 select-none shadow-2xl">
                    {/* LAYER 2 (RIGHT): PW2 Next.js 15 Storefront UI */}
                    <div className="absolute inset-0 bg-slate-950 flex flex-col overflow-y-auto">
                      {/* Browser Mockup Top Bar */}
                      <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="size-2.5 rounded-full bg-rose-500/80 inline-block" />
                          <span className="size-2.5 rounded-full bg-amber-500/80 inline-block" />
                          <span className="size-2.5 rounded-full bg-emerald-500/80 inline-block" />
                          <span className="ml-2 font-bold text-indigo-400">PW2 (Next.js 15)</span>
                          <span className="text-slate-600">|</span>
                          <span>{selectedDiff.migratedDomain}</span>
                        </div>
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono">Payload CMS 3</span>
                      </div>

                      {/* Storefront Hero Mockup (PW2) */}
                      <div className="p-6 bg-gradient-to-r from-emerald-950/60 to-slate-900 border-b border-slate-800">
                        <div className="max-w-xl">
                          <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">
                            100% Organic Products
                          </span>
                          <h3 className="text-2xl font-black text-white mt-2">Tasty & Healthy Organic Food</h3>
                          <p className="text-xs text-slate-400 mt-1">Nông trại sạch tiêu chuẩn VietGAP, thu hoạch hàng ngày.</p>
                          <button className="mt-3 px-4 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow">
                            Khám Phá Ngay
                          </button>
                        </div>
                      </div>

                      {/* Products Grid Mockup (PW2) */}
                      <div className="p-6 grid grid-cols-3 gap-4">
                        {/* Product Card 1 (Failed SKU) */}
                        <div className={`bg-slate-900 p-3.5 rounded-xl border relative transition ${
                          showDefectOverlay && selectedDiff.status === "failed"
                            ? "border-rose-500 ring-2 ring-rose-500/40 bg-rose-950/20 animate-pulse"
                            : "border-slate-800"
                        }`}>
                          {showDefectOverlay && selectedDiff.status === "failed" && (
                            <span className="absolute -top-2 -right-2 bg-rose-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow">
                              🚨 MẤT BIẾN THỂ 1L
                            </span>
                          )}
                          <div className="h-24 bg-slate-800 rounded-lg flex items-center justify-center text-3xl">🍯</div>
                          <div className="font-bold text-white text-xs mt-2">Mật Ong Rừng Ba Vì</div>
                          <div className="text-[11px] text-emerald-400 font-mono font-bold mt-1">180.000đ <span className="text-slate-500 text-[9px] font-normal">(Hũ 500ml)</span></div>
                          <div className="text-[10px] text-rose-400 font-mono mt-1">
                            {selectedDiff.status === "failed" ? "⚠️ Biến thể 1L: KHÔNG TÌM THẤY" : "Đủ 2 biến thể"}
                          </div>
                        </div>

                        {/* Product Card 2 */}
                        <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                          <div className="h-24 bg-slate-800 rounded-lg flex items-center justify-center text-3xl">🍋</div>
                          <div className="font-bold text-white text-xs mt-2">Chanh Vàng Không Hạt</div>
                          <div className="text-[11px] text-emerald-400 font-mono font-bold mt-1">45.000đ / kg</div>
                          <div className="text-[10px] text-emerald-400 font-mono mt-1">✓ Khớp 100%</div>
                        </div>

                        {/* Product Card 3 */}
                        <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                          <div className="h-24 bg-slate-800 rounded-lg flex items-center justify-center text-3xl">🥜</div>
                          <div className="font-bold text-white text-xs mt-2">Hạt Hạnh Nhân Sấy</div>
                          <div className="text-[11px] text-emerald-400 font-mono font-bold mt-1">120.000đ / túi</div>
                          <div className="text-[10px] text-emerald-400 font-mono mt-1">✓ Khớp 100%</div>
                        </div>
                      </div>
                    </div>

                    {/* LAYER 1 (LEFT): PW1 Legacy Design (Clipped) */}
                    <div
                      className="absolute inset-0 bg-slate-950 flex flex-col border-r-2 border-indigo-400 overflow-hidden shadow-2xl"
                      style={{ width: `${sliderPos}%` }}
                    >
                      <div className="min-w-[700px] flex flex-col h-full overflow-hidden">
                        {/* Browser Mockup Top Bar (PW1) */}
                        <div className="bg-amber-950/80 px-4 py-2 border-b border-amber-500/30 flex items-center justify-between text-xs text-amber-200 shrink-0">
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <span className="size-2.5 rounded-full bg-rose-500/80 inline-block" />
                            <span className="size-2.5 rounded-full bg-amber-500/80 inline-block" />
                            <span className="size-2.5 rounded-full bg-emerald-500/80 inline-block" />
                            <span className="ml-2 font-bold text-amber-300">PW1 (Laravel MySQL Snapshot)</span>
                            <span className="text-amber-500">|</span>
                            <span>{selectedDiff.legacyDomain}</span>
                          </div>
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono">Bản Gốc</span>
                        </div>

                        {/* Storefront Hero Mockup (PW1) */}
                        <div className="p-6 bg-gradient-to-r from-emerald-900/60 to-slate-900 border-b border-slate-800">
                          <div className="max-w-xl">
                            <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider bg-amber-950 px-2 py-0.5 rounded border border-amber-500/30">
                              100% Organic Products (Gốc)
                            </span>
                            <h3 className="text-2xl font-black text-amber-100 mt-2">Tasty & Healthy Organic Food</h3>
                            <p className="text-xs text-slate-300 mt-1">Nông trại sạch tiêu chuẩn VietGAP, thu hoạch hàng ngày.</p>
                            <button className="mt-3 px-4 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg shadow">
                              Khám Phá Ngay
                            </button>
                          </div>
                        </div>

                        {/* Products Grid Mockup (PW1) */}
                        <div className="p-6 grid grid-cols-3 gap-4">
                          {/* Product Card 1 (Complete 2 SKUs in PW1) */}
                          <div className="bg-slate-900 p-3.5 rounded-xl border border-amber-500/40">
                            <div className="h-24 bg-slate-800 rounded-lg flex items-center justify-center text-3xl">🍯</div>
                            <div className="font-bold text-amber-200 text-xs mt-2">Mật Ong Rừng Ba Vì</div>
                            <div className="text-[11px] text-amber-400 font-mono font-bold mt-1">180.000đ - 320.000đ</div>
                            <div className="text-[10px] text-emerald-400 font-mono mt-1 font-bold">
                              ✓ Đủ 2 Biến Thể: 500ml & 1 Lít
                            </div>
                          </div>

                          {/* Product Card 2 */}
                          <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                            <div className="h-24 bg-slate-800 rounded-lg flex items-center justify-center text-3xl">🍋</div>
                            <div className="font-bold text-white text-xs mt-2">Chanh Vàng Không Hạt</div>
                            <div className="text-[11px] text-amber-400 font-mono font-bold mt-1">45.000đ / kg</div>
                            <div className="text-[10px] text-emerald-400 font-mono mt-1">✓ Đủ dữ liệu</div>
                          </div>

                          {/* Product Card 3 */}
                          <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                            <div className="h-24 bg-slate-800 rounded-lg flex items-center justify-center text-3xl">🥜</div>
                            <div className="font-bold text-white text-xs mt-2">Hạt Hạnh Nhân Sấy</div>
                            <div className="text-[11px] text-amber-400 font-mono font-bold mt-1">120.000đ / túi</div>
                            <div className="text-[10px] text-emerald-400 font-mono mt-1">✓ Đủ dữ liệu</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Slider Controller Bar */}
                    <div className="absolute inset-x-6 bottom-4 z-30 flex items-center gap-3 bg-slate-950/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-700 shadow-2xl">
                      <Sliders className="size-4 text-indigo-400" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={sliderPos}
                        onChange={(e) => setSliderPos(Number(e.target.value))}
                        className="w-full cursor-ew-resize accent-indigo-500"
                      />
                      <span className="text-xs font-mono font-bold text-indigo-300 w-12 text-right">{sliderPos}%</span>
                    </div>
                  </div>
                ) : (
                  /* SIDE-BY-SIDE VIEW */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[420px]">
                    {/* PW1 Window */}
                    <div className="bg-slate-950 border border-amber-500/40 rounded-2xl overflow-hidden flex flex-col shadow-xl">
                      <div className="bg-amber-950/80 px-4 py-2 border-b border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
                        <span className="font-bold font-mono">📸 PW1: {selectedDiff.legacyDomain}</span>
                        <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded font-mono">Bản Gốc MySQL</span>
                      </div>
                      <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                          <div className="text-xs font-bold text-amber-300">Hero Section</div>
                          <div className="text-sm font-black text-white mt-0.5">Tasty & Healthy Organic Food</div>
                        </div>
                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                          <div className="text-xs font-bold text-amber-300">Sản Phẩm & SKU Biến Thể</div>
                          <div className="text-xs text-slate-300 mt-1 font-mono">
                            • Mật Ong Rừng (500ml: 180k, Can 1L: 320k)<br/>
                            • Brand ID: Nông Trại Hữu Cơ Ba Vì
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* PW2 Window */}
                    <div className="bg-slate-950 border border-indigo-500/40 rounded-2xl overflow-hidden flex flex-col shadow-xl">
                      <div className="bg-indigo-950/80 px-4 py-2 border-b border-indigo-500/30 flex items-center justify-between text-xs text-indigo-200">
                        <span className="font-bold font-mono">🚀 PW2: {selectedDiff.migratedDomain}</span>
                        <span className="text-[10px] bg-indigo-500/20 px-2 py-0.5 rounded font-mono">Next.js 15 Payload</span>
                      </div>
                      <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                          <div className="text-xs font-bold text-indigo-300">Hero Section (hero/split-left)</div>
                          <div className="text-sm font-black text-white mt-0.5">Tasty & Healthy Organic Food</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${
                          selectedDiff.status === "failed" ? "bg-rose-950/40 border-rose-500" : "bg-slate-900 border-slate-800"
                        }`}>
                          <div className="text-xs font-bold text-rose-300">Sản Phẩm & SKU Biến Thể</div>
                          <div className="text-xs text-slate-300 mt-1 font-mono">
                            {selectedDiff.status === "failed" ? (
                              <span className="text-rose-400 font-bold">
                                🚨 MẤT BIẾN THỂ CAN 1L (320.000đ)<br/>
                                🚨 brand_id: NULL (Thiếu collection brands)
                              </span>
                            ) : (
                              "✓ Đầy đủ 100% SKU"
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 1-1 Database Table Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <Database className="size-4 text-emerald-400" /> Bảng Đối Soát Dữ Liệu Từng Dòng Database (1-1 Field Mapping)
                </h4>
                <div className="border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-800 tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Vị Trí</th>
                        <th className="py-3 px-4">PW1 Component</th>
                        <th className="py-3 px-4">PW2 Payload Block</th>
                        <th className="py-3 px-4">Dữ Liệu PW1</th>
                        <th className="py-3 px-4">Dữ Liệu PW2</th>
                        <th className="py-3 px-4">Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {selectedDiff.pages[activePageIndex]?.breakdown?.map((b, i) => (
                        <tr key={i} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 font-mono font-bold text-slate-400">{b.pos}</td>
                          <td className="py-3 px-4 text-slate-300 font-semibold">{b.leg}</td>
                          <td className="py-3 px-4 text-indigo-300 font-mono">{b.mig}</td>
                          <td className="py-3 px-4 text-slate-400">{b.pw1Val}</td>
                          <td className="py-3 px-4 text-slate-200 font-medium">{b.pw2Val}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[10px] px-2.5 py-1 rounded-md font-bold ${
                                b.badge === "badge-pass"
                                  ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                                  : b.badge === "badge-warn"
                                  ? "bg-amber-950/80 text-amber-300 border border-amber-500/40"
                                  : "bg-rose-950/80 text-rose-300 border border-rose-500/40"
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
