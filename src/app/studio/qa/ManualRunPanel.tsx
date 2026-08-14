"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Target = { id: string; name: string; domain: string };
type Profile = "smoke" | "regression";
type Preflight = {
  canDispatch: boolean;
  reasons: Array<{ code: string; recovery: string }>;
  environment: string;
  context?: { pullRequest: number; commitSha: string };
  pack?: {
    id: string; version: number; testType: string; testCases: Array<{ id: string }>;
    prerequisites: readonly string[]; fixtureKey: string; estimatedDurationMinutes: number; manualChecklistCount: number;
  };
};
type HistoryItem = {
  id: string; targetId: string; packId?: string; profile: string; status: string;
  pullRequest?: number; commitSha?: string; evidenceState: string; canCancel?: boolean;
  startedAt?: string; finishedAt?: string; summary?: unknown;
};
type HistoryResponse = {
  data?: HistoryItem[]; active?: HistoryItem[]; completed?: HistoryItem[];
  meta?: { nextCursor?: string }; completedMeta?: { nextPage?: number }; dispatchMeta?: { nextPage?: number };
};
type Filters = { status: string; profile: string; pullRequest: string; commitSha: string; packId: string; testCaseId: string };

const emptyFilters: Filters = { status: "", profile: "", pullRequest: "", commitSha: "", packId: "", testCaseId: "" };
const fieldClass = "min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-950 dark:focus:ring-blue-900";

