"use client";

import { type RefObject, useEffect, useMemo, useRef, useState } from "react";

type Target = { id: string; name: string; domain: string };
type Profile = "smoke" | "regression";
type Preflight = {
  canDispatch: boolean;
  reasons: Array<{ code: string; recovery: string }>;
  availableProfiles: Record<Profile, boolean>;
  environment: string;
  pack?: {
    id: string;
    version: number;
    testType: string;
    testCases: Array<{ id: string }>;
    prerequisites: readonly string[];
    fixtureKey: string;
    estimatedDurationMinutes: number;
    manualChecklistCount: number;
  };
};
type HistoryItem = {
  id: string;
  targetId: string;
  packId?: string;
  profile: string;
  status: string;
  pullRequest?: number;
  commitSha?: string;
  evidenceState: string;
  canCancel?: boolean;
  startedAt?: string;
  finishedAt?: string;
  summary?: unknown;
};
type Filters = {
  status: string;
  profile: string;
  pullRequest: string;
  commitSha: string;
  packId: string;
  testCaseId: string;
};

const emptyFilters: Filters = {
  status: "",
  profile: "",
  pullRequest: "",
  commitSha: "",
  packId: "",
  testCaseId: "",
};

const fieldClass =
  "min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elev)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-border)]";
const toolbarFieldClass =
  "h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elev)] px-3 text-[12px] font-bold text-[var(--text)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-border)]";

function statusLabel(status: string) {
  return (
    (
      {
        passed: "Đạt",
        failed: "Thất bại",
        queued: "Đang chờ",
        dispatched: "Đang chạy",
        cancel_requested: "Đang hủy",
        cancelled: "Đã hủy",
        blocked: "Bị chặn",
      } as Record<string, string>
    )[status] ?? status
  );
}

function statusTone(status: string) {
  if (status === "passed") return "var(--success)";
  if (["failed", "blocked"].includes(status)) return "var(--danger)";
  if (["queued", "dispatched", "cancel_requested"].includes(status))
    return "var(--warn)";
  return "var(--text-2)";
}

function evidenceLabel(state: string) {
  return (
    (
      {
        available: "Evidence sẵn sàng",
        expiring: "Evidence sắp hết hạn",
        expired: "Evidence đã hết hạn",
        unavailable: "Evidence chưa sẵn sàng",
      } as Record<string, string>
    )[state] ?? "Evidence chưa sẵn sàng"
  );
}

function preflightReasonCopy(code: string, recovery: string) {
  const known = {
    TARGET_INACTIVE: {
      title: "Target này hiện không còn hoạt động",
      action: "Chọn một target QA đang hoạt động.",
    },
    NO_ACTIVE_PACK: {
      title: "Target này chưa có gói test được QA phê duyệt",
      action:
        "QA/Engineering cần đăng ký Smoke hoặc Regression pack và TC-ID cho target này trước.",
    },
    STAGING_CONTEXT_UNAVAILABLE: {
      title: "Chưa tìm thấy bản deploy Staging để đối chiếu",
      action:
        "Deploy PR lên Staging (QC), hoặc nhập đúng PR và commit SHA của bản đã deploy ở phần Context deploy.",
    },
    FIXTURE_CAPACITY_EXHAUSTED: {
      title: "Môi trường test đang được một lần chạy khác sử dụng",
      action: "Đợi lần chạy hiện tại hoàn tất rồi thử lại.",
    },
    PROFILE_CAPACITY_EXHAUSTED: {
      title: "Đã đạt số lượng lần chạy đồng thời cho gói test này",
      action: "Đợi một lần chạy cùng loại hoàn tất rồi thử lại.",
    },
  } as Record<string, { title: string; action: string }>;
  return known[code] ?? { title: code, action: recovery };
}

