"use client";

import React, { useState, useEffect, useRef } from "react";
import type { SystemBatchRun, BatchTargetResult } from "@/lib/admin/qa/system-batch-runner";
import type { TargetDomain } from "@/lib/admin/qa/target-registry";
import { ALL_TEST_CASES_DIRECTORY } from "@/lib/admin/qa/test-case-directory";

const DOMAINS: TargetDomain[] = [
  "Auth & Identity",
  "AI & Builder",
  "Editor",
  "Products",
  "Orders",
  "Settings & Payments",
  "Storefront",
  "SEO & Analytics",
  "Localization",
  "Shipping & Logistics",
  "Subscribers & Customers",
  "Blog & Marketing",
  "Subscriptions",
  "Webhooks & Platform",
];

interface SystemRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToRuns: () => void;
  defaultProfile?: "all" | "smoke" | "regression" | "user_flow" | "impact" | "security";
}

export function SystemRunModal({
  isOpen,
  onClose,
  onNavigateToRuns,
  defaultProfile = "all",
}: SystemRunModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [profile, setProfile] = useState<"all" | "smoke" | "regression" | "user_flow" | "impact" | "security">(defaultProfile);
  const [scope, setScope] = useState<"all" | "domain">("all");
  const [selectedDomain, setSelectedDomain] = useState<TargetDomain>("Orders");
  const [failFast, setFailFast] = useState(false);

  const [activeBatch, setActiveBatch] = useState<SystemBatchRun | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Sync dialog visibility
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  // Check active batch on open
  useEffect(() => {
    if (!isOpen) return;
    void pollActiveBatch();
  }, [isOpen]);

  const pollActiveBatch = async () => {
    try {
      const res = await fetch("/api/admin/qa/system-runs", { credentials: "same-origin" });
      if (res.ok) {
        const body = (await res.json()) as { data?: SystemBatchRun | null };
        if (body.data) setActiveBatch(body.data);
      }
    } catch (err) {
      console.warn("[SystemRunModal] Could not fetch active batch:", err);
    }
  };

  const pollBatch = async (batchId: string) => {
    try {
      const res = await fetch(`/api/admin/qa/system-runs?id=${encodeURIComponent(batchId)}`, {
        credentials: "same-origin",
      });
      if (res.ok) {
        const body = (await res.json()) as { data?: SystemBatchRun };
        if (body.data) setActiveBatch(body.data);
      }
    } catch (err) {
      console.warn("[SystemRunModal] Could not poll batch:", err);
    }
  };

  const handleStart = async () => {
    setIsStarting(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/qa/system-runs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          domain: scope === "domain" ? selectedDomain : undefined,
          profile,
          failFast,
        }),
      });
      const body = (await res.json()) as { data?: SystemBatchRun; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Không thể bắt đầu đợt kiểm thử.");
      if (body.data) setActiveBatch(body.data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Lỗi khi bắt đầu chạy kiểm thử.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleCancel = async () => {
    if (!activeBatch) return;
    try {
      await fetch(`/api/admin/qa/system-runs/${encodeURIComponent(activeBatch.id)}/cancel`, {
        method: "POST",
        credentials: "same-origin",
      });
      await pollBatch(activeBatch.id);
    } catch (err) {
      console.warn("[SystemRunModal] Could not cancel batch:", err);
    }
  };

  if (!isOpen) return null;

  const isRunning = activeBatch?.status === "running";
  const isFinished = activeBatch && activeBatch.status !== "running";
  const percent = activeBatch && activeBatch.totalTargets > 0
    ? Math.round((activeBatch.completedTargets / activeBatch.totalTargets) * 100)
    : 0;

  const totalTestsRun = activeBatch?.results.reduce((acc, r) => acc + (r.totalTests || 0), 0) || 0;
  const passedTestsRun = activeBatch?.results.reduce((acc, r) => acc + (r.passedTests || 0), 0) || 0;
  const failedTestsRun = activeBatch?.results.reduce((acc, r) => acc + (r.failedTests || 0), 0) || 0;

  return (
    <dialog
      ref={dialogRef}
      className="fixed left-1/2 top-1/2 m-0 w-[min(100%-2rem,54rem)] max-w-none -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-0 text-zinc-900 dark:text-zinc-100 shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm"
      onCancel={(e) => {
        if (isRunning) e.preventDefault();
        else onClose();
      }}
    >
      <div className="max-h-[90vh] overflow-y-auto p-5 sm:p-6">
        {/* ── 1. Header ── */}
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/80 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                📋 Preflight System Audit (351 Test Cases)
              </span>
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                / QA Control Center
              </span>
            </div>
            <h2 className="mt-2 text-xl font-black text-zinc-900 dark:text-white">
              {isRunning
                ? "Đang Đối Soát Hợp Đồng Toàn Hệ Thống..."
                : isFinished
                  ? "Báo Cáo Đối Soát Hợp Đồng Kỹ Thuật Hệ Thống"
                  : "Đối Soát Chỉ Tiêu & Hợp Đồng Kỹ Thuật (351 Cases)"}
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Đối soát tự động toàn diện 67 Targets và {ALL_TEST_CASES_DIRECTORY.length} Test Cases — Xác minh tính sẵn sàng của hợp đồng kiểm thử, fixture và môi trường Staging.
            </p>
          </div>
          {!isRunning && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-3.5 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              ✕ Đóng
            </button>
          )}
        </header>

        {/* ── 2. Selection Form (When Idle) ── */}
        {!activeBatch && (
          <div className="mt-5 space-y-4">
            {/* Profile Picker */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                1. Chọn Chế Độ Kiểm Thử
              </label>
              <div className="mt-2 grid gap-2.5 sm:grid-cols-3">
                {/* Master All Profiles Card */}
                <button
                  type="button"
                  onClick={() => setProfile("all")}
                  className={`col-span-full rounded-xl border-2 p-4 text-left transition-all ${
                    profile === "all"
                      ? "border-amber-500 bg-amber-50/80 dark:border-amber-500 dark:bg-amber-950/40 ring-4 ring-amber-500/20 shadow-md"
                      : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🌟</span>
                      <strong className="text-sm font-black text-zinc-900 dark:text-white">
                        Chạy Toàn Bộ {ALL_TEST_CASES_DIRECTORY.length} Test Cases (Tất Cả Loại Test)
                      </strong>
                    </div>
                    <span className="rounded-full bg-amber-500 text-white px-2.5 py-0.5 text-[11px] font-black shadow-sm">
                      ✨ Khuyến Nghị (1-Click Run All)
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                    Tự động quét trọn vẹn cả 5 bộ kiểm thử: Smoke, Regression, User Flows & Logic, Functional Impact và Security & Multi-Tenant Isolation trên toàn bộ 67 Targets không bỏ sót bất kỳ kịch bản nào.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setProfile("smoke")}
                  className={`rounded-xl border p-3.5 text-left transition-all ${
                    profile === "smoke"
                      ? "border-blue-600 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/40 ring-2 ring-blue-500/20"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">🚀</span>
                    <span className="rounded bg-blue-100 dark:bg-blue-900/60 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                      Nhanh (~1m)
                    </span>
                  </div>
                  <strong className="mt-1.5 block text-xs font-bold text-zinc-900 dark:text-white">
                    Full System Smoke
                  </strong>
                  <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    67 targets cốt lõi. Chống crash sau deploy.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setProfile("regression")}
                  className={`rounded-xl border p-3.5 text-left transition-all ${
                    profile === "regression"
                      ? "border-indigo-600 bg-indigo-50/70 dark:border-indigo-500 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">🛡️</span>
                    <span className="rounded bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                      Toàn diện (~3m)
                    </span>
                  </div>
                  <strong className="mt-1.5 block text-xs font-bold text-zinc-900 dark:text-white">
                    Full System Regression
                  </strong>
                  <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Toàn bộ {ALL_TEST_CASES_DIRECTORY.length} test cases chuyên sâu.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setProfile("user_flow")}
                  className={`rounded-xl border p-3.5 text-left transition-all ${
                    profile === "user_flow"
                      ? "border-purple-600 bg-purple-50/70 dark:border-purple-500 dark:bg-purple-950/40 ring-2 ring-purple-500/20"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">🔄</span>
                    <span className="rounded bg-purple-100 dark:bg-purple-900/60 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                      Flows (~2m)
                    </span>
                  </div>
                  <strong className="mt-1.5 block text-xs font-bold text-zinc-900 dark:text-white">
                    User Flows & Logic
                  </strong>
                  <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Luồng mua hàng, tích điểm, xuất bản E2E.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setProfile("impact")}
                  className={`rounded-xl border p-3.5 text-left transition-all ${
                    profile === "impact"
                      ? "border-pink-600 bg-pink-50/70 dark:border-pink-500 dark:bg-pink-950/40 ring-2 ring-pink-500/20"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">🎯</span>
                    <span className="rounded bg-pink-100 dark:bg-pink-900/60 px-1.5 py-0.5 text-[10px] font-bold text-pink-700 dark:text-pink-300">
                      Impact (~2m)
                    </span>
                  </div>
                  <strong className="mt-1.5 block text-xs font-bold text-zinc-900 dark:text-white">
                    Functional Impact
                  </strong>
                  <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Kiểm tra vùng ảnh hưởng component & UI.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setProfile("security")}
                  className={`rounded-xl border p-3.5 text-left transition-all ${
                    profile === "security"
                      ? "border-rose-600 bg-rose-50/70 dark:border-rose-500 dark:bg-rose-950/40 ring-2 ring-rose-500/20"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">🔐</span>
                    <span className="rounded bg-rose-100 dark:bg-rose-900/60 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                      Security (~2m)
                    </span>
                  </div>
                  <strong className="mt-1.5 block text-xs font-bold text-zinc-900 dark:text-white">
                    Security & Multi-Tenant
                  </strong>
                  <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Bảo mật IDOR, phân quyền và dữ liệu.
                  </p>
                </button>
              </div>
            </div>

            {/* Scope Picker */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                2. Phạm Vi Thực Thi
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setScope("all")}
                  className={`rounded-lg px-4 py-2.5 text-xs font-bold transition-all ${
                    scope === "all"
                      ? "bg-amber-500 text-white shadow-md ring-2 ring-amber-400/40"
                      : "border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                  }`}
                >
                  🌐 Toàn Bộ Hệ Thống (67 Targets · 351 Test Cases)
                </button>
                <button
                  type="button"
                  onClick={() => setScope("domain")}
                  className={`rounded-lg px-4 py-2.5 text-xs font-bold transition-all ${
                    scope === "domain"
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md ring-2 ring-zinc-500/40"
                      : "border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                  }`}
                >
                  📂 Theo Phân Hệ Cụ Thể (Domain Batch)
                </button>
              </div>

              {scope === "domain" && (
                <div className="mt-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 p-3">
                  <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 block mb-1.5">
                    Chọn phân hệ cần kiểm thử riêng lẻ:
                  </span>
                  <select
                    value={selectedDomain}
                    onChange={(e) => setSelectedDomain(e.target.value as TargetDomain)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2 text-xs font-bold text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-amber-500"
                  >
                    {DOMAINS.map((domain) => (
                      <option key={domain} value={domain}>
                        Phân hệ: {domain}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Fail fast option */}
            <div className="flex items-center gap-2 pt-2">
              <input
                id="fail-fast-checkbox"
                type="checkbox"
                checked={failFast}
                onChange={(e) => setFailFast(e.target.checked)}
                className="size-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="fail-fast-checkbox" className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                Dừng ngay khi phát hiện lỗi đầu tiên (Fail-Fast Mode)
              </label>
            </div>

            {errorMsg && (
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/60 p-3 text-xs font-bold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                {errorMsg}
              </div>
            )}

            {/* Start button */}
            <div className="pt-3">
              <button
                type="button"
                disabled={isStarting}
                onClick={handleStart}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 py-3 text-sm font-black text-white shadow-lg transition-all active:scale-[0.99] disabled:opacity-60"
              >
                {isStarting ? (
                  <>
                    <span className="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Đang khởi động đợt chạy...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>BẮT ĐẦU ĐỐI SOÁT HỢP ĐỒNG HỆ THỐNG</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── 3. Live Execution & Progress (When Running / Finished) ── */}
        {activeBatch && (
          <div className="mt-5 space-y-4">
            {/* Progress Bar Header */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-4">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-2">
                  {isRunning && (
                    <span className="inline-block size-2.5 animate-ping rounded-full bg-blue-600" />
                  )}
                  <span>
                    {isRunning
                      ? `Đang đối soát: ${activeBatch.completedTargets}/${activeBatch.totalTargets} Targets (${totalTestsRun} Test Cases)`
                      : activeBatch.status === "completed" || activeBatch.status === "audit_only"
                        ? `✓ Đã hoàn tất đối soát hợp đồng (${activeBatch.totalTargets}/${activeBatch.totalTargets} Targets · ${totalTestsRun} Test Cases)`
                        : `⏹️ Đã dừng (${activeBatch.completedTargets}/${activeBatch.totalTargets} Targets)`}
                  </span>
                </span>
                <span className="font-mono text-sm">{percent}%</span>
              </div>

              {/* Bar */}
              <div className="mt-2.5 h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className={`h-full transition-all duration-300 ${
                    activeBatch.failedTargets > 0 ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>

              {/* Current target pill */}
              {isRunning && activeBatch.currentTarget && (
                <div className="mt-3 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                  <span className="rounded bg-blue-100 dark:bg-blue-900 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                    Running #{activeBatch.currentTarget.index}
                  </span>
                  <span className="font-semibold truncate">
                    {activeBatch.currentTarget.name}
                  </span>
                </div>
              )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Tổng Test Cases</span>
                <p className="mt-1 text-lg font-black text-zinc-900 dark:text-white">
                  {totalTestsRun}
                </p>
                <span className="text-[10px] text-zinc-400">Kịch bản QC</span>
              </div>
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30 p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Cases Hợp Lệ (Verified)</span>
                <p className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {passedTestsRun}
                </p>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Hợp đồng sẵn sàng</span>
              </div>
              <div className="rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">Targets Hợp Lệ</span>
                <p className="mt-1 text-lg font-black text-blue-600 dark:text-blue-400">
                  {activeBatch.passedTargets}/{activeBatch.totalTargets}
                </p>
                <span className="text-[10px] text-blue-600 dark:text-blue-400">Targets</span>
              </div>
              <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">Cases Chưa Đủ Điều Kiện</span>
                <p className="mt-1 text-lg font-black text-rose-600 dark:text-rose-400">
                  {failedTestsRun}
                </p>
                <span className="text-[10px] text-rose-500">Cần bổ sung</span>
              </div>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-center col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Profile Chạy</span>
                <p className="mt-1 text-xs font-black uppercase text-zinc-700 dark:text-zinc-300">
                  {activeBatch.profile === "all" ? "🌟 ALL SUITE" : activeBatch.profile}
                </p>
                <span className="text-[10px] text-zinc-400">Phạm vi</span>
              </div>
            </div>

            {/* Results Stream List */}
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>📋 Chi Tiết Đối Soát Hợp Đồng ({totalTestsRun} Test Cases)</span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {activeBatch.results.length} targets · {totalTestsRun} test cases đã kiểm tra
                </span>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 p-0 text-xs">
                {activeBatch.results.length === 0 ? (
                  <div className="p-4 text-center text-zinc-400 text-xs">
                    Đang đối soát các gói hợp đồng kiểm thử...
                  </div>
                ) : (
                  activeBatch.results.map((item, idx) => (
                    <div key={`${item.targetId}-${idx}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`size-2 rounded-full ${
                            item.status === "verified" || item.status === "passed" ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                        />
                        <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">
                          {item.targetName}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          ({item.domain})
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-[10px] text-zinc-500">
                          {item.assertionSummary}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            item.status === "verified" || item.status === "passed"
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                              : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                          }`}
                        >
                          {item.status === "verified" || item.status === "passed" ? "HỢP LỆ" : "THIẾU"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              {isRunning ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100"
                >
                  <span>⏹️</span>
                  <span>Dừng Đợt Chạy Khẩn Cấp</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setActiveBatch(null);
                    setScope("all");
                    setProfile("all");
                  }}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                >
                  🔄 Tạo Đợt Chạy Mới
                </button>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToRuns();
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow transition-all active:scale-95"
                >
                  <span>⏱️</span>
                  <span>Xem Chi Tiết Trong Lịch Sử Chạy →</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
