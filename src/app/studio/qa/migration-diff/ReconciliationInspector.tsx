"use client";

import { useMemo, useState } from "react";
import { Database, ShieldCheck } from "lucide-react";
import type {
  ReconciliationRecord,
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
}: {
  scope: ReconciliationScope;
  snapshot: ReconciliationSnapshot | null;
  loading: boolean;
  error: string | null;
  isDemo: boolean;
  onToggleDemo: (value: boolean) => void;
}) {
  const [feature, setFeature] = useState("overview");
  const [status, setStatus] = useState<"all" | ReconciliationStatus>("all");
  const [query, setQuery] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReconciliationRecord | null>(null);
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
          `${record.label} ${record.sourceId} ${record.targetId ?? ""}`
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()),
      ),
    [snapshot?.records, feature, status, onlyIssues, query],
  );
  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRecords = records.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const issueTotal = (snapshot?.records ?? []).filter((record) => record.status !== "match").length;
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
              Đối soát migration{" "}
              {scope === "commerce" ? "Commerce" : "Settings"}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Chỉ kết luận khi có mapping định danh PW1 → PW2 đã xác nhận.
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
            {snapshot?.evidence.message ?? "Chưa có mapping định danh."}
          </p>
        ) : null}
      </section>
      <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          ["Tổng PW1", snapshot?.summary.pw1Total ?? 0, "text-white"],
          ["Đã map PW2", snapshot?.summary.pw2Total ?? 0, "text-sky-200"],
          ["Cần kiểm tra", issueTotal, "text-amber-200"],
          ["Chưa có mapping", snapshot?.summary.unverified ?? 0, "text-slate-300"],
        ].map(([label, count, className]) => (
          <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <p className="text-[11px] text-slate-500">{label}</p>
            <p className={`mt-1 text-xl font-bold ${className}`}>{count}</p>
          </div>
        ))}
      </section>
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
            title={item === "all" ? "Tất cả" : META[item].copy}
            onClick={() => {
              setStatus(item);
              setPage(1);
            }}
            className={`rounded-lg border px-2.5 py-1.5 text-xs ${status === item ? "border-blue-500 bg-blue-600 text-white" : "border-slate-800 bg-slate-950 text-slate-300"}`}
          >
            {item === "all" ? "Tất cả" : META[item].label}
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
          Chỉ lỗi/cần kiểm tra
        </label>
        <input
          aria-label="Tìm dữ liệu đối soát"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Tìm mã PW1/PW2 hoặc tên"
          className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500"
        />
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
        <div className="border-b border-slate-800 p-4 font-bold text-white">
          <Database className="mr-2 inline size-4 text-blue-400" />
          Danh sách dữ liệu
        </div>
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Đang tải…</p>
        ) : records.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">
            Chưa có record có evidence để đối soát.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="p-3">Nhóm</th>
                  <th className="p-3">Dữ liệu PW1</th>
                  <th className="p-3">Bản ghi PW2</th>
                  <th className="p-3">Kết quả</th>
                  <th className="p-3">Lý do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {visibleRecords.map((record) => (
                  <tr
                    key={`${record.sourceEntity}-${record.sourceId}`}
                    onClick={() => setSelected(record)}
                    className="cursor-pointer hover:bg-slate-900/70"
                  >
                    <td className="p-3 text-slate-300">
                      {LABELS[record.sourceEntity]}
                    </td>
                    <td className="p-3 font-medium text-white">
                      {record.label}
                      <small className="block font-mono text-slate-500">
                        PW1: {record.sourceId}
                      </small>
                    </td>
                    <td className="p-3 font-mono text-slate-300">
                      {record.targetId ?? "—"}
                    </td>
                    <td className="p-3">
                      <span
                        title={META[record.status].copy}
                        className={`rounded-full border px-2 py-1 font-semibold ${META[record.status].className}`}
                      >
                        {META[record.status].label}
                      </span>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {META[record.status].copy}
                      </p>
                    </td>
                    <td className="p-3 text-slate-400">{record.reason}</td>
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
        <section className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
          <div className="flex justify-between">
            <h4 className="font-bold text-white">{selected.label}</h4>
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
              PW1 {selected.sourceId} → PW2 {selected.targetId ?? "Chưa có"} ·{" "}
              {META[selected.status].label}
            </p>
            <p className="mt-1 text-slate-400">
              {META[selected.status].copy} — {selected.reason}
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
                          className={`rounded-full border px-2 py-1 ${META[relation.status].className}`}
                        >
                          {META[relation.status].label}
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
          <div className="mt-4 space-y-3">
            {sections.length === 0 ? (
              <p className="text-xs text-slate-500">
                Chưa có field để hiển thị.
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
          </div>
        </section>
      )}
    </div>
  );
}
