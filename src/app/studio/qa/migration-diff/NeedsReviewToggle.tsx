"use client";

import { Check, Filter } from "lucide-react";

export function NeedsReviewToggle({
  active,
  onChange,
}: {
  active: boolean;
  onChange: (active: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onChange(!active)}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 ${active ? "border-rose-400 bg-rose-500/20 text-rose-200" : "border-slate-700 bg-slate-900 text-slate-300 hover:border-rose-400/70 hover:bg-slate-800"}`}
    >
      {active ? (
        <Check aria-hidden="true" className="size-3.5" />
      ) : (
        <Filter aria-hidden="true" className="size-3.5" />
      )}
      Lỗi / cần xem
    </button>
  );
}
