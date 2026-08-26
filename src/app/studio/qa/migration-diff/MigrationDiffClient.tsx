"use client";

import React, { useState, useMemo } from "react";
import {
  generateReconciliationCatalog,
  getStoreDeepDiff,
  getDashboardMetrics,
  CANONICAL_TEMPLATES,
  type StoreSummary,
  type StoreDeepDiff,
  type DynamicStorePage,
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
  FileX,
  Layers as BlockTreeIcon,
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
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const selectedDiff: StoreDeepDiff | null = useMemo(() => {
    if (!activeStoreId) return null;
    return getStoreDeepDiff(activeStoreId);
  }, [activeStoreId]);

  const activePage = selectedDiff?.pages[activePageIndex] || selectedDiff?.pages[0];

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
    const page = store.pages[activePageIndex] || store.pages[0];
    const text = `### 🚨 [QC MIGRATION BLOCKER] Cửa Hàng: ${store.name} (${store.id})
- **Template:** ${store.templateCode} (${store.templateName})
- **Trang Đang Bị Lỗi:** ${page.name} (${page.path})
- **Tổng Trang:** PW1 có ${store.totalPagesInPW1} trang ➔ PW2 có ${store.totalPagesInPW2} trang (Thiếu: ${store.missingPagesCount})
- **Độ Tương Thích:** ${store.score} (Trạng Thái: ${store.status.toUpperCase()})
- **Web Cũ (Phiên Bản V1):** ${store.legacyDomain}
- **Web Mới (Phiên Bản V2):** ${store.migratedDomain}

#### ❌ Chi Tiết Lỗi Dữ Liệu & Rơi Rớt Trang Cần Sửa:
${page.defects
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

  const scrollToBlock = (blockId: string) => {
    setSelectedBlockId(blockId);
    const element = document.getElementById(blockId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
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
                  F40 Dynamic Discovery
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Tự động đọc danh sách trang động thực tế & Đối soát <strong>Chuỗi Khối Tuần Tự (Full-Page Stream)</strong> của từng Khách Hàng
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
                <th className="py-3.5 px-4">Số Trang & Lỗi Phát Hiện</th>
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
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        {store.pageCount} Trang
                      </span>
                      {store.failedBlocks.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
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
                          <CheckCircle2 className="size-3.5" /> Khớp 100%
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button
                      onClick={() => {
                        setActiveStoreId(store.id);
                        setActivePageIndex(0);
                        setSelectedBlockId(null);
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
      {/* DYNAMIC STORE PAGES DISCOVERY & SEQUENTIAL STREAM MODAL */}
      {/* ========================================================================= */}
      {selectedDiff && activePage && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-7xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden ring-1 ring-white/10">
            {/* Modal Top Header */}
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
                    <span>Tổng Trang: <strong className="text-white">{selectedDiff.totalPagesInPW1} Trang Gốc</strong></span>
                    <span>•</span>
                    {selectedDiff.missingPagesCount > 0 ? (
                      <span className="text-rose-400 font-bold flex items-center gap-1">
                        <FileX className="size-3.5" /> PW2 chỉ có {selectedDiff.totalPagesInPW2} (🚨 Thiếu {selectedDiff.missingPagesCount} Trang)
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-bold">✓ Đủ {selectedDiff.totalPagesInPW2} Trang trên PW2</span>
                    )}
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

            {/* DYNAMIC MERCHANT PAGES TABS BAR */}
            <div className="bg-slate-950 px-6 pt-3 border-b border-slate-800 flex items-center justify-between shrink-0 overflow-x-auto">
              <div className="flex items-center gap-2">
                {selectedDiff.pages.map((p, idx) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActivePageIndex(idx);
                      setSelectedBlockId(null);
                    }}
                    className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                      activePageIndex === idx
                        ? "border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-xl"
                        : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span>{idx + 1}. {p.name}</span>
                    <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded font-mono text-slate-400">
                      {p.totalBlocks} Khối
                    </span>
                    {!p.existsInPW2 ? (
                      <span className="bg-rose-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
                        🚨 THIẾU TRANG
                      </span>
                    ) : p.defects.length > 0 ? (
                      <span className="bg-rose-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black">
                        {p.defects.length} LỖI
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>

              {/* Quick error toggle */}
              <label className="text-xs text-slate-300 flex items-center gap-2 cursor-pointer pb-2 select-none shrink-0 ml-4">
                <input
                  type="checkbox"
                  checked={showOnlyErrors}
                  onChange={(e) => setShowOnlyErrors(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span className="font-semibold text-rose-400">🔴 Chỉ hiện khối LỆCH / LỖI</span>
              </label>
            </div>

            {/* Modal Body: Left Sidebar (Block Tree Navigator) + Right Main (Synchronized Vertical Page Stream) */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* LEFT SIDEBAR: BLOCK TREE NAVIGATOR */}
              <div className="w-full md:w-80 bg-slate-950/90 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
                  <BlockTreeIcon className="size-4 text-indigo-400" />
                  <span>Cây Bố Cục ({activePage.blocks.length} Khối)</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Đường dẫn: <strong className="text-slate-300">{activePage.path}</strong>
                </div>

                <div className="space-y-1.5">
                  {activePage.blocks.map((block) => (
                    <button
                      key={block.id}
                      onClick={() => scrollToBlock(block.id)}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs transition flex items-center justify-between ${
                        selectedBlockId === block.id
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30"
                          : block.status === "fail"
                          ? "bg-rose-950/40 text-rose-300 border-rose-500/40 hover:bg-rose-950/60"
                          : "bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono text-[10px] font-bold opacity-70">
                          #{String(block.order).padStart(2, "0")}
                        </span>
                        <span className="font-semibold truncate">{block.title.replace(/Khối #\d+:\s*/, "")}</span>
                      </div>
                      {block.status === "fail" ? (
                        <span className="text-[9px] bg-rose-600 text-white font-bold px-1.5 py-0.5 rounded">LỖI</span>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-bold">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* RIGHT MAIN AREA: DUAL FULL-PAGE SYNCHRONIZED VERTICAL STACK */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-900/50">
                {/* Browser Windows Dual Top Banner */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sticky top-0 z-20 bg-slate-900/95 backdrop-blur-md pb-3 border-b border-slate-800">
                  <div className="bg-amber-950/80 px-4 py-2 rounded-xl border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
                    <span className="font-bold font-mono">👈 BẢN CŨ PW1 (LARAVEL MYSQL)</span>
                    <a href={`${selectedDiff.legacyDomain}${activePage.path.replace("/", "")}`} target="_blank" rel="noreferrer" className="text-amber-400 hover:underline flex items-center gap-1">
                      Live V1 <ExternalLink className="size-3" />
                    </a>
                  </div>
                  <div className="bg-indigo-950/80 px-4 py-2 rounded-xl border border-indigo-500/30 flex items-center justify-between text-xs text-indigo-200">
                    <span className="font-bold font-mono">👉 BẢN MỚI PW2 (NEXT.JS 15 PAYLOAD)</span>
                    {activePage.existsInPW2 ? (
                      <a href={`${selectedDiff.migratedDomain}${activePage.path.replace("/", "")}`} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline flex items-center gap-1">
                        Live V2 <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="text-rose-400 font-bold font-mono">🚨 CHƯA CÓ TRANG TRÊN PW2</span>
                    )}
                  </div>
                </div>

                {/* Missing Page Warning Banner */}
                {!activePage.existsInPW2 && (
                  <div className="p-4 bg-rose-950/60 border border-rose-500 rounded-2xl flex items-center gap-3.5 text-rose-200 text-xs shadow-2xl">
                    <AlertOctagon className="size-6 text-rose-400 shrink-0" />
                    <div>
                      <div className="font-black text-sm text-white">🚨 LỖI P0: KHÔNG TÌM THẤY TRANG TRÊN PW2 ({activePage.path})</div>
                      <div className="text-slate-300 mt-0.5">
                        Khách hàng có trang này trên hệ thống cũ PW1, nhưng script ETL chưa tạo record trong collection `pages` của PW2.
                      </div>
                    </div>
                  </div>
                )}

                {/* Sequential Block Stack */}
                <div className="space-y-4">
                  {activePage.blocks
                    .filter((b) => !showOnlyErrors || b.status === "fail")
                    .map((block) => (
                      <div
                        key={block.id}
                        id={block.id}
                        className={`rounded-2xl border transition-all duration-200 p-4 sm:p-5 space-y-3 ${
                          block.status === "fail"
                            ? "bg-rose-950/20 border-rose-500 ring-1 ring-rose-500/40"
                            : selectedBlockId === block.id
                            ? "bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/40 shadow-xl"
                            : "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {/* Block Header */}
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <div className="flex items-center gap-3">
                            <span className="p-1.5 bg-slate-800 text-indigo-400 font-mono font-bold text-xs rounded-lg">
                              #{String(block.order).padStart(2, "0")}
                            </span>
                            <div>
                              <div className="font-black text-white text-sm">{block.title}</div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                PW1: <strong className="text-slate-300">{block.pw1Component}</strong> ➔ PW2: <strong className="text-indigo-300">{block.pw2Block}</strong>
                              </div>
                            </div>
                          </div>

                          <div>
                            {block.status === "fail" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-500/40 animate-pulse">
                                🚨 LỖI P0: {block.discrepancyNote || "Lệch dữ liệu"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                                <CheckCircle2 className="size-3" /> KHỚP 100%
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Dual Column Content Preview for this specific Block */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* PW1 Block Preview */}
                          <div className="bg-slate-900/90 border border-amber-500/20 rounded-xl p-3.5 text-xs text-slate-200 space-y-1.5">
                            <div className="text-[10px] uppercase font-bold text-amber-400 font-mono">Bản Gốc PW1</div>
                            {block.pw1Preview.headline && (
                              <div className="font-bold text-white text-sm">{block.pw1Preview.headline}</div>
                            )}
                            {block.pw1Preview.subheadline && (
                              <div className="text-slate-300">{block.pw1Preview.subheadline}</div>
                            )}
                            {block.pw1Preview.bodyText && (
                              <div className="text-slate-300 font-mono bg-slate-950 p-2 rounded border border-slate-800">
                                {block.pw1Preview.bodyText}
                              </div>
                            )}
                            {block.pw1Preview.badgeText && (
                              <span className="inline-block text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded font-bold border border-emerald-500/30">
                                {block.pw1Preview.badgeText}
                              </span>
                            )}
                          </div>

                          {/* PW2 Block Preview */}
                          <div className={`rounded-xl p-3.5 text-xs text-slate-200 space-y-1.5 border ${
                            block.status === "fail"
                              ? "bg-rose-950/40 border-rose-500"
                              : "bg-slate-900/90 border-indigo-500/20"
                          }`}>
                            <div className="text-[10px] uppercase font-bold text-indigo-400 font-mono">Bản Mới PW2 (Next.js 15)</div>
                            {block.pw2Preview.headline && (
                              <div className="font-bold text-white text-sm">{block.pw2Preview.headline}</div>
                            )}
                            {block.pw2Preview.subheadline && (
                              <div className="text-slate-300">{block.pw2Preview.subheadline}</div>
                            )}
                            {block.pw2Preview.bodyText && (
                              <div className={`font-mono p-2 rounded border ${
                                block.status === "fail"
                                  ? "bg-rose-950/60 border-rose-500 text-rose-200 font-bold"
                                  : "bg-slate-950 border-slate-800 text-slate-300"
                              }`}>
                                {block.pw2Preview.bodyText}
                              </div>
                            )}
                            {block.pw2Preview.badgeText && (
                              <span className={`inline-block text-[10px] px-2 py-0.5 rounded font-bold border ${
                                block.status === "fail"
                                  ? "bg-rose-950 text-rose-300 border-rose-500"
                                  : "bg-emerald-950 text-emerald-300 border-emerald-500/30"
                              }`}>
                                {block.pw2Preview.badgeText}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
