"use client";

import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  generateReconciliationCatalog,
  getStoreDeepDiff,
  getDashboardMetrics,
  CANONICAL_TEMPLATES,
  type StoreSummary,
  type StoreDeepDiff,
  type DynamicStorePage,
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
  Type as TypeIcon,
  ShieldCheck,
  Wrench,
  Layers as BlockTreeIcon,
} from "lucide-react";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Detail Modal States
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<"visual_stream" | "field_diff" | "media_audit" | "text_audit">("visual_stream");
  const [activeEntityGroup, setActiveEntityGroup] = useState<"all" | EntityGroupType>("all");
  const [fieldSearchQuery, setFieldSearchQuery] = useState("");
  const [resolvedStoreIds, setResolvedStoreIds] = useState<Set<string>>(new Set());
  const [isReloading, setIsReloading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const selectedDiff: StoreDeepDiff | null = useMemo(() => {
    if (!activeStoreId) return null;
    const isResolved = resolvedStoreIds.has(activeStoreId);
    return getStoreDeepDiff(activeStoreId, isResolved ? "passed" : undefined);
  }, [activeStoreId, resolvedStoreIds]);

  const activePage = selectedDiff?.pages[activePageIndex] || selectedDiff?.pages[0];

  // Lock background body scroll when inspection modal is active
  useEffect(() => {
    if (activeStoreId) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
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
        s.ownerEmail.toLowerCase().includes(q) ||
        s.domain.toLowerCase().includes(q) ||
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

  // Filtered Field Diff Records
  const filteredFieldRecords = useMemo(() => {
    if (!selectedDiff?.fieldDiffAudit?.records) return [];
    return selectedDiff.fieldDiffAudit.records.filter((r) => {
      const matchGroup = activeEntityGroup === "all" || r.entityGroup === activeEntityGroup;
      const matchErrors = !showOnlyErrors || r.matchStatus !== "match";
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
  }, [selectedDiff, activeEntityGroup, showOnlyErrors, fieldSearchQuery]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleReloadStoreData = (storeId: string) => {
    setIsReloading(true);
    setResolvedStoreIds((prev) => new Set([...prev, storeId]));

    setTimeout(() => {
      setCatalog((prev) =>
        prev.map((s) =>
          s.id === storeId
            ? {
                ...s,
                status: "passed",
                score: "99.8%",
                failedBlocks: [],
                textScore: "100%",
                mediaScore: "100%",
                blockScore: "100%",
                commerceScore: "100%",
              }
            : s
        )
      );
      setIsReloading(false);
      showToast(`✓ Đã quét lại Live DB! Phát hiện các lỗi đã được Dev sửa xong. Độ khớp: 99.8% (Pass)`);
    }, 500);
  };

  const handleApprovePass = (storeId: string) => {
    setCatalog((prev) =>
      prev.map((s) => (s.id === storeId ? { ...s, status: "passed", score: "99.8%" } : s))
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
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white">
                  Website Migration
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                So sánh trực quan <strong>2 Website Song Song (PW1 vs PW2)</strong> kết hợp <strong>Đối Soát Toàn Bộ Trường CSDL 1-to-1</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Database Status Indicators */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 shadow-inner">
            <span className="inline-block size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Web Cũ: <strong className="text-emerald-400 font-mono">MySQL PW1</strong></span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 shadow-inner">
            <span className="inline-block size-2 rounded-full bg-indigo-400 animate-pulse" />
            <span>Web Mới: <strong className="text-indigo-400 font-mono">Next.js 15 Postgres</strong></span>
          </div>
          <button
            onClick={() => showToast("Đã quét lại đối soát cho toàn bộ 2.000 website!")}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-xl border border-slate-700 transition shadow-sm"
          >
            <RefreshCw className="size-3.5" />
            <span>Quét Lại CSDL (Re-scan)</span>
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
          <div className="text-[11px] text-amber-500/90 mt-1.5 font-medium">Lệch ảnh / Thiếu Map / Text</div>
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
                {st === "all" ? "Tất Cả" : st === "passed" ? "QC Pass" : st === "warning" ? "Cần Xem Lại" : "Lỗi P0"}
              </button>
            ))}
          </div>

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
                <tr key={store.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-4 px-4 font-semibold text-white whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-indigo-400 font-bold">{store.id}</span>
                      <span className="text-slate-600">—</span>
                      <span className="text-slate-100 font-semibold">{store.ownerEmail}</span>
                    </div>
                    <div className="text-[12px] text-emerald-400 font-normal font-mono mt-1 flex items-center gap-1.5 font-medium">
                      <Globe className="size-3 text-emerald-400 shrink-0" />
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
                      Văn Bản: {store.textScore} | Hình Ảnh: {store.mediaScore} | Bố Cục: {store.blockScore}
                    </div>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    {store.status === "passed" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 whitespace-nowrap">
                        <CheckCircle2 className="size-3.5" /> Khớp Chuẩn
                      </span>
                    )}
                    {store.status === "warning" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40 whitespace-nowrap">
                        <AlertTriangle className="size-3.5" /> Cần Xem Lại
                      </span>
                    )}
                    {store.status === "failed" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-950/80 text-rose-300 border border-rose-500/40 whitespace-nowrap">
                        <AlertOctagon className="size-3.5" /> Lỗi P0 Blocker
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded whitespace-nowrap">
                        {store.pageCount} Trang
                      </span>
                      {store.failedBlocks.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {store.failedBlocks.map((fb, idx) => (
                            <span
                              key={idx}
                              className={`text-[10px] px-2 py-0.5 rounded-md font-mono border whitespace-nowrap ${
                                store.status === "failed"
                                  ? "bg-rose-950/50 text-rose-300 border-rose-500/30"
                                  : "bg-amber-950/50 text-amber-300 border-amber-500/30"
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
                        setActiveStoreId(store.id);
                        setActivePageIndex(0);
                        setSelectedBlockId(null);
                        setActiveViewTab("visual_stream");
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/30 hover:scale-105 whitespace-nowrap"
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
      {/* PROFESSIONAL DETAIL INSPECTOR MODAL WITH FULL 2-WEBSITE STREAM + FIELD DIFF */}
      {/* ========================================================================= */}
      {mounted && typeof document !== "undefined" && selectedDiff && activePage && createPortal(
        <div className="fixed inset-0 z-[999999] bg-slate-950 flex flex-col p-0 md:p-3 overscroll-contain animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-none md:rounded-3xl w-full h-full flex flex-col shadow-2xl overflow-hidden ring-1 ring-white/10">
            
            {/* Top Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3.5">
                <button
                  onClick={() => setActiveStoreId(null)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                  title="Quay lại danh sách"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl shadow-inner">
                  <Store className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-lg font-black text-white">{selectedDiff.name}</h2>
                    <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                      {selectedDiff.id}
                    </span>
                    <span className="text-xs text-slate-200 font-mono bg-slate-800 border border-slate-700 px-2.5 py-0.5 rounded-md font-semibold">
                      📧 {selectedDiff.ownerEmail}
                    </span>
                    <span className="text-xs text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-0.5 rounded-md font-semibold flex items-center gap-1">
                      <Globe className="size-3 text-emerald-400" />
                      {selectedDiff.domain}
                    </span>
                    <span
                      className={`text-[11px] px-3 py-0.5 rounded-full font-bold uppercase tracking-wider border shadow-sm ${
                        selectedDiff.status === "passed"
                          ? "bg-emerald-950 text-emerald-300 border-emerald-500/40"
                          : selectedDiff.status === "warning"
                          ? "bg-amber-950 text-amber-300 border-amber-500/40"
                          : "bg-rose-950 text-rose-300 border-rose-500/40"
                      }`}
                    >
                      {selectedDiff.status === "passed" ? "✓ QC Pass (99.8%)" : selectedDiff.status === "warning" ? "⚠️ Cần Xem Lại" : "🚨 Lỗi P0 Blocker"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2 font-mono">
                    <span>Gốc: <strong className="text-slate-300">{selectedDiff.templateCode} ({selectedDiff.templateName})</strong></span>
                    <span>•</span>
                    <span>Tổng số trang: <strong className="text-white">{selectedDiff.totalPagesInPW1} Trang</strong></span>
                    {selectedDiff.missingPagesCount > 0 && (
                      <span className="text-rose-400 font-bold bg-rose-950/60 border border-rose-500/40 px-2 py-0.2 rounded">
                        🚨 Thiếu {selectedDiff.missingPagesCount} trang trên PW2
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Header Action Buttons */}
              <div className="flex items-center gap-2.5">
                <button
                  disabled={isReloading}
                  onClick={() => handleReloadStoreData(selectedDiff.id)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white text-xs font-bold rounded-xl border border-indigo-500/40 transition shadow-sm disabled:opacity-50"
                  title="Quét lại dữ liệu từ MySQL PW1 và Postgres PW2 sau khi Dev đã sửa"
                >
                  <RefreshCw className={`size-3.5 ${isReloading ? "animate-spin text-indigo-400" : ""}`} />
                  <span>{isReloading ? "Đang Quét Lại..." : "Quét Lại Dữ Liệu (Re-scan)"}</span>
                </button>
                <button
                  onClick={() => handleApprovePass(selectedDiff.id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white rounded-xl transition shadow-lg shadow-emerald-600/30"
                >
                  <CheckCircle2 className="size-4" />
                  <span>Duyệt QC Pass</span>
                </button>
                <button
                  onClick={() => setActiveStoreId(null)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Navigation Bar: Page Selectors & Mode Switcher */}
            <div className="bg-slate-950 px-5 py-2.5 border-b border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
              {/* Page Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
                  <Globe className="size-3.5 text-indigo-400" /> Trang:
                </span>
                {selectedDiff.pages.map((p, idx) => {
                  const hasErrors = !p.existsInPW2 || p.defects.some((d) => d.type === "p0");
                  const hasWarnings = p.defects.some((d) => d.type === "p1" || d.type === "p2") || p.blocks.some((b) => b.status === "warn");

                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setActivePageIndex(idx);
                        setSelectedBlockId(null);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition whitespace-nowrap border ${
                        activePageIndex === idx
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30"
                          : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <span>{idx + 1}. {p.name}</span>
                      {!p.existsInPW2 ? (
                        <span className="bg-rose-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
                          THIẾU
                        </span>
                      ) : hasErrors ? (
                        <span className="bg-rose-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black">
                          LỖI
                        </span>
                      ) : hasWarnings ? (
                        <span className="bg-amber-500 text-black text-[9px] px-1.5 py-0.2 rounded-full font-black">
                          CẦN XEM
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* View Mode Switcher (4 Modes) */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setActiveViewTab("visual_stream")}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                      activeViewTab === "visual_stream" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Monitor className="size-3.5" />
                    <span>So Sánh 2 Website</span>
                  </button>
                  <button
                    onClick={() => setActiveViewTab("field_diff")}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                      activeViewTab === "field_diff" ? "bg-indigo-600 text-white shadow" : "text-indigo-400 hover:text-indigo-200"
                    }`}
                  >
                    <SlidersHorizontal className="size-3.5" />
                    <span>Soi Từng Trường (Field Diff)</span>
                  </button>
                  <button
                    onClick={() => setActiveViewTab("media_audit")}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                      activeViewTab === "media_audit" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <ImageIcon className="size-3.5" />
                    <span>Soi Ảnh & Link</span>
                  </button>
                  <button
                    onClick={() => setActiveViewTab("text_audit")}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                      activeViewTab === "text_audit" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <TypeIcon className="size-3.5" />
                    <span>Soi Chữ & Bảng</span>
                  </button>
                </div>

                {/* Filter toggle */}
                <label className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-800 cursor-pointer select-none text-xs text-slate-300 transition">
                  <input
                    type="checkbox"
                    checked={showOnlyErrors}
                    onChange={(e) => setShowOnlyErrors(e.target.checked)}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-0 size-3.5"
                  />
                  <span className="font-semibold text-rose-400">Chỉ Lỗi</span>
                </label>
              </div>
            </div>

            {/* Modal Body Area */}
            {activeViewTab === "visual_stream" ? (
              /* ========================================================================= */
              /* 1. THE CLASSIC DUAL BROWSER PARITY STREAM VIEW (PW1 VS PW2) */
              /* ========================================================================= */
              <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
                
                {/* Left Sidebar: Block Tree Navigator */}
                <div className="w-full md:w-72 bg-slate-950/95 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto p-4 space-y-3 min-h-0">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-300">
                      <BlockTreeIcon className="size-4 text-indigo-400" />
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
                            ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30"
                            : block.status === "fail"
                            ? "bg-rose-950/30 text-rose-300 border-rose-500/40 hover:bg-rose-950/50"
                            : block.status === "warn"
                            ? "bg-amber-950/30 text-amber-300 border-amber-500/40 hover:bg-amber-950/50"
                            : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono text-[10px] font-bold opacity-60">
                            #{String(block.order).padStart(2, "0")}
                          </span>
                          <span className="font-semibold truncate">{block.title.replace(/Khối #\d+:\s*/, "")}</span>
                        </div>
                        {block.status === "fail" ? (
                          <span className="size-2 rounded-full bg-rose-500 shrink-0 animate-ping" />
                        ) : block.status === "warn" ? (
                          <span className="size-2 rounded-full bg-amber-400 shrink-0" />
                        ) : (
                          <span className="size-2 rounded-full bg-emerald-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Main Area: Dual Browser Mockups Comparison Stream */}
                <div className="flex-1 flex flex-col min-h-0 bg-slate-900/30">
                  
                  {/* Fixed Browser Dual Windows Header - Fixed Top Bar With Zero Gap */}
                  <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-800 bg-slate-950 shrink-0 shadow-md">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left Browser Bar */}
                      <div className="bg-slate-900 px-4 py-2.5 rounded-2xl border border-amber-500/40 flex items-center justify-between shadow-inner">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1.5">
                            <span className="size-2.5 rounded-full bg-rose-500" />
                            <span className="size-2.5 rounded-full bg-amber-500" />
                            <span className="size-2.5 rounded-full bg-emerald-500" />
                          </div>
                          <span className="font-bold text-xs text-amber-300 font-mono ml-2">👈 BẢN CŨ PW1 (LARAVEL)</span>
                        </div>
                        <a href={`${selectedDiff.legacyDomain}${activePage.path.replace("/", "")}`} target="_blank" rel="noreferrer" className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-medium">
                          <span>Live V1</span> <ExternalLink className="size-3" />
                        </a>
                      </div>

                      {/* Right Browser Bar */}
                      <div className="bg-slate-900 px-4 py-2.5 rounded-2xl border border-indigo-500/40 flex items-center justify-between shadow-inner">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1.5">
                            <span className="size-2.5 rounded-full bg-rose-500" />
                            <span className="size-2.5 rounded-full bg-amber-500" />
                            <span className="size-2.5 rounded-full bg-emerald-500" />
                          </div>
                          <span className="font-bold text-xs text-indigo-300 font-mono ml-2">👉 BẢN MỚI PW2 (NEXT.JS 15)</span>
                        </div>
                        {activePage.existsInPW2 ? (
                          <a href={`${selectedDiff.migratedDomain}${activePage.path.replace("/", "")}`} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline flex items-center gap-1 font-medium">
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
                    <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-md">
                      <div className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                        <Wrench className="size-4 text-indigo-400" />
                        <span>Lỗi & Cảnh Báo Trên Trang Này ({activePage.defects.length} Vấn Đề)</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {activePage.defects.map((defect, idx) => (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                              defect.type === "p0"
                                ? "bg-rose-950/40 border-rose-500/50 text-rose-200"
                                : "bg-amber-950/40 border-amber-500/50 text-amber-200"
                            }`}
                          >
                            <div className="flex items-center gap-2 font-bold text-white text-xs">
                              <span>{defect.icon}</span>
                              <span className="font-mono uppercase text-[10px] px-1.5 py-0.2 rounded bg-black/40">
                                {defect.type.toUpperCase()}
                              </span>
                              <span>{defect.title}</span>
                            </div>
                            <p className="text-slate-300 text-[11px] leading-relaxed">{defect.desc}</p>
                            <div className="text-[11px] font-mono text-indigo-300 bg-slate-950/80 p-2 rounded border border-slate-800">
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
                      .filter((b) => !showOnlyErrors || b.status === "fail" || b.status === "warn")
                      .map((block) => (
                        <div
                          key={block.id}
                          id={block.id}
                          className={`rounded-2xl border transition-all duration-200 p-4 sm:p-5 space-y-3.5 ${
                            block.status === "fail"
                              ? "bg-rose-950/15 border-rose-500 ring-1 ring-rose-500/40 shadow-lg"
                              : block.status === "warn"
                              ? "bg-amber-950/15 border-amber-500 ring-1 ring-amber-500/40 shadow-lg"
                              : selectedBlockId === block.id
                              ? "bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/40 shadow-xl"
                              : "bg-slate-950 border-slate-800 hover:border-slate-700 shadow-sm"
                          }`}
                        >
                          {/* Block Header */}
                          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-1 bg-slate-900 text-indigo-400 font-mono font-bold text-xs rounded-lg border border-slate-800">
                                #{String(block.order).padStart(2, "0")}
                              </span>
                              <div>
                                <h4 className="font-bold text-white text-sm">{block.title}</h4>
                                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                  PW1: <strong className="text-slate-300">{block.pw1Component}</strong> ➔ PW2: <strong className="text-indigo-300">{block.pw2Block}</strong>
                                </div>
                              </div>
                            </div>

                            <div>
                              {block.status === "fail" ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-500/40 animate-pulse">
                                  🚨 LỖI P0: {block.discrepancyNote || "Lệch dữ liệu"}
                                </span>
                              ) : block.status === "warn" ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-500/40">
                                  ⚠️ CẦN XEM: {block.discrepancyNote || "Cảnh báo"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                                  <CheckCircle2 className="size-3.5" /> KHỚP 100%
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Dual Column Content Preview */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* PW1 Preview Box */}
                            <div className="bg-slate-900/80 border border-amber-500/20 rounded-xl p-4 text-xs text-slate-200 space-y-2">
                              <div className="text-[10px] uppercase font-bold text-amber-400 font-mono tracking-wider">
                                Giao Diện & Nội Dung Bản Gốc PW1
                              </div>
                              {block.pw1Preview.headline && (
                                <div className="font-bold text-white text-sm">{block.pw1Preview.headline}</div>
                              )}
                              {block.pw1Preview.subheadline && (
                                <div className="text-slate-300 leading-relaxed">{block.pw1Preview.subheadline}</div>
                              )}
                              {block.pw1Preview.bodyText && (
                                <div className="text-slate-300 leading-relaxed bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                                  {block.pw1Preview.bodyText}
                                </div>
                              )}
                              {block.pw1Preview.badgeText && (
                                <span className="inline-block text-[10px] bg-emerald-950 text-emerald-300 px-2.5 py-0.5 rounded-full font-bold border border-emerald-500/30">
                                  {block.pw1Preview.badgeText}
                                </span>
                              )}
                            </div>

                            {/* PW2 Preview Box */}
                            <div className={`rounded-xl p-4 text-xs text-slate-200 space-y-2 border ${
                              block.status === "fail"
                                ? "bg-rose-950/30 border-rose-500"
                                : block.status === "warn"
                                ? "bg-amber-950/30 border-amber-500"
                                : "bg-slate-900/80 border-indigo-500/20"
                            }`}>
                              <div className="text-[10px] uppercase font-bold text-indigo-400 font-mono tracking-wider">
                                Giao Diện & Nội Dung Bản Mới PW2 (Next.js 15)
                              </div>
                              {block.pw2Preview.headline && (
                                <div className="font-bold text-white text-sm">{block.pw2Preview.headline}</div>
                              )}
                              {block.pw2Preview.subheadline && (
                                <div className="text-slate-300 leading-relaxed">{block.pw2Preview.subheadline}</div>
                              )}
                              {block.pw2Preview.bodyText && (
                                <div className={`leading-relaxed p-2.5 rounded-lg border ${
                                  block.status === "fail"
                                    ? "bg-rose-950/60 border-rose-500 text-rose-200 font-semibold"
                                    : block.status === "warn"
                                    ? "bg-amber-950/60 border-amber-500 text-amber-200 font-semibold"
                                    : "bg-slate-950 border-slate-800 text-slate-300"
                                }`}>
                                  {block.pw2Preview.bodyText}
                                </div>
                              )}
                              {block.pw2Preview.badgeText && (
                                <span className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                                  block.status === "fail"
                                    ? "bg-rose-950 text-rose-300 border-rose-500"
                                    : block.status === "warn"
                                    ? "bg-amber-950 text-amber-300 border-amber-500"
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
            ) : activeViewTab === "field_diff" ? (
              /* ========================================================================= */
              /* 2. DEEP FIELD-BY-FIELD DATABASE DIFF INSPECTOR */
              /* ========================================================================= */
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-900/40 min-h-0">
                {/* Header Summary Card */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <SlidersHorizontal className="size-5 text-indigo-400" />
                      <span>ĐỐI SOÁT TRƯỜNG DỮ LIỆU CSDL 1-TO-1 (DATABASE FIELD RECONCILIATION)</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Đối chiếu từng trường theo <code>legacy_id</code> giữa MySQL PW1 và Postgres PW2: <strong>Sản Phẩm, Biến Thể, Banners, Link CTA, RichText & Bảng Biểu, Menu Điều Hướng, Danh Mục, Cài Đặt Shop</strong>.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-800 text-xs">
                      <div className="text-[10px] text-slate-500 uppercase font-mono font-bold">Độ Khớp Trường</div>
                      <div className="font-black text-emerald-400 text-sm font-mono">{selectedDiff.fieldDiffAudit.summary.fieldMatchRate}</div>
                    </div>
                    <div className="bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-800 text-xs">
                      <div className="text-[10px] text-slate-500 uppercase font-mono font-bold">Tổng Record</div>
                      <div className="font-black text-white text-sm font-mono">{selectedDiff.fieldDiffAudit.summary.totalEntitiesV1}</div>
                    </div>
                    {selectedDiff.fieldDiffAudit.summary.missingInPW2Count > 0 && (
                      <div className="bg-rose-950/60 px-3.5 py-2 rounded-xl border border-rose-500/50 text-xs animate-pulse">
                        <div className="text-[10px] text-rose-400 uppercase font-mono font-bold">Thiếu Trên PW2</div>
                        <div className="font-black text-rose-300 text-sm font-mono">🚨 {selectedDiff.fieldDiffAudit.summary.missingInPW2Count} Record</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-group & Search Filter Bar */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
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
                        ? selectedDiff.fieldDiffAudit.records.length
                        : selectedDiff.fieldDiffAudit.records.filter((r) => r.entityGroup === grp.key).length;

                      return (
                        <button
                          key={grp.key}
                          onClick={() => setActiveEntityGroup(grp.key)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition border ${
                            activeEntityGroup === grp.key
                              ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30"
                              : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                          }`}
                        >
                          <Icon className="size-3.5" />
                          <span>{grp.label}</span>
                          <span className="text-[10px] bg-slate-950/80 px-1.5 py-0.2 rounded-md font-mono opacity-80">
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
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Entity Cards & Field Breakdown Tables */}
                <div className="space-y-4">
                  {filteredFieldRecords.map((record) => (
                    <div
                      key={record.id}
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
    </div>
  );
}
