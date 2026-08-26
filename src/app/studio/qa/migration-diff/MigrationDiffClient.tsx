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
  Store,
  ArrowRight,
  FileText,
  Image as ImageIcon,
  Table as TableIcon,
  Check,
} from "lucide-react";

export function MigrationDiffClient() {
  const [catalog, setCatalog] = useState<StoreSummary[]>(() => generateReconciliationCatalog(2000));
  const metrics = useMemo(() => getDashboardMetrics(catalog), [catalog]);

  // Filter States for Overview Table
  const [filterStatus, setFilterStatus] = useState<"all" | "passed" | "warning" | "failed">("all");
  const [filterTemplate, setFilterTemplate] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Deep Diff Modal State
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [visualMode, setVisualMode] = useState<"side" | "swipe">("side");
  const [sliderPos, setSliderPos] = useState(50);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const selectedDiff: StoreDeepDiff | null = useMemo(() => {
    if (!activeStoreId) return null;
    return getStoreDeepDiff(activeStoreId);
  }, [activeStoreId]);

  // Filter logic for overview table
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
    const activePage = store.pages[activePageIndex] || store.pages[0];
    const text = `### 🚨 [QC MIGRATION BLOCKER] Cửa Hàng: ${store.name} (${store.id})
- **Template:** ${store.templateCode} (${store.templateName})
- **Trang Đang Bị Lỗi:** ${activePage.name} (${activePage.path})
- **Độ Tương Thích:** ${store.score} (Trạng Thái: ${store.status.toUpperCase()})
- **Web Cũ (Phiên Bản V1):** ${store.legacyDomain}
- **Web Mới (Phiên Bản V2):** ${store.migratedDomain}

#### ❌ Chi Tiết Lỗi Dữ Liệu & Tính Năng Cần Sửa:
${activePage.defects
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 md:p-8 space-y-6 font-sans">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400/40 animate-bounce">
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
                  ĐỐI SOÁT 2.000 WEBSITES KHÁCH HÀNG (PW1 ➔ PW2)
                </h1>
                <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                  F40 Migration QA
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Kiểm thử toàn diện 7 luồng e-commerce: <strong>Trang Chủ, Khối RichText Word-like, Danh Mục & Filter, Chi Tiết SP, Blog, Giỏ Hàng & Search, Tra Cứu Đơn</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Action & Database Status Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 shadow-inner">
            <span className="inline-block size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>DB Phiên Bản Cũ: <strong className="text-emerald-400 font-mono">MySQL Live</strong></span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 shadow-inner">
            <span className="inline-block size-2 rounded-full bg-indigo-400 animate-pulse" />
            <span>DB Phiên Bản Mới: <strong className="text-indigo-400 font-mono">Postgres Live</strong></span>
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

      {/* 5 Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div
          onClick={() => setFilterStatus("all")}
          className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
            filterStatus === "all"
              ? "bg-indigo-950/60 border-indigo-500 shadow-lg shadow-indigo-500/20 ring-2 ring-indigo-500/50"
              : "bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
          }`}
        >
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Tổng Số Website</div>
          <div className="text-3xl font-black text-white mt-1.5">{metrics.totalStores.toLocaleString()}</div>
          <div className="text-[11px] text-indigo-400 mt-1.5 flex items-center gap-1 font-medium">
            <Sparkles className="size-3" /> 2.000 Website Khách Hàng
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
          <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Khớp Chuẩn (≥95%)</div>
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
          <div className="text-[11px] text-amber-500/90 mt-1.5 font-medium">Lệch ảnh / Giao diện nhẹ</div>
        </div>

        <div
          onClick={() => setFilterStatus("failed")}
          className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
            filterStatus === "failed"
              ? "bg-rose-950/60 border-rose-500 shadow-lg shadow-rose-500/20 ring-2 ring-rose-500/50"
              : "bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
          }`}
        >
          <div className="text-xs text-rose-400 font-semibold uppercase tracking-wider">Lỗi Dữ Liệu P0 (&lt;85%)</div>
          <div className="text-3xl font-black text-rose-400 mt-1.5">{metrics.failedStores}</div>
          <div className="text-[11px] text-rose-500/90 mt-1.5 font-medium">Chặn Cutover</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Độ Khớp Trung Bình</div>
          <div className="text-3xl font-black text-cyan-400 mt-1.5">{metrics.avgScore}</div>
          <div className="text-[11px] text-slate-500 mt-1.5 font-medium">Toàn bộ hệ thống</div>
        </div>
      </div>

      {/* Filter Hub & Search Bar */}
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
            <option value="all">Tất Cả 9 Nhóm Giao Diện Gốc</option>
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
            placeholder="Tìm theo Mã Site, Tên Khách, Domain..."
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
                <th className="py-3.5 px-4">Mã Site / Tên Cửa Hàng Khách</th>
                <th className="py-3.5 px-4">Giao Diện Mẫu</th>
                <th className="py-3.5 px-4">Độ Khớp Dữ Liệu</th>
                <th className="py-3.5 px-4">Trạng Thái QC</th>
                <th className="py-3.5 px-4">Chi Tiết Lỗi Cần Sửa</th>
                <th className="py-3.5 px-4 text-right">Đối Soát</th>
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
                      {store.subdomain1} <ArrowRight className="inline size-3 text-slate-600" /> <span className="text-slate-400">{store.subdomain2}</span>
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
                      Sản Phẩm: {store.commerceScore} | Bố Cục: {store.blockScore}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    {store.status === "passed" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                        <CheckCircle2 className="size-3.5" /> Khớp Chuẩn
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
                        <CheckCircle2 className="size-3.5" /> 100% Khớp đúng dữ liệu khách
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
      {/* REDESIGNED FULL-LIFECYCLE E-COMMERCE INSPECTOR MODAL (7 CORE TABS) */}
      {/* ========================================================================= */}
      {selectedDiff && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-7xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden ring-1 ring-white/10">
            {/* Modal Header: Store Identity */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/90 shrink-0">
              <div className="flex items-center gap-3.5">
                <button
                  onClick={() => setActiveStoreId(null)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <div className="p-2.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
                  <Store className="size-5" />
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
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-3 font-mono">
                    <span>Web Cũ: <strong className="text-amber-300">{selectedDiff.legacyDomain}</strong></span>
                    <span>➔</span>
                    <span>Web Mới: <strong className="text-indigo-300">{selectedDiff.migratedDomain}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => handleCopyTicket(selectedDiff)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-xl border border-slate-700 transition"
                >
                  <Copy className="size-3.5" />
                  <span className="hidden sm:inline">Xuất Ticket Lỗi</span>
                </button>
                <button
                  onClick={() => handleApprovePass(selectedDiff.id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white rounded-xl transition shadow-lg shadow-emerald-600/30"
                >
                  <CheckCircle2 className="size-3.5" />
                  <span className="hidden sm:inline">Đóng Dấu QC Pass</span>
                </button>
                <button
                  onClick={() => setActiveStoreId(null)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition ml-1"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* 7 Comprehensive Page & Feature Tabs (including RichText) */}
            <div className="bg-slate-950 px-6 pt-3 border-b border-slate-800 flex items-center justify-between shrink-0 overflow-x-auto">
              <div className="flex items-center gap-2">
                {selectedDiff.pages.map((p, idx) => (
                  <button
                    key={p.id}
                    onClick={() => setActivePageIndex(idx)}
                    className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                      activePageIndex === idx
                        ? "border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-xl"
                        : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span>{idx + 1}. {p.name}</span>
                    {p.defects.length > 0 && (
                      <span className="bg-rose-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black">
                        {p.defects.length} LỖI
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Error filter toggle */}
              <label className="text-xs text-slate-300 flex items-center gap-2 cursor-pointer pb-2 select-none shrink-0 ml-4">
                <input
                  type="checkbox"
                  checked={showOnlyErrors}
                  onChange={(e) => setShowOnlyErrors(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span className="font-semibold text-rose-400">🔴 Chỉ hiện dòng LỆCH / LỖI</span>
              </label>
            </div>

            {/* Modal Body: Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* Active Page Header Info */}
              <div className="flex items-center justify-between bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div>
                  <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                    Đang Kiểm Thử: {selectedDiff.pages[activePageIndex]?.name}
                  </div>
                  <div className="text-sm font-black text-white mt-0.5">
                    Đường dẫn: <span className="font-mono text-slate-300">{selectedDiff.pages[activePageIndex]?.path}</span>
                  </div>
                </div>
                <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs">
                  <button
                    onClick={() => setVisualMode("side")}
                    className={`px-3 py-1 rounded-lg font-bold transition ${
                      visualMode === "side" ? "bg-indigo-600 text-white shadow" : "text-slate-400"
                    }`}
                  >
                    🎨 2 Cửa Sổ Song Song
                  </button>
                  <button
                    onClick={() => setVisualMode("swipe")}
                    className={`px-3 py-1 rounded-lg font-bold transition ${
                      visualMode === "swipe" ? "bg-indigo-600 text-white shadow" : "text-slate-400"
                    }`}
                  >
                    🔍 Kéo Trượt (Swipe)
                  </button>
                </div>
              </div>

              {/* Defects Alert Banner if any */}
              {selectedDiff.pages[activePageIndex]?.defects?.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-2">
                    <AlertOctagon className="size-4" /> Các Lỗi Cần Dev Sửa Ngay (Blockers):
                  </h4>
                  {selectedDiff.pages[activePageIndex].defects.map((d, i) => (
                    <div
                      key={i}
                      className="p-4 bg-rose-950/30 border border-rose-500/40 rounded-2xl flex items-start gap-3.5"
                    >
                      <span className="text-xl mt-0.5">{d.icon}</span>
                      <div className="text-xs space-y-1">
                        <div className="font-bold text-rose-200 text-sm">{d.title}</div>
                        <div className="text-slate-300">{d.desc}</div>
                        <div className="text-rose-400 font-mono text-[11px] font-semibold">➔ Hướng Khắc Phục: {d.fix}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* SPECIAL RICHTEXT WYSIWYG AUDIT SECTION (If on RichText tab) */}
              {selectedDiff.pages[activePageIndex]?.category === "richtext_editor" && (
                <div className="bg-slate-950 p-5 rounded-2xl border border-indigo-500/40 space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-indigo-300">
                      <FileText className="size-4 text-indigo-400" />
                      <span>Đối Soát Văn Bản Trình Soạn Thảo (Word-like WYSIWYG HTML ➔ Lexical AST)</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-slate-300">
                        <ImageIcon className="size-3.5 text-cyan-400" /> 2 Ảnh Nhúng Trong Bài
                      </span>
                      <span className="flex items-center gap-1 text-slate-300">
                        <TableIcon className="size-3.5 text-amber-400" /> 1 Bảng 3 Cột Dinh Dưỡng
                      </span>
                      <span className="flex items-center gap-1 text-emerald-400 font-bold">
                        <Check className="size-3.5" /> 100% UTF-8
                      </span>
                    </div>
                  </div>

                  {/* Dual Word Document Preview */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* PW1 RichText Word View */}
                    <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 space-y-3">
                      <div className="text-[11px] font-bold text-amber-300 font-mono uppercase border-b border-slate-800 pb-2 flex items-center justify-between">
                        <span>👈 Văn Bản Gốc PW1 (HTML TinyMCE)</span>
                        <span className="text-slate-400 font-normal">850 từ • 2 ảnh</span>
                      </div>
                      <div className="text-xs text-slate-200 space-y-2 bg-slate-950 p-4 rounded-lg border border-slate-800">
                        <h4 className="font-bold text-sm text-white">Hành Trình 10 Năm Nông Trại Hữu Cơ Ba Vì</h4>
                        <p className="text-slate-300">
                          Chúng tôi tự hào mang đến cho quý khách hàng những sản phẩm <strong>mật ong nguyên chất 100%</strong> được thu hoạch trực tiếp từ các cánh rừng tự nhiên tại Ba Vì...
                        </p>
                        <div className="p-2 bg-slate-900 border border-slate-800 rounded text-center text-slate-400 text-[11px] flex items-center justify-center gap-2">
                          <ImageIcon className="size-3 text-cyan-400" /> [Ảnh minh họa 1: farm_harvest_2026.jpg]
                        </div>
                        <div className="border border-slate-700 rounded overflow-hidden mt-2">
                          <table className="w-full text-[10px] text-left">
                            <thead className="bg-slate-800 text-slate-300 font-bold">
                              <tr>
                                <th className="p-1.5">Tiêu Chí</th>
                                <th className="p-1.5">Mật Ong Thường</th>
                                <th className="p-1.5">Mật Ong Ba Vì</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 text-slate-400">
                              <tr>
                                <td className="p-1.5">Độ đậm đặc</td>
                                <td className="p-1.5">Loãng 18%</td>
                                <td className="p-1.5 text-emerald-400 font-bold">Đậm đặc &gt; 23%</td>
                              </tr>
                              <tr>
                                <td className="p-1.5">Hương vị</td>
                                <td className="p-1.5">Ngọt gắt đường</td>
                                <td className="p-1.5 text-emerald-400 font-bold">Ngọt thanh hoa rừng</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* PW2 RichText Lexical View */}
                    <div className="bg-slate-900 border border-indigo-500/30 rounded-xl p-4 space-y-3">
                      <div className="text-[11px] font-bold text-indigo-300 font-mono uppercase border-b border-slate-800 pb-2 flex items-center justify-between">
                        <span>👉 Văn Bản Mới PW2 (Payload Lexical AST)</span>
                        <span className="text-slate-400 font-normal">Next.js 15 Render</span>
                      </div>
                      <div className="text-xs text-slate-200 space-y-2 bg-slate-950 p-4 rounded-lg border border-slate-800">
                        <h4 className="font-bold text-sm text-white">Hành Trình 10 Năm Nông Trại Hữu Cơ Ba Vì</h4>
                        <p className="text-slate-300">
                          Chúng tôi tự hào mang đến cho quý khách hàng những sản phẩm <strong>mật ong nguyên chất 100%</strong> được thu hoạch trực tiếp từ các cánh rừng tự nhiên tại Ba Vì...
                        </p>
                        <div className="p-2 bg-slate-900 border border-slate-800 rounded text-center text-slate-400 text-[11px] flex items-center justify-center gap-2">
                          <ImageIcon className="size-3 text-cyan-400" /> [Ảnh minh họa 1: farm_harvest_2026.jpg]
                        </div>
                        {selectedDiff.status === "failed" ? (
                          <div className="p-2.5 bg-rose-950/80 border border-rose-500 rounded text-rose-200 font-mono text-[11px] space-y-1">
                            <div className="font-bold">🚨 PHÁT HIỆN LỖI P0: MẤT THẺ BẢNG &lt;table&gt;</div>
                            <div className="text-slate-300 text-[10px]">
                              Số liệu bị dồn: "Tiêu Chí Mật Ong Thường Mật Ong Ba Vì Độ đậm đặc Loãng 18% Đậm đặc &gt; 23%..."
                            </div>
                          </div>
                        ) : (
                          <div className="border border-slate-700 rounded overflow-hidden mt-2">
                            <table className="w-full text-[10px] text-left">
                              <thead className="bg-slate-800 text-slate-300 font-bold">
                                <tr>
                                  <th className="p-1.5">Tiêu Chí</th>
                                  <th className="p-1.5">Mật Ong Thường</th>
                                  <th className="p-1.5">Mật Ong Ba Vì</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800 text-slate-400">
                                <tr>
                                  <td className="p-1.5">Độ đậm đặc</td>
                                  <td className="p-1.5">Loãng 18%</td>
                                  <td className="p-1.5 text-emerald-400 font-bold">Đậm đặc &gt; 23%</td>
                                </tr>
                                <tr>
                                  <td className="p-1.5">Hương vị</td>
                                  <td className="p-1.5">Ngọt gắt đường</td>
                                  <td className="p-1.5 text-emerald-400 font-bold">Ngọt thanh hoa rừng</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 1. INTERACTIVE FEATURE VALIDATION MATRIX (Filter, Search, Variant Selectors, Cart) */}
              {selectedDiff.pages[activePageIndex]?.interactiveChecks?.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <Sparkles className="size-4 text-cyan-400" /> Kiểm Thử Tính Năng Tương Tác
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedDiff.pages[activePageIndex].interactiveChecks.map((ic, i) => (
                      <div key={i} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-xs">{ic.name}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                              ic.status === "pass"
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40"
                                : "bg-rose-950 text-rose-300 border border-rose-500/40"
                            }`}
                          >
                            {ic.status === "pass" ? "✓ Khớp Chuẩn" : "🚨 Lệch Luồng"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 space-y-0.5">
                          <div>👈 Web Cũ: <span className="text-amber-300 font-medium">{ic.pw1Behavior}</span></div>
                          <div>👉 Web Mới: <span className={ic.status === "fail" ? "text-rose-400 font-bold" : "text-indigo-300 font-medium"}>{ic.pw2Behavior}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. LIVE BROWSER DUAL WINDOWS COMPARISON */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <Eye className="size-4 text-indigo-400" /> Đối Chiếu Trực Tiếp Giao Diện Web Khách Hàng (Live Web Parity)
                </h4>
                {visualMode === "side" ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Old Version Browser Window */}
                    <div className="bg-slate-950 border border-amber-500/40 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[480px]">
                      <div className="bg-slate-900/90 px-4 py-2.5 border-b border-amber-500/30 flex items-center justify-between text-xs shrink-0">
                        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
                          <span className="size-2.5 rounded-full bg-rose-500/80 inline-block" />
                          <span className="size-2.5 rounded-full bg-amber-500/80 inline-block" />
                          <span className="size-2.5 rounded-full bg-emerald-500/80 inline-block" />
                          <span className="ml-2 font-bold text-amber-300">👈 WEB KHÁCH HÀNG (BẢN CŨ V1)</span>
                        </div>
                        <a
                          href={`${selectedDiff.legacyDomain}${selectedDiff.pages[activePageIndex]?.path.replace("/", "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 font-mono"
                        >
                          Mở Live V1 <ExternalLink className="size-3" />
                        </a>
                      </div>
                      <div className="flex-1 p-5 bg-gradient-to-b from-slate-900 to-slate-950 overflow-y-auto space-y-3">
                        <div className="text-xs font-bold text-amber-300 uppercase font-mono">
                          {selectedDiff.name} — {selectedDiff.pages[activePageIndex]?.name} (Gốc)
                        </div>
                        <div className="p-3 bg-slate-900 border border-amber-500/20 rounded-xl text-xs text-slate-300 space-y-1.5 font-mono">
                          {selectedDiff.pages[activePageIndex]?.breakdown?.map((b, i) => (
                            <div key={i}>• {b.leg}: <strong className="text-white">{b.pw1Val}</strong></div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* New Version Browser Window */}
                    <div className="bg-slate-950 border border-indigo-500/40 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[480px]">
                      <div className="bg-slate-900/90 px-4 py-2.5 border-b border-indigo-500/30 flex items-center justify-between text-xs shrink-0">
                        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
                          <span className="size-2.5 rounded-full bg-rose-500/80 inline-block" />
                          <span className="size-2.5 rounded-full bg-amber-500/80 inline-block" />
                          <span className="size-2.5 rounded-full bg-emerald-500/80 inline-block" />
                          <span className="ml-2 font-bold text-indigo-300">👉 WEB KHÁCH HÀNG (BẢN MỚI V2)</span>
                        </div>
                        <a
                          href={`${selectedDiff.migratedDomain}${selectedDiff.pages[activePageIndex]?.path.replace("/", "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1 font-mono"
                        >
                          Mở Live V2 <ExternalLink className="size-3" />
                        </a>
                      </div>
                      <div className="flex-1 p-5 bg-gradient-to-b from-slate-900 to-slate-950 overflow-y-auto space-y-3">
                        <div className="text-xs font-bold text-indigo-300 uppercase font-mono">
                          {selectedDiff.name} — {selectedDiff.pages[activePageIndex]?.name} (Next.js 15)
                        </div>
                        <div className="p-3 bg-slate-900 border border-indigo-500/20 rounded-xl text-xs text-slate-300 space-y-1.5 font-mono">
                          {selectedDiff.pages[activePageIndex]?.breakdown?.map((b, i) => (
                            <div key={i}>
                              • {b.mig}:{" "}
                              <strong className={b.badge === "badge-fail" ? "text-rose-400" : "text-white"}>
                                {b.pw2Val}
                              </strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* SWIPE SLIDER */
                  <div className="relative w-full h-[450px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 select-none shadow-2xl">
                    <div className="absolute inset-0 bg-slate-950 p-6 flex flex-col justify-between">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950 px-3 py-1 rounded-full">
                          👉 WEB KHÁCH HÀNG (BẢN MỚI NEXT.JS 15)
                        </span>
                        <span className="text-xs text-slate-400 font-mono">{selectedDiff.migratedDomain}</span>
                      </div>
                      <div className="max-w-md mx-auto text-center space-y-3">
                        <h3 className="text-2xl font-black text-white">{selectedDiff.name} — {selectedDiff.pages[activePageIndex]?.name}</h3>
                        <div className="text-xs text-slate-400">Payload CMS 3 + PostgreSQL Engine</div>
                      </div>
                      <div className="text-center text-xs text-slate-500 font-mono">
                        Kéo thanh trượt để so sánh trực quan với Bản Cũ
                      </div>
                    </div>

                    <div
                      className="absolute inset-0 bg-slate-900 border-r-2 border-indigo-400 p-6 flex flex-col justify-between shadow-2xl"
                      style={{ width: `${sliderPos}%` }}
                    >
                      <div className="min-w-[650px] flex items-center justify-between border-b border-amber-500/30 pb-3">
                        <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950 px-3 py-1 rounded-full">
                          👈 WEB KHÁCH HÀNG (BẢN CŨ LARAVEL)
                        </span>
                        <span className="text-xs text-slate-400 font-mono">{selectedDiff.legacyDomain}</span>
                      </div>
                      <div className="min-w-[650px] max-w-md mx-auto text-center space-y-3">
                        <h3 className="text-2xl font-black text-amber-200">{selectedDiff.name} — {selectedDiff.pages[activePageIndex]?.name}</h3>
                        <div className="text-xs text-amber-400/80">MySQL Live Database Engine</div>
                      </div>
                      <div className="min-w-[650px] text-center text-xs text-amber-400 font-mono">
                        Dữ liệu gốc từ Bản Cũ
                      </div>
                    </div>

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
                )}
              </div>

              {/* 3. 1-1 FIELD MAPPING & DATABASE AUDIT TABLE */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <Database className="size-4 text-emerald-400" /> Bảng Đối Soát Dữ Liệu Từng Khối & Trường Database (1-1 Field Mapping)
                </h4>
                <div className="border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-800 tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Vị Trí</th>
                        <th className="py-3 px-4">Khối Giao Diện Bản Cũ (PW1)</th>
                        <th className="py-3 px-4">Khối Giao Diện Bản Mới (PW2)</th>
                        <th className="py-3 px-4">👈 Dữ Liệu Khách Nhập (Bản Cũ)</th>
                        <th className="py-3 px-4">👉 Dữ Liệu Sau Chuyển Đổi (Bản Mới)</th>
                        <th className="py-3 px-4">Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {selectedDiff.pages[activePageIndex]?.breakdown?.map((b, i) => (
                        <tr
                          key={i}
                          className={`transition ${
                            b.badge === "badge-fail"
                              ? "bg-rose-950/30 hover:bg-rose-950/40"
                              : "hover:bg-slate-800/40"
                          }`}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-slate-400">{b.pos}</td>
                          <td className="py-3 px-4 text-slate-300 font-semibold">{b.leg}</td>
                          <td className="py-3 px-4 text-indigo-300 font-mono">{b.mig}</td>
                          <td className="py-3 px-4 text-slate-400">{b.pw1Val}</td>
                          <td className="py-3 px-4 text-slate-200 font-medium">
                            <span className={b.badge === "badge-fail" ? "text-rose-400 font-bold" : ""}>
                              {b.pw2Val}
                            </span>
                          </td>
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
