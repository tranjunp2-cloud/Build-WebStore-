"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type {
  QaControlCenterData,
  QaFeatureDetail,
  QaInboxItem,
} from "@/lib/admin/qa/control-center";
import type {
  HealthState,
  TargetHealthResult,
} from "@/lib/admin/qa/health-calculator";

interface ProjectHealthClientProps {
  initialData: QaControlCenterData;
}

const STATE_CONFIG: Record<
  HealthState,
  { label: string; icon: "check" | "alert" | "danger" | "unknown" }
> = {
  Healthy: { label: "Khỏe mạnh", icon: "check" },
  Watch: { label: "Theo dõi", icon: "alert" },
  "Needs attention": { label: "Cần xử lý", icon: "alert" },
  Critical: { label: "Nghiêm trọng", icon: "danger" },
  Unknown: { label: "Chưa xác định", icon: "unknown" },
};

const COVERAGE_TRANSLATION: Record<string, string> = {
  automated: "Tự động",
  partial: "Tự động một phần",
  manual_only: "Thủ công",
  unknown: "Chưa phân loại",
};

function StateIcon({ state }: { state: HealthState }) {
  const icon = STATE_CONFIG[state].icon;
  if (icon === "check")
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4">
        <path
          d="m4 10 3.5 3.5L16 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    );
  if (icon === "danger")
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4">
        <path
          d="M10 3 2.5 17h15L10 3Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M10 7v4m0 3h.01"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    );
  if (icon === "unknown")
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4">
        <circle
          cx="10"
          cy="10"
          r="7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M8.5 8a1.7 1.7 0 1 1 2.8 1.3c-.9.7-1.3 1.1-1.3 2.2m0 2h.01"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    );
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4">
      <path
        d="M10 3v8m0 4h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle
        cx="10"
        cy="10"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function HealthStateBadge({ state }: { state: HealthState }) {
  const style =
    state === "Healthy"
      ? "border-[var(--success)] text-[var(--success)]"
      : state === "Critical"
        ? "border-[var(--danger)] text-[var(--danger)]"
        : state === "Unknown"
          ? "border-[var(--border)] text-[var(--text-2)]"
          : "border-[var(--warn)] text-[var(--warn)]";
  return (
    <span
      data-testid={`qa-state-${state}`}
      className={`inline-flex items-center gap-1 rounded-[var(--radius)] border px-2 py-1 text-xs font-bold ${style}`}
    >
      <StateIcon state={state} />
      {STATE_CONFIG[state].label}
    </span>
  );
}

function formatDate(value?: string) {
  if (!value) return "Chưa có thời điểm";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Thời điểm không hợp lệ"
    : date.toLocaleString("vi-VN");
}

