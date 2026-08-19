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
  QaFindingSummary,
  QaInboxItem,
} from "@/lib/admin/qa/control-center";
import type {
  HealthState,
  TargetHealthResult,
} from "@/lib/admin/qa/health-calculator";
import { ManualRunPanel } from "./ManualRunPanel";

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
      className="fixed left-1/2 top-1/2 m-0 w-[min(100%-2rem,48rem)] max-w-none -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elev)] p-0 text-[var(--text)] shadow-2xl backdrop:bg-black/60"
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

        {detail.target.links.length > 0 && (
          <section className="mt-4 rounded-[var(--radius)] border border-[var(--border)] p-4">
            <h3 className="font-bold">Known bugs & liên kết QA</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {detail.target.links.map((link) => (
                <li key={`${link.label}-${link.url}`}>
                  {link.type === "issue" && (
                    <span className="mr-2 rounded-[var(--radius)] bg-[var(--success-soft)] px-2 py-1 text-xs font-bold text-[var(--success)]">
                      Open · confirmed mapping
                    </span>
                  )}
                  <a href={link.url} target="_blank" rel="noreferrer" className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

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
          <section
            data-testid="qa-coverage-gap"
            className="mt-4 rounded-[var(--radius)] border border-[var(--border)] p-4"
            aria-labelledby="qa-coverage-gap-title"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 id="qa-coverage-gap-title" className="font-bold">
                  Coverage QA chưa sẵn sàng
                </h3>
                <p className="mt-1 text-sm text-[var(--text-2)]">
                  Target này chưa có scenario test và evidence chạy test đáng tin
                  cậy. Vì vậy hệ thống không suy luận target đang ổn định.
                </p>
              </div>
              <HealthStateBadge state={detail.target.state} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <DetailField label="Scenario / TC-ID" value="Chưa được QA map" />
              <DetailField
                label="Smoke pack"
                value={
                  detail.retest.available
                    ? "Đã có pack được phê duyệt"
                    : "Chưa có pack được phê duyệt"
                }
              />
              <DetailField
                label="Việc cần làm"
                value="Bổ sung TC, fixture và pack trước khi chạy"
              />
            </div>
          </section>
        )}

        <section className="mt-4 rounded-[var(--radius)] border border-[var(--border)] p-4">
          <h3 className="font-bold">Phạm vi QA được phê duyệt</h3>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <DetailField label="Trạng thái" value={detail.certification.state} />
            <DetailField label="Owner" value={detail.certification.owner} />
            <DetailField
              label="Profile được phép"
              value={
                detail.certification.allowedProfiles.length
                  ? detail.certification.allowedProfiles.join(", ")
                  : "Chưa có"
              }
            />
          </dl>
          <p className="mt-3 text-sm text-[var(--text-2)]">
            {detail.certification.recovery}
          </p>
        </section>

        <section className="mt-4 rounded-[var(--radius)] border border-[var(--border)] p-4">
          <h3 className="font-bold">
            {detail.retest.available ? "Retest Smoke" : "Khả năng chạy test"}
          </h3>
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
            <div
              id="retest-unavailable-reason"
              data-testid="qa-retest-pending"
              className="mt-2 rounded-[var(--radius)] bg-[var(--bg-sunk)] p-3 text-sm text-[var(--text-2)]"
            >
              <p className="font-semibold text-[var(--text)]">
                Chưa thể chạy Smoke cho target này
              </p>
              <p className="mt-1">
                Cần có TC-ID, fixture và Smoke pack được QA phê duyệt. Khi đủ
                coverage, target sẽ tự xuất hiện trong danh sách chạy test.
              </p>
            </div>
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
    <dl className="m-0 min-w-0 rounded-[var(--radius)] border border-[var(--border)] p-3 text-left">
      <dt className="text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-2)]">
        {label}
      </dt>
      <dd
        data-testid={testId}
        className="m-0 mt-1 break-words text-left text-sm font-medium leading-5"
      >
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

function FindingReviewDialog({
  finding,
  onClose,
  onPromoted,
}: {
  finding: QaFindingSummary;
  onClose: () => void;
  onPromoted: (finding: QaFindingSummary) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState("");

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

  const promote = async () => {
    setPromoting(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/qa/findings/${encodeURIComponent(finding.id)}/promote`,
        { method: "POST", credentials: "same-origin" },
      );
      const body = (await response.json()) as {
        data?: QaFindingSummary;
      };
      if (!response.ok || !body.data)
        throw new Error("Không thể tạo GitHub ticket lúc này.");
      // The mutation returns an internal Payload document; reload the canonical
      // list projection rather than mixing that document with the safe UI DTO.
      window.location.reload();
    } catch {
      // Do not surface provider details, tokens, or raw GitHub failures to QA.
      setError(
        "Không thể tạo GitHub ticket lúc này. Finding vẫn được giữ lại để thử lại.",
      );
    } finally {
      setPromoting(false);
    }
  };
  const dismiss = async () => {
    setPromoting(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/qa/findings/${encodeURIComponent(finding.id)}/dismiss`,
        { method: "POST", credentials: "same-origin" },
      );
      const body = (await response.json()) as { data?: QaFindingSummary };
      if (!response.ok || !body.data) throw new Error();
      window.location.reload();
    } catch {
      setError(
        "Không thể đóng finding lúc này. Finding vẫn được giữ lại để review.",
      );
    } finally {
      setPromoting(false);
    }
  };
  const evidence = finding.evidence;
  return (
    <dialog
      ref={dialogRef}
      data-testid="qa-finding-review-dialog"
      aria-labelledby="qa-finding-review-title"
      className="fixed left-1/2 top-1/2 m-0 w-[min(100%-2rem,48rem)] max-w-none -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elev)] p-0 text-[var(--text)] shadow-2xl backdrop:bg-black/60"
    >
      <div className="max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <p className="text-sm text-[var(--text-2)]">Finding review</p>
            <h2 id="qa-finding-review-title" className="mt-1 text-xl font-bold">
              {finding.targetName ?? finding.targetId}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-2)]">
              {finding.lifecycle.replaceAll("_", " ")} ·{" "}
              {finding.owner ?? "Chưa gán owner"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-[var(--radius)] border border-[var(--border)] px-3 font-semibold"
            aria-label="Đóng finding review"
          >
            Đóng
          </button>
        </header>
        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          <DetailField
            label="TC-ID"
            value={finding.testCaseId ?? "Chưa được ghi nhận"}
          />
          <DetailField
            label="Severity"
            value={finding.severity ?? "Chưa phân loại"}
          />
          <DetailField
            label="Expected"
            value={finding.expectedSummary ?? "Chưa được ghi nhận"}
          />
          <DetailField
            label="Actual"
            value={finding.actualSummary ?? "Chưa được ghi nhận"}
          />
          <DetailField label="Run" value={finding.run?.id ?? "Chưa có run"} />
          <DetailField
            label="PR / SHA"
            value={
              finding.run?.pullRequest
                ? `PR #${finding.run.pullRequest} · ${finding.run.commitSha ?? "không có SHA"}`
                : (finding.run?.commitSha ?? "Chưa liên kết")
            }
          />
        </section>
        <EvidencePanel evidence={evidence} />
        {finding.githubIssue ? (
          <section className="mt-4 rounded-[var(--radius)] border border-[var(--success)] p-4">
            <h3 className="font-bold">GitHub ticket đã tạo</h3>
            <a
              data-testid="qa-finding-github-issue"
              href={finding.githubIssue.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-11 items-center text-[var(--accent)] underline"
            >
              Issue #{finding.githubIssue.issueNumber}
              {finding.githubIssue.title
                ? ` · ${finding.githubIssue.title}`
                : ""}
            </a>
          </section>
        ) : confirming ? (
          <section
            data-testid="qa-finding-promotion-confirmation"
            className="mt-4 rounded-[var(--radius)] border border-[var(--warn)] bg-[var(--bg-sunk)] p-4"
          >
            <h3 className="font-bold">Xác nhận tạo GitHub ticket?</h3>
            <p className="mt-1 text-sm text-[var(--text-2)]">
              Ticket sẽ chứa target, severity, bước tái hiện và các link
              evidence an toàn. Không có ticket nào được tạo nếu bạn hủy.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="qa-finding-confirm-promotion"
                disabled={promoting}
                onClick={promote}
                className="min-h-11 rounded-[var(--radius)] bg-[var(--danger)] px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {promoting ? "Đang tạo…" : "Xác nhận tạo ticket"}
              </button>
              <button
                type="button"
                disabled={promoting}
                onClick={() => setConfirming(false)}
                className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm font-semibold disabled:opacity-60"
              >
                Hủy
              </button>
            </div>
          </section>
        ) : (
          <section className="mt-4 rounded-[var(--radius)] border border-[var(--border)] p-4">
            <h3 className="font-bold">Tạo GitHub ticket</h3>
            <p className="mt-1 text-sm text-[var(--text-2)]">
              Finding nội bộ được giữ nguyên cho đến khi tester xác nhận tạo
              ticket.
            </p>
            <button
              type="button"
              data-testid="qa-finding-open-promotion"
              disabled={finding.lifecycle === "verify_fix"}
              onClick={() => setConfirming(true)}
              className="mt-3 min-h-11 rounded-[var(--radius)] border border-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent)] disabled:opacity-60"
            >
              Tạo GitHub ticket
            </button>
            <button
              type="button"
              data-testid="qa-finding-dismiss"
              disabled={promoting || finding.lifecycle === "github_created"}
              onClick={dismiss}
              className="ml-2 mt-3 min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm font-semibold disabled:opacity-60"
            >
              Đóng finding
            </button>
          </section>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
      </div>
    </dialog>
  );
}

function FindingsInbox({
  findings,
  loading,
  error,
  onOpen,
}: {
  findings: QaFindingSummary[];
  loading: boolean;
  error: string;
  onOpen: (finding: QaFindingSummary, trigger: HTMLButtonElement) => void;
}) {
  if (loading)
    return (
      <p
        aria-busy="true"
        className="rounded-[var(--radius)] border border-[var(--border)] p-6 text-[var(--text-2)]"
      >
        Đang tải findings…
      </p>
    );
  if (error)
    return (
      <p
        role="alert"
        className="rounded-[var(--radius)] border border-[var(--danger)] p-6 text-[var(--danger)]"
      >
        {error}
      </p>
    );
  if (!findings.length)
    return (
      <p
        data-testid="qa-findings-empty"
        className="rounded-[var(--radius)] border border-[var(--border)] p-6 text-[var(--text-2)]"
      >
        Không có finding nào cần review.
      </p>
    );
  return (
    <div data-testid="qa-findings-inbox" className="space-y-3">
      {findings.map((finding) => (
        <article
          key={finding.id}
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elev)] p-4"
        >
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h3 className="font-bold">
                {finding.targetName ?? finding.targetId}
              </h3>
              <p className="mt-1 text-sm text-[var(--text-2)]">
                {finding.testCaseId ?? "Chưa có TC-ID"} ·{" "}
                {finding.lifecycle.replaceAll("_", " ")} ·{" "}
                {finding.owner ?? "Chưa gán owner"}
              </p>
              <p className="mt-1 text-sm text-[var(--text-2)]">
                {finding.githubIssue
                  ? `GitHub #${finding.githubIssue.issueNumber}`
                  : "Chưa tạo GitHub ticket"}
              </p>
            </div>
            <button
              type="button"
              data-testid={`qa-open-finding-${finding.id}`}
              onClick={(event) => onOpen(finding, event.currentTarget)}
              className="min-h-11 shrink-0 rounded-[var(--radius)] border border-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent)]"
            >
              Review finding
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function Inbox({
  items,
  findings,
  findingsLoaded,
  findingsError,
  onOpen,
  onOpenFinding,
  onLoadMore,
  loadingMore,
  hasMore,
}: {
  items: QaInboxItem[];
  findings: QaFindingSummary[];
  findingsLoaded: boolean;
  findingsError: string;
  onOpen: (item: QaInboxItem, trigger: HTMLButtonElement) => void;
  onOpenFinding: (
    finding: QaFindingSummary,
    trigger: HTMLButtonElement,
  ) => void;
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
  const countFor = (state: HealthState) =>
    items.filter((item) => item.target.state === state).length;
  const hasFilters = stateFilter !== "all" || sourceFilter !== "all";
  const hasVisibleFindings = findingsLoaded && findings.length > 0;
  return (
    <section
      data-testid="qa-inbox-list"
      aria-label="QA Inbox"
      className="space-y-3"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-[20px] font-bold tracking-tight">
            Tín hiệu tự động cần QC xem xét
          </h3>
          <p className="mt-1 text-[13px] text-[var(--text-2)]">
            Hệ thống chạy test sau staging deploy; Inbox chỉ nhận việc cần người
            quyết định.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => setStateFilter("all")}
            className={`min-h-11 rounded-[var(--radius)] border px-3 text-[12px] font-bold sm:min-h-9 ${stateFilter === "all" ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)]"}`}
          >
            Tất cả {items.length}
          </button>
          <button
            type="button"
            onClick={() => setStateFilter("Critical")}
            className={`min-h-11 rounded-[var(--radius)] border px-3 text-[12px] font-bold sm:min-h-9 ${stateFilter === "Critical" ? "border-[var(--danger)] text-[var(--danger)]" : "border-[var(--border)]"}`}
          >
            Nghiêm trọng {countFor("Critical")}
          </button>
          <button
            type="button"
            onClick={() => setStateFilter("Needs attention")}
            className={`min-h-11 rounded-[var(--radius)] border px-3 text-[12px] font-bold sm:min-h-9 ${stateFilter === "Needs attention" ? "border-[var(--warn)] text-[var(--warn)]" : "border-[var(--border)]"}`}
          >
            Cần xem xét {countFor("Needs attention")}
          </button>
          <button
            type="button"
            onClick={() => setStateFilter("Watch")}
            className={`min-h-11 rounded-[var(--radius)] border px-3 text-[12px] font-bold sm:min-h-9 ${stateFilter === "Watch" ? "border-[var(--warn)] text-[var(--warn)]" : "border-[var(--border)]"}`}
          >
            Cần theo dõi {countFor("Watch")}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-[28px_1fr] items-center gap-3 rounded-[var(--radius)] border border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_8%,var(--bg-elev))] p-3 text-[12px] sm:grid-cols-[28px_1fr_auto]">
        <span className="grid size-7 place-items-center rounded-full bg-[color-mix(in_srgb,var(--success)_14%,var(--bg-elev))] text-[var(--success)]">
          <StateIcon state="Healthy" />
        </span>
        <div>
          <strong className="block font-bold text-[var(--success)]">
            Theo dõi tự động đang bật cho Staging
          </strong>
          <span className="text-[11px] text-[var(--text-2)]">
            Sau mỗi deploy, hệ thống map phần code thay đổi → target bị ảnh
            hưởng → chạy smoke đã được chứng nhận.
          </span>
        </div>
        <span className="col-start-2 justify-self-start rounded-[var(--radius)] bg-[color-mix(in_srgb,var(--success)_12%,var(--bg-elev))] px-2 py-1 text-[10px] font-bold text-[var(--success)] sm:col-start-auto sm:justify-self-end">
          {items.length} tín hiệu đang cần QC
        </span>
      </div>
      <p className="text-xs text-[var(--text-2)]">
        Dữ liệu hiện có: {items.length} tín hiệu cần QC xử lý. Catalog target
        được quản lý trong thẻ Sức khỏe dự án.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [
            "Nghiêm trọng",
            countFor("Critical"),
            "var(--danger)",
            "Tính năng nghiêm trọng",
          ],
          [
            "Cần duyệt",
            countFor("Needs attention"),
            "var(--warn)",
            "Cần QC xem xét",
          ],
          [
            "Cần kiểm tra lại",
            countFor("Watch"),
            "var(--text)",
            "Cần theo dõi / kiểm tra lại",
          ],
          [
            "Chưa liên kết",
            items.filter((item) => item.source === "github_sync").length,
            "var(--text-2)",
            "Cần liên kết target",
          ],
        ].map(([label, count, color, detail]) => (
          <div
            key={String(label)}
            className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elev)] p-4"
          >
            <span className="text-xs font-bold uppercase text-[var(--text-3)]">
              {label}
            </span>
            <strong
              className="mt-2 block text-2xl tabular-nums"
              style={{ color: String(color) }}
            >
              {count}
            </strong>
            <span className="mt-1 block text-[11px] text-[var(--text-2)]">
              {detail}
            </span>
          </div>
        ))}
      </div>
      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elev)]">
        <header className="flex items-center justify-between border-b border-[var(--border)] p-4">
          <div>
            <h3 className="font-bold">Hộp việc QC</h3>
            <p className="text-sm text-[var(--text-2)]">
              Bấm một phát hiện lỗi để mở Finding Cần duyệt; lịch sử test nằm ở
              thẻ Lịch sử chạy.
            </p>
          </div>
          <select
            aria-label="Lọc nguồn Inbox"
            value={sourceFilter}
            onChange={(event) =>
              setSourceFilter(
                event.target.value as "all" | QaInboxItem["source"],
              )
            }
            className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elev)] px-3 text-[12px] font-bold sm:min-h-9"
          >
            <option value="all">Nguồn: Tất cả</option>
            <option value="automatic_deploy">Tự động sau deploy</option>
            <option value="manual_run">Chạy thủ công</option>
            <option value="deploy_impact">Ảnh hưởng deploy</option>
            <option value="github_sync">Đồng bộ GitHub</option>
          </select>
        </header>
        {hasFilters && (
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg-sunk)] px-4 py-2 text-[12px] text-[var(--text-2)]">
            <span>
              Đang áp dụng:{" "}
              {stateFilter === "all"
                ? "Tất cả mức độ"
                : STATE_CONFIG[stateFilter].label}
              {sourceFilter === "all"
                ? " · Tất cả nguồn"
                : ` · ${inboxSourceLabel(sourceFilter)}`}
            </span>
            <button
              type="button"
              onClick={() => {
                setStateFilter("all");
                setSourceFilter("all");
              }}
              className="min-h-9 shrink-0 font-bold text-[var(--accent)]"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
        {!filteredItems.length && !hasVisibleFindings && (
          <p className="rounded-[var(--radius)] border border-[var(--border)] p-6 text-center text-sm text-[var(--text-2)]">
            Không có mục phù hợp với bộ lọc.
          </p>
        )}
        <div className="hidden overflow-x-auto md:block">
          <table
            data-testid="qa-inbox-table"
            className="min-w-full table-fixed border-separate border-spacing-0 text-left"
          >
            <thead className="bg-[var(--bg-sunk)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-3)]">
              <tr>
                <th className="w-14 px-4 py-3" scope="col">
                  Trạng thái
                </th>
                <th className="w-[34%] px-4 py-3" scope="col">
                  Issue / target
                </th>
                <th className="px-4 py-3" scope="col">
                  Ngữ cảnh QA
                </th>
                <th className="w-44 px-4 py-3 text-right" scope="col">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr
                  key={item.target.targetId}
                  data-testid={`qa-inbox-row-${item.target.targetId}`}
                  className="align-middle"
                >
                  <td className="border-b border-[var(--border)] px-4 py-3 text-center">
                    <span className="grid size-7 place-items-center rounded-[var(--radius)] bg-[var(--bg-sunk)]">
                      <StateIcon state={item.target.state} />
                    </span>
                  </td>
                  <td className="min-w-0 border-b border-[var(--border)] px-4 py-3">
                    <p className="truncate leading-5 text-[13px] font-bold text-[var(--text)]">
                      {item.target.targetName}
                    </p>
                    <p className="mt-1 flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-[var(--text-2)]">
                      <span className="shrink-0 rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[var(--accent)]">
                        {inboxSourceLabel(item.source)}
                      </span>
                      <span className="truncate">
                        {item.detail.result?.testCaseId ?? item.target.targetId}
                      </span>
                    </p>
                  </td>
                  <td className="min-w-0 border-b border-[var(--border)] px-4 py-3">
                    <p className="truncate leading-5 text-[12px] text-[var(--text-2)]">
                      {item.target.reasonMessage}
                    </p>
                    <p className="mt-1 truncate whitespace-nowrap text-[11px] text-[var(--text-3)]">
                      Tiếp theo: {item.suggestedNextAction}
                    </p>
                  </td>
                  <td className="border-b border-[var(--border)] px-4 py-3">
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      <HealthStateBadge state={item.target.state} />
                      <button
                        type="button"
                        data-testid={`qa-open-detail-${item.target.targetId}`}
                        onClick={(event) => onOpen(item, event.currentTarget)}
                        className="min-h-9 rounded-[var(--radius)] border border-[var(--accent)] px-3 text-[12px] font-bold text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                      >
                        Mở
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              <tr>
                <td
                  colSpan={4}
                  className="border-b border-[var(--border)] bg-[var(--bg-sunk)] px-4 py-2 text-[11px] text-[var(--text-2)]"
                >
                  Finding cần review luôn hiển thị để không bỏ sót việc chờ QA
                  xác nhận; không bị lọc theo nguồn hoặc mức độ tín hiệu tự động.
                </td>
              </tr>
              {(
                <>
                  {findingsError && (
                    <tr>
                      <td
                        colSpan={4}
                        role="alert"
                        className="border-b border-[var(--danger)] px-4 py-3 text-[12px] text-[var(--danger)]"
                      >
                        {findingsError}
                      </td>
                    </tr>
                  )}
                  {!findingsLoaded && (
                    <tr>
                      <td
                        colSpan={4}
                        aria-busy="true"
                        className="border-b border-[var(--border)] px-4 py-3 text-[12px] text-[var(--text-2)]"
                      >
                        Đang tải finding cần review…
                      </td>
                    </tr>
                  )}
                  {findings.map((finding) => (
                    <tr key={`finding-${finding.id}`} className="align-middle">
                      <td className="border-b border-[var(--border)] px-4 py-3 text-center">
                        <span className="grid size-7 place-items-center rounded-[var(--radius)] bg-[color-mix(in_srgb,var(--warn)_12%,var(--bg-elev))] text-[var(--warn)]">
                          <StateIcon state="Needs attention" />
                        </span>
                      </td>
                      <td className="min-w-0 border-b border-[var(--border)] px-4 py-3">
                        <p className="truncate leading-5 text-[13px] font-bold text-[var(--text)]">
                          {finding.targetName ?? finding.targetId}
                        </p>
                        <p className="mt-1 flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-[var(--text-2)]">
                          <span className="shrink-0 rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[var(--accent)]">
                            FINDING CẦN REVIEW
                          </span>
                          <span className="truncate">
                            {finding.testCaseId ?? "Chưa có TC-ID"}
                          </span>
                        </p>
                      </td>
                      <td className="min-w-0 border-b border-[var(--border)] px-4 py-3">
                        <p className="truncate leading-5 text-[12px] text-[var(--text-2)]">
                          Owner: {finding.owner ?? "Chưa gán owner"}
                        </p>
                        <p className="mt-1 truncate whitespace-nowrap text-[11px] text-[var(--text-3)]">
                          Chờ QA xác nhận trước khi tạo GitHub ticket.
                        </p>
                      </td>
                      <td className="border-b border-[var(--border)] px-4 py-3">
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                          <span className="rounded-full border border-[var(--warn)] px-2 py-1 text-[10px] font-bold text-[var(--warn)]">
                            Cần duyệt
                          </span>
                          <button
                            type="button"
                            data-testid={`qa-open-finding-${finding.id}`}
                            onClick={(event) =>
                              onOpenFinding(finding, event.currentTarget)
                            }
                            className="min-h-9 rounded-[var(--radius)] border border-[var(--accent)] px-3 text-[12px] font-bold text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                          >
                            Mở
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
        {filteredItems.map((item) => (
          <article
            key={item.target.targetId}
            data-testid={`qa-inbox-mobile-row-${item.target.targetId}`}
            className="border-b border-[var(--border)] px-4 py-3 last:border-b-0 md:hidden"
          >
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <h2 className="text-[13px] font-bold">
                  {item.target.targetName}
                </h2>
                <p className="mt-1 truncate text-[11px] text-[var(--text-2)]">
                  <span className="mr-1 rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[var(--accent)]">
                    {inboxSourceLabel(item.source)}
                  </span>
                  {item.detail.result?.testCaseId ?? item.target.reasonMessage}
                  {item.detail.result?.testCaseId
                    ? ` · ${item.target.reasonMessage}`
                    : ""}
                </p>
                <div className="mt-2 space-y-1 text-[12px] text-[var(--text-2)] sm:hidden">
                  <p>
                    Evidence gần nhất: {describeEvidence(item.latestEvidence)}
                  </p>
                  <p className="font-semibold">
                    Tiếp theo: {item.suggestedNextAction}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <HealthStateBadge state={item.target.state} />
                <button
                  type="button"
                  data-testid={`qa-open-detail-mobile-${item.target.targetId}`}
                  onClick={(event) => onOpen(item, event.currentTarget)}
                  className="min-h-11 rounded-[var(--radius)] border border-[var(--accent)] px-3 text-[12px] font-bold text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] sm:min-h-9"
                >
                  Mở
                </button>
              </div>
            </div>
          </article>
        ))}
        {(
          <>
            <p className="border-b border-[var(--border)] bg-[var(--bg-sunk)] px-4 py-2 text-[11px] text-[var(--text-2)] md:hidden">
              Finding cần review luôn hiển thị để không bỏ sót việc chờ QA xác
              nhận.
            </p>
            {findingsError && (
              <p
                role="alert"
                className="border-b border-[var(--danger)] px-4 py-3 text-[12px] text-[var(--danger)]"
              >
                {findingsError}
              </p>
            )}
            {!findingsLoaded && (
              <p
                aria-busy="true"
                className="border-b border-[var(--border)] px-4 py-3 text-[12px] text-[var(--text-2)]"
              >
                Đang tải finding cần review…
              </p>
            )}
            {findings.map((finding) => (
              <article
                key={`finding-${finding.id}`}
                className="border-b border-[var(--border)] px-4 py-3 last:border-b-0 md:hidden"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <h2 className="text-[13px] font-bold">
                      {finding.targetName ?? finding.targetId}
                    </h2>
                    <p className="mt-1 truncate text-[11px] text-[var(--text-2)]">
                      <span className="mr-1 rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[var(--accent)]">
                        FINDING CẦN REVIEW
                      </span>
                      {finding.testCaseId ?? "Chưa có TC-ID"} ·{" "}
                      {finding.owner ?? "Chưa gán owner"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full border border-[var(--warn)] px-2 py-1 text-[10px] font-bold text-[var(--warn)]">
                      Cần duyệt
                    </span>
                    <button
                      type="button"
                      data-testid={`qa-open-finding-mobile-${finding.id}`}
                      onClick={(event) =>
                        onOpenFinding(finding, event.currentTarget)
                      }
                      className="min-h-11 rounded-[var(--radius)] border border-[var(--accent)] px-3 text-[12px] font-bold text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] sm:min-h-9"
                    >
                      Mở
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </>
        )}
        <footer className="flex min-h-12 items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--bg-sunk)] px-4 py-2 text-[12px] text-[var(--text-2)]">
          <span>
            Hiển thị {filteredItems.length} tín hiệu theo mức độ và thời gian
            mới nhất
          </span>
          {hasMore ? (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="min-h-11 shrink-0 rounded-[var(--radius)] border border-[var(--border)] px-4 text-[12px] font-bold disabled:opacity-60 sm:min-h-9"
            >
              {loadingMore ? "Đang tải…" : "Tải thêm 25"}
            </button>
          ) : (
            <span className="text-[11px]">Không còn tín hiệu cũ hơn</span>
          )}
        </footer>
      </section>
    </section>
  );
}

function describeEvidence(evidence: QaInboxItem["latestEvidence"]) {
  if (evidence.availability === "available")
    return `${evidence.kind} an toàn có thể mở`;
  if (evidence.availability === "expired") return "evidence đã hết hạn";
  return "chưa có evidence an toàn";
}

function inboxSourceLabel(source: QaInboxItem["source"]) {
  return (
    {
      automatic_deploy: "TỰ ĐỘNG · CHỨC NĂNG",
      manual_run: "CHẠY THỦ CÔNG",
      deploy_impact: "ẢNH HƯỞNG DEPLOY",
      github_sync: "ĐỒNG BỘ GITHUB",
    } as Record<QaInboxItem["source"], string>
  )[source];
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
      ) : runs.length ? (
        <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)]">
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
        </ul>
      ) : (
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const filtersButton = useRef<HTMLButtonElement>(null);
  const filtersDialog = useRef<HTMLDivElement>(null);
  const domains = useMemo(
    () => [...new Set(targets.map((target) => target.domain))].sort(),
    [targets],
  );
  const targetsByDomain = useMemo(() => {
    const counts = new Map<string, number>();
    for (const target of targets) {
      counts.set(target.domain, (counts.get(target.domain) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    );
  }, [targets]);
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
    Boolean(search.trim()) ||
    stateFilter !== "all" ||
    domainFilter !== "all" ||
    coverageFilter !== "all";
  const clearFilters = () => {
    setSearch("");
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
  useEffect(() => {
    if (!filtersOpen) return;
    const focusable = () => [
      ...(filtersDialog.current?.querySelectorAll<HTMLElement>(
        "input, select, button:not([disabled])",
      ) ?? []),
    ];
    focusable()[0]?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setFiltersOpen(false);
        return;
      }
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
      filtersButton.current?.focus();
    };
  }, [filtersOpen]);
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
  const counts = useMemo(
    () =>
      (Object.keys(STATE_CONFIG) as HealthState[]).reduce(
        (result, state) => {
          result[state] = targets.filter(
            (target) => target.state === state,
          ).length;
          return result;
        },
        {} as Record<HealthState, number>,
      ),
    [targets],
  );
  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-[20px] font-bold tracking-tight">
            Sức khỏe dự án
          </h3>
          <p className="mt-1 text-[13px] text-[var(--text-2)]">
            {targets.length} CMS target; mọi trạng thái đều có lý do và
            evidence.
          </p>
        </div>
        <div className="hidden w-full items-center gap-2 sm:flex sm:max-w-3xl">
          <input
            aria-label="Tìm target toolbar"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="⌕ Tìm target"
            className="min-h-11 w-52 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elev)] px-3 text-[12px] font-bold sm:min-h-9"
          />
          <select
            aria-label="Lọc coverage toolbar"
            value={coverageFilter}
            onChange={(event) => setCoverageFilter(event.target.value)}
            className="min-h-11 w-36 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elev)] px-3 text-[12px] font-bold sm:min-h-9"
          >
            <option value="all">Độ phủ: Tất cả</option>
            {Object.entries(COVERAGE_TRANSLATION).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc domain toolbar"
            value={domainFilter}
            onChange={(event) => setDomainFilter(event.target.value)}
            className="min-h-11 w-36 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elev)] px-3 text-[12px] font-bold sm:min-h-9"
          >
            <option value="all">Domain: Tất cả</option>
            {domains.map((domain) => (
              <option key={domain} value={domain}>
                {domain}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc trạng thái toolbar"
            value={stateFilter}
            onChange={(event) =>
              setStateFilter(event.target.value as HealthState | "all")
            }
            className="min-h-11 w-36 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elev)] px-3 text-[12px] font-bold sm:min-h-9"
          >
            <option value="all">Trạng thái: Tất cả</option>
            {(Object.keys(STATE_CONFIG) as HealthState[]).map((state) => (
              <option key={state} value={state}>
                {STATE_CONFIG[state].label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        ref={filtersButton}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={filtersOpen}
        onClick={() => {
          setDraftFilters({
            search,
            state: stateFilter,
            domain: domainFilter,
            coverage: coverageFilter,
          });
          setFiltersOpen(true);
        }}
        className="min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elev)] px-3 text-left text-sm font-semibold sm:hidden"
      >
        Lọc sức khỏe dự án
      </button>
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
      <section
        aria-label="Tóm tắt sức khỏe"
        className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5"
      >
        {(Object.keys(STATE_CONFIG) as HealthState[]).map((state) => (
          <div
            key={state}
            className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elev)] p-4"
          >
            <span className="text-xs font-bold uppercase text-[var(--text-3)]">
              {STATE_CONFIG[state].label}
            </span>
            <strong className="mt-2 block text-2xl tabular-nums">
              {counts[state]}
            </strong>
            <span className="text-xs text-[var(--text-2)]">target CMS</span>
          </div>
        ))}
      </section>
      {filtered.length ? (
        <div className="mt-4 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elev)] lg:grid lg:grid-cols-[210px_1fr]">
          <aside className="hidden border-r border-[var(--border)] p-3 lg:block">
            <button
              type="button"
              onClick={() => setDomainFilter("all")}
              className={`mb-1 flex min-h-11 w-full items-center justify-between rounded-[var(--radius)] px-3 text-left text-[12px] font-bold sm:min-h-9 ${domainFilter === "all" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-2)] hover:bg-[var(--bg-hover)]"}`}
            >
              <span>Tất cả target</span>
              <span className="rounded bg-[var(--bg-sunk)] px-1.5 py-0.5 text-xs">
                {targets.length}
              </span>
            </button>
            {targetsByDomain.map(([domain, count]) => (
              <button
                key={domain}
                type="button"
                onClick={() =>
                  setDomainFilter(domainFilter === domain ? "all" : domain)
                }
                className={`flex min-h-11 w-full items-center justify-between rounded-[var(--radius)] px-3 text-left text-[12px] font-bold sm:min-h-9 ${domainFilter === domain ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-2)] hover:bg-[var(--bg-hover)]"}`}
              >
                <span>{domain}</span>
                <span className="rounded bg-[var(--bg-sunk)] px-1.5 py-0.5 text-xs">
                  {count}
                </span>
              </button>
            ))}
          </aside>
          <div className="min-w-0">
            <div className="max-h-[520px] overflow-y-auto p-4">
              {groups.map(([domain, domainTargets]) => (
                <section key={domain} aria-labelledby={`qa-domain-${domain}`}>
                  <h4
                    id={`qa-domain-${domain}`}
                    className="border-b border-[var(--border-strong)] pb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-3)]"
                  >
                    {domain}
                  </h4>
                  <ul>
                    {domainTargets.map((target) => (
                      <li
                        id={`target-${target.targetId}`}
                        key={target.targetId}
                        className="flex flex-col gap-3 border-b border-[var(--border-strong)] px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-[13px] font-bold">
                              {target.targetName}
                            </h4>
                            <HealthStateBadge state={target.state} />
                          </div>
                          <p className="mt-1 text-[12px] text-[var(--text-2)]">
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
                                certification: {
                                  state: "no-certified-pack",
                                  owner: "qa-unassigned",
                                  recovery:
                                    "QA approval is required before this target can run.",
                                  allowedProfiles: [],
                                },
                                retest: {
                                  available: false,
                                  reason: "NO_ACTIVE_SMOKE_PACK",
                                },
                              },
                              event.currentTarget,
                            )
                          }
                          className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-4 text-[12px] font-bold sm:min-h-9"
                        >
                          Mở chi tiết
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <p className="border-t border-[var(--border)] px-4 py-3 text-xs text-[var(--text-2)]">
              {filtered.length}/{targets.length} target CMS · Danh sách cuộn,
              không phân trang.
            </p>
          </div>
        </div>
      ) : (
        <p
          data-testid="qa-empty-state"
          className="mt-4 rounded-[var(--radius)] border border-[var(--border)] p-6 text-center text-sm text-[var(--text-2)]"
        >
          Không tìm thấy target phù hợp.
        </p>
      )}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-[color-mix(in_srgb,var(--text)_65%,transparent)] p-0 sm:hidden">
          <div
            ref={filtersDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="qa-health-filters-title"
            className="max-h-[88dvh] w-full overflow-y-auto rounded-t-[var(--radius-lg)] bg-[var(--bg-elev)] p-5 shadow-2xl"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--border-strong)]" />
            <div className="flex items-center justify-between gap-3">
              <h3 id="qa-health-filters-title" className="text-lg font-bold">
                Lọc sức khỏe dự án
              </h3>
              <button
                type="button"
                aria-label="Đóng bộ lọc sức khỏe"
                onClick={() => setFiltersOpen(false)}
                className="min-h-11 min-w-11 rounded-[var(--radius)] text-xl"
              >
                ×
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="text-sm font-semibold">
                Tìm target
                <input
                  value={draftFilters.search}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Screen, flow hoặc target ID"
                  className="mt-1 min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3"
                />
              </label>
              <label className="text-sm font-semibold">
                Trạng thái
                <select
                  value={draftFilters.state}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      state: event.target.value,
                    }))
                  }
                  className="mt-1 min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3"
                >
                  <option value="all">Tất cả trạng thái</option>
                  {(Object.keys(STATE_CONFIG) as HealthState[]).map((state) => (
                    <option key={state} value={state}>
                      {STATE_CONFIG[state].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Domain
                <select
                  value={draftFilters.domain}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      domain: event.target.value,
                    }))
                  }
                  className="mt-1 min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3"
                >
                  <option value="all">Tất cả domain</option>
                  {domains.map((domain) => (
                    <option key={domain} value={domain}>
                      {domain}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Độ phủ test
                <select
                  value={draftFilters.coverage}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      coverage: event.target.value,
                    }))
                  }
                  className="mt-1 min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3"
                >
                  <option value="all">Tất cả coverage</option>
                  {Object.entries(COVERAGE_TRANSLATION).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setDraftFilters({
                    search: "",
                    state: "all",
                    domain: "all",
                    coverage: "all",
                  })
                }
                className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm font-semibold"
              >
                Xóa
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearch(draftFilters.search);
                  setStateFilter(draftFilters.state as HealthState | "all");
                  setDomainFilter(draftFilters.domain);
                  setCoverageFilter(draftFilters.coverage);
                  setFiltersOpen(false);
                }}
                className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-4 text-sm font-semibold text-white"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
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
  const [findings, setFindings] = useState(initialData.findings?.items ?? []);
  const [findingsLoaded, setFindingsLoaded] = useState(
    Boolean(initialData.findings),
  );
  const [findingsError, setFindingsError] = useState("");
  const [selectedFinding, setSelectedFinding] =
    useState<QaFindingSummary | null>(null);
  const [manualRunRequest, setManualRunRequest] = useState(0);
  const manualRunTrigger = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    if (findingsLoaded) return;
    let active = true;
    void (async () => {
      try {
        setFindingsError("");
        const response = await fetch("/api/admin/qa/findings", {
          credentials: "same-origin",
        });
        const body = (await response.json()) as {
          data?: { items?: QaFindingSummary[] } | QaFindingSummary[];
        };
        if (!response.ok) throw new Error("Không thể tải findings cần review.");
        const items = Array.isArray(body.data) ? body.data : body.data?.items;
        if (!items) throw new Error("Không thể tải findings cần review.");
        if (active) setFindings(items);
      } catch {
        if (active) setFindingsError("Không thể tải findings cần review.");
      } finally {
        if (active) setFindingsLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [findingsLoaded]);

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
  const closeFinding = () => {
    setSelectedFinding(null);
    window.setTimeout(() => lastTrigger.current?.focus(), 0);
  };
  const openFinding = (
    finding: QaFindingSummary,
    trigger: HTMLButtonElement,
  ) => {
    lastTrigger.current = trigger;
    setSelectedFinding(finding);
  };
  const promotedFinding = (updated: QaFindingSummary) => {
    setFindings((current) =>
      current.map((finding) => (finding.id === updated.id ? updated : finding)),
    );
    setSelectedFinding(updated);
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
    <div className="mx-auto max-w-[1500px] space-y-5 text-[var(--text)]">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.035em]">
            QA Control Center
          </h1>
          <p className="mt-1 text-[14px] text-[var(--text-2)]">
            Quan sát sức khỏe CMS PrimeWeb và xử lý tín hiệu cần kiểm tra.
          </p>
        </div>
        <button
          ref={manualRunTrigger}
          type="button"
          onClick={() => {
            setActiveTab("runs");
            setManualRunRequest((current) => current + 1);
          }}
          className="min-h-11 shrink-0 rounded-[var(--radius)] bg-[var(--text)] px-4 text-[13px] font-bold text-[var(--bg)] shadow-[0_4px_10px_color-mix(in_srgb,var(--text)_20%,transparent)] transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 sm:min-h-10"
        >
          Chạy test thủ công
        </button>
      </header>
      <div
        role="tablist"
        aria-label="QA Control Center"
        className="flex gap-1 border-b border-[var(--border)]"
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
          className={`!min-h-9 !rounded-none !border-x-0 !border-t-0 !bg-transparent px-3 text-[13px] font-bold shadow-none sm:min-h-9 ${activeTab === "inbox" ? "!border-b-2 !border-[var(--accent)] text-[var(--accent)]" : "!border-b-2 !border-transparent text-[var(--text-2)] hover:text-[var(--text)]"}`}
        >
          Việc cần xử lý
          {items.length > 0 && (
            <span className="ml-2 rounded-full border border-[var(--danger)] px-1.5 py-0.5 text-xs text-[var(--danger)]">
              {items.length}
            </span>
          )}
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
          className={`!min-h-9 !rounded-none !border-x-0 !border-t-0 !bg-transparent px-3 text-[13px] font-bold shadow-none sm:min-h-9 ${activeTab === "health" ? "!border-b-2 !border-[var(--accent)] text-[var(--accent)]" : "!border-b-2 !border-transparent text-[var(--text-2)] hover:text-[var(--text)]"}`}
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
          className={`!min-h-9 !rounded-none !border-x-0 !border-t-0 !bg-transparent px-3 text-[13px] font-bold shadow-none sm:min-h-9 ${activeTab === "runs" ? "!border-b-2 !border-[var(--accent)] text-[var(--accent)]" : "!border-b-2 !border-transparent text-[var(--text-2)] hover:text-[var(--text)]"}`}
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
            findings={findings}
            findingsLoaded={findingsLoaded}
            findingsError={findingsError}
            onOpen={openDetail}
            onOpenFinding={openFinding}
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
          <ManualRunPanel
            openRequest={manualRunRequest}
            externalOpenButton={manualRunTrigger}
            targets={initialData.targets.map((target) => ({
              id: target.targetId,
              name: target.targetName,
              domain: target.domain,
            }))}
          />
        </section>
      )}
      {selected && (
        <FeatureHealthDetail detail={selected} onClose={closeDetail} />
      )}
      {selectedFinding && (
        <FindingReviewDialog
          finding={selectedFinding}
          onClose={closeFinding}
          onPromoted={promotedFinding}
        />
      )}
    </div>
  );
}
