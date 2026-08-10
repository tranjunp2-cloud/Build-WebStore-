"use client";

import { useMemo, useState } from "react";
import type {
  HealthState,
  ProjectHealthSummary,
  TargetHealthResult,
} from "@/lib/admin/qa/health-calculator";

interface ProjectHealthClientProps {
  initialTargets: TargetHealthResult[];
  initialSummary: ProjectHealthSummary;
}

const STATE_CONFIG: Record<
  HealthState,
  { label: string; className: string; icon: string }
> = {
  Healthy: {
    label: "Khỏe mạnh",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: "✓",
  },
  Watch: {
    label: "Theo dõi",
    className: "border-violet-200 bg-violet-50 text-violet-700",
    icon: "!",
  },
  "Needs attention": {
    label: "Cần xử lý",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: "▲",
  },
  Critical: {
    label: "Nghiêm trọng",
    className: "border-red-200 bg-red-50 text-red-700",
    icon: "×",
  },
  Unknown: {
    label: "Chưa xác định",
    className: "border-slate-200 bg-slate-50 text-slate-600",
    icon: "?",
  },
};

const COVERAGE_TRANSLATION: Record<string, string> = {
  automated: "Tự động",
  partial: "Tự động một phần",
  manual_only: "Thủ công",
  unknown: "Chưa phân loại",
};

export function ProjectHealthClient({
  initialTargets,
  initialSummary,
}: ProjectHealthClientProps) {
  const [search, setSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("All");
  const [selectedState, setSelectedState] = useState("All");
  const [selectedCoverage, setSelectedCoverage] = useState("All");
  const [selectedTarget, setSelectedTarget] =
    useState<TargetHealthResult | null>(null);

  const domains = useMemo(
    () => ["All", ...Array.from(new Set(initialTargets.map((target) => target.domain)))],
    [initialTargets],
  );

  const filteredTargets = useMemo(
    () =>
      initialTargets.filter((target) => {
        const normalizedSearch = search.trim().toLowerCase();
        const matchesSearch =
          !normalizedSearch ||
          target.targetName.toLowerCase().includes(normalizedSearch) ||
          target.targetId.toLowerCase().includes(normalizedSearch);
        return (
          matchesSearch &&
          (selectedDomain === "All" || target.domain === selectedDomain) &&
          (selectedState === "All" || target.state === selectedState) &&
          (selectedCoverage === "All" || target.coverage === selectedCoverage)
        );
      }),
    [initialTargets, search, selectedCoverage, selectedDomain, selectedState],
  );

  const clearFilters = () => {
    setSearch("");
    setSelectedDomain("All");
    setSelectedState("All");
    setSelectedCoverage("All");
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 pb-4 dark:border-slate-700">
        <h1 className="text-2xl font-extrabold tracking-tight">QA Control Center</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Sức khỏe dự án từ bằng chứng run và change impact trên Staging.
        </p>
      </header>

      <section aria-label="Tóm tắt trạng thái" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(Object.keys(STATE_CONFIG) as HealthState[]).map((state) => {
          const config = STATE_CONFIG[state];
          const selected = selectedState === state;
          return (
            <button
              key={state}
              type="button"
              onClick={() => setSelectedState(selected ? "All" : state)}
              className={`rounded-xl border p-4 text-left shadow-sm transition hover:shadow ${config.className} ${
                selected ? "ring-2 ring-blue-500 ring-offset-2" : ""
              }`}
            >
              <span className="text-xs font-bold uppercase tracking-wide">{config.label}</span>
              <strong className="mt-2 block text-2xl">{initialSummary.counts[state]}</strong>
              <span className="text-xs">{config.icon} target</span>
            </button>
          );
        })}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row">
          <input
            id="target-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm screen, flow hoặc target ID..."
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select
              aria-label="Lọc theo nhóm"
              value={selectedDomain}
              onChange={(event) => setSelectedDomain(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            >
              {domains.map((domain) => (
                <option key={domain} value={domain}>
                  Nhóm: {domain === "All" ? "Tất cả" : domain}
                </option>
              ))}
            </select>
            <select
              aria-label="Lọc theo trạng thái"
              value={selectedState}
              onChange={(event) => setSelectedState(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            >
              <option value="All">Trạng thái: Tất cả</option>
              {(Object.keys(STATE_CONFIG) as HealthState[]).map((state) => (
                <option key={state} value={state}>
                  {STATE_CONFIG[state].label}
                </option>
              ))}
            </select>
            <select
              aria-label="Lọc theo độ phủ"
              value={selectedCoverage}
              onChange={(event) => setSelectedCoverage(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            >
              <option value="All">Độ phủ: Tất cả</option>
              {Object.entries(COVERAGE_TRANSLATION).map(([coverage, label]) => (
                <option key={coverage} value={coverage}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {(search || selectedDomain !== "All" || selectedState !== "All" || selectedCoverage !== "All") && (
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-400"
          >
            Xóa bộ lọc
          </button>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          Hiển thị {filteredTargets.length} / {initialSummary.totalTargets} CMS target
        </div>
        {filteredTargets.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Không tìm thấy target phù hợp.</p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {filteredTargets.map((target) => {
              const config = STATE_CONFIG[target.state];
              return (
                <li id={`target-${target.targetId}`} key={target.targetId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-bold">{target.targetName}</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {target.reasonMessage} · {target.domain} · {COVERAGE_TRANSLATION[target.coverage] ?? target.coverage}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${config.className}`}>
                      {config.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedTarget(target)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                    >
                      Mở chi tiết
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selectedTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="target-health-title">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3 dark:border-slate-700">
              <div>
                <p className="text-xs font-mono text-slate-500">{selectedTarget.domain}</p>
                <h2 id="target-health-title" className="text-lg font-bold">{selectedTarget.targetName}</h2>
              </div>
              <button type="button" onClick={() => setSelectedTarget(null)} aria-label="Đóng chi tiết" className="text-xl text-slate-500 hover:text-slate-900 dark:hover:text-white">×</button>
            </div>
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-900 dark:bg-blue-950">
              <p className="font-bold">{selectedTarget.reasonCode}</p>
              <p className="mt-1">{selectedTarget.reasonMessage}</p>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700">
              <div><dt className="text-slate-500">Target ID</dt><dd className="font-mono font-semibold">{selectedTarget.targetId}</dd></div>
              <div><dt className="text-slate-500">Độ phủ</dt><dd className="font-semibold">{COVERAGE_TRANSLATION[selectedTarget.coverage] ?? selectedTarget.coverage}</dd></div>
              <div><dt className="text-slate-500">Kết quả lần chạy cuối</dt><dd className="font-semibold">{selectedTarget.lastRunStatus ?? "Chưa có dữ liệu"}</dd></div>
              <div><dt className="text-slate-500">Thời gian chạy cuối</dt><dd className="font-semibold">{selectedTarget.lastRunAt ? new Date(selectedTarget.lastRunAt).toLocaleString() : "—"}</dd></div>
            </dl>
            <section className="mt-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Bằng chứng và liên kết giải thích</h3>
              <ul className="mt-2 space-y-2">
                {selectedTarget.links.map((link) => (
                  <li key={`${link.type}-${link.label}`} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                    {link.url ? <a href={link.url} className="font-semibold text-blue-700 hover:underline dark:text-blue-400">{link.label} ↗</a> : <span>{link.label}</span>}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