function FeatureHealthDetail({
  detail,
  onClose,
}: {
  detail: QaFeatureDetail;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    const closeOnCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener("cancel", closeOnCancel);
    return () => {
      dialog.removeEventListener("cancel", closeOnCancel);
      dialog.close();
    };
  }, [onClose]);

  const result = detail.result;
  const [retestStatus, setRetestStatus] = useState("");
  const [retestPending, setRetestPending] = useState(false);
  const [retestConfirming, setRetestConfirming] = useState(false);
  const retest = async () => {
    setRetestPending(true);
    setRetestStatus("");
    try {
      const response = await fetch(
        `/api/admin/qa/targets/${encodeURIComponent(detail.target.targetId)}/retest`,
        { method: "POST", credentials: "same-origin" },
      );
      const body = (await response.json()) as {
        data?: { id?: string | number };
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error ?? "Không thể dispatch retest.");
      setRetestStatus(
        `Đã đưa retest vào hàng đợi (dispatch #${body.data?.id ?? "?"}).`,
      );
    } catch (error) {
      setRetestStatus(
        error instanceof Error ? error.message : "Không thể dispatch retest.",
      );
    } finally {
      setRetestPending(false);
    }
  };
  return (
    <dialog
      ref={dialogRef}
      data-testid="qa-feature-detail"
      aria-labelledby="qa-feature-detail-title"
      className="m-auto w-[min(100%-2rem,48rem)] max-w-none rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elev)] p-0 text-[var(--text)] shadow-2xl backdrop:bg-black/60"
    >
      <div className="max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <p className="text-sm text-[var(--text-2)]">
              {detail.target.domain} / Feature Health Detail
            </p>
            <h2 id="qa-feature-detail-title" className="mt-1 text-xl font-bold">
              {detail.target.targetName}
            </h2>
            <div className="mt-2">
              <HealthStateBadge state={detail.target.state} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-[var(--radius)] border border-[var(--border)] px-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            aria-label="Đóng chi tiết"
          >
            Đóng
          </button>
        </header>

        <section className="mt-5 rounded-[var(--radius)] border border-[var(--border)] p-4">
          <h3 className="font-bold">Lý do cần review</h3>
          <p className="mt-1 text-[var(--text-2)]">
            {detail.target.reasonMessage}
          </p>
          <p className="mt-2 text-sm text-[var(--text-2)]">
            Bằng chứng gần nhất: {formatDate(detail.run?.finishedAt)}
          </p>
        </section>

        {result ? (
          <>
            <section className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailField
                label="TC-ID"
                value={result.testCaseId}
                testId="qa-detail-testcase-id"
              />
              <DetailField
                label="Fixture"
                value={result.fixtureReference ?? "Chưa được ghi nhận"}
                testId="qa-detail-fixture"
              />
              <DetailField
                label="Expected"
                value={
                  result.expectedSummary ?? numericSummary(result.expectedCount)
                }
                testId="qa-detail-expected"
              />
              <DetailField
                label="Actual"
                value={
                  result.actualSummary ?? numericSummary(result.actualCount)
                }
                testId="qa-detail-actual"
              />
              <DetailField
                label="Phân loại"
                value={result.classification ?? "Chưa phân loại"}
                testId="qa-detail-classification"
              />
              <DetailField
                label="Assertion"
                value={result.assertionCode ?? "Không có"}
              />
              <DetailField
                label="PR / SHA"
                value={
                  detail.run?.pullRequest
                    ? `PR #${detail.run.pullRequest} · ${detail.run.commitSha ?? "không có SHA"}`
                    : (detail.run?.commitSha ?? "Chưa liên kết")
                }
              />
              <DetailField
                label="Run"
                value={detail.run?.id ?? "Chưa có run"}
              />
            </section>
            <EvidencePanel evidence={result.evidence} />
            {result.visual && (
              <VisualComparison detail={result.visual} resultId={result.id} />
            )}
          </>
        ) : (
          <section className="mt-4 rounded-[var(--radius)] border border-[var(--border)] p-4 text-[var(--text-2)]">
            Chưa có scenario test được lưu cho target này. Target vẫn giữ trạng
            thái <strong>Chưa xác định</strong> hoặc trạng thái health hiện tại,
            không được suy luận là pass.
          </section>
        )}

        <section className="mt-4 rounded-[var(--radius)] border border-[var(--border)] p-4">
          <h3 className="font-bold">Retest smoke</h3>
          {detail.retest.available ? (
            <>
              <p className="mt-1 text-sm text-[var(--text-2)]">
                Pack đã phê duyệt: {detail.retest.pack?.id} v
                {detail.retest.pack?.version} · fixture{" "}
                {detail.retest.pack?.fixtureKey}
              </p>
              {retestConfirming ? (
                <div className="mt-3 rounded-[var(--radius)] bg-[var(--bg-sunk)] p-3 text-sm">
                  <p>
                    Sẽ chạy{" "}
                    {detail.retest.pack?.testCaseIds.join(", ") ||
                      "pack đã phê duyệt"}{" "}
                    cho PR{" "}
                    {detail.run?.pullRequest
                      ? `#${detail.run.pullRequest}`
                      : "chưa có"}{" "}
                    / SHA {detail.run?.commitSha ?? "chưa có"} trên staging.
                  </p>
                  <p className="mt-1 text-[var(--text-2)]">
                    Preflight fixture/queue sẽ được server kiểm tra trước khi
                    trình duyệt test chạy.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-testid="qa-retest-confirm"
                      disabled={retestPending}
                      onClick={retest}
                      className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {retestPending
                        ? "Đang đưa vào hàng đợi…"
                        : "Xác nhận retest smoke"}
                    </button>
                    <button
                      type="button"
                      disabled={retestPending}
                      onClick={() => setRetestConfirming(false)}
                      className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm font-semibold disabled:opacity-60"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="qa-retest"
                  disabled={retestPending || Boolean(retestStatus)}
                  onClick={() => setRetestConfirming(true)}
                  className="mt-3 min-h-11 rounded-[var(--radius)] border border-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent)] disabled:opacity-60"
                >
                  Retest smoke
                </button>
              )}
            </>
          ) : (
            <p
              id="retest-unavailable-reason"
              data-testid="qa-retest-pending"
              className="mt-1 text-sm text-[var(--text-2)]"
            >
              Target này chưa có pack Smoke đã được phê duyệt.
            </p>
          )}
          {retestStatus && (
            <p role="status" className="mt-2 text-sm text-[var(--text-2)]">
              {retestStatus}
            </p>
          )}
        </section>
      </div>
    </dialog>
  );
}

