"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Blocks,
  CheckCircle2,
  CircleHelp,
  Database,
  Eye,
  FileWarning,
  Info,
  ShieldQuestion,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";

import type {
  BlockRenderEvidence,
  RenderEvidenceOverall,
} from "@/lib/admin/qa/migration-render-evidence";

type BlockMigrationEvidenceProps = {
  evidence: BlockRenderEvidence;
  /** Use inside a dense block list; the evidence accordion remains available. */
  compact?: boolean;
  /** A verified PW2 visual supplied by the parent. Never falls back to PW1 preview. */
  pw2Preview?: ReactNode;
  /** Starts an explicit, user-initiated live check. It is never automatic. */
  onRequestLiveCheck?: (evidence: BlockRenderEvidence) => void;
  isLiveCheckPending?: boolean;
};

type LayerTone = "success" | "warning" | "danger" | "muted";

const toneClass: Record<LayerTone, string> = {
  success: "border-emerald-500/35 bg-emerald-950/35 text-emerald-200",
  warning: "border-amber-500/40 bg-amber-950/35 text-amber-100",
  danger: "border-rose-500/40 bg-rose-950/35 text-rose-100",
  muted: "border-slate-700 bg-slate-900/75 text-slate-300",
};

const iconClass: Record<LayerTone, string> = {
  success: "text-emerald-400",
  warning: "text-amber-400",
  danger: "text-rose-400",
  muted: "text-slate-400",
};

function dataBadge(status: BlockRenderEvidence["pw2Data"]["status"]) {
  switch (status) {
    case "migrated":
      return {
        tone: "success" as const,
        label: "Đã migrate",
        explanation: "Có block PW2 được mapping xác nhận.",
        Icon: Database,
      };
    case "missing":
      return {
        tone: "danger" as const,
        label: "Thiếu trên PW2",
        explanation: "Đã kiểm tra nhưng không tìm thấy block PW2.",
        Icon: XCircle,
      };
    case "mismatch":
      return {
        tone: "danger" as const,
        label: "Lệch dữ liệu",
        explanation: "Đã mapping nhưng dữ liệu PW1/PW2 khác nhau.",
        Icon: FileWarning,
      };
    default:
      return {
        tone: "muted" as const,
        label: "Chưa xác minh",
        explanation: "Chưa có mapping PW1 → PW2 được xác nhận.",
        Icon: ShieldQuestion,
      };
  }
}

function componentBadge(status: BlockRenderEvidence["component"]["status"]) {
  switch (status) {
    case "supported":
      return {
        tone: "success" as const,
        label: "Có component",
        explanation: "Template PW2 có renderer tương ứng.",
        Icon: Blocks,
      };
    case "unsupported":
      return {
        tone: "warning" as const,
        label: "Chưa hỗ trợ",
        explanation: "Data có thể đã qua PW2 nhưng template chưa có renderer.",
        Icon: AlertTriangle,
      };
    default:
      return {
        tone: "muted" as const,
        label: "Chưa xác minh",
        explanation: "Chưa xác định renderer PW2 cho block này.",
        Icon: CircleHelp,
      };
  }
}

function liveBadge(status: BlockRenderEvidence["liveRender"]["status"]) {
  switch (status) {
    case "rendered":
      return {
        tone: "success" as const,
        label: "Đã render",
        explanation: "Live check đã xác nhận website PW2 render block.",
        Icon: Eye,
      };
    case "not_rendered":
      return {
        tone: "danger" as const,
        label: "Không render",
        explanation:
          "Live check đã chạy nhưng không thấy block trên website PW2.",
        Icon: XCircle,
      };
    default:
      return {
        tone: "muted" as const,
        label: "Chưa kiểm tra",
        explanation: "Chưa có kết quả kiểm tra website PW2 thật.",
        Icon: ShieldQuestion,
      };
  }
}

/** A PW2 preview is permitted only when real PW2 data and a renderer are both evidenced. */
export function shouldShowPw2Preview(evidence: BlockRenderEvidence): boolean {
  return (
    evidence.pw2Data.status === "migrated" &&
    evidence.component.status === "supported" &&
    evidence.liveRender.status === "rendered" &&
    evidence.pw2Data.renderModel !== null
  );
}

/**
 * Deliberately replaces the inferred PW2 mock when the evidence cannot prove
 * that a real PW2 block is both present and renderable.
 */
