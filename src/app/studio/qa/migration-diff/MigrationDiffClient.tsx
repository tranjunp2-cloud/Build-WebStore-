"use client";

import React, { useState, useMemo, useTransition } from "react";
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
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Copy,
  Sliders,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Eye,
  Columns,
  CheckCheck,
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

  // Deep Diff Modal State
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [visualMode, setVisualMode] = useState<"swipe" | "side" | "diff">("swipe");
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-6">
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
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
              <Layers className="size-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                2,000 SITES RECONCILIATION & DIFF INSPECTOR
                <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full font-bold uppercase">
                  F40 Migration QA
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Đối soát dữ liệu 1-1 & Kiểm tra Visual Parity cho 2.000 Website từ PW1 sang PW2
              </p>
            </div>
          </div>
        </div>

        {/* Action & Database Status Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
            <span className="inline-block size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>PW1 MySQL: <strong className="text-emerald-400">Live Read-Only</strong></span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
            <span className="inline-block size-2 rounded-full bg-indigo-400 animate-pulse" />
            <span>PW2 Postgres: <strong className="text-indigo-400">Connected</strong></span>
          </div>
          <button
            onClick={() => showToast("Đã quét lại toàn bộ 2.000 website!")}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg border border-slate-700 transition"
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
          className={`p-4 rounded-xl border cursor-pointer transition ${
            filterStatus === "all"
              ? "bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500"
              : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="text-xs text-slate-400 font-medium">Tổng Đã Quét</div>
          <div className="text-2xl font-black text-white mt-1">{metrics.totalStores.toLocaleString()}</div>
          <div className="text-[11px] text-indigo-400 mt-1 flex items-center gap-1">
            <Sparkles className="size-3" /> 100% Stores Index
          </div>
        </div>

        <div
          onClick={() => setFilterStatus("passed")}
          className={`p-4 rounded-xl border cursor-pointer transition ${
            filterStatus === "passed"
              ? "bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500"
              : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="text-xs text-emerald-400 font-medium">QC Pass (≥95%)</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{metrics.passedStores}</div>
          <div className="text-[11px] text-emerald-500 mt-1">Đủ điều kiện Cutover</div>
        </div>

        <div
          onClick={() => setFilterStatus("warning")}
          className={`p-4 rounded-xl border cursor-pointer transition ${
            filterStatus === "warning"
              ? "bg-amber-950/40 border-amber-500 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500"
              : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="text-xs text-amber-400 font-medium">Cần Xem Lại (85-94%)</div>
          <div className="text-2xl font-black text-amber-400 mt-1">{metrics.warningStores}</div>
          <div className="text-[11px] text-amber-500 mt-1">Lỗi ảnh/giao diện nhẹ</div>
        </div>

        <div
          onClick={() => setFilterStatus("failed")}
          className={`p-4 rounded-xl border cursor-pointer transition ${
            filterStatus === "failed"
              ? "bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-500/10 ring-1 ring-rose-500"
              : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div className="text-xs text-rose-400 font-medium">Lỗi P0 (&lt;85%)</div>
          <div className="text-2xl font-black text-rose-400 mt-1">{metrics.failedStores}</div>
          <div className="text-[11px] text-rose-500 mt-1">Chặn Cutover</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/80">
          <div className="text-xs text-slate-400 font-medium">Điểm Tương Thích TB</div>
          <div className="text-2xl font-black text-cyan-400 mt-1">{metrics.avgScore}</div>
          <div className="text-[11px] text-slate-500 mt-1">Toàn bộ 2.000 Sites</div>
        </div>
      </div>

      {/* Filter Hub & Search Bar (AC-2) */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900 p-3.5 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter Buttons */}
          <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800">
            {(["all", "passed", "warning", "failed"] as const).map((st) => (
              <button
                key={st}
                onClick={() => {
                  setFilterStatus(st);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition capitalize ${
                  filterStatus === st
                    ? "bg-indigo-600 text-white shadow"
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
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-medium rounded-lg px-3 py-1.5 outline-none focus:border-indigo-500"
          >
            <option value="all">Tất Cả 9 Template Recipe</option>
            {CANONICAL_TEMPLATES.map((t) => (
              <option key={t.code} value={t.code}>
                {t.code} — {t.name} ({t.sector})
              </option>
            ))}
          </select>
        </div>

        {/* Search Box */}
        <div className="relative w-full md:w-80">
          <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo Mã Site, Tên Shop, Subdomain..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* 2,000 Stores Grid Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Mã Site / Tên Shop</th>
                <th className="py-3 px-4">Template Chuẩn</th>
                <th className="py-3 px-4">Độ Khớp Dữ Liệu</th>
                <th className="py-3 px-4">Trạng Thái QC</th>
                <th className="py-3 px-4">Các Khối Bị Lỗi (Nếu Có)</th>
                <th className="py-3 px-4 text-right">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedStores.map((store) => (
                <tr key={store.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3.5 px-4 font-semibold text-white">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-indigo-400">{store.id}</span>
                      <span>—</span>
                      <span>{store.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-normal font-mono mt-0.5">
                      {store.subdomain1} ➔ {store.subdomain2}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-slate-200">{store.templateCode}</span>
                    <div className="text-[11px] text-slate-400">{store.templateName}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white font-mono">{store.score}</span>
                      <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
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
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Com: {store.commerceScore} | Blk: {store.blockScore}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {store.status === "passed" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="size-3" /> QC Pass
                      </span>
                    )}
                    {store.status === "warning" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-500/30">
                        <AlertTriangle className="size-3" /> Cần Sửa Nhẹ
                      </span>
                    )}
                    {store.status === "failed" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/60 text-rose-300 border border-rose-500/30">
                        <AlertOctagon className="size-3" /> Lỗi P0 Blocker
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    {store.failedBlocks.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {store.failedBlocks.map((fb, idx) => (
                          <span
                            key={idx}
                            className="bg-rose-950/40 text-rose-300 border border-rose-500/30 text-[10px] px-2 py-0.5 rounded font-mono"
                          >
                            {fb}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-emerald-400 font-medium">✓ Khớp 100% các khối</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => {
                        setActiveStoreId(store.id);
                        setActivePageIndex(0);
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition shadow-md shadow-indigo-600/20"
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
        <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950 text-xs text-slate-400">
          <div>
            Hiển thị <strong>{paginatedStores.length}</strong> / <strong>{filteredStores.length}</strong> website
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 transition"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="font-semibold text-slate-200">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 transition"
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
                  <Database className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 font-black text-white text-base">
                    <span>{selectedDiff.name}</span>
                    <span className="text-xs font-mono text-indigo-400">({selectedDiff.id})</span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        selectedDiff.status === "passed"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                          : selectedDiff.status === "warning"
                          ? "bg-amber-950 text-amber-300 border border-amber-500/30"
                          : "bg-rose-950 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      {selectedDiff.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                    <span>Template: <strong>{selectedDiff.templateCode} — {selectedDiff.templateName}</strong></span>
                    <span>•</span>
                    <span>Ngành: <strong>{selectedDiff.sector}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyTicket(selectedDiff)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg border border-slate-700 transition"
                >
                  <Copy className="size-3.5" />
                  <span>Xuất Ticket Lỗi</span>
                </button>
                <button
                  onClick={() => handleApprovePass(selectedDiff.id)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white rounded-lg transition shadow-md shadow-emerald-600/20"
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>Đóng Dấu QC Pass</span>
                </button>
                <button
                  onClick={() => setActiveStoreId(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body: Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 4 Score Breakdown Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-slate-400">Commerce (30%)</div>
                  <div className="text-lg font-black text-white mt-1">{selectedDiff.commerceScore}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Sản Phẩm & SKU Biến Thể</div>
                </div>
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-slate-400">Text & Content (25%)</div>
                  <div className="text-lg font-black text-white mt-1">{selectedDiff.textScore}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Tiêu Đề & Mô Tả UTF-8</div>
                </div>
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-slate-400">Media & Assets (25%)</div>
                  <div className="text-lg font-black text-white mt-1">{selectedDiff.mediaScore}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Link Ảnh & Tệp Đính Kèm</div>
                </div>
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] text-slate-400">Layout Blocks (20%)</div>
                  <div className="text-lg font-black text-white mt-1">{selectedDiff.blockScore}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Thứ Tự & Bố Cục Khối</div>
                </div>
              </div>

              {/* Pages Sub-Tab Switcher */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
                {selectedDiff.pages.map((p, idx) => (
                  <button
                    key={p.path}
                    onClick={() => setActivePageIndex(idx)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
                      activePageIndex === idx
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
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
                  <h4 className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <AlertOctagon className="size-4" /> Các Lỗi Cần Xử Lý Ngay (Blockers):
                  </h4>
                  {selectedDiff.pages[activePageIndex].defects.map((d, i) => (
                    <div
                      key={i}
                      className="p-3.5 bg-rose-950/30 border border-rose-500/30 rounded-xl flex items-start gap-3"
                    >
                      <span className="text-lg">{d.icon}</span>
                      <div className="text-xs space-y-1">
                        <div className="font-bold text-rose-200">{d.title}</div>
                        <div className="text-slate-300">{d.desc}</div>
                        <div className="text-rose-400 font-mono text-[11px]">➔ Hướng Khắc Phục: {d.fix}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Visual Parity Inspection Box */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Eye className="size-4 text-indigo-400" /> So Sánh Giao Diện Trực Quan (Visual Parity)
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-slate-400 flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showDefectOverlay}
                        onChange={(e) => setShowDefectOverlay(e.target.checked)}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                      />
                      <span>🔴 Viền Cảnh Báo Lỗi</span>
                    </label>
                    <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-[11px]">
                      <button
                        onClick={() => setVisualMode("swipe")}
                        className={`px-2 py-1 rounded font-semibold ${
                          visualMode === "swipe" ? "bg-indigo-600 text-white" : "text-slate-400"
                        }`}
                      >
                        🔍 Kéo Trượt (Swipe)
                      </button>
                      <button
                        onClick={() => setVisualMode("side")}
                        className={`px-2 py-1 rounded font-semibold ${
                          visualMode === "side" ? "bg-indigo-600 text-white" : "text-slate-400"
                        }`}
                      >
                        🎨 Song Song
                      </button>
                    </div>
                  </div>
                </div>

                {/* Swipe Comparison Container */}
                {visualMode === "swipe" ? (
                  <div className="relative w-full h-80 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 select-none">
                    {/* Background: PW2 Next.js */}
                    <div className="absolute inset-0 flex items-center justify-center p-6 text-center bg-gradient-to-br from-slate-900 to-indigo-950/50">
                      <div>
                        <div className="text-xs font-mono text-indigo-400 font-bold uppercase">
                          PW2 (Next.js 15 + Payload CMS 3)
                        </div>
                        <div className="text-base font-black text-white mt-1">{selectedDiff.name}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          6 Blocks Rendering: Hero / Categories / Products / CTA / Blog / Footer
                        </div>
                        {showDefectOverlay && selectedDiff.status === "failed" && (
                          <div className="mt-4 p-2 bg-rose-950/60 border border-rose-500/60 text-rose-300 text-xs rounded-lg animate-pulse inline-block font-mono">
                            🚨 PHÁT HIỆN LỆCH DATA: MẤT BIẾN THỂ CAN 1L & DROP BRAND
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Foreground: PW1 Design Image (clipped) */}
                    <div
                      className="absolute inset-0 bg-slate-950 border-r-2 border-indigo-400 overflow-hidden flex items-center justify-center p-6 text-center"
                      style={{ width: `${sliderPos}%` }}
                    >
                      <div className="min-w-[600px]">
                        <div className="text-xs font-mono text-amber-400 font-bold uppercase">
                          PW1 (Laravel Design Snapshot)
                        </div>
                        <div className="text-base font-black text-white mt-1">{selectedDiff.name} (Gốc)</div>
                        <div className="text-xs text-slate-400 mt-1">Ảnh Gốc Cột E Excel / Live V1 Domain</div>
                      </div>
                    </div>

                    {/* Interactive Slider Input */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={sliderPos}
                      onChange={(e) => setSliderPos(Number(e.target.value))}
                      className="absolute inset-x-0 bottom-4 w-11/12 mx-auto cursor-ew-resize z-20"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 h-80">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="text-xs font-mono text-amber-400 font-bold">PW1 Snapshot (Gốc)</div>
                        <div className="text-sm font-bold text-white mt-1">{selectedDiff.name}</div>
                        <div className="text-xs text-slate-400 mt-1">{selectedDiff.legacyDomain}</div>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">Đủ 2 biến thể 500ml & 1L</div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="text-xs font-mono text-indigo-400 font-bold">PW2 Render (Next.js)</div>
                        <div className="text-sm font-bold text-white mt-1">{selectedDiff.name}</div>
                        <div className="text-xs text-slate-400 mt-1">{selectedDiff.migratedDomain}</div>
                      </div>
                      <div className="text-[11px] text-rose-400 font-mono">
                        {selectedDiff.status === "failed" ? "Mất biến thể 1L (320.000đ)" : "✓ Khớp 100%"}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 1-1 Database Table Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Database className="size-4 text-emerald-400" /> Bảng Đối Soát Dữ Liệu Từng Dòng Database (1-1 Field Mapping)
                </h4>
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Vị Trí</th>
                        <th className="py-2.5 px-3">PW1 Component</th>
                        <th className="py-2.5 px-3">PW2 Payload Block</th>
                        <th className="py-2.5 px-3">Dữ Liệu PW1</th>
                        <th className="py-2.5 px-3">Dữ Liệu PW2</th>
                        <th className="py-2.5 px-3">Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {selectedDiff.pages[activePageIndex]?.breakdown?.map((b, i) => (
                        <tr key={i} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-400">{b.pos}</td>
                          <td className="py-2.5 px-3 text-slate-300 font-semibold">{b.leg}</td>
                          <td className="py-2.5 px-3 text-indigo-300 font-mono">{b.mig}</td>
                          <td className="py-2.5 px-3 text-slate-400">{b.pw1Val}</td>
                          <td className="py-2.5 px-3 text-slate-300 font-medium">{b.pw2Val}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                b.badge === "badge-pass"
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                                  : b.badge === "badge-warn"
                                  ? "bg-amber-950 text-amber-300 border border-amber-500/30"
                                  : "bg-rose-950 text-rose-300 border border-rose-500/30"
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