function formatWhen(value?: string) {
  if (!value) return "Đang xử lý";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  if (minutes < 1_440) return `${Math.round(minutes / 60)} giờ trước`;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function ManualRunPanel({
  targets,
  openRequest = 0,
  externalOpenButton,
}: {
  targets: Target[];
  openRequest?: number;
  externalOpenButton?: RefObject<HTMLButtonElement | null>;
}) {
  const [targetId, setTargetId] = useState("");
  const [days, setDays] = useState("7");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyLoadError, setHistoryLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [runTargetId, setRunTargetId] = useState("");
  const [profile, setProfile] = useState<Profile>("smoke");
  const [context, setContext] = useState({ pullRequest: "", commitSha: "" });
  const [preflight, setPreflight] = useState<Preflight>();
  const [availableProfilesByTarget, setAvailableProfilesByTarget] = useState<
    Record<string, Record<Profile, boolean>>
  >({});
  const [confirmationKey, setConfirmationKey] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [selectedRun, setSelectedRun] = useState<HistoryItem>();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openRunButton = useRef<HTMLButtonElement>(null);
  const openedExternally = useRef(false);
  const lastOpenRequest = useRef(0);
  const requestSequence = useRef(0);
  const preflightRequestSequence = useRef(0);
  const sortedTargets = useMemo(
    () =>
      [...targets].sort((left, right) => left.name.localeCompare(right.name)),
    [targets],
  );
  const activeTarget = sortedTargets.find(
    (target) => target.id === runTargetId,
  );
  const packOptions = useMemo(
    () =>
      [
        ...new Set(
          [...history.map((run) => run.packId), filters.packId].filter(
            (packId): packId is string => Boolean(packId),
          ),
        ),
      ].sort(),
    [filters.packId, history],
  );

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const loadHistory = async (cursor?: string, append = false, preserve = false) => {
    const sequence = ++requestSequence.current;
    setLoadingHistory(true);
    setHistoryLoadError("");
    const query = new URLSearchParams({ days });
    if (targetId) query.set("targetId", targetId);
    if (cursor) query.set("cursor", cursor);
    Object.entries(filters).forEach(([key, value]) => {
      if (value.trim()) query.set(key, value.trim());
    });
    try {
      const response = await fetch(`/api/admin/qa/runs?${query}`, {
        credentials: "same-origin",
      });
      const body = (await response.json()) as {
        data?: HistoryItem[];
        active?: HistoryItem[];
        completed?: HistoryItem[];
        meta?: { nextCursor?: string };
      };
      if (sequence !== requestSequence.current) return;
      if (!response.ok) throw new Error();
      const records = [
        ...(body.active ?? []),
        ...(body.completed ?? []),
        ...(body.data ?? []),
      ];
      setHistory((current) =>
        append
          ? [
              ...current,
              ...records.filter(
                (item) => !current.some((old) => old.id === item.id),
              ),
            ]
          : preserve
            ? [
                ...records,
                ...current.filter(
                  (old) =>
                    !records.some((item) => item.id === old.id) &&
                    !["queued", "dispatched", "cancel_requested"].includes(
                      old.status,
                    ),
                ),
              ]
            : records,
      );
      if (!preserve) setNextCursor(body.meta?.nextCursor);
    } catch {
      if (sequence === requestSequence.current)
        setHistoryLoadError("Không thể tải lịch sử chạy. Hãy thử lại.");
    } finally {
      if (sequence === requestSequence.current) setLoadingHistory(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTargetId(params.get("targetId") ?? "");
    setDays(params.get("days") ?? "7");
    setFilters({
      status: params.get("status") ?? "",
      profile: params.get("profile") ?? "",
      pullRequest: params.get("pullRequest") ?? "",
      commitSha: params.get("commitSha") ?? "",
      packId: params.get("packId") ?? "",
      testCaseId: params.get("testCaseId") ?? "",
    });
  }, []);
  useEffect(() => void loadHistory(), [targetId, days, filters]);
  useEffect(() => {
    const hasActiveRun = history.some((run) =>
      ["queued", "dispatched", "cancel_requested"].includes(run.status),
    );
    if (!hasActiveRun) return;
    const timer = window.setInterval(() => void loadHistory(undefined, false, true), 15_000);
    return () => window.clearInterval(timer);
  }, [history, targetId, days, filters]);
  useEffect(() => {
    const url = new URL(window.location.href);
    ["targetId", "days", ...Object.keys(emptyFilters)].forEach((key) =>
      url.searchParams.delete(key),
    );
    if (targetId) url.searchParams.set("targetId", targetId);
    if (days !== "7") url.searchParams.set("days", days);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    window.history.replaceState(null, "", url);
  }, [targetId, days, filters]);
  useEffect(() => {
    if (!dialogOpen) return;
    const focusable = () => [
      ...(dialogRef.current?.querySelectorAll<HTMLElement>(
        "input, select, button:not([disabled])",
      ) ?? []),
    ];
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") return setDialogOpen(false);
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      (openedExternally.current
        ? externalOpenButton?.current
        : openRunButton.current
      )?.focus();
      openedExternally.current = false;
    };
  }, [dialogOpen, externalOpenButton]);
  useEffect(() => {
    if (!openRequest || openRequest <= lastOpenRequest.current) return;
    lastOpenRequest.current = openRequest;
    openedExternally.current = true;
    setRunTargetId(targetId);
    setPreflight(undefined);
    setConfirmationKey(undefined);
    setDialogOpen(true);
  }, [openRequest, targetId]);
  useEffect(() => {
    if (!dialogOpen || !runTargetId) return;
    preflightRequestSequence.current += 1;
    const contextIsPartial =
      Boolean(context.pullRequest) !== Boolean(context.commitSha);
    if (contextIsPartial) {
      // Keep the blocking preflight visible while the operator completes the
      // required PR/SHA pair. Clearing it here collapses the SHA field after
      // entering PR, making the context impossible to complete.
      return;
    }
    setPreflight(undefined);
    void review();
    // Profile/target previews are advisory; dispatch repeats this check server-side.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context.commitSha,
    context.pullRequest,
    dialogOpen,
    runTargetId,
    profile,
  ]);

  const review = async () => {
    if (!runTargetId) return;
    const sequence = ++preflightRequestSequence.current;
    const reviewedTargetId = runTargetId;
    setSubmitting(true);
    try {
      const query = new URLSearchParams({ targetId: runTargetId, profile });
      if (context.pullRequest || context.commitSha) {
        query.set("pullRequest", context.pullRequest);
        query.set("commitSha", context.commitSha);
      }
      const response = await fetch(
        `/api/admin/qa/manual-runs/preflight?${query}`,
        {
          credentials: "same-origin",
        },
      );
      const body = (await response.json()) as { data?: Preflight };
      const preflightData = body.data;
      if (!response.ok || !preflightData) throw new Error();
      if (sequence !== preflightRequestSequence.current) return;
      setAvailableProfilesByTarget((current) => ({
        ...current,
        [reviewedTargetId]: preflightData.availableProfiles,
      }));
      setPreflight(preflightData);
      if (preflightData.canDispatch) {
        setConfirmationKey(
          (current) => current ?? crypto.randomUUID().replaceAll("-", ""),
        );
      }
    } catch {
      if (sequence === preflightRequestSequence.current) {
        setPreflight(undefined);
        setMessage("Không thể kiểm tra preflight.");
      }
    } finally {
      if (sequence === preflightRequestSequence.current) setSubmitting(false);
    }
  };

  const dispatch = async () => {
    if (!preflight?.canDispatch || !runTargetId) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/qa/manual-runs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: runTargetId,
          profile,
          pullRequest: context.pullRequest
            ? Number(context.pullRequest)
            : undefined,
          commitSha: context.commitSha || undefined,
          idempotencyKey:
            confirmationKey ?? crypto.randomUUID().replaceAll("-", ""),
        }),
      });
      if (!response.ok) throw new Error();
      setDialogOpen(false);
      setMessage("Run đã được gửi vào hàng đợi.");
      await loadHistory();
    } catch {
      setMessage("Không thể gửi run. Kiểm tra lại preflight rồi thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (run: HistoryItem) => {
    if (!window.confirm("Hủy run đang chờ hoặc đang chạy?")) return;
    const response = await fetch(
      `/api/admin/qa/manual-runs/${run.id.replace("dispatch-", "")}/cancel`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Cancelled by QA tester" }),
      },
    );
    setMessage(
      response.ok ? "Yêu cầu hủy đã được ghi nhận." : "Không thể hủy run này.",
    );
    if (response.ok) await loadHistory();
  };

  const clearFilters = () => {
    setTargetId("");
    setDays("7");
    setFilters(emptyFilters);
  };

  return (
    <section aria-labelledby="manual-runs-title" className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2
            id="manual-runs-title"
            className="text-[20px] font-bold tracking-tight"
          >
            Lịch sử chạy test
          </h2>
          <p className="mt-1 text-[13px] text-[var(--text-2)]">
            Theo dõi lịch sử chạy test hoặc chạy một target cụ thể; không có nút
            chạy toàn dự án.
          </p>
        </div>
        <div className="hidden gap-2 sm:grid sm:grid-cols-4">
          <select
            aria-label="Khoảng thời gian"
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className={toolbarFieldClass}
          >
            <option value="7">Thời gian: 7 ngày</option>
            <option value="14">Thời gian: 14 ngày</option>
            <option value="30">Thời gian: 30 ngày</option>
          </select>
          <select
            aria-label="Lọc Target"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            className={toolbarFieldClass}
          >
            <option value="">Target: Tất cả</option>
            {sortedTargets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc Pack"
            value={filters.packId}
            onChange={(event) => updateFilter("packId", event.target.value)}
            className={toolbarFieldClass}
          >
            <option value="">Gói test: Tất cả</option>
            {packOptions.map((packId) => (
              <option key={packId} value={packId}>
                {packId}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc Trạng thái"
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
            className={toolbarFieldClass}
          >
            <option value="">Kết quả: Tất cả</option>
            <option value="passed">Đạt</option>
            <option value="failed">Thất bại</option>
            <option value="dispatched">Đang chạy</option>
            <option value="cancelled">Đã hủy</option>
          </select>
          <select aria-label="Lọc Profile" value={filters.profile} onChange={(event) => updateFilter("profile", event.target.value)} className={toolbarFieldClass}>
            <option value="">Profile: Tất cả</option><option value="smoke">Smoke</option><option value="regression">Regression</option>
          </select>
          <input aria-label="Lọc PR" value={filters.pullRequest} onChange={(event) => updateFilter("pullRequest", event.target.value)} placeholder="PR #" className={toolbarFieldClass} />
          <input aria-label="Lọc SHA" value={filters.commitSha} onChange={(event) => updateFilter("commitSha", event.target.value)} placeholder="Commit SHA" className={toolbarFieldClass} />
        </div>
      </div>
      <article className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elev)]">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[12px] text-[var(--text-2)]">
              Staging only · evidence liên kết GitHub an toàn.
            </p>
          </div>
          <button
            ref={openRunButton}
            type="button"
            onClick={() => {
              setRunTargetId(targetId);
              setPreflight(undefined);
              setConfirmationKey(undefined);
              setDialogOpen(true);
            }}
            className="min-h-11 rounded-[var(--radius)] bg-[var(--text)] px-4 text-[13px] font-bold text-[var(--bg)] shadow-[0_4px_10px_color-mix(in_srgb,var(--text)_20%,transparent)] sm:min-h-9"
          >
            Chạy test theo target
          </button>
        </div>
        <div className="border-b border-[var(--border)] bg-[var(--bg-sunk)] p-3 sm:hidden">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elev)] px-3 text-left text-sm font-semibold"
          >
            Bộ lọc lịch sử
          </button>
        </div>
        {(targetId || days !== "7" || Object.values(filters).some(Boolean)) && (
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-sunk)] px-4 py-2 text-xs text-[var(--text-2)]">
            <span>Đang áp dụng bộ lọc</span>
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-11 font-semibold text-[var(--accent)]"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-left text-[13px]">
            <thead className="border-b border-[var(--border)] bg-[var(--bg-sunk)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-3)]">
              <tr>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Gói test / result</th>
                <th className="px-4 py-3">PR / SHA</th>
                <th className="px-4 py-3">Hoàn tất</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {history.map((run) => (
                <RunRow
                  key={run.id}
                  run={run}
                  targets={sortedTargets}
                  onView={setSelectedRun}
                  onCancel={cancel}
                />
              ))}
            </tbody>
          </table>
        </div>
        <ul className="divide-y divide-[var(--border)] md:hidden">
          {history.map((run) => (
            <li key={run.id} className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {sortedTargets.find((target) => target.id === run.targetId)
                      ?.name ?? run.targetId}
                  </p>
                  <p className="text-xs text-[var(--text-2)]">
                    {run.profile} · {run.packId ?? "terminal"}
                  </p>
                </div>
                <StatusPill status={run.status} />
              </div>
              <p className="font-mono text-xs text-[var(--text-2)]">
                #{run.pullRequest ?? "—"} ·{" "}
                {run.commitSha?.slice(0, 7) ?? "SHA —"}
              </p>
              <button
                type="button"
                onClick={() => setSelectedRun(run)}
                className="min-h-11 text-sm font-semibold text-[var(--accent)]"
              >
                Xem lần chạy
              </button>
            </li>
          ))}
        </ul>
        {loadingHistory && (
          <p aria-busy="true" className="p-6 text-sm text-[var(--text-2)]">
            Đang tải lịch sử chạy…
          </p>
        )}
        {historyLoadError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 p-6 text-sm text-[var(--text-2)]"
          >
            <span>{historyLoadError}</span>
            <button
              type="button"
              onClick={() => void loadHistory()}
              className="min-h-9 rounded-[var(--radius)] border border-[var(--border)] px-3 text-[12px] font-bold text-[var(--accent)]"
            >
              Thử lại
            </button>
          </div>
        ) : !loadingHistory && !history.length ? (
          <p className="p-6 text-sm text-[var(--text-2)]">
            Chưa có lần chạy trong bộ lọc này.
          </p>
        ) : null}
        <footer className="flex min-h-12 items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--bg-sunk)] px-4 py-2 text-[12px] text-[var(--text-2)]">
          <span>
            Hiển thị {history.length ? `1–${history.length}` : "0"} lần chạy ·
            Phạm vi {days} ngày gần nhất
          </span>
          {nextCursor ? (
            <button
              type="button"
              onClick={() => void loadHistory(nextCursor, true)}
              className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-4 text-[12px] font-bold sm:min-h-9"
            >
              Tải thêm 50
            </button>
          ) : (
            <span className="text-[11px]">Không còn lần chạy cũ hơn</span>
          )}
        </footer>
      </article>
      <aside className="rounded-[var(--radius)] border border-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_8%,var(--bg-elev))] p-4 text-sm text-[var(--text-2)]">
        <strong className="block text-[var(--text)]">
          Chạy targeted test khi có lý do rõ ràng.
        </strong>{" "}
        Chọn screen, flow hoặc tính năng; preflight hiển thị check, fixture,
        thời gian và capacity trước khi dispatch.
      </aside>
      {message && (
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-[var(--text-2)]"
        >
          {message}
        </p>
      )}
      {dialogOpen && (
        <DispatchDialog
          dialogRef={dialogRef}
          targets={sortedTargets}
          runTargetId={runTargetId}
          setRunTargetId={(value) => {
            setRunTargetId(value);
            setPreflight(undefined);
            setConfirmationKey(undefined);
          }}
          profile={profile}
          setProfile={(value) => {
            setProfile(value);
            setPreflight(undefined);
            setConfirmationKey(undefined);
          }}
          context={context}
          setContext={(value) => {
            setContext(value);
            setPreflight(undefined);
            setConfirmationKey(undefined);
          }}
          preflight={preflight}
          availableProfiles={availableProfilesByTarget[runTargetId]}
          onDispatch={() => void dispatch()}
          submitting={submitting}
          onClose={() => setDialogOpen(false)}
        />
      )}
      {selectedRun && (
        <RunDetail
          run={selectedRun}
          target={sortedTargets.find(
            (item) => item.id === selectedRun.targetId,
          )}
          onClose={() => setSelectedRun(undefined)}
        />
      )}
      {mobileFiltersOpen && (
        <MobileFilters
          targets={sortedTargets}
          packOptions={packOptions}
          targetId={targetId}
          setTargetId={setTargetId}
          days={days}
          setDays={setDays}
          filters={filters}
          updateFilter={updateFilter}
          onClear={clearFilters}
          onClose={() => setMobileFiltersOpen(false)}
        />
      )}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-1 text-xs font-bold"
      style={{ borderColor: statusTone(status), color: statusTone(status) }}
    >
      {statusLabel(status)}
    </span>
  );
}
function RunRow({
  run,
  targets,
  onView,
  onCancel,
}: {
  run: HistoryItem;
  targets: Target[];
  onView: (run: HistoryItem) => void;
  onCancel: (run: HistoryItem) => void;
}) {
  const target = targets.find((item) => item.id === run.targetId);
  return (
    <tr>
      <td className="px-4 py-3">
        <p className="font-semibold">{target?.name ?? run.targetId}</p>
        <p className="text-[11px] text-[var(--text-2)]">
          {target?.domain ?? "Target"}
        </p>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <StatusPill status={run.status} />
          <span className="text-[11px] text-[var(--text-2)]">
            {run.profile} · {run.packId ?? "terminal"}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-[11px] text-[var(--text-2)]">
        #{run.pullRequest ?? "—"} · {run.commitSha?.slice(0, 7) ?? "SHA —"}
      </td>
      <td className="px-4 py-3 text-[var(--text-2)]">
        {formatWhen(run.finishedAt ?? run.startedAt)}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          {run.canCancel && (
            <button
              type="button"
              onClick={() => void onCancel(run)}
              className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3 text-[12px] font-bold sm:min-h-9"
            >
              Hủy run
            </button>
          )}
          <button
            type="button"
            onClick={() => onView(run)}
            className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3 text-[12px] font-bold sm:min-h-9"
          >
            Xem lần chạy
          </button>
        </div>
      </td>
    </tr>
  );
}
function DispatchDialog({
  dialogRef,
  targets,
  runTargetId,
  setRunTargetId,
  profile,
  setProfile,
  context,
  setContext,
  preflight,
  availableProfiles,
  onDispatch,
  submitting,
  onClose,
}: {
  dialogRef: RefObject<HTMLDivElement | null>;
  targets: Target[];
  runTargetId: string;
  setRunTargetId: (id: string) => void;
  profile: Profile;
  setProfile: (value: Profile) => void;
  context: { pullRequest: string; commitSha: string };
  setContext: (value: { pullRequest: string; commitSha: string }) => void;
  preflight?: Preflight;
  availableProfiles?: Record<Profile, boolean>;
  onDispatch: () => void;
  submitting: boolean;
  onClose: () => void;
}) {
  const [targetSearch, setTargetSearch] = useState("");
  const [domain, setDomain] = useState("all");
  const selected = targets.find((target) => target.id === runTargetId);
  const domains = [...new Set(targets.map((target) => target.domain))].sort();
  const scopedTargets = targets
    .filter((target) => domain === "all" || target.domain === domain)
    .filter((target) =>
      `${target.domain} ${target.name} ${target.id}`
        .toLowerCase()
        .includes(targetSearch.toLowerCase()),
    );
  const groupedTargets = scopedTargets.reduce<Record<string, Target[]>>(
    (groups, target) => {
      (groups[target.domain] ??= []).push(target);
      return groups;
    },
    {},
  );
  const stagingContextRequired =
    Boolean(context.pullRequest || context.commitSha) ||
    preflight?.reasons.some(
      (reason) => reason.code === "STAGING_CONTEXT_UNAVAILABLE",
    );
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[color-mix(in_srgb,var(--text)_55%,transparent)] p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-run-confirm-title"
        aria-describedby="manual-run-confirm-description"
        className="max-h-[92dvh] w-full max-w-[920px] overflow-y-auto rounded-[var(--radius-lg)] bg-[var(--bg-elev)] shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-[var(--border)] p-5">
          <div>
            <h3 id="manual-run-confirm-title" className="text-xl font-bold">
              Chạy manual targeted test
            </h3>
            <p id="manual-run-confirm-description" className="mt-1 text-sm text-[var(--text-2)]">
              Chọn đúng target trước; hệ thống chỉ chạy test pack liên quan.
            </p>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="min-h-11 min-w-11 text-xl"
          >
            ×
          </button>
        </header>
        <div className="grid md:grid-cols-[1.05fr_.95fr]">
          <section className="border-b border-[var(--border)] p-5 md:border-b-0 md:border-r">
            <label className="text-sm font-semibold">
              Tìm màn hình, flow hoặc feature
              <input
                aria-label="Tìm QA target"
                value={targetSearch}
                onChange={(event) => setTargetSearch(event.target.value)}
                placeholder="Tìm target đã map"
                className={`mt-2 ${fieldClass}`}
              />
            </label>
            <div className="mt-3">
              <label className="text-xs font-semibold text-[var(--text-2)]">
                Nhóm chức năng
                <select
                  aria-label="Nhóm chức năng"
                  value={domain}
                  onChange={(event) => {
                    setDomain(event.target.value);
                    setRunTargetId("");
                  }}
                  className={`mt-1 ${fieldClass}`}
                >
                  <option value="all">Tất cả nhóm</option>
                  {domains.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-2 block text-xs font-semibold text-[var(--text-2)]">
              <span className="flex items-center gap-2">
                Target cần chạy
                <span className="rounded-[var(--radius)] bg-[var(--danger-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--danger)]">
                  Bắt buộc
                </span>
              </span>
              <select
                aria-label="Target cần chạy"
                aria-required="true"
                value={runTargetId}
                onChange={(event) => setRunTargetId(event.target.value)}
                className={`mt-1 ${fieldClass}`}
              >
                <option value="">Chọn target cần chạy</option>
                {scopedTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.id}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-4 text-xs font-semibold uppercase text-[var(--text-3)]">
              Catalog target QA · {scopedTargets.length} target
            </p>
            <div
              aria-label="Danh sách QA target"
              className="mt-2 max-h-64 space-y-3 overflow-y-auto"
            >
              {Object.entries(groupedTargets).map(([domain, items]) => (
                <div key={domain}>
                  <p className="text-xs font-semibold text-[var(--text-2)]">
                    {domain}
                  </p>
                  {items.map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      aria-pressed={runTargetId === target.id}
                      onClick={() => setRunTargetId(target.id)}
                      className={`mt-1 w-full rounded-[var(--radius)] border p-3 text-left ${runTargetId === target.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-transparent hover:bg-[var(--bg-hover)]"}`}
                    >
                      <strong className="block text-[13px]">
                        {target.name}
                      </strong>
                      <span className="text-xs text-[var(--text-2)]">
                        {target.id} · chọn để kiểm tra pack và điều kiện chạy
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
            {selected && (
              <div className="mt-2 rounded-[var(--radius)] border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3">
                <strong className="block">
                  {selected.domain} › {selected.name}
                </strong>
                <span className="text-xs text-[var(--text-2)]">
                  {selected.id}
                </span>
              </div>
            )}
          </section>
          <section className="space-y-4 p-5">
            <h4 className="text-[15px] font-bold">Preflight trước khi chạy</h4>
            {selected ? (
              <div className="rounded-[var(--radius)] border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-2 text-[12px] font-bold text-[var(--accent)]">
                {selected.domain} › {selected.name}
              </div>
            ) : (
              <div className="rounded-[var(--radius)] border border-dashed border-[var(--border-dashed)] px-3 py-2 text-[12px] text-[var(--text-2)]">
                Chọn target để xem pack và điều kiện chạy.
              </div>
            )}
            <fieldset className="border-0 p-0">
              <legend className="px-0 text-xs font-bold uppercase tracking-wide text-[var(--text-3)]">
                Gói test được phép
              </legend>
              <p className="mt-1 text-[11px] text-[var(--text-2)]">
                Chỉ gói có TC-ID đã được QA phê duyệt mới có thể chạy.
              </p>
              <div className="mt-2 space-y-2">
                {(
                  [
                    ["smoke", "Smoke", "Kiểm tra phạm vi tác động đã map"],
                    [
                      "regression",
                      "Regression",
                      "Chỉ chạy khi target có pack regression được chứng nhận",
                    ],
                  ] as const
                ).map(([value, label, description]) => {
                  const available = availableProfiles?.[value] ?? false;
                  const availabilityMessage = !runTargetId
                    ? "Chọn target để xem gói test được phép"
                    : !availableProfiles
                      ? "Đang kiểm tra gói test được phép…"
                      : "Chưa có pack được QA phê duyệt cho target này";
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={profile === value}
                      disabled={!available}
                      onClick={() => setProfile(value)}
                      className={`w-full rounded-[var(--radius)] border p-3 text-left disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:bg-[var(--bg-sunk)] disabled:opacity-70 ${profile === value && available ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] hover:bg-[var(--bg-hover)]"}`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span>
                          <strong className="block text-sm">{label}</strong>
                          <span className="block text-xs text-[var(--text-2)]">
                            {available ? description : availabilityMessage}
                          </span>
                        </span>
                        {profile === value && preflight?.pack && (
                          <span className="shrink-0 text-right text-[11px] font-bold text-[var(--accent)]">
                            {preflight.pack.testCases.length} TC ·{" "}
                            {preflight.pack.estimatedDurationMinutes} phút
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <details
              open={stagingContextRequired}
              className="rounded-[var(--radius)] border border-[var(--border)] p-3"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold">
                Thông tin bản deploy Staging
                <span className="rounded-[var(--radius)] bg-[var(--bg-sunk)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-2)]">
                  {stagingContextRequired
                    ? "Bắt buộc lúc này"
                    : "Có điều kiện"}
                </span>
              </summary>
              <p className="mt-1 text-[11px] text-[var(--text-2)]">
                Hệ thống sẽ tự nhận bản Staging trước. Nếu không tìm được, nhập
                đủ cả PR và Commit SHA của cùng một bản deploy.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-[var(--text-2)]">
                  PR Staging
                  <span className="ml-1 text-[10px] font-bold text-[var(--danger)]">
                    {stagingContextRequired ? "Bắt buộc" : "đi cùng SHA"}
                  </span>
                  <input
                    aria-label="PR Staging"
                    aria-required={stagingContextRequired}
                    value={context.pullRequest}
                    onChange={(event) =>
                      setContext({ ...context, pullRequest: event.target.value })
                    }
                    placeholder="Ví dụ: 1746"
                    className={`mt-1 ${fieldClass}`}
                  />
                </label>
                <label className="block text-xs font-semibold text-[var(--text-2)]">
                  Commit SHA
                  <span className="ml-1 text-[10px] font-bold text-[var(--danger)]">
                    {stagingContextRequired ? "Bắt buộc" : "đi cùng PR"}
                  </span>
                  <input
                    aria-label="Commit SHA"
                    aria-required={stagingContextRequired}
                    value={context.commitSha}
                    onChange={(event) =>
                      setContext({ ...context, commitSha: event.target.value })
                    }
                    placeholder="Ví dụ: a1b2c3d4"
                    className={`mt-1 ${fieldClass}`}
                  />
                </label>
              </div>
            </details>
            <p className="rounded-[var(--radius)] bg-[var(--bg-sunk)] p-3 text-xs text-[var(--text-2)]">
              Chỉ pack được server cho phép mới có thể chạy. Preflight luôn được
              kiểm tra lại trước khi dispatch.
            </p>
            {preflight ? (
              <PreflightCard preflight={preflight} />
            ) : (
              <p className="rounded-[var(--radius)] border border-dashed border-[var(--border-dashed)] p-4 text-sm text-[var(--text-2)]">
                Preflight hiển thị TC-ID, fixture, thời lượng và capacity trước
                khi xác nhận.
              </p>
            )}
          </section>
        </div>
        <footer className="flex flex-col-reverse gap-2 border-t border-[var(--border)] p-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm font-semibold"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={!preflight?.canDispatch || submitting}
            onClick={onDispatch}
            className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {preflight?.pack
              ? `Xác nhận chạy ${preflight.pack.testCases.length} TC`
              : "Xác nhận chạy"}
          </button>
        </footer>
      </div>
    </div>
  );
}
function PreflightCard({ preflight }: { preflight: Preflight }) {
  const blocked = preflight.reasons.map((reason) => ({
    ...reason,
    ...preflightReasonCopy(reason.code, reason.recovery),
  }));
  return (
    <div
      role="status"
      className="rounded-[var(--radius)] border p-4 text-sm"
      style={{
        borderColor: preflight.canDispatch ? "var(--success)" : "var(--warn)",
      }}
    >
      <strong className="block text-[13px]">
        {preflight.canDispatch
          ? "Sẵn sàng chạy test"
          : "Chưa thể chạy test này"}
      </strong>
      {!preflight.canDispatch && (
        <p className="mt-1 text-[12px] text-[var(--text-2)]">
          Hoàn thành các điều kiện dưới đây rồi hệ thống sẽ tự cho phép nút “Xác
          nhận chạy”.
        </p>
      )}
      {preflight.pack && (
        <dl className="mt-3 grid grid-cols-2 gap-2">
          <dt>Pack</dt>
          <dd>
            {preflight.pack.id} · v{preflight.pack.version}
          </dd>
          <dt>Test type</dt>
          <dd>{preflight.pack.testType}</dd>
          <dt>Selected checks</dt>
          <dd>{preflight.pack.testCases.length} TC</dd>
          <dt>Fixture</dt>
          <dd>{preflight.pack.fixtureKey}</dd>
          <dt>Estimated duration</dt>
          <dd>{preflight.pack.estimatedDurationMinutes} phút</dd>
          <dt>Manual checklist</dt>
          <dd>{preflight.pack.manualChecklistCount} mục</dd>
          <dt>Environment</dt>
          <dd>{preflight.environment}</dd>
        </dl>
      )}
      <ul className="mt-3 space-y-2">
        {blocked.map((reason) => (
          <li
            key={reason.code}
            className="rounded-[var(--radius)] bg-[color-mix(in_srgb,var(--warn)_10%,var(--bg-elev))] px-3 py-2 text-[12px] text-[var(--text-2)]"
          >
            <strong className="block text-[var(--text)]">{reason.title}</strong>
            <span className="mt-0.5 block">Cần làm: {reason.action}</span>
          </li>
        ))}
        {preflight.pack?.prerequisites.map((item) => (
          <li key={item} className="text-[12px] text-[var(--text-2)]">
            Điều kiện: {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
function RunDetail({
  run,
  target,
  onClose,
}: {
  run: HistoryItem;
  target?: Target;
  onClose: () => void;
}) {
  const resultSummary = (() => {
    if (!run.summary || typeof run.summary !== "object")
      return "Chưa có tổng hợp testcase; evidence an toàn sẽ xuất hiện khi runner hoàn tất.";
    const summary = run.summary as Record<string, unknown>;
    const passed = summary.passed ?? summary.summaryPassed;
    const failed = summary.failed ?? summary.summaryFailed;
    const skipped = summary.skipped ?? summary.summarySkipped;
    const parts = [
      passed === undefined ? undefined : `${String(passed)} đạt`,
      failed === undefined ? undefined : `${String(failed)} thất bại`,
      skipped === undefined ? undefined : `${String(skipped)} bỏ qua`,
    ].filter(Boolean);
    return parts.length
      ? `${parts.join(" · ")} — chỉ hiển thị metadata evidence an toàn.`
      : "Tổng hợp testcase đã được ghi nhận; không hiển thị URL artifact thô.";
  })();
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [
        ...(dialog.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input, select, [href]",
        ) ?? []),
      ];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[color-mix(in_srgb,var(--text)_55%,transparent)] p-4">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="run-detail-title"
        className="w-full max-w-3xl rounded-[var(--radius-lg)] bg-[var(--bg-elev)] shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-[var(--border)] p-5">
          <div>
            <h3 id="run-detail-title" className="text-xl font-bold">
              Chi tiết lần chạy · {target?.name ?? run.targetId}
            </h3>
            <p className="mt-1 text-sm text-[var(--text-2)]">
              Safe run metadata · Staging
            </p>
          </div>
          <button
            type="button"
            aria-label="Đóng chi tiết run"
            onClick={onClose}
            className="min-h-11 min-w-11 text-xl"
          >
            ×
          </button>
        </header>
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <section>
            <h4 className="mb-3 text-[12px] font-bold">Tóm tắt lần chạy</h4>
            <dl className="space-y-2 text-[12px]">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-2)]">Gói test</dt>
                <dd>
                  {run.packId ?? "terminal"} · {run.profile}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-2)]">Kết quả</dt>
                <dd>{statusLabel(run.status)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-2)]">Evidence</dt>
                <dd>{evidenceLabel(run.evidenceState)}</dd>
              </div>
            </dl>
          </section>
          <section>
            <h4 className="mb-3 text-[12px] font-bold">Kết quả testcase</h4>
            <div className="rounded-[var(--radius)] bg-[var(--bg-sunk)] p-3 text-[12px] leading-5 text-[var(--text-2)]">
              {resultSummary}
            </div>
          </section>
        </div>
        <footer className="border-t border-[var(--border)] p-4 text-right">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm font-semibold"
          >
            Đóng
          </button>
        </footer>
      </div>
    </div>
  );
}
function MobileFilters({
  targets,
  packOptions,
  targetId,
  setTargetId,
  days,
  setDays,
  filters,
  updateFilter,
  onClear,
  onClose,
}: {
  targets: Target[];
  packOptions: string[];
  targetId: string;
  setTargetId: (value: string) => void;
  days: string;
  setDays: (value: string) => void;
  filters: Filters;
  updateFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialog.current
      ?.querySelector<HTMLElement>("button, input, select")
      ?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [
        ...(dialog.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input, select",
        ) ?? []),
      ];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[color-mix(in_srgb,var(--text)_55%,transparent)] sm:hidden">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="run-filters-title"
        className="w-full rounded-t-[var(--radius-lg)] bg-[var(--bg-elev)] p-5"
      >
        <div className="flex items-center justify-between">
          <h3 id="run-filters-title" className="text-lg font-bold">
            Bộ lọc lịch sử chạy
          </h3>
          <button
            type="button"
            aria-label="Đóng bộ lọc"
            onClick={onClose}
            className="min-h-11 min-w-11 text-xl"
          >
            ×
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          <select
            aria-label="Lọc Target mobile"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            className={fieldClass}
          >
            <option value="">Target: Tất cả</option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Khoảng thời gian mobile"
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className={fieldClass}
          >
            <option value="7">7 ngày gần đây</option>
            <option value="14">14 ngày gần đây</option>
            <option value="30">30 ngày gần đây</option>
          </select>
          <select
            aria-label="Lọc Pack mobile"
            value={filters.packId}
            onChange={(event) => updateFilter("packId", event.target.value)}
            className={fieldClass}
          >
            <option value="">Gói test: Tất cả</option>
            {packOptions.map((packId) => (
              <option key={packId} value={packId}>
                {packId}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc Trạng thái mobile"
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
            className={fieldClass}
          >
            <option value="">Kết quả: Tất cả</option>
            <option value="passed">Đạt</option>
            <option value="failed">Thất bại</option>
            <option value="dispatched">Đang chạy</option>
            <option value="cancelled">Đã hủy</option>
          </select>
          <select aria-label="Lọc Profile mobile" value={filters.profile} onChange={(event) => updateFilter("profile", event.target.value)} className={fieldClass}>
            <option value="">Profile: Tất cả</option><option value="smoke">Smoke</option><option value="regression">Regression</option>
          </select>
          <input
            aria-label="Lọc PR mobile"
            value={filters.pullRequest}
            onChange={(event) =>
              updateFilter("pullRequest", event.target.value)
            }
            placeholder="PR #"
            className={fieldClass}
          />
          <input
            aria-label="Lọc SHA mobile"
            value={filters.commitSha}
            onChange={(event) => updateFilter("commitSha", event.target.value)}
            placeholder="Commit SHA"
            className={fieldClass}
          />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClear}
            className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] text-sm font-semibold"
          >
            Xóa
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] text-sm font-semibold text-white"
          >
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  );
}
