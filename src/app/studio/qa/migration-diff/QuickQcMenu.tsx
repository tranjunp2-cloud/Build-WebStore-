"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ChevronDown } from "lucide-react";

export function QuickQcMenu({ store, version, ready, onSaved }: {
  store: string;
  version?: string;
  ready: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false);
    };
    // Saving disables menu items and can move focus to the document body.
    // Handle Escape before the comparison's window listener in that case too.
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape, true);
    };
  }, [open]);

  async function save(verdict: "passed" | "failed") {
    if (saving || !ready || !version) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/qa/website-migrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "quick", store, version, verdict }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Không lưu được đánh giá QC");
      setOpen(false);
      onSaved();
      trigger.current?.focus();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không lưu được đánh giá QC");
    } finally {
      setSaving(false);
    }
  }

  return <div ref={root} className="relative shrink-0" onKeyDown={(event) => {
    if (!open) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
      const index = items.findIndex((item) => item === document.activeElement);
      items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
    }
  }} onBlur={(event) => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget) && !menu.current?.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open}
      disabled={saving} onClick={() => {
        const rect = trigger.current?.getBoundingClientRect();
        if (rect) setPosition({ top: rect.bottom + 8, left: Math.max(8, Math.min(rect.right - 256, window.innerWidth - 264)) });
        setError(""); setOpen(!open);
      }}
      className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
      <CheckCircle2 className="size-4" /> {saving ? "Đang lưu QC…" : "Đánh giá QC"} <ChevronDown className="size-3.5" />
    </button>
    {open && createPortal(<div ref={menu} style={position} className="fixed z-[1000001] w-64 rounded-xl border border-slate-600 bg-slate-900 p-2 shadow-2xl">
      <div role="menu" aria-label="Đánh giá QC">
        <button type="button" role="menuitem" disabled={saving || !ready || !version} onClick={() => void save("passed")}
          className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-emerald-400 hover:bg-slate-800 focus:bg-slate-800 disabled:opacity-40">Pass</button>
        <button type="button" role="menuitem" disabled={saving || !ready || !version} onClick={() => void save("failed")}
          className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-400 hover:bg-slate-800 focus:bg-slate-800 disabled:opacity-40">Failed</button>
      </div>
      {(!ready || !version) && <p className="px-3 py-2 text-xs text-amber-300">Chưa thể lưu: website cần migrate thành công và có phiên bản evidence.</p>}
      {error && <p role="alert" className="px-3 py-2 text-xs text-rose-300">{error}</p>}
    </div>, document.body)}
  </div>;
}
