"use client";
import { useEffect, useRef, useState } from "react";
import {
  AutomaticImageCheck,
  type ImageCheckResult,
} from "./AutomaticImageCheck";
import { useStudioCan } from "../../_components/studio-permissions-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  WebsiteMigrationEvidence,
  WebsiteComparison,
  type Detail,
} from "./WebsiteMigrationEvidence";

export function WebsiteMigrationInspector({
  storeId,
  onClose,
  onReviewed,
  reviewOnly = false,
}: {
  storeId: string;
  onClose: () => void;
  onReviewed: () => void;
  reviewOnly?: boolean;
}) {
  const canReviewMigration = useStudioCan()("migration.review");
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (reviewOnly) dialogRef.current?.focus();
  }, [reviewOnly]);
  const [imageChecks, setImageChecks] = useState<ImageCheckResult[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [tab, setTab] = useState(reviewOnly ? "review" : "visual"),
    [note, setNote] = useState(""),
    [verdict, setVerdict] = useState<"passed" | "warning" | "failed">(
      "warning",
    ),
    [saving, setSaving] = useState(false);
  const [checks, setChecks] = useState({
    content: false,
    media: false,
    mapping: false,
    visual: false,
    audit: false,
  });
  useEffect(() => {
    const controller = new AbortController();
    setDetail(null);
    setError("");
    setNote("");
    setChecks({
      content: false,
      media: false,
      mapping: false,
      visual: false,
      audit: false,
    });
    setVerdict("warning");
    setTab(reviewOnly ? "review" : "visual");
    async function load() {
      try {
        const response = await fetch(
          `/api/admin/qa/website-migrations?store=${storeId}`,
          { cache: "no-store", signal: controller.signal },
        );
        const body = await response.json();
        if (!response.ok) throw Error(body.error ?? `HTTP ${response.status}`);
        if (!controller.signal.aborted) setDetail(body.data);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Không đọc được evidence");
      }
    }
    void load();
    return () => controller.abort();
  }, [storeId, refresh, reviewOnly]);
  async function save() {
    if (!detail?.review) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/qa/website-migrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store: storeId,
          version: detail.review.version,
          verdict,
          note,
          checks,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error);
      setRefresh((r) => r + 1);
      onReviewed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được QC");
    } finally {
      setSaving(false);
    }
  }
  const control =
    "rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm";
  return (
    <section
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (!reviewOnly || event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        )).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={reviewOnly ? "Đánh giá QC website" : "Đối soát store"}
      className="fixed inset-0 z-[999999] flex min-h-0 flex-col overflow-hidden border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl"
      data-testid="migration-live-inspector"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-950 px-5 py-4 sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="outline"
            aria-label={reviewOnly ? "Quay lại so sánh" : "Quay lại danh sách"}
            className="h-9 w-9 rounded-xl border-slate-700 bg-slate-900 p-0 text-lg"
            onClick={onClose}
          >
            ←
          </Button>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/40 bg-blue-600 text-xs font-black text-white">
            PW
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-bold">
                {detail ? detail.name : `Store ${storeId}`}
              </h2>
              {detail && (
                <span className="rounded-md bg-sky-500/15 px-2 py-0.5 font-mono text-xs font-semibold text-sky-300">
                  PW1-{storeId}
                </span>
              )}
            </div>
            {detail && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>Site {detail.siteId}</span>
                <span>•</span>
                <span>{detail.pages.length} trang đã map</span>
                <span>•</span>
                <span className={detail.migration === "completed" ? "text-emerald-300" : "text-amber-300"}>
                  Migrate: {detail.migration}
                </span>
                <span className={detail.publish === "published" ? "text-emerald-300" : "text-amber-300"}>
                  Publish: {detail.publish}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            className={control}
            onClick={() => setRefresh((r) => r + 1)}
          >
            Làm mới evidence
          </Button>
          <Button variant="outline" className={control} onClick={onClose}>
            Đóng
          </Button>
        </div>
      </header>
      {detail && !reviewOnly && (
        <nav
          aria-label="Phạm vi đối soát"
          className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-950 px-5 py-3 sm:px-7"
        >
          {[
            ["visual", "◉ Xem web thật (Live iframe)"],
            ["content", "☷ Nội dung / mapping"],
            ["audit", "⚑ Media / lỗi website"],
            ["review", "✓ Đánh giá QC"],
          ].map(([value, label]) => (
            <Button
              variant="outline"
              key={value}
              aria-pressed={tab === value}
              className={
                control +
                (tab === value
                  ? " border-blue-500 bg-blue-600 text-white hover:bg-blue-600"
                  : " text-slate-400")
              }
              onClick={() => setTab(value)}
            >
              {label}
            </Button>
          ))}
        </nav>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
        {error && (
          <p role="alert" className="text-red-300">
            {error}
          </p>
        )}
        {!detail && !error && <p>Đang đọc evidence…</p>}
        {detail && (
          <div className="space-y-5">
          {detail.review && !reviewOnly && (
            <AutomaticImageCheck
              key={detail.review.version}
              store={storeId}
              version={detail.review.version}
              onResults={setImageChecks}
            />
          )}
          {tab === "visual" && <WebsiteComparison key={detail.storeId} detail={detail} />}
          {["content", "audit"].includes(tab) && (
            <WebsiteMigrationEvidence
              detail={detail}
              imageChecks={imageChecks}
              mode={tab === "audit" ? "audit" : "content"}
            />
          )}
          {tab === "review" && (
            <div className="max-w-2xl space-y-4">
              <p>
                QC là kết luận của tester sau khi đối chiếu PW1/PW2. Không tự
                tính % hoặc xác nhận dữ liệu nghiệp vụ BE.
              </p>
              <p>
                {detail.review?.verdict
                  ? `Đánh giá gần nhất: ${detail.review.verdict} · ${detail.review.reviewedAt} · ${detail.review.current ? "Còn hiệu lực" : "Đã cũ, cần kiểm tra lại"}`
                  : "Chưa có đánh giá QC"}
              </p>
              {detail.review?.checks && (
                <p className="text-sm text-slate-400">
                  Phạm vi lần đánh giá trước:{" "}
                  {Object.entries(detail.review.checks)
                    .filter(([, checked]) => checked)
                    .map(([key]) => key)
                    .join(", ") || "Chưa ghi nhận"}
                </p>
              )}
              {detail.review?.note && (
                <p className="whitespace-pre-wrap rounded-xl bg-slate-900 p-3">
                  {detail.review.note}
                </p>
              )}
              {canReviewMigration && (
              <>
              <fieldset className="space-y-2 rounded-xl border border-slate-700 p-4">
                <legend>Phạm vi đã kiểm tra</legend>
                {(
                  [
                    ["content", "Văn bản / nội dung PW1 → PW2"],
                    ["media", "Hình ảnh / media"],
                    ["mapping", "Page / component mapping và settings"],
                    ["visual", "Giao diện desktop / mobile"],
                    ["audit", "Các findings của audit tự động"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3">
                    <Checkbox
                      checked={checks[key]}
                      onCheckedChange={(checked) =>
                        setChecks((c) => ({ ...c, [key]: checked === true }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <label className="block">
                Kết luận
                <select
                  aria-label="Kết luận"
                  className={control + " mt-2 block w-full"}
                  value={verdict}
                  onChange={(event) => setVerdict(event.target.value as typeof verdict)}
                >
                  <option value="passed">QC Pass</option>
                  <option value="warning">Cần xem lại</option>
                  <option value="failed">P0 — tester xác nhận</option>
                </select>
              </label>
              <label className="block">
                Ghi chú kiểm chứng (bắt buộc)
                <Textarea
                  className={control + " mt-2 w-full"}
                  maxLength={2000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Trang / block đã kiểm tra, lỗi hoặc cơ sở kết luận"
                />
              </label>
              <p className="break-all text-xs text-slate-400">
                Input: {detail.inputHash} · Attempt:{" "}
                {detail.attemptId ?? "Chưa commit"}
              </p>
              {(!detail.attemptId || detail.migration !== "completed" || !detail.review) && (
                <p role="status" className="text-sm text-amber-300">
                  Chưa thể lưu QC: website cần migrate thành công và có phiên bản evidence để gắn đánh giá. Không yêu cầu dữ liệu tính % tự động.
                </p>
              )}
              <Button
                variant="outline"
                className={control}
                disabled={
                  saving ||
                  !note.trim() ||
                  !detail.attemptId ||
                  !detail.review ||
                  detail.migration !== "completed" ||
                  (verdict === "passed" &&
                    !Object.values(checks).every(Boolean))
                }
                onClick={() => void save()}
              >
                {saving ? "Đang lưu…" : "Lưu đánh giá QC"}
              </Button>
              </>
              )}
            </div>
          )}
          </div>
        )}
      </div>
    </section>
  );
}
