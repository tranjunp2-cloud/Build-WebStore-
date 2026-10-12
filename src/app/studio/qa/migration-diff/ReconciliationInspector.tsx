"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Database, ShieldCheck } from "lucide-react";
import { RecordFieldEvidencePanel } from "./RecordFieldEvidencePanel";
import type {
  ReconciliationIssue,
  ReconciliationRecord,
  ReconciliationRun,
  ReconciliationScope,
  ReconciliationSnapshot,
  ReconciliationStatus,
} from "@/lib/admin/qa/migration-reconciliation";

const META: Record<
  ReconciliationStatus,
  { label: string; copy: string; className: string }
> = {
  match: {
    label: "Khớp 1–1",
    copy: "1 PW1 ↔ 1 PW2",
    className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  },
  missing: {
    label: "Chưa migrate",
    copy: "Có ở PW1, chưa có ở PW2",
    className: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  },
  mismatch: {
    label: "Dữ liệu khác",
    copy: "Đã map nhưng field khác",
    className: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  },
  duplicate: {
    label: "Bị nhân đôi",
    copy: "1 PW1 → nhiều PW2",
    className: "bg-orange-500/10 text-orange-300 border-orange-500/30",
  },
  unsupported: {
    label: "PW2 chưa hỗ trợ",
    copy: "PW2 không có field tương ứng",
    className: "bg-violet-500/10 text-violet-200 border-violet-500/30",
  },
  unverified: {
    label: "Chưa có mapping",
    copy: "Thiếu evidence mapping",
    className: "bg-slate-700 text-slate-200 border-slate-600",
  },
};
const LABELS: Record<ReconciliationRecord["sourceEntity"], string> = {
  products: "Sản phẩm",
  orders: "Đơn hàng",
  discounts: "Giảm giá",
  customers: "Khách hàng",
  account_profile: "Hồ sơ",
  team_members: "Thành viên",
  email_templates: "Mẫu email",
  payments: "Thanh toán",
  delivery: "Giao hàng",
  web_address: "Tên miền",
  app_integrations: "Tích hợp",
};
const PAGE_SIZE = 25;
type KeyedField = ReconciliationRecord["fields"][number] & {
  sourceKey?: string;
  targetKey?: string;
};