function numericSummary(value?: number) {
  return value === undefined ? "Chưa được ghi nhận" : String(value);
}
function DetailField({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <dl className="rounded-[var(--radius)] border border-[var(--border)] p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--text-2)]">
        {label}
      </dt>
      <dd data-testid={testId} className="mt-1 break-words text-sm font-medium">
        {value}
      </dd>
    </dl>
  );
}
function EvidencePanel({
  evidence,
}: {
  evidence?: NonNullable<QaFeatureDetail["result"]>["evidence"];
}) {
  if (!evidence || evidence.availability === "unavailable")
    return (
      <section className="mt-4 rounded-[var(--radius)] border border-[var(--border)] p-4">
        <h3 className="font-bold">Evidence</h3>
        <p className="mt-1 text-sm text-[var(--text-2)]">
          Chưa có link evidence an toàn được ghi nhận.
        </p>
      </section>
    );
  if (evidence.availability === "expired")
    return (
      <section className="mt-4 rounded-[var(--radius)] border border-[var(--border)] p-4">
        <h3 className="font-bold">Evidence</h3>
        <p className="mt-1 text-sm text-[var(--text-2)]">
          Bằng chứng đã hết hạn {formatDate(evidence.expiresAt)}. Không mở raw
          CI artifact.
        </p>
      </section>
    );
  return (
    <section className="mt-4 rounded-[var(--radius)] border border-[var(--border)] p-4">
      <h3 className="font-bold">Evidence</h3>
      <a
        data-testid={`qa-evidence-${evidence.kind}`}
        href={evidence.url}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex min-h-11 items-center rounded-[var(--radius)] border border-[var(--accent)] px-3 text-sm font-semibold text-[var(--accent)]"
      >
        Mở {evidence.kind} an toàn
      </a>
      <p className="mt-1 text-xs text-[var(--text-2)]">
        Hết hạn: {formatDate(evidence.expiresAt)}
      </p>
    </section>
  );
}
function VisualComparison({
  detail,
  resultId,
}: {
  detail: NonNullable<NonNullable<QaFeatureDetail["result"]>["visual"]>;
  resultId: string;
}) {
  const [status, setStatus] = useState(detail.reviewStatus);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const reviewStatusLabel: Record<typeof status, string> = {
    pending_review: "Chờ tester xác nhận",
    confirmed_regression: "Đã xác nhận regression",
    expected_change: "Đã đánh dấu thay đổi hợp lệ",
  };
  const review = async (
    nextStatus: "confirmed_regression" | "expected_change",
  ) => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/qa/results/${encodeURIComponent(resultId)}/visual-review`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      if (!response.ok)
        throw new Error("Không thể lưu xác nhận visual review.");
      setStatus(nextStatus);
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Không thể lưu xác nhận visual review.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <section
      data-testid="qa-visual-comparison"
      className="mt-4 rounded-[var(--radius)] border border-[var(--border)] p-4"
    >
      <h3 className="font-bold">Visual comparison</h3>
      <p
        data-testid="qa-visual-review-status"
        className="mt-1 text-sm text-[var(--text-2)]"
      >
        Chênh lệch {detail.differencePercent}% · ngưỡng{" "}
        {detail.thresholdPercent}% · {reviewStatusLabel[status]}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {detail.evidence.map((item) =>
          item.availability === "available" ? (
            <a
              key={item.kind}
              data-testid={`qa-evidence-${item.kind}`}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center justify-center rounded-[var(--radius)] border border-[var(--accent)] px-3 text-sm font-semibold text-[var(--accent)]"
            >
              {item.kind}
            </a>
          ) : (
            <span
              key={item.kind}
              className="flex min-h-11 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm text-[var(--text-2)]"
            >
              {item.kind}:{" "}
              {item.availability === "expired" ? "đã hết hạn" : "không có"}
            </span>
          ),
        )}
      </div>
      {status === "pending_review" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => review("confirmed_regression")}
            className="min-h-11 rounded-[var(--radius)] bg-[var(--danger)] px-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            Xác nhận regression
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => review("expected_change")}
            className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm font-semibold disabled:opacity-60"
          >
            Đánh dấu thay đổi hợp lệ
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
      <p className="mt-3 text-sm text-[var(--text-2)]">
        Không tạo GitHub bug cho đến khi tester xác nhận.
      </p>
    </section>
  );
}

function Inbox({
  items,
  onOpen,
  onLoadMore,
  loadingMore,
  hasMore,
}: {
  items: QaInboxItem[];
  onOpen: (item: QaInboxItem, trigger: HTMLButtonElement) => void;
  onLoadMore: () => void;
  loadingMore: boolean;
  hasMore: boolean;
}) {
  const [stateFilter, setStateFilter] = useState<HealthState | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<
    "all" | QaInboxItem["source"]
  >("all");
  const filteredItems = items.filter(
    (item) =>
      (stateFilter === "all" || item.target.state === stateFilter) &&
      (sourceFilter === "all" || item.source === sourceFilter),
  );
  const hasFilters = stateFilter !== "all" || sourceFilter !== "all";
  if (!items.length)
    return (
      <section
        data-testid="qa-empty-state"
        className="rounded-[var(--radius)] border border-[var(--border)] p-8 text-center"
      >
        <h2 className="font-bold">Không có mục cần xử lý</h2>
        <p className="mt-1 text-sm text-[var(--text-2)]">
          Không có signal action nào trong dữ liệu QA hiện tại.
        </p>
      </section>
    );
  return (
    <section
      data-testid="qa-inbox-list"
      aria-label="QA Inbox"
      className="space-y-3"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          aria-label="Lọc trạng thái Inbox"
          value={stateFilter}
          onChange={(event) =>
            setStateFilter(event.target.value as HealthState | "all")
          }
          className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3"
        >
          <option value="all">Tất cả trạng thái</option>
          {(Object.keys(STATE_CONFIG) as HealthState[]).map((state) => (
            <option key={state} value={state}>
              {STATE_CONFIG[state].label}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc nguồn Inbox"
          value={sourceFilter}
          onChange={(event) =>
            setSourceFilter(
              event.target.value as "all" | QaInboxItem["source"],
            )
          }
          className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3"
        >
          <option value="all">Tất cả nguồn</option>
          <option value="automatic_deploy">Tự động sau deploy</option>
          <option value="manual_run">Chạy thủ công</option>
          <option value="deploy_impact">Ảnh hưởng deploy</option>
          <option value="github_sync">Đồng bộ GitHub</option>
        </select>
      </div>
      {hasFilters && (
        <div className="flex items-center gap-3 text-sm text-[var(--text-2)]">
          <span>Đang áp dụng bộ lọc</span>
          <button
            type="button"
            onClick={() => {
              setStateFilter("all");
              setSourceFilter("all");
            }}
            className="min-h-11 text-[var(--accent)] underline"
          >
            Xóa bộ lọc
          </button>
        </div>
      )}
      {!filteredItems.length && (
        <p className="rounded-[var(--radius)] border border-[var(--border)] p-6 text-center text-sm text-[var(--text-2)]">
          Không có mục phù hợp với bộ lọc.
        </p>
      )}
      {filteredItems.map((item) => (
        <article
          key={item.target.targetId}
          data-testid={`qa-inbox-row-${item.target.targetId}`}
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elev)] p-4"
        >
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold">{item.target.targetName}</h2>
                <HealthStateBadge state={item.target.state} />
              </div>
              <p className="mt-1 text-sm text-[var(--text-2)]">
                {item.target.reasonMessage}
              </p>
              <p className="mt-2 text-sm text-[var(--text-2)]">
                Evidence gần nhất:{" "}
                {item.detail.result?.testCaseId ?? "chưa có testcase"}
                {" · "}
                {describeEvidence(item.latestEvidence)} ·{" "}
                {formatDate(item.detail.run?.finishedAt)}
              </p>
              <p className="mt-1 text-sm font-medium">
                Tiếp theo: {item.suggestedNextAction}
              </p>
            </div>
            <button
              type="button"
              data-testid={`qa-open-detail-${item.target.targetId}`}
              onClick={(event) => onOpen(item, event.currentTarget)}
              className="min-h-11 shrink-0 rounded-[var(--radius)] border border-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            >
              Mở chi tiết
            </button>
          </div>
        </article>
      ))}
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm font-semibold disabled:opacity-60"
        >
          {loadingMore ? "Đang tải…" : "Tải thêm 25"}
        </button>
      )}
    </section>
  );
}

function describeEvidence(evidence: QaInboxItem["latestEvidence"]) {
  if (evidence.availability === "available")
    return `${evidence.kind} an toàn có thể mở`;
  if (evidence.availability === "expired") return "evidence đã hết hạn";
  return "chưa có evidence an toàn";
}

type QaRunHistoryItem = {
  id: string | number;
  targetId: string;
  suite: string;
  status: string;
  pullRequest?: number;
  commitSha?: string;
  finishedAt?: string;
};
function RunHistory() {
  const [runs, setRuns] = useState<QaRunHistoryItem[]>([]);
  const [days, setDays] = useState("7");
  const [targetId, setTargetId] = useState("");
  const [suite, setSuite] = useState("");
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState("0");
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (active) setError("");
        const params = new URLSearchParams({ days });
        params.set("cursor", cursor);
        if (targetId) params.set("targetId", targetId);
        if (suite) params.set("suite", suite);
        if (status) params.set("status", status);
        const response = await fetch(`/api/admin/qa/runs?${params}`, {
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error("Không thể tải lịch sử chạy.");
        const body = (await response.json()) as {
          data: QaRunHistoryItem[];
          meta: { nextCursor?: string };
        };
        if (active) {
          setRuns((current) =>
            cursor === "0" ? body.data : [...current, ...body.data],
          );
          setHasMore(Boolean(body.meta.nextCursor));
          setNextCursor(body.meta.nextCursor);
        }
      } catch (loadError) {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Không thể tải lịch sử chạy.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [cursor, days, status, suite, targetId]);
  const resetFilters = () => {
    setDays("7");
    setTargetId("");
    setSuite("");
    setStatus("");
    setCursor("0");
    setNextCursor(undefined);
  };
  const filtersActive = days !== "7" || Boolean(targetId || suite || status);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <select
          aria-label="Khoảng thời gian"
          value={days}
          onChange={(e) => {
            setDays(e.target.value);
            setCursor("0");
            setNextCursor(undefined);
          }}
          className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3"
        >
          <option value="1">24 giờ</option>
          <option value="7">7 ngày</option>
          <option value="30">30 ngày</option>
        </select>
        <input
          aria-label="Lọc target run"
          value={targetId}
          onChange={(e) => {
            setTargetId(e.target.value);
            setCursor("0");
            setNextCursor(undefined);
          }}
          placeholder="Target ID"
          className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3"
        />
        <input
          aria-label="Lọc pack run"
          value={suite}
          onChange={(e) => {
            setSuite(e.target.value);
            setCursor("0");
            setNextCursor(undefined);
          }}
          placeholder="Pack / suite"
          className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3"
        />
        <select
          aria-label="Lọc kết quả run"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setCursor("0");
            setNextCursor(undefined);
          }}
          className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3"
        >
          <option value="">Tất cả kết quả</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="blocked">Blocked</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      {filtersActive && (
        <div className="flex items-center gap-3 text-sm text-[var(--text-2)]">
          <span>Đang áp dụng bộ lọc</span>
          <button
            type="button"
            onClick={resetFilters}
            className="min-h-11 text-[var(--accent)] underline"
          >
            Xóa bộ lọc
          </button>
        </div>
      )}
      {loading ? (
        <section
          aria-busy="true"
          className="rounded-[var(--radius)] border border-[var(--border)] p-6 text-[var(--text-2)]"
        >
          Đang tải lịch sử chạy…
        </section>
      ) : error ? (
        <section
          role="alert"
          className="rounded-[var(--radius)] border border-[var(--danger)] p-6 text-[var(--danger)]"
        >
          {error}
        </section>
      ) : runs.length ? <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
        {runs.map((run) => (
          <li key={run.id} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <strong>{run.targetId}</strong>
              <span className="text-sm text-[var(--text-2)]">
                {run.suite} · {run.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--text-2)]">
              {run.pullRequest ? `PR #${run.pullRequest} · ` : ""}
              {run.commitSha ?? "Không có SHA"} · {formatDate(run.finishedAt)}
            </p>
          </li>
        ))}
      </ul> : (
        <section className="rounded-[var(--radius)] border border-[var(--border)] p-6 text-[var(--text-2)]">
          Không có run QA phù hợp với bộ lọc hiện tại.
          {filtersActive && " Hãy xóa bộ lọc hoặc chọn khoảng thời gian khác."}
        </section>
      )}
      {!loading && !error && hasMore && (
        <button
          type="button"
          onClick={() => {
            if (nextCursor) setCursor(nextCursor);
          }}
          className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm font-semibold"
        >
          Tải thêm 50
        </button>
      )}
    </div>
  );
}

