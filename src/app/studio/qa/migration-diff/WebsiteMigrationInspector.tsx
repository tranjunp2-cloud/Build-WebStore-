"use client";
import { useEffect, useState } from "react";
import {
  AutomaticImageCheck,
  type ImageCheckResult,
} from "./AutomaticImageCheck";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  WebsiteMigrationEvidence,
  WebsiteComparison,
  type Detail,
} from "./WebsiteMigrationEvidence";

export function WebsiteMigrationInspector({
  storeId,
  onClose,
  onReviewed,
}: {
  storeId: string;
  onClose: () => void;
  onReviewed: () => void;
}) {
  const [imageChecks, setImageChecks] = useState<ImageCheckResult[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [tab, setTab] = useState("visual"),
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
    setTab("visual");
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
  }, [storeId, refresh]);
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
      role="dialog"
      aria-modal="true"
      aria-label="Đối soát store"
      className="fixed inset-3 z-50 overflow-auto rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl"
      data-testid="migration-live-inspector"
    >
      <header className="sticky top-0 z-10 flex justify-between gap-4 bg-slate-950 py-3">
        <h2 className="text-xl font-semibold">
          Store {storeId}
          {detail ? ` — ${detail.name}` : ""}
        </h2>
        <div className="flex gap-2">
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
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
      {!detail && !error && <p>Đang đọc evidence…</p>}
      {detail && (
        <>
          <nav
            aria-label="Phạm vi đối soát"
            className="mb-5 flex flex-wrap gap-2"
          >
            {[
              ["visual", "Website song song"],
              ["content", "Nội dung / mapping / settings"],
              ["audit", "Media / lỗi website"],
              ["review", "Đánh giá QC"],
            ].map(([value, label]) => (
              <Button
                variant="outline"
                key={value}
                aria-pressed={tab === value}
                className={
                  control +
                  (tab === value ? " border-blue-500 text-blue-300" : "")
                }
                onClick={() => setTab(value)}
              >
                {label}
              </Button>
            ))}
          </nav>
          {detail.review && (
            <AutomaticImageCheck
              key={detail.review.version}
              store={storeId}
              version={detail.review.version}
              onResults={setImageChecks}
            />
          )}
          {tab === "visual" && <WebsiteComparison detail={detail} />}
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
                <Select
                  value={verdict}
                  onValueChange={(value) => setVerdict(value as typeof verdict)}
                >
                  <SelectTrigger
                    aria-label="Kết luận"
                    className={control + " mt-2"}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passed">QC Pass</SelectItem>
                    <SelectItem value="warning">Cần xem lại</SelectItem>
                    <SelectItem value="failed">P0 — tester xác nhận</SelectItem>
                  </SelectContent>
                </Select>
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
              <Button
                variant="outline"
                className={control}
                disabled={
                  saving ||
                  !note.trim() ||
                  !detail.attemptId ||
                  (verdict === "passed" &&
                    !Object.values(checks).every(Boolean))
                }
                onClick={() => void save()}
              >
                {saving ? "Đang lưu…" : "Lưu đánh giá QC"}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
