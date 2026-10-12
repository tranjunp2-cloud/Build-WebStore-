"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Page numbers to show: first, last and a window around the current page; gaps become "…". */
export function pageWindow(current: number, total: number, siblings = 1): Array<number | "…"> {
  const pages = new Set([1, total]);
  for (let page = current - siblings; page <= current + siblings; page++) {
    if (page >= 1 && page <= total) pages.add(page);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result: Array<number | "…"> = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push("…");
    result.push(page);
  });
  return result;
}

const buttonClass =
  "p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 transition";

export function MigrationPagination({
  currentPage,
  totalPages,
  disabled = false,
  onChange,
}: {
  currentPage: number;
  totalPages: number;
  disabled?: boolean;
  onChange: (page: number) => void;
}) {
  return (
    <nav data-testid="migration-pagination" aria-label="Phân trang" className="flex items-center gap-1.5">
      <button
        aria-label="Trang trước"
        disabled={currentPage <= 1 || disabled}
        onClick={() => onChange(currentPage - 1)}
        className={buttonClass}
      >
        <ChevronLeft className="size-4" />
      </button>
      {pageWindow(currentPage, totalPages).map((page, index) =>
        page === "…" ? (
          <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-slate-500">…</span>
        ) : (
          <button
            key={page}
            aria-label={`Trang ${page}`}
            aria-current={page === currentPage ? "page" : undefined}
            disabled={disabled}
            onClick={() => page !== currentPage && onChange(page)}
            className={`min-w-9 rounded-xl border px-2.5 py-2 text-xs font-semibold tabular-nums transition disabled:opacity-60 ${
              page === currentPage
                ? "border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {page}
          </button>
        ),
      )}
      <button
        aria-label="Trang sau"
        disabled={currentPage >= totalPages || disabled}
        onClick={() => onChange(currentPage + 1)}
        className={buttonClass}
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}