function statusStyle(status: string): string {
  if (status === "passed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["failed", "blocked"].includes(status)) return "border-red-200 bg-red-50 text-red-700";
  if (["queued", "dispatched", "cancel_requested"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "cancelled") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function statusLabel(status: string): string {
  return ({ passed: "Đạt", failed: "Thất bại", queued: "Đang chờ", dispatched: "Đang chạy", cancel_requested: "Đang hủy", cancelled: "Đã hủy", blocked: "Bị chặn" } as Record<string, string>)[status] ?? status;
}

function evidenceLabel(state: string): string {
  return ({ available: "Evidence sẵn sàng", expiring: "Evidence sắp hết hạn", expired: "Evidence đã hết hạn", unavailable: "Evidence chưa sẵn sàng" } as Record<string, string>)[state] ?? "Evidence chưa sẵn sàng";
}

function formatWhen(value?: string): string {
  if (!value) return "Đang xử lý";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} giờ trước`;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function ManualRunPanel({ targets }: { targets: Target[] }) {
  const [targetId, setTargetId] = useState("");
  const [runTargetId, setRunTargetId] = useState("");
  const [profile, setProfile] = useState<Profile>("smoke");
  const [context, setContext] = useState({ pullRequest: "", commitSha: "" });
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [days, setDays] = useState("7");
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [nextCompletedPage, setNextCompletedPage] = useState<number | undefined>();
  const [nextDispatchPage, setNextDispatchPage] = useState<number | undefined>();
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationKey, setConfirmationKey] = useState<string | null>(null);
  const [targetSearch, setTargetSearch] = useState("");
  const [hydratedFilters, setHydratedFilters] = useState(false);
  const [selectedRun, setSelectedRun] = useState<HistoryItem | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const filtersDialogRef = useRef<HTMLDivElement>(null);
  const filtersButton = useRef<HTMLButtonElement>(null);
  const detailDialogRef = useRef<HTMLDivElement>(null);
  const detailReturnFocus = useRef<HTMLElement | null>(null);
  const historyRequest = useRef(0);
  const openRunButton = useRef<HTMLButtonElement>(null);
  const activeTargets = useMemo(() => targets.slice().sort((a, b) => a.name.localeCompare(b.name)), [targets]);
  const selectedTarget = activeTargets.find((target) => target.id === runTargetId);
  const dialogTargets = activeTargets.filter((target) => {
    const query = targetSearch.trim().toLowerCase();
    return !query || `${target.name} ${target.domain} ${target.id}`.toLowerCase().includes(query);
  });

  const loadHistory = async (options: { cursor?: string; completedPage?: number; dispatchPage?: number; append?: boolean } = {}) => {
    const requestId = ++historyRequest.current;
    const query = new URLSearchParams({ days });
    if (targetId) query.set("targetId", targetId);
    if (options.cursor) query.set("cursor", options.cursor);
    if (options.completedPage) query.set("completedPage", String(options.completedPage));
    if (options.dispatchPage) query.set("dispatchPage", String(options.dispatchPage));
    Object.entries(filters).forEach(([key, value]) => { if (value.trim()) query.set(key, value.trim()); });
    try {
      const response = await fetch(`/api/admin/qa/runs?${query}`, { credentials: "same-origin" });
      const body = await response.json().catch(() => null) as HistoryResponse | null;
      if (requestId !== historyRequest.current) return;
      if (!response.ok) { setStatusMessage("Không thể tải lịch sử run với bộ lọc hiện tại."); return; }
      const initial = [...(body?.active ?? []), ...(body?.completed ?? []), ...(body?.data ?? [])];
      const appended = options.completedPage ? (body?.completed ?? []) : options.dispatchPage ? [...(body?.active ?? []), ...(body?.completed ?? [])] : (body?.data ?? []);
      setHistory((current) => options.append ? [...current, ...appended.filter((item) => !current.some((existing) => existing.id === item.id))] : initial);
      if (!options.append) {
        setNextCursor(body?.meta?.nextCursor);
        setNextCompletedPage(body?.completedMeta?.nextPage);
        setNextDispatchPage(body?.dispatchMeta?.nextPage);
      } else if (options.completedPage) setNextCompletedPage(body?.completedMeta?.nextPage);
      else if (options.dispatchPage) setNextDispatchPage(body?.dispatchMeta?.nextPage);
      else setNextCursor(body?.meta?.nextCursor);
    } catch {
      if (requestId === historyRequest.current) setStatusMessage("Không thể kết nối để tải lịch sử run.");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTargetId(params.get("targetId") ?? "");
    setFilters({ status: params.get("status") ?? "", profile: params.get("profile") ?? "", pullRequest: params.get("pullRequest") ?? "", commitSha: params.get("commitSha") ?? "", packId: params.get("packId") ?? "", testCaseId: params.get("testCaseId") ?? "" });
    setDays(params.get("days") ?? "7");
    setHydratedFilters(true);
  }, []);
  useEffect(() => { if (hydratedFilters) void loadHistory(); }, [targetId, filters, days, hydratedFilters]);
  useEffect(() => {
    if (!hydratedFilters) return;
    const query = new URLSearchParams();
    if (targetId) query.set("targetId", targetId);
    if (days !== "7") query.set("days", days);
    Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
    window.history.replaceState(null, "", `${window.location.pathname}${query.size ? `?${query}` : ""}`);
  }, [targetId, filters, days, hydratedFilters]);
  useEffect(() => {
    if (!history.some((run) => run.canCancel)) return;
    const timer = window.setInterval(() => void loadHistory(), 15_000);
    return () => window.clearInterval(timer);
  }, [history, targetId, filters, days]);
  useEffect(() => {
    if (!dialogOpen) return;
    const firstFocusable = () => dialogRef.current?.querySelector<HTMLElement>("input, select, button:not([disabled])");
    firstFocusable()?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setDialogOpen(false); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("input, select, button:not([disabled])")];
      const first = focusable[0]; const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); openRunButton.current?.focus(); };
  }, [dialogOpen]);
  useEffect(() => {
    if (!filtersOpen) return;
    const firstFocusable = () => filtersDialogRef.current?.querySelector<HTMLElement>("input, select, button:not([disabled])");
    firstFocusable()?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setFiltersOpen(false); return; }
      if (event.key !== "Tab" || !filtersDialogRef.current) return;
      const focusable = [...filtersDialogRef.current.querySelectorAll<HTMLElement>("input, select, button:not([disabled])")];
      const first = focusable[0]; const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); filtersButton.current?.focus(); };
  }, [filtersOpen]);
  useEffect(() => {
    if (!selectedRun) return;
    const firstFocusable = () => detailDialogRef.current?.querySelector<HTMLElement>("button:not([disabled])");
    firstFocusable()?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setSelectedRun(null); return; }
      if (event.key !== "Tab" || !detailDialogRef.current) return;
      const focusable = [...detailDialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
      const first = focusable[0]; const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); detailReturnFocus.current?.focus(); };
  }, [selectedRun]);
  useEffect(() => {
    if (!dialogOpen || !runTargetId) return;
    void review();
  // Preflight is advisory and rechecked by POST; refresh it as the selected
  // target/profile changes so an uncovered pack explains itself immediately.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, runTargetId, profile]);

  const review = async () => {
    if (!runTargetId) { setStatusMessage("Chọn đúng một target trước khi kiểm tra preflight."); return; }
    setLoading(true); setStatusMessage("");
    try {
      const query = new URLSearchParams({ targetId: runTargetId, profile });
      if (context.pullRequest || context.commitSha) { query.set("pullRequest", context.pullRequest); query.set("commitSha", context.commitSha); }
      const response = await fetch(`/api/admin/qa/manual-runs/preflight?${query}`, { credentials: "same-origin" });
      const body = await response.json().catch(() => null) as { data?: Preflight } | null;
      if (!response.ok || !body?.data) throw new Error("preflight");
      setPreflight(body.data);
      if (body.data.canDispatch) setConfirmationKey(crypto.randomUUID().replaceAll("-", ""));
    } catch { setStatusMessage("Không thể kiểm tra preflight."); }
    finally { setLoading(false); }
  };

  const dispatch = async () => {
    if (!runTargetId || !preflight?.canDispatch) return;
    setLoading(true); setStatusMessage("");
    try {
      const payload: Record<string, unknown> = { targetId: runTargetId, profile, idempotencyKey: confirmationKey ?? crypto.randomUUID().replaceAll("-", "") };
      if (context.pullRequest || context.commitSha) { payload.pullRequest = Number(context.pullRequest); payload.commitSha = context.commitSha; }
      const response = await fetch("/api/admin/qa/manual-runs", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => null) as { data?: { status?: string }; error?: string } | null;
      setStatusMessage(response.ok ? `Run ${body?.data?.status ?? "accepted"}.` : body?.error ?? "Run bị chặn.");
      if (response.ok) { setDialogOpen(false); setPreflight(null); setConfirmationKey(null); await loadHistory(); }
    } catch { setStatusMessage("Không thể dispatch run."); }
    finally { setLoading(false); }
  };

  const cancel = async (id: string) => {
    if (!window.confirm("Hủy run đang chờ/chạy?")) return;
    try {
      const response = await fetch(`/api/admin/qa/manual-runs/${id.replace("dispatch-", "")}/cancel`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Cancelled by QA tester" }) });
      setStatusMessage(response.ok ? "Yêu cầu hủy đã được ghi nhận." : "Không thể hủy run này.");
      await loadHistory();
    } catch { setStatusMessage("Không thể gửi yêu cầu hủy run."); }
  };

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((current) => ({ ...current, [key]: value }));

  return <section id="runs" aria-labelledby="manual-runs-title" className="space-y-4">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><h2 id="manual-runs-title" className="text-xl font-bold tracking-tight">Runs</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Xem lịch sử hoặc chạy một target cụ thể; không có Run all.</p></div>
      <div className="hidden grid-cols-1 gap-2 sm:grid sm:grid-cols-3">
        <select aria-label="Lọc Target" value={targetId} onChange={(event) => setTargetId(event.target.value)} className={fieldClass}><option value="">Target: Tất cả</option>{activeTargets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select>
        <select aria-label="Lọc Profile" value={filters.profile} onChange={(event) => updateFilter("profile", event.target.value)} className={fieldClass}><option value="">Profile: Tất cả</option><option value="smoke">Smoke</option><option value="regression">Regression</option></select>
        <select aria-label="Lọc Trạng thái" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className={fieldClass}><option value="">Trạng thái: Tất cả</option><option value="passed">Đạt</option><option value="failed">Thất bại</option><option value="queued">Đang chờ</option><option value="dispatched">Đang chạy</option><option value="cancel_requested">Đang hủy</option><option value="blocked">Bị chặn</option><option value="cancelled">Đã hủy</option></select>
      </div>
    </div>

    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
        <div><h3 className="font-bold">Run history</h3><p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">Staging (QC) only · trạng thái evidence an toàn, không mở artifact đã hết hạn.</p></div>
        <button ref={openRunButton} type="button" onClick={() => { setRunTargetId(targetId); setDialogOpen(true); setPreflight(null); setStatusMessage(""); }} className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">Run targeted test</button>
      </div>
      <div className="border-b border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
        <button ref={filtersButton} type="button" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog" aria-expanded={filtersOpen} className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-left text-sm font-semibold sm:hidden dark:border-slate-600">Bộ lọc lịch sử</button>
        <div className="hidden gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-5"><select aria-label="Khoảng thời gian" value={days} onChange={(event) => setDays(event.target.value)} className={fieldClass}><option value="7">7 ngày gần đây</option><option value="14">14 ngày gần đây</option><option value="30">30 ngày gần đây</option></select><input aria-label="Lọc PR" value={filters.pullRequest} onChange={(event) => updateFilter("pullRequest", event.target.value)} placeholder="PR #" inputMode="numeric" className={fieldClass} /><input aria-label="Lọc SHA" value={filters.commitSha} onChange={(event) => updateFilter("commitSha", event.target.value)} placeholder="Commit SHA" className={fieldClass} /><input aria-label="Lọc Pack" value={filters.packId} onChange={(event) => updateFilter("packId", event.target.value)} placeholder="Pack" className={fieldClass} /><input aria-label="Lọc TC-ID" value={filters.testCaseId} onChange={(event) => updateFilter("testCaseId", event.target.value)} placeholder="TC-ID" className={fieldClass} /></div>
        {(targetId || days !== "7" || Object.values(filters).some(Boolean)) && <p className="mt-2 text-xs text-slate-500">Đang áp dụng bộ lọc: {targetId ? (activeTargets.find((target) => target.id === targetId)?.name ?? targetId) : "mọi target"} · {days} ngày</p>}
        <button type="button" onClick={() => setFilters(emptyFilters)} className="mt-2 min-h-11 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-400">Xóa bộ lọc</button>
      </div>
      <div className="hidden overflow-x-auto md:block"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-950"><tr><th className="px-4 py-3">Target</th><th className="px-4 py-3">Profile / result</th><th className="px-4 py-3">PR / SHA</th><th className="px-4 py-3">Finished</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-700">{history.map((run) => <RunRow key={run.id} run={run} targets={activeTargets} onCancel={cancel} onView={(item, trigger) => { detailReturnFocus.current = trigger; setSelectedRun(item); }} />)}</tbody></table></div>
      <ul className="divide-y divide-slate-200 md:hidden dark:divide-slate-700">{history.map((run) => <li key={run.id} className="space-y-2 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{activeTargets.find((target) => target.id === run.targetId)?.name ?? run.targetId}</p><p className="text-xs text-slate-500">{activeTargets.find((target) => target.id === run.targetId)?.domain ?? "Target"}</p></div><StatusPill status={run.status} /></div><p className="text-sm">{run.profile} · {run.packId ?? "terminal"}</p><p className="font-mono text-xs text-slate-600 dark:text-slate-300">{run.pullRequest ? `#${run.pullRequest}` : "PR —"} · {run.commitSha?.slice(0, 7) ?? "SHA —"}</p><div className="flex items-center justify-between gap-2"><span className="text-xs text-slate-500">{formatWhen(run.finishedAt ?? run.startedAt)}</span>{run.canCancel ? <button type="button" onClick={() => void cancel(run.id)} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold dark:border-slate-600">Hủy run</button> : <span className="text-xs text-slate-500">{evidenceLabel(run.evidenceState)}</span>}</div></li>)}</ul>
      {history.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Chưa có run trong bộ lọc này.</p>}
      <div className="flex flex-wrap gap-2 border-t border-slate-200 p-3 dark:border-slate-700">{(nextDispatchPage || nextCursor || nextCompletedPage) && <button type="button" onClick={() => { if (nextDispatchPage) void loadHistory({ dispatchPage: nextDispatchPage, append: true }); else if (nextCompletedPage) void loadHistory({ completedPage: nextCompletedPage, append: true }); else if (nextCursor) void loadHistory({ cursor: nextCursor, append: true }); }} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">Tải thêm 50</button>}</div>
    </article>
    <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-slate-200"><span aria-hidden="true" className="font-bold text-blue-700">i</span><p><b>Chạy targeted test khi có lý do rõ ràng.</b> Chọn screen, flow hoặc feature; preflight hiển thị checks, fixture, thời gian và capacity trước khi dispatch.</p></div>
    {statusMessage && <p role="status" aria-live="polite" className="text-sm font-medium text-slate-700 dark:text-slate-200">{statusMessage}</p>}

    {selectedRun && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><div ref={detailDialogRef} role="dialog" aria-modal="true" aria-labelledby="run-detail-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div><h3 id="run-detail-title" className="text-lg font-bold">Run detail</h3><p className="text-sm text-slate-500">Safe metadata only · không hiển thị URL artifact.</p></div><button type="button" aria-label="Đóng chi tiết run" onClick={() => setSelectedRun(null)} className="min-h-11 min-w-11 rounded-lg text-xl">×</button></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Target</dt><dd>{selectedRun.targetId}</dd></div><div><dt className="text-slate-500">Status</dt><dd>{statusLabel(selectedRun.status)}</dd></div><div><dt className="text-slate-500">Pack / profile</dt><dd>{selectedRun.packId ?? "terminal"} · {selectedRun.profile}</dd></div><div><dt className="text-slate-500">Evidence</dt><dd>{evidenceLabel(selectedRun.evidenceState)}</dd></div><div><dt className="text-slate-500">PR / SHA</dt><dd>#{selectedRun.pullRequest ?? "—"} · {selectedRun.commitSha?.slice(0, 7) ?? "—"}</dd></div><div><dt className="text-slate-500">Finished</dt><dd>{formatWhen(selectedRun.finishedAt ?? selectedRun.startedAt)}</dd></div></dl>{Boolean(selectedRun.summary) && <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-200">{JSON.stringify(selectedRun.summary, null, 2)}</pre>}</div></div>}
    {dialogOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="manual-run-confirm-title" aria-describedby="manual-run-confirm-description" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-slate-900"><header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-700"><div><h3 id="manual-run-confirm-title" className="text-xl font-bold">Chạy manual targeted test</h3><p id="manual-run-confirm-description" className="mt-1 text-sm text-slate-600 dark:text-slate-300">Chọn chính xác một target và một profile được allow-list. Không có Run all hoặc lệnh tự do.</p></div><button type="button" onClick={() => setDialogOpen(false)} aria-label="Đóng" className="min-h-11 min-w-11 rounded-lg text-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">×</button></header>
      <div className="grid gap-0 md:grid-cols-[1.05fr_0.95fr]"><section className="border-b border-slate-200 p-5 md:border-b-0 md:border-r dark:border-slate-700"><label className="text-sm font-semibold" htmlFor="manual-run-search">Chọn target</label><input id="manual-run-search" type="search" value={targetSearch} onChange={(event) => setTargetSearch(event.target.value)} placeholder="Tìm screen, flow hoặc target" className={`mt-2 w-full ${fieldClass}`} /><div role="radiogroup" aria-label="QA target" className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">{dialogTargets.map((target) => <button key={target.id} role="radio" aria-checked={runTargetId === target.id} type="button" onClick={() => { setRunTargetId(target.id); setPreflight(null); setConfirmationKey(null); }} className={`w-full rounded-xl border p-3 text-left transition ${runTargetId === target.id ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600 dark:bg-blue-950/30" : "border-slate-200 hover:border-blue-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"}`}><span className="block font-semibold">{target.name}</span><span className="mt-1 block text-xs text-slate-500">{target.domain} · {target.id}</span></button>)}</div></section>
        <section className="space-y-4 p-5"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Profile<select aria-label="QA profile" value={profile} onChange={(event) => { setProfile(event.target.value as Profile); setPreflight(null); setConfirmationKey(null); }} className={`mt-1 w-full ${fieldClass}`}><option value="smoke">Smoke</option><option value="regression">Regression</option></select></label><div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"><span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Environment</span><b>Staging (QC)</b></div></div><div className="grid gap-2 sm:grid-cols-2"><input aria-label="Pull request context" value={context.pullRequest} onChange={(event) => { setContext((current) => ({ ...current, pullRequest: event.target.value })); setPreflight(null); }} placeholder="PR (đi cùng SHA)" inputMode="numeric" className={fieldClass} /><input aria-label="Commit SHA context" value={context.commitSha} onChange={(event) => { setContext((current) => ({ ...current, commitSha: event.target.value })); setPreflight(null); }} placeholder="Immutable SHA (đi cùng PR)" className={fieldClass} /></div>
          <button type="button" onClick={() => void review()} disabled={!runTargetId || loading} className="min-h-11 w-full rounded-lg border border-blue-700 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-950/30">{loading ? "Đang kiểm tra…" : "Kiểm tra preflight"}</button>
          {preflight ? <div role="status" aria-live="polite" className={`rounded-xl border p-4 text-sm ${preflight.canDispatch ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"}`}><p className="font-bold">{preflight.canDispatch ? "Preflight đạt" : "Preflight bị chặn"}</p>{preflight.pack && <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2"><dt className="text-slate-500">Pack</dt><dd>{preflight.pack.id} v{preflight.pack.version}</dd><dt className="text-slate-500">Test type</dt><dd>{preflight.pack.testType}</dd><dt className="text-slate-500">Checks</dt><dd>{preflight.pack.testCases.map((item) => item.id).join(", ")}</dd><dt className="text-slate-500">Manual checklist</dt><dd>{preflight.pack.manualChecklistCount} mục</dd><dt className="text-slate-500">Fixture</dt><dd>{preflight.pack.fixtureKey}</dd><dt className="text-slate-500">Thời lượng</dt><dd>~{preflight.pack.estimatedDurationMinutes} phút</dd></dl>}<ul className="mt-3 space-y-1">{preflight.reasons.map((reason) => <li key={reason.code}><b>{reason.code}</b>: {reason.recovery}</li>)}{preflight.pack?.prerequisites.map((item) => <li key={item}>✓ {item}</li>)}</ul></div> : <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-600">Preflight sẽ hiển thị test type, TC-ID, prerequisite, fixture capacity và thời lượng trước khi cho phép xác nhận.</div>}
        </section></div>
      <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 p-5 sm:flex-row sm:justify-end dark:border-slate-700"><button type="button" onClick={() => setDialogOpen(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">Hủy</button><button type="button" onClick={() => void dispatch()} disabled={!preflight?.canDispatch || loading} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">{preflight?.pack ? `Chạy ${preflight.pack.testCases.length} checks` : "Xác nhận chạy"}</button></footer>
    </div></div>}
    {filtersOpen && <div className="fixed inset-0 z-50 flex items-end bg-slate-950/60 sm:hidden"><div ref={filtersDialogRef} role="dialog" aria-modal="true" aria-labelledby="run-filters-title" className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"><div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" /><div className="flex items-center justify-between gap-3"><h3 id="run-filters-title" className="text-lg font-bold">Bộ lọc lịch sử chạy</h3><button type="button" aria-label="Đóng bộ lọc" onClick={() => setFiltersOpen(false)} className="min-h-11 min-w-11 rounded-lg text-xl">×</button></div><div className="mt-4 grid gap-3"><select aria-label="Lọc Target mobile" value={targetId} onChange={(event) => setTargetId(event.target.value)} className={fieldClass}><option value="">Target: Tất cả</option>{activeTargets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select><select aria-label="Lọc Profile mobile" value={filters.profile} onChange={(event) => updateFilter("profile", event.target.value)} className={fieldClass}><option value="">Profile: Tất cả</option><option value="smoke">Smoke</option><option value="regression">Regression</option></select><select aria-label="Lọc Trạng thái mobile" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className={fieldClass}><option value="">Trạng thái: Tất cả</option><option value="passed">Đạt</option><option value="failed">Thất bại</option><option value="queued">Đang chờ</option><option value="dispatched">Đang chạy</option><option value="cancel_requested">Đang hủy</option><option value="blocked">Bị chặn</option><option value="cancelled">Đã hủy</option></select><select aria-label="Khoảng thời gian mobile" value={days} onChange={(event) => setDays(event.target.value)} className={fieldClass}><option value="7">7 ngày gần đây</option><option value="14">14 ngày gần đây</option><option value="30">30 ngày gần đây</option></select><input aria-label="Lọc PR mobile" value={filters.pullRequest} onChange={(event) => updateFilter("pullRequest", event.target.value)} placeholder="PR #" inputMode="numeric" className={fieldClass} /><input aria-label="Lọc SHA mobile" value={filters.commitSha} onChange={(event) => updateFilter("commitSha", event.target.value)} placeholder="Commit SHA" className={fieldClass} /><input aria-label="Lọc Pack mobile" value={filters.packId} onChange={(event) => updateFilter("packId", event.target.value)} placeholder="Pack" className={fieldClass} /><input aria-label="Lọc TC-ID mobile" value={filters.testCaseId} onChange={(event) => updateFilter("testCaseId", event.target.value)} placeholder="TC-ID" className={fieldClass} /></div><div className="mt-5 flex gap-2"><button type="button" onClick={() => { setFilters(emptyFilters); setTargetId(""); setDays("7"); }} className="min-h-11 flex-1 rounded-lg border border-slate-300 px-4 text-sm font-semibold dark:border-slate-600">Xóa</button><button type="button" onClick={() => setFiltersOpen(false)} className="min-h-11 flex-1 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white">Áp dụng</button></div></div></div>}
  </section>;
}

function StatusPill({ status }: { status: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyle(status)}`}><span aria-hidden="true">{["queued", "dispatched", "cancel_requested"].includes(status) ? "●" : status === "passed" ? "✓" : "!"}</span>{statusLabel(status)}</span>;
}

function RunRow({ run, targets, onCancel, onView }: { run: HistoryItem; targets: Target[]; onCancel: (id: string) => Promise<void>; onView: (run: HistoryItem, trigger: HTMLElement) => void }) {
  const target = targets.find((item) => item.id === run.targetId);
  return <tr><td className="px-4 py-3"><p className="font-semibold">{target?.name ?? run.targetId}</p><p className="text-xs text-slate-500">{target?.domain ?? "Target"}</p></td><td className="px-4 py-3"><div className="flex flex-wrap items-center gap-2"><StatusPill status={run.status} /><span className="text-xs text-slate-500">{run.profile} · {run.packId ?? "terminal"}</span></div></td><td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{run.pullRequest ? `#${run.pullRequest}` : "PR —"} · {run.commitSha?.slice(0, 7) ?? "SHA —"}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatWhen(run.finishedAt ?? run.startedAt)}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-2">{run.canCancel && <button type="button" onClick={() => void onCancel(run.id)} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">Hủy run</button>}<button type="button" onClick={(event) => onView(run, event.currentTarget)} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">Xem run</button></div></td></tr>;
}