export function Pw2EvidencePlaceholder({
  evidence,
}: {
  evidence: BlockRenderEvidence | null;
}) {
  const isUnsupported =
    evidence?.pw2Data.status === "migrated" &&
    evidence.component.status === "unsupported";
  const isMissing = evidence?.pw2Data.status === "missing";
  const isMismatch = evidence?.pw2Data.status === "mismatch";
  const isLiveVerified = evidence?.liveRender.status === "rendered";
  const tone = isUnsupported
    ? "border-amber-500/50 bg-amber-950/30 text-amber-100"
    : isMissing || isMismatch
      ? "border-rose-500/45 bg-rose-950/25 text-rose-100"
      : "border-slate-700 bg-slate-950/75 text-slate-300";
  const title = isLiveVerified
    ? "Đã xác minh live render — xem website PW2 thật"
    : isUnsupported
    ? "Dữ liệu đã migrate, nhưng PW2 chưa có component"
    : isMissing
      ? "Chưa có block PW2 được mapping"
      : isMismatch
        ? "Block PW2 có dữ liệu lệch"
        : "Chưa có bằng chứng migration PW1 → PW2";
  const description = isLiveVerified
    ? "Để tránh mô phỏng sai giao diện, preview khối không được dựng lại tại đây. Mở tab Xem Web Thật để xem output PW2 đã được kiểm tra."
    : isUnsupported
    ? "Không dựng UI PW2 giả. Cần renderer tương ứng để xác minh giao diện."
    : "Preview PW2 được ẩn để không suy đoán rằng dữ liệu hoặc giao diện đã đúng.";

  return (
    <div
      className={`flex min-h-[200px] items-center justify-center rounded-2xl border p-6 text-center ${tone}`}
      data-testid="pw2-evidence-placeholder"
      role="status"
    >
      <div className="max-w-sm space-y-2">
        <ShieldQuestion className="mx-auto size-7" aria-hidden="true" />
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs leading-5 opacity-85">{description}</p>
      </div>
    </div>
  );
}

function formatCheckedAt(value: string | null): string {
  if (!value) return "Chưa kiểm tra";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Chưa có thời điểm hợp lệ"
    : date.toLocaleString("vi-VN");
}

function EvidenceBadge({
  title,
  result,
}: {
  title: string;
  result: {
    tone: LayerTone;
    label: string;
    explanation: string;
    Icon: typeof Database;
  };
}) {
  const { Icon } = result;
  return (
    <div
      className={`min-w-0 rounded-xl border px-3 py-2 ${toneClass[result.tone]}`}
      aria-label={`${title}: ${result.label}. ${result.explanation}`}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={`size-4 shrink-0 ${iconClass[result.tone]}`}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide opacity-75">
            {title}
          </p>
          <p className="truncate text-xs font-bold">{result.label}</p>
        </div>
      </div>
      <p className="mt-1 text-[11px] leading-4 opacity-85">
        {result.explanation}
      </p>
    </div>
  );
}