function ProjectHealthMap({
  targets,
  detailsByTarget,
  onOpen,
}: {
  targets: TargetHealthResult[];
  detailsByTarget: ReadonlyMap<string, QaFeatureDetail>;
  onOpen: (detail: QaFeatureDetail, trigger: HTMLButtonElement) => void;
}) {
  const initialFilters = useMemo(() => {
    if (typeof window === "undefined")
      return { search: "", state: "all", domain: "all", coverage: "all" };
    const params = new URLSearchParams(window.location.search);
    const state = params.get("healthState");
    return {
      search: params.get("targetSearch") ?? "",
      state: Object.prototype.hasOwnProperty.call(STATE_CONFIG, state ?? "")
        ? state!
        : "all",
      domain: params.get("domain") ?? "all",
      coverage: params.get("coverage") ?? "all",
    };
  }, []);
  const [search, setSearch] = useState(initialFilters.search);
  const [stateFilter, setStateFilter] = useState<HealthState | "all">(
    initialFilters.state as HealthState | "all",
  );
  const [domainFilter, setDomainFilter] = useState(initialFilters.domain);
  const [coverageFilter, setCoverageFilter] = useState(initialFilters.coverage);
  const domains = useMemo(
    () => [...new Set(targets.map((target) => target.domain))].sort(),
    [targets],
  );
  const filtered = useMemo(
    () =>
      targets.filter(
        (target) =>
          `${target.targetName} ${target.targetId}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()) &&
          (stateFilter === "all" || target.state === stateFilter) &&
          (domainFilter === "all" || target.domain === domainFilter) &&
          (coverageFilter === "all" || target.coverage === coverageFilter),
      ),
    [coverageFilter, domainFilter, search, stateFilter, targets],
  );
  const hasFilters =
    stateFilter !== "all" || domainFilter !== "all" || coverageFilter !== "all";
  const clearFilters = () => {
    setStateFilter("all");
    setDomainFilter("all");
    setCoverageFilter("all");
  };
  useEffect(() => {
    const url = new URL(window.location.href);
    const setOptional = (key: string, value: string, fallback: string) => {
      if (value === fallback) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    };
    setOptional("targetSearch", search, "");
    setOptional("healthState", stateFilter, "all");
    setOptional("domain", domainFilter, "all");
    setOptional("coverage", coverageFilter, "all");
    window.history.replaceState(null, "", url);
  }, [coverageFilter, domainFilter, search, stateFilter]);
  const groups = useMemo(() => {
    const byDomain = new Map<string, TargetHealthResult[]>();
    for (const target of filtered) {
      const targetsForDomain = byDomain.get(target.domain) ?? [];
      targetsForDomain.push(target);
      byDomain.set(target.domain, targetsForDomain);
    }
    return [...byDomain.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    );
  }, [filtered]);
  return (
    <section>
      <div className="grid gap-2 sm:grid-cols-3">
        <select
          aria-label="Lọc trạng thái"
          value={stateFilter}
          onChange={(event) =>
            setStateFilter(event.target.value as HealthState | "all")
          }
          className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3"
        >
          <option value="all">Tất cả trạng thái</option>
          {(Object.keys(STATE_CONFIG) as HealthState[]).map((state) => (
            <option key={state} value={state}>
              {STATE_CONFIG[state].label}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc domain"
          value={domainFilter}
          onChange={(event) => setDomainFilter(event.target.value)}
          className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3"
        >
          <option value="all">Tất cả domain</option>
          {domains.map((domain) => (
            <option key={domain} value={domain}>
              {domain}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc coverage"
          value={coverageFilter}
          onChange={(event) => setCoverageFilter(event.target.value)}
          className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3"
        >
          <option value="all">Tất cả coverage</option>
          {Object.entries(COVERAGE_TRANSLATION).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {hasFilters && (
        <div className="mt-2 flex items-center gap-3 text-sm text-[var(--text-2)]">
          <span>Đang áp dụng bộ lọc</span>
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-11 text-[var(--accent)] underline"
          >
            Xóa bộ lọc
          </button>
        </div>
      )}
      <label htmlFor="qa-target-search" className="sr-only">
        Tìm target
      </label>
      <input
        id="qa-target-search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Tìm screen, flow hoặc target ID…"
        className="mt-3 min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3 text-base"
      />
      {filtered.length ? (
        <div className="mt-4 space-y-4">
          {groups.map(([domain, domainTargets]) => (
            <section key={domain} aria-labelledby={`qa-domain-${domain}`}>
              <h3
                id={`qa-domain-${domain}`}
                className="mb-2 text-sm font-bold text-[var(--text-2)]"
              >
                {domain} ({domainTargets.length})
              </h3>
              <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
                {domainTargets.map((target) => (
                  <li
                    id={`target-${target.targetId}`}
                    key={target.targetId}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold">{target.targetName}</h4>
                        <HealthStateBadge state={target.state} />
                      </div>
                      <p className="mt-1 text-sm text-[var(--text-2)]">
                        {target.reasonMessage} ·{" "}
                        {COVERAGE_TRANSLATION[target.coverage] ??
                          target.coverage}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(event) =>
                        onOpen(
                          detailsByTarget.get(target.targetId) ?? {
                            target,
                            retest: {
                              available: false,
                              reason: "NO_ACTIVE_SMOKE_PACK",
                            },
                          },
                          event.currentTarget,
                        )
                      }
                      className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm font-semibold"
                    >
                      Mở chi tiết
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p
          data-testid="qa-empty-state"
          className="mt-4 rounded-[var(--radius)] border border-[var(--border)] p-6 text-center text-sm text-[var(--text-2)]"
        >
          Không tìm thấy target phù hợp.
        </p>
      )}
    </section>
  );
}

export function ProjectHealthClient({ initialData }: ProjectHealthClientProps) {
  const [activeTab, setActiveTab] = useState<"inbox" | "health" | "runs">(
    () => {
      if (typeof window === "undefined") return "inbox";
      const tab = new URLSearchParams(window.location.search).get("tab");
      return tab === "health" || tab === "runs" ? tab : "inbox";
    },
  );
  const [items, setItems] = useState(initialData.inbox.items);
  const [nextCursor, setNextCursor] = useState(initialData.inbox.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<QaFeatureDetail | null>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const restoredDetail = useRef(false);
  const detailsByTarget = useMemo(
    () =>
      new Map([
        ...Object.entries(initialData.detailsByTarget),
        ...items.map((item) => [item.target.targetId, item.detail] as const),
      ]),
    [initialData.detailsByTarget, items],
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", activeTab);
    window.history.replaceState(null, "", url);
  }, [activeTab]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selected) url.searchParams.set("target", selected.target.targetId);
    else url.searchParams.delete("target");
    window.history.replaceState(null, "", url);
  }, [selected]);

  useEffect(() => {
    if (restoredDetail.current) return;
    restoredDetail.current = true;
    const targetId = new URLSearchParams(window.location.search).get("target");
    if (targetId) setSelected(detailsByTarget.get(targetId) ?? null);
  }, [detailsByTarget]);

  const closeDetail = () => {
    setSelected(null);
    window.setTimeout(() => lastTrigger.current?.focus(), 0);
  };
  const openDetail = (item: QaInboxItem, trigger: HTMLButtonElement) => {
    lastTrigger.current = trigger;
    setSelected(item.detail);
  };
  const openHealthDetail = (
    detail: QaFeatureDetail,
    trigger: HTMLButtonElement,
  ) => {
    lastTrigger.current = trigger;
    setSelected(detail);
  };
  const onTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? 2
          : (index + (event.key === "ArrowRight" ? 1 : -1) + 3) % 3;
    tabs.current[next]?.focus();
    setActiveTab(next === 0 ? "inbox" : next === 1 ? "health" : "runs");
  };
  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    setLoadError("");
    try {
      const response = await fetch(
        `/api/admin/qa/control-center?cursor=${encodeURIComponent(nextCursor)}`,
        { credentials: "same-origin" },
      );
      if (!response.ok) throw new Error("Không thể tải thêm QA Inbox.");
      const body = (await response.json()) as { data: QaControlCenterData };
      setItems((current) => [...current, ...body.data.inbox.items]);
      setNextCursor(body.data.inbox.nextCursor);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Không thể tải thêm QA Inbox.",
      );
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="space-y-6 text-[var(--text)]">
      <header className="border-b border-[var(--border)] pb-4">
        <h1 className="text-2xl font-extrabold tracking-tight">
          QA Control Center
        </h1>
        <p className="mt-1 text-sm text-[var(--text-2)]">
          Ưu tiên rủi ro QA từ bằng chứng staging đã lưu.
        </p>
      </header>
      <section
        aria-label="Tóm tắt trạng thái"
        className="grid grid-cols-2 gap-3 sm:grid-cols-5"
      >
        {(Object.keys(STATE_CONFIG) as HealthState[]).map((state) => (
          <div
            key={state}
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elev)] p-3"
          >
            <HealthStateBadge state={state} />
            <strong className="mt-2 block text-2xl">
              {initialData.summary.counts[state]}
            </strong>
            <span className="text-xs text-[var(--text-2)]">target</span>
          </div>
        ))}
      </section>
      <div
        role="tablist"
        aria-label="QA Control Center"
        className="grid grid-cols-3 gap-2 border-b border-[var(--border)]"
      >
        <button
          ref={(element) => {
            tabs.current[0] = element;
          }}
          type="button"
          role="tab"
          id="qa-inbox-tab"
          data-testid="qa-inbox-tab"
          aria-selected={activeTab === "inbox"}
          aria-controls="qa-inbox-panel"
          onKeyDown={(event) => onTabKeyDown(event, 0)}
          onClick={() => setActiveTab("inbox")}
          className={`min-h-11 border-b-2 px-3 text-sm font-bold ${activeTab === "inbox" ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent"}`}
        >
          Việc cần xử lý
        </button>
        <button
          ref={(element) => {
            tabs.current[1] = element;
          }}
          type="button"
          role="tab"
          id="qa-health-tab"
          data-testid="qa-health-tab"
          aria-selected={activeTab === "health"}
          aria-controls="qa-health-panel"
          onKeyDown={(event) => onTabKeyDown(event, 1)}
          onClick={() => setActiveTab("health")}
          className={`min-h-11 border-b-2 px-3 text-sm font-bold ${activeTab === "health" ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent"}`}
        >
          Sức khỏe dự án
        </button>
        <button
          ref={(element) => {
            tabs.current[2] = element;
          }}
          type="button"
          role="tab"
          id="qa-runs-tab"
          data-testid="qa-runs-tab"
          aria-selected={activeTab === "runs"}
          aria-controls="qa-runs-panel"
          onKeyDown={(event) => onTabKeyDown(event, 2)}
          onClick={() => setActiveTab("runs")}
          className={`min-h-11 border-b-2 px-3 text-sm font-bold ${activeTab === "runs" ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent"}`}
        >
          Lịch sử chạy
        </button>
      </div>
      {activeTab === "inbox" ? (
        <section
          id="qa-inbox-panel"
          role="tabpanel"
          aria-labelledby="qa-inbox-tab"
          aria-busy={loadingMore}
        >
          <h2 className="mb-3 text-lg font-bold">QA Inbox</h2>
          {loadError && (
            <div
              data-testid="qa-load-error"
              role="alert"
              className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--danger)] p-3 text-sm text-[var(--danger)]"
            >
              <span>{loadError}</span>
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore || !nextCursor}
                className="min-h-11 rounded-[var(--radius)] border border-current px-3 font-semibold disabled:opacity-60"
              >
                Thử lại
              </button>
            </div>
          )}
          <Inbox
            items={items}
            onOpen={openDetail}
            onLoadMore={loadMore}
            loadingMore={loadingMore}
            hasMore={Boolean(nextCursor)}
          />
        </section>
      ) : activeTab === "health" ? (
        <section
          id="qa-health-panel"
          role="tabpanel"
          aria-labelledby="qa-health-tab"
        >
          <h2 className="mb-3 text-lg font-bold">Sức khỏe dự án</h2>
          <ProjectHealthMap
            targets={initialData.targets}
            detailsByTarget={detailsByTarget}
            onOpen={openHealthDetail}
          />
        </section>
      ) : (
        <section
          id="qa-runs-panel"
          role="tabpanel"
          aria-labelledby="qa-runs-tab"
        >
          <h2 className="mb-3 text-lg font-bold">Lịch sử chạy</h2>
          <RunHistory />
        </section>
      )}
      {selected && (
        <FeatureHealthDetail detail={selected} onClose={closeDetail} />
      )}
    </div>
  );
}