export function ReconciliationInspector({
  scope,
  snapshot,
  loading,
  error,
  isDemo,
  onToggleDemo,
  sourceStoreId,
  onSourceStoreChange,
  runId,
  runs,
  runsTruncated,
  runsLoading,
  runsError,
  onRunChange,
  issues,
  issuesLoading,
  issuesError,
}: {
  scope: ReconciliationScope;
  snapshot: ReconciliationSnapshot | null;
  loading: boolean;
  error: string | null;
  isDemo: boolean;
  onToggleDemo: (value: boolean) => void;
  sourceStoreId: string;
  onSourceStoreChange: (storeId: string) => void;
  runId: string | null;
  runs: ReconciliationRun[];
  runsTruncated: boolean;
  runsLoading: boolean;
  runsError: string | null;
  onRunChange: (runId: string | null) => void;
  issues: ReconciliationIssue[];
  issuesLoading: boolean;
  issuesError: string | null;
}) {
  const [feature, setFeature] = useState("overview");
  const [status, setStatus] = useState<"all" | ReconciliationStatus>("all");
  const [query, setQuery] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReconciliationRecord | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    setFeature("overview");
    setStatus("all");
    setQuery("");
    setOnlyIssues(false);
    setPage(1);
    setSelected(null);
  }, [scope]);
  useEffect(() => { setSelected(null); }, [sourceStoreId, runId]);
  useEffect(() => {
    if (selected) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      detailRef.current?.focus({ preventScroll: true });
    }
  }, [selected]);
  const nav =
    scope === "commerce"
      ? [
          ["overview", "Tổng quan"],
          ["products", "Products"],
          ["orders", "Orders"],
          ["discounts", "Discounts"],
          ["customers", "Customers"],
        ]
      : [
          ["overview", "Tổng quan"],
          ["account_profile", "Profile"],
          ["team_members", "Team"],
          ["email_templates", "Email"],
          ["payments", "Payment"],
          ["delivery", "Delivery"],
          ["web_address", "Domain"],
          ["app_integrations", "Integrations"],
        ];
  const records = useMemo(
    () =>
      (snapshot?.records ?? []).filter(
        (record) =>
          (feature === "overview" || record.sourceEntity === feature) &&
          (status === "all" || record.status === status) &&
          (!onlyIssues || record.status !== "match") &&
          `${record.label} ${record.sourceId} ${record.targetIds.join(" ")} ${record.preview?.pw1 ?? ''} ${record.preview?.pw2 ?? ''}`
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()),
      ),
    [snapshot?.records, feature, status, onlyIssues, query],
  );
  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRecords = records.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedRunIsCurrent = runs.some(
    (run) => run.runId === runId && run.storeId === sourceStoreId,
  );
  const recordsNeedingReview = (snapshot?.records ?? []).filter((record) => record.status !== "match").length;
  const openIssueTotal = selectedRunIsCurrent ? issues.length : 0;
  const isLedgerEvidence = !isDemo && snapshot?.evidence.mode === "verified";
  const selectedFeatureIsNotCoveredByLedger = isLedgerEvidence
    && scope === "settings"
    && ["payments", "delivery", "web_address", "app_integrations"].includes(feature);
  const statusMeta = (value: ReconciliationStatus) => {
    if (isLedgerEvidence && value === "match") {
      return {
        ...META.match,
        label: "Mapping 1–1 đã xác nhận",
        copy: "Đã có 1 mapping định danh PW1 → PW2; chưa đối soát giá trị field.",
      };
    }
    return META[value];
  };
  const sections = useMemo(() => {
    const grouped = new Map<string, ReconciliationRecord["fields"]>();
    selected?.fields.forEach((field) => {
      const key = (field.section ?? "Thông tin đối soát").split(" · ")[0];
      grouped.set(key, [...(grouped.get(key) ?? []), field]);
    });
    return [...grouped.entries()];
  }, [selected]);
  return (
    <div
      className="flex-1 min-h-0 overflow-y-auto space-y-5 bg-slate-900/40 p-5"
      data-testid="migration-reconciliation-shell"
    >
      <section className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <h3 className="flex gap-2 font-bold text-white">
              <ShieldCheck className="size-5 text-blue-400" />
              {scope === "commerce" ? "Liên kết bản ghi PW1 → PW2" : "Đối soát migration Settings"}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {scope === "commerce"
                ? "Các số bên dưới chỉ tính bản ghi có trong ledger của run này. Liên kết đúng ID chưa chứng minh giá trị từng trường khớp; xem phần đối chiếu phía trên."
                : "Chỉ kết luận khi có mapping định danh PW1 → PW2 đã xác nhận."}
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={isDemo}
              onChange={(event) => onToggleDemo(event.target.checked)}
            />
            Xem dữ liệu mẫu
          </label>
        </div>
        {isDemo ? (
          <p className="mt-3 rounded-xl border border-fuchsia-400/50 bg-fuchsia-500/15 p-2 text-xs font-semibold text-fuchsia-100">
            DỮ LIỆU MẪU — không phải kết quả migration thực tế. Không dùng để
            duyệt QC/cutover.
          </p>
        ) : error ? (
          <p className="mt-3 text-xs text-rose-300">
            Không tải được dữ liệu: {error}
          </p>
        ) : !snapshot?.evidence.available ? (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
            {snapshot?.evidence.message ?? "Chưa có kết quả đối soát."}
          </p>
        ) : null}
        {!isDemo && (
          <p className="mt-3 text-xs text-slate-400" role="status">
            {runsLoading || loading
              ? "Đang tải dữ liệu đối soát…"
              : runsError
                ? "Không tải được dữ liệu migration. Bấm Quét lại dữ liệu để thử lại."
                : !sourceStoreId
                  ? "Chưa có định danh nguồn F42 cho website này."
                  : !runs.length
                    ? "Website này chưa có đợt migration đã xác nhận để đối soát."
                    : "Tự động đối soát theo đợt migration đã xác nhận mới nhất của website."}
          </p>
        )}
      </section>
      {!isDemo && selectedRunIsCurrent ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4" data-testid="migration-ledger-issues">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <AlertTriangle className="size-4 text-amber-300" />
            Issue đang mở của migration run
          </div>
          <p className="mt-1 text-xs text-slate-400">Không hiển thị source ID, dữ liệu cá nhân hoặc chi tiết exception.</p>
          {issuesLoading ? <p className="mt-3 text-xs text-slate-400" role="status" aria-live="polite">Đang tải issue…</p> : null}
          {issuesError ? <p className="mt-3 text-xs text-rose-300" role="alert">Không tải được issue: {issuesError}</p> : null}
          {!issuesLoading && !issuesError && !issues.length ? (
            <p className={`mt-3 text-xs ${error || !snapshot?.evidence.available ? "text-amber-200" : "text-emerald-300"}`} role="status" aria-live="polite">
              {error || !snapshot?.evidence.available
                ? "Không có issue trong dữ liệu đã tải; chưa thể kết luận vì mapping chưa khả dụng."
                : "Không có issue mở trong migration run này."}
            </p>
          ) : null}
          {!issuesLoading && !issuesError && issues.length ? (
            <ul className="mt-3 space-y-2">
              {issues.map((issue) => (
                <li key={issue.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
                  <span className={`rounded border px-1.5 py-0.5 font-semibold ${issue.severity === "BLOCKER" ? "border-rose-500/40 bg-rose-500/10 text-rose-200" : "border-amber-500/40 bg-amber-500/10 text-amber-100"}`}>
                    {issue.severity}
                  </span>
                  <span className="font-mono text-slate-200">{issue.errorCode}</span>
                  <span className="text-slate-400">{issue.isRunLevel ? "Áp dụng toàn run" : `Nhóm: ${issue.sourceEntity}`}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      <section className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          [scope === "commerce" ? "Bản ghi trong ledger" : "Tổng PW1", snapshot?.summary.pw1Total ?? 0, "text-white"],
          [scope === "commerce" ? "Liên kết PW2 xác nhận" : "Đã map PW2", snapshot?.summary.pw2Total ?? 0, "text-sky-200"],
          [scope === "commerce" ? "Mapping cần kiểm tra" : "Bản ghi cần kiểm tra", recordsNeedingReview, "text-amber-200"],
          [scope === "commerce" ? "Exception mở" : "Issue mở", openIssueTotal, "text-rose-200"],
          [scope === "commerce" ? "Mapping chưa xác nhận" : "Chưa có mapping", snapshot?.summary.unverified ?? 0, "text-slate-300"],
        ].map(([label, count, className]) => (
          <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <p className="text-[11px] text-slate-500">{label}</p>
            <p className={`mt-1 text-xl font-bold ${className}`}>{snapshot?.evidence.available && !error ? count : "—"}</p>
          </div>
        ))}
      </section>
      {scope === "commerce" && !isDemo && <p className="text-xs leading-5 text-slate-400">Các số 0 chỉ áp dụng cho bản ghi ledger và exception của run này; chưa kiểm tra mọi bản ghi nguồn hoặc lỗi từng trường. Bảng hiển thị ID nội bộ và giá trị đã lưu trong evidence F42. Snapshot hiện tại không lưu tên, email, số điện thoại Customer dạng hiển thị.</p>}
      <nav className="flex gap-1 overflow-x-auto">
        {nav.map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setFeature(key);
              setSelected(null);
              setPage(1);
            }}
            className={`whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold ${feature === key ? "border-blue-500 bg-blue-600 text-white" : "border-slate-800 bg-slate-950 text-slate-300"}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {selectedFeatureIsNotCoveredByLedger ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100" role="status">
          F42 ledger hiện chưa có evidence cho nhóm Settings này. Danh sách trống không đồng nghĩa dữ liệu đã được migrate hoặc đã khớp.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            "all",
            "match",
            "missing",
            "mismatch",
            "duplicate",
            "unsupported",
            "unverified",
          ] as const
        ).map((item) => (
          <button
            key={item}
            title={item === "all" ? "Tất cả" : statusMeta(item).copy}
            onClick={() => {
              setStatus(item);
              setPage(1);
            }}
            className={`rounded-lg border px-2.5 py-1.5 text-xs ${status === item ? "border-blue-500 bg-blue-600 text-white" : "border-slate-800 bg-slate-950 text-slate-300"}`}
          >
            {item === "all" ? "Tất cả" : statusMeta(item).label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={onlyIssues}
            onChange={(event) => {
              setOnlyIssues(event.target.checked);
              setPage(1);
            }}
          />
          {scope === "commerce" && isLedgerEvidence ? "Chỉ mapping cần kiểm tra" : "Chỉ lỗi/cần kiểm tra"}
        </label>
        <input
          aria-label="Tìm dữ liệu đối soát"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder={scope === "commerce" && isLedgerEvidence ? "Tìm ID PW1/PW2 hoặc giá trị hiển thị" : "Tìm mã PW1/PW2 hoặc tên"}
          className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500"
        />
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
        <div className="border-b border-slate-800 p-4 font-bold text-white">
          <Database className="mr-2 inline size-4 text-blue-400" />
          Danh sách dữ liệu
        </div>
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400" role="status" aria-live="polite">Đang tải…</p>
        ) : records.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400" role="status" aria-live="polite">
            {error || !snapshot?.evidence.available
              ? "Chưa có dữ liệu mapping khả dụng để đối soát."
              : isLedgerEvidence && scope === "commerce"
                ? "Không có mapping trong ledger cho nhóm và bộ lọc này; điều đó không chứng minh PW1 không có bản ghi."
                : "Không có bản ghi trong phạm vi và bộ lọc hiện tại."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full text-left text-xs ${isLedgerEvidence && scope === "commerce" ? "min-w-[600px]" : "min-w-[760px]"}`}>
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th scope="col" className="p-3">Nhóm</th>
                    <th scope="col" className="p-3">Dữ liệu PW1</th>
                    <th scope="col" className="p-3">Dữ liệu PW2</th>
                  <th scope="col" className="p-3">{isLedgerEvidence && scope === "commerce" ? "Trạng thái liên kết" : "Kết quả"}</th>
                  {!(isLedgerEvidence && scope === "commerce") && <th scope="col" className="p-3">Lý do</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {visibleRecords.map((record, index) => (
                  <tr
                    key={`${record.sourceEntity}-${(currentPage - 1) * PAGE_SIZE + index}`}
                    onClick={() => setSelected(record)}
                    className="cursor-pointer hover:bg-slate-900/70"
                  >
                    <td className="p-3 text-slate-300">
                      {LABELS[record.sourceEntity]}
                    </td>
                    <td className="p-3 font-medium text-white">
                      <button type="button" onClick={(event) => { event.stopPropagation(); setSelected(record); }}
                        className="text-left hover:text-sky-300 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
                        aria-label={`Xem chi tiết ${LABELS[record.sourceEntity]} PW1 ${record.sourceId}`}>
                        {isLedgerEvidence && scope === "commerce" ? <span className="font-mono">PW1: {record.sourceId}</span>
                          : <>{record.label}<small className="block font-mono text-slate-500">PW1: {record.sourceId}</small></>}
                      </button>
                      {isLedgerEvidence && record.preview?.pw1 != null && <span className="mt-1 block max-w-[25rem] break-words text-slate-300">{record.preview.label}: {record.preview.pw1 || 'Chuỗi rỗng'}</span>}
                    </td>
                    <td className="p-3 font-mono text-slate-300">
                      {record.targetIds.length ? `${isLedgerEvidence && scope === "commerce" ? "PW2: " : ""}${record.targetIds.join(", ")}` : "—"}
                      {isLedgerEvidence && record.preview?.pw2 != null && <span className="mt-1 block max-w-[25rem] break-words font-sans">{record.preview.label}: {record.preview.pw2 || 'Chuỗi rỗng'}</span>}
                      {isLedgerEvidence && record.preview && <span className={`mt-1 block text-xs font-sans ${record.preview.status === 'match' ? 'text-emerald-300' : 'text-amber-200'}`}>
                        Trường gợi ý: {record.preview.status === 'match' ? 'khớp' : statusMeta(record.preview.status).label.toLowerCase()}
                        {record.preview.explanation ? ` · ${record.preview.explanation}` : ''}
                      </span>}
                    </td>
                    <td className="p-3">
                      <span
                        title={statusMeta(record.status).copy}
                        className={`rounded-full border px-2 py-1 font-semibold ${statusMeta(record.status).className}`}
                      >
                        {statusMeta(record.status).label}
                      </span>
                      {!(isLedgerEvidence && scope === "commerce") && <p className="mt-1 text-[10px] text-slate-500">{statusMeta(record.status).copy}</p>}
                    </td>
                    {!(isLedgerEvidence && scope === "commerce") && <td className="p-3 text-slate-400">{record.reason}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {records.length > PAGE_SIZE ? (
          <div className="flex items-center justify-end gap-3 border-t border-slate-800 p-3 text-xs text-slate-400">
            <span>Trang {currentPage}/{totalPages} · {records.length} bản ghi</span>
            <button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="disabled:opacity-40">Trước</button>
            <button disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} className="disabled:opacity-40">Sau</button>
          </div>
        ) : null}
      </section>
      {selected && (
        <section ref={detailRef} tabIndex={-1} className="rounded-2xl border border-slate-700 bg-slate-950 p-5 outline-none">
          <div className="flex justify-between">
            <h4 className="font-bold text-white">{isLedgerEvidence && scope === "commerce" ? `${LABELS[selected.sourceEntity]} PW1: ${selected.sourceId}` : selected.label}</h4>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-slate-400"
            >
              Đóng
            </button>
          </div>
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs">
            <strong className="text-slate-200">Tóm tắt đối soát</strong>
            <p className="mt-2 text-slate-300">
              PW1 {selected.sourceId} → PW2 {selected.targetIds.length ? selected.targetIds.join(", ") : "Chưa có"} ·{" "}
              {statusMeta(selected.status).label}
            </p>
            <p className="mt-1 text-slate-400">
              {statusMeta(selected.status).copy} — {selected.reason}
            </p>
          </div>
          {selected.relations?.length ? (
            <div className="mt-4 overflow-x-auto">
              <p className="mb-1 text-xs font-bold text-slate-200">
                Dữ liệu con
              </p>
              <p className="mb-2 text-[11px] text-slate-500">
                Số lượng bản ghi liên quan, không phải so sánh giá trị field.
              </p>
              <table className="w-full min-w-[620px] text-left text-xs">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="p-2">Loại dữ liệu</th>
                    <th className="p-2">PW1</th>
                    <th className="p-2">PW2</th>
                    <th className="p-2">Kết quả</th>
                    <th className="p-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.relations.map((relation) => (
                    <tr
                      key={relation.label}
                      className="border-t border-slate-800"
                    >
                      <td className="p-2 text-white">{relation.label}</td>
                      <td className="p-2 text-amber-200">
                        {relation.pw1Total}
                      </td>
                      <td className="p-2 text-sky-200">{relation.pw2Total}</td>
                      <td className="p-2">
                        <span
                          className={`rounded-full border px-2 py-1 ${statusMeta(relation.status).className}`}
                        >
                          {statusMeta(relation.status).label}
                        </span>
                      </td>
                      <td className="p-2 text-slate-500">
                        Chưa có mapping chi tiết
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {isLedgerEvidence && scope === "commerce" ? (
            selected.reference && runId && snapshot?.fieldGeneration ? <RecordFieldEvidencePanel
              key={`${sourceStoreId}-${runId}-${selected.reference}-${snapshot.fieldGeneration.generationId}-${snapshot.fieldGeneration.digest}`}
              storeId={sourceStoreId} runId={runId} reference={selected.reference}
              version={snapshot.fieldGeneration}
            /> : <p className="mt-4 text-xs text-amber-200">Chưa có generation field evidence hợp lệ cho bản ghi này. Tải lại run để kiểm tra.</p>
          ) : <div className="mt-4 space-y-3">
            {sections.length === 0 ? (
              <p className="text-xs text-slate-400">
                Ledger chỉ xác nhận liên kết ID cho bản ghi này; chưa có kết quả so sánh từng trường gắn trực tiếp với dòng này. Xem khối đối chiếu trường phía trên để điều tra bằng chứng hiện có.
              </p>
            ) : (
              sections.map(([section, fields], index) => (
                <details
                  key={section}
                  open={index === 0}
                  className="rounded-xl border border-slate-800 bg-slate-900/50"
                >
                  <summary className="cursor-pointer p-3 text-xs font-bold text-white">
                    {section}{" "}
                    <span className="font-mono text-slate-500">
                      ({fields.length} trường)
                    </span>
                  </summary>
                  <div className="overflow-x-auto border-t border-slate-800">
                    <table className="w-full min-w-[720px] text-left text-xs">
                      <thead className="bg-slate-950 text-slate-500">
                        <tr>
                          <th className="p-3">Trường</th>
                          <th className="p-3">PW1</th>
                          <th className="p-3">PW2</th>
                          <th className="p-3">Kết quả</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((field) => {
                          const keyed = field as KeyedField;
                          return (
                            <tr
                              key={field.label}
                              className="border-t border-slate-800"
                            >
                              <td className="p-3 font-semibold text-white">
                                {field.label}
                                {(keyed.sourceKey || keyed.targetKey) && (
                                  <small className="block font-mono font-normal text-slate-500">
                                    {keyed.sourceKey ?? "—"} →{" "}
                                    {keyed.targetKey ?? "—"}
                                  </small>
                                )}
                              </td>
                              <td className="p-3 text-amber-100">
                                {field.pw1 ?? "—"}
                              </td>
                              <td className="p-3 text-sky-100">
                                {field.pw2 ?? "—"}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`rounded-full border px-2 py-1 ${META[field.status].className}`}
                                >
                                  {META[field.status].label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))
            )}
          </div>}
        </section>
      )}
    </div>
  );
}