function OverallStatus({ overall }: { overall: RenderEvidenceOverall }) {
  const content =
    overall === "pass"
      ? {
          label: "Đã xác minh đầy đủ",
          className: "border-emerald-500/40 bg-emerald-950/40 text-emerald-200",
          Icon: CheckCircle2,
        }
      : overall === "failed"
        ? {
            label: "Có lỗi cần xử lý",
            className: "border-rose-500/40 bg-rose-950/40 text-rose-100",
            Icon: XCircle,
          }
        : {
            label: "Cần xem lại",
            className: "border-amber-500/40 bg-amber-950/40 text-amber-100",
            Icon: AlertTriangle,
          };
  const Icon = content.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${content.className}`}
    >
      <Icon className="size-3.5" />
      {content.label}
    </span>
  );
}

export function BlockMigrationEvidence({
  evidence,
  compact = false,
  pw2Preview,
  onRequestLiveCheck,
  isLiveCheckPending = false,
}: BlockMigrationEvidenceProps) {
  const data = dataBadge(evidence.pw2Data.status);
  const component = componentBadge(evidence.component.status);
  const live = liveBadge(evidence.liveRender.status);
  const canShowPreview = shouldShowPw2Preview(evidence);
  const isMigratedButUnsupported =
    evidence.pw2Data.status === "migrated" &&
    evidence.component.status === "unsupported";

  return (
    <section
      className="space-y-3"
      aria-label={`Bằng chứng migration cho block ${evidence.legacyId}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <BadgeCheck className="size-4 text-sky-400" aria-hidden="true" />
          <span className="font-mono">PW1: {evidence.legacyId}</span>
        </div>
        <OverallStatus overall={evidence.overall} />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <EvidenceBadge title="Dữ liệu PW2" result={data} />
        <EvidenceBadge title="Component" result={component} />
        <EvidenceBadge title="Live render" result={live} />
      </div>

      {onRequestLiveCheck && evidence.liveRender.status === "unverified" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
          <p className="text-xs text-slate-400">
            Live render chưa được tự động suy đoán. Chỉ kiểm tra khi QA chủ động bấm.
          </p>
          <button
            type="button"
            onClick={() => onRequestLiveCheck(evidence)}
            disabled={isLiveCheckPending}
            className="rounded-lg border border-sky-500/40 bg-sky-950/40 px-3 py-1.5 text-xs font-bold text-sky-200 transition hover:bg-sky-900/50 disabled:cursor-wait disabled:opacity-60"
          >
            {isLiveCheckPending ? "Đang yêu cầu kiểm tra…" : "Kiểm tra live theo yêu cầu"}
          </button>
        </div>
      )}

      {isMigratedButUnsupported && (
        <div
          className="rounded-xl border border-amber-500/50 bg-amber-950/30 p-4 text-amber-50"
          role="status"
          data-testid="pw2-unsupported-placeholder"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 size-5 shrink-0 text-amber-400"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-bold">
                Dữ liệu đã migrate; template PW2 chưa hỗ trợ component
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-100/85">
                Không hiển thị preview PW2 giả. Cần bổ sung renderer cho loại
                block này trước khi có thể xác minh giao diện.
              </p>
              <dl className="mt-3 grid gap-1 text-[11px] sm:grid-cols-2">
                <div>
                  <dt className="inline text-amber-200/70">
                    PW2 layout block:{" "}
                  </dt>
                  <dd className="inline font-mono">
                    {evidence.pw2Data.layoutBlockId ?? "Chưa có"}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-amber-200/70">Block type: </dt>
                  <dd className="inline font-mono">
                    {evidence.pw2Data.blockType ?? "Chưa xác định"}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-amber-200/70">
                    Mapping version:{" "}
                  </dt>
                  <dd className="inline font-mono">
                    {evidence.pw2Data.mappingVersion ?? "Chưa có"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}

      {canShowPreview && pw2Preview && (
        <div
          className="rounded-xl border border-sky-500/30 bg-slate-950 p-3"
          data-testid="verified-pw2-preview"
        >
          <p className="mb-2 text-xs font-bold text-sky-300">
            Preview từ block PW2 đã xác minh
          </p>
          {pw2Preview}
        </div>
      )}

      {!compact && (
        <details className="group rounded-xl border border-slate-800 bg-slate-950/70">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
            <span className="flex items-center gap-2">
              <Info className="size-4 text-sky-400" aria-hidden="true" />
              Bằng chứng dữ liệu (an toàn)
            </span>
            <span className="text-xs font-normal text-slate-400 group-open:hidden">
              Mở
            </span>
            <span className="hidden text-xs font-normal text-slate-400 group-open:inline">
              Đóng
            </span>
          </summary>
          <div className="border-t border-slate-800 px-4 py-3 text-xs text-slate-300">
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">PW2 page ID</dt>
                <dd className="mt-0.5 break-all font-mono">
                  {evidence.pw2Data.pageId ?? "Chưa xác minh"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">PW2 layout block ID</dt>
                <dd className="mt-0.5 break-all font-mono">
                  {evidence.pw2Data.layoutBlockId ?? "Chưa xác minh"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Mapping / thời điểm quét</dt>
                <dd className="mt-0.5 break-words font-mono">
                  {evidence.pw2Data.mappingVersion ?? "Chưa có"} ·{" "}
                  {formatCheckedAt(evidence.pw2Data.checkedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Registry / live evidence</dt>
                <dd className="mt-0.5 break-all font-mono">
                  {evidence.component.registryVersion ?? "Chưa có"} ·{" "}
                  {evidence.liveRender.evidenceRef ?? "Chưa có"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Lý do dữ liệu</dt>
                <dd className="mt-0.5 font-mono">
                  {evidence.pw2Data.reasonCode}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Lý do component / live</dt>
                <dd className="mt-0.5 break-words font-mono">
                  {evidence.component.reasonCode} ·{" "}
                  {evidence.liveRender.reasonCode}
                </dd>
              </div>
            </dl>

            {evidence.pw2Data.fields.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
                <table className="min-w-full text-left text-[11px]">
                  <thead className="bg-slate-900 text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Trường</th>
                      <th className="px-3 py-2">PW1</th>
                      <th className="px-3 py-2">PW2</th>
                      <th className="px-3 py-2">Kết quả</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {evidence.pw2Data.fields.map((field, index) => (
                      <tr key={`${field.label}-${index}`}>
                        <td className="px-3 py-2 font-medium text-slate-200">
                          {field.label}
                        </td>
                        <td className="px-3 py-2 break-words">
                          {field.pw1 ?? "—"}
                        </td>
                        <td className="px-3 py-2 break-words">
                          {field.pw2 ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          {field.status === "match"
                            ? "Khớp"
                            : field.status === "mismatch"
                              ? "Lệch"
                              : "Chưa xác minh"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>
      )}

      {!compact && (
        <p className="rounded-lg bg-slate-900/80 px-3 py-2 text-[11px] leading-5 text-slate-400">
          <strong className="text-slate-300">Chú giải:</strong> xanh = đã xác
          minh; cam = data/renderer cần xem; đỏ = đã xác minh có lỗi; xám = chưa
          đủ mapping hoặc chưa chạy live check.
        </p>
      )}
    </section>
  );
}
